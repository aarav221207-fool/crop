/**
 * AGENT_OS - OpenRouter Model Gateway & Dynamic Router
 * 
 * Requirements:
 * - Single model gateway for all AGENT_OS LLM operations.
 * - Dynamic discovery of models from OpenRouter API.
 * - Native support for free-tier models and Free-Only mode.
 * - Tracking of model failures, 429 rate limits, and latency.
 * - Capability-based dynamic model selection:
 *   TASK -> required capabilities -> available models -> health/quota -> historical performance -> select -> execute -> record.
 * - Automatic fallback to next eligible model on failure.
 * - Never expose a failed model as successfully used.
 */

import axios from 'axios';
import { OpenRouterModel, ModelTelemetry } from '../types';

export interface ModelMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ModelCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  freeOnly?: boolean;
  taskType?: 'architecture' | 'planning' | 'coding' | 'review' | 'testing' | 'counsel' | 'ask';
}

export interface ModelCompletionResult {
  text: string;
  modelUsed: string;
  latencyMs: number;
  tokensUsed?: number;
  fallbackCount: number;
}

// Fallback catalog of high-performing OpenRouter models (curated by capability)
const DEFAULT_MODEL_CATALOG: OpenRouterModel[] = [
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'Llama 3.3 70B Instruct (Free)',
    contextLength: 131072,
    pricing: { prompt: 0, completion: 0 },
    isFree: true,
    supportsTools: true,
  },
  {
    id: 'deepseek/deepseek-chat:free',
    name: 'DeepSeek Chat V3 (Free)',
    contextLength: 65536,
    pricing: { prompt: 0, completion: 0 },
    isFree: true,
    supportsTools: true,
  },
  {
    id: 'mistralai/mistral-small-24b-instruct-2501:free',
    name: 'Mistral Small 24B Instruct (Free)',
    contextLength: 32768,
    pricing: { prompt: 0, completion: 0 },
    isFree: true,
    supportsTools: true,
  },
  {
    id: 'qwen/qwen-2.5-coder-32b-instruct:free',
    name: 'Qwen 2.5 Coder 32B (Free)',
    contextLength: 32768,
    pricing: { prompt: 0, completion: 0 },
    isFree: true,
    supportsTools: true,
  },
  {
    id: 'deepseek/deepseek-r1:free',
    name: 'DeepSeek R1 (Free)',
    contextLength: 65536,
    pricing: { prompt: 0, completion: 0 },
    isFree: true,
    supportsTools: false,
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    contextLength: 200000,
    pricing: { prompt: 0.000003, completion: 0.000015 },
    isFree: false,
    supportsTools: true,
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    contextLength: 128000,
    pricing: { prompt: 0.00000015, completion: 0.0000006 },
    isFree: false,
    supportsTools: true,
  },
];

