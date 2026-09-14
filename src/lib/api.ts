/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Client API Client
 */

import {
  AppSettings,
  AuditEntry,
  CalendarDayReport,
  Customer,
  DailySession,
  DashboardLiveData,
  Game,
  Loan,
  SnookerTable,
  User,
  UserSessionLog,
  WaitingEntry,
} from '../types.ts';

const TOKEN_KEY = 'extrablack_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // ignore
  }
}

export async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (!res.ok) {
    let errorMsg = `Error ${res.status}: ${res.statusText}`;
    try {
      const data = await res.json();
      if (data.error) errorMsg = data.error;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }
  return res.json();
}

export const api = {
  // Auth
  getMe: () => fetchJson<{ user: User | null }>('/api/auth/me'),
  loginWithPin: async (pin: string) => {
    const res = await fetchJson<{ user: User; token: string }>('/api/auth/pin-login', {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
    if (res.token) setStoredToken(res.token);
    return res;
  },
  loginEmail: async (email: string, name?: string, role?: 'ADMIN' | 'WORKER') => {
    const res = await fetchJson<{ user: User; token: string }>('/api/auth/email', {
      method: 'POST',
      body: JSON.stringify({ email, name, role }),
    });
    if (res.token) setStoredToken(res.token);
    return res;
  },
  loginGoogle: async (tokenOrEmail: string) => {
    const res = await fetchJson<{ user: User; token: string }>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ tokenOrEmail }),
    });
    if (res.token) setStoredToken(res.token);
    return res;
  },
  loginDemo: async (role: 'ADMIN' | 'WORKER', email?: string) => {
    const res = await fetchJson<{ user: User; token: string }>('/api/auth/demo-login', {
      method: 'POST',
      body: JSON.stringify({ role, email }),
    });
    if (res.token) setStoredToken(res.token);
    return res;
  },
  logout: async () => {
    setStoredToken(null);
    return fetchJson<{ success: boolean }>('/api/auth/logout', { method: 'POST' });
  },

  // Dashboard Live Data
  getLiveDashboard: () => fetchJson<DashboardLiveData>('/api/dashboard/live'),

  // Tables
  getTables: () => fetchJson<SnookerTable[]>('/api/tables'),
  updateTable: (id: string, updates: Partial<SnookerTable>) =>
    fetchJson<SnookerTable>(`/api/tables/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  // Games
  startGame: (data: {
    tableId: string;
    customerId?: string;
    playerName?: string;
    player1Name?: string;
    player2Name?: string;
    waitingId?: string;
    gamesCount?: number;
  }) =>
    fetchJson<Game>('/api/games/start', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  endGame: (data: {
    gameId: string;
    finalPrice: number;
    paymentType: 'PAID' | 'PAY_LATER' | 'LOAN';
    winnerName?: string;
    loserName?: string;
    payerName?: string;
    payerCustomerId?: string;
    isFreeGame?: boolean;
    priceReason?: string;
    priceNote?: string;
    offerType?: any;
    offerSelectedPrice?: number;
    gamesCount?: number;
  }) =>
    fetchJson<{ game: Game; loan?: Loan }>('/api/games/end', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateGameGamesCount: (gameId: string, gamesCount: number) =>
    fetchJson<Game>(`/api/games/${gameId}/games-count`, {
      method: 'PATCH',
      body: JSON.stringify({ gamesCount }),
    }),

  updateGamePlayers: (
    gameId: string,
    data: { playerName?: string; player1Name?: string; player2Name?: string }
  ) =>
    fetchJson<Game>(`/api/games/${gameId}/players`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  seedLiveMatch: () =>
    fetchJson<{ success: boolean; game: Game }>('/api/games/seed-live-match', {
      method: 'POST',
    }),

  previewPricing: (data: { startTime?: string; endTime?: string; customerId?: string }) =>
    fetchJson<any>('/api/games/pricing-preview', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getGames: (params?: {
    sessionId?: string;
    customerId?: string;
    tableId?: string;
    status?: string;
    paymentStatus?: string;
    includeDeleted?: boolean;
  }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchJson<Game[]>(`/api/games?${query}`);
  },

  getGameById: (id: string) => fetchJson<Game>(`/api/games/${id}`),

  editGame: (id: string, updates: Partial<Game>, reason: string) =>
    fetchJson<Game>(`/api/games/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...updates, reason }),
    }),

  deleteGame: (id: string, reason: string, password?: string) =>
    fetchJson<{ success: boolean; game: Game }>(`/api/games/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason, password }),
    }),

  payGameCredit: (gameId: string) =>
    fetchJson<{ success: boolean; game: Game; loan?: Loan }>(`/api/games/${gameId}/pay-credit`, {
      method: 'POST',
    }),

  // Loans
  getLoans: (status?: string) => {
    const query = status ? `?status=${status}` : '';
    return fetchJson<Loan[]>(`/api/loans${query}`);
  },

  payLoan: (loanId: string) =>
    fetchJson<Loan>(`/api/loans/${loanId}/pay`, {
      method: 'POST',
    }),

  cancelLoan: (loanId: string, reason: string, password?: string) =>
    fetchJson<Loan>(`/api/loans/${loanId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason, password }),
    }),

  // Waiting List
  getWaitingList: (tableId?: string, status?: string) => {
    const params = new URLSearchParams();
    if (tableId) params.append('tableId', tableId);
    if (status) params.append('status', status);
    return fetchJson<WaitingEntry[]>(`/api/waiting?${params.toString()}`);
  },

  addWaitingCustomer: (data: {
    customerId: string;
    playerName: string;
    preferredTable: 'MINI1' | 'MINI2' | 'ANY';
    notes?: string;
  }) =>
    fetchJson<WaitingEntry>('/api/waiting/add', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateWaitingStatus: (id: string, status: string) =>
    fetchJson<WaitingEntry>(`/api/waiting/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // Customers
  getCustomers: (search?: string) => {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return fetchJson<Customer[]>(`/api/customers${query}`);
  },

  getCustomerById: (id: string) => fetchJson<Customer>(`/api/customers/${id}`),

  createCustomer: (data: { name: string; phone?: string; notes?: string }) =>
    fetchJson<Customer>('/api/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCustomer: (id: string, updates: Partial<Customer>) =>
    fetchJson<Customer>(`/api/customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  autoSyncAllPlayers: () =>
    fetchJson<{ totalAdded: number; totalExisting: number }>('/api/customers/auto-sync-all', {
      method: 'POST',
    }),

  // Sessions
  getCurrentSession: () => fetchJson<DailySession>('/api/sessions/current'),
  getSessions: () => fetchJson<DailySession[]>('/api/sessions'),
  getSessionDetails: (id: string) =>
    fetchJson<{ session: DailySession; games: Game[]; loans?: Loan[] }>(`/api/sessions/${id}`),
  getSessionInvoice: (id: string = 'current') =>
    fetchJson<{
      session: DailySession;
      games: Game[];
      loans: Loan[];
      loanPeople: {
        customerId: string;
        playerName: string;
        totalLoan: number;
        loans: Loan[];
      }[];
    }>(`/api/sessions/${id}/invoice`),
  closeSession: (data: { sessionId?: string; notes?: string }) =>
    fetchJson<{
      success: boolean;
      session: DailySession;
      games: Game[];
      loans: Loan[];
      loanPeople: {
        customerId: string;
        playerName: string;
        totalLoan: number;
        loans: Loan[];
      }[];
      newSession: DailySession;
    }>('/api/sessions/close', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Users
  getUsers: () => fetchJson<User[]>('/api/users'),
  createUser: (data: { name: string; email: string; role: 'ADMIN' | 'WORKER'; pin?: string; active?: boolean }) =>
    fetchJson<User>('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateUser: (id: string, updates: Partial<User>) =>
    fetchJson<User>(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
  deleteUser: (id: string) =>
    fetchJson<{ success: boolean }>(`/api/users/${id}`, {
      method: 'DELETE',
    }),

  // Settings & Audit
  getSettings: () => fetchJson<AppSettings>('/api/settings'),
  updateSettings: (updates: Partial<AppSettings>) =>
    fetchJson<AppSettings>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
  getAuditLogs: (limit: number = 100) =>
    fetchJson<AuditEntry[]>(`/api/audit?limit=${limit}`),
  triggerAuditTestProbe: (params: { reason?: string; action?: string; entityType?: string }) =>
    fetchJson<{
      success: boolean;
      testRecord: AuditEntry;
      verification: {
        inMemory: { verified: boolean; totalCount: number };
        googleSheets: { configured: boolean; verified: boolean; error: string | null };
        firestore: { connected: boolean; verified: boolean; error: string | null };
        dashboardState: {
          verified: boolean;
          activeSessionId: string;
          totalGames: number;
          totalPaid: number;
          newLoans: number;
          reste: number;
          activeTables: Array<{ table_id: string; name: string; status: string; activeGame: any }>;
        };
      };
    }>('/api/audit/test-probe', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  reconcileAuditAndSession: (reason?: string) =>
    fetchJson<{
      success: boolean;
      message: string;
      reconcileLog: AuditEntry;
      activeSession: any;
    }>('/api/audit/reconcile', {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  runFullAuditScan: () =>
    fetchJson<{
      overallStatus: 'PASSED' | 'WARNING' | 'FAILED';
      timestamp: string;
      checks: Array<{ name: string; status: string; details: string }>;
      summary: any;
    }>('/api/audit/full-scan', {
      method: 'POST',
    }),

  // System Health & Google Sheets Live Backup
  getSystemHealth: () => fetchJson<any>('/api/system/health'),
  initGoogleSheets: () => fetchJson<any>('/api/system/init-sheets', { method: 'POST' }),
  getGoogleSheetsStatus: () =>
    fetchJson<{
      connected: boolean;
      spreadsheetId: string | null;
      serviceAccountConfigured: boolean;
      sheetsFound: string[];
      lastSyncAt: string | null;
      errorMessage: string | null;
      pendingRetries?: number;
      consecutiveFailures?: number;
      stack?: {
        sheets: any;
        mongodb: any;
        firestore: any;
        overallHealthy: boolean;
      };
    }>('/api/admin/sheets/status'),
  syncAllGoogleSheets: () =>
    fetchJson<{
      success: boolean;
      syncedCounts: Record<string, number>;
      error?: string;
    }>('/api/admin/sheets/sync-all', { method: 'POST' }),
  initGoogleSheetsSpreadsheet: (spreadsheetId?: string) =>
    fetchJson<{ success: boolean; health: any }>('/api/admin/sheets/init', {
      method: 'POST',
      body: JSON.stringify({ spreadsheetId }),
    }),
  createBackupSpreadsheet: () =>
    fetchJson<{ success: boolean; spreadsheetId: string; syncResult: any }>('/api/admin/sheets/create', {
      method: 'POST',
    }),

  // Reports
  getReports: (params?: { range?: string; startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchJson<any>(`/api/reports?${query}`);
  },

  getCalendarDayReport: (date?: string) => {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return fetchJson<CalendarDayReport>(`/api/reports/calendar-day${query}`);
  },

  getUserSessionLogs: (params?: { date?: string; userId?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchJson<UserSessionLog[]>(`/api/user-sessions?${query}`);
  },

  disconnectUserSession: (sessionLogId: string) =>
    fetchJson<{ success: boolean }>(`/api/user-sessions/${sessionLogId}/disconnect`, {
      method: 'POST',
    }),
};
