/**
 * AGENT_OS - Core TypeScript Type Definitions
 */

export type RunMode = 'BUILD' | 'ASK';

export type WorkflowStage =
  | 'DISCOVERY'
  | 'RESEARCH'
  | 'ARCHITECTURE'
  | 'PLANNING'
  | 'IMPLEMENTATION'
  | 'TESTING'
  | 'FAILURE_DETECTION'
  | 'REPAIR'
  | 'RETEST'
  | 'VERIFICATION'
  | 'SECURITY'
  | 'DEPLOYMENT'
  | 'DEPLOYMENT_QA'
  | 'RELEASE';

export type StageStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

export type RunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type VerificationStatus = 'PASS' | 'FAIL' | 'PARTIAL' | 'SKIPPED';

export type AgentRole =
  | 'Architect'
  | 'Researcher'
  | 'Builder'
  | 'UI_UX_Engineer'
  | 'Backend_Engineer'
  | 'Database_Engineer'
  | 'Debugger'
  | 'Tester'
  | 'Security_Reviewer'
  | 'Deployment_Engineer';

export interface ExecutionResult {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  status: 'success' | 'failed' | 'timeout' | 'crashed';
  timestamp: string;
}

export interface ContainerInfo {
  id: string;
  projectId: string;
  status: 'created' | 'running' | 'stopped' | 'failed';
  ipAddress?: string;
  ports?: Record<string, string>;
  createdAt: string;
}

export interface AppProcessInfo {
  pid?: number;
  status: 'running' | 'stopped' | 'crashed' | 'starting';
  url?: string;
  port: number;
  startedAt?: string;
  uptimeSeconds?: number;
}

export interface TestRunResult {
  success: boolean;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  output: string;
  durationMs: number;
  failedTestDetails?: Array<{
    name: string;
    message: string;
    stack?: string;
  }>;
}

export interface BuildRunResult {
  success: boolean;
  output: string;
  errors: string[];
  warnings: string[];
  durationMs: number;
}

export interface ModelCapability {
  coding: number;       // 0-1
  reasoning: number;    // 0-1
  toolCalling: boolean;
  contextWindow: number;
  isFree: boolean;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  contextLength: number;
  pricing: {
    prompt: number;
    completion: number;
  };
  isFree: boolean;
  supportsTools: boolean;
}

export interface ModelTelemetry {
  modelId: string;
  taskType: string;
  latencyMs: number;
  success: boolean;
  error?: string;
  timestamp: string;
}

export interface CounselPerspective {
  type: 'negative' | 'positive' | 'practical';
  analyst: string;
  points: string[];
  summary: string;
}

export interface CounselSynthesis {
  negative: CounselPerspective;
  positive: CounselPerspective;
  practical: CounselPerspective;
  recommendation: string;
  criticalRisks: string[];
  suggestedMitigations: string[];
  timestamp: string;
}

export interface BrainItem {
  id: string;
  projectId: string;
  category: 'requirement' | 'architecture' | 'decision' | 'constraint' | 'api_contract' | 'task' | 'bug' | 'repair' | 'skill' | 'checkpoint';
  title: string;
  content: string;
  tags: string[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface SkillItem {
  id: string;
  name: string;
  source: string;
  category: string;
  summary: string;
  content: string;
  securityReviewed: boolean;
  qualityReviewed: boolean;
  tags: string[];
}

export interface VerificationCheck {
  name: string;
  passed: boolean;
  evidence: string;
  details?: string;
}

export interface VerificationReport {
  id: string;
  runId: string;
  projectId: string;
  reportType: 'VERIFICATION' | 'SECURITY';
  status: 'PASS' | 'FAIL' | 'PARTIAL';
  summary: string;
  checksPerformed: VerificationCheck[];
  evidence: string[];
  failures: string[];
  risks: string[];
  timestamp: string;
}

export interface AgentEvent {
  id: string;
  runId: string;
  projectId: string;
  agentRole: AgentRole | 'Orchestrator' | 'Counsel' | 'System';
  stageName: WorkflowStage;
  eventType: 'thought' | 'tool_call' | 'tool_result' | 'counsel' | 'message' | 'error' | 'system' | 'verification';
  title: string;
  content: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface RunStageRecord {
  stageName: WorkflowStage;
  status: StageStatus;
  modelId?: string;
  inputSummary?: string;
  outputSummary?: string;
  toolCallsCount: number;
  executionResult?: any;
  errorMessage?: string;
  retryCount: number;
  durationMs?: number;
  startedAt?: string;
  completedAt?: string;
}

export interface RunRecord {
  id: string;
  projectId: string;
  mode: RunMode;
  prompt: string;
  status: RunStatus;
  currentStage: WorkflowStage;
  selectedModel?: string;
  repairAttemptCount: number;
  maxRepairAttempts: number;
  verificationStatus?: VerificationStatus;
  securityStatus?: VerificationStatus;
  summary?: string;
  errorDetails?: string;
  stages: Record<WorkflowStage, RunStageRecord>;
  events: AgentEvent[];
  startedAt: string;
  completedAt?: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  slug: string;
  description: string;
  framework: string;
  workspacePath: string;
  runtimeStatus: 'stopped' | 'starting' | 'running' | 'crashed' | 'error';
  sandboxStatus: 'available' | 'unavailable' | 'running';
  githubRepo?: string;
  githubBranch?: string;
  createdAt: string;
  updatedAt: string;
}
