export const QUIZ_DURATION_SECONDS = 40 * 60;
export const QUIZ_DURATION_MS = QUIZ_DURATION_SECONDS * 1000;
export const DEFAULT_HEARTBEAT_TIMEOUT_MS = 60_000;
export function attemptDeadline(startedAt: number | null): number | null {
  return startedAt === null ? null : startedAt + QUIZ_DURATION_MS;
}
