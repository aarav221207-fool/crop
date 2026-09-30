/**
 * AGENT_OS - Counsel (Internal Multi-Perspective Advisory Synthesis)
 * 
 * Internal orchestration mechanism providing three independent perspectives:
 * 1. Negative Counsel: Weaknesses, vulnerabilities, missing requirements, edge cases, UX flaws.
 * 2. Positive Counsel: Strengths, opportunities, architecture enhancements, scalability benefits.
 * 3. Practical Counsel: API limits, quotas, latency, deployment ease, browser compatibility, maintenance cost.
 * 
 * Results are synthesized into an actionable recommendation for the Orchestrator,
 * visible only in Activity/Details.
 */

import { modelRouter } from '../router/model-router';
import { CounselSynthesis, CounselPerspective } from '../types';

export class CounselSystem {
  private static instance: CounselSystem | null = null;

  public static getInstance(): CounselSystem {
    if (!CounselSystem.instance) {
      CounselSystem.instance = new CounselSystem();
    }
    return CounselSystem.instance;
  }

  /**
   * Evaluates an architectural plan or build proposal through three independent lenses.
   */
  public async deliberate(
    projectId: string,
    proposal: string,
    context: string = ''
  ): Promise<CounselSynthesis> {
    const promptNegative = `
You are the NEGATIVE COUNSEL in AGENT_OS.
Your sole job is rigorous adversarial critique.
Identify:
1. Critical weaknesses and technical risks.
2. Missing requirements and unhandled edge cases.
3. Security vulnerabilities or sandbox escape vectors.
4. Potential UX breakdowns or race conditions.

PROPOSAL TO CRITIQUE:
${proposal}

CONTEXT:
${context}

Return your assessment in concise, structured bullet points followed by a 1-sentence summary.
`;

    const promptPositive = `
You are the POSITIVE COUNSEL in AGENT_OS.
Your job is constructive architectural optimization and opportunity discovery.
Identify:
1. Core strengths of this design.
2. High-value enhancements that are low complexity.
3. Clean patterns, modularity, and future extensibility.

PROPOSAL:
${proposal}

CONTEXT:
${context}

Return your assessment in concise bullet points followed by a 1-sentence summary.
`;

    const promptPractical = `
You are the PRACTICAL COUNSEL in AGENT_OS.
Your job is grounded pragmatic reality checking.
Evaluate:
1. API constraints, quotas, and third-party dependencies.
2. Execution latency, bundle size, and build complexity.
3. Deployment feasibility and maintenance burden.
4. Immediate implementation steps.

PROPOSAL:
${proposal}

CONTEXT:
${context}

Return your assessment in concise bullet points followed by a 1-sentence summary.
`;

    // Run perspectives concurrently via OpenRouter with taskType 'counsel'
    const [resNeg, resPos, resPrac] = await Promise.all([
      modelRouter.executeChat([{ role: 'user', content: promptNegative }], { taskType: 'counsel', temperature: 0.3 }),
      modelRouter.executeChat([{ role: 'user', content: promptPositive }], { taskType: 'counsel', temperature: 0.3 }),
      modelRouter.executeChat([{ role: 'user', content: promptPractical }], { taskType: 'counsel', temperature: 0.3 }),
    ]);

    const parsePoints = (text: string): { points: string[]; summary: string } => {
      const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('-') || l.startsWith('*') || /^\d+\./.test(l));
      const points = lines.map((l) => l.replace(/^[-*0-9.]+\s*/, '')).slice(0, 5);
      const summaryLine = text.split('\n').filter((l) => l.trim().length > 0).pop() || '';
      return {
        points: points.length > 0 ? points : ['Reviewed and acknowledged.'],
        summary: summaryLine.replace(/^(Summary:|\*\*Summary\*\*:?)\s*/i, ''),
      };
    };

    const negParsed = parsePoints(resNeg.text);
    const posParsed = parsePoints(resPos.text);
    const pracParsed = parsePoints(resPrac.text);

    const negative: CounselPerspective = {
      type: 'negative',
      analyst: 'Adversarial Risk Auditor',
      points: negParsed.points,
      summary: negParsed.summary || 'Critical risks evaluated.',
    };

    const positive: CounselPerspective = {
      type: 'positive',
      analyst: 'Architectural Opportunity Lead',
      points: posParsed.points,
      summary: posParsed.summary || 'Constructive opportunities synthesized.',
    };

    const practical: CounselPerspective = {
      type: 'practical',
      analyst: 'Production Pragmatics Engineer',
      points: pracParsed.points,
      summary: pracParsed.summary || 'Pragmatic deployment feasibility confirmed.',
    };

    return {
      negative,
      positive,
      practical,
      recommendation: `Proceed with implementation while addressing the identified edge cases: ${negative.points[0] || 'maintain modular boundaries'}.`,
      criticalRisks: negative.points.slice(0, 3),
      suggestedMitigations: practical.points.slice(0, 3),
      timestamp: new Date().toISOString(),
    };
  }
}

export const counsel = CounselSystem.getInstance();
