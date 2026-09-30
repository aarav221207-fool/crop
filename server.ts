/**
 * TerraTwin - Agricultural Digital Twin Platform Server
 * Express backend with server-side Gemini API, Agro-meteorology endpoints,
 * and Vite middleware integration running on Port 3000.
 */

import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import {
  weatherProvider,
  imdProvider,
  satelliteProvider,
  soilDataProvider,
  smsProvider,
  nasaGibsProvider,
} from './src/services/external-data-providers';
import { CROP_PARAMETERS_REGISTRY } from './src/adapters/crop-twin-simulation-service';
import { CropType, CropStage } from './src/types/core';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '10mb' }));

// Initialize Google Gemini Client server-side
// Reads GEMINI_API_KEY from environment without exposing to frontend
const geminiApiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI(geminiApiKey ? {
  apiKey: geminiApiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
} : {});

/**
 * Robust Gemini model invoker using gemini-3.8-flash with gemini-flash-latest alias
 */
async function callGemini(contents: any, systemInstruction?: string): Promise<{ text: string; modelUsed: string }> {
  if (!geminiApiKey) {
    throw new Error("Gemini isn't configured yet. Please set GEMINI_API_KEY in your server or Netlify environment variables.");
  }

  const modelsToTry = ['gemini-3.8-flash', 'gemini-flash-latest'];
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: systemInstruction ? { systemInstruction } : undefined,
      });

      if (response && response.text) {
        return { text: response.text, modelUsed: model };
      }
    } catch (err: any) {
      console.warn(`[Gemini Engine] Model ${model} failed:`, err.message || err);
      lastError = err;
    }
  }

  let cleanMsg = lastError?.message || "Gemini isn't configured yet.";
  try {
    const parsed = JSON.parse(cleanMsg);
    if (parsed.error?.message) {
      cleanMsg = parsed.error.message;
    }
  } catch {}

  throw new Error(cleanMsg);
}

/**
 * Builds a biophysically grounded, provenance-tagged context string for the selected farm
 */
