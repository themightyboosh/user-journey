import { z } from 'zod';

// --- Domain Models ---

export const ContextObjectSchema = z.string().describe("Unstructured paragraph summarizing nuances");

export const CompletionStatusObjectSchema = z.object({
  name: z.boolean(),
  role: z.boolean(),
  description: z.boolean(),
  phases: z.boolean(),
  swimlanes: z.boolean(),
  cells: z.boolean(),
});

export const PhaseObjectSchema = z.object({
  phaseId: z.string().uuid(),
  sequence: z.number().int(),
  name: z.string(),
  description: z.string(),
  context: z.string(),
  summary: z.string().optional(),
});

export const SwimlaneObjectSchema = z.object({
  swimlaneId: z.string().uuid(),
  sequence: z.number().int(),
  name: z.string(),
  description: z.string(),
  context: z.string(),
  summary: z.string().optional(),
});

export const CellObjectSchema = z.object({
  cellId: z.string().uuid(),
  phaseId: z.string().uuid(),
  swimlaneId: z.string().uuid(),
  headline: z.string(),
  description: z.string(),
  context: z.string(),
});

export const DerivedMetricsObjectSchema = z.object({
  totalPhases: z.number().int(),
  totalSwimlanes: z.number().int(),
  totalCellsExpected: z.number().int(),
  totalCellsPresent: z.number().int(),
  totalCellsCompleted: z.number().int(),
  percentCellsComplete: z.number(),
});

export const PhaseSummaryObjectSchema = z.object({
    phaseId: z.string().uuid(),
    summary: z.string()
});

export const SwimlaneSummaryObjectSchema = z.object({
    swimlaneId: z.string().uuid(),
    summary: z.string()
});

export const OutputJsonObjectSchema = z.object({
    code: z.string()
});

export const MermaidObjectSchema = z.object({
    code: z.string()
});

export const EthnographicProgressSchema = z.object({
    gapAnalysisAsked: z.boolean().default(false),
    magicWandAsked: z.boolean().default(false),
    synthesisAsked: z.boolean().default(false),
    finalCheckAsked: z.boolean().default(false)
});

export const JourneyMapSchema = z.object({
  journeyMapId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'FINAL', 'ARCHIVED']),
  stage: z.enum(['IDENTITY', 'JOURNEY_DEFINITION', 'PHASES', 'SWIMLANES', 'MATRIX_GENERATION', 'CELL_POPULATION', 'COMPLETE']),
  userName: z.string().optional(),
  name: z.string(),
  role: z.string(),
  description: z.string(),
  arePhasesComplete: z.boolean(),
  areSwimlanesComplete: z.boolean(),
  completionStatus: CompletionStatusObjectSchema,
  phases: z.array(PhaseObjectSchema),
  swimlanes: z.array(SwimlaneObjectSchema),
  cells: z.array(CellObjectSchema),
  metrics: DerivedMetricsObjectSchema,
  overallSummary: z.string().optional(),
  phaseSummaries: z.array(PhaseSummaryObjectSchema).optional(),
  swimlaneSummaries: z.array(SwimlaneSummaryObjectSchema).optional(),
  mermaid: MermaidObjectSchema.optional(),
  outputJson: OutputJsonObjectSchema.optional(),
  summaryOfFindings: z.string().optional(),
  mentalModels: z.string().optional(),
  quotes: z.array(z.string()).optional(),
  anythingElse: z.string().optional(),
  ethnographicProgress: EthnographicProgressSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  version: z.number().int(),
});

export type JourneyMap = z.infer<typeof JourneyMapSchema>;
export type PhaseObject = z.infer<typeof PhaseObjectSchema>;
export type SwimlaneObject = z.infer<typeof SwimlaneObjectSchema>;
export type CellObject = z.infer<typeof CellObjectSchema>;
export type CompletionStatusObject = z.infer<typeof CompletionStatusObjectSchema>;
export type DerivedMetricsObject = z.infer<typeof DerivedMetricsObjectSchema>;
export type EthnographicProgress = z.infer<typeof EthnographicProgressSchema>;

// --- Auth & User Types ---

export interface AppUser {
    uid: string;
    email: string;
    displayName: string;
    role: 'super_admin' | 'admin';
    active: boolean;
    createdAt: string;
    lastLoginAt: string;
}

export interface Feedback {
    id: string;
    text: string;
    messages?: any[];
    journeyId?: string;
    templateId?: string;
    email?: string;
    userAgent?: string;
    createdAt: string;
}

export const SUPER_ADMIN_EMAIL = 'daniel@monumental-i.com';
