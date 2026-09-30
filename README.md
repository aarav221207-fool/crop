# 🌱 TerraTwin — Agricultural Digital Twin Platform

> **An agricultural digital twin that combines real farm data, environmental observations, crop modelling, and AI-assisted decision support.**

[![Vite](https://img.shields.io/badge/Frontend-Vite%208%20%2B%20React%2019-646CFF?logo=vite)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript%205.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS%20v4-38B2AC?logo=tailwindcss)](https://tailwindcss.com/)
[![Netlify](https://img.shields.io/badge/Deployment-Netlify%20Serverless%20(Node%2022)-00C7B7?logo=netlify)](https://www.netlify.com/)
[![Supabase](https://img.shields.io/badge/Database-Supabase%20PostgreSQL%20(RLS)-3ECF8E?logo=supabase)](https://supabase.com/)
[![Google Gemini](https://img.shields.io/badge/AI-Gemini%203.8%20Flash-4285F4?logo=google)](https://ai.google.dev/)

---

## 📌 Overview

**TerraTwin** creates a dynamic digital representation of agricultural parcels for smallholder farmers and agronomists. By coupling genuine satellite remote sensing, numerical weather predictions, and pedological models with deterministic crop science, TerraTwin monitors crop progress, detects biophysical stress, and simulates what-if scenarios without requiring in-situ hardware sensors.

### The Conceptual Pipeline

```
  ┌───────────────────────────────────────────────────────────────┐
  │                           1. FARM                             │
  │     Parcel boundary (GeoJSON), crop type, sowing date, size   │
  └───────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
  ┌───────────────────────────────────────────────────────────────┐
  │                 2. REAL-WORLD OBSERVATIONS                    │
  │   • Open-Meteo (hourly agro-meteorology, soil moisture/temp)  │
  │   • Copernicus CDSE (Sentinel-2 L2A BOA satellite scenes)     │
  │   • ISRIC SoilGrids 2.0 (250m spatial topsoil profile)        │
  │   • NASA GIBS (True-color MODIS/VIIRS satellite imagery)      │
  └───────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
  ┌───────────────────────────────────────────────────────────────┐
  │                       3. DATA FUSION                          │
  │  Temporal-spatial alignment, provenance tagging, quality check │
  └───────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
  ┌───────────────────────────────────────────────────────────────┐
  │                    4. CROP DIGITAL TWIN                       │
  │    Growing Degree Days (GDD) accumulation, phenological stage │
  └───────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
  ┌───────────────────────────────────────────────────────────────┐
  │                  5. STRESS & STATE ANALYSIS                   │
  │      Water deficit (FAO-56), thermal stress, pest/disease     │
  └───────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
  ┌───────────────────────────────────────────────────────────────┐
  │                     6. YIELD MODELLING                        │
  │ Deterministic penalty attenuation against genetic potential   │
  └───────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
  ┌───────────────────────────────────────────────────────────────┐
  │              7. AI-ASSISTED INTERPRETATION (LLM)              │
  │ Grounded synthesis of biophysical outputs via Gemini 3.8 Flash│
  └───────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
  ┌───────────────────────────────────────────────────────────────┐
  │              8. AGRICULTURAL DECISION SUPPORT                 │
  │  Actionable ICAR prescriptions, scenario simulations, SMS     │
  └───────────────────────────────────────────────────────────────┘
```

---

## 🔬 Core Architectural Distinction: Three Separate Layers

A fundamental principle of TerraTwin is the strict boundary between observations, mathematical modeling, and generative AI:

| Layer | Responsibility | What It Does | What It NEVER Does |
| :--- | :--- | :--- | :--- |
| **1. Real Observations** | External Data Ingestion | Queries genuine external APIs (Open-Meteo, Copernicus, ISRIC SoilGrids) for real telemetry and persists user farm records in Supabase. | Never generates fake mock data or fabricates readings if an API is unreachable. |
| **2. Crop Model** | Deterministic Biophysical Computation | Computes thermal degree-days (GDD), phenological stages, FAO-56 moisture deficit stress, thermal stress, and attenuated yield potential using ICAR/FAO agronomic formulas. | Does NOT use LLMs or generative AI for numerical arithmetic or physics calculations. |
| **3. Generative AI** | Explanation & Decision Support | Interprets the structured outputs of the crop model, explains *why* biophysical stresses occurred, diagnoses root causes, and generates actionable advice in 10 regional languages. | Does NOT invent measurements or calculate yield predictions directly. |

---

## 🛰️ Real External Data Integrations

TerraTwin enforces a **Zero-Fake Data Policy**: if an external provider fails or has no coverage for given coordinates, the system explicitly reports `UNAVAILABLE` or `NOT_CONFIGURED` with a diagnostic message rather than displaying fabricated numbers.

### 1. Open-Meteo Agro-Meteorology Service (Primary Nationwide Provider)
* **Endpoint**: `https://api.open-meteo.com/v1/forecast`
* **Data Obtained**:
  - Current ambient temperature (°C), relative humidity (%), surface pressure (hPa), wind speed (km/h) & direction.
  - Precipitation rate (mm/h) and WMO weather classification codes.
  - Vapour Pressure Deficit (VPD in kPa) and FAO-56 Reference Evapotranspiration ($ET_0$ in mm/day).
  - Root-zone soil moisture ($0\text{--}7\text{ cm}$, $\text{m}^3/\text{m}^3$) and root-zone soil temperature (°C).
  - 7-day cumulative precipitation forecast and daily minimum/maximum temperature ranges.
* **Cadence & Caching**: Cached in-memory with a 15-minute TTL. Supports force-refresh queries via `?refresh=true`.
* **Fallback Behavior**: If the Open-Meteo service fails or times out (8-second timeout), status flags set to `UNAVAILABLE`; zero fallback to fake defaults.

### 2. Copernicus Data Space Ecosystem (CDSE) — Sentinel-2 Level-2A
* **Endpoint**: `https://catalogue.dataspace.copernicus.eu/odata/v1/Products`
* **Data Obtained**:
  - Public OData catalogue search for Bottom-of-Atmosphere (BOA) reflectance scenes (`MSIL2A`) intersecting the farm coordinates ($WGS\text{-}84\text{ EPSG:4326}$).
  - Scene Name, Product ID, acquisition date/time, and orbital footprint geometry.
  - Military Grid Reference System (MGRS) tile identifier (e.g., `T43QHV`).
  - Genuine cloud coverage percentage extracted from product attributes.
* **Spectral Indices & Data Honesty**: If raw Level-2A raster bands (B04 Red and B08 NIR) have not been downloaded and processed locally, NDVI is marked `unavailable` with an explicit notice (`🛰️ Sentinel-2 scene available · NDVI calculation unavailable`).
* **Query Window**: 45-day orbital window, filtered by max cloud cover threshold (default 30%).

### 3. ISRIC World Soil Information — SoilGrids 2.0
* **Endpoint**: `https://rest.isric.org/soilgrids/v2.0/properties/query`
* **Data Obtained**:
  - Topsoil properties ($0\text{--}5\text{ cm}$ depth): Clay content (%), Sand content (%), Silt content (%).
  - Soil pH in $H_2O$ and Soil Organic Carbon (SOC in $\text{g/kg}$).
  - Pedological classification (e.g., Vertisol / Black Clay, Sandy Loam, Clay Loam).
* **Resolution**: 250m gridded spatial machine-learning model (WoSIS profile random-forest predictions).
* **Honesty Rule**: Classified strictly as **Modeled Information** (not in-situ soil sensors). NPK is reported as `Unavailable` because SoilGrids 2.0 does not map available nitrogen, phosphorus, or potassium.

### 4. NASA GIBS (Global Imagery Browse Services)
* **Endpoints**: NASA EOSDIS WMS (`GetMap`) and WMTS tile service (`EPSG:4326` & `EPSG:3857`).
* **Layers Available**:
  - `MODIS_Terra_CorrectedReflectance_TrueColor` (250m daily satellite pass)
  - `VIIRS_SNPP_CorrectedReflectance_TrueColor` (375m high-resolution pass)
  - `MODIS_Aqua_CorrectedReflectance_TrueColor` (250m afternoon pass)
* **Purpose**: Provides visual Earth observation imagery over the farm coordinates for any selected historical or current date.

### 5. India Meteorological Department (IMD) — Optional Secondary Provider
* **Status**: Separate optional provider. Never conflated with Open-Meteo.
* **Behavior**: If `IMD_API_KEY` is not present, reports `NOT_CONFIGURED` ("IMD requires registered ministry API credentials. Open-Meteo operates as the primary nationwide weather provider.").

### 6. SMS Advisory Gateway
* **Status**: Real SMS dispatch provider abstraction.
* **Behavior**: Checks `SMS_GATEWAY_API_KEY`. If unconfigured, the UI clearly displays `SMS service not configured` and returns `NOT_CONFIGURED` status rather than claiming mock delivery.

---

## 🌾 Deterministic Crop Modelling & Biophysical Simulation

TerraTwin executes numerical biophysical models on both the client and the server (`/api/simulation/run`):

### 1. Crop Parameter Matrix (ICAR & FAO-56 Grounded)
Calibrated parameters for major Indian cropping systems:
* **Cotton**: Base Temp $12.0^\circ\text{C}$, Optimal Max $32.0^\circ\text{C}$, Optimal Yield $2,400\text{ kg/ha}$. Critical water stages: Flowering, Fruiting.
* **Wheat**: Base Temp $4.5^\circ\text{C}$, Optimal Max $25.0^\circ\text{C}$, Optimal Yield $4,600\text{ kg/ha}$. Critical stages: Flowering, Grain Filling.
* **Rice**: Base Temp $10.0^\circ\text{C}$, Optimal Max $30.0^\circ\text{C}$, Optimal Yield $4,200\text{ kg/ha}$. Critical stages: Vegetative, Flowering, Grain Filling.
* **Maize**: Base Temp $10.0^\circ\text{C}$, Optimal Max $32.0^\circ\text{C}$, Optimal Yield $5,200\text{ kg/ha}$.
* **Soybean**: Base Temp $10.0^\circ\text{C}$, Optimal Max $30.0^\circ\text{C}$, Optimal Yield $2,600\text{ kg/ha}$.
* **Sugarcane**: Base Temp $16.0^\circ\text{C}$, Optimal Max $35.0^\circ\text{C}$, Optimal Yield $75,000\text{ kg/ha}$.
* **Groundnut**: Base Temp $10.0^\circ\text{C}$, Optimal Max $30.0^\circ\text{C}$, Optimal Yield $2,400\text{ kg/ha}$.
* **Mustard**: Base Temp $5.0^\circ\text{C}$, Optimal Max $25.0^\circ\text{C}$, Optimal Yield $1,800\text{ kg/ha}$.
* **Pulses**: Base Temp $10.0^\circ\text{C}$, Optimal Max $30.0^\circ\text{C}$, Optimal Yield $1,600\text{ kg/ha}$.

### 2. Growing Degree Days (GDD) & Phenology
Thermal time accumulation governs crop physiological development:
$$\text{GDD}_{\text{daily}} = \max(0, T_{\text{mean}} - T_{\text{base}})$$
$$\text{GDD}_{\text{accumulated}} = \sum \text{GDD}_{\text{daily}}$$

The crop progresses through 7 discrete phenological stages based on days after planting (DAP) and accumulated heat units:
1. Germination
2. Vegetative
3. Flowering
4. Fruiting
5. Grain Filling
6. Maturity
7. Harvest Ready

### 3. Biophysical Stress Modeling
* **Water Deficit Stress ($S_w$)**: Derived from root-zone soil moisture ($M$) against crop moisture depletion thresholds:
  $$S_w = \begin{cases} 0 & \text{if } M \ge 35\% \\ \min\left(1, \frac{35 - M}{25}\right) & \text{if } M < 35\% \end{cases}$$
* **Thermal Heat Stress ($S_h$)**: Penalty applied when ambient temperature exceeds genetic optimal ceiling:
  $$S_h = \begin{cases} 0 & \text{if } T \le T_{\text{opt\_max}} \\ \min\left(1, \frac{T - T_{\text{opt\_max}}}{10}\right) & \text{if } T > T_{\text{opt\_max}} \end{cases}$$
* **Pest & Pathogen Risks**: Calculated from temperature and relative humidity coincidence models (e.g., $24\text{--}30^\circ\text{C}$ with $\text{RH} > 75\%$ for high insect vector activity).
* **Overall Composite Stress**:
  $$S_{\text{overall}} = \min(1, 0.50 \cdot S_w + 0.35 \cdot S_h + 0.15 \cdot S_{\text{pest}})$$

### 4. Yield Projection Attenuation
Projected harvest yield is modeled by penalizing the baseline genetic potential $Y_{\text{optimal}}$:
$$Y_{\text{projected}} = \text{round}\left(Y_{\text{optimal}} \cdot (1 - 0.45 \cdot S_{\text{overall}})\right)$$
*Labeled throughout the application as `MODEL PREDICTION`, distinguishing it from physical harvest measurements.*

### 5. What-If Simulation Lab
Allows agronomists and farmers to run scenario adjustments:
* Temperature anomalies ($-5^\circ\text{C}$ to $+8^\circ\text{C}$)
* Soil moisture alterations ($10\%$ to $60\%$)
* Rainfall deficit or deluge scenarios
* Irrigation method transitions (Rainfed, Furrow, Drip, Sprinkler)
* Real-time calculation of yield deltas ($\Delta\text{ kg/ha}$) and stress shifts.

---

## 🤖 AI-Assisted Decision Support (Server-Side LLM)

TerraTwin features server-side AI integration designed with a **Strict Grounding Contract**:
* **Never Hallucinates Data**: The LLM receives structured biophysical outputs from the model. If an input is `UNAVAILABLE`, it is explicitly marked, and the AI is instructed never to fabricate readings.
* **Clear Provenance in Output**: Distinguishes `[MODEL RESULT]` (mathematical outputs from GDD and stress equations) from `[AI EXPLANATION]` (agronomic interpretation and advice).

### Three Implemented AI Capabilities

1. **Agricultural Copilot (`POST /api/gemini/copilot`)**:
   - Conversational digital assistant tailored to Indian smallholder agriculture.
   - Grounded in current farm profile, weather telemetry, satellite acquisition date, SoilGrids profile, and active alerts.
   - Provides prioritized, low-cost practical interventions (ICAR agronomic practices, integrated pest management, organic foliar sprays).

2. **Simulation Delta Explainer (`POST /api/gemini/explain-simulation`)**:
   - Analyzes numerical what-if simulation outputs.
   - Explains the biophysical mechanisms behind yield changes (stomatal conductance, root-zone tension, evapotranspirative demand, cellular turgor).
   - Provides 2–3 actionable adaptation recommendations if the farmer anticipates those conditions.

3. **Advisory Scientific Diagnosis (`POST /api/gemini/advisor`)**:
   - Deep-dive diagnosis into why a specific advisory was triggered.
   - Outlines biophysical root cause, step-by-step smallholder application prescription, and expected harvest loss prevention.

### Multilingual Support (10 Indian Languages)
Generates culturally and linguistically appropriate advice in:
* English, Hindi (हिन्दी), Telugu (తెలుగు), Tamil (தமிழ்), Marathi (मराठी), Punjabi (ਪੰਜਾਬੀ), Gujarati (ગુજરાતી), Bengali (বাংলা), Kannada (ಕನ್ನಡ), Malayalam (മലയാളം).

---

## 🗄️ Relational Persistence & Supabase Integration

All user data is persisted in **Supabase (PostgreSQL)** with Row Level Security (RLS) policies:

* `profiles`: User identities, contact numbers, roles, preferred regional languages.
* `farms` & `farm_boundaries`: Parcel records, geographic coordinates, area in hectares, GeoJSON polygon boundaries.
* `crop_cycles`: Active crop variety, sowing date, current stage, target yields.
* `weather_observations`: Historical weather logs with provider provenance.
* `satellite_observations`: Sentinel-2 product catalogue references and metadata.
* `soil_observations`: SoilGrids layer data and pedological classifications.
* `simulation_runs`: Historical scenario runs and resulting yield deltas.
* `advisories`: Prescriptive alerts with urgency, priority, and action items.
* `ai_conversations` & `ai_messages`: Persisted multi-turn chat history.

*Zero-Demo Guarantee: TerraTwin does not pre-populate fake demo farms. New accounts begin with 0 farms until created by the user.*

---

## 🏗️ Architecture & Deployment

### Production Target: Netlify (Serverless)
```
Browser 
  ──> Vite React Application (Single Page App)
  ──> /api/* (Rewritten in netlify.toml)
  ──> Netlify Function (netlify/functions/api.ts on Node 22)
  ──> External APIs (Open-Meteo, Copernicus, ISRIC)
  ──> Server-side AI (Google Gemini / OpenRouter)
  ──> Database (Supabase PostgreSQL via RLS)
```

* **No server.ts in production**: The deployed application runs entirely on Netlify's CDN and Netlify Functions.
* **No Docker daemon requirement on Netlify**.
* **Zero Secret Leakage**: `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are kept exclusively server-side.

### Local Development Target
* `npm run dev`: Runs `server.ts` with Vite middlewares mounted on `http://localhost:3000`.

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` for local development or configure in your **Netlify Site Settings**:

```bash
# Server Runtime
PORT=3000
NODE_ENV=development

# Google Gemini API (Primary Server-side AI Copilot)
GEMINI_API_KEY=your_gemini_api_key_here

# OpenRouter (Optional Secondary AI Model Router)
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_FREE_ONLY=false

# Supabase (Relational Persistence & Authentication)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# Optional Meteorological & Geospatial Providers
IMD_API_KEY=
COPERNICUS_CLIENT_SECRET=
SMS_GATEWAY_API_KEY=
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Local Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Build for Production
```bash
npm run build
```
Generates production assets in `dist/`.

### 4. Type Check & Lint
```bash
npm run lint
```

---

## 📄 License

This project is licensed under the MIT License.
