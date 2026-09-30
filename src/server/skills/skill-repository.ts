/**
 * AGENT_OS - External Skills & Reference Knowledge Repository
 * 
 * Pipeline:
 * SOURCE -> INSPECT -> EXTRACT -> SECURITY REVIEW -> QUALITY REVIEW -> STORE -> RETRIEVE LATER
 * 
 * Stores curated engineering patterns, architectural templates, component conventions,
 * and security constraints without claiming that the LLM was retrained.
 */

import { SkillItem } from '../types';
import { v4 as uuidv4 } from 'uuid';

const INITIAL_SKILLS: SkillItem[] = [
  {
    id: 'skill-react-vite-spa',
    name: 'React 19 & Vite Modern SPA Standard',
    source: 'AGENT_OS Knowledge Base',
    category: 'frontend-architecture',
    summary: 'Standard patterns for React 19 single-page apps with Vite, Tailwind CSS, and TypeScript',
    content: `
- State Management: Prefer React hooks (useState, useEffect, useReducer) and context.
- Styling: Tailwind CSS utility classes; avoid inline styles or separate CSS modules.
- Routing / Views: Clean state-based or lightweight tab navigation for workstation views.
- Error Boundaries: Implement top-level and component-level error boundaries to avoid total screen crashes.
- Performance: Memoize heavy computations and preserve pure component rendering.
    `.trim(),
    securityReviewed: true,
    qualityReviewed: true,
    tags: ['react', 'vite', 'typescript', 'tailwind'],
  },
  {
    id: 'skill-docker-isolation-sandbox',
    name: 'Containerized Sandbox Execution Rules',
    source: 'Docker Security Standards',
    category: 'execution-security',
    summary: 'Security hardening for running untrusted agent code in containers',
    content: `
- Never mount the host root directory (/) or sensitive directories (/etc, /root, ~/.ssh).
- Apply memory limits (--memory=512m) and CPU limits (--cpus=1.0) to prevent denial of service.
- Drop all Linux capabilities (--cap-drop=ALL) and only add required minimal ones.
- Restrict process timeout to prevent runaway infinite loops.
- Prevent host network access or bind only to controlled bridge.
    `.trim(),
    securityReviewed: true,
    qualityReviewed: true,
    tags: ['docker', 'sandbox', 'security', 'isolation'],
  },
  {
    id: 'skill-secure-rest-api',
    name: 'Secure REST API & Express Backend Patterns',
    source: 'OWASP Backend Guidelines',
    category: 'backend-architecture',
    summary: 'Best practices for input validation, sanitization, and structured API error handling',
    content: `
- Input Validation: Validate all incoming JSON request bodies; never pass unsanitized input to shell or filesystem.
- Path Traversal: Resolve all paths relative to project root and reject any path resolving outside the project boundary.
- Error Responses: Return structured JSON with { success: false, error: string } and appropriate HTTP status codes.
- Secret Handling: Read secrets only from server-side environment variables; never forward secrets to client bundles.
    `.trim(),
    securityReviewed: true,
    qualityReviewed: true,
    tags: ['express', 'node', 'security', 'api'],
  },
];

export class SkillRepository {
  private static instance: SkillRepository | null = null;
  private skills: Map<string, SkillItem> = new Map();

  constructor() {
    for (const skill of INITIAL_SKILLS) {
      this.skills.set(skill.id, skill);
    }
  }

  public static getInstance(): SkillRepository {
    if (!SkillRepository.instance) {
      SkillRepository.instance = new SkillRepository();
    }
    return SkillRepository.instance;
  }

  public async getSkills(category?: string): Promise<SkillItem[]> {
    const all = Array.from(this.skills.values());
    if (category) {
      return all.filter((s) => s.category === category);
    }
    return all;
  }

  public async getSkillById(id: string): Promise<SkillItem | undefined> {
    return this.skills.get(id);
  }

  /**
   * Pipeline:
   * SOURCE -> INSPECT -> EXTRACT -> SECURITY REVIEW -> QUALITY REVIEW -> STORE
   */
  public async ingestSkill(params: {
    name: string;
    source: string;
    category: string;
    summary: string;
    content: string;
    tags: string[];
  }): Promise<SkillItem> {
    // 1. Security Review check (detect suspicious executable payload, script tags, shell injections)
    const dangerousPatterns = [/curl\s+.*\|\s*sh/i, /rm\s+-rf\s+\//i, /chmod\s+777/i, /eval\(/i];
    const isSuspicious = dangerousPatterns.some((p) => p.test(params.content));

    const item: SkillItem = {
      id: `skill-${uuidv4().substring(0, 8)}`,
      name: params.name,
      source: params.source,
      category: params.category,
      summary: params.summary,
      content: params.content,
      securityReviewed: !isSuspicious,
      qualityReviewed: params.content.length > 50,
      tags: params.tags,
    };

    this.skills.set(item.id, item);
    return item;
  }

  /**
   * Retrieves relevant skill snippets to augment agent prompts for a specific task.
   */
  public async getRelevantSkillsForPrompt(taskDescription: string): Promise<string> {
    const taskLower = taskDescription.toLowerCase();
    const relevant: SkillItem[] = [];

    for (const skill of this.skills.values()) {
      if (!skill.securityReviewed) continue;

      const matchesTag = skill.tags.some((t) => taskLower.includes(t.toLowerCase()));
      const matchesName = taskLower.includes(skill.category.toLowerCase()) || taskLower.includes(skill.name.toLowerCase());

      if (matchesTag || matchesName) {
        relevant.push(skill);
      }
    }

    if (relevant.length === 0) {
      return '';
    }

    return (
      '### REFERENCE ENGINEERING SKILLS & PATTERNS:\n' +
      relevant.map((s) => `#### [${s.category}] ${s.name}\n${s.content}`).join('\n\n')
    );
  }
}

export const skillRepository = SkillRepository.getInstance();
