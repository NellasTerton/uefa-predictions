/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';

// Maps 3-letter team codes to FlagCDN 2-letter codes.
export const CODE_MAPPING: { [key: string]: string } = {
  MEX: 'mx',
  RSA: 'za',
  KOR: 'kr',
  CZE: 'cz',
  CAN: 'ca',
  BIH: 'ba',
  QAT: 'qa',
  SUI: 'ch',
  BRA: 'br',
  MAR: 'ma',
  HAI: 'ht',
  SCO: 'gb-sct',
  USA: 'us',
  PAR: 'py',
  AUS: 'au',
  TUR: 'tr',
  GER: 'de',
  CUW: 'cw',
  CIV: 'ci',
  ECU: 'ec',
  NED: 'nl',
  JPN: 'jp',
  SWE: 'se',
  TUN: 'tn',
  BEL: 'be',
  EGY: 'eg',
  IRN: 'ir',
  NZL: 'nz',
  ESP: 'es',
  CPV: 'cv',
  KSA: 'sa',
  URU: 'uy',
  FRA: 'fr',
  SEN: 'sn',
  IRQ: 'iq',
  NOR: 'no',
  ARG: 'ar',
  ALG: 'dz',
  AUT: 'at',
  JOR: 'jo',
  POR: 'pt',
  COD: 'cd',
  UZB: 'uz',
  COL: 'co',
  ENG: 'gb-eng',
  CRO: 'hr',
  GHA: 'gh',
  PAN: 'pa'
};

interface TeamFlagProps {
  code?: string;
  fallback?: string;
  className?: string;
}

export const TeamFlag: React.FC<TeamFlagProps> = ({ code, fallback = '🏳️', className = 'w-6 h-auto rounded-sm shadow-sm object-cover inline-block align-middle' }) => {
  const [hasError, setHasError] = useState(false);

  // If fallback is an image URL (like our team logos)
  if (fallback.startsWith('http')) {
    if (!hasError) {
      return (
        <img
          src={fallback}
          alt={code || 'team'}
          referrerPolicy="no-referrer"
          className={`object-contain ${className}`}
          onError={() => setHasError(true)}
        />
      );
    } else {
      // If it failed to load, don't show the long URL string as text
      return <span className="select-none text-xl inline-block align-middle text-center w-6 h-4 bg-slate-800 rounded text-[10px] leading-tight font-bold text-slate-500">{code || '?'}</span>;
    }
  }

  if (!code || hasError) {
    return <span className="select-none text-xl inline-block align-middle">{fallback}</span>;
  }

  const upperCode = code.toUpperCase().trim();
  const flagCode = CODE_MAPPING[upperCode] || upperCode.toLowerCase();

  return (
    <img
      src={`https://flagcdn.com/w40/${flagCode}.png`}
      alt={code}
      referrerPolicy="no-referrer"
      className={className}
      onError={() => setHasError(true)}
    />
  );
};
