-- ============================================================
-- AGENT_OS: Autonomous Software-Engineering Workstation Schema
-- PostgreSQL Schema with RLS, UUID keys, and Indexes
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. User Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  preferred_theme TEXT DEFAULT 'dark',
  free_models_only BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Projects (Workspaces)
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT UNIQUE NOT NULL,
  workspace_path TEXT NOT NULL,
  framework TEXT DEFAULT 'react-vite',
  runtime_status TEXT DEFAULT 'stopped' CHECK (runtime_status IN ('stopped', 'starting', 'running', 'crashed', 'error')),
  sandbox_container_id TEXT,
  sandbox_status TEXT DEFAULT 'unavailable',
  github_repo TEXT,
  github_branch TEXT DEFAULT 'main',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Orchestration Runs (Workflow State Machine)
CREATE TABLE IF NOT EXISTS runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('BUILD', 'ASK')),
  prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  current_stage TEXT NOT NULL DEFAULT 'DISCOVERY',
  selected_model TEXT,
  repair_attempt_count INT DEFAULT 0,
  max_repair_attempts INT DEFAULT 5,
  verification_status TEXT CHECK (verification_status IN ('PASS', 'FAIL', 'PARTIAL', 'SKIPPED')),
  security_status TEXT CHECK (security_status IN ('PASS', 'FAIL', 'PARTIAL', 'SKIPPED')),
  summary TEXT,
  error_details TEXT,
  started_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Workflow Run Stages
CREATE TABLE IF NOT EXISTS run_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  stage_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED')),
  model_id TEXT,
  input_summary TEXT,
  output_summary TEXT,
  tool_calls_count INT DEFAULT 0,
  execution_result JSONB,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  duration_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at TIMESTAMPTZ
);

-- 5. Agent Activity Events (Streaming & Audit Log)
CREATE TABLE IF NOT EXISTS agent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent_role TEXT NOT NULL,
  stage_name TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('thought', 'tool_call', 'tool_result', 'counsel', 'message', 'error', 'system', 'verification')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. OpenRouter Model Telemetry & Metrics
CREATE TABLE IF NOT EXISTS model_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  latency_ms INT NOT NULL,
  prompt_tokens INT,
  completion_tokens INT,
  success BOOLEAN NOT NULL DEFAULT true,
  error_type TEXT,
  status_code INT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. Project Brain (Persistent Context & Architecture)
CREATE TABLE IF NOT EXISTS project_brain (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('requirement', 'architecture', 'decision', 'constraint', 'api_contract', 'task', 'bug', 'repair', 'skill', 'checkpoint')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. Skills & Reference Knowledge Base
CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  category TEXT NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  security_reviewed BOOLEAN DEFAULT true,
  quality_reviewed BOOLEAN DEFAULT true,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. Verification & Security Reports
CREATE TABLE IF NOT EXISTS verification_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('VERIFICATION', 'SECURITY')),
  status TEXT NOT NULL CHECK (status IN ('PASS', 'FAIL', 'PARTIAL')),
  summary TEXT NOT NULL,
  checks_performed JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  failures JSONB NOT NULL DEFAULT '[]'::jsonb,
  risks JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_runs_project ON runs(project_id);
CREATE INDEX IF NOT EXISTS idx_run_stages_run ON run_stages(run_id);
CREATE INDEX IF NOT EXISTS idx_agent_events_run ON agent_events(run_id);
CREATE INDEX IF NOT EXISTS idx_project_brain_project ON project_brain(project_id);
CREATE INDEX IF NOT EXISTS idx_model_metrics_model ON model_metrics(model_id);
