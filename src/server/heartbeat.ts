import { authenticate, assert, current, ownTeam, quizCommand, sweep, throttle } from "./engine-v2";
import type { StudentView } from "../contracts/types";
import type { Actor, State } from "./model";

export function heartbeatReply(state: State, actor: Actor, data: unknown, now: number): { value?: StudentView; error?: unknown } {
  try {
    const user = authenticate(state, actor);
    assert(user.role === "LEADER", "Student access required.", 403);
    // Persist any expiry/timeout even when the subsequent command is rejected.
    sweep(state, now, ownTeam(state, user).id);
    const attempt = current(state, ownTeam(state, user)), key = `heartbeat:${user.id}`;
    if (attempt.heartbeatRate) state.limits[key] = attempt.heartbeatRate;
    try { throttle(state, key, 60, 60000, now); }
    finally { if (state.limits[key]) attempt.heartbeatRate = state.limits[key]; }
    return { value: quizCommand(state, user, actor, "heartbeat", data, now) as StudentView };
  } catch (error) { return { error }; }
}

// GET/SSE responses must reflect deadlines immediately, even between watchdog
// ticks. These projections are discarded; only the watchdog/write paths persist
// expiry and its audit event. Do not show synthetic audit entries as saved logs.
export function projectReadState(state: State, now: number) {
  const audit = state.audit;
  state.audit = [];
  sweep(state, now);
  state.audit = audit;
}
