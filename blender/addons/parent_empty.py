bl_info = {
    "name": "Parent Empty",
    "author": "Wizard Game",
    "version": (1, 0, 0),
    "blender": (4, 2, 0),
    "location": "3D View > Object > Parent Empty  (Ctrl+Shift+P)",
    "description": "Create an empty at each selected object's origin and parent the object to it",
    "category": "Object",
}

import bpy
from bpy.props import EnumProperty, FloatProperty
from mathutils import Matrix


class OBJECT_OT_parent_empty(bpy.types.Operator):
    """Create an empty at the selected object's origin and parent the object to it"""

    bl_idname = "object.parent_empty"
    bl_label = "Parent Empty"
    bl_options = {"REGISTER", "UNDO"}

    display_type: EnumProperty(
        name="Display As",
        items=[
            ("PLAIN_AXES", "Plain Axes", ""),
            ("ARROWS", "Arrows", ""),
            ("CUBE", "Cube", ""),
            ("SPHERE", "Sphere", ""),
            ("CIRCLE", "Circle", ""),
        ],
        default="PLAIN_AXES",
    )

    display_size: FloatProperty(
        name="Size",
        default=1.0,
        min=0.001,
        soft_max=10.0,
    )

    @classmethod
    def poll(cls, context):
        return context.mode == "OBJECT" and bool(context.selected_objects)

    def execute(self, context):
        empties = []

        for obj in context.selected_objects:
            # Read before reparenting — changing obj.parent changes how
            # matrix_world is derived.
            origin = obj.matrix_world.translation.copy()
            empty_world = Matrix.Translation(origin)

            empty = bpy.data.objects.new(f"{obj.name}_parent", None)
            empty.empty_display_type = self.display_type
            empty.empty_display_size = self.display_size
            empty.matrix_world = empty_world

            for collection in obj.users_collection:
                collection.objects.link(empty)

            # Slot the empty into the object's place in the hierarchy so an
            # existing parent isn't silently dropped.
            if obj.parent:
                empty.parent = obj.parent
                empty.matrix_parent_inverse = obj.parent.matrix_world.inverted()

            obj.parent = empty
            # Cancels the empty's transform at bind time so the object doesn't
            # move now, while later edits to the empty still drive it.
            obj.matrix_parent_inverse = empty_world.inverted()

            empties.append(empty)

        # Leave the empties selected — they're what you'll want to transform.
        for obj in context.selected_objects:
            obj.select_set(False)
        for empty in empties:
            empty.select_set(True)
        context.view_layer.objects.active = empties[-1]

        self.report({"INFO"}, f"Created {len(empties)} parent empty(s)")
        return {"FINISHED"}


def menu_func(self, context):
    self.layout.operator(OBJECT_OT_parent_empty.bl_idname, icon="EMPTY_AXIS")


addon_keymaps = []


def register():
    bpy.utils.register_class(OBJECT_OT_parent_empty)
    bpy.types.VIEW3D_MT_object.append(menu_func)

    kc = bpy.context.window_manager.keyconfigs.addon
    if kc:
        km = kc.keymaps.new(name="Object Mode", space_type="EMPTY")
        kmi = km.keymap_items.new(
            OBJECT_OT_parent_empty.bl_idname, "P", "PRESS", ctrl=True, shift=True
        )
        addon_keymaps.append((km, kmi))


def unregister():
    for km, kmi in addon_keymaps:
        km.keymap_items.remove(kmi)
    addon_keymaps.clear()

    bpy.types.VIEW3D_MT_object.remove(menu_func)
    bpy.utils.unregister_class(OBJECT_OT_parent_empty)


if __name__ == "__main__":
    register()
