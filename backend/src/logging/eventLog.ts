import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// What happens on the server, one line per event, to read back when
// something goes wrong: who signed in, rooms made, games started, each
// round's result, how a game ended and what it saved, and every error with
// the room it happened in. Every card played and every trick too, but only
// while that is switched on (Admin's Server log, or LOG_PLAYS=1), as it is a
// lot.
//
// Each day has its own file, data/logs/events-YYYY-MM-DD.log (LOG_DIR picks
// another folder), a JSON object per line; files older than LOG_KEEP_DAYS
// (14) are deleted. Usernames only: never a password, a token or an email.
// Each line also goes to the console, so the host's own logs have it too.
// Tests write no files; LOG_EVENTS=off logs nothing (the balance sim).

export type EventKind =
  | "server-started"
  | "signup"
  | "login"
  | "login-failed"
  | "room-created"
  | "game-started"
  | "card-played"
  | "trick-won"
  | "round-ended"
  | "player-quit"
  | "game-ended"
  | "game-expired"
  | "error";

export interface LoggedEvent {
  // When, as an ISO date.
  at: string;
  kind: EventKind;
  // The room it happened in, if any, and the players it was about, so the
  // Admin page can find them.
  room?: number;
  users?: string[];
  [field: string]: unknown;
}

const KEEP_DAYS = Number(process.env.LOG_KEEP_DAYS ?? 14);
const LOG_DIR =
  process.env.LOG_DIR ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../data/logs");
const writesFiles = !process.env.VITEST;

let playsOn = process.env.LOG_PLAYS === "1";
let prunedFor = "";

// Whether every card played and every trick are logged.
export const logsPlays = (): boolean => playsOn;
export function setLogPlays(on: boolean): void {
  playsOn = on;
}

const dayOf = (date: Date): string => date.toISOString().slice(0, 10);
const fileFor = (day: string): string => path.join(LOG_DIR, `events-${day}.log`);

// Old days' files go, once a day.
function prune(today: string): void {
  if (prunedFor === today) return;
  prunedFor = today;
  const oldest = dayOf(new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000));
  for (const name of readdirSync(LOG_DIR)) {
    const day = /^events-(\d{4}-\d{2}-\d{2})\.log$/.exec(name)?.[1];
    if (day && day < oldest) unlinkSync(path.join(LOG_DIR, name));
  }
}

// A line for the console: "[event] game-ended room=12 users=ana,ben ...".
function consoleLine(event: LoggedEvent): string {
  const { at: _at, kind, ...fields } = event;
  const parts = Object.entries(fields).map(([key, value]) =>
    `${key}=${typeof value === "string" ? value : Array.isArray(value) && value.every((item) => typeof item === "string") ? value.join(",") : JSON.stringify(value)}`);
  return `[event] ${kind} ${parts.join(" ")}`;
}

export function logEvent(kind: EventKind, fields: Omit<LoggedEvent, "at" | "kind"> = {}): void {
  if (process.env.LOG_EVENTS === "off") return;
  const now = new Date();
  const event: LoggedEvent = { at: now.toISOString(), kind, ...fields };

  // Logging never breaks what it logs.
  try {
    if (kind === "error") console.error(consoleLine(event));
    else if (!process.env.VITEST) console.log(consoleLine(event));
    if (!writesFiles) return;
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
    const day = dayOf(now);
    prune(day);
    appendFileSync(fileFor(day), `${JSON.stringify(event)}\n`);
  } catch (error) {
    console.error("[event] could not write the event log:", error);
  }
}

// An error, with where it happened and its stack.
export function logError(where: string, error: unknown, fields: Omit<LoggedEvent, "at" | "kind"> = {}): void {
  logEvent("error", {
    where,
    message: error instanceof Error ? error.message : String(error),
    ...(error instanceof Error && error.stack ? { stack: error.stack.split("\n").slice(0, 6).join("\n") } : {}),
    ...fields,
  });
}

export interface EventFilter {
  room?: number;
  user?: string;
  kind?: EventKind;
  limit?: number;
}

// The latest events, newest first, from today back through the kept days,
// those matching the filter only.
export function readEvents(filter: EventFilter = {}): LoggedEvent[] {
  const limit = Math.min(Math.max(filter.limit ?? 300, 1), 2000);
  const user = filter.user?.trim().toLowerCase();
  if (!existsSync(LOG_DIR)) return [];

  const days = readdirSync(LOG_DIR)
    .map((name) => /^events-(\d{4}-\d{2}-\d{2})\.log$/.exec(name)?.[1])
    .filter((day): day is string => !!day)
    .sort()
    .reverse();

  const found: LoggedEvent[] = [];
  for (const day of days) {
    const lines = readFileSync(fileFor(day), "utf8").split("\n").filter(Boolean).reverse();
    for (const line of lines) {
      let event: LoggedEvent;
      try {
        event = JSON.parse(line) as LoggedEvent;
      } catch {
        continue;
      }
      if (filter.kind && event.kind !== filter.kind) continue;
      if (filter.room !== undefined && event.room !== filter.room) continue;
      if (user && !(event.users ?? []).some((name) => name.toLowerCase() === user)) continue;
      found.push(event);
      if (found.length >= limit) return found;
    }
  }
  return found;
}
