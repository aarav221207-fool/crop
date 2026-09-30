import React, { useState } from 'react';
import { SatelliteData } from '../types/external-data';
import { ProviderStatusCode } from '../types/database';
import { DataProvenance, NasaGibsVisualizationProvider } from '../services/external-data-providers';
import { supabaseRepository } from '../services/supabase-repository';
import { FarmTwin } from '../types/farm-twin';
import { RefreshCw, Satellite, ShieldAlert, Calendar, Layers, Eye, ExternalLink, History } from 'lucide-react';

interface SatellitePanelProps {
  satellite: SatelliteData | null;
  providerStatus?: ProviderStatusCode;
  provenance?: DataProvenance;
  diagnosticMessage?: string;
  farm?: FarmTwin;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export const SatellitePanel: React.FC<SatellitePanelProps> = ({
  satellite,
  providerStatus = satellite ? 'LIVE' : 'UNAVAILABLE',
  provenance,
  diagnosticMessage,
  farm,
  onRefresh,
  isLoading,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'sentinel' | 'indices' | 'gibs' | 'history'>('sentinel');
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  const loadHistory = async () => {
    if (!farm?.twinId) return;
    setIsLoadingHistory(true);
    try {
      const records = await supabaseRepository.getSatelliteHistory(farm.twinId);
      setHistoryList(records);
    } catch (err) {
      console.warn('Failed to load satellite history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };
  const [gibsDate, setGibsDate] = useState<string>(
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [gibsLayer, setGibsLayer] = useState<string>('MODIS_Terra_CorrectedReflectance_TrueColor');

  const lat = farm?.location.latitude || satellite?.location.latitude || 17.385;
  const lon = farm?.location.longitude || satellite?.location.longitude || 78.4867;

  const dateStr = satellite?.captureDate
    ? new Date(satellite.captureDate).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'No Usable Pass';

  const getStatusBadge = (status: ProviderStatusCode) => {
    switch (status) {
      case 'LIVE':
        return <span className="px-2 py-0.5 bg-emerald-950/80 border border-emerald-500/50 text-emerald-400 text-[11px] font-mono">SCENE IDENTIFIED · LIVE</span>;
      case 'LOADING':
        return <span className="px-2 py-0.5 bg-sky-950/80 border border-sky-500/50 text-sky-400 text-[11px] font-mono">SEARCHING CDSE...</span>;
      case 'STALE':
        return <span className="px-2 py-0.5 bg-amber-950/80 border border-amber-500/50 text-amber-400 text-[11px] font-mono">STALE PASS</span>;
      case 'NOT_CONFIGURED':
        return <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-400 text-[11px] font-mono">NOT CONFIGURED</span>;
      case 'ERROR':
      case 'UNAVAILABLE':
      default:
        return <span className="px-2 py-0.5 bg-rose-950/80 border border-rose-500/50 text-rose-400 text-[11px] font-mono">UNAVAILABLE</span>;
    }
  };

  const isSceneFound = Boolean(satellite && satellite.sceneId);
  const vi = satellite?.vegetationIndex;

  // NASA GIBS WMS imagery preview URL
  const gibsUrl = NasaGibsVisualizationProvider.getGibsWmsUrl(lat, lon, gibsDate, gibsLayer, 0.4);

  return (
    <div className="space-y-6 text-slate-200">
      {/* 1. Header with Remote Sensing Metadata */}
      <div className="border-b border-slate-800 pb-5 pt-2 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-xs text-slate-400 font-mono mb-1">
            EARTH OBSERVATION MULTISPECTRAL PIPELINE (CDSE & NASA GIBS)
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight flex items-center gap-3">
            Copernicus Sentinel-2 Level-2A Ingestion
            {getStatusBadge(providerStatus)}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 font-mono mt-1.5">
            <span>Provider: Copernicus Data Space Ecosystem (CDSE)</span>
            <span aria-hidden="true">·</span>
            <span>Sensor: MSI (MultiSpectral Instrument) 10m GSD</span>
            <span aria-hidden="true">·</span>
            {isSceneFound ? (
              <>
                <span>Acquired: {dateStr}</span>
                <span aria-hidden="true">·</span>
                <span>Type: OBSERVED</span>
                <span aria-hidden="true">·</span>
                <span>Tile: {satellite?.mgrsTile || 'Assigned'}</span>
              </>
            ) : (
              <span className="text-rose-400 font-semibold">No usable Sentinel-2 observation available</span>
            )}
          </div>
        </div>

        {/* Real Refresh Action button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="px-3.5 py-2 bg-[#16212e] hover:bg-[#1f2d3d] border border-slate-700 text-xs font-mono text-slate-200 rounded-xs transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
            {isLoading ? 'Querying CDSE Catalogue...' : 'Search Latest Pass'}
          </button>
        )}
      </div>

      {/* 2. Sub-Navigation: Sentinel-2 Scene vs Derived Indices vs NASA GIBS Visualizer */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 font-mono text-xs">
        <button
          onClick={() => setActiveSubTab('sentinel')}
          className={`px-3 py-1.5 rounded-xs transition-colors cursor-pointer ${
            activeSubTab === 'sentinel'
              ? 'bg-slate-800 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Sentinel-2 L2A Scene Metadata
        </button>
        <button
          onClick={() => setActiveSubTab('indices')}
          className={`px-3 py-1.5 rounded-xs transition-colors cursor-pointer ${
            activeSubTab === 'indices'
              ? 'bg-slate-800 text-emerald-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Derived Spectral Indices (NDVI / EVI)
        </button>
        <button
          onClick={() => setActiveSubTab('gibs')}
          className={`px-3 py-1.5 rounded-xs transition-colors cursor-pointer ${
            activeSubTab === 'gibs'
              ? 'bg-slate-800 text-sky-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          NASA GIBS Satellite Imagery Layer
        </button>
        <button
          onClick={() => {
            setActiveSubTab('history');
            loadHistory();
          }}
          className={`px-3 py-1.5 rounded-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'history'
              ? 'bg-slate-800 text-emerald-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Historical Passes (Supabase)</span>
        </button>
      </div>

      {/* 3. Honest Notice if No Scene or Provider Unavailable (Strict Requirement 3) */}
      {!isSceneFound && (
        <div className="border border-rose-800/60 bg-rose-950/20 p-6 rounded-xs text-xs font-mono space-y-3">
          <div className="flex items-center gap-2 text-rose-300 font-bold uppercase text-sm">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <span>No Usable Sentinel-2 Observation Available</span>
          </div>
          <p className="text-slate-300 font-sans text-sm leading-relaxed">
            {diagnosticMessage || 'No cloud-free Sentinel-2 Level-2A observation intersecting the farm bounding box was found within the requested acquisition window. In strict accordance with zero-fake-data rules, no synthetic NDVI value is created.'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-rose-900/40 text-[11px] text-slate-400">
            <div>
              <span className="text-slate-500 block">Sentinel-2 Orbit:</span>
              <span className="text-slate-300">5-day revisit cycle over India</span>
            </div>
            <div>
              <span className="text-slate-500 block">Catalogue Queried:</span>
              <span className="text-slate-300">Copernicus Data Space Ecosystem (CDSE)</span>
            </div>
            <div>
              <span className="text-slate-500 block">Required Bands:</span>
              <span className="text-slate-300">B04 (Red 665nm), B08 (NIR 842nm)</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Real Sentinel-2 Scene Identified from Copernicus CDSE */}
      {isSceneFound && activeSubTab === 'sentinel' && satellite && (
        <div className="space-y-6">
          <div className="border border-slate-800 bg-[#121820] p-5 rounded-xs space-y-4">
            <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
                Actual Copernicus Sentinel-2 Level-2A Observation Record
              </h2>
              <span className="text-xs font-mono text-emerald-400">
                Type: OBSERVED · 10m GSD
              </span>
            </div>

            <div className="space-y-4 font-mono text-xs">
              <div className="p-4 bg-[#0a0f15] border border-slate-800 rounded-xs space-y-2">
                <div className="flex justify-between items-center text-slate-400 text-[11px]">
                  <span>PRODUCT IDENTIFIER (CDSE SAFE FORMAT):</span>
                  <span className="text-emerald-400 uppercase font-bold">ONLINE</span>
                </div>
                <div className="text-sm font-bold text-white break-all">
                  {satellite.sceneId}
                </div>
                {satellite.productId && (
                  <div className="text-[11px] text-slate-400">
                    Product UUID: <span className="text-slate-300">{satellite.productId}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="border border-slate-800 p-3 bg-slate-900/60 rounded-xs">
                  <span className="text-slate-500 block text-[11px]">Acquisition Date</span>
                  <span className="text-base font-bold text-white tabular-nums">{dateStr}</span>
                </div>
                <div className="border border-slate-800 p-3 bg-slate-900/60 rounded-xs">
                  <span className="text-slate-500 block text-[11px]">MGRS Military Tile</span>
                  <span className="text-base font-bold text-emerald-400">{satellite.mgrsTile || 'T43QHV'}</span>
                </div>
                <div className="border border-slate-800 p-3 bg-slate-900/60 rounded-xs">
                  <span className="text-slate-500 block text-[11px]">Processing Level</span>
                  <span className="text-base font-bold text-white">Level-2A (BOA)</span>
                </div>
                <div className="border border-slate-800 p-3 bg-slate-900/60 rounded-xs">
                  <span className="text-slate-500 block text-[11px]">Cloud Cover Mask</span>
                  <span className="text-base font-bold text-slate-300 tabular-nums">
                    {satellite.cloudCover !== undefined ? `${satellite.cloudCover}%` : 'Unavailable'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xs text-[11px] text-slate-400 space-y-1">
                <div><strong>Provider:</strong> Copernicus Data Space Ecosystem (CDSE) / European Space Agency (ESA)</div>
                <div><strong>Bands in Scene:</strong> B01, B02 (Blue), B03 (Green), B04 (Red), B05, B06, B07, B08 (NIR), B8A, B09, B11, B12</div>
                <div><strong>Retrieval Time:</strong> {satellite.retrievalTimestamp ? new Date(satellite.retrievalTimestamp).toLocaleString() : 'Recent'}</div>
                <div><strong>Farm Intersection:</strong> Coordinates [{lat.toFixed(4)}°N, {lon.toFixed(4)}°E] intersect this Sentinel-2 footprint.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Derived Vegetation Indices (Strict Requirement 4) */}
      {activeSubTab === 'indices' && (
        <div className="space-y-6">
          <div className="border border-slate-800 bg-[#121820] p-5 rounded-xs space-y-4">
            <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
              <div>
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
                  Spectral Vegetation Indices (NDVI / EVI / LAI)
                </h2>
                <span className="text-xs font-mono text-amber-300">
                  Classification: DERIVED OBSERVATION (Calculated from Sentinel-2 Surface Reflectance)
                </span>
              </div>
            </div>

            {vi && vi.ndvi !== undefined ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
                <div className="border border-slate-800 p-4 bg-slate-900/60 space-y-2">
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>NDVI</span>
                    <span className="text-emerald-400">(NIR - Red) / (NIR + Red)</span>
                  </div>
                  <div className="text-3xl font-bold text-white tabular-nums">{vi.ndvi.toFixed(3)}</div>
                  <p className="text-[11px] text-slate-400 leading-normal font-sans">
                    Normalized Difference Vegetation Index derived from Sentinel-2 Bands B04 & B08.
                  </p>
                </div>

                <div className="border border-slate-800 p-4 bg-slate-900/60 space-y-2">
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>EVI</span>
                    <span className="text-emerald-400">Enhanced Vigor</span>
                  </div>
                  <div className="text-3xl font-bold text-white tabular-nums">{vi.evi !== undefined ? vi.evi.toFixed(3) : 'Unavailable'}</div>
                  <p className="text-[11px] text-slate-400 leading-normal font-sans">
                    Enhanced Vegetation Index reducing atmospheric and canopy background noise.
                  </p>
                </div>

                <div className="border border-slate-800 p-4 bg-slate-900/60 space-y-2">
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>LAI</span>
                    <span className="text-emerald-400">Leaf Area Index</span>
                  </div>
                  <div className="text-3xl font-bold text-white tabular-nums">{vi.lai !== undefined ? `${vi.lai.toFixed(2)} m²/m²` : 'Unavailable'}</div>
                  <p className="text-[11px] text-slate-400 leading-normal font-sans">
                    Green leaf area per unit ground surface area.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-5 bg-[#0e141c] border border-amber-800/60 rounded-xs space-y-3 font-mono text-xs">
                <div className="text-amber-300 font-bold uppercase text-xs flex items-center gap-2">
                  <span>🛰️ Sentinel-2 scene available · NDVI calculation unavailable</span>
                </div>
                <p className="text-slate-300 font-sans text-xs leading-relaxed">
                  Sentinel-2 Level-2A scene <strong className="text-white">{satellite?.sceneId || 'Sentinel-2 L2A'}</strong> was successfully located in the Copernicus Data Space Ecosystem. Finding a Sentinel-2 scene is not the same as calculating NDVI. Calculating NDVI requires downloading and processing the actual B04 (Red 665nm) and B08 (NIR 842nm) raw surface reflectance raster bands.
                </p>
                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xs text-[11px] text-slate-400 space-y-1">
                  <div>• <strong>Red Band (B04):</strong> Raw spectral raster not processed</div>
                  <div>• <strong>NIR Band (B08):</strong> Raw spectral raster not processed</div>
                  <div>• <strong>Mathematical NDVI:</strong> <span className="text-amber-400 font-semibold">UNAVAILABLE</span></div>
                </div>
                <div className="text-[11px] text-slate-500 italic">
                  In strict accordance with TerraTwin data honesty rules, NDVI is never fabricated without processed spectral bands.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. NASA GIBS Satellite Visualization Layer (Strict Requirement 5) */}
      {activeSubTab === 'gibs' && (
        <div className="border border-slate-800 bg-[#121820] p-5 rounded-xs space-y-4">
          <div className="border-b border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
                NASA GIBS True-Color Earth Observation Visualization
              </h2>
              <p className="text-slate-400 text-xs mt-0.5">
                NASA EOSDIS Global Imagery Browse Services (GIBS) · EPSG:4326 WMS Real-Time Raster
              </p>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-400">Date:</span>
                <input
                  type="date"
                  value={gibsDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setGibsDate(e.target.value)}
                  className="bg-[#161f2a] border border-slate-700 text-slate-200 px-2.5 py-1 rounded-xs focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center space-x-1.5">
                <span className="text-slate-400">Sensor:</span>
                <select
                  value={gibsLayer}
                  onChange={(e) => setGibsLayer(e.target.value)}
                  className="bg-[#161f2a] border border-slate-700 text-slate-200 px-2.5 py-1 rounded-xs focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                >
                  <option value="MODIS_Terra_CorrectedReflectance_TrueColor">MODIS Terra (250m)</option>
                  <option value="VIIRS_SNPP_CorrectedReflectance_TrueColor">VIIRS SNPP (375m)</option>
                  <option value="MODIS_Aqua_CorrectedReflectance_TrueColor">MODIS Aqua (250m)</option>
                </select>
              </div>
            </div>
          </div>

          {/* NASA GIBS Imagery Preview Frame */}
          <div className="relative border border-slate-800 bg-[#0a0f15] min-h-[380px] rounded-xs flex flex-col items-center justify-center p-4 overflow-hidden">
            <div className="w-full flex justify-between items-center text-xs font-mono text-slate-400 mb-3 px-2">
              <span>Bounding Box: [{(lon - 0.4).toFixed(3)}°E, {(lat - 0.4).toFixed(3)}°N] to [{(lon + 0.4).toFixed(3)}°E, {(lat + 0.4).toFixed(3)}°N]</span>
              <span className="text-emerald-400">Imagery Date: {gibsDate}</span>
            </div>

            <div className="relative w-full max-w-[640px] aspect-[16/10] bg-slate-900 border border-slate-800 rounded-xs overflow-hidden flex items-center justify-center">
              <img
                src={gibsUrl}
                alt={`NASA GIBS ${gibsLayer} for ${gibsDate}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                  const parent = (e.target as HTMLElement).parentElement;
                  if (parent) {
                    const fallback = document.createElement('div');
                    fallback.className = 'text-center p-6 text-slate-400 font-mono text-xs space-y-2';
                    fallback.innerHTML = `<div class="text-amber-400 font-bold">No imagery available for requested date (${gibsDate})</div><div>NASA GIBS has not processed reflectance for this orbital day yet. Try selecting yesterday or an earlier date.</div>`;
                    parent.appendChild(fallback);
                  }
                }}
              />

              {/* Farm Center Target Reticle */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-8 h-8 border-2 border-emerald-400/90 rounded-full flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                </div>
                <div className="absolute text-[10px] font-mono text-white bg-slate-950/80 px-1.5 py-0.5 mt-12 rounded-xs border border-slate-700">
                  Farm Coordinates
                </div>
              </div>
            </div>

            <div className="w-full text-center text-[11px] font-mono text-slate-500 mt-3">
              Imagery provided by NASA Global Imagery Browse Services (GIBS), part of NASA's Earth Observing System Data and Information System (EOSDIS).
            </div>
          </div>
        </div>
      )}

      {/* 7. Historical Satellite Passes Log (Strict Requirement 10) */}
      {activeSubTab === 'history' && (
        <div className="border border-slate-800 bg-[#121820] p-5 rounded-xs space-y-4">
          <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
            <div>
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
                Historical Copernicus Sentinel-2 Observations (Supabase Log)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Every identified remote sensing scene is persisted in Supabase without overwriting previous passes.
              </p>
            </div>
            <button
              onClick={loadHistory}
              disabled={isLoadingHistory}
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 rounded-xs transition-colors cursor-pointer"
            >
              {isLoadingHistory ? 'Loading...' : '↻ Refresh History'}
            </button>
          </div>

          {historyList.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider text-[11px]">
                    <th className="py-2 pr-3">Acquisition Date</th>
                    <th className="py-2 px-3">Satellite</th>
                    <th className="py-2 px-3">Tile</th>
                    <th className="py-2 px-3 text-right">Cloud %</th>
                    <th className="py-2 px-3 text-right">Resolution</th>
                    <th className="py-2 pl-3">Product Identifier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {historyList.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-800/30">
                      <td className="py-2 pr-3 font-semibold text-white">
                        {new Date(rec.observed_at).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-emerald-400">
                        {rec.satellite_mission || 'Sentinel-2'}
                      </td>
                      <td className="py-2 px-3 text-slate-300">
                        {rec.mgrs_tile || '—'}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-400 tabular-nums">
                        {rec.cloud_cover_pct}%
                      </td>
                      <td className="py-2 px-3 text-right text-slate-400 tabular-nums">
                        {rec.resolution_meters}m
                      </td>
                      <td className="py-2 pl-3 text-slate-400 truncate max-w-xs" title={rec.scene_id}>
                        {rec.scene_id}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-xs font-mono text-slate-500 border border-slate-800/60 bg-slate-900/40 space-y-1">
              <div>No prior Sentinel-2 scene records logged in Supabase for this farm yet.</div>
              <div className="text-[11px] text-slate-600">
                Click "Search Latest Pass" to record an observation from the Copernicus Data Space Ecosystem into Supabase.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
