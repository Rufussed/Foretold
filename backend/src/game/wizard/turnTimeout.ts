export const TURN_TIMEOUT_OPTIONS = [30_000, 45_000, 60_000, null] as const;

export type TurnTimeoutMs = (typeof TURN_TIMEOUT_OPTIONS)[number];

export function isTurnTimeoutMs(value: unknown): value is TurnTimeoutMs {
  return TURN_TIMEOUT_OPTIONS.some((option) => option === value);
}