export class OpenRouterModelRouter {
  private static instance: OpenRouterModelRouter | null = null;
  private apiKey: string = '';
  private baseUrl: string = 'https://openrouter.ai/api/v1';
  private models: OpenRouterModel[] = DEFAULT_MODEL_CATALOG;
  private lastFetchedAt: number = 0;
  private modelHealth: Map<string, { failureCount: number; lastFailureTime: number; totalCalls: number; successCount: number; avgLatencyMs: number }> = new Map();

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  }

  public static getInstance(): OpenRouterModelRouter {
    if (!OpenRouterModelRouter.instance) {
      OpenRouterModelRouter.instance = new OpenRouterModelRouter();
    }
    return OpenRouterModelRouter.instance;
  }

  public setApiKey(key: string): void {
    this.apiKey = key.trim();
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.startsWith('sk-or-'));
  }

  /**
   * Discovers and refreshes models available from OpenRouter.
   */
  public async discoverModels(forceRefresh: boolean = false): Promise<OpenRouterModel[]> {
    const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
    if (!forceRefresh && this.models.length > 0 && Date.now() - this.lastFetchedAt < CACHE_TTL_MS) {
      return this.models;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/models`, {
        headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
        timeout: 6000,
      });

      if (response.data && Array.isArray(response.data.data)) {
        const rawModels: any[] = response.data.data;
        const parsed: OpenRouterModel[] = rawModels.map((m: any) => {
          const promptPrice = parseFloat(m.pricing?.prompt || '0');
          const completionPrice = parseFloat(m.pricing?.completion || '0');
          const isFree = m.id.endsWith(':free') || (promptPrice === 0 && completionPrice === 0);

          return {
            id: m.id,
            name: m.name || m.id,
            description: m.description,
            contextLength: m.context_length || 32768,
            pricing: { prompt: promptPrice, completion: completionPrice },
            isFree,
            supportsTools: Boolean(m.architecture?.modality?.includes('tools') || !m.id.includes('vision')),
          };
        });

        if (parsed.length > 0) {
          this.models = parsed;
          this.lastFetchedAt = Date.now();
        }
      }
    } catch (err: any) {
      // Retain default catalog if network fetch fails
    }

    return this.models;
  }

  /**
   * Dynamic Model Routing Algorithm:
   * TASK -> capabilities -> models -> health -> performance -> ranked candidate list
   */
  public selectCandidateModels(options: ModelCompletionOptions = {}): OpenRouterModel[] {
    const freeOnly = options.freeOnly ?? (process.env.OPENROUTER_FREE_ONLY === 'true');
    const taskType = options.taskType || 'coding';

    let eligible = this.models.filter((m) => {
      if (freeOnly && !m.isFree) return false;
      return true;
    });

    if (eligible.length === 0) {
      eligible = this.models.filter((m) => m.isFree);
    }
    if (eligible.length === 0) {
      eligible = this.models;
    }

    // Rank candidates by suitability and health
    return eligible.sort((a, b) => {
      const healthA = this.modelHealth.get(a.id) || { failureCount: 0, lastFailureTime: 0, totalCalls: 0, successCount: 0, avgLatencyMs: 0 };
      const healthB = this.modelHealth.get(b.id) || { failureCount: 0, lastFailureTime: 0, totalCalls: 0, successCount: 0, avgLatencyMs: 0 };

      // Penalize models with recent failures (cooldown 5 minutes)
      const now = Date.now();
      const inCooldownA = healthA.failureCount > 2 && (now - healthA.lastFailureTime < 300000);
      const inCooldownB = healthB.failureCount > 2 && (now - healthB.lastFailureTime < 300000);

      if (inCooldownA && !inCooldownB) return 1;
      if (!inCooldownA && inCooldownB) return -1;

      // Prefer models tailored for the task
      const scoreTask = (model: OpenRouterModel): number => {
        let score = 0;
        const idLower = model.id.toLowerCase();
        if (taskType === 'coding' || taskType === 'testing') {
          if (idLower.includes('coder') || idLower.includes('claude') || idLower.includes('llama-3.3') || idLower.includes('qwen')) score += 10;
        } else if (taskType === 'architecture' || taskType === 'counsel') {
          if (idLower.includes('r1') || idLower.includes('sonnet') || idLower.includes('70b') || idLower.includes('deepseek')) score += 10;
        } else {
          if (idLower.includes('flash') || idLower.includes('small') || idLower.includes('mini')) score += 8;
        }
        if (freeOnly && model.isFree) score += 5;
        return score;
      };

      return scoreTask(b) - scoreTask(a);
    });
  }

  /**
   * Executes prompt via OpenRouter with automatic failover to alternative eligible models.
   */
  public async executeChat(
    messages: ModelMessage[],
    options: ModelCompletionOptions = {}
  ): Promise<ModelCompletionResult> {
    if (!this.apiKey) {
      throw new Error("OpenRouter API key is not configured. Please set OPENROUTER_API_KEY in your environment or Settings.");
    }

    const candidates = this.selectCandidateModels(options);
    if (candidates.length === 0) {
      throw new Error("No eligible OpenRouter models available for the requested task.");
    }

    let lastError: Error | null = null;
    let fallbackCount = 0;

    // Try candidates in ranked order until success or pool exhausted
    for (const model of candidates.slice(0, 4)) {
      const startTime = Date.now();
      try {
        const response = await axios.post(
          `${this.baseUrl}/chat/completions`,
          {
            model: model.id,
            messages,
            temperature: options.temperature ?? 0.2,
            max_tokens: options.maxTokens ?? 4000,
          },
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://agent-os.dev',
              'X-Title': 'AGENT_OS',
            },
            timeout: 60000,
          }
        );

        const latencyMs = Date.now() - startTime;
        const text = response.data?.choices?.[0]?.message?.content || '';
        const tokensUsed = response.data?.usage?.total_tokens;

        // Record successful telemetry
        this.recordSuccess(model.id, latencyMs);

        return {
          text,
          modelUsed: model.id,
          latencyMs,
          tokensUsed,
          fallbackCount,
        };
      } catch (err: any) {
        fallbackCount++;
        const latencyMs = Date.now() - startTime;
        const status = err.response?.status;
        const errorMsg = err.response?.data?.error?.message || err.message;

        this.recordFailure(model.id, latencyMs, errorMsg);
        lastError = new Error(`Model ${model.id} failed (HTTP ${status || 'ERR'}): ${errorMsg}`);

        // If rate limited or service error, continue to next candidate
        if (status === 429 || status === 502 || status === 503 || status === 504 || !status) {
          continue;
        }
      }
    }

    throw lastError || new Error("All eligible OpenRouter model candidates failed.");
  }

  private recordSuccess(modelId: string, latencyMs: number) {
    const current = this.modelHealth.get(modelId) || { failureCount: 0, lastFailureTime: 0, totalCalls: 0, successCount: 0, avgLatencyMs: 0 };
    current.totalCalls++;
    current.successCount++;
    current.failureCount = Math.max(0, current.failureCount - 1);
    current.avgLatencyMs = Math.round((current.avgLatencyMs * (current.totalCalls - 1) + latencyMs) / current.totalCalls);
    this.modelHealth.set(modelId, current);
  }

  private recordFailure(modelId: string, latencyMs: number, reason: string) {
    const current = this.modelHealth.get(modelId) || { failureCount: 0, lastFailureTime: 0, totalCalls: 0, successCount: 0, avgLatencyMs: 0 };
    current.totalCalls++;
    current.failureCount++;
    current.lastFailureTime = Date.now();
    this.modelHealth.set(modelId, current);
  }

  public getModelHealthMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [id, health] of this.modelHealth.entries()) {
      result[id] = {
        ...health,
        successRate: health.totalCalls > 0 ? (health.successCount / health.totalCalls) * 100 : 100,
      };
    }
    return result;
  }
}

export const modelRouter = OpenRouterModelRouter.getInstance();
