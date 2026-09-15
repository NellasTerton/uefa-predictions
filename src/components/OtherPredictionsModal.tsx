/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Award, Check, AlertCircle } from 'lucide-react';
import { CompetitionStats, Match, Prediction, UserProfile } from '../types';
import { COMPETITIONS } from '../data';
import { TRANSLATIONS, Language } from '../services/language';
import { TeamFlag } from './TeamFlag';
import { formatMatchDate, formatMatchTime } from '../services/dateUtils';

interface OtherPredictionsModalProps {
  user: UserProfile;
  predictions: { [matchId: string]: Prediction };
  matches: Match[];
  onClose: () => void;
  lang: Language;
  /** This player's points split per tournament. */
  competitionStats?: { [competition: string]: CompetitionStats };
}

export default function OtherPredictionsModal({
  user,
  predictions,
  matches,
  onClose,
  lang,
  competitionStats = {},
}: OtherPredictionsModalProps) {
  const t = TRANSLATIONS[lang];

  const hasSplit = COMPETITIONS.some(c => (competitionStats[c.id]?.settled ?? 0) > 0);

  return (
    <div className="absolute inset-0 bg-[#060c1d]/95 backdrop-blur-md z-50 flex flex-col select-none animate-fade-in text-white">
      {/* Header section */}
      <div className="px-5 py-4 bg-[#0a1128] border-b border-slate-800/80 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm font-bold shadow-inner">
            👤
          </div>
          <div>
            <h3 className="text-xs font-black text-white uppercase tracking-wider">
              {lang === 'ru' ? 'Прогнозы пользователя' : 'User Predictions'}
            </h3>
            <p className="text-xs font-black text-indigo-400 truncate max-w-[170px]">
              {user.username}
            </p>
          </div>
        </div>
        
        {/* Close Button */}
        <button
          id="btn-close-other-preds"
          onClick={onClose}
          className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-755 border border-slate-700/50 hover:border-slate-600 transition-all cursor-pointer active:scale-95"
          aria-label="Close"
        >
          <X size={16} className="text-slate-300" />
        </button>
      </div>

      {/* Stats Quick Ribbon */}
      <div className="p-4 bg-slate-900/40 border-b border-slate-800/50 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="bg-[#0b1633]/60 p-2 rounded-xl border border-indigo-500/10 shadow-sm">
          <span className="text-[9px] text-slate-500 uppercase tracking-wider block font-bold mb-0.5">
            {lang === 'ru' ? 'Очки' : 'Points'}
          </span>
          <span className="font-mono text-amber-400 font-black text-sm">
            {user.totalPoints}
          </span>
        </div>
        <div className="bg-[#0b1633]/60 p-2 rounded-xl border border-indigo-500/10 shadow-sm">
          <span className="text-[9px] text-slate-500 uppercase tracking-wider block font-bold mb-0.5">
            {lang === 'ru' ? 'Точные' : 'Exact'}
          </span>
          <span className="font-mono text-emerald-400 font-black text-sm">
            {user.exactScoresCount}
          </span>
        </div>
        <div className="bg-[#0b1633]/60 p-2 rounded-xl border border-indigo-500/10 shadow-sm">
          <span className="text-[9px] text-slate-500 uppercase tracking-wider block font-bold mb-0.5">
            {lang === 'ru' ? 'Ранг' : 'Rank'}
          </span>
          <span className="font-mono text-indigo-300 font-black text-sm">
            #{user.rank || '?'}
          </span>
        </div>
      </div>

      {/* Points split per tournament */}
      <div className="px-4 pt-3 pb-3 bg-slate-900/20 border-b border-slate-800/50">
        <span className="text-[8px] text-slate-500 uppercase tracking-widest block font-black mb-1.5">
          {t.breakdownTitle}
        </span>
        {hasSplit ? (
          <div className="grid grid-cols-3 gap-2 text-center">
            {COMPETITIONS.map((comp) => {
              const slice = competitionStats[comp.id];
              return (
                <div
                  key={comp.id}
                  className="p-2 rounded-xl border"
                  style={{ borderColor: `${comp.accent}33`, backgroundColor: `${comp.accent}0d` }}
                  title={comp.name[lang]}
                >
                  <span
                    className="text-[9px] uppercase tracking-wider block font-black mb-0.5"
                    style={{ color: comp.accent }}
                  >
                    {comp.short[lang]}
                  </span>
                  <span className="font-mono text-amber-400 font-black text-sm block leading-tight">
                    {slice?.points ?? 0}
                  </span>
                  <span className="text-[7.5px] text-slate-500 uppercase font-bold tracking-wider">
                    {slice?.exactScores ?? 0} / {slice?.correctOutcomes ?? 0}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[10px] text-slate-500 italic py-1">{t.breakdownEmpty}</p>
        )}
      </div>

      {/* Matches scroll area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5 pb-24">
        {matches.filter((m) => predictions[m.id] !== undefined).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500 gap-2">
            <AlertCircle size={32} className="text-slate-600" />
            <p className="text-xs font-semibold">{lang === 'ru' ? 'Нет прогнозов' : 'No predictions yet'}</p>
          </div>
        ) : (
          matches.filter((match) => predictions[match.id] !== undefined).map((match) => {
            const pred = predictions[match.id];
            
            // Translate team names dynamically based on code or language
            const homeTrans = lang === 'ru' ? (match.homeTeam.id === 'RUS' ? 'Россия' : match.homeTeam.name) : match.homeTeam.name;
            const awayTrans = lang === 'ru' ? (match.awayTeam.id === 'RUS' ? 'Россия' : match.awayTeam.name) : match.awayTeam.name;

            const isFinished = match.status === 'FINISHED';

            return (
              <div 
                key={match.id}
                className={`p-3 rounded-2xl bg-[#0a1128] border transition-all ${
                  pred 
                    ? isFinished
                      ? pred.pointsEarned === 5
                        ? 'border-amber-500/40 shadow-md shadow-amber-500/5 bg-[#141d21]'
                        : pred.pointsEarned === 2
                          ? 'border-emerald-500/30 bg-[#0d2218]'
                          : 'border-slate-800/80'
                      : 'border-indigo-500/30'
                    : 'border-slate-900/60 opacity-70'
                }`}
              >
                {/* Match stage/time tag row */}
                <div className="flex justify-between items-center text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-2.5">
                  <span>{lang === 'ru' ? `Группа ${match.group}` : `Group ${match.group}`}</span>
                  <span>{formatMatchDate(match, lang)}</span>
                </div>

                {/* Main teams block */}
                <div className="grid grid-cols-5 items-center gap-1 text-center py-1 select-none">
                  
                  {/* Home Team */}
                  <div className="col-span-2 flex items-center justify-start gap-2 text-left">
                    <TeamFlag code={match.homeTeam.code} fallback={match.homeTeam.flag} className="w-6 h-6 object-contain rounded-sm shadow-sm" />
                    <span className="text-[11px] font-bold text-slate-200 truncate">{homeTrans}</span>
                  </div>

                  {/* True Score result in middle */}
                  <div className="col-span-1 flex flex-col items-center justify-center">
                    {isFinished ? (
                      <span className="font-mono text-xs font-black bg-slate-950/85 px-2 py-0.5 border border-slate-800 rounded-md text-emerald-400">
                        {match.homeScore}-{match.awayScore}
                      </span>
                    ) : (
                      <span className="font-mono text-[9px] font-black text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800/80">
                        {formatMatchTime(match, lang)}
                      </span>
                    )}
                  </div>

                  {/* Away Team */}
                  <div className="col-span-2 flex items-center justify-end gap-2 text-right">
                    <span className="text-[11px] font-bold text-slate-200 truncate">{awayTrans}</span>
                    <TeamFlag code={match.awayTeam.code} fallback={match.awayTeam.flag} className="w-6 h-6 object-contain rounded-sm shadow-sm" />
                  </div>

                </div>

                {/* Bottom detail row tracking their stake */}
                <div className="mt-2.5 pt-2 border-t border-slate-900/60 flex justify-between items-center bg-slate-950/20 p-1.5 rounded-xl">
                  <div className="text-[10px] text-slate-400">
                    {pred ? (
                      <span className="text-indigo-300 font-semibold flex items-center gap-1.5">
                        <Check size={11} className="text-indigo-400" />
                        <span>
                          {t.forecast}:{' '}
                          <strong className="font-bold bg-indigo-500/10 px-1.5 py-0.5 border border-indigo-500/15 rounded text-indigo-400">
                            {pred.predictionType === 'winner' ? (
                              pred.predictedWinner === 'home' ? (
                                <span className="inline-flex items-center gap-1">
                                  <TeamFlag code={match.homeTeam.code} fallback={match.homeTeam.flag} className="w-4 h-4 object-contain rounded-sm shadow-sm" />
                                  <span>{t.winText}</span>
                                </span>
                              ) : pred.predictedWinner === 'away' ? (
                                <span className="inline-flex items-center gap-1">
                                  <TeamFlag code={match.awayTeam.code} fallback={match.awayTeam.flag} className="w-4 h-4 object-contain rounded-sm shadow-sm" />
                                  <span>{t.winText}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1">
                                  <span>🤝</span>
                                  <span>{t.drawText}</span>
                                </span>
                              )
                            ) : (
                              <span className="font-mono">{pred.homeScore}-{pred.awayScore}</span>
                            )}
                          </strong>
                        </span>
                      </span>
                    ) : (
                      <span className="text-slate-500 italic text-[9px]">
                        {lang === 'ru' ? 'Нет прогноза' : 'No forecast predicted'}
                      </span>
                    )}
                  </div>

                  {/* Points earned badge */}
                  {pred && isFinished && (
                    <span className={`px-2 py-0.5 rounded font-black text-[8px] font-mono tracking-wider ${
                      pred.pointsEarned === 5 
                        ? 'bg-amber-400/15 text-amber-400 border border-amber-500/25 shadow-sm shadow-amber-500/5' 
                        : pred.pointsEarned === 2
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-800 text-slate-500 border border-slate-700/30'
                    }`}>
                      +{pred.pointsEarned ?? 0} {t.pts.toUpperCase()}
                    </span>
                  )}
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* Persistent Back button bar */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-[#0a1128] border-t border-slate-800/80 z-30 flex gap-3">
        <button
          id="btn-bottom-close-other-preds"
          onClick={onClose}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:brightness-105 inline-flex items-center justify-center text-xs font-black uppercase tracking-wider text-white select-none active:scale-98 cursor-pointer shadow-md transition-all"
        >
          ← {lang === 'ru' ? 'Назад в рейтинг' : 'Back to predictors'}
        </button>
      </div>

    </div>
  );
}
