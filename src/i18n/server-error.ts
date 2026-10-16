import type { ErrorCode } from "../../backend/src/errorCodes";
import { t, type MessageKey } from "./index";

// What the server sends when it refuses something: its English message, and
// for anything a player can meet, a code (backend/src/errorCodes.ts).
export interface ServerError {
  error?: string;
  code?: string;
  values?: Record<string, string>;
}

// Every code has its text in en.ts and de.ts; the type checker says which
// one is missing.
const keyFor = (code: ErrorCode): MessageKey => `error.${code}`;

// The server's message in the player's language. A message without a code
// (or from an older server) is shown in English as it came, and no message
// at all gets the caller's own fallback.
export function serverError(data: ServerError | null | undefined, fallback: MessageKey): string {
  if (data?.code) {
    try {
      return t(keyFor(data.code as ErrorCode), data.values);
    } catch {
      // A code this frontend does not know yet: fall through to the message.
    }
  }

  return data?.error ?? t(fallback);
}
