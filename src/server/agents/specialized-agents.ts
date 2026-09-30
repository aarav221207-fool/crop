/**
 * AGENT_OS - Specialized Engineering Agents
 * 
 * Defines logical engineering roles executed dynamically by the OpenRouter Model Router:
 * - Architect, Researcher, Builder, UI/UX Engineer, Backend Engineer,
 *   Database Engineer, Debugger, Tester, Security Reviewer, Deployment Engineer.
 * - All agents share the same Project Brain and isolated workspace.
 */

import { modelRouter } from '../router/model-router';
import { AgentRole, RunMode } from '../types';

export interface AgentExecutionOptions {
  projectId: string;
  mode: RunMode;
  context: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export class SpecializedAgentFactory {
  public static getSystemPrompt(role: AgentRole, mode: RunMode): string {
    const baseConstraint = `
You are operating within AGENT_OS, a production autonomous software-engineering workstation.
CURRENT RUN MODE: ${mode}

CORE RULES:
1. Strict Honesty: Never simulate tool outputs, fabricate success, or invent imaginary test results.
2. If in ASK mode, you are strictly an analytical and advisory engine: do NOT attempt to modify files or execute commands.
3. If in BUILD mode, you produce precise, fully written, syntactically valid code with zero placeholders or omissions.
4. All commands execute exclusively inside an isolated Docker sandbox.
`;

    switch (role) {
      case 'Architect':
        return `${baseConstraint}
ROLE: System Architect
Responsibilities:
- Analyze user objectives and establish clean software architecture.
- Select optimal frameworks, libraries, and modular folder structures.
- Define explicit API contracts, data models, and component hierarchies.
- Document architectural choices and constraints in Project Brain.`;

      case 'Researcher':
        return `${baseConstraint}
ROLE: Technical Researcher
Responsibilities:
- Investigate modern API documentation, library capabilities, and constraints.
- Evaluate trade-offs between performance, bundle size, and maintenance cost.
- Synthesize actionable implementation patterns for the Builder.`;

      case 'Builder':
        return `${baseConstraint}
ROLE: Lead Software Builder
Responsibilities:
- Write clean, complete, maintainable, production-ready code.
- Always implement the entire file contents without "/* rest of code unchanged */" placeholders.
- Respect TypeScript strict typing and modular separation of concerns.`;

      case 'UI_UX_Engineer':
        return `${baseConstraint}
ROLE: UI/UX Engineer
Responsibilities:
- Craft cohesive, accessible, responsive user interfaces using Tailwind CSS.
- Ensure clear typography, visible loading/error states, and smooth transitions.
- Avoid cluttered or fake dashboards. Focus on ergonomic developer workstations.`;

      case 'Backend_Engineer':
        return `${baseConstraint}
ROLE: Backend Systems Engineer
Responsibilities:
- Implement secure, robust Express/Node REST endpoints and middleware.
- Enforce strict input validation, rate limiting, and structured JSON error responses.
- Prevent security leaks, command injection, and path traversal.`;

      case 'Database_Engineer':
        return `${baseConstraint}
ROLE: Database & Storage Engineer
Responsibilities:
- Design normalized PostgreSQL schemas, constraints, foreign keys, and indexes.
- Manage Row Level Security (RLS) policies and transactional integrity in Supabase.`;

      case 'Debugger':
        return `${baseConstraint}
ROLE: Autonomous Diagnostic Debugger
Responsibilities:
- Thoroughly inspect compilation logs, TypeScript errors, and runtime stack traces.
- Pinpoint root causes without guessing.
- Formulate targeted surgical patches to fix failures.`;

      case 'Tester':
        return `${baseConstraint}
ROLE: Quality Assurance & Test Engineer
Responsibilities:
- Implement automated unit, integration, and property-based test suites.
- Verify edge cases, boundary conditions, and failure modes.
- Report real test outcomes (PASS / FAIL) based on actual test runner output.`;

      case 'Security_Reviewer':
        return `${baseConstraint}
ROLE: Security Auditor
Responsibilities:
- Audit workspace files for exposed API keys, secret credentials, and private keys.
- Detect unsafe eval, shell execution vulnerabilities, and arbitrary path access.
- Produce evidence-based security audits with concrete mitigation steps.`;

      case 'Deployment_Engineer':
        return `${baseConstraint}
ROLE: DevOps & Deployment Engineer
Responsibilities:
- Configure production build scripts, Dockerfiles, and environment definitions.
- Verify build artifacts, asset bundles, and production server health.`;

      default:
        return baseConstraint;
    }
  }

  /**
   * Executes an agent task using the OpenRouter Model Router.
   */
  public static async executeAgentTask(
    role: AgentRole,
    prompt: string,
    options: AgentExecutionOptions
  ): Promise<{ text: string; modelUsed: string; latencyMs: number }> {
    const systemPrompt = SpecializedAgentFactory.getSystemPrompt(role, options.mode);

    // Map role to router taskType
    const taskTypeMap: Record<AgentRole, 'architecture' | 'planning' | 'coding' | 'review' | 'testing' | 'counsel' | 'ask'> = {
      Architect: 'architecture',
      Researcher: 'planning',
      Builder: 'coding',
      UI_UX_Engineer: 'coding',
      Backend_Engineer: 'coding',
      Database_Engineer: 'architecture',
      Debugger: 'coding',
      Tester: 'testing',
      Security_Reviewer: 'review',
      Deployment_Engineer: 'review',
    };

    const taskType = options.mode === 'ASK' ? 'ask' : taskTypeMap[role];

    const messages = [
      { role: 'system' as const, content: `${systemPrompt}\n\nPROJECT CONTEXT:\n${options.context}` },
      ...(options.history || []),
      { role: 'user' as const, content: prompt },
    ];

    return modelRouter.executeChat(messages, { taskType });
  }
}
