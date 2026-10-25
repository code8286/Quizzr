export type Role = "LEADER" | "ADMIN";
export type AttemptState = "waiting" | "active" | "paused" | "completed" | "closed";
export interface Member { name: string; registration_number: string; is_leader: boolean }
export interface Progress {
  module: number; solved: boolean; attempts: number; submittedKey?: string;
  hints: number[]; deducted: number; marks: number; lastAnswerAt?: number;
}
export interface HintView { index: number; text: string; deduction: number }
export interface SafeAttempt {
  id: string; state: AttemptState; locked: boolean; lockReason?: string;
  set: number | null; activeModule: number; startedAt: number | null;
  completedAt: number | null; deadlineAt: number | null; completionReason?: "solved" | "time_limit"; revision: number; total: number;
  progress: Omit<Progress, "submittedKey" | "lastAnswerAt">[];
}
export interface StudentView {
  user: { name: string; registration: string; role: Role };
  expectedMemberCount: number;
  team: { id: string; number: number; members: Member[] } | null;
  attempt: Omit<SafeAttempt,"total"|"progress"> & {completedQuestions:number} | null; released: boolean; closed: boolean; serverNow: number;
  practice: boolean; monitoring: boolean; heartbeatTimeout: number;
}
export interface QuestionView { question_id: string; question_text: string; module_id: number; hints: HintView[]; hintCount: number; hintCosts: number[] }
export interface ResultView { total: number; questions: { module: number; key: string; marks: number; deducted: number; hints: number }[] }
export interface AdminTeam {
  id: string; number: number; members: Member[]; leader: string;
  attempt: SafeAttempt; lastHeartbeat: number | null; events: { type: string; at: number; details: string }[];
  history: { id: string; set: number | null; state: AttemptState; total: number }[];
}
export interface AdminView {
  rosterTeams: number; rosterMembers: number;
  teams: AdminTeam[]; released: boolean; closed: boolean; practice: boolean;
  monitoring: boolean; papersReady: boolean; serverNow: number;
  users: { registration: string; name: string; enrolled: boolean; inTeam: boolean }[];
  audit: { type: string; at: number; details: string; actor: string }[];
}
