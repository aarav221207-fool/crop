import React, { useState } from 'react';
import { FarmTwin } from '../types/farm-twin';
import { IrrigationType, CropStage } from '../types/core';
import { cropTwinSimulation, CROP_PARAMETERS_REGISTRY } from '../adapters/crop-twin-simulation-service';
import { RefreshCw, RotateCcw, AlertCircle, ArrowRight } from 'lucide-react';

interface SimulationLabProps {
  farms: FarmTwin[];
  selectedFarmId?: string;
  onSelectFarmId?: (id: string) => void;
  weather?: any;
  satellite?: any;
  soil?: any;
}

export const SimulationLab: React.FC<SimulationLabProps> = ({
  farms,
  selectedFarmId,
  onSelectFarmId,
  weather,
  satellite,
  soil,
}) => {
  const [activeFarmId, setActiveFarmId] = useState<string>(
    selectedFarmId || farms[0]?.twinId || ''
  );

  const baseFarm = farms.find((f) => f.twinId === activeFarmId) || farms[0];

  const cropParams = baseFarm?.farmConfiguration?.cropType
    ? CROP_PARAMETERS_REGISTRY[baseFarm.farmConfiguration.cropType]
    : undefined;

  const actualDap = baseFarm?.currentState?.daysAfterPlanting;
  const actualMoisture = baseFarm?.currentState?.soilMoisture ?? (weather?.current?.soilMoisture !== undefined ? Math.round(weather.current.soilMoisture * 100) : undefined);
  const actualTemp = weather?.current?.temperature ?? baseFarm?.currentState?.environmentalConditions?.temperature?.average;
  const actualRain = baseFarm?.currentState?.environmentalConditions?.rainfall ?? (weather?.current?.precipitation !== undefined ? weather.current.precipitation : 0);
  const actualIrrigation = baseFarm?.farmConfiguration?.irrigationType ?? IrrigationType.DRIP;

  const isDataAvailable = typeof actualDap === 'number' && typeof actualMoisture === 'number' && typeof actualTemp === 'number';

  // Simulation controls state (initialized from genuine live observations)
  const [dap, setDap] = useState<number>(actualDap ?? 0);
  const [soilMoisture, setSoilMoisture] = useState<number>(actualMoisture ?? 0);
  const [temperature, setTemperature] = useState<number>(actualTemp ?? 0);
  const [rainfall7Days, setRainfall7Days] = useState<number>(actualRain ?? 0);
  const [irrigationType, setIrrigationType] = useState<IrrigationType>(actualIrrigation);

  // Gemini AI Scenario Explanation state
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState<boolean>(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  const handleSelectFarm = (id: string) => {
    setActiveFarmId(id);
    if (onSelectFarmId) onSelectFarmId(id);
    const target = farms.find((f) => f.twinId === id);
    if (target) {
      const tDap = target.currentState?.daysAfterPlanting ?? 0;
      const tMoist = target.currentState?.soilMoisture ?? 0;
      const tTemp = target.currentState?.environmentalConditions?.temperature?.average ?? 0;
      const tRain = target.currentState?.environmentalConditions?.rainfall ?? 0;
      const tIrr = target.farmConfiguration?.irrigationType ?? IrrigationType.DRIP;

      setDap(tDap);
      setSoilMoisture(tMoist);
      setTemperature(tTemp);
      setRainfall7Days(tRain);
      setIrrigationType(tIrr);
      setAiExplanation(null);
    }
  };

  const handleReset = () => {
    if (baseFarm && isDataAvailable) {
      setDap(actualDap!);
      setSoilMoisture(actualMoisture!);
      setTemperature(actualTemp!);
      setRainfall7Days(actualRain);
      setIrrigationType(actualIrrigation);
      setAiExplanation(null);
      setExplainError(null);
    }
  };

  if (!baseFarm) {
    return (
      <div className="bg-[#11171f] border border-stone-800 rounded-xl p-12 text-center max-w-lg mx-auto space-y-4">
        <div className="text-3xl">🌱</div>
        <h2 className="text-xl font-bold text-white">No Farms to Simulate</h2>
        <p className="text-xs text-stone-400">
          Register a farm parcel to execute what-if agronomic stress simulations.
        </p>
      </div>
    );
  }

  if (!isDataAvailable) {
    return (
      <div className="bg-[#11171f] border border-stone-800 rounded-xl p-12 text-center max-w-lg mx-auto space-y-4">
        <div className="text-3xl">⚠️</div>
        <h2 className="text-xl font-bold text-white">Simulation Inputs Unavailable</h2>
        <p className="text-xs text-stone-400">
          Required live telemetry (crop age, root-zone soil moisture, or ambient temperature) is currently unavailable for this farm parcel. In strict adherence to zero-fake-data policy, TerraTwin will not substitute fake default inputs (such as 31°C, 36%, 65 DAP, 2200 kg/ha).
        </p>
      </div>
    );
  }

  // Run the biophysical simulation model
  const simulatedTwin = cropTwinSimulation.simulateTwinState(baseFarm, {
    daysAfterPlanting: dap,
    soilMoisture,
    ambientTemperature: temperature,
    rainfall7Days,
    irrigationType,
  });

  const baselineYield = baseFarm.currentState?.predictedYield ?? cropParams?.yieldPotential?.optimal ?? 0;
  const simYield = simulatedTwin.currentState?.predictedYield ?? 0;
  const yieldDelta = simYield - baselineYield;
  const yieldDeltaPercent = baselineYield > 0 ? ((yieldDelta / baselineYield) * 100).toFixed(1) : '0';

  const baseWaterStress = baseFarm.currentState?.stressIndicators?.waterStress ?? 0;
  const simWaterStress = simulatedTwin.currentState?.stressIndicators?.waterStress ?? 0;
  const baseHeatStress = baseFarm.currentState?.stressIndicators?.heatStress ?? 0;
  const simHeatStress = simulatedTwin.currentState?.stressIndicators?.heatStress ?? 0;

  const handleExplainScenario = async () => {
    setIsExplaining(true);
    setExplainError(null);

    try {
      const res = await fetch('/api/gemini/explain-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmTwin: baseFarm,
          baselineState: {
            yieldKgHa: baselineYield,
            waterStress: baseWaterStress,
            heatStress: baseHeatStress,
          },
          simulatedState: {
            yieldKgHa: simYield,
            waterStress: simWaterStress,
            heatStress: simHeatStress,
          },
          deltas: {
            yieldDeltaKgHa: yieldDelta,
            yieldDeltaPct: yieldDeltaPercent,
          },
          scenarioDescription: `DAP: ${dap} days, Root Moisture: ${soilMoisture}%, Ambient Temp: ${temperature}°C, 7-Day Rainfall: ${rainfall7Days} mm, Irrigation Regime: ${irrigationType}`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gemini isn't configured yet.");
      }
      setAiExplanation(data.explanation);
    } catch (err: any) {
      setExplainError(err.message || "Gemini isn't configured yet.");
      setAiExplanation(null);
    } finally {
      setIsExplaining(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header and Farm Switcher */}
      <div className="bg-[#11171f] border border-stone-800/80 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🧪</span>
            <h1 className="text-xl font-bold text-white tracking-tight">Agricultural Simulation Lab</h1>
          </div>
          <p className="text-xs text-stone-400 mt-1">
            Simulate microclimate changes, irrigation regimes, and water stress penalties on crop yield.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="sim-farm-select" className="text-xs text-stone-400 sr-only">Farm</label>
          <select
            id="sim-farm-select"
            value={activeFarmId}
            onChange={(e) => handleSelectFarm(e.target.value)}
            className="bg-stone-900 border border-stone-700 rounded-md text-xs text-stone-200 px-3 py-2 cursor-pointer focus:outline-hidden focus:border-emerald-500"
          >
            {farms.map((f) => (
              <option key={f.twinId} value={f.twinId}>
                {f.location.district} · {f.farmConfiguration.cropType.toUpperCase()}
              </option>
            ))}
          </select>

          <button
            onClick={handleReset}
            className="px-3 py-2 text-xs text-stone-400 hover:text-stone-200 bg-stone-900 border border-stone-700/60 rounded-md flex items-center gap-1.5 cursor-pointer"
            title="Reset to current baseline"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* Grid: CURRENT FARM STATE vs CHANGE SCENARIO */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Step 1: CURRENT FARM STATE (4 cols) */}
        <div className="md:col-span-5 bg-[#11171f] border border-stone-800/80 rounded-xl p-5 space-y-4">
          <div className="border-b border-stone-800/80 pb-2.5">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider block">
              Step 1
            </span>
            <h3 className="text-sm font-bold text-white mt-0.5">Current Farm State (Baseline)</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-stone-800/50">
              <span className="text-stone-400">Crop & Variety:</span>
              <span className="text-stone-200 font-medium capitalize">
                {baseFarm.farmConfiguration.cropType} ({baseFarm.farmConfiguration.varietyName || 'Default'})
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-stone-800/50">
              <span className="text-stone-400">Crop Age:</span>
              <span className="text-stone-200 font-mono tabular-nums">
                {baseFarm.currentState.daysAfterPlanting} Days (Stage: {baseFarm.currentState.cropStage})
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-stone-800/50">
              <span className="text-stone-400">Root-Zone Soil Moisture:</span>
              <span className="text-stone-200 font-mono tabular-nums">{baseFarm.currentState.soilMoisture}%</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-stone-800/50">
              <span className="text-stone-400">Ambient Temperature:</span>
              <span className="text-stone-200 font-mono tabular-nums">
                {baseFarm.currentState.environmentalConditions.temperature.average}°C
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-stone-800/50">
              <span className="text-stone-400">7-Day Rainfall:</span>
              <span className="text-stone-200 font-mono tabular-nums">{baseFarm.currentState.environmentalConditions.rainfall} mm</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-stone-400">Current Irrigation:</span>
              <span className="text-stone-200 font-medium capitalize">{baseFarm.farmConfiguration.irrigationType}</span>
            </div>
          </div>
        </div>

        {/* Step 2: CHANGE SCENARIO (7 cols) */}
        <div className="md:col-span-7 bg-[#11171f] border border-stone-800/80 rounded-xl p-5 space-y-4">
          <div className="border-b border-stone-800/80 pb-2.5">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block">
              Step 2
            </span>
            <h3 className="text-sm font-bold text-white mt-0.5">Adjust Scenario Parameters</h3>
          </div>

          <div className="space-y-4 text-xs">
            {/* Slider 1: Days After Planting (Timeline) */}
            <div>
              <div className="flex justify-between text-stone-300 mb-1">
                <span>Crop Age (Days After Planting):</span>
                <span className="font-mono text-emerald-400 font-semibold">{dap} DAP</span>
              </div>
              <input
                type="range"
                min="10"
                max="180"
                value={dap}
                onChange={(e) => setDap(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Slider 2: Soil Moisture */}
            <div>
              <div className="flex justify-between text-stone-300 mb-1">
                <span>Root-Zone Soil Moisture (%):</span>
                <span className="font-mono text-emerald-400 font-semibold">{soilMoisture}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="80"
                value={soilMoisture}
                onChange={(e) => setSoilMoisture(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Slider 3: Ambient Temperature */}
            <div>
              <div className="flex justify-between text-stone-300 mb-1">
                <span>Ambient Temperature (°C):</span>
                <span className="font-mono text-emerald-400 font-semibold">{temperature}°C</span>
              </div>
              <input
                type="range"
                min="15"
                max="48"
                value={temperature}
                onChange={(e) => setTemperature(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Slider 4: 7-Day Rainfall */}
            <div>
              <div className="flex justify-between text-stone-300 mb-1">
                <span>7-Day Expected Rainfall (mm):</span>
                <span className="font-mono text-emerald-400 font-semibold">{rainfall7Days} mm</span>
              </div>
              <input
                type="range"
                min="0"
                max="150"
                value={rainfall7Days}
                onChange={(e) => setRainfall7Days(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Select: Irrigation Type */}
            <div>
              <label htmlFor="sim-irrigation-type" className="block text-stone-300 mb-1">Irrigation System Adjustment:</label>
              <select
                id="sim-irrigation-type"
                value={irrigationType}
                onChange={(e) => setIrrigationType(e.target.value as IrrigationType)}
                className="w-full bg-stone-900 border border-stone-700 rounded-md p-2 text-stone-200 cursor-pointer"
              >
                <option value={IrrigationType.DRIP}>Precision Drip Irrigation</option>
                <option value={IrrigationType.SPRINKLER}>Sprinkler Irrigation</option>
                <option value={IrrigationType.FLOOD}>Flood / Furrow Irrigation</option>
                <option value={IrrigationType.RAINFED}>Rain-fed (No supplemental irrigation)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Step 3 & 4: RUN SIMULATION & COMPARE (Baseline vs Scenario) */}
      <div className="bg-[#11171f] border border-stone-800/80 rounded-xl p-5 sm:p-6 space-y-5">
        <div className="border-b border-stone-800/80 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block">
              Step 3 & 4
            </span>
            <h2 className="text-base font-bold text-white mt-0.5">Biophysical Comparison: Baseline vs Scenario</h2>
          </div>

          <button
            onClick={handleExplainScenario}
            disabled={isExplaining}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto shadow-xs"
          >
            {isExplaining ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>🤖</span>}
            <span>Explain with TerraTwin AI</span>
          </button>
        </div>

        {/* Side-by-Side Comparative Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Metric 1: Forecasted Yield */}
          <div className="p-4 bg-stone-900/80 border border-stone-800 rounded-xl space-y-2">
            <span className="text-xs text-stone-400 block font-medium">📈 Yield Outlook</span>
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-2xl font-bold text-white font-mono tabular-nums">{simYield}</div>
                <div className="text-[11px] text-stone-400">Simulated (kg/ha)</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold font-mono text-stone-400">{baselineYield}</div>
                <div className="text-[11px] text-stone-500">Baseline (kg/ha)</div>
              </div>
            </div>
            <div className={`text-xs font-mono font-semibold pt-1 ${yieldDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              Delta: {yieldDelta >= 0 ? '+' : ''}{yieldDelta} kg/ha ({yieldDeltaPercent}%)
            </div>
          </div>

          {/* Metric 2: Water Stress */}
          <div className="p-4 bg-stone-900/80 border border-stone-800 rounded-xl space-y-2">
            <span className="text-xs text-stone-400 block font-medium">💧 Water Deficit Stress</span>
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-2xl font-bold text-white font-mono tabular-nums">
                  {(simWaterStress * 100).toFixed(0)}%
                </div>
                <div className="text-[11px] text-stone-400">Simulated Stress</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold font-mono text-stone-400">
                  {(baseWaterStress * 100).toFixed(0)}%
                </div>
                <div className="text-[11px] text-stone-500">Baseline Stress</div>
              </div>
            </div>
            <div className={`text-xs font-mono font-semibold pt-1 ${simWaterStress <= baseWaterStress ? 'text-emerald-400' : 'text-amber-400'}`}>
              {simWaterStress <= baseWaterStress ? 'Stress Reduced' : 'Stress Elevated'}
            </div>
          </div>

          {/* Metric 3: Physiological Stage & Harvest */}
          <div className="p-4 bg-stone-900/80 border border-stone-800 rounded-xl space-y-2">
            <span className="text-xs text-stone-400 block font-medium">🌱 Phenological Phase</span>
            <div>
              <div className="text-lg font-bold text-white capitalize">
                {simulatedTwin.currentState.cropStage}
              </div>
              <div className="text-[11px] text-stone-400 mt-0.5">
                DAP: {dap} (Baseline was {baseFarm.currentState.daysAfterPlanting} DAP)
              </div>
            </div>
            <div className="text-xs text-emerald-400 font-mono pt-1">
              {dap >= 110 ? 'Approaching Harvest Window' : 'Active Growth Phase'}
            </div>
          </div>
        </div>

        {/* AI Scientific Explanation Box */}
        {aiExplanation && (
          <div className="p-4 bg-emerald-950/30 border border-emerald-800/60 rounded-xl space-y-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <span>🤖 TerraTwin AI Explanation</span>
            </div>
            <div className="text-stone-200 whitespace-pre-line leading-relaxed">
              {aiExplanation}
            </div>
          </div>
        )}

        {explainError && (
          <div className="p-4 bg-amber-950/30 border border-amber-800/50 rounded-xl flex items-start gap-2 text-xs text-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-300">Notice:</span>
              <p className="mt-0.5">{explainError}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
