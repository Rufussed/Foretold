"""Build the turn-timer hourglass: a disc top and bottom, glass and sand.

Everything is made from code, so it can be rebuilt after any change to the
numbers below. Total height is HEIGHT scene units; the visualiser scales it.
The parts hang from `Flip`, a pivot at the middle of the hourglass.

The sand is one mesh, `Sand`: the top heap, the bottom heap and the falling
stream. Its shape keys come in two chains of steps, each key holding one step
(its offset from the step before, not from full); with every key at 0 the
sand is full and ready to run. For a chain of N keys at progress t (0 .. 1),
key k (1-based) is clamp(t * N - (k - 1), 0, 1): earlier steps at 1, the
current one partway, later ones 0. Steps rather than one straight-line morph
keep the sand inside the curved glass on the way.

- `drain1` .. `drainN`, progress p: 0 full, 1 the top empty. The top surface
  falls at a steady rate, and what leaves the top lands in the bottom.
- `clear1`, one step, 0 .. 1 after the drain: the stream's top falls onto
  the bottom heap, the last grains landing. Drain and clear both at 1 is run
  out.
- `settle1` .. `settleN`, progress 1 - q, where q is 0 just flipped .. 1
  settled: the sand sliding down from the top disc onto the neck.

A turn starts with the flip (FLIP_SECONDS):
1. Sand run out (drain and clear keys all 1, settle keys all 0); turn `Flip`
   180 degrees about its y axis (z in the GLB, which is y-up), easing in and
   out. The sand turns with the glass.
2. At the end, snap `Flip` back to 0, drain and clear keys to 0 and settle
   keys to 1. The glass and discs are symmetrical and the settle start is the
   run-out sand upside down, so nothing visibly changes.
3. Settle over SETTLE_SECONDS (q 0 -> 1), drain over the turn (p 0 -> 1),
   then clear over CLEAR_SECONDS.

The .blend's timeline plays that sequence, with the drain over DRAIN_FRAMES.
The GLB carries no animation: the game plays it from the turn clock.

Run inside Blender (any file; it makes its own scene and leaves others alone):

    import sys, importlib; sys.path.insert(0, '/path/to/wizard-game/blender')
    import build_hourglass as h; importlib.reload(h)
    h.run()                         # build into scene 'Hourglass'
    h.preview(p=.5)                 # pose by hand; h.play() restores the timeline
    h.export('/path/to/wizard-game/src/assets/models/wizard/hourglass.glb')
"""
import bpy
import bmesh
import math
from mathutils import Vector

SCENE = 'Hourglass'
HEIGHT = 1.0          # overall, base to top of the frame
SEGMENTS = 32         # around the axis

# Glass, as a fraction of the half-height of the glass (neck to end). Each
# bulb is widest near its disc and curves in to a long, narrow neck.
BULB_RADIUS = 0.66    # widest
NECK_RADIUS = 0.05
WIDEST_AT = 0.86      # where the widest point is, 0 neck .. 1 end
END_ROUNDING = 0.12   # how much the glass narrows from widest to the disc
SAND_INSET = 0.012    # sand sits this far inside the glass

# The two discs, top and bottom.
PLATE_RADIUS = 0.36
PLATE_THICKNESS = 0.07

FULL_LEVEL = 0.80     # sand height in the top bulb at the start, 0 neck .. 1 end
PEAK = 0.10           # how much higher the bottom heap's tip is than its edge
DIP = 0.06            # how far the top surface sinks into a funnel at the axis
STREAM_RADIUS = 0.02 
RINGS = 10            # rings up each sand heap
DRAIN_STEPS = 6
DRAIN_FRAMES = 240    # in the Blender preview; the game uses the turn clock
FLIP_SECONDS = 2.0
SETTLE_SECONDS = 0.3  # the sand sliding down onto the neck after the flip
SETTLE_STEPS = 6
CLEAR_SECONDS = 0.5   # the last grains falling once the top is empty

GLASS_RGBA = (0.92, 0.97, 1.0, 0.08)
SAND_RGBA = (0.90, 0.45, 0.12, 1.0)
WOOD_RGBA = (0.12, 0.04, 0.015, 1.0)