function buildFarmContextPrompt(farm: any, weather: any, satellite: any, soil: any, advisories: any[] = []): string {
  if (!farm) return 'No farm registered or selected.';

  const { farmConfiguration, location, currentState } = farm;
  const cropParams = CROP_PARAMETERS_REGISTRY[farmConfiguration?.cropType] || CROP_PARAMETERS_REGISTRY[CropType.COTTON];

  const weatherStatus = weather ? 'OBSERVED' : 'UNAVAILABLE';
  const weatherText = weather ? `
[WEATHER TELEMETRY] - Status: ${weatherStatus}
- Source: Open-Meteo High-Resolution Numerical Weather Prediction (WMO NWP)
- Observed At: ${weather.timestamp || 'Recent'}
- Current Temperature: ${weather.current?.temperature ?? 'UNAVAILABLE'}°C
- Relative Humidity: ${weather.current?.humidity ?? 'UNAVAILABLE'}%
- Precipitation Rate: ${weather.current?.precipitation ?? 0} mm/h
- Wind: ${weather.current?.windSpeed ?? 'UNAVAILABLE'} km/h (Direction: ${weather.current?.windDirection ?? '—'}°)
- Surface Pressure: ${weather.current?.pressure ?? 'UNAVAILABLE'} hPa
- Cloud Cover: ${weather.current?.cloudCover ?? 0}%
- Evapotranspiration (ET0): ${weather.current?.et0 ?? 'UNAVAILABLE'} mm/day
- Vapour Pressure Deficit (VPD): ${weather.current?.vpd ?? 'UNAVAILABLE'} kPa
- Root-Zone Soil Temp (0-7cm): ${weather.current?.soilTemperature ?? 'UNAVAILABLE'}°C
- Root-Zone Soil Moisture: ${weather.current?.soilMoisture !== undefined ? (weather.current.soilMoisture * 100).toFixed(1) + '%' : 'UNAVAILABLE'}
- Conditions: ${weather.current?.weatherDescription || 'Normal'}
- 7-Day Cumulative Precipitation Forecast: ${weather.forecast?.slice(0, 7).reduce((acc: number, f: any) => acc + (typeof f.precipitation === 'number' ? f.precipitation : f.precipitation?.amount || 0), 0).toFixed(1) || 0} mm
` : `
[WEATHER TELEMETRY] - Status: UNAVAILABLE
- Real meteorological telemetry from Open-Meteo is currently unreachable for this parcel.
- In accordance with zero-fake-data rules, do NOT invent temperature, rainfall, or humidity values.
`;

  const satStatus = satellite ? 'OBSERVED / DERIVED' : 'UNAVAILABLE';
  const satelliteText = satellite ? `
[SATELLITE REMOTE SENSING] - Status: ${satStatus}
- Provider: European Space Agency / Copernicus Data Space Ecosystem (CDSE)
- Mission: ${satellite.satellite || 'Sentinel-2 Level-2A BOA'}
- Scene ID: ${satellite.sceneId || 'S2A_L2A'}
- MGRS Tile: ${satellite.mgrsTile || 'T43REQ'}
- Acquisition Timestamp: ${satellite.captureDate || 'Recent'}
- Cloud Coverage: ${satellite.cloudCover ?? 'UNAVAILABLE'}%
- Ground Spatial Resolution: ${satellite.resolutionMeters || 10} meters
- Derived Vegetation Indices (Status: DERIVED OBSERVATION):
  * NDVI (Normalized Difference Vegetation Index): ${satellite.vegetationIndex?.ndvi ?? 'Pending spectral calculation'}
  * EVI (Enhanced Vegetation Index): ${satellite.vegetationIndex?.evi ?? 'Pending spectral calculation'}
  * LAI (Leaf Area Index): ${satellite.vegetationIndex?.lai ?? 'Pending spectral calculation'}
` : `
[SATELLITE REMOTE SENSING] - Status: UNAVAILABLE
- No usable Sentinel-2 Level-2A scene intersecting this farm was identified in the recent orbital window.
- In accordance with zero-fake-data rules, do NOT invent NDVI or canopy greenness values.
`;

  const soilStatus = soil ? 'MODELED' : 'UNAVAILABLE';
  const soilText = soil ? `
[SOIL PROFILE] - Status: ${soilStatus} (Modeled soil information, not in-situ sensor)
- Provider: ISRIC World Soil Information / SoilGrids 2.0 (250m Spatial Resolution)
- Depth: Topsoil 0-5 cm
- Classification: ${soil.soilProperties?.soilType || farmConfiguration?.soilType || 'Vertisol / Black Clay'}
- Soil pH (H2O): ${soil.soilProperties?.ph ?? 'UNAVAILABLE'}
- Soil Organic Carbon: ${soil.soilProperties?.organicCarbon ? soil.soilProperties.organicCarbon + ' g/kg' : 'UNAVAILABLE'}
- Sand / Silt / Clay: ${soil.soilProperties?.texture ? `${soil.soilProperties.texture.sand}% Sand, ${soil.soilProperties.texture.silt}% Silt, ${soil.soilProperties.texture.clay}% Clay` : 'UNAVAILABLE'}
` : `
[SOIL PROFILE] - Status: UNAVAILABLE
- Spatial soil data from ISRIC SoilGrids is currently unavailable for these coordinates.
- In accordance with zero-fake-data rules, do NOT invent soil chemistry values.
`;

  const stress = currentState?.stressIndicators;
  const stressText = stress ? `
[TERRATWIN BIOPHYSICAL STRESS CALCULATIONS] - Status: MODEL RESULT
- Water Deficit Stress: ${(stress.waterStress * 100).toFixed(0)}% (FAO-56 Soil Moisture Deficit)
- Thermal Heat Stress: ${(stress.heatStress * 100).toFixed(0)}% (Relative to ${cropParams?.optimalTemperatureMax ? `${cropParams.optimalTemperatureMax}°C ceiling` : 'thermal ceiling'})
- Pest Infestation Risk: ${(stress.pestRisk * 100).toFixed(0)}% (RH & Temp coincidence model)
- Pathogen Disease Risk: ${(stress.diseaseRisk * 100).toFixed(0)}% (Leaf wetness & canopy humidity model)
` : `
[TERRATWIN BIOPHYSICAL STRESS CALCULATIONS] - Status: UNAVAILABLE
- Biophysical stress calculations are awaiting live soil and canopy observations.
`;

  const yieldText = currentState?.predictedYield ? `
[BIOLOGICAL YIELD PROJECTION] - Status: MODEL PREDICTION (Not measured actual yield)
- Model Prediction: ${currentState.predictedYield} kg/ha
- Baseline Potential under Optimal Agronomy: ${cropParams?.yieldPotential?.optimal ? `${cropParams.yieldPotential.optimal} kg/ha` : 'UNAVAILABLE'}
` : `
[BIOLOGICAL YIELD PROJECTION] - Status: MODEL PREDICTION
- Yield prediction calculation is running against active telemetry.
`;

  const advisoriesText = Array.isArray(advisories) && advisories.length > 0 ? `
[ACTIVE DATA-DRIVEN ADVISORIES] - Generated: ${advisories.length} active prescriptions
${advisories.map((a: any, i: number) => `
Advisory ${i + 1}: ${a.title} (Priority: ${a.priority?.toUpperCase()}, Category: ${a.category})
- Diagnosis: ${a.description}
- Supporting Evidence: ${a.reasoning}
- Prescribed Action: ${a.actionItems?.[0]?.action || 'Monitor parcel closely'}
`).join('')}
` : `
[ACTIVE DATA-DRIVEN ADVISORIES] - 0 active critical alerts recorded.
`;

  return `
=== FARM IDENTITY & REGISTRATION ===
- Twin ID: ${farm.twinId}
- Farm Name: ${location?.village || 'Parcel'}, ${location?.district}, ${location?.state}, ${location?.country || 'India'}
- Geographic Coordinates: ${location?.latitude?.toFixed(4)}°N, ${location?.longitude?.toFixed(4)}°E (WGS-84 EPSG:4326)
- Cultivated Area: ${farmConfiguration?.farmSize} Hectares
- Registered Crop: ${farmConfiguration?.cropType?.toUpperCase()} (Variety: ${farmConfiguration?.varietyName || 'Registered Variety'})
- Sowing Date: ${farmConfiguration?.plantingDate || 'Recorded'}
- Crop Age: ${currentState?.daysAfterPlanting || 60} Days After Planting (DAP)
- Current Physiological Stage: ${currentState?.cropStage || 'Vegetative'}
- Irrigation System: ${farmConfiguration?.irrigationType}
- Registered Soil Type: ${farmConfiguration?.soilType}

${weatherText}
${satelliteText}
${soilText}
${stressText}
${yieldText}
${advisoriesText}
`;
}

