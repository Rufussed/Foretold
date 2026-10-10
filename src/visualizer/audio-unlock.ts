// iOS keeps a Web Audio context suspended until it is resumed from inside a
// touch or click, and a deal or a score arrives from the server, not from a
// touch - so resuming at play time never works there. Contexts register here,
// and the player's first touch or click wakes them all.
const contexts = new Set<AudioContext>();
const events = ["touchend", "pointerup", "click", "keydown"] as const;

const unlock = () => {
  for (const ctx of contexts) {
    if (ctx.state === "running") continue;
    void ctx.resume();
    // A silent blip inside the gesture, which older iOS needs to open the context.
    const blip = ctx.createBufferSource();
    blip.buffer = ctx.createBuffer(1, 1, 22050);
    blip.connect(ctx.destination);
    blip.start();
  }
  // Keep listening until every context is running, since one may be made later.
  if ([...contexts].every((ctx) => ctx.state === "running")) detach();
};

const detach = () => {
  for (const name of events) window.removeEventListener(name, unlock, true);
};

export function unlockOnGesture(ctx: AudioContext): void {
  contexts.add(ctx);
  ctx.addEventListener("statechange", () => {
    if (ctx.state === "closed") contexts.delete(ctx);
  });
  for (const name of events) window.addEventListener(name, unlock, true);
}
