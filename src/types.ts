/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Core Domain Types
 */

export type UserRole = 'ADMIN' | 'WORKER';

export type GameStatus = 'RUNNING' | 'CLOSED' | 'CANCELLED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'PAY_LATER' | 'LOAN' | 'LOAN_PAID' | 'FREE';

export type LoanStatus = 'OPEN' | 'PAID' | 'CANCELLED';

export type WaitingStatus = 'WAITING' | 'SEATED' | 'CANCELLED' | 'NO_SHOW';

export type SessionStatus = 'OPEN' | 'CLOSED';

export type OfferType = 'NONE' | 'THREE_GAME' | 'FIFTH_GAME_FREE';

export interface User {
  user_id: string;
  name: string;
  email: string;
  role: UserRole;
  pin?: string;
  active: boolean;
  created_at: string;
  created_by: string;
  last_login: string;
  updated_at: string;
}

export interface Customer {
  customer_id: string;
  name: string;
  normalized_name: string;
  phone?: string;
  notes?: string;
  active: boolean;
  created_at: string;
  created_by: string;
  updated_at: string;
  // Computed stats
  today_games_count?: number;
  promo_cycle_count?: number;
  lifetime_games?: number;
  total_paid_dh?: number;
  open_loan_balance_dh?: number;
  lifetime_loans_dh?: number;
  discounts_received_dh?: number;
  free_games_received?: number;
  last_visit_at?: string;
}

export interface SnookerTable {
  table_id: string; // 'MINI1' | 'MINI2'
  name: string; // 'Mini 1' | 'Mini 2'
  active: boolean;
  hourly_rate: number; // default 60 DH
  minimum_price: number; // default 20 DH
  created_at: string;
  updated_at: string;
}

export interface Game {
  game_id: string;
  session_id: string;
  table_id: string; // 'MINI1' | 'MINI2'
  customer_id: string;
  player_name: string;
  player1_name?: string;
  player2_name?: string;
  winner_name?: string;
  loser_name?: string;
  payer_name?: string;
  payer_customer_id?: string;
  start_time: string; // ISO string
  end_time?: string; // ISO string
  duration_seconds: number;
  duration_minutes: number;
  raw_calculated_price: number; // 1 DH per minute
  suggested_price: number; // max(20, raw_calculated_price)
  final_price: number; // what is actually charged
  price_difference: number; // final_price - suggested_price
  discount_amount: number; // max(0, suggested_price - final_price)
  manual_price: boolean;
  price_reason?: string; // '3 GAME OFFER' | 'CUSTOMER DISCOUNT' | 'PROMOTION' | 'OWNER AUTHORIZATION' | 'MANUAL CORRECTION' | 'OTHER'
  price_note?: string;
  game_number_today: number;
  promo_cycle_game_count: number;
  offer_eligible: boolean;
  offer_type: OfferType;
  offer_selected_price?: number;
  is_free_game: boolean;
  games_count?: number; // 1 to 9 games/frames played
  payment_status: PaymentStatus;
  status: GameStatus;
  started_by: string;
  ended_by?: string;
  paid_at?: string;
  paid_by?: string;
  locked: boolean;
  waiting_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  deleted: boolean;
  deleted_at?: string;
  deleted_by?: string;
  deletion_reason?: string;
}

export interface Loan {
  loan_id: string;
  game_id: string;
  session_id: string;
  customer_id: string;
  player_name: string;
  amount: number;
  created_at: string;
  created_by: string;
  status: LoanStatus;
  paid_at?: string;
  paid_by?: string;
  cancelled_at?: string;
  cancelled_by?: string;
  notes?: string;
  updated_at: string;
}

export interface WaitingEntry {
  waiting_id: string;
  session_id: string;
  customer_id: string;
  player_name: string;
  preferred_table: 'MINI1' | 'MINI2' | 'ANY';
  added_at: string;
  added_by: string;
  status: WaitingStatus;
  seated_at?: string;
  game_id?: string;
  notes?: string;
  updated_at: string;
}

