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

export type RoleLevel = 1 | 2 | 3;
export type ConversationDirection = "downward" | "upward" | "lateral";

export interface RoleRef {
  level: RoleLevel;
  label: string;
}

export interface SessionSetup {
  /** The user's own level. */
  userRole: RoleRef;
  /** The level of the person being simulated. */
  simulatedRole: RoleRef;
  /** Derived on the server from the two levels. */
  conversationDirection: ConversationDirection;
  /** Name of the person being simulated. */
  simulatedName: string;
  scenario: ScenarioId;
  situationContext: string;
  responseStyle: ResponseStyle;
  difficulty: Difficulty;
  /** The user's own assessment. Personalizes the debrief. */
  userAssessment: Assessment | null;
  /** The simulated person's assessment. Drives the persona. */
  simulatedAssessment: Assessment | null;
}

/** What the client sends to create a session; the server derives direction and labels. */
export type SessionSetupInput = Omit<SessionSetup, "conversationDirection" | "userRole" | "simulatedRole"> & {
  userRole: { level: RoleLevel };
  simulatedRole: { level: RoleLevel };
};

/** "user" is the person practicing; "simulated" is the AI-played person. */
export type MessageRole = "user" | "simulated";

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
  roleLevels: Array<{ level: RoleLevel; label: string; short: string; description: string }>;
  directions: Record<ConversationDirection, string>;
  /** Base scenario titles; the dynamic-specific title comes from scenarioTitle(). */
  scenarios: Array<{ id: ScenarioId; title: string }>;
  responseStyles: Array<{ id: ResponseStyle; label: string; description: string }>;
  difficulties: Array<{ id: Difficulty; label: string; description: string }>;
}

/** "user" = the user's own report; "simulated" = the other person's report. */
export type AssessmentSlot = "user" | "simulated";
