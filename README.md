# ⚡ AGENT_OS: Autonomous Software-Engineering Workstation

> Production-grade autonomous software-engineering workstation with multi-model OpenRouter orchestration, isolated Docker sandbox execution, persistent Supabase Project Brain, and automated verification/repair loops.

---

## 🏛️ Architecture & Workflow

```
USER
  │
  ▼
BUILD / ASK
  │
  ▼
MASTER ORCHESTRATOR
  │
  ▼
PROJECT BRAIN + RESEARCH + OPENROUTER MODEL ROUTER
  │
  ▼
SPECIALIZED AGENTS (Architect, Researcher, Builder, UI/UX, Backend, DB, Debugger, Tester, Security, Deploy)
  │
  ▼
REAL TOOL EXECUTION (Filesystem, Git, Terminal, Process Control)
  │
  ▼
ISOLATED DOCKER SANDBOX (Non-negotiable containerized execution)
  │
  ▼
TEST / FAILURE DETECTION
  │
  ▼
AUTONOMOUS REPAIR LOOP
  │
  ▼
INDEPENDENT VERIFICATION (PASS / FAIL / PARTIAL with evidence)
  │
  ▼
SECURITY VERIFICATION (Secrets, injection, sandbox escapes, traversal)
  │
  ▼
GITHUB / DEPLOYMENT
```

---

## 🔒 1. Execution Security & Docker Sandbox

- **Docker Required**: Autonomous agent shell commands execute strictly inside isolated project containers.
- **Zero Host Execution**: Autonomous agents are never permitted to execute shell commands directly on the host machine.
- **Honest Status**: If Docker daemon is unavailable, AGENT_OS explicitly reports:
  > `"Sandbox unavailable — Docker is required for autonomous execution."`
  and blocks autonomous execution rather than silently falling back to the host.
- **Resource Constraints**: Explicit memory (`512m`), CPU (`1.0`), and execution timeout (`60s`) enforcement.
- **Security Boundaries**: Host filesystem, credentials, SSH keys, and system processes are completely isolated from agent operations.

---

## 🌐 2. OpenRouter Model Gateway

- **Single Gateway**: All model calls route through [OpenRouter](https://openrouter.ai/). Zero proprietary Gemini SDK dependencies.
- **Free-Tier Aware**: Supports dynamic discovery of free-tier OpenRouter models with an optional `Free-Only Mode`.
- **Dynamic Task Routing**:
  $$\text{Task} \to \text{Required Capabilities} \to \text{Available Models} \to \text{Health / Quota} \to \text{Historical Latency / Success} \to \text{Select} \to \text{Execute} \to \text{Telemetry}$$
- **Failover / Fallback**: Automatic failover to next-best eligible model on HTTP 429 / rate limit / model downtime.
- **Telemetry Persistence**: Model latency, token usage, and success rates recorded to Supabase.

---

## 🧠 3. Project Brain & Skills

- **Supabase Persistence**: Persistent store for architecture decisions, requirements, technical constraints, API schemas, bugs, and checkpoints.
- **Selective Retrieval**: Specialized agents receive relevant contextual fragments rather than unstructured context dumps.
- **External Skills Repository**: Curated software patterns, library recipes, and best practices vetted for security.

---

## 🛠️ 4. Build vs Ask Distinction

- **BUILD Mode**:
  - Authorized to write and patch project files.
  - Executes builds, installations, and tests inside the Docker sandbox.
  - Automatically runs Failure Detection, Repair Loop, and Verification.
- **ASK Mode**:
  - Read-only inspection of project files, Project Brain, and architecture docs.
  - Answers technical inquiries, explains logic, and plans improvements.
  - Backend strictly forbids file writes and command execution in ASK mode.

---

## 🚀 Getting Started

### 1. Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Set your configuration:
```env
OPENROUTER_API_KEY=your_openrouter_key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 2. Start AGENT_OS

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` to access the engineering workstation.
