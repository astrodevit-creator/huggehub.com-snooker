/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Centralized Time & Session Utilities
 * Timezone: Africa/Casablanca
 */

export const OPERATIONAL_TIMEZONE = 'Africa/Casablanca';

/**
 * Returns current Morocco date string in YYYY-MM-DD format
 */
export function getMoroccoDate(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: OPERATIONAL_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch {
    return date.toISOString().split('T')[0];
  }
}

/**
 * Alias for Morocco session operational date
 */
export function getMoroccoSessionDate(date: Date = new Date()): string {
  return getMoroccoDate(date);
}

/**
 * Standardized session ID generator: SESSION-YYYY-MM-DD or SESSION-YYYY-MM-DD-S{N}
 */
export function generateSessionId(dateInput?: Date | string, index: number = 0): string {
  const dateStr = typeof dateInput === 'string'
    ? dateInput
    : getMoroccoDate(dateInput || new Date());
  
  if (index <= 1) {
    return `SESSION-${dateStr}`;
  }
  return `SESSION-${dateStr}-S${index}`;
}

/**
 * Returns ISO operational day range [00:00:00.000 to 23:59:59.999] in Casablanca time
 */
export function getOperationalDayRange(targetDateStr?: string): {
  dateStr: string;
  startIso: string;
  endIso: string;
} {
  const dateStr = targetDateStr || getMoroccoDate();
  // Using Moroccan midnight bounds
  const startIso = `${dateStr}T00:00:00.000Z`;
  const endIso = `${dateStr}T23:59:59.999Z`;
  return { dateStr, startIso, endIso };
}

/**
 * Legacy aliases for backwards compatibility
 */
export const getCasablancaDate = getMoroccoDate;

export function getCasablancaIsoString(date: Date = new Date()): string {
  return date.toISOString();
}

export function formatTime(isoString?: string, includeSeconds: boolean = false): string {
  if (!isoString) return '--:--';
  try {
    const date = new Date(isoString);
    const options: Intl.DateTimeFormatOptions = {
      timeZone: OPERATIONAL_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    };
    if (includeSeconds) {
      options.second = '2-digit';
    }
    return new Intl.DateTimeFormat('en-GB', options).format(date);
  } catch {
    return '--:--';
  }
}

export function formatDate(isoString?: string): string {
  if (!isoString) return '--';
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: OPERATIONAL_TIMEZONE,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return isoString;
  }
}

export function formatDateTime(isoString?: string): string {
  if (!isoString) return '--';
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: OPERATIONAL_TIMEZONE,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return isoString;
  }
}

export function formatTimerSeconds(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `00:${pad(minutes)}:${pad(seconds)}`;
}

export function formatDurationHuman(minutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }
  return `${remainingMinutes} min`;
}

export function calculateWaitingMinutes(addedAtIso: string): number {
  const added = new Date(addedAtIso).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - added);
  return Math.floor(diffMs / 60000);
}
