-- CropTwin Relational Schema for Supabase PostgreSQL
-- Includes PostGIS extensions, UUID primary keys, relational constraints, and Row Level Security (RLS)

-- 1. Enable PostGIS and UUID Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Profiles Table (linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone_number TEXT,
  preferred_language TEXT DEFAULT 'en',
  role TEXT DEFAULT 'farmer' CHECK (role IN ('farmer', 'agronomist', 'admin', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Crops Reference Table (Agronomic Catalog)
CREATE TABLE IF NOT EXISTS crops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  common_name TEXT NOT NULL,
  botanical_name TEXT,
  base_temperature NUMERIC NOT NULL,
  optimal_temperature_min NUMERIC NOT NULL,
  optimal_temperature_max NUMERIC NOT NULL,
  max_temperature NUMERIC NOT NULL,
  water_requirement_daily NUMERIC NOT NULL,
  critical_stages TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Farms Table (belongs to user / profile)
CREATE TABLE IF NOT EXISTS farms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  district TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT DEFAULT 'India',
  latitude NUMERIC(10, 6) NOT NULL,
  longitude NUMERIC(10, 6) NOT NULL,
  elevation_m NUMERIC,
  location_geog GEOGRAPHY(Point, 4326),
  total_area_hectares NUMERIC NOT NULL DEFAULT 1.0,
  irrigation_type TEXT NOT NULL DEFAULT 'rainfed',
  soil_type TEXT NOT NULL DEFAULT 'black_clay',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Farm Boundaries Table (PostGIS polygon coordinates)
CREATE TABLE IF NOT EXISTS farm_boundaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  boundary_polygon GEOMETRY(Polygon, 4326),
  boundary_geojson JSONB NOT NULL,
  calculated_area_hectares NUMERIC NOT NULL,
  perimeter_meters NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Fields Table (Sub-parcels within a farm)
CREATE TABLE IF NOT EXISTS fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  area_hectares NUMERIC NOT NULL,
  soil_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. Crop Cycles Table (Active or past cultivation cycles on a farm)
CREATE TABLE IF NOT EXISTS crop_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  field_id UUID REFERENCES fields(id) ON DELETE SET NULL,
  crop_code TEXT NOT NULL,
  variety_name TEXT NOT NULL,
  sowing_date DATE NOT NULL,
  expected_harvest_date DATE,
  actual_harvest_date DATE,
  current_stage TEXT NOT NULL DEFAULT 'germination',
  days_after_planting INTEGER NOT NULL DEFAULT 0,
  accumulated_gdd NUMERIC NOT NULL DEFAULT 0,
  target_yield_kg_ha NUMERIC NOT NULL DEFAULT 2000,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. Weather Observations Table (External Provider Provenance)
CREATE TABLE IF NOT EXISTS weather_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('LIVE', 'LOADING', 'STALE', 'UNAVAILABLE', 'ERROR', 'NOT_CONFIGURED')),
  observed_at TIMESTAMPTZ NOT NULL,
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  latitude NUMERIC(10, 6) NOT NULL,
  longitude NUMERIC(10, 6) NOT NULL,
  temperature_celsius NUMERIC,
  humidity_percent NUMERIC,
  wind_speed_kmh NUMERIC,
  wind_direction_deg NUMERIC,
  precipitation_mm NUMERIC,
  pressure_hpa NUMERIC,
  solar_radiation_wm2 NUMERIC,
  et0_mm_day NUMERIC,
  quality_info JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. Weather Forecasts Table
CREATE TABLE IF NOT EXISTS weather_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  forecast_date DATE NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  temp_min NUMERIC,
  temp_max NUMERIC,
  precipitation_sum NUMERIC,
  precipitation_prob NUMERIC,
  wind_speed NUMERIC,
  conditions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. Satellite Observations Table (Sentinel-2 / Remote Sensing Provenance)
CREATE TABLE IF NOT EXISTS satellite_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('LIVE', 'LOADING', 'STALE', 'UNAVAILABLE', 'ERROR', 'NOT_CONFIGURED')),
  observed_at TIMESTAMPTZ NOT NULL,
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  latitude NUMERIC(10, 6) NOT NULL,
  longitude NUMERIC(10, 6) NOT NULL,
  satellite_name TEXT NOT NULL,
  resolution_meters NUMERIC NOT NULL,
  cloud_cover_percent NUMERIC NOT NULL,
  ndvi NUMERIC,
  evi NUMERIC,
  lai NUMERIC,
  fpar NUMERIC,
  scene_id TEXT,
  quality_info JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 11. Soil Observations Table
CREATE TABLE IF NOT EXISTS soil_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('LIVE', 'LOADING', 'STALE', 'UNAVAILABLE', 'ERROR', 'NOT_CONFIGURED')),
  observed_at TIMESTAMPTZ NOT NULL,
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  latitude NUMERIC(10, 6) NOT NULL,
  longitude NUMERIC(10, 6) NOT NULL,
  moisture_volumetric_percent NUMERIC,
  temperature_celsius NUMERIC,
  ph NUMERIC,
  organic_carbon_percent NUMERIC,
  nitrogen_kg_ha NUMERIC,
  phosphorus_kg_ha NUMERIC,
  potassium_kg_ha NUMERIC,
  quality_info JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 12. Simulation Runs Table