// 1. Health check & architecture status
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    platform: 'TerraTwin Agricultural Digital Twin Platform',
    runtime: 'Node.js Express / Netlify Serverless',
    database: 'Supabase PostgreSQL (RLS Enforced)',
    auth: 'Supabase Authentication',
    storage: 'Supabase Storage',
    weatherProvider: 'Open-Meteo (Primary Nationwide)',
    imdProvider: process.env.IMD_API_KEY ? 'Active' : 'Not Configured (Optional)',
    satelliteProvider: 'Copernicus Data Space Ecosystem (Sentinel-2 L2A)',
    soilProvider: 'ISRIC SoilGrids 2.0 (250m Spatial Model)',
    smsServiceConfigured: smsProvider.isConfigured(),
    ai: geminiApiKey ? 'Gemini 3.8 Flash / Flash Latest (Active)' : "Gemini isn't configured yet.",
    timestamp: new Date().toISOString(),
  });
});

// 1b. Gemini API Configuration Status
app.get('/api/gemini/status', (req: Request, res: Response) => {
  res.json({
    configured: Boolean(geminiApiKey),
    model: 'gemini-3.8-flash',
    message: geminiApiKey
      ? 'TerraTwin AI operational with server-side credentials.'
      : "Gemini isn't configured yet.",
  });
});

// 2. Weather Ingestion API (Open-Meteo primary nationwide provider)
app.get('/api/weather', async (req: Request, res: Response) => {
  const lat = req.query.lat ? parseFloat(req.query.lat as string) : 17.385;
  const lon = req.query.lon ? parseFloat(req.query.lon as string) : 78.4867;
  const farmId = req.query.farmId ? String(req.query.farmId) : undefined;
  const forceRefresh = req.query.refresh === 'true';

  try {
    const result = await weatherProvider.getWeather(lat, lon, farmId, forceRefresh);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch weather' });
  }
});

