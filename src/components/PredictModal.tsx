/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Trophy, Plus, Minus, Check } from 'lucide-react';
import { Match, Prediction } from '../types';
import { TRANSLATIONS, Language } from '../services/language';
import { TeamFlag } from './TeamFlag';
import { getMatchDateObject } from '../services/dateUtils';

interface PredictModalProps {
  match: Match | null;
  existingPrediction: Prediction | null;
  onClose: () => void;
  onSave: (
    matchId: string, 
    homeScore: number | null, 
    awayScore: number | null,
    predictionType: 'score' | 'winner',
    predictedWinner?: 'home' | 'away' | 'draw',
    advanceTeam?: 'home' | 'away' | null
  ) => void;
  lang: Language;
}

export default function PredictModal({
  match,
  existingPrediction,
  onClose,
  onSave,
  lang,
}: PredictModalProps) {
  const [homePredict, setHomePredict] = useState(0);
  const [awayPredict, setAwayPredict] = useState(0);
  const [predictionType, setPredictionType] = useState<'score' | 'winner'>('score');
  const [predictedWinner, setPredictedWinner] = useState<'home' | 'away' | 'draw'>('home');
  const [advanceTeam, setAdvanceTeam] = useState<'home' | 'away'>('home');
  const [isSavedSuccessfully, setIsSavedSuccessfully] = useState(false);

  const t = TRANSLATIONS[lang];

  useEffect(() => {
    if (!match) return;

    const checkMatchStartTime = () => {
      const matchDate = getMatchDateObject(match);
      const now = new Date();
      if (now >= matchDate || match.status !== 'PENDING') {
        onClose();
      }
    };

    // Run check immediately on mount
    checkMatchStartTime();

    const intervalId = setInterval(checkMatchStartTime, 1000);

    return () => clearInterval(intervalId);
  }, [match, onClose]);

  useEffect(() => {
    if (match) {
      if (existingPrediction) {
        setHomePredict(existingPrediction.homeScore ?? 0);
        setAwayPredict(existingPrediction.awayScore ?? 0);
        setPredictionType(existingPrediction.predictionType || 'score');
        setPredictedWinner(existingPrediction.predictedWinner || 'home');
        setAdvanceTeam(existingPrediction.advance_team || 'home');
      } else {
        setHomePredict(0);
        setAwayPredict(0);
        setPredictionType('score');
        setPredictedWinner('home');
        setAdvanceTeam('home');
      }
      setIsSavedSuccessfully(false);
    }
  }, [match, existingPrediction]);

  if (!match) return null;

  const handleSave = () => {
    const matchDate = getMatchDateObject(match);
    const now = new Date();
    if (now >= matchDate || match.status === 'LIVE' || match.status === 'FINISHED') {
      onClose();
      return;
    }

    const isPlayoff = match.group && (match.group.includes('1/') || match.group === 'Final' || match.group === '3rd');
    const isDraw = homePredict === awayPredict;
    const finalAdvanceTeam = (isPlayoff && isDraw && predictionType === 'score') ? advanceTeam : null;

    if (predictionType === 'winner') {
      onSave(match.id, null, null, 'winner', predictedWinner, null);
    } else {
      onSave(match.id, homePredict, awayPredict, 'score', undefined, finalAdvanceTeam);
    }
    setIsSavedSuccessfully(true);
    // Get out of the way quickly: the confirmation burst behind the sheet is
    // what acknowledges the bet now, and it starts immediately.
    setTimeout(() => {
      onClose();
    }, 220);
  };

  const isPlayoff = match.group && (match.group.includes('1/') || match.group === 'Final' || match.group === '3rd');
  const isDraw = homePredict === awayPredict;

  return (
    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-end justify-center transition-all duration-300">
      
      {/* Tap out area */}
      <div className="absolute inset-0" onClick={onClose}></div>

      {/* Slide up Drawer container */}
      <div className="relative w-full bg-[#0d1630] border-t border-slate-700/80 rounded-t-[32px] p-6 z-10 shadow-[0_-8px_30px_rgba(0,0,0,0.5)] transition-all transform animate-slide-up select-none">
        
        {/* Pull handle bar */}
        <div className="w-12 h-1 bg-slate-600 rounded-full mx-auto -mt-2 mb-4"></div>

        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-amber-400" />
            <h3 className="font-bold text-slate-100 text-sm tracking-wide">{t.makeYourPrediction}</h3>
          </div>
          <button 
            id={`btn-close-modal`}
            onClick={onClose} 
            className="w-10 h-10 rounded-full bg-slate-800/80 hover:bg-slate-700/80 active:scale-95 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Stadium context */}
        <div className="text-center mb-6">
          <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
            {match.group ? `${t.tabGroups} ${match.group}` : match.stage}
          </p>
          <p className="text-xs text-[#00E676] font-medium truncate max-w-xs mx-auto">
            {match.stadium}, {match.city}
          </p>
        </div>

        {/* EXACT SCORE PREDICTOR INTERFACE */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 mb-3 bg-[#0a0f24] p-3 rounded-2xl border border-slate-800/60 shadow-inner w-full overflow-hidden">
          
          {/* Home Team Card */}
          <div className="flex-1 flex flex-col items-center text-center w-full min-w-0">
            <TeamFlag code={match.homeTeam.code} fallback={match.homeTeam.flag} className="w-14 h-14 object-contain rounded shadow mb-1.5 shrink-0" />
            <span className="text-[11px] font-black text-slate-200 line-clamp-1 max-w-[90px]">{match.homeTeam.name}</span>
            <span className="text-[9px] text-slate-500 font-mono tracking-wider mt-0.5 mb-3">{match.homeTeam.code}</span>
            
            {/* Horizontal spacious score controls */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-full shadow-md shrink-0">
              <button
                id={`btn-home-dec`}
                onClick={() => setHomePredict(p => Math.max(0, p - 1))}
                className="w-9 h-9 rounded-full bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center active:scale-90 transition-all cursor-pointer shadow-sm shrink-0"
              >
                <Minus size={14} />
              </button>
              <span className="w-6 text-center text-base font-black text-white font-mono select-none">{homePredict}</span>
              <button
                id={`btn-home-inc`}
                onClick={() => setHomePredict(p => p + 1)}
                className="w-9 h-9 rounded-full bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/25 hover:bg-[#00E676]/20 flex items-center justify-center active:scale-90 transition-all font-bold cursor-pointer shadow-sm shrink-0"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Separation Divider Panel - Magnified scoreboard */}
          <div className="flex flex-col items-center justify-center py-2 shrink-0">
            <div className="h-4 w-[1px] bg-slate-800"></div>
            <div className="my-2 px-3 py-2 bg-slate-950/95 rounded-2xl border-2 border-[#00E676]/35 flex flex-col items-center justify-center font-mono min-w-[95px] shadow-inner shadow-emerald-500/5">
              <span className="text-amber-400 text-[9px] font-black tracking-widest uppercase mb-0.5 scale-90">{t.predicted}</span>
              <span className="text-2xl font-black text-white leading-none tracking-tight">{homePredict} : {awayPredict}</span>
            </div>
            <div className="h-4 w-[1px] bg-slate-800"></div>
          </div>

          {/* Away Team Card */}
          <div className="flex-1 flex flex-col items-center text-center w-full min-w-0">
            <TeamFlag code={match.awayTeam.code} fallback={match.awayTeam.flag} className="w-14 h-14 object-contain rounded shadow mb-1.5 shrink-0" />
            <span className="text-[11px] font-black text-slate-200 line-clamp-1 max-w-[90px]">{match.awayTeam.name}</span>
            <span className="text-[9px] text-slate-500 font-mono tracking-wider mt-0.5 mb-3">{match.awayTeam.code}</span>
            
            {/* Horizontal spacious score controls */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-full shadow-md shrink-0">
              <button
                id={`btn-away-dec`}
                onClick={() => setAwayPredict(p => Math.max(0, p - 1))}
                className="w-9 h-9 rounded-full bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center active:scale-90 transition-all cursor-pointer shadow-sm shrink-0"
              >
                <Minus size={14} />
              </button>
              <span className="w-6 text-center text-base font-black text-white font-mono select-none">{awayPredict}</span>
              <button
                id={`btn-away-inc`}
                onClick={() => setAwayPredict(p => p + 1)}
                className="w-9 h-9 rounded-full bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/25 hover:bg-[#00E676]/20 flex items-center justify-center active:scale-90 transition-all font-bold cursor-pointer shadow-sm shrink-0"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

        </div>

        {/* Small explanatory text for all matches */}
        <div className="text-center text-[10px] text-slate-400 font-semibold mb-4 select-none opacity-80">
          {lang === 'ru' 
            ? 'Счет с учетом дополнительного времени (120 мин)' 
            : 'Score includes extra time (120 mins)'}
        </div>

        {/* Playoff Draw / Penalty Shootout Toggle Block */}
        {isPlayoff && isDraw && predictionType === 'score' && (
          <div className="mb-5 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 animate-fade-in space-y-2">
            <p className="text-[10px] text-center font-bold text-slate-300 uppercase tracking-wider">
              {lang === 'ru' ? 'Кто победит в серии пенальти?' : 'Who wins the penalty shootout?'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                id="btn-advance-home"
                type="button"
                onClick={() => setAdvanceTeam('home')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-extrabold transition-all duration-200 cursor-pointer ${
                  advanceTeam === 'home'
                    ? 'bg-[#00E676]/15 border-[#00E676] text-[#00E676] shadow-[0_0_10px_rgba(0,230,118,0.15)]'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <TeamFlag code={match.homeTeam.code} fallback={match.homeTeam.flag} className="w-4 h-4 object-contain rounded-sm" />
                <span className="truncate">{match.homeTeam.name}</span>
              </button>
              <button
                id="btn-advance-away"
                type="button"
                onClick={() => setAdvanceTeam('away')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-extrabold transition-all duration-200 cursor-pointer ${
                  advanceTeam === 'away'
                    ? 'bg-[#00E676]/15 border-[#00E676] text-[#00E676] shadow-[0_0_10px_rgba(0,230,118,0.15)]'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span className="truncate">{match.awayTeam.name}</span>
                <TeamFlag code={match.awayTeam.code} fallback={match.awayTeam.flag} className="w-4 h-4 object-contain rounded-sm" />
              </button>
            </div>
          </div>
        )}

        {/* Buttons / Feedback */}
        <div className="w-full">
          {isSavedSuccessfully ? (
            <button className="w-full h-11 rounded-xl bg-emerald-500 text-white font-bold flex items-center justify-center gap-2 uppercase tracking-wide shadow-[0_4px_15px_rgba(16,185,129,0.4)] text-xs">
              <Check size={16} />
              {t.savedSuccessfully}
            </button>
          ) : (
            <button
              id={`btn-save-prediction`}
              onClick={handleSave}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black hover:brightness-110 active:scale-95 transition-all uppercase tracking-wider text-xs flex items-center justify-center shadow-[0_4px_20px_rgba(16,185,129,0.35)]"
            >
              {t.confirmForecast}
            </button>
          )}
          
          <div className="mt-4 flex justify-center gap-4 text-[9px] text-slate-400 font-semibold uppercase tracking-wide">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> {t.exactReward}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00E676]"></span> {t.outcomeReward}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
