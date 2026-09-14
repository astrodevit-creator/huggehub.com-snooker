/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Pricing & Promotion Calculation Engine
 */

import { AppSettings, OfferType } from '../types.ts';

export interface CalculatedGamePrices {
  durationSeconds: number;
  durationMinutes: number;
  rawCalculatedPrice: number;
  suggestedPrice: number;
  isEligibleFor3GameOffer: boolean;
  isEligibleFor5thGameFree: boolean;
  offerType: OfferType;
  suggestedOfferPrices: number[];
  qualifyingGamesCountToday: number;
  promoCycleCount: number;
}

/**
 * Calculates accurate duration in minutes from ISO start and end timestamps.
 * Standard ceiling/rounding: any partial minute counts as a full minute or proportional minute.
 * In Snooker clubs, 1 minute = 1 DH. Minimum charge is usually 20 DH.
 */
export function calculateDuration(startTimeIso: string, endTimeIso: string): { seconds: number; minutes: number } {
  const start = new Date(startTimeIso).getTime();
  const end = new Date(endTimeIso).getTime();
  const diffMs = Math.max(0, end - start);
  const seconds = Math.floor(diffMs / 1000);
  // Calculate minutes (if > 0 seconds, minimum 1 minute)
  const minutes = seconds > 0 ? Math.ceil(seconds / 60) : 0;
  return { seconds, minutes };
}

/**
 * Calculates raw price and suggested price based on duration and settings.
 * Default: 60 DH/hour = 1 DH/minute. Minimum suggested = 20 DH.
 */
export function calculateBasePrices(
  durationMinutes: number,
  settings: Partial<AppSettings> = {}
): { rawCalculated: number; suggested: number } {
  const hourlyRate = settings.hourly_rate ?? 60;
  const minimumPrice = settings.minimum_price ?? 20;

  // Rate per minute
  const ratePerMinute = hourlyRate / 60;
  const rawCalculated = Math.round(durationMinutes * ratePerMinute);
  const suggested = Math.max(minimumPrice, rawCalculated);

  return {
    rawCalculated,
    suggested,
  };
}

/**
 * Checks promotional eligibility for a customer based on today's qualifying completed games count.
 * Qualifying games are closed, non-deleted, non-cancelled games.
 */
export function evaluatePromotions(
  qualifyingGamesCompletedToday: number,
  settings: Partial<AppSettings> = {}
): {
  isEligibleFor3GameOffer: boolean;
  isEligibleFor5thGameFree: boolean;
  offerType: OfferType;
  suggestedOfferPrices: number[];
  promoCycleGameCount: number;
} {
  const threeGameEnabled = settings.three_game_offer_enabled ?? true;
  const threeGameThreshold = settings.three_game_threshold ?? 3;
  const threeGamePrice1 = settings.three_game_price_option_1 ?? 40;
  const threeGamePrice2 = settings.three_game_price_option_2 ?? 60;

  const fifthGameEnabled = settings.fifth_game_free_enabled ?? true;
  const freeGameThreshold = settings.free_game_threshold ?? 5; // Game #5
  const requiredQualifying = freeGameThreshold - 1; // 4 games before 5th

  // Current game number for today is (completed + 1)
  const currentGameNumberToday = qualifyingGamesCompletedToday + 1;
  const promoCycleGameCount = ((qualifyingGamesCompletedToday) % 5) + 1;

  let isEligibleFor5thGameFree = false;
  let isEligibleFor3GameOffer = false;
  let offerType: OfferType = 'NONE';
  const suggestedOfferPrices: number[] = [];

  // Check 5th game free first (higher priority promotion)
  if (fifthGameEnabled && promoCycleGameCount === freeGameThreshold) {
    isEligibleFor5thGameFree = true;
    offerType = 'FIFTH_GAME_FREE';
  } else if (threeGameEnabled && currentGameNumberToday % threeGameThreshold === 0) {
    isEligibleFor3GameOffer = true;
    offerType = 'THREE_GAME';
    suggestedOfferPrices.push(threeGamePrice1, threeGamePrice2);
  }

  return {
    isEligibleFor3GameOffer,
    isEligibleFor5thGameFree,
    offerType,
    suggestedOfferPrices,
    promoCycleGameCount,
  };
}

/**
 * Computes complete price breakdown for ending a game.
 */
export function calculateGamePricing(
  startTimeIso: string,
  endTimeIso: string,
  qualifyingGamesCompletedToday: number,
  settings: Partial<AppSettings> = {}
): CalculatedGamePrices {
  const { seconds, minutes } = calculateDuration(startTimeIso, endTimeIso);
  const { rawCalculated, suggested } = calculateBasePrices(minutes, settings);
  const promo = evaluatePromotions(qualifyingGamesCompletedToday, settings);

  return {
    durationSeconds: seconds,
    durationMinutes: minutes,
    rawCalculatedPrice: rawCalculated,
    suggestedPrice: suggested,
    isEligibleFor3GameOffer: promo.isEligibleFor3GameOffer,
    isEligibleFor5thGameFree: promo.isEligibleFor5thGameFree,
    offerType: promo.offerType,
    suggestedOfferPrices: promo.suggestedOfferPrices,
    qualifyingGamesCountToday: qualifyingGamesCompletedToday,
    promoCycleCount: promo.promoCycleGameCount,
  };
}

/**
 * Computes price difference and discount for manual or promotional final prices.
 */
export function computeFinalDifferences(
  suggestedPrice: number,
  finalPrice: number,
  isFreeGame: boolean = false
): {
  priceDifference: number;
  discountAmount: number;
  isManual: boolean;
} {
  const priceDifference = finalPrice - suggestedPrice;
  const discountAmount = Math.max(0, suggestedPrice - finalPrice);
  const isManual = !isFreeGame && finalPrice !== suggestedPrice;

  return {
    priceDifference,
    discountAmount,
    isManual,
  };
}

/**
 * Normalizes customer name for duplicate prevention and case-insensitive search.
 */
export function normalizeCustomerName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}
