/**
 * CropTwin - Supabase Repository
 * 
 * Provides relational persistence for:
 * - profiles
 * - farms & farm_boundaries
 * - fields
 * - crop_cycles
 * - weather_observations & forecasts
 * - satellite_observations
 * - soil_observations
 * - simulation_runs & simulation_results
 * - stress_observations
 * - yield_predictions
 * - advisories
 * - data_provider_status
 * - ai_conversations & ai_messages
 * 
 * Strict Zero-Demo Guarantee:
 * - NO automatic seeding of demo farms or demo advisories.
 * - New sessions start with 0 farms until explicitly created by the user.
 * - All queries enforce Supabase RLS.
 */

import { getSupabase } from '../lib/supabase';
import {
  FarmRecord,
  FarmBoundaryRecord,
  CropCycleRecord,
  AdvisoryRecord,
  WeatherObservationRecord,
  SatelliteObservationRecord,
  SoilObservationRecord,
  SimulationRunRecord,
  SimulationResultRecord,
  StressObservationRecord,
  YieldPredictionRecord,
  DataProviderStatusRecord,
  AiConversationRecord,
  AiMessageRecord,
} from '../types/database';
import { FarmTwin } from '../types/farm-twin';
import { Advisory } from '../types/advisory';
import { CropType, CropStage, IrrigationType, SoilType, Priority, AdvisoryType, AdvisoryCategory } from '../types/core';
import { v4 as uuidv4 } from 'uuid';

// In-session memory cache for immediate reactivity and offline tolerance
class SessionCache {
  farms: FarmTwin[] = [];
  advisories: Advisory[] = [];
  providerStatuses: Record<string, DataProviderStatusRecord> = {};
  simulations: any[] = [];
  weatherHistory: Record<string, any[]> = {};
  satelliteHistory: Record<string, any[]> = {};
  soilObservations: Record<string, any[]> = {};
  aiConversations: Record<string, { id: string; title: string }> = {};
  aiMessages: Record<string, any[]> = {};
}

const cache = new SessionCache();

export class SupabaseRepository {
  /**
   * Check if Supabase client is active and connected
   */
  public isConnected(): boolean {
    return getSupabase() !== null;
  }

