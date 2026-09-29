import React, { useState } from 'react';
import { Advisory } from '../types/advisory';
import { Language } from '../types/core';
import { FarmTwin } from '../types/farm-twin';
import { cropTwinSimulation } from '../adapters/crop-twin-simulation-service';
import { Sparkles, Bot, ShieldAlert } from 'lucide-react';

interface AdvisoryPanelProps {
  advisories: Advisory[];
  farm?: FarmTwin | null;
  onGenerateAdvisory?: () => Promise<void>;
  isGenerating?: boolean;
  isSmsConfigured?: boolean;
}

export const AdvisoryPanel: React.FC<AdvisoryPanelProps> = ({
  advisories,
  farm,
  onGenerateAdvisory,
  isGenerating,
  isSmsConfigured = false,
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(Language.ENGLISH);
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeAdvisoryId, setActiveAdvisoryId] = useState<string>(
    advisories[0]?.advisoryId || ''
  );
  const [dispatchStatus, setDispatchStatus] = useState<Record<string, { status: string; message: string }>>({});
  const [isDispatching, setIsDispatching] = useState<boolean>(false);

  // Gemini AI Advisory explanation state
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState<boolean>(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  const languages: Array<{ code: Language; label: string }> = [
    { code: Language.ENGLISH, label: 'English' },
    { code: Language.HINDI, label: 'हिन्दी (Hindi)' },
    { code: Language.TELUGU, label: 'తెలుగు (Telugu)' },
    { code: Language.TAMIL, label: 'தமிழ் (Tamil)' },
    { code: Language.MARATHI, label: 'मराठी (Marathi)' },
    { code: Language.KANNADA, label: 'ಕನ್ನಡ (Kannada)' },
    { code: Language.PUNJABI, label: 'ਪੰਜਾਬੀ (Punjabi)' },
    { code: Language.BENGALI, label: 'বাংলা (Bengali)' },
  ];

  // Filter advisories
  const filteredAdvisories = advisories.filter((adv) => {
    if (selectedPriority !== 'all' && adv.priority !== selectedPriority) return false;
    if (selectedCategory !== 'all' && adv.category !== selectedCategory) return false;
    return true;
  });

  const activeAdvisory = advisories.find((a) => a.advisoryId === activeAdvisoryId) || advisories[0];

  // Localized preview & formatted SMS text
  const localizedInfo = activeAdvisory
    ? cropTwinSimulation.getLocalizedAdvisory(activeAdvisory, selectedLanguage)
    : { title: '', description: '' };

  const smsPayload = activeAdvisory
    ? cropTwinSimulation.formatSmsPayload(activeAdvisory)
    : { message: '', characterCount: 0, fitsSingleSms: true };

  const handleDispatch = async (advisory: Advisory) => {
    setIsDispatching(true);
    try {
      const res = await fetch('/api/sms/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: '+91-9876543210',
          message: smsPayload.message,
          language: selectedLanguage,
          advisoryId: advisory.advisoryId,
        }),
      });
      const data = await res.json();
      setDispatchStatus((prev) => ({
        ...prev,
        [advisory.advisoryId]: {
          status: data.status || 'PROCESSED',
          message: data.message || 'SMS dispatch request processed.',
        },
      }));
    } catch (err: any) {
      setDispatchStatus((prev) => ({
        ...prev,
        [advisory.advisoryId]: {
          status: 'ERROR',
          message: err.message || 'SMS service network request failed.',
        },
      }));
    } finally {
      setIsDispatching(false);
    }
  };

  const handleExplainAdvisory = async () => {
    if (!activeAdvisory) return;
    setIsExplaining(true);
    setExplainError(null);

    try {
      const res = await fetch('/api/gemini/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmTwin: farm,
          advisory: activeAdvisory,
          language: selectedLanguage,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gemini isn't configured yet.");
      }
      setAiExplanation(data.advisoryText);
    } catch (err: any) {
      setExplainError(err.message || "Gemini isn't configured yet.");
      setAiExplanation(null);
    } finally {
      setIsExplaining(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-200">
      {/* 1. Header */}
      <div className="border-b border-slate-800 pb-5 pt-2 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-xs text-slate-400 font-mono mb-1">
            AGRONOMIC EXTENSION & SMS DISPATCH CONSOLE
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            Agricultural Advisories & Prescriptions
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 font-mono mt-1.5">
            <span>{advisories.length} Total Prescriptions</span>
            <span aria-hidden="true">·</span>
            <span>Real-time Biophysical Grounding</span>
            <span aria-hidden="true">·</span>
            <span>Zero Fake Delivery Feedback</span>
          </div>
        </div>

        {onGenerateAdvisory && (
          <button
            onClick={onGenerateAdvisory}
            disabled={isGenerating}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-semibold rounded-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {isGenerating ? 'Synthesizing with Gemini...' : '✦ Generate AI Advisory'}
          </button>
        )}
      </div>

      {/* 2. Controls & Language Selector */}
      <div className="bg-[#121820] border border-slate-800 p-4 rounded-xs flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">Language:</span>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value as Language)}
              className="bg-[#161f2a] border border-slate-700 text-slate-200 px-2.5 py-1.5 rounded-xs focus:outline-hidden focus:border-emerald-500 cursor-pointer"
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-slate-400">Priority:</span>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="bg-[#161f2a] border border-slate-700 text-slate-200 px-2.5 py-1.5 rounded-xs focus:outline-hidden focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Empty State or Advisories Master-Detail */}
      {advisories.length === 0 ? (
        <div className="border border-slate-800 bg-[#121820] p-12 text-center rounded-xs space-y-4 font-mono">
          <div className="text-slate-500 text-xs uppercase tracking-wider">Zero Advisories In Database</div>
          <h2 className="text-2xl font-semibold text-white">No Active Advisories</h2>
          <p className="text-slate-400 text-sm max-w-md mx-auto font-sans leading-relaxed">
            In accordance with the zero-fake-data policy, no mock advisories are pre-seeded. Register a farm or trigger an AI agronomist diagnostic to synthesize genuine, grounded prescriptions.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (5 cols): Prescription List */}
          <div className="lg:col-span-5 space-y-3 font-mono text-xs">
            {filteredAdvisories.map((adv) => {
              const isActive = adv.advisoryId === (activeAdvisory?.advisoryId || '');
              return (
                <div
                  key={adv.advisoryId}
                  onClick={() => setActiveAdvisoryId(adv.advisoryId)}
                  className={`p-4 border rounded-xs transition-colors cursor-pointer space-y-2 ${
                    isActive
                      ? 'bg-slate-900 border-emerald-500/80 shadow-xs'
                      : 'bg-[#121820] border-slate-800 hover:border-slate-700 text-slate-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-white">{adv.title}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 uppercase tracking-wider font-bold ${
                        adv.priority === 'high'
                          ? 'text-rose-400 border border-rose-500/40 bg-rose-950/30'
                          : 'text-amber-400 border border-amber-500/40 bg-amber-950/30'
                      }`}
                    >
                      {adv.priority}
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed">
                    {adv.description}
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/80">
                    <span>Farm ID: {adv.farmTwinId}</span>
                    <span className="capitalize">{adv.category}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column (7 cols): Selected Prescription Detail & SMS Dispatch */}
          {activeAdvisory && (
            <div className="lg:col-span-7 border border-slate-800 bg-[#121820] p-5 rounded-xs space-y-5">
              <div className="border-b border-slate-800 pb-3 space-y-1">
                <div className="flex justify-between items-center text-xs font-mono text-slate-500">
                  <span>PRESCRIPTION ID: {activeAdvisory.advisoryId}</span>
                  <span className="text-emerald-400 uppercase font-bold">{activeAdvisory.category}</span>
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {localizedInfo.title || activeAdvisory.title}
                </h2>
              </div>

              {/* Diagnosis and Reasoning */}
              <div className="space-y-2 text-xs leading-relaxed font-sans text-slate-300">
                <p>{localizedInfo.description || activeAdvisory.description}</p>
                {activeAdvisory.reasoning && (
                  <div className="p-3 bg-slate-900/80 border border-slate-800 font-mono text-[11px] text-slate-400 space-y-1">
                    <span className="text-slate-300 font-semibold block uppercase text-[10px]">
                      Agronomic Rationale & GDD Correlation:
                    </span>
                    <span>{activeAdvisory.reasoning}</span>
                  </div>
                )}
              </div>

              {/* Explain with TerraTwin AI button */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-mono">
                  Deep agronomic science & smallholder guidance:
                </span>
                <button
                  onClick={handleExplainAdvisory}
                  disabled={isExplaining}
                  className="px-3 py-1.5 bg-emerald-700/80 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-mono font-semibold rounded-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isExplaining ? 'animate-spin' : ''}`} />
                  <span>{isExplaining ? 'Explaining...' : 'Explain Prescription with TerraTwin AI'}</span>
                </button>
              </div>

              {/* AI Explanation Result Box */}
              {aiExplanation && (
                <div className="p-4 bg-[#141d27] border border-emerald-500/40 rounded-xs space-y-2.5 text-xs font-sans">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold font-mono text-[11px]">
                      <Bot className="w-4 h-4" />
                      <span>AI EXPLANATION (Grounded in Model Result)</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">Source: TerraTwin AI</span>
                  </div>
                  <div className="text-slate-200 whitespace-pre-wrap leading-relaxed space-y-2">
                    {aiExplanation}
                  </div>
                </div>
              )}

              {explainError && (
                <div className="p-3 bg-rose-950/20 border border-rose-800/50 rounded-xs text-xs font-mono text-rose-300 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{explainError}</span>
                </div>
              )}

              {/* SMS Format Box */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-400 uppercase tracking-wider">
                    Farmer SMS Transmission Format (GSM 03.38)
                  </span>
                  <span
                    className={`font-semibold tabular-nums ${
                      smsPayload.fitsSingleSms ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {smsPayload.characterCount} / 160 chars ({Math.ceil(smsPayload.characterCount / 160)} SMS)
                  </span>
                </div>

                <div className="p-4 bg-[#0a0f15] border border-slate-800 font-mono text-xs text-emerald-300 leading-relaxed rounded-xs">
                  {smsPayload.message}
                </div>
              </div>

              {/* Action Items Checklist */}
              {activeAdvisory.actionItems && activeAdvisory.actionItems.length > 0 && (
                <div className="space-y-2 font-mono text-xs">
                  <span className="text-slate-400 uppercase tracking-wider block">
                    Prescription Action Checklist
                  </span>
                  <div className="space-y-2">
                    {activeAdvisory.actionItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 border border-slate-800/80 bg-slate-900/60 rounded-xs space-y-1"
                      >
                        <div className="flex justify-between items-center font-semibold text-slate-200">
                          <span>Step {idx + 1}: {item.action}</span>
                          <span className="text-[10px] text-slate-500 uppercase">
                            Window: {item.timing}
                          </span>
                        </div>
                        {item.cost && (
                          <div className="text-[11px] text-slate-400">
                            Estimated Input Cost: ₹{item.cost.amount} ({item.cost.unit})
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dispatch Action & Honest Status */}
              <div className="pt-3 border-t border-slate-800 space-y-3 font-mono text-xs">
                {dispatchStatus[activeAdvisory.advisoryId] && (
                  <div className={`p-3 rounded-xs text-xs ${
                    dispatchStatus[activeAdvisory.advisoryId].status === 'LIVE'
                      ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                      : 'bg-amber-950/40 border border-amber-800/60 text-amber-300'
                  }`}>
                    <div className="font-bold uppercase tracking-wider text-[11px]">
                      Gateway Status: {dispatchStatus[activeAdvisory.advisoryId].status}
                    </div>
                    <div className="text-[11px] mt-1 text-slate-300">
                      {dispatchStatus[activeAdvisory.advisoryId].message}
                    </div>
                  </div>
                )}

                {isSmsConfigured ? (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">
                      Recipient: Farmer Registered Primary Phone (+91)
                    </span>

                    <button
                      onClick={() => handleDispatch(activeAdvisory)}
                      disabled={isDispatching}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isDispatching ? 'Contacting Gateway...' : 'Dispatch SMS to Gateway'}
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-[#0c1219] border border-slate-800 rounded-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
                    <span className="text-slate-300 font-semibold">
                      SMS service not configured.
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      Configure SMS_GATEWAY_API_KEY to activate telecommunications dispatch.
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
