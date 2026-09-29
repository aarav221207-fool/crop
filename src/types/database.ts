/**
 * CropTwin - Supabase Database Types & Schemas
 * Type definitions matching the PostgreSQL schema and Row Level Security structure.
 */

export type ProviderStatusCode = 'LIVE' | 'LOADING' | 'STALE' | 'UNAVAILABLE' | 'ERROR' | 'NOT_CONFIGURED';

export interface ProfileRecord {
  id: string;
  email: string;
  full_name: string | null;
  phone_number: string | null;
  preferred_language: string;
  role: 'farmer' | 'agronomist' | 'admin' | 'viewer';
  created_at: string;
  updated_at: string;
}

export interface FarmRecord {
  id: string;
  user_id: string;
  name: string;
  district: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  elevation_m: number | null;
  total_area_hectares: number;
  irrigation_type: string;
  soil_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface FarmBoundaryRecord {
  id: string;
  farm_id: string;
  boundary_geojson: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  calculated_area_hectares: number;
  perimeter_meters: number | null;
  created_at: string;
  updated_at: string;
}

export interface FieldRecord {
  id: string;
  farm_id: string;
  name: string;
  area_hectares: number;
  soil_type: string;
  created_at: string;
  updated_at: string;
}

export interface CropRecord {
  id: string;
  code: string;
  common_name: string;
  botanical_name: string | null;
  base_temperature: number;
  optimal_temperature_min: number;
  optimal_temperature_max: number;
  max_temperature: number;
  water_requirement_daily: number;
  critical_stages: string[];
  created_at: string;
  updated_at: string;
}

export interface CropCycleRecord {
  id: string;
  farm_id: string;
  field_id: string | null;
  crop_code: string;
  variety_name: string;
  sowing_date: string;
  expected_harvest_date: string | null;
  actual_harvest_date: string | null;
  current_stage: string;
  days_after_planting: number;
  accumulated_gdd: number;
  target_yield_kg_ha: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WeatherObservationRecord {
  id: string;
  farm_id: string;
  provider: string;
  source: string;
  status: ProviderStatusCode;
  observed_at: string;
  retrieved_at: string;
  latitude: number;
  longitude: number;
  temperature_celsius: number | null;
  humidity_percent: number | null;
  wind_speed_kmh: number | null;
  wind_direction_deg: number | null;
  precipitation_mm: number | null;
  pressure_hpa: number | null;
  solar_radiation_wm2: number | null;
  et0_mm_day: number | null;
  quality_info: Record<string, any> | null;
  created_at: string;
}

export interface WeatherForecastRecord {
  id: string;
  farm_id: string;
  provider: string;
  forecast_date: string;
  observed_at: string;
  retrieved_at: string;
  temp_min: number | null;
  temp_max: number | null;
  precipitation_sum: number | null;
  precipitation_prob: number | null;
  wind_speed: number | null;
  conditions: string | null;
  created_at: string;
}

export interface SatelliteObservationRecord {
  id: string;
  farm_id: string;
  provider: string;
  source: string;
  status: ProviderStatusCode;
  observed_at: string;
  retrieved_at: string;
  latitude: number;
  longitude: number;
  satellite_name: string;
  resolution_meters: number;
  cloud_cover_percent: number;
  ndvi: number | null;
  evi: number | null;
  lai: number | null;
  fpar: number | null;
  scene_id: string | null;
  quality_info: Record<string, any> | null;
  created_at: string;
}

export interface SoilObservationRecord {
  id: string;
  farm_id: string;
  provider: string;
  source: string;
  status: ProviderStatusCode;
  observed_at: string;
  retrieved_at: string;
  latitude: number;
  longitude: number;
  moisture_volumetric_percent: number | null;
  temperature_celsius: number | null;
  ph: number | null;
  organic_carbon_percent: number | null;
  nitrogen_kg_ha: number | null;
  phosphorus_kg_ha: number | null;
  potassium_kg_ha: number | null;
  quality_info: Record<string, any> | null;
  created_at: string;
}

export interface SimulationRunRecord {
  id: string;
  farm_id: string;
  crop_cycle_id: string | null;
  model_name: string;
  days_after_planting: number;
  scenario_params: Record<string, any>;
  executed_at: string;
  created_at: string;
}

export interface SimulationResultRecord {
  id: string;
  simulation_run_id: string;
  current_stage: string;
  accumulated_gdd: number;
  daily_gdd: number;
  water_stress: number;
  heat_stress: number;
  overall_stress: number;
  baseline_yield_kg_ha: number;
  forecast_yield_kg_ha: number;
  yield_impact_percent: number;
  created_at: string;
}

export interface StressObservationRecord {
  id: string;
  farm_id: string;
  crop_cycle_id: string | null;
  observed_at: string;
  water_stress: number;
  heat_stress: number;
  nutrient_stress: number;
  pest_risk: number;
  disease_risk: number;
  overall_stress: number;
  created_at: string;
}

export interface YieldPredictionRecord {
  id: string;
  farm_id: string;
  crop_cycle_id: string | null;
  predicted_yield_kg_ha: number;
  baseline_yield_kg_ha: number;
  confidence_level: number;
  yield_gap_kg_ha: number | null;
  predicted_at: string;
  created_at: string;
}

export interface AdvisoryRecord {
  id: string;
  farm_id: string;
  crop_cycle_id: string | null;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  urgency: 'immediate' | 'short_term' | 'routine';
  title: string;
  diagnosis: string;
  impact_statement: string;
  action_items: Array<{
    id: string;
    description: string;
    urgencyHours: number;
    resourceNeeded?: string;
    completed: boolean;
  }>;
  estimated_yield_loss_pct: number;
  actionable_deadline: string | null;
  is_active: boolean;
  sms_dispatched: boolean;
  sms_dispatched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DataProviderStatusRecord {
  id: string;
  provider_name: string;
  provider_category: string;
  status: ProviderStatusCode;
  endpoint_url: string | null;
  last_checked: string;
  last_successful_ingestion: string | null;
  diagnostic_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiConversationRecord {
  id: string;
  user_id: string;
  farm_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AiMessageRecord {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: Record<string, any> | null;
  created_at: string;
}
