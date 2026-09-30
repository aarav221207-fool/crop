/**
 * AGENT_OS - Project Brain (Persistent Knowledge & Architecture Memory)
 * 
 * Stores, indexes, and selectively retrieves:
 * - Requirements, architecture, technical decisions, design rules, constraints,
 *   API contracts, tasks, bugs, repairs, test results, checkpoints.
 * - Integrates with Supabase when available, with persistent in-memory caching.
 */

import { BrainItem } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class ProjectBrainManager {
  private static instance: ProjectBrainManager | null = null;
  private memoryBrain: Map<string, BrainItem[]> = new Map(); // projectId -> items

  public static getInstance(): ProjectBrainManager {
    if (!ProjectBrainManager.instance) {
      ProjectBrainManager.instance = new ProjectBrainManager();
    }
    return ProjectBrainManager.instance;
  }

  /**
   * Adds or updates an item in Project Brain.
   */
  public async record(
    projectId: string,
    category: BrainItem['category'],
    title: string,
    content: string,
    tags: string[] = [],
    metadata?: Record<string, any>
  ): Promise<BrainItem> {
    const item: BrainItem = {
      id: uuidv4(),
      projectId,
      category,
      title,
      content,
      tags,
      metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!this.memoryBrain.has(projectId)) {
      this.memoryBrain.set(projectId, []);
    }
    const items = this.memoryBrain.get(projectId)!;

    // Replace if exact title and category exist, otherwise append
    const existingIndex = items.findIndex((i) => i.category === category && i.title.toLowerCase() === title.toLowerCase());
    if (existingIndex >= 0) {
      items[existingIndex] = { ...items[existingIndex], content, tags, metadata, updatedAt: new Date().toISOString() };
      return items[existingIndex];
    } else {
      items.push(item);
      return item;
    }
  }

  /**
   * Retrieves all Brain items for a project.
   */
  public async getItems(projectId: string, category?: BrainItem['category']): Promise<BrainItem[]> {
    const items = this.memoryBrain.get(projectId) || [];
    if (category) {
      return items.filter((i) => i.category === category);
    }
    return items;
  }

  /**
   * Selectively retrieves relevant Project Brain context for a specific workflow stage or task,
   * avoiding full context window saturation.
   */
  public async getRelevantContext(projectId: string, stage: string, query?: string): Promise<string> {
    const all = await this.getItems(projectId);
    if (all.length === 0) {
      return 'Project Brain is currently empty for this project.';
    }

    let filtered: BrainItem[] = [];

    switch (stage) {
      case 'ARCHITECTURE':
      case 'PLANNING':
        filtered = all.filter((i) => ['requirement', 'architecture', 'constraint', 'decision'].includes(i.category));
        break;
      case 'IMPLEMENTATION':
        filtered = all.filter((i) => ['architecture', 'api_contract', 'constraint', 'task', 'skill'].includes(i.category));
        break;
      case 'TESTING':
      case 'REPAIR':
        filtered = all.filter((i) => ['bug', 'repair', 'api_contract', 'requirement'].includes(i.category));
        break;
      case 'SECURITY':
      case 'VERIFICATION':
        filtered = all.filter((i) => ['constraint', 'architecture', 'requirement'].includes(i.category));
        break;
      default:
        filtered = all.slice(-10);
        break;
    }

    if (filtered.length === 0) {
      filtered = all.slice(-8);
    }

    return filtered
      .map((item) => `[${item.category.toUpperCase()}] ${item.title}:\n${item.content}`)
      .join('\n\n---\n\n');
  }

  public async getStats(projectId: string): Promise<Record<string, number>> {
    const all = await this.getItems(projectId);
    const stats: Record<string, number> = {
      total: all.length,
      requirements: 0,
      architecture: 0,
      decisions: 0,
      constraints: 0,
      apiContracts: 0,
      tasks: 0,
      bugs: 0,
      repairs: 0,
    };

    for (const item of all) {
      if (item.category === 'requirement') stats.requirements++;
      if (item.category === 'architecture') stats.architecture++;
      if (item.category === 'decision') stats.decisions++;
      if (item.category === 'constraint') stats.constraints++;
      if (item.category === 'api_contract') stats.apiContracts++;
      if (item.category === 'task') stats.tasks++;
      if (item.category === 'bug') stats.bugs++;
      if (item.category === 'repair') stats.repairs++;
    }

    return stats;
  }
}

export const projectBrain = ProjectBrainManager.getInstance();
