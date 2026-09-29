/**
 * CropTwin - Core Agricultural Domain Enums and Primitives
 */

export enum CropType {
  COTTON = 'cotton',
  RICE = 'rice',
  WHEAT = 'wheat',
  SOYBEAN = 'soybean',
  MAIZE = 'maize',
  PULSES = 'pulses',
  MUSTARD = 'mustard',
  GROUNDNUT = 'groundnut',
}

export enum CropStage {
  GERMINATION = 'germination',
  VEGETATIVE = 'vegetative',
  FLOWERING = 'flowering',
  FRUITING = 'fruiting',
  GRAIN_FILLING = 'grain_filling',
  MATURITY = 'maturity',
  HARVEST_READY = 'harvest_ready',
}

export enum IrrigationType {
  DRIP = 'drip',
  SPRINKLER = 'sprinkler',
  FLOOD = 'flood',
  RAINFED = 'rainfed',
  FURROW = 'furrow',
}

export enum SoilType {
  CLAY_LOAM = 'clay_loam',
  BLACK_CLAY = 'black_clay',
  SANDY_LOAM = 'sandy_loam',
  RED_SANDY = 'red_sandy',
  ALLUVIAL = 'alluvial',
  SILT_LOAM = 'silt_loam',
  CLAY = 'clay',
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum AdvisoryType {
  ALERT = 'alert',
  RECOMMENDATION = 'recommendation',
  ROUTINE = 'routine',
  INFORMATION = 'information',
}

export enum AdvisoryCategory {
  IRRIGATION = 'irrigation',
  NUTRIENT = 'nutrient',
  PEST_DISEASE = 'pest_disease',
  HARVEST = 'harvest',
  WEATHER = 'weather',
  PEST_CONTROL = 'pest_control',
  FERTILIZATION = 'fertilization',
  DISEASE_MANAGEMENT = 'disease_management',
  HARVESTING = 'harvesting',
}

export enum Language {
  ENGLISH = 'en',
  HINDI = 'hi',
  TELUGU = 'te',
  MARATHI = 'mr',
  KANNADA = 'kn',
  PUNJABI = 'pa',
  BENGALI = 'bn',
  GUJARATI = 'gu',
  MALAYALAM = 'ml',
  TAMIL = 'ta',
}

export interface Location {
  latitude: number;
  longitude: number;
  district: string;
  state: string;
  country: string;
  village?: string;
}
