import type { AttemptState, Member, Progress, Role } from "../contracts/types";
export interface User { id: string; registration: string; name: string; role: Role; passwordHash: string; sessionVersion: number; enrolled: boolean }
export interface Team {
  id: string; number: number; leaderId: string; members: Member[]; attemptId: string;
  registrationClearedAt?: number;
  registrations?: {leaderId:string;members:Member[];attemptId:string;removedAt:number;reason:string}[];
}
export interface RosterTeam { number: number; members: {name:string;registration_number:string}[]; set?:number }
export interface Attempt {
  id: string; teamId: string; state: AttemptState; locked: boolean; lockReason?: string;
  set: number | null; paperVersion: string | null; activeModule: number;
  sequence?: number[];
  startedAt: number | null; completedAt: number | null; completionReason?: "solved" | "time_limit"; revision: number;
  progress: Progress[]; total: number; lastHeartbeat: number | null; heartbeatSession: string | null;
  heartbeatRate?: { count: number; until: number };
}
export interface Paper { id: string; set: number; module: number; text: string; key: string; hints: { text: string; deduction: number }[]; version: string }
export interface Audit { id: string; actor: string; teamId?: string; type: string; details: string; at: number }
export interface State {
  control: { released: boolean; closed: boolean; practice: boolean; monitoring: boolean; version: number; heartbeatTimeout?: number };
  users: User[]; teams: Team[]; attempts: Attempt[]; papers: Paper[]; audit: Audit[]; roster?: RosterTeam[];
  limits: Record<string, { count: number; until: number }>;
}
export interface Actor { id: string; version: number; sid: string }
export const emptyState = (): State => ({
  control: { released: false, closed: false, practice: false, monitoring: true, version: 1 },
  users: [], teams: [], attempts: [], papers: [], audit: [], limits: {}, roster: [],
});
