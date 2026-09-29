import React, { useState } from 'react';
import { FarmTwin } from '../types/farm-twin';
import { CropType, IrrigationType, SoilType } from '../types/core';

interface FarmsViewProps {
  farms: FarmTwin[];
  selectedFarmId: string;
  onSelectFarm: (farm: FarmTwin) => void;
  onNavigateTab: (tab: 'overview' | 'digital-twin' | 'simulation' | 'advisories') => void;
  onCreateFarm: (params: {
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
  }) => Promise<void>;
  onDeleteFarm: (farmId: string) => Promise<void>;
}

export const FarmsView: React.FC<FarmsViewProps> = ({
  farms,
  selectedFarmId,
  onSelectFarm,
  onNavigateTab,
  onCreateFarm,
  onDeleteFarm,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCrop, setSelectedCrop] = useState<string>('all');
  const [selectedRisk, setSelectedRisk] = useState<string>('all');
  const [inspectedFarm, setInspectedFarm] = useState<FarmTwin | null>(
    farms.find((f) => f.twinId === selectedFarmId) || farms[0] || null
  );

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form Fields
  const [farmName, setFarmName] = useState<string>('');
  const [district, setDistrict] = useState<string>('');
  const [state, setState] = useState<string>('');
  const [latitude, setLatitude] = useState<number>(20.5937);
  const [longitude, setLongitude] = useState<number>(78.9629);
  const [totalArea, setTotalArea] = useState<number>(2.0);
  const [cropType, setCropType] = useState<CropType>(CropType.COTTON);
  const [varietyName, setVarietyName] = useState<string>('');
  const [sowingDate, setSowingDate] = useState<string>(
    new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [irrigationType, setIrrigationType] = useState<IrrigationType>(IrrigationType.DRIP);
  const [soilType, setSoilType] = useState<SoilType>(SoilType.CLAY_LOAM);

  // Boundary input (lat, lon pairs)
  const [boundaryCoordsText, setBoundaryCoordsText] = useState<string>('');

  const NATIONWIDE_INDIAN_PRESETS = [
    {
      region: 'North India (Punjab)',
      state: 'Punjab',
      district: 'Ludhiana',
      name: 'Ludhiana Wheat & Mustard Plot',
      latitude: 30.9010,
      longitude: 75.8573,
      cropType: CropType.WHEAT,
      varietyName: 'HD-3086 (Pusa Gautami)',
      soilType: SoilType.ALLUVIAL,
      irrigationType: IrrigationType.SPRINKLER,
      boundary: '30.9020, 75.8560\n30.9020, 75.8585\n30.9000, 75.8585\n30.9000, 75.8560',
    },
    {
      region: 'South India (Karnataka)',
      state: 'Karnataka',
      district: 'Dharwad',
      name: 'Dharwad Cotton & Chilli Field',
      latitude: 15.4589,
      longitude: 75.0078,
      cropType: CropType.COTTON,
      varietyName: 'DHH-11 Hybrid',
      soilType: SoilType.BLACK_CLAY,
      irrigationType: IrrigationType.DRIP,
      boundary: '15.4600, 75.0065\n15.4600, 75.0090\n15.4580, 75.0090\n15.4580, 75.0065',
    },
    {
      region: 'East India (West Bengal)',
      state: 'West Bengal',
      district: 'Bardhaman',
      name: 'Bardhaman Aman Rice Parcel',
      latitude: 23.2324,
      longitude: 87.8615,
      cropType: CropType.RICE,
      varietyName: 'Swarna (MTU-7029)',
      soilType: SoilType.ALLUVIAL,
      irrigationType: IrrigationType.FLOOD,
      boundary: '23.2335, 87.8600\n23.2335, 87.8630\n23.2315, 87.8630\n23.2315, 87.8600',
    },
    {
      region: 'West India (Maharashtra)',
      state: 'Maharashtra',
      district: 'Nashik',
      name: 'Nashik Soybean & Onion Field',
      latitude: 19.9975,
      longitude: 73.7898,
      cropType: CropType.SOYBEAN,
      varietyName: 'JS-335 Improved',
      soilType: SoilType.CLAY_LOAM,
      irrigationType: IrrigationType.DRIP,
      boundary: '19.9985, 73.7885\n19.9985, 73.7910\n19.9965, 73.7910\n19.9965, 73.7885',
    },
    {
      region: 'Central India (Madhya Pradesh)',
      state: 'Madhya Pradesh',
      district: 'Hoshangabad',
      name: 'Narmada Valley Wheat & Gram Farm',
      latitude: 22.7519,
      longitude: 77.7289,
      cropType: CropType.WHEAT,
      varietyName: 'Sharbati MP-306',
      soilType: SoilType.BLACK_CLAY,
      irrigationType: IrrigationType.SPRINKLER,
      boundary: '22.7530, 77.7275\n22.7530, 77.7305\n22.7510, 77.7305\n22.7510, 77.7275',
    },
    {
      region: 'Northeast India (Assam)',
      state: 'Assam',
      district: 'Nagaon',
      name: 'Brahmaputra Valley Sali Rice Farm',
      latitude: 26.3465,
      longitude: 92.6840,
      cropType: CropType.RICE,
      varietyName: 'Ranjit Sub-1',
      soilType: SoilType.ALLUVIAL,
      irrigationType: IrrigationType.RAINFED,
      boundary: '26.3475, 92.6825\n26.3475, 92.6855\n26.3455, 92.6855\n26.3455, 92.6825',
    },
    {
      region: 'Himalayan Region (Himachal Pradesh)',
      state: 'Himachal Pradesh',
      district: 'Shimla',
      name: 'Shimla Valley Apple & Maize Terraces',
      latitude: 31.1048,
      longitude: 77.1734,
      cropType: CropType.MAIZE,
      varietyName: 'Pusa Composite-3',
      soilType: SoilType.SANDY_LOAM,
      irrigationType: IrrigationType.DRIP,
      boundary: '31.1060, 77.1720\n31.1060, 77.1750\n31.1035, 77.1750\n31.1035, 77.1720',
    },
  ];

  const applyPreset = (preset: typeof NATIONWIDE_INDIAN_PRESETS[0]) => {
    setFarmName(preset.name);
    setDistrict(preset.district);
    setState(preset.state);
    setLatitude(preset.latitude);
    setLongitude(preset.longitude);
    setCropType(preset.cropType);
    setVarietyName(preset.varietyName);
    setSoilType(preset.soilType);
    setIrrigationType(preset.irrigationType);
    setBoundaryCoordsText(preset.boundary);
    parseBoundaryAndCalcArea(preset.boundary);
  };

  // Helper to parse boundary text and calculate approx polygon area (Ha)
  const parseBoundaryAndCalcArea = (text: string) => {
    try {
      const lines = text.trim().split('\n').filter(Boolean);
      const points: Array<[number, number]> = [];
      for (const line of lines) {
        const parts = line.split(',').map((p) => parseFloat(p.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          points.push([parts[0], parts[1]]);
        }
      }

      if (points.length >= 3) {
        // Shoelace formula for approximate geographic area
        let areaSqM = 0;
        const R = 6378137; // Earth radius in meters
        for (let i = 0; i < points.length; i++) {
          const j = (i + 1) % points.length;
          const lat1 = (points[i][0] * Math.PI) / 180;
          const lat2 = (points[j][0] * Math.PI) / 180;
          const lon1 = (points[i][1] * Math.PI) / 180;
          const lon2 = (points[j][1] * Math.PI) / 180;
          areaSqM += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
        }
        areaSqM = Math.abs((areaSqM * R * R) / 2);
        const ha = Math.round((areaSqM / 10000) * 100) / 100;
        if (ha > 0) setTotalArea(ha);
      }
    } catch (e) {
      // Ignore parse preview errors
    }
  };

  const handleBoundaryChange = (val: string) => {
    setBoundaryCoordsText(val);
    parseBoundaryAndCalcArea(val);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmName.trim()) {
      setFormError('Farm / Parcel Name is required.');
      return;
    }
    if (isNaN(latitude) || isNaN(longitude)) {
      setFormError('Valid Latitude and Longitude coordinates are required.');
      return;
    }
    if (totalArea <= 0) {
      setFormError('Farm area must be greater than 0 hectares.');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      // Parse boundary
      const boundaryPoints: Array<[number, number]> = [];
      const lines = boundaryCoordsText.trim().split('\n').filter(Boolean);
      for (const line of lines) {
        const parts = line.split(',').map((p) => parseFloat(p.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          boundaryPoints.push([parts[0], parts[1]]);
        }
      }

      await onCreateFarm({
        name: farmName.trim(),
        district: district.trim(),
        state: state.trim(),
        latitude,
        longitude,
        totalAreaHectares: totalArea,
        irrigationType,
        soilType,
        cropType,
        varietyName: varietyName.trim() || 'Standard Cultivar',
        sowingDate,
        boundaryCoordinates: boundaryPoints.length >= 3 ? boundaryPoints : undefined,
      });

      setIsAddModalOpen(false);
      setFarmName('');
    } catch (err: any) {
      setFormError(err.message || 'Failed to save farm to Supabase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter logic
  const filteredFarms = farms.filter((f) => {
    if (selectedCrop !== 'all' && f.farmConfiguration.cropType !== selectedCrop) {
      return false;
    }
    const maxStress = Math.max(
      f.currentState?.stressIndicators?.waterStress || 0,
      f.currentState?.stressIndicators?.heatStress || 0,
      f.currentState?.stressIndicators?.diseaseRisk || 0
    );
    if (selectedRisk === 'high' && maxStress < 0.6) return false;
    if (selectedRisk === 'moderate' && (maxStress < 0.35 || maxStress >= 0.6)) return false;
    if (selectedRisk === 'optimal' && maxStress >= 0.35) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchLoc = f.location.district.toLowerCase().includes(q) || f.location.state.toLowerCase().includes(q);
      const matchCrop = f.farmConfiguration.cropType.toLowerCase().includes(q) || f.farmConfiguration.varietyName.toLowerCase().includes(q);
      const matchId = f.twinId.toLowerCase().includes(q) || f.farmerId.toLowerCase().includes(q);
      if (!matchLoc && !matchCrop && !matchId) return false;
    }
    return true;
  });

  const totalHectares = farms.reduce((acc, f) => acc + (f.farmConfiguration?.farmSize || 0), 0);

  const handleRowClick = (farm: FarmTwin) => {
    setInspectedFarm(farm);
    onSelectFarm(farm);
  };

  const getStressColor = (val: number) => {
    if (val >= 0.6) return 'text-rose-400';
    if (val >= 0.35) return 'text-amber-400';
    return 'text-emerald-400';
  };

  return (
    <div className="space-y-6 text-slate-200">
      {/* 1. Inventory Header */}
      <div className="border-b border-slate-800 pb-5 pt-2 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-xs text-slate-400 font-mono mb-1">
            AGRICULTURAL ASSET INVENTORY & FIELD REGISTRY
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            Registered Farm Twins
          </h1>
          <div className="flex items-center space-x-3 text-xs text-slate-400 font-mono mt-1.5">
            <span>{farms.length} Managed Field Parcels</span>
            <span aria-hidden="true">·</span>
            <span>{totalHectares.toFixed(1)} Cultivated Hectares</span>
            <span aria-hidden="true">·</span>
            <span>Supabase PostgreSQL Persisted</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-semibold rounded-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <span>+</span>
            <span>Add Farm Parcel</span>
          </button>
          <button
            onClick={() => onNavigateTab('simulation')}
            className="px-3 py-2 bg-[#16212e] hover:bg-[#1f2d3d] border border-slate-700 text-xs font-mono text-slate-200 rounded-xs transition-colors cursor-pointer"
          >
            Multi-Plot Simulation
          </button>
        </div>
      </div>

      {/* 2. Filter & Query Controls Bar */}
      <div className="bg-[#121820] border border-slate-800 p-4 rounded-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="w-full md:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by district, state, crop, or twin ID..."
            className="w-full bg-[#161f2a] border border-slate-700 text-xs text-slate-200 px-3 py-2 rounded-xs focus:outline-hidden focus:border-emerald-500 font-mono placeholder:text-slate-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto text-xs font-mono">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">Crop:</span>
            <select
              value={selectedCrop}
              onChange={(e) => setSelectedCrop(e.target.value)}
              className="bg-[#161f2a] border border-slate-700 text-xs text-slate-200 px-2 py-1.5 rounded-xs focus:outline-hidden focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">All Crops ({farms.length})</option>
              <option value={CropType.COTTON}>Cotton</option>
              <option value={CropType.RICE}>Rice</option>
              <option value={CropType.WHEAT}>Wheat</option>
              <option value={CropType.SOYBEAN}>Soybean</option>
              <option value={CropType.MAIZE}>Maize</option>
              <option value={CropType.PULSES}>Pulses</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-slate-400">Stress:</span>
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="bg-[#161f2a] border border-slate-700 text-xs text-slate-200 px-2 py-1.5 rounded-xs focus:outline-hidden focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">All Levels</option>
              <option value="high">High Stress (≥60%)</option>
              <option value="moderate">Moderate (35-60%)</option>
              <option value="optimal">Optimal (&lt;35%)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Empty State or Inventory Data Table */}
      {farms.length === 0 ? (
        <div className="border border-slate-800 bg-[#121820] p-12 text-center rounded-xs space-y-4 font-mono">
          <div className="text-slate-500 text-xs uppercase tracking-wider">Zero Farm Records In Database</div>
          <h2 className="text-2xl font-semibold text-white">No Registered Farms</h2>
          <p className="text-slate-400 text-sm max-w-md mx-auto font-sans leading-relaxed">
            In accordance with the zero-fake-data policy, no mock farms are automatically seeded. Create your first agricultural parcel to start tracking biophysical telemetry.
          </p>
          <div className="pt-2">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xs transition-colors cursor-pointer"
            >
              + Register New Farm
            </button>
          </div>
        </div>
      ) : (
        <div className="border border-slate-800 bg-[#121820] rounded-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Twin ID / Parcel</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Crop & Variety</th>
                  <th className="py-3 px-4 text-right">Area</th>
                  <th className="py-3 px-4">Stage / DAP</th>
                  <th className="py-3 px-4 text-right">Water Stress</th>
                  <th className="py-3 px-4 text-right">Disease Risk</th>
                  <th className="py-3 px-4 text-right">Projected Yield</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredFarms.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500">
                      No parcels match the current query criteria.
                    </td>
                  </tr>
                ) : (
                  filteredFarms.map((farm) => {
                    const isSelected = farm.twinId === selectedFarmId;
                    const st = farm.currentState?.stressIndicators || { waterStress: 0, diseaseRisk: 0 };
                    const yieldVal = farm.currentState?.predictedYield || 0;
                    const stage = farm.currentState?.cropStage || 'germination';

                    return (
                      <tr
                        key={farm.twinId}
                        onClick={() => handleRowClick(farm)}
                        className={`transition-colors cursor-pointer ${
                          isSelected ? 'bg-emerald-950/20 text-white' : 'hover:bg-slate-800/40 text-slate-300'
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{farm.location.village || farm.twinId}</div>
                          <div className="text-[10px] text-slate-500">{farm.twinId}</div>
                        </td>

                        <td className="py-3 px-4">
                          <div>{farm.location.district}</div>
                          <div className="text-[10px] text-slate-500">{farm.location.state}</div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="capitalize font-semibold text-emerald-400">
                            {farm.farmConfiguration.cropType}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {farm.farmConfiguration.varietyName}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right tabular-nums">
                          {farm.farmConfiguration.farmSize} ha
                        </td>

                        <td className="py-3 px-4">
                          <div className="capitalize text-slate-200">{stage}</div>
                          <div className="text-[10px] text-slate-500 tabular-nums">
                            {farm.currentState.daysAfterPlanting} DAP
                          </div>
                        </td>

                        <td className={`py-3 px-4 text-right tabular-nums font-semibold ${getStressColor(st.waterStress)}`}>
                          {(st.waterStress * 100).toFixed(0)}%
                        </td>

                        <td className={`py-3 px-4 text-right tabular-nums font-semibold ${getStressColor(st.diseaseRisk)}`}>
                          {(st.diseaseRisk * 100).toFixed(0)}%
                        </td>

                        <td className="py-3 px-4 text-right tabular-nums text-white font-semibold">
                          {yieldVal.toLocaleString()} kg/ha
                        </td>

                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                onSelectFarm(farm);
                                onNavigateTab('overview');
                              }}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 rounded-xs transition-colors cursor-pointer"
                              title="Open GIS Overview"
                            >
                              Map
                            </button>
                            <button
                              onClick={() => {
                                onSelectFarm(farm);
                                onNavigateTab('digital-twin');
                              }}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[11px] text-emerald-300 rounded-xs transition-colors cursor-pointer"
                              title="Inspect Biophysical Twin"
                            >
                              Twin
                            </button>
                            <button
                              onClick={async () => {
                                if (window.confirm(`Delete farm parcel "${farm.location.village || farm.twinId}" from Supabase?`)) {
                                  await onDeleteFarm(farm.twinId);
                                }
                              }}
                              className="px-2 py-1 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-[11px] text-rose-300 rounded-xs transition-colors cursor-pointer"
                              title="Delete Farm Parcel"
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Selected Parcel Agronomic Specification Drawer */}
      {inspectedFarm && (
        <div className="border border-slate-800 bg-[#121820] p-5 rounded-xs space-y-4 font-mono">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
            <div>
              <div className="text-xs text-slate-500 uppercase">Selected Parcel Agronomic Profile</div>
              <h2 className="text-base font-semibold text-white">
                {inspectedFarm.location.district} {inspectedFarm.farmConfiguration.cropType.toUpperCase()} (ID: {inspectedFarm.twinId})
              </h2>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  onSelectFarm(inspectedFarm);
                  onNavigateTab('overview');
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xs transition-colors cursor-pointer"
              >
                View on Map Workspace
              </button>
              <button
                onClick={() => {
                  onSelectFarm(inspectedFarm);
                  onNavigateTab('digital-twin');
                }}
                className="px-3 py-1.5 bg-[#16212e] hover:bg-[#1f2d3d] border border-slate-700 text-xs text-slate-200 rounded-xs transition-colors cursor-pointer"
              >
                Open Full Biophysical Twin
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">Irrigation System</span>
              <span className="font-semibold text-slate-200 capitalize">
                {inspectedFarm.farmConfiguration.irrigationType}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Soil Series</span>
              <span className="font-semibold text-slate-200 capitalize">
                {inspectedFarm.farmConfiguration.soilType.replace('_', ' ')}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Planting Date</span>
              <span className="font-semibold text-slate-200">
                {inspectedFarm.farmConfiguration.plantingDate instanceof Date
                  ? inspectedFarm.farmConfiguration.plantingDate.toISOString().split('T')[0]
                  : String(inspectedFarm.farmConfiguration.plantingDate)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Cultivated Area</span>
              <span className="font-semibold text-slate-200 tabular-nums">
                {inspectedFarm.farmConfiguration.farmSize} ha
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Volumetric Moisture</span>
              <span className="font-semibold text-slate-200 tabular-nums">
                {inspectedFarm.currentState.soilMoisture}%
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Canopy Temp</span>
              <span className="font-semibold text-slate-200 tabular-nums">
                {inspectedFarm.currentState.environmentalConditions.temperature.average}°C
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 5. Real Add Farm Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#121820] border border-slate-700 max-w-2xl w-full p-6 rounded-xs shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto font-mono text-xs text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-slate-400 text-[11px] block uppercase">Field Boundary & Crop Cycle Registration</span>
                <h3 className="text-lg font-bold text-white">Create New Farm Twin</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs rounded-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* Nationwide Regional Indian Quick-Presets */}
              <div className="p-3 bg-[#111923] border border-slate-800 rounded-xs space-y-2">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">
                  Quick-Fill Indian Agro-Climatic Zone Presets (Nationwide Testing):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {NATIONWIDE_INDIAN_PRESETS.map((p) => (
                    <button
                      key={p.region}
                      type="button"
                      onClick={() => applyPreset(p)}
                      className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-300 hover:text-white rounded-xs transition-colors cursor-pointer"
                    >
                      {p.region}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold block">Farm / Parcel Name:</label>
                  <input
                    type="text"
                    required
                    value={farmName}
                    onChange={(e) => setFarmName(e.target.value)}
                    placeholder="e.g. North Canal Field"
                    className="w-full bg-[#161f2a] border border-slate-700 px-3 py-2 text-slate-100 rounded-xs focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold block">District & State:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      placeholder="District"
                      className="w-full bg-[#161f2a] border border-slate-700 px-3 py-2 text-slate-100 rounded-xs focus:outline-hidden focus:border-emerald-500"
                    />
                    <input
                      type="text"
                      required
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="State"
                      className="w-full bg-[#161f2a] border border-slate-700 px-3 py-2 text-slate-100 rounded-xs focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Coordinates & Area */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold block">Latitude (WGS-84):</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={latitude}
                    onChange={(e) => setLatitude(parseFloat(e.target.value))}
                    className="w-full bg-[#161f2a] border border-slate-700 px-3 py-2 text-slate-100 rounded-xs focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold block">Longitude (WGS-84):</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={longitude}
                    onChange={(e) => setLongitude(parseFloat(e.target.value))}
                    className="w-full bg-[#161f2a] border border-slate-700 px-3 py-2 text-slate-100 rounded-xs focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold block">Area (Hectares):</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={totalArea}
                    onChange={(e) => setTotalArea(parseFloat(e.target.value))}
                    className="w-full bg-[#161f2a] border border-slate-700 px-3 py-2 text-slate-100 rounded-xs focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Boundary polygon coords */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-slate-300 font-semibold">Boundary Polygon Coordinates (Lat, Lon per line):</label>
                  <span className="text-[10px] text-slate-400">Auto-computes area via shoelace formula</span>
                </div>
                <textarea
                  rows={3}
                  value={boundaryCoordsText}
                  onChange={(e) => handleBoundaryChange(e.target.value)}
                  className="w-full bg-[#161f2a] border border-slate-700 p-2 text-slate-100 rounded-xs focus:outline-hidden focus:border-emerald-500 font-mono text-[11px]"
                />
              </div>

              {/* Crop & Agronomy parameters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold block">Crop Type:</label>
                  <select
                    value={cropType}
                    onChange={(e) => setCropType(e.target.value as CropType)}
                    className="w-full bg-[#161f2a] border border-slate-700 px-3 py-2 text-slate-100 rounded-xs focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value={CropType.COTTON}>Cotton</option>
                    <option value={CropType.RICE}>Rice</option>
                    <option value={CropType.WHEAT}>Wheat</option>
                    <option value={CropType.SOYBEAN}>Soybean</option>
                    <option value={CropType.MAIZE}>Maize</option>
                    <option value={CropType.PULSES}>Pulses</option>
                    <option value={CropType.MUSTARD}>Mustard</option>
                    <option value={CropType.GROUNDNUT}>Groundnut</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold block">Variety / Cultivar Name:</label>
                  <input
                    type="text"
                    value={varietyName}
                    onChange={(e) => setVarietyName(e.target.value)}
                    placeholder="e.g. Bt RCH-659 BG-II"
                    className="w-full bg-[#161f2a] border border-slate-700 px-3 py-2 text-slate-100 rounded-xs focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold block">Sowing Date:</label>
                  <input
                    type="date"
                    required
                    value={sowingDate}
                    onChange={(e) => setSowingDate(e.target.value)}
                    className="w-full bg-[#161f2a] border border-slate-700 px-3 py-2 text-slate-100 rounded-xs focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold block">Irrigation System:</label>
                  <select
                    value={irrigationType}
                    onChange={(e) => setIrrigationType(e.target.value as IrrigationType)}
                    className="w-full bg-[#161f2a] border border-slate-700 px-3 py-2 text-slate-100 rounded-xs focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value={IrrigationType.DRIP}>Drip Fertigation</option>
                    <option value={IrrigationType.SPRINKLER}>Sprinkler</option>
                    <option value={IrrigationType.FURROW}>Furrow</option>
                    <option value={IrrigationType.FLOOD}>Flood / Basin</option>
                    <option value={IrrigationType.RAINFED}>Rainfed</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold block">Soil Series:</label>
                  <select
                    value={soilType}
                    onChange={(e) => setSoilType(e.target.value as SoilType)}
                    className="w-full bg-[#161f2a] border border-slate-700 px-3 py-2 text-slate-100 rounded-xs focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value={SoilType.CLAY_LOAM}>Clay Loam</option>
                    <option value={SoilType.BLACK_CLAY}>Black Clay (Vertisol)</option>
                    <option value={SoilType.SANDY_LOAM}>Sandy Loam</option>
                    <option value={SoilType.RED_SANDY}>Red Sandy Loam</option>
                    <option value={SoilType.ALLUVIAL}>Alluvial</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-700 text-slate-300 hover:bg-slate-800 rounded-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving to Supabase...' : 'Save & Initialize Twin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