# Glass half-height, and the neck's height above the base.
def _half():
    return HEIGHT / 2 - PLATE_THICKNESS


def _neck_z():
    return HEIGHT / 2


def glass_radius(u):
    """Inner radius at u = 0 (neck) .. 1 (end of a bulb), in scene units."""
    u = min(max(u, 0.0), 1.0)
    if u <= WIDEST_AT:
        width = (1 - math.cos(math.pi * u / WIDEST_AT)) / 2
    else:                                   # rounding over to meet the disc
        t = (u - WIDEST_AT) / (1 - WIDEST_AT)
        width = 1 - END_ROUNDING * (1 - math.sqrt(1 - t * t))
    return _half() * (NECK_RADIUS + (BULB_RADIUS - NECK_RADIUS) * width)


def sand_radius(u):
    return max(glass_radius(u) - SAND_INSET * _half(), 0.0)


def _volume(u0, u1, steps=200):
    """Sand volume between bulb heights u0 and u1."""
    du = (u1 - u0) / steps
    return sum(math.pi * sand_radius(u0 + (i + .5) * du) ** 2 * du * _half()
               for i in range(steps))


def _level_from_end(vol):
    """Height u in a bulb, measured up from its far end, that holds vol."""
    lo, hi = 0.0, 1.0
    for _ in range(40):
        mid = (lo + hi) / 2
        if _volume(1.0 - mid, 1.0) < vol:
            lo = mid
        else:
            hi = mid
    return lo


# --- sand shapes --------------------------------------------------------------

def _total():
    return _volume(0.0, FULL_LEVEL)


def _end_heap():
    """Bottom heap height, from its end, once all the sand has run through."""
    return _level_from_end(_total())


def _band_top(lo):
    """Top of a band of sand in the top bulb, from lo up, holding all the sand."""
    low, high = lo, 1.0
    for _ in range(40):
        mid = (low + high) / 2
        if _volume(lo, mid) < _total():
            low = mid
        else:
            high = mid
    return low


def _shape(top_lo, top_hi, dip, cone, heap, stream, fall=0.0):
    """Every sand vertex position, in a fixed order.

    The top heap fills the top bulb from top_lo to top_hi (0 neck .. 1 end),
    its upper centre sunk by dip and its lower centre reaching cone further
    toward the neck; empty, it shrinks to a point at the neck. The bottom heap
    fills heap up from the bottom end. The stream runs from the neck to the
    bottom heap's peak, stream wide; fall (0 .. 1) drops its top end down onto
    the peak, the last grains landing.
    """
    half, neck = _half(), _neck_z()
    pts = []

    def ring(radius, z):
        for s in range(SEGMENTS):
            a = 2 * math.pi * s / SEGMENTS
            pts.append((radius * math.cos(a), radius * math.sin(a), z))

    # Top heap: rings from its lower edge up to its surface, then the centres.
    for i in range(RINGS + 1):
        u = top_lo + (top_hi - top_lo) * i / RINGS
        ring(sand_radius(u) if top_hi > top_lo else 0.0, neck + u * half)
    pts.append((0, 0, neck + top_hi * half - dip * half))
    pts.append((0, 0, neck + max(top_lo - cone, 0.0) * half))

    # Bottom heap: rings from the far end up to its edge, then the peak.
    # Empty, it shrinks to a point at the centre rather than lying flat.
    for i in range(RINGS + 1):
        u = 1.0 - heap * i / RINGS
        ring(sand_radius(u) if heap > 0 else 0.0, neck - u * half)
    edge = neck - (1.0 - heap) * half
    peak = edge + PEAK * half * min(1.0, heap * 6)
    pts.append((0, 0, peak))
    pts.append((0, 0, neck - half))                  # bottom heap's base centre

    ring(stream, neck + (peak - neck) * fall)
    ring(stream, peak)
    return pts