export interface DailySession {
  session_id: string; // e.g. SESSION-2026-09-02
  date: string; // YYYY-MM-DD
  opened_at: string;
  opened_by: string;
  closed_at?: string;
  closed_by?: string;
  status: SessionStatus;
  total_games: number;
  total_duration_minutes: number;
  calculated_value: number;
  final_value: number;
  total_paid: number;
  new_loans: number;
  old_loans_collected: number;
  discount_total: number;
  free_game_value: number;
  reste: number; // Espèce payé (total_paid; Paid + Loan = Total Recette)
  mini1_revenue: number;
  mini2_revenue: number;
  notes?: string;
}

export interface AppSettings {
  timezone: string; // 'Africa/Casablanca'
  currency: string; // 'MAD'
  currency_symbol: string; // 'DH'
  hourly_rate: number; // 60
  minimum_price: number; // 20
  quick_price_1: number; // 20
  quick_price_2: number; // 30
  quick_price_3: number; // 40
  quick_price_4: number; // 50
  quick_price_5: number; // 60
  three_game_offer_enabled: boolean; // true
  three_game_threshold: number; // 3
  three_game_price_option_1: number; // 40
  three_game_price_option_2: number; // 60
  fifth_game_free_enabled: boolean; // true
  free_game_threshold: number; // 5
  free_game_cycle_reset: boolean; // true
  manual_price_enabled: boolean; // true
  google_sheets_spreadsheet_id?: string;
  updated_at: string;
  updated_by: string;
}

export interface AuditEntry {
  audit_id: string;
  timestamp: string;
  user_id: string;
  user_email: string;
  user_role: UserRole;
  action: string;
  entity_type: string; // 'GAME' | 'LOAN' | 'SESSION' | 'USER' | 'CUSTOMER' | 'WAITING' | 'SETTINGS' | 'AUTH'
  entity_id: string;
  session_id: string;
  before_data?: string; // JSON string
  after_data?: string; // JSON string
  reason?: string;
  ip_or_device_info_if_available?: string;
}

export interface UserSessionLog {
  id: string;
  session_log_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_role: UserRole;
  login_at: string;
  last_active_at: string;
  logout_at?: string;
  duration_minutes: number;
  status: 'ACTIVE' | 'LOGGED_OUT' | 'EXPIRED';
  ip_address?: string;
  user_agent?: string;
  games_handled: number;
  revenue_collected: number;
  loans_created: number;
}

export interface CalendarDayReport {
  date: string; // YYYY-MM-DD
  sessionId?: string;
  status?: SessionStatus;
  openedAt?: string;
  closedAt?: string;
  openedByName?: string;
  closedByName?: string;
  gamesCount: number;
  totalPlayingMinutes: number;
  financials: {
    calculatedValue: number;
    finalValue: number;
    paidRevenue: number;
    newLoans: number;
    reste: number;
    discountsGiven: number;
    freeGamesCount: number;
    freePromotionalValue: number;
  };
  tableBreakdown: {
    mini1: { games: number; minutes: number; revenue: number; discounts: number };
    mini2: { games: number; minutes: number; revenue: number; discounts: number };
  };
  hourlyActivity: {
    hour: number;
    hourLabel: string;
    gamesCount: number;
    paidRevenue: number;
  }[];
  games: Game[];
  loans: Loan[];
}

export interface DashboardLiveData {
  session: DailySession;
  tables: {
    table: SnookerTable;
    activeGame?: Game;
    waitingQueue: WaitingEntry[];
  }[];
  todayTotals: {
    totalPaid: number;
    totalLoan: number;
    totalPayLater?: number;
    payLaterCount?: number;
    leReste: number; // Espèce payé (totalPaid; Paid + Loan = Total Recette)
    oldLoansCollectedToday: number;
    creditPaidToday?: number;
    totalGamesToday: number;
    totalPlayingMinutesToday: number;
    discountsGivenToday: number;
    freePromotionalValueToday: number;
    mini1Revenue: number;
    mini2Revenue: number;
  };
  openLoans: Loan[];
  recentGames: Game[];
  waitingList: WaitingEntry[];
}