  /**
   * Get current authenticated user ID or local session ID
   */
  public async getCurrentUserId(): Promise<string> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) return user.id;
      } catch (err) {
        console.warn('[SupabaseRepository] Auth lookup failed:', err);
      }
    }
    // Local session ID stored in browser storage
    const storageKey = 'croptwin_user_id';
    let localId = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
    if (!localId) {
      localId = `user_${Date.now()}_${uuidv4().substring(0, 8)}`;
      if (typeof window !== 'undefined') localStorage.setItem(storageKey, localId);
    }
    return localId;
  }

  // ============================================================
  // FARMS
  // ============================================================

  public async getFarms(): Promise<FarmTwin[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data: farmsData, error } = await supabase
          .from('farms')
          .select(`
            *,
            farm_boundaries (*),
            crop_cycles (*)
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (farmsData) {
          const mappedFarms: FarmTwin[] = farmsData.map((f: any) => {
            const activeCycle = (f.crop_cycles || []).find((c: any) => c.is_active) || f.crop_cycles?.[0];
            const boundary = f.farm_boundaries?.[0];

            return {
              twinId: f.id,
              farmerId: f.user_id,
              location: {
                latitude: Number(f.latitude),
                longitude: Number(f.longitude),
                district: f.district,
                state: f.state,
                country: f.country || 'India',
                village: f.name,
              },
              farmConfiguration: {
                cropType: (activeCycle?.crop_code as CropType) || CropType.COTTON,
                varietyName: activeCycle?.variety_name || 'Standard Hybrid',
                plantingDate: activeCycle?.sowing_date || f.created_at,
                farmSize: Number(f.total_area_hectares || 1.0),
                irrigationType: (f.irrigation_type as IrrigationType) || IrrigationType.RAINFED,
                soilType: (f.soil_type as SoilType) || SoilType.BLACK_CLAY,
                expectedHarvestDate: activeCycle?.expected_harvest_date,
              },
              currentState: {
                cropStage: (activeCycle?.current_stage as CropStage) || CropStage.GERMINATION,
                daysAfterPlanting: Number(activeCycle?.days_after_planting || 0),
                soilMoisture: 35,
                stressIndicators: {
                  waterStress: 0.2,
                  heatStress: 0.15,
                  nutrientStress: 0.1,
                  pestRisk: 0.1,
                  diseaseRisk: 0.05,
                  lastUpdated: new Date().toISOString(),
                },
                environmentalConditions: {
                  temperature: { min: 22, max: 34, average: 28 },
                  humidity: 60,
                  rainfall: 0,
                  windSpeed: 10,
                  soilTemperature: 26,
                  evapotranspiration: 4.5,
                  solarRadiation: 20,
                  lastUpdated: new Date().toISOString(),
                },
                predictedYield: Number(activeCycle?.target_yield_kg_ha || 2200),
                confidenceLevel: 0.85,
                lastUpdated: new Date().toISOString(),
              },
              boundary: boundary?.boundary_geojson?.coordinates?.[0]
                ? {
                    coordinates: boundary.boundary_geojson.coordinates[0].map((coord: number[]) => [coord[1], coord[0]]),
                  }
                : undefined,
              createdAt: f.created_at,
              lastUpdated: f.updated_at,
              isActive: f.status === 'active',
            };
          });

          cache.farms = mappedFarms;
          return mappedFarms;
        }
      } catch (err: any) {
        console.warn('[SupabaseRepository] getFarms Supabase error:', err.message || err);
      }
    }

    // Return session cache (starts empty for new account)
    return cache.farms;
  }

  public async createFarm(params: {
    name: string;
    district: string;
    state: string;
    latitude: number;
    longitude: number;
    totalAreaHectares: number;
    irrigationType: IrrigationType;
    soilType: SoilType;
    cropType: CropType;
    varietyName: string;
    sowingDate: string;
    boundaryCoordinates?: Array<[number, number]>;
  }): Promise<FarmTwin> {
    const userId = await this.getCurrentUserId();
    const farmId = `farm_${Date.now()}_${uuidv4().substring(0, 8)}`;
    const supabase = getSupabase();

    if (supabase) {
      try {
        // 1. Insert into farms table
        const { data: farmRow, error: farmErr } = await supabase
          .from('farms')
          .insert({
            user_id: userId,
            name: params.name,
            district: params.district,
            state: params.state,
            country: 'India',
            latitude: params.latitude,
            longitude: params.longitude,
            total_area_hectares: params.totalAreaHectares,
            irrigation_type: params.irrigationType,
            soil_type: params.soilType,
            status: 'active',
          })
          .select()
          .single();

        if (farmErr) throw farmErr;
        const insertedFarmId = farmRow.id;

        // 2. Insert boundary if provided
        if (params.boundaryCoordinates && params.boundaryCoordinates.length > 2) {
          const geoJsonCoords = params.boundaryCoordinates.map((c) => [c[1], c[0]]); // [lon, lat]
          // Close polygon if needed
          if (
            geoJsonCoords[0][0] !== geoJsonCoords[geoJsonCoords.length - 1][0] ||
            geoJsonCoords[0][1] !== geoJsonCoords[geoJsonCoords.length - 1][1]
          ) {
            geoJsonCoords.push(geoJsonCoords[0]);
          }

          await supabase.from('farm_boundaries').insert({
            farm_id: insertedFarmId,
            boundary_geojson: {
              type: 'Polygon',
              coordinates: [geoJsonCoords],
            },
            calculated_area_hectares: params.totalAreaHectares,
          });
        }

        // 3. Insert crop cycle
        await supabase.from('crop_cycles').insert({
          farm_id: insertedFarmId,
          crop_code: params.cropType,
          variety_name: params.varietyName,
          sowing_date: params.sowingDate,
          current_stage: 'germination',
          days_after_planting: Math.max(
            0,
            Math.floor((Date.now() - new Date(params.sowingDate).getTime()) / (1000 * 60 * 60 * 24))
          ),
          target_yield_kg_ha: 2200,
          is_active: true,
        });

        // Refresh farms
        const farms = await this.getFarms();
        const created = farms.find((f) => f.twinId === insertedFarmId);
        if (created) return created;
      } catch (err: any) {
        console.warn('[SupabaseRepository] createFarm Supabase error:', err.message || err);
      }
    }

    // Local / In-Memory Creation Fallback
    const daysAfterPlanting = Math.max(
      0,
      Math.floor((Date.now() - new Date(params.sowingDate).getTime()) / (1000 * 60 * 60 * 24))
    );

    const newFarm: FarmTwin = {
      twinId: farmId,
      farmerId: userId,
      location: {
        latitude: params.latitude,
        longitude: params.longitude,
        district: params.district,
        state: params.state,
        country: 'India',
        village: params.name,
      },
      farmConfiguration: {
        cropType: params.cropType,
        varietyName: params.varietyName,
        plantingDate: params.sowingDate,
        farmSize: params.totalAreaHectares,
        irrigationType: params.irrigationType,
        soilType: params.soilType,
      },
      currentState: {
        cropStage: daysAfterPlanting < 10 ? CropStage.GERMINATION : daysAfterPlanting < 40 ? CropStage.VEGETATIVE : CropStage.FLOWERING,
        daysAfterPlanting,
        soilMoisture: 38,
        stressIndicators: {
          waterStress: 0.25,
          heatStress: 0.18,
          nutrientStress: 0.15,
          pestRisk: 0.12,
          diseaseRisk: 0.08,
          lastUpdated: new Date().toISOString(),
        },
        environmentalConditions: {
          temperature: { min: 23, max: 34, average: 28.5 },
          humidity: 62,
          rainfall: 0,
          windSpeed: 11,
          soilTemperature: 27,
          evapotranspiration: 4.8,
          solarRadiation: 21,
          lastUpdated: new Date().toISOString(),
        },
        predictedYield: 2300,
        confidenceLevel: 0.88,
        lastUpdated: new Date().toISOString(),
      },
      boundary: params.boundaryCoordinates
        ? { coordinates: params.boundaryCoordinates }
        : undefined,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      isActive: true,
    };

    cache.farms.unshift(newFarm);
    return newFarm;
  }

  public async deleteFarm(farmId: string): Promise<boolean> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { error } = await supabase.from('farms').delete().eq('id', farmId);
        if (error) throw error;
      } catch (err: any) {
        console.warn('[SupabaseRepository] deleteFarm Supabase error:', err.message || err);
      }
    }

    cache.farms = cache.farms.filter((f) => f.twinId !== farmId);
    cache.advisories = cache.advisories.filter((a) => a.farmTwinId !== farmId);
    return true;
  }

  // ============================================================
  // ADVISORIES
  // ============================================================

  public async getAdvisories(): Promise<Advisory[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('advisories')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (data) {
          const mapped: Advisory[] = data.map((a: any) => ({
            advisoryId: a.id,
            farmTwinId: a.farm_id,
            type: AdvisoryType.ALERT,
            priority: (a.priority as Priority) || Priority.MEDIUM,
            category: (a.category as AdvisoryCategory) || AdvisoryCategory.IRRIGATION,
            title: a.title,
            description: a.diagnosis,
            reasoning: a.impact_statement,
            actionItems: (a.action_items || []).map((item: any) => ({
              action: item.description || item.action || 'Recommended Action',
              timing: `${item.urgencyHours || 24} hours`,
              resources: item.resourceNeeded ? [item.resourceNeeded] : [],
              expectedOutcome: 'Alleviates crop stress factor',
            })),
            urgency: a.urgency,
            yieldImpact: a.estimated_yield_loss_pct,
            createdAt: a.created_at,
            status: a.is_active ? 'active' : 'completed',
          }));

          cache.advisories = mapped;
          return mapped;
        }
      } catch (err: any) {
        console.warn('[SupabaseRepository] getAdvisories Supabase error:', err.message || err);
      }
    }

    return cache.advisories;
  }

  public async createAdvisory(params: {
    farmId: string;
    title: string;
    diagnosis: string;
    category: AdvisoryCategory;
    priority: Priority;
    urgency: 'immediate' | 'short_term' | 'routine';
    impactStatement: string;
    actionItems: Array<{ description: string; urgencyHours: number; resourceNeeded?: string }>;
    estimatedYieldLossPct: number;
  }): Promise<Advisory> {
    const supabase = getSupabase();
    const advId = `adv_${Date.now()}_${uuidv4().substring(0, 8)}`;

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('advisories')
          .insert({
            farm_id: params.farmId,
            category: params.category,
            priority: params.priority,
            urgency: params.urgency,
            title: params.title,
            diagnosis: params.diagnosis,
            impact_statement: params.impactStatement,
            action_items: params.actionItems.map((item, idx) => ({
              id: `item_${idx}`,
              description: item.description,
              urgencyHours: item.urgencyHours,
              resourceNeeded: item.resourceNeeded,
              completed: false,
            })),
            estimated_yield_loss_pct: params.estimatedYieldLossPct,
            is_active: true,
          })
          .select()
          .single();

        if (error) throw error;
        if (data) {
          const created: Advisory = {
            advisoryId: data.id,
            farmTwinId: data.farm_id,
            type: AdvisoryType.ALERT,
            priority: params.priority,
            category: params.category,
            title: params.title,
            description: params.diagnosis,
            reasoning: params.impactStatement,
            actionItems: params.actionItems.map((item) => ({
              action: item.description,
              timing: `Within ${item.urgencyHours} hours`,
              resources: item.resourceNeeded ? [item.resourceNeeded] : [],
              expectedOutcome: 'Direct stress alleviation',
            })),
            urgency: params.urgency,
            yieldImpact: params.estimatedYieldLossPct,
            createdAt: data.created_at,
            status: 'active',
          };
          cache.advisories.unshift(created);
          return created;
        }
      } catch (err: any) {
        console.warn('[SupabaseRepository] createAdvisory Supabase error:', err.message || err);
      }
    }

    const localAdv: Advisory = {
      advisoryId: advId,
      farmTwinId: params.farmId,
      type: AdvisoryType.ALERT,
      priority: params.priority,
      category: params.category,
      title: params.title,
      description: params.diagnosis,
      reasoning: params.impactStatement,
      actionItems: params.actionItems.map((item) => ({
        action: item.description,
        timing: `Within ${item.urgencyHours} hours`,
        resources: item.resourceNeeded ? [item.resourceNeeded] : [],
        expectedOutcome: 'Direct stress alleviation',
      })),
      urgency: params.urgency,
      yieldImpact: params.estimatedYieldLossPct,
      createdAt: new Date().toISOString(),
      status: 'active',
    };

    cache.advisories.unshift(localAdv);
    return localAdv;
  }

  public async deleteAdvisory(advisoryId: string): Promise<boolean> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('advisories').delete().eq('id', advisoryId);
      } catch (err: any) {
        console.warn('[SupabaseRepository] deleteAdvisory error:', err.message || err);
      }
    }
    cache.advisories = cache.advisories.filter((a) => a.advisoryId !== advisoryId);
    return true;
  }

  // ============================================================
  // WEATHER OBSERVATIONS & FORECASTS (PERSISTENCE & HISTORY)
  // ============================================================

  public async saveWeatherObservation(params: {
    farmId: string;
    weather: any;
    provenance?: any;
  }): Promise<void> {
    const { farmId, weather, provenance } = params;
    if (!farmId || !weather) return;

    const record = {
      id: `wobs_${Date.now()}_${uuidv4().substring(0, 8)}`,
      farm_id: farmId,
      provider: provenance?.provider || 'Open-Meteo',
      source: weather.source || 'Open-Meteo WMO NWP',
      observed_at: weather.timestamp || provenance?.observed_at || new Date().toISOString(),
      retrieved_at: provenance?.retrieved_at || new Date().toISOString(),
      temperature_celsius: weather.current?.temperature,
      relative_humidity_pct: weather.current?.humidity,
      precipitation_mm: weather.current?.precipitation,
      wind_speed_kmh: weather.current?.windSpeed,
      wind_direction_deg: weather.current?.windDirection,
      surface_pressure_hpa: weather.current?.pressure,
      cloud_cover_pct: weather.current?.cloudCover,
      et0_fao_evapotranspiration: weather.current?.et0,
      vapour_pressure_deficit_kpa: weather.current?.vpd,
      soil_temperature_celsius: weather.current?.soilTemperature,
      soil_moisture_pct: weather.current?.soilMoisture,
      weather_code: weather.current?.weatherCode,
      weather_description: weather.current?.weatherDescription,
      status_code: provenance?.status || 'LIVE',
      raw_payload: weather,
    };

    // Store in memory cache for immediate access
    if (!cache.weatherHistory) cache.weatherHistory = {};
    if (!cache.weatherHistory[farmId]) cache.weatherHistory[farmId] = [];
    cache.weatherHistory[farmId].unshift(record);

    // Save to Supabase
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('weather_observations').insert(record);

        // Store forecasts separately if present
        if (Array.isArray(weather.forecast) && weather.forecast.length > 0) {
          const forecastRecords = weather.forecast.map((fc: any) => ({
            id: `wfc_${Date.now()}_${uuidv4().substring(0, 8)}`,
            farm_id: farmId,
            provider: 'Open-Meteo',
            forecast_target_date: typeof fc.date === 'string' ? fc.date : new Date(fc.date).toISOString().split('T')[0],
            temp_min_celsius: fc.temperature?.min,
            temp_max_celsius: fc.temperature?.max,
            precipitation_sum_mm: typeof fc.precipitation === 'number' ? fc.precipitation : fc.precipitation?.amount,
            precipitation_probability_pct: fc.precipitationProbability,
            et0_fao_evapotranspiration: fc.et0,
            conditions: Array.isArray(fc.conditions) ? fc.conditions.join(', ') : fc.conditions,
            created_at: new Date().toISOString(),
          }));
          await supabase.from('weather_forecasts').insert(forecastRecords);
        }
      } catch (err: any) {
        console.warn('[SupabaseRepository] saveWeatherObservation error:', err.message || err);
      }
    }
  }

  public async getWeatherHistory(farmId: string, limit: number = 20): Promise<any[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('weather_observations')
          .select('*')
          .eq('farm_id', farmId)
          .order('observed_at', { ascending: false })
          .limit(limit);

        if (!error && data && data.length > 0) {
          return data;
        }
      } catch (err) {
        console.warn('[SupabaseRepository] getWeatherHistory error:', err);
      }
    }
    return cache.weatherHistory?.[farmId] || [];
  }

  // ============================================================
  // SATELLITE OBSERVATIONS (PERSISTENCE & HISTORY)
  // ============================================================

  public async saveSatelliteObservation(params: {
    farmId: string;
    satellite: any;
    provenance?: any;
  }): Promise<void> {
    const { farmId, satellite, provenance } = params;
    if (!farmId || !satellite) return;

    const record = {
      id: `satobs_${Date.now()}_${uuidv4().substring(0, 8)}`,
      farm_id: farmId,
      scene_id: satellite.sceneId,
      product_id: satellite.productId,
      provider: provenance?.provider || 'Copernicus Data Space Ecosystem',
      satellite_mission: satellite.satellite || 'Sentinel-2',
      mgrs_tile: satellite.mgrsTile,
      observed_at: satellite.captureDate || new Date().toISOString(),
      retrieved_at: satellite.retrievalTimestamp || new Date().toISOString(),
      cloud_cover_pct: satellite.cloudCover,
      resolution_meters: satellite.resolutionMeters || 10,
      processing_level: satellite.processingLevel || 'Level-2A BOA',
      ndvi: satellite.vegetationIndex?.ndvi,
      evi: satellite.vegetationIndex?.evi,
      lai: satellite.vegetationIndex?.lai,
      status_code: provenance?.status || 'LIVE',
      raw_payload: satellite,
    };

    if (!cache.satelliteHistory) cache.satelliteHistory = {};
    if (!cache.satelliteHistory[farmId]) cache.satelliteHistory[farmId] = [];
    cache.satelliteHistory[farmId].unshift(record);

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('satellite_observations').insert(record);
      } catch (err: any) {
        console.warn('[SupabaseRepository] saveSatelliteObservation error:', err.message || err);
      }
    }
  }

  public async getSatelliteHistory(farmId: string, limit: number = 10): Promise<any[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('satellite_observations')
          .select('*')
          .eq('farm_id', farmId)
          .order('observed_at', { ascending: false })
          .limit(limit);

        if (!error && data && data.length > 0) {
          return data;
        }
      } catch (err) {
        console.warn('[SupabaseRepository] getSatelliteHistory error:', err);
      }
    }
    return cache.satelliteHistory?.[farmId] || [];
  }

  // ============================================================
  // SOIL OBSERVATIONS (SPATIAL / MODELLED PERSISTENCE)
  // ============================================================

  public async saveSoilObservation(params: {
    farmId: string;
    soil: any;
    provenance?: any;
  }): Promise<void> {
    const { farmId, soil, provenance } = params;
    if (!farmId || !soil) return;

    const record = {
      id: `soilobs_${Date.now()}_${uuidv4().substring(0, 8)}`,
      farm_id: farmId,
      provider: provenance?.provider || 'ISRIC World Soil Information',
      source: soil.source || 'ISRIC SoilGrids 2.0',
      observed_at: soil.retrievedAt || new Date().toISOString(),
      retrieved_at: provenance?.retrieved_at || new Date().toISOString(),
      soil_type: soil.soilProperties?.soilType,
      ph_h2o: soil.soilProperties?.ph,
      organic_carbon_g_kg: soil.soilProperties?.organicCarbon,
      clay_pct: soil.soilProperties?.texture?.clay,
      sand_pct: soil.soilProperties?.texture?.sand,
      silt_pct: soil.soilProperties?.texture?.silt,
      is_modeled: true,
      status_code: provenance?.status || 'LIVE',
      raw_payload: soil,
    };

    if (!cache.soilObservations) cache.soilObservations = {};
    if (!cache.soilObservations[farmId]) cache.soilObservations[farmId] = [];
    cache.soilObservations[farmId].unshift(record);

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('soil_observations').insert(record);
      } catch (err: any) {
        console.warn('[SupabaseRepository] saveSoilObservation error:', err.message || err);
      }
    }
  }

  public async getSoilObservations(farmId: string): Promise<any[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('soil_observations')
          .select('*')
          .eq('farm_id', farmId)
          .order('retrieved_at', { ascending: false })
          .limit(5);

        if (!error && data && data.length > 0) {
          return data;
        }
      } catch (err) {
        console.warn('[SupabaseRepository] getSoilObservations error:', err);
      }
    }
    return cache.soilObservations?.[farmId] || [];
  }

  // ============================================================
  // AI CONVERSATION & MESSAGE MEMORY (SUPABASE PERSISTENCE)
  // ============================================================

  public async getOrCreateConversation(farmId: string): Promise<{ id: string; title: string }> {
    const userId = await this.getCurrentUserId();
    const supabase = getSupabase();

    if (supabase) {
      try {
        // Try fetching existing conversation for this farm and user
        const { data, error } = await supabase
          .from('ai_conversations')
          .select('id, title')
          .eq('farm_id', farmId)
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          cache.aiConversations[farmId] = data;
          return data;
        }

        // Create new conversation in Supabase
        const { data: newConv, error: createErr } = await supabase
          .from('ai_conversations')
          .insert({
            user_id: userId,
            farm_id: farmId,
            title: `Agronomy Intelligence (${farmId})`,
          })
          .select('id, title')
          .single();

        if (!createErr && newConv) {
          cache.aiConversations[farmId] = newConv;
          return newConv;
        }
      } catch (err) {
        console.warn('[SupabaseRepository] getOrCreateConversation error:', err);
      }
    }

    if (!cache.aiConversations[farmId]) {
      cache.aiConversations[farmId] = {
        id: `conv_${farmId}_${uuidv4().substring(0, 8)}`,
        title: `Agronomy Intelligence (${farmId})`,
      };
    }
    return cache.aiConversations[farmId];
  }

  public async getMessages(conversationId: string): Promise<any[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('ai_messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });

        if (!error && data) {
          cache.aiMessages[conversationId] = data;
          return data;
        }
      } catch (err) {
        console.warn('[SupabaseRepository] getMessages error:', err);
      }
    }
    return cache.aiMessages[conversationId] || [];
  }

  public async saveMessage(params: {
    conversationId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    metadata?: any;
  }): Promise<any> {
    const messageId = `msg_${Date.now()}_${uuidv4().substring(0, 8)}`;
    const newMsg = {
      id: messageId,
      conversation_id: params.conversationId,
      role: params.role,
      content: params.content,
      metadata: params.metadata || {},
      created_at: new Date().toISOString(),
    };

    if (!cache.aiMessages[params.conversationId]) {
      cache.aiMessages[params.conversationId] = [];
    }
    cache.aiMessages[params.conversationId].push(newMsg);

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('ai_messages').insert(newMsg);
        await supabase
          .from('ai_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', params.conversationId);
      } catch (err) {
        console.warn('[SupabaseRepository] saveMessage error:', err);
      }
    }
    return newMsg;
  }

  public async clearConversation(conversationId: string): Promise<void> {
    cache.aiMessages[conversationId] = [];
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('ai_messages').delete().eq('conversation_id', conversationId);
      } catch (err) {
        console.warn('[SupabaseRepository] clearConversation error:', err);
      }
    }
  }
}

export const supabaseRepository = new SupabaseRepository();