def _sand_points(p, fall=0.0):
    """The sand at drain progress p: 0 full, 1 the top empty. The stream
    still runs at 1; fall then drops its last grains onto the heap."""
    # The top surface falls at a steady rate; the bottom gets what it lost.
    top_level = FULL_LEVEL * (1 - p)
    heap = _level_from_end(_volume(top_level, FULL_LEVEL))
    dip = DIP * min(1.0, p * 8) * (1 - p) ** .5
    return _shape(0.0, top_level, dip, 0.0, heap, STREAM_RADIUS * _half(), fall)


def _settle_points(q):
    """The sand just after the flip, settling onto the neck: q 0 .. 1.

    At 0 it is the run-out sand turned upside down - a heap against the top
    disc, its peak pointing at the neck - and at 1 it is full and ready to
    run. In between, the band of sand slides down the bulb, keeping its volume.
    """
    if q >= 1:
        return _sand_points(0.0)
    end = _end_heap()
    lo = (1.0 - end) * (1 - q)
    hi = 1.0 if q <= 0 else _band_top(lo)
    cone = PEAK * min(1.0, end * 6) * (1 - q)
    return _shape(lo, hi, 0.0, cone, 0.0, 0.0)


def _sand_mesh():
    bm = bmesh.new()
    verts = [bm.verts.new(co) for co in _sand_points(0.0)]
    n = SEGMENTS

    def ring_faces(first, count):
        for r in range(count - 1):
            for s in range(n):
                a, b = first + r * n + s, first + r * n + (s + 1) % n
                bm.faces.new((verts[a], verts[b], verts[b + n], verts[a + n]))

    def fan(ring_start, centre, flip):
        for s in range(n):
            a, b = ring_start + s, ring_start + (s + 1) % n
            face = (verts[b], verts[a], verts[centre]) if flip else \
                   (verts[a], verts[b], verts[centre])
            bm.faces.new(face)

    rings = RINGS + 1
    top = 0
    ring_faces(top, rings)
    fan(top + (rings - 1) * n, top + rings * n, False)       # dipped surface
    fan(top, top + rings * n + 1, True)                       # neck end

    bottom = rings * n + 2
    ring_faces(bottom, rings)
    fan(bottom + (rings - 1) * n, bottom + rings * n, True)   # peak
    fan(bottom, bottom + rings * n + 1, False)                # base

    stream = bottom + rings * n + 2
    ring_faces(stream, 2)

    bm.normal_update()
    mesh = bpy.data.meshes.new('Sand')
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = True
    return mesh


def _add_step_keys(obj, name, steps, points):
    """name1..N, each the step from the shape before it, all on Basis."""
    basis = [v.co.copy() for v in obj.data.vertices]
    previous = points(0.0)
    for k in range(1, steps + 1):
        current = points(k / steps)
        key = obj.shape_key_add(name=f'{name}{k}', from_mix=False)
        for i, point in enumerate(key.data):
            point.co = basis[i] + Vector(current[i]) - Vector(previous[i])
        previous = current


def _add_sand_keys(obj):
    obj.shape_key_add(name='Basis', from_mix=False)
    _add_step_keys(obj, 'drain', DRAIN_STEPS, _sand_points)
    _add_step_keys(obj, 'clear', 1, lambda t: _sand_points(1.0, t))
    # Taken backwards, from full to just flipped, so all at 0 is full.
    _add_step_keys(obj, 'settle', SETTLE_STEPS, lambda t: _settle_points(1 - t))


def step_weights(progress, steps):
    """Key weights for a chain of step keys at progress 0 .. 1."""
    return [min(max(progress * steps - (k - 1), 0.0), 1.0)
            for k in range(1, steps + 1)]


def _pose(keys, p=0.0, q=1.0, c=0.0):
    """Drain progress p, settle progress q, clear progress c."""
    for k, w in enumerate(step_weights(p, DRAIN_STEPS), 1):
        keys.key_blocks[f'drain{k}'].value = w
    keys.key_blocks['clear1'].value = c
    for k, w in enumerate(step_weights(1 - q, SETTLE_STEPS), 1):
        keys.key_blocks[f'settle{k}'].value = w


