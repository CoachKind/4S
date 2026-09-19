import { z } from "zod";

// ---------- Assessment (TriMetrix DNA extraction) ----------

export const DiscScoresSchema = z.object({
  D: z.number(),
  I: z.number(),
  S: z.number(),
  C: z.number(),
});

export const DrivingForceSchema = z.object({
  name: z.string(),
  score: z.number(),
  descriptor: z.string(),
});

export const AssessmentSchema = z.object({
  name: z.string(),
  disc: z.object({
    natural: DiscScoresSchema,
    adapted: DiscScoresSchema,
    wheel_position: z.string(),
  }),
  driving_forces: z.object({
    primary: z.array(DrivingForceSchema),
    situational: z.array(DrivingForceSchema),
    indifferent: z.array(DrivingForceSchema),
  }),
  competencies: z.object({
    top_5: z.array(z.string()),
    bottom_5: z.array(z.string()),
  }),
  behavioral_flags: z.object({
    under_pressure: z.array(z.string()),
    communication_do: z.array(z.string()),
    communication_dont: z.array(z.string()),
    areas_for_improvement: z.array(z.string()),
  }),
});

export type Assessment = z.infer<typeof AssessmentSchema>;
export type DiscScores = z.infer<typeof DiscScoresSchema>;
export type DrivingForce = z.infer<typeof DrivingForceSchema>;

// ---------- Session setup ----------

export const ResponseStyleSchema = z.enum(["defensive", "deflecting", "emotional", "agreeable"]);
export type ResponseStyle = z.infer<typeof ResponseStyleSchema>;

export const DifficultySchema = z.enum(["moderate", "challenging", "realistic"]);
export type Difficulty = z.infer<typeof DifficultySchema>;

export const ScenarioIdSchema = z.enum(["hard_feedback"]);
export type ScenarioId = z.infer<typeof ScenarioIdSchema>;

export const SessionSetupSchema = z.object({
  managerName: z.string().trim().min(1, "Manager name is required").max(80),
  scenario: ScenarioIdSchema,
  situationContext: z.string().trim().max(4000).optional().default(""),
  responseStyle: ResponseStyleSchema,
  difficulty: DifficultySchema,
  leaderAssessment: AssessmentSchema.nullable().optional().default(null),
  managerAssessment: AssessmentSchema.nullable().optional().default(null),
});

export type SessionSetup = z.infer<typeof SessionSetupSchema>;

// ---------- Transcript ----------

export const MessageRoleSchema = z.enum(["leader", "manager"]);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export interface TranscriptMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

// ---------- Debrief ----------

export const DebriefSchema = z.object({
  what_landed: z.string(),
  what_to_sharpen: z.string(),
  coaching_moment: z.string(),
  game_check: z.object({
    genuine: z.string(),
    actionable: z.string(),
    meaningful: z.string(),
    engaging: z.string(),
  }),
});

export type Debrief = z.infer<typeof DebriefSchema>;

// ---------- Session ----------

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
