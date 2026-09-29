/**
 * CropTwin - External Ingestion Data Contracts (Meteorology, Earth Observation, Soil)
 * Strict Zero-Fake Data Policy: All fields represent genuine provider contracts.
 */

export interface WeatherCurrent {
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  precipitation: number;
  pressure: number;
  surfacePressure?: number;
  cloudCover: number;
  weatherCode?: number;
  weatherDescription?: string;
  et0?: number;
  vpd?: number;
  soilTemperature?: number;
  soilMoisture?: number;
  dewPoint: number;
  visibility?: number;
  uvIndex?: number;
}

export interface WeatherForecastDay {
  date: Date | string;
  temperature: {
    min: number;
    max: number;
    average?: number;
  };
  humidity: number | { min: number; max: number; average: number };
  precipitation: number | { probability: number; amount: number };
  precipitationProbability?: number;
  windSpeed: number;
  conditions: string | string[];
  et0?: number;
  confidence?: number;
}

export interface WeatherData {
  location: {
    latitude: number;
    longitude: number;
  };
  timestamp: string | Date;
  source: string;
  provider?: 'Open-Meteo' | 'IMD' | 'Custom' | string;
  dataType?: 'OBSERVED' | 'FORECAST';
  current: WeatherCurrent;
  forecast: WeatherForecastDay[];
  historical?: any[];
  quality: {
    completeness: number;
    accuracy: number;
    freshness?: number;
    timeliness?: number;
    reliabilityScore?: number;
    lastValidated?: string | Date;
    issues?: string[];
  };
}

export interface VegetationIndices {
  ndvi?: number;
  evi?: number;
  lai?: number;
  fpar?: number;
  confidence?: number;
}

export interface SatelliteData {
  location: {
    latitude: number;
    longitude: number;
  };
  captureDate: string | Date;
  source: string;
  satellite: string;
  sceneId?: string;
  productId?: string;
  mgrsTile?: string;
  cloudCover: number;
  resolutionMeters?: number;
  resolution?: number;
  processingLevel: string;
  dataType?: 'OBSERVED' | 'DERIVED';
  vegetationIndex?: VegetationIndices;
  bandsAvailable?: string[];
  footprintGeometry?: string | Record<string, any>;
  retrievalTimestamp?: string;
  quality?: {
    completeness: number;
    accuracy: number;
    freshness?: number;
    timeliness?: number;
    lastValidated?: string | Date;
    issues?: string[];
  };
}

export interface SoilPropertyLayer {
  property: string;
  depth: string;
  value: number;
  unit: string;
  confidenceInterval?: [number, number];
}

export interface SoilData {
  location: {
    latitude: number;
    longitude: number;
  };
  source: string;
  provider?: string;
  dataType?: 'MODELED';
  datasetVersion?: string;
  retrievedAt?: string;
  lastUpdated?: string | Date;
  soilProperties: {
    soilType: string;
    texture?: {
      sand: number;
      silt: number;
      clay: number;
    };
    ph: number;
    organicCarbon: number;
    nitrogen?: number;
    phosphorus?: number;
    potassium?: number;
    layers?: SoilPropertyLayer[];
    micronutrients?: Record<string, number>;
    physicalProperties?: Record<string, any>;
  };
  soilHealth?: {
    overallScore: number;
    categories?: Record<string, number>;
    deficiencies?: string[];
    strengths?: string[];
    trends?: any[];
  };
  recommendations?: any[];
  quality?: {
    completeness: number;
    accuracy: number;
    timeliness?: number;
    lastValidated?: Date | string;
    issues?: string[];
  };
}

export interface NasaGibsLayerInfo {
  layerId: string;
  name: string;
  satellite: string;
  instrument: string;
  format: string;
  tileMatrixSet: string;
  date: string;
  wmsUrl: string;
  wmtsTemplate: string;
  resolution: string;
}