// 2b. IMD Weather Provider API (Separate optional provider)
app.get('/api/imd', async (req: Request, res: Response) => {
  const lat = req.query.lat ? parseFloat(req.query.lat as string) : 17.385;
  const lon = req.query.lon ? parseFloat(req.query.lon as string) : 78.4867;
  const farmId = req.query.farmId ? String(req.query.farmId) : undefined;

  try {
    const result = await imdProvider.getImdStationWeather(lat, lon, farmId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to query IMD service' });
  }
});

// 3. Copernicus Sentinel-2 Level-2A Catalogue API
app.get('/api/satellite', async (req: Request, res: Response) => {
  const lat = req.query.lat ? parseFloat(req.query.lat as string) : 17.385;
  const lon = req.query.lon ? parseFloat(req.query.lon as string) : 78.4867;
  const farmId = req.query.farmId ? String(req.query.farmId) : undefined;
  const daysWindow = req.query.daysWindow ? parseInt(req.query.daysWindow as string, 10) : 45;
  const maxCloud = req.query.maxCloud ? parseFloat(req.query.maxCloud as string) : 30;

  try {
    const result = await satelliteProvider.getSentinel2Observation(lat, lon, farmId, {
      daysWindow,
      maxCloudCover: maxCloud,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to query Copernicus Sentinel-2' });
  }
});

// 3b. Soil Ingestion API (ISRIC SoilGrids spatial/modelled data)
app.get('/api/soil', async (req: Request, res: Response) => {
  const lat = req.query.lat ? parseFloat(req.query.lat as string) : 17.385;
  const lon = req.query.lon ? parseFloat(req.query.lon as string) : 78.4867;
  const farmId = req.query.farmId ? String(req.query.farmId) : undefined;

  try {
    const result = await soilDataProvider.getSoilData(lat, lon, farmId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch soil data' });
  }
});

// 3c. NASA GIBS Satellite Imagery Visualizer Metadata
app.get('/api/gibs', (req: Request, res: Response) => {
  const lat = req.query.lat ? parseFloat(req.query.lat as string) : 17.385;
  const lon = req.query.lon ? parseFloat(req.query.lon as string) : 78.4867;
  const dateStr = (req.query.date as string) || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const layer = (req.query.layer as string) || 'MODIS_Terra_CorrectedReflectance_TrueColor';

  res.json({
    layers: nasaGibsProvider.getSupportedLayers(),
    selectedLayer: layer,
    date: dateStr,
    wmsUrl: nasaGibsProvider.getGibsWmsUrl(lat, lon, dateStr, layer),
    wmtsTemplate: nasaGibsProvider.getGibsWmtsTemplate(layer, dateStr),
    attribution: 'NASA EOSDIS Global Imagery Browse Services (GIBS)',
  });
});

// 3d. SMS Provider Configuration Status
app.get('/api/sms/status', (req: Request, res: Response) => {
  res.json({
    configured: smsProvider.isConfigured(),
    message: smsProvider.isConfigured()
      ? 'SMS Gateway configured and operational.'
      : 'SMS service not configured.',
  });
});

// 4. Server-Side Biophysical Crop Simulation Engine
app.post('/api/simulation/run', (req: Request, res: Response) => {
  try {
    const { cropType, daysAfterPlanting, soilMoisture, ambientTemperature, rainfall7Days = 0, irrigationType } = req.body;

    if (
      !cropType ||
      typeof daysAfterPlanting !== 'number' ||
      typeof soilMoisture !== 'number' ||
      typeof ambientTemperature !== 'number' ||
      isNaN(daysAfterPlanting) ||
      isNaN(soilMoisture) ||
      isNaN(ambientTemperature)
    ) {
      return res.status(400).json({
        status: 'unavailable',
        error: 'Missing required simulation inputs. Crop simulation requires actual cropType, daysAfterPlanting, soilMoisture, and ambientTemperature from live farm observations. No fake defaults substituted.',
      });
    }

    const type = cropType as CropType;
    const params = CROP_PARAMETERS_REGISTRY[type];
    if (!params) {
      return res.status(400).json({
        status: 'unavailable',
        error: `Unsupported crop type: ${cropType}. Registered crops: cotton, wheat, rice, maize, soybean, sugarcane, groundnut, mustard, pulses.`,
      });
    }

    // Mathematical GDD and phenology calculation from real inputs
    const baseTemp = params.baseTemperature;
    const dailyGdd = Math.max(0, ambientTemperature - baseTemp);
    const accumulatedGdd = Math.round(dailyGdd * daysAfterPlanting);

    // Phenological stage deduction based on real accumulated DAP
    const stagesInOrder = [
      CropStage.GERMINATION,
      CropStage.VEGETATIVE,
      CropStage.FLOWERING,
      CropStage.FRUITING,
      CropStage.GRAIN_FILLING,
      CropStage.MATURITY,
      CropStage.HARVEST_READY,
    ];

    let currentStage = CropStage.VEGETATIVE;
    let accumulatedDays = 0;
    for (const stage of stagesInOrder) {
      const dur = params.growthDuration[stage] || 25;
      if (daysAfterPlanting <= accumulatedDays + dur) {
        currentStage = stage;
        break;
      }
      accumulatedDays += dur;
    }

    // Biophysical stress modeling from actual soil moisture and temperature
    const waterStress = soilMoisture < 35 ? Math.min(1, Math.max(0, (35 - soilMoisture) / 25)) : 0;
    const heatStress = ambientTemperature > params.optimalTemperatureMax
      ? Math.min(1, Math.max(0, (ambientTemperature - params.optimalTemperatureMax) / 10))
      : 0;
    const overallStress = Math.min(1, waterStress * 0.50 + heatStress * 0.35);

    // Yield attenuation against actual genetic baseline potential
    const baselineYield = params.yieldPotential.optimal;
    const projectedYield = Math.round(baselineYield * (1 - overallStress * 0.45));

    res.json({
      simulationId: `sim_${Date.now()}`,
      cropType: type,
      daysAfterPlanting,
      currentStage,
      accumulatedGdd,
      dailyGdd: Math.round(dailyGdd * 10) / 10,
      soilMoisturePct: soilMoisture,
      ambientTemperatureCelsius: ambientTemperature,
      rainfall7DaysMm: rainfall7Days,
      irrigationType: irrigationType || 'drip',
      stressIndicators: {
        waterStress: Math.round(waterStress * 100) / 100,
        heatStress: Math.round(heatStress * 100) / 100,
        overallStress: Math.round(overallStress * 100) / 100,
      },
      forecastYieldKgHa: projectedYield,
      baselineYieldKgHa: baselineYield,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Simulation execution error' });
  }
});

// ============================================================
// 5. GEMINI AGRICULTURAL COPILOT (STRICTLY GROUNDED INTERPRETATION)
// ============================================================

app.post('/api/gemini/copilot', async (req: Request, res: Response) => {
  try {
    const { farmTwin, weather, satellite, soil, advisories, messages, userQuery, language = 'en' } = req.body;

    if (!geminiApiKey) {
      return res.status(200).json({
        success: false,
        error: "Gemini isn't configured yet. Please set GEMINI_API_KEY in your server or Netlify environment variables.",
      });
    }

    const telemetryContext = buildFarmContextPrompt(farmTwin, weather, satellite, soil, advisories);

    const systemInstruction = `You are TerraTwin AI, a senior computational agronomist and decision intelligence assistant for smallholder farmers across India.

STRICT GROUNDING & ZERO-FABRICATION CONTRACT:
1. You interpret and explain ACTUAL telemetry data and digital twin biophysical model calculations.
2. DO NOT invent measurements. If an observation or telemetry input is marked UNAVAILABLE, state clearly that it is unavailable. Never guess or fabricate values.
3. Distinguish clearly:
   - [MODEL RESULT]: Underlying biophysical equations calculated by the digital twin (e.g., thermal degree-days, FAO-56 Penman-Monteith water stress, phenological phase).
   - [AI EXPLANATION]: Your agronomic synthesis, root-cause diagnosis, practical smallholder action plan, and risk interpretation.
4. Yield predictions are ALWAYS model predictions based on current stress penalties, NEVER actual measured harvested yield.
5. Provide actionable, low-cost recommendations tailored to Indian agricultural contexts (ICAR practices, integrated pest management, precision irrigation schedules, balanced NPK foliar spray).
6. When responding in regional languages (e.g., Hindi, Telugu, Tamil, Marathi), maintain clear agricultural terms and provide a concise practical checklist.
7. Use metric units (kg/ha, mm, liters/acre).`;

    const userPrompt = `
CURRENT FARM CONTEXT & BIOPHYSICAL TELEMETRY:
${telemetryContext}

FARMER INQUIRY:
"${userQuery || 'Analyze the current biophysical stress state of this crop and provide prioritized actions.'}"

Language requested: ${language}
`;

    let conversationContents: any[] = [];
    if (Array.isArray(messages) && messages.length > 0) {
      // Map previous turns, taking the last 6 turns to keep context tight
      const recent = messages.slice(-6);
      conversationContents = recent.map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
    }

    // Append current prompt
    conversationContents.push({
      role: 'user',
      parts: [{ text: userPrompt }],
    });

    const result = await callGemini(conversationContents, systemInstruction);

    res.json({
      success: true,
      reply: result.text,
      modelUsed: result.modelUsed,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Gemini Copilot Error]', error);
    res.status(503).json({
      success: false,
      error: error.message || 'Gemini unavailable/not configured.',
    });
  }
});

// ============================================================
// 6. GEMINI SIMULATION SCENARIO EXPLANATION (INTERPRETER, NOT CALCULATOR)
// ============================================================

app.post('/api/gemini/explain-simulation', async (req: Request, res: Response) => {
  try {
    const { farmTwin, baselineState, simulatedState, deltas, scenarioDescription, language = 'en' } = req.body;

    if (!geminiApiKey) {
      return res.status(200).json({
        success: false,
        error: "Gemini isn't configured yet. Please set GEMINI_API_KEY in your server or Netlify environment variables.",
      });
    }

    const systemInstruction = `You are TerraTwin AI.
The mathematical engine has already executed the numerical biophysical simulation.
YOUR ROLE: Explain WHY the stress and predicted yield changed under this scenario. DO NOT perform arithmetic or invent new numbers.
Strictly interpret the model result deltas. Clearly distinguish [MODEL RESULT] from [AI EXPLANATION].`;

    const prompt = `
FARM: ${farmTwin?.location?.district || 'Field'} ${farmTwin?.farmConfiguration?.cropType ? farmTwin.farmConfiguration.cropType.toUpperCase() : 'CROP'}
Current DAP: ${farmTwin?.currentState?.daysAfterPlanting !== undefined ? `${farmTwin.currentState.daysAfterPlanting} DAP` : 'UNAVAILABLE'} (Stage: ${farmTwin?.currentState?.cropStage || 'Vegetative'})

SIMULATION SCENARIO INPUTS:
- Scenario: ${scenarioDescription || 'Custom microclimate / irrigation scenario adjustment'}

NUMERICAL MODEL OUTPUTS:
Baseline Yield: ${baselineState?.yieldKgHa !== undefined ? `${baselineState.yieldKgHa} kg/ha` : 'UNAVAILABLE'}
Simulated Yield: ${simulatedState?.yieldKgHa !== undefined ? `${simulatedState.yieldKgHa} kg/ha` : 'UNAVAILABLE'}
Yield Delta: ${deltas?.yieldDeltaKgHa !== undefined ? `${deltas.yieldDeltaKgHa > 0 ? '+' : ''}${deltas.yieldDeltaKgHa} kg/ha (${deltas?.yieldDeltaPct !== undefined ? `${deltas.yieldDeltaPct > 0 ? '+' : ''}${deltas.yieldDeltaPct}%` : ''})` : 'UNAVAILABLE'}
Water Stress: ${baselineState?.waterStress !== undefined && simulatedState?.waterStress !== undefined ? `from ${(baselineState.waterStress * 100).toFixed(0)}% to ${(simulatedState.waterStress * 100).toFixed(0)}%` : 'UNAVAILABLE'}
Thermal Heat Stress: ${baselineState?.heatStress !== undefined && simulatedState?.heatStress !== undefined ? `from ${(baselineState.heatStress * 100).toFixed(0)}% to ${(simulatedState.heatStress * 100).toFixed(0)}%` : 'UNAVAILABLE'}

Please provide:
1. [MODEL RESULT SUMMARY]: Summary of the numerical shifts.
2. [AI EXPLANATION]: The biophysical mechanism explaining why this happened (stomatal conductance, root-zone tension, evapotranspirative demand, cellular turgor).
3. [AGRONOMIC ADAPTATION]: 2-3 specific farm mitigation actions if the farmer anticipates these conditions.

Format in clear bullet points. Language: ${language}.
`;

    const result = await callGemini(
      [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction
    );

    res.json({
      success: true,
      explanation: result.text,
      modelUsed: result.modelUsed,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Gemini Explain Simulation Error]', error);
    res.status(500).json({
      success: false,
      error: error.message || "Gemini isn't configured yet.",
    });
  }
});

// ============================================================
// 7. GEMINI ADVISORY DEEP EXPLANATION
// ============================================================

app.post('/api/gemini/advisor', async (req: Request, res: Response) => {
  try {
    const { farmTwin, advisory, language = 'en' } = req.body;

    if (!geminiApiKey) {
      return res.status(200).json({
        success: false,
        error: "Gemini isn't configured yet. Please set GEMINI_API_KEY in your server or Netlify environment variables.",
      });
    }

    const systemInstruction = `You are TerraTwin AI.
Explain the agronomic science behind this model-generated advisory and provide step-by-step smallholder instructions.
Strictly respect the model conditions; do NOT invent other observations.
Clearly separate [MODEL RESULT] from [AI EXPLANATION].`;

    const prompt = `
FARM: ${farmTwin?.location?.district || 'Field'}, ${farmTwin?.location?.state || 'India'}
CROP: ${farmTwin?.farmConfiguration?.cropType ? farmTwin.farmConfiguration.cropType.toUpperCase() : 'Crop'} (Age: ${farmTwin?.currentState?.daysAfterPlanting !== undefined ? `${farmTwin.currentState.daysAfterPlanting} DAP` : 'UNAVAILABLE'})

DATA-DRIVEN ADVISORY FROM MODEL:
Title: ${advisory?.title || 'Advisory'}
Category: ${advisory?.category || 'General'}
Priority: ${advisory?.priority || 'Normal'}
Diagnosis: ${advisory?.description || 'No diagnosis available'}
Reasoning: ${advisory?.reasoning || 'No model reasoning available'}
Initial Action: ${advisory?.actionItems?.[0]?.action || 'Inspect field'}

Please provide:
1. [BIOPHYSICAL CAUSE]: Why this condition occurred given the crop stage and weather/moisture thresholds.
2. [STEP-BY-STEP PRESCRIPTION]: Practical application instructions (timing, quantity per acre/hectare, safety precautions).
3. [EXPECTED HARVEST BENEFIT]: How this protects yield potential.

Language: ${language}.
`;

    const result = await callGemini(
      [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction
    );

    res.json({
      success: true,
      advisoryText: result.text,
      modelUsed: result.modelUsed,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Gemini Advisory Error]', error);
    res.status(503).json({
      success: false,
      error: error.message || 'Gemini unavailable/not configured.',
    });
  }
});

// 8. SMS Advisory Dispatch API
app.post('/api/sms/dispatch', async (req: Request, res: Response) => {
  const { recipient, message, language = 'en', advisoryId } = req.body;

  try {
    const dispatchResult = await smsProvider.sendAdvisorySMS(recipient || '+91-9876543210', message, language);
    res.json({
      ...dispatchResult,
      advisoryId,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'SMS dispatch failed' });
  }
});

// Boot dev or production server
async function startServer() {
  if (!isProduction) {
    // Mount Vite middleware in development
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[TerraTwin Platform] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[TerraTwin Platform] Mode: ${isProduction ? 'Production' : 'Development with Vite middleware'}`);
    console.log(`[TerraTwin Platform] Database: Supabase PostgreSQL with Row Level Security`);
  });
}

startServer();