def _frames():
    """Frame numbers: flip start, flip end, settled, top empty, cleared."""
    fps = bpy.context.scene.render.fps
    flip_end = 1 + round(FLIP_SECONDS * fps)
    settled = flip_end + round(SETTLE_SECONDS * fps)
    empty = settled + DRAIN_FRAMES
    return 1, flip_end, settled, empty, empty + round(CLEAR_SECONDS * fps)


def _add_preview_actions(pivot, sand_obj):
    """The whole sequence on the timeline: flip, settle, drain, clear."""
    start, flip_end, settled, empty, cleared = _frames()

    pivot.animation_data_create()
    pivot.animation_data.action = bpy.data.actions.new('flip')
    for frame, angle in ((start, 0.0), (flip_end, math.pi), (flip_end + 1, 0.0)):
        pivot.rotation_euler.y = angle
        pivot.keyframe_insert('rotation_euler', index=1, frame=frame)
    curve = _fcurves(pivot.animation_data.action)[0]
    curve.keyframe_points[0].interpolation = 'BEZIER'
    curve.keyframe_points[1].interpolation = 'CONSTANT'   # snap back with the swap
    pivot.rotation_euler.y = 0.0

    keys = sand_obj.data.shape_keys
    keys.animation_data_create()
    keys.animation_data.action = bpy.data.actions.new('sand')
    plan = [(start, 1.0, 1.0, 1.0), (flip_end, 1.0, 1.0, 1.0),  # run out, turning
            (flip_end + 1, 0.0, 0.0, 0.0)]                      # swapped: just flipped
    for k in range(1, SETTLE_STEPS + 1):
        plan.append((flip_end + 1 + (settled - flip_end - 1) * k / SETTLE_STEPS,
                     0.0, k / SETTLE_STEPS, 0.0))
    for k in range(1, DRAIN_STEPS + 1):
        plan.append((settled + DRAIN_FRAMES * k / DRAIN_STEPS, k / DRAIN_STEPS, 1.0, 0.0))
    plan.append((cleared, 1.0, 1.0, 1.0))
    for frame, p, q, c in plan:
        _pose(keys, p, q, c)
        for block in keys.key_blocks[1:]:
            block.keyframe_insert('value', frame=frame)
    for curve in _fcurves(keys.animation_data.action):
        for point in curve.keyframe_points:
            point.interpolation = 'CONSTANT' if point.co.x == flip_end else 'LINEAR'
    _pose(keys)


def _fcurves(action):
    if hasattr(action, 'fcurves') and len(action.fcurves):
        return list(action.fcurves)
    curves = []
    for layer in getattr(action, 'layers', []):
        for strip in layer.strips:
            for bag in strip.channelbags:
                curves.extend(bag.fcurves)
    return curves


# --- glass and discs ----------------------------------------------------------

def _lathe(name, profile, cap_ends=False):
    """Spin (radius, z) points round the axis into a mesh."""
    bm = bmesh.new()
    rings = []
    for radius, z in profile:
        rings.append([bm.verts.new((radius * math.cos(2 * math.pi * s / SEGMENTS),
                                    radius * math.sin(2 * math.pi * s / SEGMENTS), z))
                      for s in range(SEGMENTS)])
    for lower, upper in zip(rings, rings[1:]):
        for s in range(SEGMENTS):
            t = (s + 1) % SEGMENTS
            bm.faces.new((lower[s], lower[t], upper[t], upper[s]))
    if cap_ends:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = True
    return mesh


def _glass_mesh():
    half, neck = _half(), _neck_z()
    steps = 24
    profile = []
    for i in range(steps, -1, -1):                 # bottom end up to the neck
        u = i / steps
        profile.append((glass_radius(u), neck - u * half))
    for i in range(1, steps + 1):                  # neck up to the top end
        u = i / steps
        profile.append((glass_radius(u), neck + u * half))
    return _lathe('Glass', profile)


