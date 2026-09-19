import { z } from "zod";
import { conversationDirection, roleRef } from "./roles.js";
export type { ConversationDirection, RoleLevel, RoleRef } from "./roles.js";

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

export const RoleLevelSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

/** Clients send { level }; the server fills in the canonical label. */
export const RoleRefInputSchema = z
  .object({ level: RoleLevelSchema, label: z.string().optional() })
  .transform(({ level }) => roleRef(level));

export const ConversationDirectionSchema = z.enum(["downward", "upward", "lateral"]);

export const SessionSetupSchema = z
  .object({
    /** The user's own level. */
    userRole: RoleRefInputSchema,
    /** The level of the person being simulated. */
    simulatedRole: RoleRefInputSchema,
    /** Name of the person being simulated. */
    simulatedName: z.string().trim().min(1, "Their name is required").max(80),
    scenario: ScenarioIdSchema,
    situationContext: z.string().trim().max(4000).optional().default(""),
    responseStyle: ResponseStyleSchema,
    difficulty: DifficultySchema,
    /** The user's own TriMetrix DNA assessment. Personalizes the debrief. */
    userAssessment: AssessmentSchema.nullable().optional().default(null),
    /** The simulated person's TriMetrix DNA assessment. Drives the persona. */
    simulatedAssessment: AssessmentSchema.nullable().optional().default(null),
  })
  .transform((s) => ({
    ...s,
    /** Derived, never chosen by the client. */
    conversationDirection: conversationDirection(s.userRole.level, s.simulatedRole.level),
  }));

export type SessionSetup = z.infer<typeof SessionSetupSchema>;

// ---------- Transcript ----------

/** "user" is the person practicing; "simulated" is the AI-played person. */
export const MessageRoleSchema = z.enum(["user", "simulated"]);
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
