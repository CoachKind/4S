// Mirrors server/src/types.ts. Kept in sync by hand for Phase 1.

export interface DiscScores {
  D: number;
  I: number;
  S: number;
  C: number;
}

export interface DrivingForce {
  name: string;
  score: number;
  descriptor: string;
}

export interface Assessment {
  name: string;
  disc: {
    natural: DiscScores;
    adapted: DiscScores;
    wheel_position: string;
  };
  driving_forces: {
    primary: DrivingForce[];
    situational: DrivingForce[];
    indifferent: DrivingForce[];
  };
  competencies: {
    top_5: string[];
    bottom_5: string[];
  };
  behavioral_flags: {
    under_pressure: string[];
    communication_do: string[];
    communication_dont: string[];
    areas_for_improvement: string[];
  };
}

export type ResponseStyle = "defensive" | "deflecting" | "emotional" | "agreeable";
export type Difficulty = "moderate" | "challenging" | "realistic";
export type ScenarioId = "hard_feedback";

export interface SessionSetup {
  managerName: string;
  scenario: ScenarioId;
  situationContext: string;
  responseStyle: ResponseStyle;
  difficulty: Difficulty;
  leaderAssessment: Assessment | null;
  managerAssessment: Assessment | null;
}

export type MessageRole = "leader" | "manager";

export interface TranscriptMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export interface Debrief {
  what_landed: string;
  what_to_sharpen: string;
  coaching_moment: string;
  game_check: {
    genuine: string;
    actionable: string;
    meaningful: string;
    engaging: string;
  };
}

export type SessionStatus = "active" | "debriefed";

export interface Session {
  id: string;
  status: SessionStatus;
  setup: SessionSetup;
  transcript: TranscriptMessage[];
  debrief: Debrief | null;
  createdAt: string;
  updatedAt: string;
}

export interface SetupOptions {
  scenarios: Array<{ id: ScenarioId; title: string }>;
  responseStyles: Array<{ id: ResponseStyle; label: string; description: string }>;
  difficulties: Array<{ id: Difficulty; label: string; description: string }>;
}

export type AssessmentSlot = "leader" | "manager";
