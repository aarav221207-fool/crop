/**
 * CropTwin - Digital Twin State and Biophysical Agronomic Data Contracts
 */

import {
  CropType,
  CropStage,
  IrrigationType,
  SoilType,
  Language,
  Location,
} from './core';

export interface StressIndicators {
  waterStress: number;
  heatStress: number;
  nutrientStress: number;
  pestRisk: number;
  diseaseRisk: number;
  lastUpdated?: Date | string;
}

export interface EnvironmentalConditions {
  temperature: {
    min: number;
    max: number;
    average: number;
  };
  humidity: number;
  rainfall: number;
  windSpeed: number;
  soilTemperature: number;
  evapotranspiration: number;
  solarRadiation: number;
  lastUpdated?: Date | string;
}

export interface DataQualityMetrics {
  weatherDataFreshness: number;
  satelliteDataFreshness: number;
  soilDataAvailability: boolean;
  farmerInputRecency: number;
  overallQualityScore: number;
}

export interface FarmState {
  cropStage: CropStage;
  daysAfterPlanting: number;
  soilMoisture: number;
  stressIndicators: StressIndicators;
  environmentalConditions: EnvironmentalConditions;
  predictedYield: number;
  confidenceLevel: number;
  lastUpdated?: Date | string;
  dataQuality?: DataQualityMetrics;
}

export interface FarmConfiguration {
  cropType: CropType;
  varietyName: string;
  plantingDate: Date | string;
  farmSize: number;
  irrigationType: IrrigationType;
  soilType: SoilType;
  expectedHarvestDate?: Date | string;
  previousCropHistory?: Array<{
    cropType: CropType;
    varietyName: string;
    plantingDate: Date | string;
    harvestDate?: Date | string;
    yield?: number;
  }>;
}

export interface FarmTwin {
  twinId: string;
  farmerId: string;
  location: Location;
  farmConfiguration: FarmConfiguration;
  currentState: FarmState;
  boundary?: {
    coordinates: Array<[number, number]>;
  };
  historicalData?: any[];
  lastUpdated?: Date | string;
  createdAt?: Date | string;
  isActive?: boolean;
  metadata?: Record<string, any>;
  preferences?: {
    preferredLanguage?: Language;
    language?: Language;
    communicationChannels?: string[];
    advisoryFrequency?: string;
    riskTolerance?: string;
    organicFarming?: boolean;
  };
}
