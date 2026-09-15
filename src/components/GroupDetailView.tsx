/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, ChevronLeft, ChevronRight, Trophy, Calendar } from 'lucide-react';
import { Group, Match, Prediction } from '../types';
import { Language, TRANSLATIONS } from '../services/language';
import { TeamFlag } from './TeamFlag';
import { formatMatchDate, formatMatchTime, getMatchDateObject } from '../services/dateUtils';

interface GroupDetailViewProps {
  groups: Group[];
  activeGroupId: string;
  onGroupIdChange: (id: string) => void;
  matches: Match[];
  userPredictions: { [matchId: string]: Prediction };
  onPredictClick: (match: Match) => void;
  onClose: () => void;
  lang: Language;
}

export default function GroupDetailView({
  groups,
  activeGroupId,
  onGroupIdChange,
  matches,
  userPredictions,
  onPredictClick,
  onClose,
  lang,
}: GroupDetailViewProps) {
  
  const activeIndex = groups.findIndex((g) => g.id === activeGroupId);
  const currentGroup = groups[activeIndex] || groups[0];
  const t = TRANSLATIONS[lang];

  const handlePrevGroup = () => {
    const prevIndex = (activeIndex - 1 + groups.length) % groups.length;
    onGroupIdChange(groups[prevIndex].id);
  };

  const handleNextGroup = () => {
    const nextIndex = (activeIndex + 1) % groups.length;
    onGroupIdChange(groups[nextIndex].id);
  };

  // Get matches belonging to this group
  const groupMatches = matches.filter((m) => m.group === currentGroup.id);

  // Render form circles
  const renderFormBadges = (form: ('W' | 'D' | 'L')[]) => {
    return (
      <div className="flex gap-1">
        {form.slice(-3).map((result, i) => {
          let bg = 'bg-slate-700';
          if (result === 'W') bg = 'bg-emerald-500 text-white';
          if (result === 'D') bg = 'bg-amber-500 text-white';
          if (result === 'L') bg = 'bg-rose-500 text-white';
          return (
            <span
              key={i}
              className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black leading-none ${bg}`}
            >
              {result}
            </span>
          );
        })}
        {form.length === 0 && <span className="text-[10px] text-slate-500">—</span>}
      </div>
    );
  };

  return (
    <div className="absolute inset-0 bg-[#080d1e] z-40 flex flex-col animate-fade-in text-white">
      
      {/* Detail Header area */}
      <div className="p-4 bg-[#0a1128] border-b border-slate-800 flex items-center justify-between">
        
        {/* Back/Close Button */}
        <button
          id={`btn-close-group-detail`}
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#00E676] font-bold uppercase tracking-wider transition-colors"
        >
          <X size={18} />
          <span>{t.back}</span>
        </button>

        {/* Title */}
        <div className="flex items-center gap-1.5 bg-slate-900/60 px-3 py-1 rounded-full border border-slate-800">
          <Trophy size={14} className="text-amber-500" />
          <span className="text-xs font-bold text-amber-500 tracking-wide">{t.detailedStandings}</span>
        </div>
        
        <div className="w-8"></div>
      </div>

      {/* Interactive Carousel Bar */}
      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-[#0d1632] via-[#091024] to-[#0d1632] border-b border-rose-500/10">
        
        <div className="w-10">
          {groups.length > 1 && (
            <button
              id={`btn-group-nav-prev`}
              onClick={handlePrevGroup}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-900/80 hover:bg-slate-800 border border-slate-800 active:scale-95 transition-all text-slate-300"
            >
              <ChevronLeft size={20} />
            </button>
          )}
        </div>

        <div className="text-center">
          <h2 
            className="text-xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-white"
            style={{ textShadow: `0 0 10px ${currentGroup.color}25` }}
          >
            {currentGroup.id === 'LEAGUE' && lang === 'ru' ? 'Общий этап' : 
             currentGroup.id === 'LEAGUE' && lang === 'en' ? 'League Phase' : currentGroup.name}
          </h2>
          <div className="inline-block px-2.5 py-0.5 mt-1 rounded text-[9px] font-bold text-white tracking-widest uppercase" style={{ backgroundColor: `${currentGroup.color}25`, border: `1px solid ${currentGroup.color}40` }}>
            {lang === 'ru' ? 'ЛИГА ЧЕМПИОНОВ УЕФА' : 'UEFA CHAMPIONS LEAGUE'}
          </div>
        </div>

        <div className="w-10">
          {groups.length > 1 && (
            <button
              id={`btn-group-nav-next`}
              onClick={handleNextGroup}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-900/80 hover:bg-slate-800 border border-slate-800 active:scale-95 transition-all text-slate-300"
            >
              <ChevronRight size={20} />
            </button>
          )}
        </div>

      </div>

      {/* Main detail content (Scrollable area) */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 scrollbar-thin">
        
        {/* Table representation */}
        <div className="bg-[#0b1227] rounded-2xl border border-slate-800/85 overflow-hidden shadow-lg">
          <div className="px-4 py-3 bg-[#0a1128] border-b border-slate-800/70 flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">{t.posTeam}</span>
            <div className="flex items-center gap-3.5 text-[9px] font-bold text-slate-400 tracking-wider">
              <span className="w-4 text-center">{t.playedAbbr}</span>
              <span className="w-6 text-center">{t.gdAbbr}</span>
              <span className="w-8 text-center">{t.ptsAbbr}</span>
            </div>
          </div>

          <div className="divide-y divide-slate-800/60">
            {currentGroup.standings.map((stat, index) => {
              const team = currentGroup.teams.find((t) => t.id === stat.teamId) || { id: 'UNK', name: 'Unknown', flag: '🏳️', code: 'UNK' };
              const isPromo = index < 2; // top 2 progress
              
              const localizedTeamName = lang === 'ru' ? (
                team.id === 'MEX' ? 'Мексика' :
                team.id === 'RSA' ? 'ЮАР' :
                team.id === 'KOR' ? 'Южная Корея' :
                team.id === 'CZE' ? 'Чехия' :
                team.id === 'CAN' ? 'Канада' :
                team.id === 'BIH' ? 'Босния и Герц.' :
                team.id === 'QAT' ? 'Катар' :
                team.id === 'SUI' ? 'Швейцария' :
                team.id === 'BRA' ? 'Бразилия' :
                team.id === 'MAR' ? 'Марокко' :
                team.id === 'HAI' ? 'Гаити' :
                team.id === 'SCO' ? 'Шотландия' :
                team.id === 'USA' ? 'США' :
                team.id === 'PAR' ? 'Парагвай' :
                team.id === 'AUS' ? 'Австралия' :
                team.id === 'TUR' ? 'Турция' :
                team.id === 'GER' ? 'Германия' :
                team.id === 'CUW' ? 'Кюрасао' :
                team.id === 'CIV' ? 'Кот-д\'Ивуар' :
                team.id === 'ECU' ? 'Эквадор' :
                team.id === 'NED' ? 'Нидерланды' :
                team.id === 'JPN' ? 'Япония' :
                team.id === 'SWE' ? 'Швеция' :
                team.id === 'TUN' ? 'Тунис' :
                team.id === 'BEL' ? 'Бельгия' :
                team.id === 'EGY' ? 'Египет' :
                team.id === 'IRN' ? 'Иран' :
                team.id === 'NZL' ? 'Новая Зеландия' :
                team.id === 'ESP' ? 'Испания' :
                team.id === 'CPV' ? 'Кабо-Верде' :
                team.id === 'KSA' ? 'Саудовская Аравия' :
                team.id === 'URU' ? 'Уругвай' :
                team.id === 'FRA' ? 'Франция' :
                team.id === 'SEN' ? 'Сенегал' :
                team.id === 'IRQ' ? 'Ирак' :
                team.id === 'NOR' ? 'Норвегия' :
                team.id === 'ARG' ? 'Аргентина' :
                team.id === 'ALG' ? 'Алжир' :
                team.id === 'AUT' ? 'Австрия' :
                team.id === 'JOR' ? 'Иордания' :
                team.id === 'POR' ? 'Португалия' :
                team.id === 'COD' ? 'ДР Конго' :
                team.id === 'UZB' ? 'Узбекистан' :
                team.id === 'COL' ? 'Колумбия' :
                team.id === 'ENG' ? 'Англия' :
                team.id === 'CRO' ? 'Хорватия' :
                team.id === 'GHA' ? 'Гана' :
                team.id === 'PAN' ? 'Панама' : team.name
              ) : team.name;

              return (
                <div key={stat.teamId} className="px-4 py-3.5 flex items-center justify-between hover:bg-slate-800/20 transition-all">
                  
                  {/* Position + Team */}
                  <div className="flex items-center gap-2.5">
                    <span className={`w-4 text-xs font-black font-mono text-center ${isPromo ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {index + 1}
                    </span>
                    <TeamFlag code={team.code} fallback={team.flag} className="w-6 h-6 object-contain rounded-sm shadow-sm" />
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-slate-100 line-clamp-1 max-w-[120px]">{localizedTeamName}</span>
                      <span className="text-[8px] text-slate-500 font-mono tracking-wide">{team.code}</span>
                    </div>
                  </div>

                  {/* Stats columns */}
                  <div className="flex items-center gap-3.5 text-xs font-bold font-mono">
                    <span className="w-4 text-center text-slate-300">{stat.played}</span>
                    <span className={`w-6 text-center ${stat.goalDifference > 0 ? 'text-emerald-400' : stat.goalDifference < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                      {stat.goalDifference > 0 ? `+${stat.goalDifference}` : stat.goalDifference}
                    </span>
                    <span className="w-8 text-center text-amber-400 font-extrabold">{stat.points}</span>
                  </div>

                </div>
              );
            })}
          </div>

          <div className="p-2.5 bg-[#090f22] text-center border-t border-slate-800/50">
            <p className="text-[9px] text-emerald-400/80 font-medium">
              {t.topTwoPromo}
            </p>
          </div>
        </div>

        {/* Group Matches section */}
        <div>
          <div className="flex items-center gap-1.5 mb-3 px-1 text-slate-300">
            <Calendar size={14} className="text-emerald-400" />
            <h4 className="text-xs uppercase font-extrabold tracking-wider">{t.groupFixtures}</h4>
          </div>

          <div className="space-y-2.5">
            {groupMatches.map((match) => {
              const pred = userPredictions[match.id];
              const isFinished = (match.status || 'PENDING').toUpperCase() === 'FINISHED';
              const isLive = (match.status || 'PENDING').toUpperCase() === 'LIVE';
              const isMatchStarted = new Date() >= (match.match_date ? new Date(match.match_date) : getMatchDateObject(match));
              const isLocked = isFinished || isLive || isMatchStarted;
              
              const matchDateFormatted = formatMatchDate(match, lang);

              const matchStageFormatted = lang === 'ru' && match.stage === 'First Stage' ? 'Групповой этап' : match.stage;

              const homeNameLocal = lang === 'ru' ? (
                match.homeTeam.id === 'MEX' ? 'Мексика' :
                match.homeTeam.id === 'RSA' ? 'ЮАР' :
                match.homeTeam.id === 'KOR' ? 'Юж. Корея' :
                match.homeTeam.id === 'CZE' ? 'Чехия' :
                match.homeTeam.id === 'CAN' ? 'Канада' :
                match.homeTeam.id === 'BIH' ? 'Босния' :
                match.homeTeam.id === 'QAT' ? 'Катар' :
                match.homeTeam.id === 'SUI' ? 'Швейцария' :
                match.homeTeam.id === 'BRA' ? 'Бразилия' :
                match.homeTeam.id === 'MAR' ? 'Марокко' :
                match.homeTeam.id === 'HAI' ? 'Гаити' :
                match.homeTeam.id === 'SCO' ? 'Шотландия' :
                match.homeTeam.id === 'USA' ? 'США' :
                match.homeTeam.id === 'PAR' ? 'Парагвай' :
                match.homeTeam.id === 'AUS' ? 'Австралия' :
                match.homeTeam.id === 'TUR' ? 'Турция' :
                match.homeTeam.id === 'GER' ? 'Германия' :
                match.homeTeam.id === 'CUW' ? 'Кюрасао' :
                match.homeTeam.id === 'CIV' ? 'Кот-д\'Ив.' :
                match.homeTeam.id === 'ECU' ? 'Эквадор' :
                match.homeTeam.id === 'NED' ? 'Нидерланды' :
                match.homeTeam.id === 'JPN' ? 'Япония' :
                match.homeTeam.id === 'SWE' ? 'Швеция' :
                match.homeTeam.id === 'TUN' ? 'Тунис' :
                match.homeTeam.id === 'BEL' ? 'Бельгия' :
                match.homeTeam.id === 'EGY' ? 'Египет' :
                match.homeTeam.id === 'IRN' ? 'Иран' :
                match.homeTeam.id === 'NZL' ? 'Нов. Зеландия' :
                match.homeTeam.id === 'ESP' ? 'Испания' :
                match.homeTeam.id === 'CPV' ? 'Кабо-Верде' :
                match.homeTeam.id === 'KSA' ? 'Сауд. Аравия' :
                match.homeTeam.id === 'URU' ? 'Уругвай' :
                match.homeTeam.id === 'FRA' ? 'Франция' :
                match.homeTeam.id === 'SEN' ? 'Сенегал' :
                match.homeTeam.id === 'IRQ' ? 'Ирак' :
                match.homeTeam.id === 'NOR' ? 'Норвегия' :
                match.homeTeam.id === 'ARG' ? 'Аргентина' :
                match.homeTeam.id === 'ALG' ? 'Алжир' :
                match.homeTeam.id === 'AUT' ? 'Австрия' :
                match.homeTeam.id === 'JOR' ? 'Иордания' :
                match.homeTeam.id === 'POR' ? 'Португалия' :
                match.homeTeam.id === 'COD' ? 'ДР Конго' :
                match.homeTeam.id === 'UZB' ? 'Узбекистан' :
                match.homeTeam.id === 'COL' ? 'Колумбия' :
                match.homeTeam.id === 'ENG' ? 'Англия' :
                match.homeTeam.id === 'CRO' ? 'Хорватия' :
                match.homeTeam.id === 'GHA' ? 'Гана' :
                match.homeTeam.id === 'PAN' ? 'Панама' : match.homeTeam.name
              ) : match.homeTeam.name;

              const awayNameLocal = lang === 'ru' ? (
                match.awayTeam.id === 'MEX' ? 'Мексика' :
                match.awayTeam.id === 'RSA' ? 'ЮАР' :
                match.awayTeam.id === 'KOR' ? 'Юж. Корея' :
                match.awayTeam.id === 'CZE' ? 'Чехия' :
                match.awayTeam.id === 'CAN' ? 'Канада' :
                match.awayTeam.id === 'BIH' ? 'Босния' :
                match.awayTeam.id === 'QAT' ? 'Катар' :
                match.awayTeam.id === 'SUI' ? 'Швейцария' :
                match.awayTeam.id === 'BRA' ? 'Бразилия' :
                match.awayTeam.id === 'MAR' ? 'Марокко' :
                match.awayTeam.id === 'HAI' ? 'Гаити' :
                match.awayTeam.id === 'SCO' ? 'Шотландия' :
                match.awayTeam.id === 'USA' ? 'США' :
                match.awayTeam.id === 'PAR' ? 'Парагвай' :
                match.awayTeam.id === 'AUS' ? 'Австралия' :
                match.awayTeam.id === 'TUR' ? 'Турция' :
                match.awayTeam.id === 'GER' ? 'Германия' :
                match.awayTeam.id === 'CUW' ? 'Кюрасао' :
                match.awayTeam.id === 'CIV' ? 'Кот-д\'Ив.' :
                match.awayTeam.id === 'ECU' ? 'Эквадор' :
                match.awayTeam.id === 'NED' ? 'Нидерланды' :
                match.awayTeam.id === 'JPN' ? 'Япония' :
                match.awayTeam.id === 'SWE' ? 'Швеция' :
                match.awayTeam.id === 'TUN' ? 'Тунис' :
                match.awayTeam.id === 'BEL' ? 'Бельгия' :
                match.awayTeam.id === 'EGY' ? 'Египет' :
                match.awayTeam.id === 'IRN' ? 'Иран' :
                match.awayTeam.id === 'NZL' ? 'Нов. Зеландия' :
                match.awayTeam.id === 'ESP' ? 'Испания' :
                match.awayTeam.id === 'CPV' ? 'Кабо-Верде' :
                match.awayTeam.id === 'KSA' ? 'Сауд. Аравия' :
                match.awayTeam.id === 'URU' ? 'Уругвай' :
                match.awayTeam.id === 'FRA' ? 'Франция' :
                match.awayTeam.id === 'SEN' ? 'Сенегал' :
                match.awayTeam.id === 'IRQ' ? 'Ирак' :
                match.awayTeam.id === 'NOR' ? 'Норвегия' :
                match.awayTeam.id === 'ARG' ? 'Аргентина' :
                match.awayTeam.id === 'ALG' ? 'Алжир' :
                match.awayTeam.id === 'AUT' ? 'Австрия' :
                match.awayTeam.id === 'JOR' ? 'Иордания' :
                match.awayTeam.id === 'POR' ? 'Португалия' :
                match.awayTeam.id === 'COD' ? 'ДР Конго' :
                match.awayTeam.id === 'UZB' ? 'Узбекистан' :
                match.awayTeam.id === 'COL' ? 'Колумбия' :
                match.awayTeam.id === 'ENG' ? 'Англия' :
                match.awayTeam.id === 'CRO' ? 'Хорватия' :
                match.awayTeam.id === 'GHA' ? 'Гана' :
                match.awayTeam.id === 'PAN' ? 'Панама' : match.awayTeam.name
              ) : match.awayTeam.name;

              return (
                <div key={match.id} className="bg-[#0b1227] hover:bg-slate-800/10 p-3 rounded-xl border border-slate-800/80 flex flex-col justify-between gap-2.5 relative transition-all">
                  
                  {/* Date & Time bar */}
                  <div className="flex justify-between items-center text-[9px] text-slate-500 font-semibold border-b border-slate-800/40 pb-1.5">
                    <span>{matchDateFormatted}</span>
                    <span className="font-mono bg-slate-900 px-1.5 py-0.5 rounded text-slate-400 border border-slate-800/50">{formatMatchTime(match, lang)}</span>
                  </div>

                  {/* Core Match Rows */}
                  <div className="grid grid-cols-5 items-center my-0.5">
                    
                    {/* Home Team */}
                    <div className="col-span-2 flex items-center gap-2">
                      <TeamFlag code={match.homeTeam.code} fallback={match.homeTeam.flag} className="w-8 h-8 object-contain rounded-sm shadow-sm" />
                      <span className="text-xs font-bold text-slate-200 truncate">{homeNameLocal}</span>
                    </div>

                    {/* Scores or Versus center column */}
                    <div className="col-span-1 flex flex-col items-center justify-center">
                      {isFinished ? (
                        <div className="font-mono text-xs font-black text-slate-200 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 flex gap-1">
                          <span>{match.homeScore}</span>
                          <span className="text-slate-600">:</span>
                          <span>{match.awayScore}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-center font-bold text-slate-500 uppercase tracking-widest bg-slate-900/60 px-2 py-0.5 rounded-full border border-slate-800/40">VS</span>
                      )}
                    </div>

                    {/* Away Team */}
                    <div className="col-span-2 flex items-center justify-end gap-2 text-right">
                      <span className="text-xs font-bold text-slate-200 truncate">{awayNameLocal}</span>
                      <TeamFlag code={match.awayTeam.code} fallback={match.awayTeam.flag} className="w-8 h-8 object-contain rounded-sm shadow-sm" />
                    </div>

                  </div>

                  {/* Prediction State Button */}
                  <div className="flex justify-between items-center pt-1.5 text-[10px] border-t border-slate-800/30">
                    <div className="text-slate-400 line-clamp-1 truncate max-w-[180px]">
                      {pred ? (
                        <span className="text-emerald-400 font-semibold">
                          {t.forecast}:{' '}
                          <strong className="font-bold bg-emerald-950/40 px-1.5 py-0.5 border border-emerald-500/20 rounded text-emerald-400">
                            {pred.predictionType === 'winner' ? (
                              pred.predictedWinner === 'home' ? (
                                <span className="inline-flex items-center gap-1 text-[11px]">
                                  <TeamFlag code={match.homeTeam.code} fallback={match.homeTeam.flag} className="w-4 h-4 object-contain rounded-sm shadow-sm" />
                                  <span>{t.winText}</span>
                                </span>
                              ) : pred.predictedWinner === 'away' ? (
                                <span className="inline-flex items-center gap-1 text-[11px]">
                                  <TeamFlag code={match.awayTeam.code} fallback={match.awayTeam.flag} className="w-4 h-4 object-contain rounded-sm shadow-sm" />
                                  <span>{t.winText}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px]">
                                  <span>🤝</span>
                                  <span>{t.drawText}</span>
                                </span>
                              )
                            ) : (
                              <span className="font-mono text-xs">{pred.homeScore}-{pred.awayScore}</span>
                            )}
                          </strong>
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">{t.noPredYet}</span>
                      )}
                    </div>

                    {isLocked ? (
                      isFinished ? (
                        <span className={`px-2 py-0.5 rounded font-black uppercase text-[8px] font-mono ${pred?.pointsEarned !== undefined && pred?.pointsEarned !== null ? (pred.pointsEarned > 0 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-500') : 'bg-slate-800 text-slate-500'}`}>
                          {pred?.pointsEarned !== undefined && pred?.pointsEarned !== null ? `${t.result}: +${pred.pointsEarned} ${t.pts.toUpperCase()}` : t.locked}
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded bg-slate-850 text-slate-500 border border-slate-800 font-extrabold uppercase text-[9px] tracking-wide shadow-inner select-none">
                          {t.locked}
                        </span>
                      )
                    ) : (
                      <button
                        id={`btn-match-pred-group-${match.id}`}
                        onClick={() => onPredictClick(match)}
                        className={`px-2.5 py-1 rounded-md font-bold uppercase text-[9px] transition-all duration-150 active:scale-95 ${pred ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40' : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm'}`}
                      >
                        {pred ? t.forecastEdit : t.forecastPredict}
                      </button>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
