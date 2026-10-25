import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { heartbeatReply, projectReadState } from "../src/server/heartbeat";
import { newAttempt } from "../src/server/engine";
import { emptyState, type Actor, type State } from "../src/server/model";
import { QUIZ_DURATION_MS } from "../src/contracts/timing";
import { heartbeatPatch } from "../src/server/read-queries";

let state: State, actor: Actor;
const now = 1800000000000, payload = { focused: true, hidden: false, width: 1280, height: 720 };
beforeEach(() => {
  state = emptyState(); state.control.released = true;
  const user = { id: randomUUID(), registration: "FAST001", name: "Leader", role: "LEADER" as const, passwordHash: "", sessionVersion: 1, enrolled: true };
  const team = { id: randomUUID(), number: 1, leaderId: user.id, members: [{ name: "Leader", registration_number: user.registration, is_leader: true }], attemptId: "" };
  const attempt = newAttempt(team.id); attempt.state = "active"; attempt.activeModule = 2; attempt.sequence = [1, 2, 3, 4, 5];
  attempt.startedAt = now - 30000; attempt.lastHeartbeat = now - 20000; attempt.set = 1; attempt.paperVersion = "test";
  attempt.progress[0].solved = true; attempt.progress[0].marks = 1.5; attempt.total = 1.5;
  team.attemptId = attempt.id; state.users = [user]; state.teams = [team]; state.attempts = [attempt];
  state.roster = [{ number: 1, set: 1, members: [{ name: "CSV Name", registration_number: user.registration }] }];
  actor = { id: user.id, version: 1, sid: "one-session" };
});

describe("lightweight heartbeat rules", () => {
  it("preserves answers, ordering, marks and the quiz clock while returning a private student view", () => {
    const before = structuredClone(state.attempts[0]), reply = heartbeatReply(state, actor, payload, now);
    expect(reply.error).toBeUndefined(); expect(state.attempts[0].lastHeartbeat).toBe(now);
    expect(state.attempts[0].heartbeatSession).toBe(actor.sid);
    for (const key of ["progress", "sequence", "startedAt", "activeModule", "total", "set"] as const) expect(state.attempts[0][key]).toEqual(before[key]);
    expect(reply.value?.attempt).not.toHaveProperty("total"); expect(reply.value?.attempt).not.toHaveProperty("progress");
    expect(reply.value?.attempt).not.toHaveProperty("heartbeatRate"); expect(state.audit).toHaveLength(0);
    expect(Object.keys(heartbeatPatch(before,state.attempts[0]).changes).sort()).toEqual(["heartbeatRate","heartbeatSession","lastHeartbeat"]);
  });
  it.each([{ version: 0 }, { id: randomUUID() }])("rejects revoked or unknown sessions without changing an attempt", override => {
    const before = structuredClone(state.attempts);
    expect(heartbeatReply(state, { ...actor, ...override }, payload, now).error).toMatchObject({ status: 401 });
    expect(state.attempts).toEqual(before);
  });
  it("rejects an admin and an account without an active team", () => {
    state.users[0].role = "ADMIN";
    expect(heartbeatReply(state, actor, payload, now).error).toMatchObject({ status: 403 });
    state.users[0].role = "LEADER"; state.teams[0].registrationClearedAt = now - 1;
    expect(heartbeatReply(state, actor, payload, now).error).toMatchObject({ status: 409, code: "NO_TEAM" });
  });
  it("keeps a persisted lock and cannot restart a completed attempt", () => {
    state.attempts[0].locked = true; state.attempts[0].lockReason = "TAB_HIDDEN";
    expect(heartbeatReply(state, actor, payload, now).error).toMatchObject({ status: 423 });
    expect(state.attempts[0].lockReason).toBe("TAB_HIDDEN");
    state.attempts[0].locked = false; state.attempts[0].state = "completed";
    expect(heartbeatReply(state, actor, payload, now).error).toMatchObject({ status: 409 });
  });
  it("records an immediate visibility violation separately from heartbeat expiry", () => {
    const reply = heartbeatReply(state, actor, { ...payload, hidden: true }, now);
    expect(reply.value?.attempt?.locked).toBe(true); expect(state.audit.map(e => e.type)).toEqual(["TAB_HIDDEN"]);
  });
  it("persists deadline expiry even though the heartbeat returns TIME_EXPIRED", () => {
    state.attempts[0].startedAt = now - QUIZ_DURATION_MS;
    expect(heartbeatReply(state, actor, payload, now).error).toMatchObject({ code: "TIME_EXPIRED" });
    expect(state.attempts[0]).toMatchObject({ state: "completed", total: 1.5, completionReason: "time_limit" });
    expect(state.audit.map(e => e.type)).toEqual(["TIME_LIMIT_REACHED"]);
  });
  it("retains an independent per-attempt heartbeat rate limit across database calls", () => {
    for (let i = 0; i < 60; i++) { state.limits = {}; expect(heartbeatReply(state, actor, payload, now + i).error).toBeUndefined(); }
    state.limits = {}; expect(heartbeatReply(state, actor, payload, now + 61).error).toMatchObject({ status: 429 });
  });
  it("projects deadlines on reads without presenting unsaved audit records", () => {
    state.attempts[0].startedAt = now - QUIZ_DURATION_MS;
    projectReadState(state, now);
    expect(state.attempts[0].state).toBe("completed"); expect(state.audit).toEqual([]);
  });
});
