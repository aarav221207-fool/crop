/**
 * CropTwin - Agronomic Advisory and Recommendation Data Contracts
 */

import { Priority, AdvisoryType, AdvisoryCategory } from './core';

export interface ActionCost {
  amount: number;
  currency: string;
  unit: string;
  subsidyAvailable?: boolean;
}

export interface ActionItem {
  action: string;
  timing: string;
  resources: string[];
  expectedOutcome: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  cost?: ActionCost;
}

export interface Advisory {
  advisoryId: string;
  farmTwinId: string;
  type: AdvisoryType;
  priority: Priority;
  category: AdvisoryCategory;
  title: string;
  description: string;
  actionItems: ActionItem[];
  reasoning: string;
  urgency?: 'immediate' | 'short_term' | 'routine';
  impactStatement?: string;
  yieldImpact?: number;
  confidenceScore?: number;
  confidence?: number;
  validUntil?: Date | string;
  language?: import('./core').Language;
  metadata?: Record<string, any>;
  status?: 'active' | 'completed' | 'dismissed';
  createdAt?: Date | string;
  updatedAt?: Date | string;
  expiresAt?: Date | string;
}
