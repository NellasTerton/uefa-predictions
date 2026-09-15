/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Match } from '../types';

/**
 * Returns a standard Date object for a match.
 * Uses match_date if available (real DB timestamps), or falls back to parsing
 * the english weekday day month structure (local static fallback data).
 */
export function getMatchDateObject(match: Match): Date {
  if (match.match_date) {
    return new Date(match.match_date);
  }
  
  // Hand-crafted parser for 'Thursday 11 June 2026' and time '22:00'
  try {
    const parts = match.date.split(' '); // ['Thursday', '11', 'June', '2026']
    if (parts.length >= 4) {
      const day = parseInt(parts[1], 10);
      const year = parseInt(parts[3], 10);
      const months: { [key: string]: number } = {
        'January': 0, 'january': 0,
        'February': 1, 'february': 1,
        'March': 2, 'march': 2,
        'April': 3, 'april': 3,
        'May': 4, 'may': 4,
        'June': 5, 'june': 5,
        'July': 6, 'july': 6,
        'August': 7, 'august': 7,
        'September': 8, 'september': 8,
        'October': 9, 'october': 9,
        'November': 10, 'november': 10,
        'December': 11, 'december': 11
      };
      
      const monthName = parts[2];
      const monthIndex = months[monthName] !== undefined ? months[monthName] : 5; // Default June
      
      const timeParts = match.time.split(':');
      const hours = parseInt(timeParts[0], 10) || 0;
      const minutes = parseInt(timeParts[1], 10) || 0;
      
      // Let's assume the static fallback matches in data.ts are specified in UTC
      return new Date(Date.UTC(year, monthIndex, day, hours, minutes));
    }
  } catch (err) {
    console.error('Failed to parse static match date/time:', err);
  }
  
  return new Date();
}

/**
 * Formats match date dynamically in local timezone based on locale language input.
 */
export function formatMatchDate(match: Match, lang: 'ru' | 'en'): string {
  const d = getMatchDateObject(match);
  const locale = lang === 'ru' ? 'ru-RU' : 'en-US';
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  };
  
  try {
    const formatted = d.toLocaleDateString(locale, options);
    // Capitalize first letter of weekday if russian for cleaner look
    if (lang === 'ru' && formatted) {
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }
    return formatted;
  } catch (e) {
    return match.date;
  }
}

/**
 * Formats match time dynamically in local timezone showing hours and minutes in 24h format.
 */
export function formatMatchTime(match: Match, lang: 'ru' | 'en'): string {
  const d = getMatchDateObject(match);
  const locale = lang === 'ru' ? 'ru-RU' : 'en-US';
  
  try {
    return d.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch (e) {
    return match.time;
  }
}
