// A one-at-a-time background queue for work that should happen before it is
// needed but must never compete with what the page is doing now: each task
// waits for an idle moment, and only one runs at a time, so a queue of large
// downloads still leaves the network and the main thread to the visible page.

export interface PrefetchTask {
  // Named so a slow or failing step can be recognised in the console.
  name: string;
  run(): Promise<unknown>;
}

// requestIdleCallback is missing on Safari; a short timeout is close enough,
// since the point is only to let the current frame and its fetches finish.
const whenIdle = (): Promise<void> =>
  new Promise((resolve) => {
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => void })
      .requestIdleCallback;
    if (idle) idle(() => resolve(), { timeout: 2000 });
    else window.setTimeout(resolve, 200);
  });

const queue: PrefetchTask[] = [];
const started = new Set<string>();
let draining = false;

// Queued tasks are tried once per page session: a name already seen is either
// running, done, or failed, and none of those is worth repeating here — the
// asset caches retry on the next real request.
export function enqueuePrefetch(...tasks: PrefetchTask[]): void {
  for (const task of tasks) {
    if (started.has(task.name)) continue;
    started.add(task.name);
    queue.push(task);
  }
  void drain();
}

async function drain(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    for (let task = queue.shift(); task; task = queue.shift()) {
      await whenIdle();
      try {
        await task.run();
      } catch (error) {
        // A prefetch that fails costs nothing: the asset loads on demand.
        console.warn(`[prefetch] ${task.name} was not cached:`, error);
      }
    }
  } finally {
    draining = false;
  }
}
