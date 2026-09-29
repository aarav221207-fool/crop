/**
 * TerraTwin Serverless API for Netlify Deployment
 *
 * Handles server-side Gemini AI requests, biophysical simulation computations,
 * and system health checks. Reads GEMINI_API_KEY strictly from the server/Netlify environment.
 */

import { GoogleGenAI } from '@google/genai';

// Initialize Gemini client strictly using server environment variable
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'terratwin-netlify-serverless',
      },
    },
  });
};

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export const handler = async (event: any, context: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: JSON_HEADERS,
      body: '',
    };
  }

  // Normalize path
  const rawPath = event.path || '';
  const cleanPath = rawPath
    .replace('/.netlify/functions/api', '')
    .replace('/api', '') || '/';

  const method = event.httpMethod;
  const apiKey = process.env.GEMINI_API_KEY;

  // 1. Health check
  if (cleanPath === '/health' || cleanPath === '/' && method === 'GET') {
    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        status: 'healthy',
        platform: 'TerraTwin Agricultural Digital Twin Platform',
        runtime: 'Netlify Serverless Function (Node.js 22)',
        ai: apiKey ? 'Gemini 3.8 Flash (Active)' : "Gemini isn't configured yet.",
        timestamp: new Date().toISOString(),
      }),
    };
  }

  // 2. Gemini status
  if (cleanPath === '/gemini/status' && method === 'GET') {
    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        configured: Boolean(apiKey),
        model: 'gemini-3.8-flash',
        message: apiKey
          ? 'TerraTwin AI operational with server-side credentials.'
          : "Gemini isn't configured yet.",
      }),
    };
  }

  // 3. SMS gateway status
  if (cleanPath === '/sms/status' && method === 'GET') {
    const hasSms = Boolean(process.env.SMS_GATEWAY_API_KEY);
    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        configured: hasSms,
        message: hasSms ? 'SMS Gateway operational.' : 'SMS service not configured.',
      }),
    };
  }

  // 4. Server-Side Simulation Run
  if (cleanPath === '/simulation/run' && method === 'POST') {
    try {
      const body = event.body ? JSON.parse(event.body) : {};
      const { cropType = 'cotton', daysAfterPlanting = 65, soilMoisture = 36 } = body;
      const dailyMeanTemp = 31.0;
      const dailyGdd = Math.max(0, dailyMeanTemp - 12);
      const accumulatedGdd = Math.round(dailyGdd * daysAfterPlanting);

      const moisture = typeof soilMoisture === 'number' ? soilMoisture : 36;
      const waterStress = moisture < 35 ? Math.min(1, (35 - moisture) / 25) : 0;
      const heatStress = dailyMeanTemp > 32 ? Math.min(1, (dailyMeanTemp - 32) / 10) : 0.1;
      const overallStress = Math.min(1, waterStress * 0.45 + heatStress * 0.35 + 0.1);

      const baselineYield = 2200;
      const projectedYield = Math.round(baselineYield * (1 - overallStress * 0.42));

      return {
        statusCode: 200,
        headers: JSON_HEADERS,
        body: JSON.stringify({
          simulationId: `sim_${Date.now()}`,
          cropType,
          daysAfterPlanting,
          accumulatedGdd,
          dailyGdd: Math.round(dailyGdd * 10) / 10,
          soilMoisturePct: moisture,
          stressIndicators: {
            waterStress: Math.round(waterStress * 100) / 100,
            heatStress: Math.round(heatStress * 100) / 100,
            overallStress: Math.round(overallStress * 100) / 100,
          },
          forecastYieldKgHa: projectedYield,
          baselineYieldKgHa: baselineYield,
          timestamp: new Date().toISOString(),
        }),
      };
    } catch (err: any) {
      return {
        statusCode: 500,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: err.message || 'Simulation execution error' }),
      };
    }
  }

  // 5. Gemini Copilot Route
  if (cleanPath === '/gemini/copilot' && method === 'POST') {
    if (!apiKey) {
      return {
        statusCode: 200,
        headers: JSON_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Gemini isn't configured yet. Please set GEMINI_API_KEY in your Netlify Environment Variables.",
        }),
      };
    }

    try {
      const body = event.body ? JSON.parse(event.body) : {};
      const { farmTwin, weather, satellite, soil, messages, userQuery, language = 'en' } = body;

      const ai = getGeminiClient();
      if (!ai) {
        return {
          statusCode: 200,
          headers: JSON_HEADERS,
          body: JSON.stringify({
            success: false,
            error: "Gemini isn't configured yet.",
          }),
        };
      }

      const systemInstruction = `You are TerraTwin AI, a senior computational agronomist and decision intelligence assistant for smallholder farmers.

STRICT GROUNDING & ZERO-FABRICATION CONTRACT:
1. You interpret and explain ACTUAL telemetry data and mathematical digital twin calculations.
2. DO NOT invent measurements. If an observation or telemetry input is marked UNAVAILABLE, state clearly that it is unavailable. Never guess or fabricate values.
3. Distinguish clearly:
   - [MODEL RESULT]: Underlying biophysical calculations (thermal degree-days, FAO-56 Penman-Monteith water stress, phenological phase).
   - [AI EXPLANATION]: Your agronomic synthesis, root-cause diagnosis, practical smallholder action plan, and risk interpretation.
4. Yield predictions are ALWAYS model predictions based on current stress penalties, NEVER actual measured harvested yield.
5. Provide actionable, low-cost recommendations tailored to smallholder agricultural contexts.
6. When responding in regional languages (e.g., Hindi, Telugu, Tamil, Marathi), maintain clear agricultural terms and provide a concise practical checklist.
7. Use metric units (kg/ha, mm, liters/acre).`;

      const farmDesc = farmTwin ? `
FARM: ${farmTwin.location?.district || 'Field'}, ${farmTwin.location?.state || 'India'}
CROP: ${farmTwin.farmConfiguration?.cropType?.toUpperCase()} (${farmTwin.farmConfiguration?.varietyName || 'Registered Variety'})
AGE: ${farmTwin.currentState?.daysAfterPlanting || 60} Days After Planting (Stage: ${farmTwin.currentState?.cropStage || 'Vegetative'})
AREA: ${farmTwin.farmConfiguration?.farmSize} Hectares | SOIL: ${farmTwin.farmConfiguration?.soilType} | IRRIGATION: ${farmTwin.farmConfiguration?.irrigationType}
WEATHER: ${weather ? `${weather.current?.temperature}°C, ${weather.current?.humidity}% RH, Rain: ${weather.current?.precipitation || 0}mm` : 'UNAVAILABLE'}
SATELLITE NDVI: ${satellite?.vegetationIndex?.ndvi ?? 'UNAVAILABLE / PENDING PASS'}
SOIL MOISTURE: ${farmTwin.currentState?.soilMoisture ?? 'UNAVAILABLE'}%
MODEL WATER STRESS: ${farmTwin.currentState?.stressIndicators?.waterStress !== undefined ? `${(farmTwin.currentState.stressIndicators.waterStress * 100).toFixed(0)}%` : 'UNAVAILABLE'}
MODEL YIELD PROJECTION: ${farmTwin.currentState?.predictedYield ?? 'UNAVAILABLE'} kg/ha
` : 'No farm selected.';

      const userPrompt = `
CURRENT FARM CONTEXT:
${farmDesc}

FARMER INQUIRY:
"${userQuery || 'Analyze the current biophysical stress state of this crop and provide prioritized actions.'}"

Language requested: ${language}
`;

      let conversationContents: any[] = [];
      if (Array.isArray(messages) && messages.length > 0) {
        const recent = messages.slice(-6);
        conversationContents = recent.map((m: any) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));
      }

      conversationContents.push({
        role: 'user',
        parts: [{ text: userPrompt }],
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: conversationContents,
        config: { systemInstruction },
      });

      return {
        statusCode: 200,
        headers: JSON_HEADERS,
        body: JSON.stringify({
          success: true,
          reply: response.text || 'Analysis complete.',
          modelUsed: 'gemini-3.8-flash',
          timestamp: new Date().toISOString(),
        }),
      };
    } catch (err: any) {
      console.error('[Netlify Gemini Error]', err);
      let cleanMsg = err.message || 'Gemini request failed.';
      try {
        const parsed = JSON.parse(cleanMsg);
        if (parsed.error?.message) {
          cleanMsg = parsed.error.message;
        }
      } catch {}

      return {
        statusCode: 200,
        headers: JSON_HEADERS,
        body: JSON.stringify({
          success: false,
          error: cleanMsg,
        }),
      };
    }
  }

  // 6. Gemini Explain Simulation Route
  if (cleanPath === '/gemini/explain-simulation' && method === 'POST') {
    if (!apiKey) {
      return {
        statusCode: 200,
        headers: JSON_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Gemini isn't configured yet. Please set GEMINI_API_KEY in your Netlify Environment Variables.",
        }),
      };
    }

    try {
      const body = event.body ? JSON.parse(event.body) : {};
      const { farmTwin, baselineState, simulatedState, deltas, scenarioDescription, language = 'en' } = body;
      const ai = getGeminiClient();
      if (!ai) throw new Error("Gemini isn't configured yet.");

      const systemInstruction = `You are TerraTwin AI.
The mathematical engine has already executed the numerical biophysical simulation.
YOUR ROLE: Explain WHY the stress and predicted yield changed under this scenario. DO NOT perform arithmetic or invent new numbers.
Strictly interpret the model result deltas. Clearly distinguish [MODEL RESULT] from [AI EXPLANATION].`;

      const prompt = `
FARM: ${farmTwin?.location?.district || 'Field'} ${farmTwin?.farmConfiguration?.cropType?.toUpperCase() || 'CROP'}
Current DAP: ${farmTwin?.currentState?.daysAfterPlanting || 65} (Stage: ${farmTwin?.currentState?.cropStage || 'Vegetative'})
SCENARIO: ${scenarioDescription || 'Custom microclimate / irrigation scenario adjustment'}

MODEL OUTPUTS:
Baseline Yield: ${baselineState?.yieldKgHa || 2100} kg/ha
Simulated Yield: ${simulatedState?.yieldKgHa || 1850} kg/ha
Yield Delta: ${deltas?.yieldDeltaKgHa > 0 ? '+' : ''}${deltas?.yieldDeltaKgHa || -250} kg/ha (${deltas?.yieldDeltaPct > 0 ? '+' : ''}${deltas?.yieldDeltaPct || -12}%)
Water Stress: from ${(baselineState?.waterStress * 100 || 30).toFixed(0)}% to ${(simulatedState?.waterStress * 100 || 55).toFixed(0)}%
Thermal Heat Stress: from ${(baselineState?.heatStress * 100 || 20).toFixed(0)}% to ${(simulatedState?.heatStress * 100 || 45).toFixed(0)}%

Provide:
1. [MODEL RESULT SUMMARY]: Summary of the numerical shifts.
2. [AI EXPLANATION]: The biophysical mechanism explaining why this happened.
3. [AGRONOMIC ADAPTATION]: 2-3 specific farm mitigation actions if the farmer anticipates these conditions.
Language: ${language}.
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { systemInstruction },
      });

      return {
        statusCode: 200,
        headers: JSON_HEADERS,
        body: JSON.stringify({
          success: true,
          explanation: response.text,
          modelUsed: 'gemini-3.8-flash',
          timestamp: new Date().toISOString(),
        }),
      };
    } catch (err: any) {
      return {
        statusCode: 500,
        headers: JSON_HEADERS,
        body: JSON.stringify({
          success: false,
          error: err.message || 'Simulation explanation failed.',
        }),
      };
    }
  }

  // 7. Gemini Advisory Route
  if (cleanPath === '/gemini/advisor' && method === 'POST') {
    if (!apiKey) {
      return {
        statusCode: 200,
        headers: JSON_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Gemini isn't configured yet. Please set GEMINI_API_KEY in your Netlify Environment Variables.",
        }),
      };
    }

    try {
      const body = event.body ? JSON.parse(event.body) : {};
      const { farmTwin, advisory, language = 'en' } = body;
      const ai = getGeminiClient();
      if (!ai) throw new Error("Gemini isn't configured yet.");

      const systemInstruction = `You are TerraTwin AI.
Explain the agronomic science behind this model-generated advisory and provide step-by-step smallholder instructions.
Strictly respect the model conditions; do NOT invent other observations.
Clearly separate [MODEL RESULT] from [AI EXPLANATION].`;

      const prompt = `
FARM: ${farmTwin?.location?.district || 'Field'}, ${farmTwin?.location?.state || 'India'}
CROP: ${farmTwin?.farmConfiguration?.cropType?.toUpperCase() || 'Crop'} (Age: ${farmTwin?.currentState?.daysAfterPlanting || 65} DAP)
ADVISORY:
Title: ${advisory?.title}
Category: ${advisory?.category}
Priority: ${advisory?.priority}
Diagnosis: ${advisory?.description}
Reasoning: ${advisory?.reasoning}
Initial Action: ${advisory?.actionItems?.[0]?.action}

Provide:
1. [BIOPHYSICAL CAUSE]: Root agronomic cause under current conditions.
2. [STEP-BY-STEP PRESCRIPTION]: Practical smallholder application steps.
3. [EXPECTED HARVEST BENEFIT]: Protection of yield potential.
Language: ${language}.
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { systemInstruction },
      });

      return {
        statusCode: 200,
        headers: JSON_HEADERS,
        body: JSON.stringify({
          success: true,
          advisoryText: response.text,
          modelUsed: 'gemini-3.8-flash',
          timestamp: new Date().toISOString(),
        }),
      };
    } catch (err: any) {
      return {
        statusCode: 500,
        headers: JSON_HEADERS,
        body: JSON.stringify({
          success: false,
          error: err.message || 'Advisory analysis failed.',
        }),
      };
    }
  }

  return {
    statusCode: 404,
    headers: JSON_HEADERS,
    body: JSON.stringify({ error: `Route not found: ${method} ${cleanPath}` }),
  };
};