def _plate_mesh(name, z0):
    r, t = PLATE_RADIUS * HEIGHT, PLATE_THICKNESS
    lip = 0.012 * HEIGHT
    profile = [(r - lip, z0), (r, z0 + lip), (r, z0 + t - lip), (r - lip, z0 + t)]
    return _lathe(name, profile, cap_ends=True)


def _material(name, rgba, roughness, metallic=0.0, blended=False):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*rgba[:3], 1.0)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Alpha'].default_value = rgba[3]
    if blended:
        mat.surface_render_method = 'BLENDED'
        mat.use_backface_culling = False
    return mat


def _link(scene, name, mesh, material, parent):
    obj = bpy.data.objects.new(name, mesh)
    mesh.materials.append(material)
    scene.collection.objects.link(obj)
    obj.parent = parent
    return obj


def run():
    """(Re)build the hourglass in its own scene."""
    # Show the new scene before removing the old one: removing the scene the
    # window is showing can crash Blender.
    scene = bpy.data.scenes.new(SCENE + '.new')
    bpy.context.window.scene = scene
    old = bpy.data.scenes.get(SCENE)
    if old:
        for obj in list(old.objects):
            bpy.data.objects.remove(obj)
        bpy.data.scenes.remove(old)
    for block in (bpy.data.meshes, bpy.data.actions):
        for item in list(block):
            if item.users == 0:
                block.remove(item)
    scene.name = SCENE
    scene.frame_start = 1

    glass = _material('HourglassGlass', GLASS_RGBA, 0.05, blended=True)
    sand = _material('HourglassSand', SAND_RGBA, 0.9)
    wood = _material('HourglassWood', WOOD_RGBA, 0.55)

    root = bpy.data.objects.new('Hourglass', None)
    scene.collection.objects.link(root)
    # The flip turns everything about the middle of the hourglass.
    pivot = bpy.data.objects.new('Flip', None)
    scene.collection.objects.link(pivot)
    pivot.parent = root
    pivot.location.z = HEIGHT / 2

    parts = [
        _link(scene, 'BasePlate', _plate_mesh('BasePlate', 0.0), wood, pivot),
        _link(scene, 'TopPlate', _plate_mesh('TopPlate', HEIGHT - PLATE_THICKNESS),
              wood, pivot),
        _link(scene, 'Sand', _sand_mesh(), sand, pivot),
        _link(scene, 'Glass', _glass_mesh(), glass, pivot),
    ]
    for part in parts:
        part.location.z = -HEIGHT / 2
    sand_obj = parts[2]
    _add_sand_keys(sand_obj)
    _add_preview_actions(pivot, sand_obj)
    scene.frame_end = _frames()[4]

    scene.frame_set(1)
    return root


def preview(p=0.0, q=1.0, turn=0.0, c=0.0):
    """Pose it as the game will: drain progress p (0 full .. 1 top empty),
    clear progress c (the last grains falling), settle progress q (0 just
    flipped .. 1 settled), flip turn 0 .. 1."""
    scene = bpy.data.scenes[SCENE]
    pivot, keys = scene.objects['Flip'], scene.objects['Sand'].data.shape_keys
    pivot.animation_data.action = None
    keys.animation_data.action = None
    pivot.rotation_euler.y = math.pi * turn
    _pose(keys, p, q, c)


def play():
    """Put the preview animation back on the timeline after preview()."""
    scene = bpy.data.scenes[SCENE]
    scene.objects['Flip'].animation_data.action = bpy.data.actions['flip']
    scene.objects['Sand'].data.shape_keys.animation_data.action = \
        bpy.data.actions['sand']
    scene.frame_set(scene.frame_current)


def export(path):
    """Meshes, the Flip pivot and the sand keys; no animation - the game plays
    the flip and drives the keys itself (see the module notes)."""
    scene = bpy.data.scenes[SCENE]
    bpy.context.window.scene = scene
    preview()
    bpy.ops.object.select_all(action='DESELECT')
    root = scene.objects['Hourglass']
    for obj in (root, *root.children_recursive):   # not any preview camera
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB',
                              use_selection=True, export_animations=False,
                              export_morph=True, export_morph_normal=False,
                              export_apply=False)
    play()