CREATE TABLE IF NOT EXISTS simulation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  crop_cycle_id UUID REFERENCES crop_cycles(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  days_after_planting INTEGER NOT NULL,
  scenario_params JSONB NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 13. Simulation Results Table
CREATE TABLE IF NOT EXISTS simulation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_run_id UUID NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
  current_stage TEXT NOT NULL,
  accumulated_gdd NUMERIC NOT NULL,
  daily_gdd NUMERIC NOT NULL,
  water_stress NUMERIC NOT NULL,
  heat_stress NUMERIC NOT NULL,
  overall_stress NUMERIC NOT NULL,
  baseline_yield_kg_ha NUMERIC NOT NULL,
  forecast_yield_kg_ha NUMERIC NOT NULL,
  yield_impact_percent NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 14. Stress Observations Table
CREATE TABLE IF NOT EXISTS stress_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  crop_cycle_id UUID REFERENCES crop_cycles(id) ON DELETE CASCADE,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  water_stress NUMERIC NOT NULL,
  heat_stress NUMERIC NOT NULL,
  nutrient_stress NUMERIC NOT NULL,
  pest_risk NUMERIC NOT NULL,
  disease_risk NUMERIC NOT NULL,
  overall_stress NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 15. Yield Predictions Table
CREATE TABLE IF NOT EXISTS yield_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  crop_cycle_id UUID REFERENCES crop_cycles(id) ON DELETE CASCADE,
  predicted_yield_kg_ha NUMERIC NOT NULL,
  baseline_yield_kg_ha NUMERIC NOT NULL,
  confidence_level NUMERIC NOT NULL DEFAULT 0.85,
  yield_gap_kg_ha NUMERIC,
  predicted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 16. Advisories Table
CREATE TABLE IF NOT EXISTS advisories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  crop_cycle_id UUID REFERENCES crop_cycles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  urgency TEXT NOT NULL CHECK (urgency IN ('immediate', 'short_term', 'routine')),
  title TEXT NOT NULL,
  diagnosis TEXT NOT NULL,
  impact_statement TEXT NOT NULL,
  action_items JSONB NOT NULL DEFAULT '[]',
  estimated_yield_loss_pct NUMERIC DEFAULT 0,
  actionable_deadline TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sms_dispatched BOOLEAN NOT NULL DEFAULT false,
  sms_dispatched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 17. Data Provider Status Table
CREATE TABLE IF NOT EXISTS data_provider_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name TEXT NOT NULL UNIQUE,
  provider_category TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('LIVE', 'LOADING', 'STALE', 'UNAVAILABLE', 'ERROR', 'NOT_CONFIGURED')),
  endpoint_url TEXT,
  last_checked TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  last_successful_ingestion TIMESTAMPTZ,
  diagnostic_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 18. AI Conversations Table
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  farm_id UUID REFERENCES farms(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Agronomy Consultation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 19. AI Messages Table
CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Enforce database-level ownership for every authenticated user
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_boundaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE crops ENABLE ROW LEVEL SECURITY;
ALTER TABLE crop_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE satellite_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE soil_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE stress_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE yield_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE advisories ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_provider_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

-- Profiles: Users manage their own profile
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Crops: Anyone authenticated can read agronomy reference crops
CREATE POLICY "Authenticated users can view crop parameters" ON crops
  FOR SELECT TO authenticated USING (true);

-- Data Provider Status: Anyone authenticated can view provider status
CREATE POLICY "Authenticated users can view data provider status" ON data_provider_status
  FOR SELECT TO authenticated USING (true);

-- Farms: Users own their farms
CREATE POLICY "Users can select own farms" ON farms
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own farms" ON farms
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own farms" ON farms
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own farms" ON farms
  FOR DELETE USING (auth.uid() = user_id);

-- Farm Boundaries: Accessible if user owns the farm
CREATE POLICY "Users can select own farm boundaries" ON farm_boundaries
  FOR SELECT USING (EXISTS (SELECT 1 FROM farms WHERE farms.id = farm_boundaries.farm_id AND farms.user_id = auth.uid()));
CREATE POLICY "Users can insert own farm boundaries" ON farm_boundaries
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM farms WHERE farms.id = farm_boundaries.farm_id AND farms.user_id = auth.uid()));
CREATE POLICY "Users can update own farm boundaries" ON farm_boundaries
  FOR UPDATE USING (EXISTS (SELECT 1 FROM farms WHERE farms.id = farm_boundaries.farm_id AND farms.user_id = auth.uid()));
