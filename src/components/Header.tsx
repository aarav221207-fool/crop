import React, { useState } from 'react';
import { FarmTwin } from '../types/farm-twin';
import { Sparkles, Menu, X, Plus } from 'lucide-react';

export type NavTab = 
  | 'overview' 
  | 'farms' 
  | 'simulation' 
  | 'insights' 
  | 'copilot'
  | 'digital-twin'
  | 'weather' 
  | 'satellite' 
  | 'advisories'
  | 'config';

interface HeaderProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  farms: FarmTwin[];
  selectedFarmId: string;
  onSelectFarmId: (farmId: string) => void;
  alertCount: number;
  onOpenAddFarm?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  farms,
  selectedFarmId,
  onSelectFarmId,
  alertCount,
  onOpenAddFarm,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Normalized primary tabs
  const isTabActive = (tab: 'overview' | 'farms' | 'simulation' | 'insights' | 'copilot') => {
    if (tab === 'overview') return activeTab === 'overview' || activeTab === 'digital-twin' || activeTab === 'weather' || activeTab === 'satellite';
    if (tab === 'farms') return activeTab === 'farms';
    if (tab === 'simulation') return activeTab === 'simulation';
    if (tab === 'insights') return activeTab === 'insights' || activeTab === 'advisories';
    if (tab === 'copilot') return activeTab === 'copilot';
    return false;
  };

  const navItems = [
    { id: 'overview' as const, label: 'Overview', icon: '🌾' },
    { id: 'farms' as const, label: 'My Farms', icon: '📍', count: farms.length },
    { id: 'simulation' as const, label: 'Simulation', icon: '🧪' },
    { id: 'insights' as const, label: 'Insights', icon: '⚠️', count: alertCount > 0 ? alertCount : undefined },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#0c1218]/95 backdrop-blur-md border-b border-stone-800 text-stone-200 select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand Wordmark & Subtitle */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="#overview"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('overview');
            }}
            className="flex flex-col group"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                TERRATWIN
              </span>
              <span className="text-[10px] uppercase tracking-widest text-emerald-500 font-semibold px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40">
                Digital Twin
              </span>
            </div>
            <span className="text-[11px] text-stone-400 hidden sm:inline -mt-0.5">
              Agricultural Digital Twin
            </span>
          </a>
        </div>

        {/* Zone 2: Streamlined Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
          {navItems.map((item) => {
            const active = isTabActive(item.id);
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                  active
                    ? 'text-white bg-stone-800/80 border border-stone-700/60'
                    : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/40'
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span>{item.label}</span>
                {item.count !== undefined && (
                  <span
                    className={`text-xs px-1.5 py-0.2 rounded-full font-mono tabular-nums ${
                      active ? 'bg-emerald-900/60 text-emerald-300' : 'bg-stone-800 text-stone-400'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Farm Selector & Quick Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Active Farm Switcher dropdown */}
          <div className="flex items-center gap-1.5 text-xs">
            <label htmlFor="farm-selector" className="sr-only">Select Farm</label>
            <select
              id="farm-selector"
              value={selectedFarmId}
              onChange={(e) => onSelectFarmId(e.target.value)}
              className="bg-stone-900/90 border border-stone-700/80 rounded-md text-xs text-stone-200 px-2.5 py-1.5 max-w-[140px] sm:max-w-[210px] md:max-w-[250px] truncate focus:outline-hidden focus:border-emerald-500 cursor-pointer"
            >
              {farms.length === 0 ? (
                <option value="">No Farms Yet</option>
              ) : (
                farms.map((f) => (
                  <option key={f.twinId} value={f.twinId}>
                    {f.location.district} · {f.farmConfiguration.cropType.toUpperCase()}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Ask TerraTwin primary action button */}
          <button
            onClick={() => setActiveTab('copilot')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              activeTab === 'copilot'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/60'
            }`}
            title="Ask TerraTwin AI about this farm"
          >
            <span className="text-sm">🤖</span>
            <span className="hidden sm:inline">Ask TerraTwin</span>
          </button>

          {/* Add farm shortcut button */}
          {onOpenAddFarm && (
            <button
              onClick={onOpenAddFarm}
              title="Add New Farm Parcel"
              className="hidden lg:flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-stone-300 bg-stone-900/80 hover:bg-stone-800 border border-stone-700/70 rounded-md transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Farm</span>
            </button>
          )}

          {/* Mobile hamburger menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-stone-400 hover:text-white rounded-md hover:bg-stone-800 cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-stone-800 bg-[#0c1218] px-4 py-3 space-y-1">
          {navItems.map((item) => {
            const active = isTabActive(item.id);
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-md transition-colors text-left cursor-pointer ${
                  active
                    ? 'text-white bg-stone-800 border border-stone-700/80'
                    : 'text-stone-300 hover:text-white hover:bg-stone-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.count !== undefined && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-stone-800 text-stone-400 font-mono">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}

          <button
            onClick={() => {
              setActiveTab('copilot');
              setMobileMenuOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-emerald-300 bg-emerald-950/60 border border-emerald-800/60 rounded-md mt-2"
          >
            <span className="text-base">🤖</span>
            <span>Ask TerraTwin AI</span>
          </button>

          {onOpenAddFarm && (
            <button
              onClick={() => {
                onOpenAddFarm();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-stone-300 bg-stone-900 border border-stone-800 rounded-md mt-1"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Register New Farm</span>
            </button>
          )}
        </div>
      )}
    </header>
  );
};
