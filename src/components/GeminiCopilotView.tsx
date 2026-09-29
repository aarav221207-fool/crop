import React, { useState, useEffect, useRef } from 'react';
import { FarmTwin } from '../types/farm-twin';
import { WeatherData, SatelliteData, SoilData } from '../types/external-data';
import { Advisory } from '../types/advisory';
import { Language } from '../types/core';
import { ProviderStatusCode } from '../types/database';
import { supabaseRepository } from '../services/supabase-repository';
import { Send, User, RefreshCw, Trash2, AlertCircle } from 'lucide-react';

interface GeminiCopilotViewProps {
  farm?: FarmTwin | null;
  weather: WeatherData | null;
  satellite: SatelliteData | null;
  soil: SoilData | null;
  advisories: Advisory[];
  weatherStatus?: ProviderStatusCode;
  satelliteStatus?: ProviderStatusCode;
  soilStatus?: ProviderStatusCode;
  onNavigateTab: (tab: 'overview' | 'simulation' | 'weather' | 'satellite' | 'advisories') => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export const GeminiCopilotView: React.FC<GeminiCopilotViewProps> = ({
  farm,
  weather,
  satellite,
  soil,
  advisories,
  onNavigateTab,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(Language.ENGLISH);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [conversationId, setConversationId] = useState<string>('');
  const [geminiConfigured, setGeminiConfigured] = useState<boolean>(true);
  const [diagnosticError, setDiagnosticError] = useState<string>('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Exact contextual prompt suggestions requested by the user
  const contextualPrompts = [
    { label: 'Why is my crop stressed?', query: 'Why is my crop currently under biophysical stress? Break down water vs thermal factors based on the model calculation.' },
    { label: 'What changed this week?', query: 'What changed this week in terms of weather, growth stage, and soil moisture?' },
    { label: 'Explain my yield outlook', query: 'Explain my yield outlook and why the current prediction differs from optimal potential.' },
    { label: 'What happens if rainfall decreases?', query: 'What happens to this crop if rainfall decreases over the next 14 days?' },
    { label: 'Compare my farms', query: 'Compare the stress indicators and yield outlook across my registered farms.' },
    { label: 'Explain this in Hindi', query: 'फसल की वर्तमान स्थिति और अगले 48 घंटों में जरूरी कृषि कार्य विस्तार से समझाएं।' },
  ];

  // Language options
  const languages: Array<{ code: Language; label: string }> = [
    { code: Language.ENGLISH, label: 'English' },
    { code: Language.HINDI, label: 'हिन्दी (Hindi)' },
    { code: Language.TELUGU, label: 'తెలుగు (Telugu)' },
    { code: Language.MARATHI, label: 'मराठी (Marathi)' },
    { code: Language.TAMIL, label: 'தமிழ் (Tamil)' },
    { code: Language.KANNADA, label: 'ಕನ್ನಡ (Kannada)' },
    { code: Language.PUNJABI, label: 'ਪੰਜਾਬੀ (Punjabi)' },
    { code: Language.BENGALI, label: 'বাংলা (Bengali)' },
    { code: Language.GUJARATI, label: 'ગુજરાતી (Gujarati)' },
  ];

  // Check Gemini server configuration
  useEffect(() => {
    fetch('/api/gemini/status')
      .then((res) => res.json())
      .then((data) => {
        setGeminiConfigured(Boolean(data.configured));
        if (!data.configured) {
          setDiagnosticError(data.message || "Gemini isn't configured yet.");
        }
      })
      .catch(() => {
        setGeminiConfigured(false);
        setDiagnosticError("Gemini isn't configured yet.");
      });
  }, []);

  // Load farm-specific conversation from Supabase memory
  useEffect(() => {
    if (!farm) {
      setMessages([]);
      return;
    }

    let isSubscribed = true;

    async function loadFarmConversation() {
      try {
        const conv = await supabaseRepository.getOrCreateConversation(farm!.twinId);
        if (!isSubscribed) return;
        setConversationId(conv.id);

        const loadedMessages = await supabaseRepository.getMessages(conv.id);
        if (!isSubscribed) return;

        if (loadedMessages && loadedMessages.length > 0) {
          setMessages(loadedMessages);
        } else {
          // Welcome message grounded in this farm's real context
          const welcome: ChatMessage = {
            id: `msg_welcome_${farm!.twinId}`,
            role: 'assistant',
            content: `**[AI EXPLANATION] Welcome to TerraTwin AI.**
I have loaded real biophysical telemetry for **${farm!.location.district}, ${farm!.location.state}** (${farm!.farmConfiguration.cropType.toUpperCase()} · ${farm!.currentState.daysAfterPlanting} DAP).

- **Weather (Open-Meteo):** ${weather ? `${weather.current?.temperature}°C · ${weather.current?.humidity}% RH · Rain: ${weather.current?.precipitation || 0}mm` : 'Weather unavailable'}
- **Earth Observation (Copernicus Sentinel-2):** ${satellite?.vegetationIndex?.ndvi ? `NDVI ${satellite.vegetationIndex.ndvi.toFixed(2)} (Observed)` : 'Awaiting Sentinel-2 pass'}
- **Soil (ISRIC 250m Spatial Model):** ${soil ? `pH ${soil.soilProperties?.ph} · ${soil.soilProperties?.soilType}` : 'Soil data unavailable'}
- **Digital Twin Model Result:** ${farm!.currentState?.predictedYield ? `${farm!.currentState.predictedYield} kg/ha (MODEL PREDICTION)` : 'Computing baseline'}

Ask an agronomic question or select one of the contextual prompts below to begin.`,
            created_at: new Date().toISOString(),
          };
          setMessages([welcome]);
        }
      } catch (err) {
        console.warn('Error loading AI conversation for farm:', err);
      }
    }

    loadFarmConversation();

    return () => {
      isSubscribed = false;
    };
  }, [farm, weather, satellite, soil]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (customQuery?: string) => {
    const queryToSend = customQuery || inputQuery;
    if (!queryToSend.trim() || isLoading || !farm) return;

    const userMessage: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: queryToSend.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery('');
    setIsLoading(true);

    if (conversationId) {
      supabaseRepository.saveMessage({ conversationId, role: 'user', content: userMessage.content });
    }

    try {
      const res = await fetch('/api/gemini/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmTwin: farm,
          weather,
          satellite,
          soil,
          advisories,
          messages: [...messages, userMessage],
          userQuery: queryToSend,
          language: selectedLanguage,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gemini isn't configured yet.");
      }

      const assistantMessage: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (conversationId) {
        supabaseRepository.saveMessage({ conversationId, role: 'assistant', content: data.reply });
      }
    } catch (err: any) {
      const errorMessageText = err.message || "Gemini isn't configured yet.";
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Notice:** ${errorMessageText}`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (conversationId) {
      await supabaseRepository.clearConversation(conversationId);
    }
    setMessages([]);
  };

  if (!farm) {
    return (
      <div className="bg-[#11171f] border border-stone-800 rounded-xl p-12 text-center text-stone-400 space-y-4">
        <div className="text-3xl">🤖</div>
        <h2 className="text-xl font-bold text-white">No Farm Selected</h2>
        <p className="text-sm max-w-md mx-auto">
          Please select or register a farm parcel to activate TerraTwin AI decision support.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* 1. Header Bar with Farm Context & Language */}
      <div className="bg-[#11171f] border border-stone-800/80 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Ask TerraTwin
            </h1>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
              Grounded AI
            </span>
          </div>
          <p className="text-xs text-stone-400 mt-1">
            Explaining biophysical model calculations for <strong className="text-stone-200">{farm.location.district} {farm.farmConfiguration.cropType.toUpperCase()}</strong> ({farm.currentState.daysAfterPlanting} DAP)
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Language Selector */}
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value as Language)}
            className="bg-stone-900 border border-stone-700 rounded-md text-xs text-stone-200 px-2.5 py-1.5 focus:outline-hidden focus:border-emerald-500 cursor-pointer"
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>

          {/* Clear History */}
          <button
            onClick={handleClearHistory}
            className="p-1.5 text-stone-400 hover:text-stone-200 hover:bg-stone-800 border border-stone-700/60 rounded-md transition-colors cursor-pointer"
            title="Clear Chat History"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Honest Warning if Gemini Not Configured */}
      {!geminiConfigured && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/50 flex items-start gap-3 text-xs text-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-amber-300">Gemini isn't configured yet.</span>
            <p className="text-amber-200/80 mt-0.5">
              Set <code className="bg-amber-900/60 px-1 py-0.5 rounded font-mono text-[11px]">GEMINI_API_KEY</code> in your Netlify or server environment variables to enable live AI agricultural reasoning. TerraTwin never exposes API credentials to the browser.
            </p>
          </div>
        </div>
      )}

      {/* 2. Contextual Prompt Suggestions (Requirement 12) */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-medium text-stone-400 flex items-center gap-1.5">
          <span>Contextual questions for this farm:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {contextualPrompts.map((cp, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(cp.query)}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs text-stone-300 bg-[#11171f] hover:bg-stone-800 hover:text-white border border-stone-800 hover:border-stone-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {cp.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Conversation Viewport */}
      <div className="bg-[#11171f] border border-stone-800/80 rounded-xl p-4 sm:p-5 h-[480px] overflow-y-auto space-y-4">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={m.id}
              className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-7 h-7 rounded-lg bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center text-xs shrink-0 mt-0.5">
                  🤖
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-xl p-4 text-xs leading-relaxed space-y-1.5 ${
                  isUser
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-stone-900/90 border border-stone-800/90 text-stone-200'
                }`}
              >
                <div className="flex items-center justify-between gap-3 text-[10px] text-stone-400 mb-1">
                  <span className="font-semibold text-stone-300">
                    {isUser ? 'Farmer Query' : 'TerraTwin AI'}
                  </span>
                  <span className="font-mono tabular-nums">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="whitespace-pre-line font-sans text-stone-100">
                  {m.content}
                </div>
              </div>

              {isUser && (
                <div className="w-7 h-7 rounded-lg bg-stone-800 border border-stone-700 flex items-center justify-center text-stone-300 text-xs shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="w-7 h-7 rounded-lg bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center text-xs shrink-0 mt-0.5">
              🤖
            </div>
            <div className="bg-stone-900/90 border border-stone-800 rounded-xl p-3.5 text-xs text-stone-400 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              <span>Analyzing biophysical telemetry...</span>
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* 4. Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder={`Ask TerraTwin about ${farm.location.district} ${farm.farmConfiguration.cropType} (e.g. "Explain water stress", "When to irrigate?")...`}
          className="flex-1 bg-[#11171f] border border-stone-800 text-stone-200 text-sm px-4 py-3 rounded-xl focus:outline-hidden focus:border-emerald-500 placeholder:text-stone-500"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={!inputQuery.trim() || isLoading}
          className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl font-semibold text-sm transition-colors cursor-pointer flex items-center gap-2 shrink-0 shadow-xs"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Ask</span>
        </button>
      </form>
    </div>
  );
};