CREATE POLICY "Users can delete own farm boundaries" ON farm_boundaries
  FOR DELETE USING (EXISTS (SELECT 1 FROM farms WHERE farms.id = farm_boundaries.farm_id AND farms.user_id = auth.uid()));

-- Fields: Accessible if user owns the farm
CREATE POLICY "Users can select own fields" ON fields
  FOR SELECT USING (EXISTS (SELECT 1 FROM farms WHERE farms.id = fields.farm_id AND farms.user_id = auth.uid()));
CREATE POLICY "Users can insert own fields" ON fields
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM farms WHERE farms.id = fields.farm_id AND farms.user_id = auth.uid()));
CREATE POLICY "Users can update own fields" ON fields
  FOR UPDATE USING (EXISTS (SELECT 1 FROM farms WHERE farms.id = fields.farm_id AND farms.user_id = auth.uid()));
CREATE POLICY "Users can delete own fields" ON fields
  FOR DELETE USING (EXISTS (SELECT 1 FROM farms WHERE farms.id = fields.farm_id AND farms.user_id = auth.uid()));

-- Crop Cycles: Accessible if user owns the farm
CREATE POLICY "Users can select own crop cycles" ON crop_cycles
  FOR SELECT USING (EXISTS (SELECT 1 FROM farms WHERE farms.id = crop_cycles.farm_id AND farms.user_id = auth.uid()));
CREATE POLICY "Users can insert own crop cycles" ON crop_cycles
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM farms WHERE farms.id = crop_cycles.farm_id AND farms.user_id = auth.uid()));
CREATE POLICY "Users can update own crop cycles" ON crop_cycles
  FOR UPDATE USING (EXISTS (SELECT 1 FROM farms WHERE farms.id = crop_cycles.farm_id AND farms.user_id = auth.uid()));
CREATE POLICY "Users can delete own crop cycles" ON crop_cycles
  FOR DELETE USING (EXISTS (SELECT 1 FROM farms WHERE farms.id = crop_cycles.farm_id AND farms.user_id = auth.uid()));

-- Weather Observations: Farm ownership
CREATE POLICY "Users can select own weather observations" ON weather_observations
  FOR SELECT USING (EXISTS (SELECT 1 FROM farms WHERE farms.id = weather_observations.farm_id AND farms.user_id = auth.uid()));
CREATE POLICY "Users can insert own weather observations" ON weather_observations
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM farms WHERE farms.id = weather_observations.farm_id AND farms.user_id = auth.uid()));

-- Weather Forecasts: Farm ownership
CREATE POLICY "Users can select own weather forecasts" ON weather_forecasts
  FOR SELECT USING (EXISTS (SELECT 1 FROM farms WHERE farms.id = weather_forecasts.farm_id AND farms.user_id = auth.uid()));
CREATE POLICY "Users can insert own weather forecasts" ON weather_forecasts
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM farms WHERE farms.id = weather_forecasts.farm_id AND farms.user_id = auth.uid()));

