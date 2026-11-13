// A limit on wrong passwords, so nobody can guess an account's password by
// trying thousands of them. Counted per account name (or email) typed in,
// not per address: behind the host's proxy every player may arrive from the
// same address, and one guesser would lock everyone out.
// The cost: someone who keeps typing wrong passwords for an account locks
// its owner out too, but only for the WINDOW and only while they keep at it.

export const MAX_FAILURES = 10;
export const WINDOW_MS = 15 * 60 * 1000;

// Failure times per login, oldest first. Kept in memory: a server restart
// clears it, which is fine for a limit of minutes.
const failures = new Map<string, number[]>();

function key(login: string): string {
  return login.trim().toLowerCase();
}

function recent(login: string, now: number): number[] {
  const times = (failures.get(key(login)) ?? []).filter((time) => now - time < WINDOW_MS);
  if (times.length) failures.set(key(login), times);
  else failures.delete(key(login));
  return times;
}

// Seconds until this login may be tried again, or 0 if it may now.
export function secondsLocked(login: string, now = Date.now()): number {
  const times = recent(login, now);
  if (times.length < MAX_FAILURES) return 0;
  // Free again once enough of the failures have aged out of the window.
  const freedAt = (times[times.length - MAX_FAILURES] ?? now) + WINDOW_MS;
  return Math.max(1, Math.ceil((freedAt - now) / 1000));
}

export function recordFailure(login: string, now = Date.now()): void {
  const times = recent(login, now);
  times.push(now);
  failures.set(key(login), times);

  // Logins nobody tries again would stay forever; clear the old ones now
  // and then.
  if (failures.size > 5000) {
    for (const [name, list] of failures) {
      if (now - (list[list.length - 1] ?? 0) >= WINDOW_MS) failures.delete(name);
    }
  }
}

export function clearFailures(login: string): void {
  failures.delete(key(login));
}
