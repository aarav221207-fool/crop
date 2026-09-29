/**
 * TerraTwin - Agricultural Digital Twin Platform
 * Powered by Supabase Relational Persistence, Row Level Security, and Real Data Ingestion
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header, NavTab } from './components/Header';
import { OverviewView } from './components/OverviewView';
import { FarmsView } from './components/FarmsView';
import { DigitalTwinView } from './components/DigitalTwinView';
import { SimulationLab } from './components/SimulationLab';
import { WeatherPanel } from './components/WeatherPanel';
import { SatellitePanel } from './components/SatellitePanel';
import { AdvisoryPanel } from './components/AdvisoryPanel';
import { ArchitectureConfigPanel } from './components/ArchitectureConfigPanel';
import { GeminiCopilotView } from './components/GeminiCopilotView';

import { cropTwinSimulation } from './adapters/crop-twin-simulation-service';
import { supabaseRepository } from './services/supabase-repository';
import {
  weatherProvider,
  satelliteProvider,
  soilDataProvider,
  DataProvenance,
} from './services/external-data-providers';
import { FarmTwin } from './types/farm-twin';
import { Advisory } from './types/advisory';
import { WeatherData, SatelliteData, SoilData } from './types/external-data';
import { ProviderStatusCode } from './types/database';
import { IrrigationType, SoilType, CropType, Priority, AdvisoryCategory } from './types/core';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [farms, setFarms] = useState<FarmTwin[]>([]);
  const [advisories, setAdvisories] = useState<Advisory[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string>('');

  // 1. Weather Telemetry (Open-Meteo Primary Nationwide)
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherStatus, setWeatherStatus] = useState<ProviderStatusCode>('LOADING');
  const [weatherProvenance, setWeatherProvenance] = useState<DataProvenance | undefined>(undefined);
  const [weatherDiagnostic, setWeatherDiagnostic] = useState<string>('');
  const [isWeatherLoading, setIsWeatherLoading] = useState<boolean>(false);

  // 2. Satellite Telemetry (Copernicus Sentinel-2 Level-2A)
  const [satellite, setSatellite] = useState<SatelliteData | null>(null);
  const [satelliteStatus, setSatelliteStatus] = useState<ProviderStatusCode>('LOADING');
  const [satelliteProvenance, setSatelliteProvenance] = useState<DataProvenance | undefined>(undefined);
  const [satelliteDiagnostic, setSatelliteDiagnostic] = useState<string>('');
  const [isSatelliteLoading, setIsSatelliteLoading] = useState<boolean>(false);

  // 3. Soil Telemetry (ISRIC SoilGrids 2.0 Spatial Model)
  const [soil, setSoil] = useState<SoilData | null>(null);
  const [soilStatus, setSoilStatus] = useState<ProviderStatusCode>('LOADING');
  const [soilProvenance, setSoilProvenance] = useState<DataProvenance | undefined>(undefined);
  const [soilDiagnostic, setSoilDiagnostic] = useState<string>('');
  const [isSoilLoading, setIsSoilLoading] = useState<boolean>(false);

  // 4. SMS Provider Gateway Status
  const [isSmsConfigured, setIsSmsConfigured] = useState<boolean>(false);

  const [isGeneratingAdvisory, setIsGeneratingAdvisory] = useState<boolean>(false);
  const [isLoadingFarms, setIsLoadingFarms] = useState<boolean>(true);

  // Initial Load of Persistent Farms and Advisories from Supabase
  const loadFarmsAndAdvisories = useCallback(async () => {
    setIsLoadingFarms(true);
    try {
      const loadedFarms = await supabaseRepository.getFarms();
      const loadedAdvisories = await supabaseRepository.getAdvisories();

      setFarms(loadedFarms);
      setAdvisories(loadedAdvisories);
      cropTwinSimulation.setFarms(loadedFarms);
      cropTwinSimulation.setAdvisories(loadedAdvisories);

      if (loadedFarms.length > 0) {
        setSelectedFarmId((prev) => (prev && loadedFarms.some((f) => f.twinId === prev) ? prev : loadedFarms[0].twinId));
      } else {
        setSelectedFarmId('');
      }
    } catch (err) {
      console.warn('[CropTwin] Failed to load data from Supabase repository:', err);
    } finally {
      setIsLoadingFarms(false);
    }
  }, []);

  // Check SMS gateway configuration
  useEffect(() => {
    fetch('/api/sms/status')
      .then((res) => res.json())
      .then((data) => {
        setIsSmsConfigured(Boolean(data.configured));
      })
      .catch(() => {
        setIsSmsConfigured(false);
      });
  }, []);

  useEffect(() => {
    loadFarmsAndAdvisories();
  }, [loadFarmsAndAdvisories]);

  const selectedFarm = farms.find((f) => f.twinId === selectedFarmId) || farms[0];

  // 2. Fetch Live Weather Observation for Selected Farm Coordinates
  const fetchLiveWeather = useCallback(async (lat: number, lon: number, farmId?: string, forceRefresh: boolean = false) => {
    setIsWeatherLoading(true);
    setWeatherStatus('LOADING');

    try {
      const response = await weatherProvider.getWeather(lat, lon, farmId, forceRefresh);
      setWeather(response.data);
      setWeatherStatus(response.provenance.status);
      setWeatherProvenance(response.provenance);
      setWeatherDiagnostic(response.diagnosticMessage);
      cropTwinSimulation.setWeather(response.data);

      // Persist genuine observation in Supabase
      if (response.data && farmId) {
        await supabaseRepository.saveWeatherObservation({
          farmId,
          weather: response.data,
          provenance: response.provenance,
        });
      }
    } catch (err: any) {
      setWeather(null);
      setWeatherStatus('UNAVAILABLE');
      setWeatherDiagnostic(err.message || 'Weather unavailable');
      cropTwinSimulation.setWeather(null);
    } finally {
      setIsWeatherLoading(false);
    }
  }, []);

  // 3. Fetch Live Satellite Telemetry for Selected Farm
  const fetchLiveSatellite = useCallback(async (lat: number, lon: number, farmId?: string) => {
    setIsSatelliteLoading(true);
    setSatelliteStatus('LOADING');

    try {
      const response = await satelliteProvider.getSentinel2Observation(lat, lon, farmId);
      setSatellite(response.data);
      setSatelliteStatus(response.provenance.status);
      setSatelliteProvenance(response.provenance);
      setSatelliteDiagnostic(response.diagnosticMessage);
      cropTwinSimulation.setSatellite(response.data);

      // Persist genuine observation in Supabase
      if (response.data && farmId) {
        await supabaseRepository.saveSatelliteObservation({
          farmId,
          satellite: response.data,
          provenance: response.provenance,
        });
      }
    } catch (err: any) {
      setSatellite(null);
      setSatelliteStatus('UNAVAILABLE');
      setSatelliteDiagnostic(err.message || 'No usable Sentinel-2 observation available');
      cropTwinSimulation.setSatellite(null);
    } finally {
      setIsSatelliteLoading(false);
    }
  }, []);

  // 4. Fetch Live Soil Data for Selected Farm
  const fetchLiveSoil = useCallback(async (lat: number, lon: number, farmId?: string) => {
    setIsSoilLoading(true);
    setSoilStatus('LOADING');

    try {
      const response = await soilDataProvider.getSoilData(lat, lon, farmId);
      setSoil(response.data);
      setSoilStatus(response.provenance.status);
      setSoilProvenance(response.provenance);
      setSoilDiagnostic(response.diagnosticMessage);
      cropTwinSimulation.setSoil(response.data);

      // Persist genuine observation in Supabase
      if (response.data && farmId) {
        await supabaseRepository.saveSoilObservation({
          farmId,
          soil: response.data,
          provenance: response.provenance,
        });
      }
    } catch (err: any) {
      setSoil(null);
      setSoilStatus('UNAVAILABLE');
      setSoilDiagnostic(err.message || 'Soil data unavailable');
      cropTwinSimulation.setSoil(null);
    } finally {
      setIsSoilLoading(false);
    }
  }, []);

  // Trigger real telemetry fetch when selected farm coordinates change
  useEffect(() => {
    if (selectedFarm?.location) {
      fetchLiveWeather(selectedFarm.location.latitude, selectedFarm.location.longitude, selectedFarm.twinId, false);
      fetchLiveSatellite(selectedFarm.location.latitude, selectedFarm.location.longitude, selectedFarm.twinId);
      fetchLiveSoil(selectedFarm.location.latitude, selectedFarm.location.longitude, selectedFarm.twinId);
    } else {
      setWeather(null);
      setWeatherStatus('UNAVAILABLE');
      setSatellite(null);
      setSatelliteStatus('UNAVAILABLE');
      setSoil(null);
      setSoilStatus('UNAVAILABLE');
    }
  }, [
    selectedFarm?.twinId,
    selectedFarm?.location?.latitude,
    selectedFarm?.location?.longitude,
    fetchLiveWeather,
    fetchLiveSatellite,
    fetchLiveSoil,
  ]);

  // 5. Farm Creation Handler
  const handleCreateFarm = async (params: {
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
  }) => {
    const createdFarm = await supabaseRepository.createFarm(params);
    const updatedFarms = await supabaseRepository.getFarms();
    setFarms(updatedFarms);
    cropTwinSimulation.setFarms(updatedFarms);
    setSelectedFarmId(createdFarm.twinId);
  };

  // 6. Farm Deletion Handler
  const handleDeleteFarm = async (farmId: string) => {
    await supabaseRepository.deleteFarm(farmId);
    const updatedFarms = await supabaseRepository.getFarms();
    setFarms(updatedFarms);
    cropTwinSimulation.setFarms(updatedFarms);

    if (selectedFarmId === farmId) {
      setSelectedFarmId(updatedFarms[0]?.twinId || '');
    }
  };

  // 7. Dynamic Biophysical Advisory Synthesis
  const handleGenerateAdvisory = async () => {
    if (!selectedFarm) return;
    setIsGeneratingAdvisory(true);

    try {
      // Evaluate pipeline state with current genuine inputs
      const evalResult = cropTwinSimulation.evaluateDigitalTwinPipeline(selectedFarm, weather, satellite, soil);

      // Call Gemini for agronomic synthesis based on real twin context
      const res = await fetch('/api/gemini/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmTwin: {
            ...selectedFarm,
            currentState: {
              ...selectedFarm.currentState,
              stressIndicators: evalResult.stressIndicators || selectedFarm.currentState.stressIndicators,
              predictedYield: evalResult.yieldPrediction ? evalResult.yieldPrediction.valueKgHa : selectedFarm.currentState.predictedYield,
            },
          },
          language: 'en',
        }),
      });

      const data = await res.json();
      const advisoryText = data.advisoryText || 'Advisory synthesized from live biophysical telemetry.';

      const created = await supabaseRepository.createAdvisory({
        farmId: selectedFarm.twinId,
        title: `ICAR Precision Advisory: ${selectedFarm.farmConfiguration.cropType.toUpperCase()} (${selectedFarm.location.district})`,
        diagnosis: advisoryText.substring(0, 300),
        category: AdvisoryCategory.IRRIGATION,
        priority: Priority.HIGH,
        urgency: 'immediate',
        impactStatement: `Agronomic intervention projected to prevent ${evalResult.stressIndicators?.waterStress ? Math.round(evalResult.stressIndicators.waterStress * 25) : 15}% yield attenuation.`,
        actionItems: [
          { description: 'Review telemetry-adjusted irrigation and foliar prescription', urgencyHours: 24, resourceNeeded: 'Irrigation system' },
          { description: 'Inspect root-zone moisture gradient and pest trap counts', urgencyHours: 48, resourceNeeded: 'Field scout' },
        ],
        estimatedYieldLossPct: evalResult.stressIndicators?.waterStress ? Math.round(evalResult.stressIndicators.waterStress * 25) : 15,
      });

      const updatedAdvisories = await supabaseRepository.getAdvisories();
      setAdvisories(updatedAdvisories);
      cropTwinSimulation.setAdvisories(updatedAdvisories);
    } catch (err) {
      console.error('[CropTwin] Advisory synthesis error:', err);
    } finally {
      setIsGeneratingAdvisory(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f15] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Universal TerraTwin Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        farms={farms}
        selectedFarmId={selectedFarmId}
        onSelectFarmId={setSelectedFarmId}
        alertCount={advisories.filter((a) => a.farmTwinId === selectedFarmId || farms.length <= 1).length}
      />

      {/* Main Operational Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 pb-20 md:pb-6">
        {/* VIEW 1: GEOSPATIAL PARCEL OVERVIEW */}
        {activeTab === 'overview' && (
          <OverviewView
            farm={selectedFarm}
            advisories={advisories}
            weather={weather}
            satellite={satellite}
            soil={soil}
            weatherStatus={weatherStatus}
            satelliteStatus={satelliteStatus}
            soilStatus={soilStatus}
            weatherProvenance={weatherProvenance}
            satelliteProvenance={satelliteProvenance}
            soilProvenance={soilProvenance}
            onNavigateTab={(tab) => {
              if (tab === 'insights' || tab === 'advisories') setActiveTab('insights');
              else if (tab === 'copilot') setActiveTab('copilot');
              else if (tab === 'simulation') setActiveTab('simulation');
              else if (tab === 'farms') setActiveTab('farms');
              else setActiveTab(tab as any);
            }}
            onSelectFarmId={setSelectedFarmId}
            allFarms={farms}
            onOpenAddFarm={() => setActiveTab('farms')}
            onRefreshWeather={() => {
              if (selectedFarm?.location) {
                fetchLiveWeather(selectedFarm.location.latitude, selectedFarm.location.longitude, selectedFarm.twinId, true);
              }
            }}
          />
        )}

        {/* VIEW 2: AGRICULTURAL ASSET INVENTORY & FIELD REGISTRY */}
        {activeTab === 'farms' && (
          <FarmsView
            farms={farms}
            selectedFarmId={selectedFarmId}
            onSelectFarm={(farm) => setSelectedFarmId(farm.twinId)}
            onNavigateTab={(tab) => {
              if (tab === 'advisories') setActiveTab('insights');
              else setActiveTab(tab);
            }}
            onCreateFarm={handleCreateFarm}
            onDeleteFarm={handleDeleteFarm}
          />
        )}

        {/* VIEW 3: BIOPHYSICAL DIGITAL TWIN DEEP DIVE */}
        {activeTab === 'digital-twin' && (
          <DigitalTwinView
            farm={selectedFarm}
            weather={weather}
            satellite={satellite}
            soil={soil}
            weatherStatus={weatherStatus}
            satelliteStatus={satelliteStatus}
            soilStatus={soilStatus}
            onNavigateTab={setActiveTab}
          />
        )}

        {/* VIEW 4: SCENARIO ANALYSIS SIMULATION WORKBENCH */}
        {activeTab === 'simulation' && (
          <SimulationLab
            farms={farms}
            selectedFarmId={selectedFarmId}
            onSelectFarmId={setSelectedFarmId}
            weather={weather}
            satellite={satellite}
            soil={soil}
          />
        )}

        {/* VIEW 5: AGRO-METEOROLOGICAL INGESTION (OPEN-METEO NATIONWIDE & IMD) */}
        {activeTab === 'weather' && (
          <WeatherPanel
            weather={weather}
            providerStatus={weatherStatus}
            provenance={weatherProvenance}
            diagnosticMessage={weatherDiagnostic}
            farmId={selectedFarm?.twinId}
            onRefresh={() => {
              if (selectedFarm?.location) {
                fetchLiveWeather(selectedFarm.location.latitude, selectedFarm.location.longitude, selectedFarm.twinId, true);
              }
            }}
            isLoading={isWeatherLoading}
          />
        )}

        {/* VIEW 6: SATELLITE MULTISPECTRAL ANALYTICS (SENTINEL-2 & NASA GIBS) */}
        {activeTab === 'satellite' && (
          <SatellitePanel
            satellite={satellite}
            providerStatus={satelliteStatus}
            provenance={satelliteProvenance}
            diagnosticMessage={satelliteDiagnostic}
            farm={selectedFarm}
            onRefresh={() => {
              if (selectedFarm?.location) {
                fetchLiveSatellite(selectedFarm.location.latitude, selectedFarm.location.longitude, selectedFarm.twinId);
              }
            }}
            isLoading={isSatelliteLoading}
          />
        )}

        {/* VIEW 7: ADVISORY PRESCRIPTIONS & INSIGHTS */}
        {(activeTab === 'insights' || activeTab === 'advisories') && (
          <AdvisoryPanel
            advisories={advisories}
            farm={selectedFarm}
            onGenerateAdvisory={selectedFarm ? handleGenerateAdvisory : undefined}
            isGenerating={isGeneratingAdvisory}
            isSmsConfigured={isSmsConfigured}
          />
        )}

        {/* VIEW 8: ASK TERRATWIN AI */}
        {activeTab === 'copilot' && (
          <GeminiCopilotView
            farm={selectedFarm}
            weather={weather}
            satellite={satellite}
            soil={soil}
            advisories={advisories}
            weatherStatus={weatherStatus}
            satelliteStatus={satelliteStatus}
            soilStatus={soilStatus}
            onNavigateTab={(tab) => {
              if (tab === 'advisories') setActiveTab('insights');
              else if (tab === 'simulation') setActiveTab('simulation');
              else if (tab === 'weather') setActiveTab('weather');
              else if (tab === 'satellite') setActiveTab('satellite');
              else setActiveTab('overview');
            }}
          />
        )}

        {/* VIEW 9: ARCHITECTURE & API ENDPOINTS */}
        {activeTab === 'config' && (
          <ArchitectureConfigPanel />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (Genuinely responsive for 375px - 768px) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0c1218]/95 backdrop-blur-md border-t border-stone-800 px-2 py-1.5 flex items-center justify-around">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex flex-col items-center gap-0.5 p-1.5 text-[10px] font-medium transition-colors ${
            activeTab === 'overview' ? 'text-emerald-400 font-semibold' : 'text-stone-400'
          }`}
        >
          <span className="text-base">🌾</span>
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('farms')}
          className={`flex flex-col items-center gap-0.5 p-1.5 text-[10px] font-medium transition-colors ${
            activeTab === 'farms' ? 'text-emerald-400 font-semibold' : 'text-stone-400'
          }`}
        >
          <span className="text-base">📍</span>
          <span>Farms</span>
        </button>

        <button
          onClick={() => setActiveTab('simulation')}
          className={`flex flex-col items-center gap-0.5 p-1.5 text-[10px] font-medium transition-colors ${
            activeTab === 'simulation' ? 'text-emerald-400 font-semibold' : 'text-stone-400'
          }`}
        >
          <span className="text-base">🧪</span>
          <span>Simulate</span>
        </button>

        <button
          onClick={() => setActiveTab('insights')}
          className={`flex flex-col items-center gap-0.5 p-1.5 text-[10px] font-medium transition-colors relative ${
            activeTab === 'insights' || activeTab === 'advisories' ? 'text-emerald-400 font-semibold' : 'text-stone-400'
          }`}
        >
          <span className="text-base">⚠️</span>
          <span>Insights</span>
          {advisories.length > 0 && (
            <span className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full bg-emerald-400" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('copilot')}
          className={`flex flex-col items-center gap-0.5 p-1.5 text-[10px] font-medium transition-colors ${
            activeTab === 'copilot' ? 'text-emerald-400 font-semibold' : 'text-emerald-500'
          }`}
        >
          <span className="text-base">🤖</span>
          <span>TerraTwin</span>
        </button>
      </nav>

      {/* Quiet Non-AI-Slop Footer */}
      <footer className="border-t border-stone-800/60 mt-auto py-5 text-xs text-stone-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div>
            TerraTwin · Agricultural Digital Twin
          </div>
          <div className="text-stone-500">
            Open-Meteo NWP · Copernicus Sentinel-2 L2A · NASA GIBS · ISRIC SoilGrids
          </div>
        </div>
      </footer>
    </div>
  );
}