-- Satellite Observations: Farm ownership
CREATE POLICY "Users can select own satellite observations" ON satellite_observations
  FOR SELECT USING (EXISTS (SELECT 1 FROM farms WHERE farms.id = satellite_observations.farm_id AND farms.user_id = auth.uid()));
CREATE POLICY "Users can insert own satellite observations" ON satellite_observations
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM farms WHERE farms.id = satellite_observations.farm_id AND farms.user_id = auth.uid()));

-- Soil Observations: Farm ownership
CREATE POLICY "Users can select own soil observations" ON soil_observations
  FOR SELECT USING (EXISTS (SELECT 1 FROM farms WHERE farms.id = soil_observations.farm_id AND farms.user_id = auth.uid()));
CREATE POLICY "Users can insert own soil observations" ON soil_observations
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM farms WHERE farms.id = soil_observations.farm_id AND farms.user_id = auth.uid()));

-- Simulation Runs & Results: Farm ownership
CREATE POLICY "Users can select own simulation runs" ON simulation_runs
  FOR SELECT USING (EXISTS (SELECT 1 FROM farms WHERE farms.id = simulation_runs.farm_id AND farms.user_id = auth.uid()));
CREATE POLICY "Users can insert own simulation runs" ON simulation_runs
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM farms WHERE farms.id = simulation_runs.farm_id AND farms.user_id = auth.uid()));

CREATE POLICY "Users can select own simulation results" ON simulation_results
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM simulation_runs JOIN farms ON farms.id = simulation_runs.farm_id
    WHERE simulation_runs.id = simulation_results.simulation_run_id AND farms.user_id = auth.uid()
  ));
CREATE POLICY "Users can insert own simulation results" ON simulation_results
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM simulation_runs JOIN farms ON farms.id = simulation_runs.farm_id
    WHERE simulation_runs.id = simulation_results.simulation_run_id AND farms.user_id = auth.uid()
  ));

-- Stress Observations: Farm ownership
CREATE POLICY "Users can select own stress observations" ON stress_observations
  FOR SELECT USING (EXISTS (SELECT 1 FROM farms WHERE farms.id = stress_observations.farm_id AND farms.user_id = auth.uid()));
CREATE POLICY "Users can insert own stress observations" ON stress_observations
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM farms WHERE farms.id = stress_observations.farm_id AND farms.user_id = auth.uid()));

-- Yield Predictions: Farm ownership
CREATE POLICY "Users can select own yield predictions" ON yield_predictions
  FOR SELECT USING (EXISTS (SELECT 1 FROM farms WHERE farms.id = yield_predictions.farm_id AND farms.user_id = auth.uid()));
CREATE POLICY "Users can insert own yield predictions" ON yield_predictions
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM farms WHERE farms.id = yield_predictions.farm_id AND farms.user_id = auth.uid()));

-- Advisories: Farm ownership
CREATE POLICY "Users can select own advisories" ON advisories
  FOR SELECT USING (EXISTS (SELECT 1 FROM farms WHERE farms.id = advisories.farm_id AND farms.user_id = auth.uid()));
CREATE POLICY "Users can insert own advisories" ON advisories
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM farms WHERE farms.id = advisories.farm_id AND farms.user_id = auth.uid()));
CREATE POLICY "Users can update own advisories" ON advisories
  FOR UPDATE USING (EXISTS (SELECT 1 FROM farms WHERE farms.id = advisories.farm_id AND farms.user_id = auth.uid()));
CREATE POLICY "Users can delete own advisories" ON advisories
  FOR DELETE USING (EXISTS (SELECT 1 FROM farms WHERE farms.id = advisories.farm_id AND farms.user_id = auth.uid()));

-- AI Conversations: User ownership
CREATE POLICY "Users can select own AI conversations" ON ai_conversations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own AI conversations" ON ai_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own AI conversations" ON ai_conversations
  FOR DELETE USING (auth.uid() = user_id);

-- AI Messages: Conversation user ownership
CREATE POLICY "Users can select own AI messages" ON ai_messages
  FOR SELECT USING (EXISTS (SELECT 1 FROM ai_conversations WHERE ai_conversations.id = ai_messages.conversation_id AND ai_conversations.user_id = auth.uid()));
CREATE POLICY "Users can insert own AI messages" ON ai_messages
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM ai_conversations WHERE ai_conversations.id = ai_messages.conversation_id AND ai_conversations.user_id = auth.uid()));
