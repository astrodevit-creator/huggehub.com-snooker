/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Persistent Storage & Google Sheets Database Repository
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
import { getCasablancaDate, getCasablancaIsoString } from '../lib/dateUtils.ts';
import { normalizeCustomerName } from '../lib/pricing.ts';
import { googleSheetsService } from './googleSheets.ts';
import { saveToFirestore, deleteFromFirestore, syncAllToFirestore, loadFromFirestore, subscribeToFirestoreChanges, getFirestoreStatus, validateFirestoreConnection } from './firestore.ts';
import {
  saveToMongo,
  deleteFromMongo,
  loadFromMongo,
  syncAllToMongo,
  subscribeToMongoChanges,
  getMongoStatus,
  isMongoAvailable,
} from './mongodb.ts';

export const SUPER_ADMIN_EMAIL = 'astro.dev.it@gmail.com';

class StorageRepository {
  private users: Map<string, User> = new Map();
  private customers: Map<string, Customer> = new Map();
  private tables: Map<string, SnookerTable> = new Map();
  private games: Map<string, Game> = new Map();
  private loans: Map<string, Loan> = new Map();
  private waitingList: Map<string, WaitingEntry> = new Map();
  private sessions: Map<string, DailySession> = new Map();
  private userSessionLogs: Map<string, UserSessionLog> = new Map();
  private settings: AppSettings;
  private auditLogs: AuditEntry[] = [];

  // Mutex locks for atomic operations
  private tableLocks: Set<string> = new Set();
  private loanLocks: Set<string> = new Set();
  private sessionLock: boolean = false;

  // Real-time broadcast listeners for live streaming
  private liveListeners: Set<() => void> = new Set();
  private isBroadcasting: boolean = false;
  private broadcastPending: boolean = false;
  private isMongoHydrated: boolean = false;
  private isMongoHydrating: boolean = false;

  public onLiveUpdate(callback: () => void): () => void {
    this.liveListeners.add(callback);
    return () => {
      this.liveListeners.delete(callback);
    };
  }

  public notifyLiveListeners(): void {
    if (this.isBroadcasting) {
      this.broadcastPending = true;
      return;
    }
    this.isBroadcasting = true;
    try {
      for (const listener of this.liveListeners) {
        try {
          listener();
        } catch (e) {
          console.warn('[Storage] Live update listener error:', e);
        }
      }
    } finally {
      this.isBroadcasting = false;
      if (this.broadcastPending) {
        this.broadcastPending = false;
        setTimeout(() => {
          this.notifyLiveListeners();
        }, 50);
      }
    }
  }

  constructor() {
    this.settings = {
      timezone: 'Africa/Casablanca',
      currency: 'MAD',
      currency_symbol: 'DH',
      hourly_rate: 60,
      minimum_price: 20,
      quick_price_1: 20,
      quick_price_2: 30,
      quick_price_3: 40,
      quick_price_4: 50,
      quick_price_5: 60,
      three_game_offer_enabled: true,
      three_game_threshold: 3,
      three_game_price_option_1: 40,
      three_game_price_option_2: 60,
      fifth_game_free_enabled: true,
      free_game_threshold: 5,
      free_game_cycle_reset: true,
      manual_price_enabled: true,
      updated_at: new Date().toISOString(),
      updated_by: 'SYSTEM',
    };

    this.seedDefaultData();
  }

  private seedDefaultData() {
    const now = new Date().toISOString();

    // 1. Super Administrator
    const superAdmin: User = {
      user_id: 'USR-ADMIN-01',
      name: 'Super Administrator',
      email: SUPER_ADMIN_EMAIL,
      role: 'ADMIN',
      pin: '753159',
      active: true,
      created_at: now,
      created_by: 'SYSTEM',
      last_login: now,
      updated_at: now,
    };
    this.users.set(superAdmin.user_id, superAdmin);

    // 2. Default Worker (Ayoub)
    const ayoubWorker: User = {
      user_id: 'USR-WORKER-01',
      name: 'Ayoub',
      email: 'ayoub@extrablack.com',
      role: 'WORKER',
      pin: '2026',
      active: true,
      created_at: now,
      created_by: 'SYSTEM',
      last_login: now,
      updated_at: now,
    };
    this.users.set(ayoubWorker.user_id, ayoubWorker);

    // 3. Tables (Mini 1 & Mini 2)
    const mini1: SnookerTable = {
      table_id: 'MINI1',
      name: 'Mini 1',
      active: true,
      hourly_rate: 60,
      minimum_price: 20,
      created_at: now,
      updated_at: now,
    };
    const mini2: SnookerTable = {
      table_id: 'MINI2',
      name: 'Mini 2',
      active: true,
      hourly_rate: 60,
      minimum_price: 20,
      created_at: now,
      updated_at: now,
    };
    this.tables.set(mini1.table_id, mini1);
    this.tables.set(mini2.table_id, mini2);

    // 4. Sample frequent customers for easy testing
    const sampleCustomers: Customer[] = [
      {
        customer_id: 'CUS-0001',
        name: 'Ahmed',
        normalized_name: normalizeCustomerName('Ahmed'),
        phone: '+212 600-112233',
        notes: 'Regular snooker enthusiast',
        active: true,
        created_at: now,
        created_by: 'SYSTEM',
        updated_at: now,
      },
      {
        customer_id: 'CUS-0002',
        name: 'Karim',
        normalized_name: normalizeCustomerName('Karim'),
        phone: '+212 611-334455',
        notes: 'Plays 8-ball and mini-snooker',
        active: true,
        created_at: now,
        created_by: 'SYSTEM',
        updated_at: now,
      },
      {
        customer_id: 'CUS-0003',
        name: 'Youssef',
        normalized_name: normalizeCustomerName('Youssef'),
        phone: '+212 622-556677',
        notes: '',
        active: true,
        created_at: now,
        created_by: 'SYSTEM',
        updated_at: now,
      },
      {
        customer_id: 'CUS-0004',
        name: 'Mehdi',
        normalized_name: normalizeCustomerName('Mehdi'),
        phone: '+212 633-778899',
        notes: 'VIP customer',
        active: true,
        created_at: now,
        created_by: 'SYSTEM',
        updated_at: now,
      },
    ];

    for (const cus of sampleCustomers) {
      this.customers.set(cus.customer_id, cus);
    }

    // 5. Initialize or get current daily session
    this.getOrCreateCurrentSession('SYSTEM');
  }

  public ensureLiveRunningGame(): Game | undefined {
    // Only used for manual development test seeding, not automatically on boot
    const currentSession = this.getOrCreateCurrentSession('SYSTEM');
    if (currentSession.status !== 'OPEN') return undefined;
    const todayShort = getCasablancaDate().replace(/-/g, '');

    // Ensure live match on MINI1
    let live1 = this.getActiveGameOnTable('MINI1');
    if (!live1) {
      const startTime1 = new Date(Date.now() - 32 * 60 * 1000).toISOString();
      const gameId1 = `GAME-${todayShort}-LIVE1`;
      live1 = {
        game_id: gameId1,
        session_id: currentSession.session_id,
        table_id: 'MINI1',
        customer_id: 'CUS-0002',
        player_name: 'Karim vs Mehdi',
        player1_name: 'Karim',
        player2_name: 'Mehdi',
        start_time: startTime1,
        duration_seconds: 32 * 60,
        duration_minutes: 32,
        raw_calculated_price: 32,
        suggested_price: 32,
        final_price: 0,
        price_difference: 0,
        discount_amount: 0,
        manual_price: false,
        game_number_today: 1,
        promo_cycle_game_count: 1,
        offer_eligible: false,
        offer_type: 'NONE',
        is_free_game: false,
        games_count: 3, // 3 games/frames, modifiable 1 to 9
        payment_status: 'PENDING',
        status: 'RUNNING',
        started_by: 'USR-WORKER-01',
        locked: false,
        created_at: startTime1,
        updated_at: startTime1,
        deleted: false,
      };
      this.games.set(gameId1, live1);
      saveToMongo('games', gameId1, live1).catch(() => {});
      saveToFirestore('games', gameId1, live1).catch(() => {});
    }

    return live1;
  }

  // ==================== SESSIONS ====================

  public getCurrentSession(): DailySession {
    return this.getOrCreateCurrentSession('SYSTEM');
  }

  public getOrCreateCurrentSession(userId: string = 'SYSTEM'): DailySession {
    const today = getCasablancaDate();

    // 1. Check for ANY active OPEN session (an unclosed session must not be abandoned just because calendar day changed)
    // In snooker halls, a shift remains open until the user explicitly closes it.
    const allOpenSessions = Array.from(this.sessions.values())
      .filter(s => s.status === 'OPEN' && !s.closed_at)
      .sort((a, b) => new Date(b.opened_at || b.date).getTime() - new Date(a.opened_at || a.date).getTime());

    // If an open session has recorded games/activity (e.g. yesterday's session that was never closed):
    const openWithGames = allOpenSessions.find(s => {
      if (s.total_games > 0) return true;
      return Array.from(this.games.values()).some(g => g.session_id === s.session_id && !g.deleted);
    });

    if (openWithGames) {
      // Clean up any empty 0-game phantom session that was accidentally created when the date rolled over
      for (const s of allOpenSessions) {
        if (s.session_id !== openWithGames.session_id && s.total_games === 0) {
          const hasGames = Array.from(this.games.values()).some(g => g.session_id === s.session_id && !g.deleted);
          if (!hasGames) {
            this.sessions.delete(s.session_id);
            deleteFromMongo('sessions', s.session_id).catch(() => {});
            deleteFromFirestore('sessions', s.session_id).catch(() => {});
          }
        }
      }
      return openWithGames;
    }

    // If an open session exists without games yet (e.g. newly opened shift):
    if (allOpenSessions.length > 0) {
      return allOpenSessions[0];
    }

    // 2. All previous sessions are closed! Create a fresh new OPEN session for today.
    const allTodaySessions = Array.from(this.sessions.values()).filter(s => s.date === today);
    const sessionCount = allTodaySessions.length;
    const sessionId = sessionCount === 0 ? `SESSION-${today}` : `SESSION-${today}-S${sessionCount + 1}`;

    const session: DailySession = {
      session_id: sessionId,
      date: today,
      opened_at: getCasablancaIsoString(),
      opened_by: userId,
      status: 'OPEN',
      total_games: 0,
      total_duration_minutes: 0,
      calculated_value: 0,
      final_value: 0,
      total_paid: 0,
      new_loans: 0,
      old_loans_collected: 0,
      discount_total: 0,
      free_game_value: 0,
      reste: 0,
      mini1_revenue: 0,
      mini2_revenue: 0,
    };
    this.sessions.set(sessionId, session);
    this.syncSessionToSheet(session);
    return session;
  }

  public getSessionById(sessionId: string): DailySession | undefined {
    return this.sessions.get(sessionId);
  }

  public getAllSessions(): DailySession[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  public closeSession(
    sessionId: string,
    closedByUserId: string,
    closedByEmail: string,
    notes?: string
  ): { success: boolean; session?: DailySession; error?: string } {
    if (this.sessionLock) {
      return { success: false, error: 'Session closure already in progress' };
    }
    this.sessionLock = true;

    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      if (session.status === 'CLOSED') {
        return { success: false, error: 'Session is already closed' };
      }

      // Check for active running games on Mini 1 and Mini 2
      const runningGames = Array.from(this.games.values()).filter(
        g => g.session_id === sessionId && g.status === 'RUNNING' && !g.deleted
      );

      if (runningGames.length > 0) {
        const tableNames = runningGames.map(g => this.tables.get(g.table_id)?.name || g.table_id).join(', ');
        return {
          success: false,
          error: `Cannot close session: Active game running on ${tableNames}. Please end or cancel active games first.`,
        };
      }

      // Recalculate session final totals
      this.recalculateSessionTotals(sessionId);
      const updatedSession = this.sessions.get(sessionId)!;

      updatedSession.status = 'CLOSED';
      updatedSession.closed_at = getCasablancaIsoString();
      updatedSession.closed_by = closedByUserId;
      if (notes) updatedSession.notes = notes;

      this.sessions.set(sessionId, updatedSession);

      // Audit Log
      this.logAudit({
        user_id: closedByUserId,
        user_email: closedByEmail,
        user_role: 'ADMIN',
        action: 'CLOSE_SESSION',
        entity_type: 'SESSION',
        entity_id: sessionId,
        session_id: sessionId,
        after_data: JSON.stringify(updatedSession),
        reason: 'Daily session closed by Administrator. Reset dashboard to 0.',
      });

      this.syncSessionToSheet(updatedSession);

      // Immediately instantiate fresh next session so live dashboard resets to 0
      this.getOrCreateCurrentSession(closedByUserId);

      return { success: true, session: updatedSession };
    } finally {
      this.sessionLock = false;
    }
  }

  public recalculateSessionTotals(sessionId: string, syncSheetAndFirestore: boolean = true): DailySession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    if (session.status === 'CLOSED') return session;

    const sessionGames = Array.from(this.games.values()).filter(
      g => g.session_id === sessionId && g.status === 'CLOSED' && !g.deleted
    );

    let totalGames = 0;
    let totalDuration = 0;
    let calculatedValue = 0;
    let finalValue = 0;
    let totalPaid = 0;
    let newLoans = 0;
    let discountTotal = 0;
    let freeGameValue = 0;
    let mini1Revenue = 0;
    let mini2Revenue = 0;

    for (const game of sessionGames) {
      totalGames += 1;
      totalDuration += game.duration_minutes || 0;
      calculatedValue += game.suggested_price || 0;
      finalValue += game.final_price || 0;
      discountTotal += game.discount_amount || 0;

      if (game.is_free_game) {
        freeGameValue += game.suggested_price || 0;
      }

      if (game.payment_status === 'PAID' || game.payment_status === 'LOAN_PAID') {
        totalPaid += game.final_price || 0;
        if (game.table_id === 'MINI1') mini1Revenue += game.final_price || 0;
        if (game.table_id === 'MINI2') mini2Revenue += game.final_price || 0;
      } else if (game.payment_status === 'LOAN') {
        newLoans += game.final_price || 0;
      }
    }

    // Calculate old loans collected during this session date
    const sessionDate = session.date;
    const oldLoansCollected = Array.from(this.loans.values())
      .filter(l => {
        if (l.status !== 'PAID' || !l.paid_at) return false;
        const paidDate = getCasablancaDate(new Date(l.paid_at));
        // Must be paid today, but originating from a previous session
        return paidDate === sessionDate && l.session_id !== sessionId;
      })
      .reduce((sum, l) => sum + l.amount, 0);

    // LE RESTE = ESPÈCE PAYÉ (Paid is le reste; Paid + Loan = Total Recette)
    const reste = totalPaid;

    session.total_games = totalGames;
    session.total_duration_minutes = totalDuration;
    session.calculated_value = calculatedValue;
    session.final_value = finalValue;
    session.total_paid = totalPaid;
    session.new_loans = newLoans;
    session.old_loans_collected = oldLoansCollected;
    session.discount_total = discountTotal;
    session.free_game_value = freeGameValue;
    session.reste = reste;
    session.mini1_revenue = mini1Revenue;
    session.mini2_revenue = mini2Revenue;

    this.sessions.set(sessionId, session);
    if (syncSheetAndFirestore) {
      this.syncSessionToSheet(session);
    }
    return session;
  }

  // ==================== TABLES ====================

  public getTables(): SnookerTable[] {
    return Array.from(this.tables.values());
  }

  public getTableById(tableId: string): SnookerTable | undefined {
    return this.tables.get(tableId);
  }

  public updateTable(tableId: string, updates: Partial<SnookerTable>): SnookerTable | undefined {
    const table = this.tables.get(tableId);
    if (!table) return undefined;
    const updated = { ...table, ...updates, updated_at: getCasablancaIsoString() };
    this.tables.set(tableId, updated);
    saveToMongo('tables', tableId, updated).catch(e => console.warn('[MongoDB] table sync error:', e));
    saveToFirestore('tables', tableId, updated).catch(e => console.warn('[Firestore] table sync error:', e));
    this.notifyLiveListeners();
    return updated;
  }

  // ==================== USERS & AUTH ====================

  public getUsers(): User[] {
    return Array.from(this.users.values());
  }

  public getUserByEmail(email: string): User | undefined {
    const norm = email.toLowerCase().trim();
    for (const u of this.users.values()) {
      if (u.email.toLowerCase().trim() === norm) {
        return u;
      }
    }
    // Super admin fallback
    if (norm === SUPER_ADMIN_EMAIL.toLowerCase()) {
      const now = new Date().toISOString();
      const adminUser: User = {
        user_id: 'USR-ADMIN-01',
        name: 'Super Administrator',
        email: SUPER_ADMIN_EMAIL,
        role: 'ADMIN',
        active: true,
        created_at: now,
        created_by: 'SYSTEM',
        last_login: now,
        updated_at: now,
      };
      this.users.set(adminUser.user_id, adminUser);
      return adminUser;
    }
    return undefined;
  }

  public getUserById(userId: string): User | undefined {
    return this.users.get(userId);
  }

  public getUserByPin(pin: string): User | undefined {
    const trimmed = String(pin).trim();
    if (!trimmed) return undefined;

    // Administrator PIN: 753159
    if (trimmed === '753159') {
      const admin = this.getUserByEmail(SUPER_ADMIN_EMAIL);
      if (admin) {
        admin.pin = '753159';
        return admin;
      }
    }

    // Worker PIN: 2026 (for Ayoub)
    if (trimmed === '2026') {
      const ayoub =
        this.getUserByEmail('ayoub@extrablack.com') ||
        Array.from(this.users.values()).find(u => u.name.toLowerCase().includes('ayoub')) ||
        this.getUserById('USR-WORKER-01');
      if (ayoub) {
        ayoub.pin = '2026';
        return ayoub;
      }
    }

    // Explicit user PIN match
    for (const u of this.users.values()) {
      if (u.pin === trimmed && u.active) {
        return u;
      }
    }

    // Fallbacks for testing
    if (trimmed === '1234' || trimmed === '0000') {
      return this.getUserByEmail(SUPER_ADMIN_EMAIL);
    }
    if (trimmed === '5678') {
      const worker =
        this.getUserByEmail('ayoub@extrablack.com') ||
        this.getUserById('USR-WORKER-01') ||
        Array.from(this.users.values()).find(u => u.role === 'WORKER');
      if (worker) return worker;
    }

    return undefined;
  }

  public createUser(userData: Omit<User, 'user_id' | 'created_at' | 'updated_at' | 'last_login'>): User {
    const now = getCasablancaIsoString();
    const userId = `USR-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
    const user: User = {
      ...userData,
      user_id: userId,
      created_at: now,
      updated_at: now,
      last_login: now,
    };
    this.users.set(userId, user);
    this.syncUserToSheet(user);
    return user;
  }

  public updateUser(userId: string, updates: Partial<User>): User | undefined {
    const user = this.users.get(userId);
    if (!user) return undefined;

    // Prevent demoting or deactivating super admin
    if (user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      updates.role = 'ADMIN';
      updates.active = true;
    }

    const updated = { ...user, ...updates, updated_at: getCasablancaIsoString() };
    this.users.set(userId, updated);
    this.syncUserToSheet(updated);
    return updated;
  }

  public deleteUser(userId: string): boolean {
    const user = this.users.get(userId);
    if (!user) return false;
    if (user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      return false; // Cannot delete super admin
    }
    user.active = false;
    user.updated_at = getCasablancaIsoString();
    this.users.set(userId, user);
    this.syncUserToSheet(user);
    return true;
  }

  // ==================== CONNECTED USER SESSIONS & WORKER TRACKING ====================

  public trackUserLogin(user: User, ip?: string, userAgent?: string): UserSessionLog {
    const now = getCasablancaIsoString();
    // Close any previous dangling ONLINE session for this user
    for (const [id, sess] of this.userSessionLogs.entries()) {
      if (sess.user_id === user.user_id && sess.status === 'ACTIVE') {
        sess.status = 'LOGGED_OUT';
        sess.logout_at = now;
        sess.duration_minutes = Math.max(
          1,
          Math.round((new Date(now).getTime() - new Date(sess.login_at).getTime()) / 60000)
        );
        this.userSessionLogs.set(id, sess);
      }
    }

    const sessionLogId = `USESS-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
    const newLog: UserSessionLog = {
      id: sessionLogId,
      session_log_id: sessionLogId,
      user_id: user.user_id,
      user_name: user.name,
      user_email: user.email,
      user_role: user.role,
      login_at: now,
      last_active_at: now,
      duration_minutes: 0,
      status: 'ACTIVE',
      ip_address: ip,
      user_agent: userAgent,
      games_handled: 0,
      revenue_collected: 0,
      loans_created: 0,
    };

    this.userSessionLogs.set(sessionLogId, newLog);
    saveToMongo('user_sessions', sessionLogId, newLog).catch(() => {});
    saveToFirestore('user_sessions', sessionLogId, newLog).catch(e => console.warn('[Firestore] user_sessions sync error:', e));
    return newLog;
  }

  public trackUserActivity(userId: string): void {
    const now = getCasablancaIsoString();
    for (const [id, sess] of this.userSessionLogs.entries()) {
      if (sess.user_id === userId && sess.status === 'ACTIVE') {
        sess.last_active_at = now;
        sess.duration_minutes = Math.max(
          1,
          Math.round((new Date(now).getTime() - new Date(sess.login_at).getTime()) / 60000)
        );
        this.userSessionLogs.set(id, sess);
        break;
      }
    }
  }

  public trackUserLogout(userId: string): void {
    const now = getCasablancaIsoString();
    for (const [id, sess] of this.userSessionLogs.entries()) {
      if (sess.user_id === userId && sess.status === 'ACTIVE') {
        sess.status = 'LOGGED_OUT';
        sess.logout_at = now;
        sess.duration_minutes = Math.max(
          1,
          Math.round((new Date(now).getTime() - new Date(sess.login_at).getTime()) / 60000)
        );
        this.userSessionLogs.set(id, sess);
        saveToMongo('user_sessions', id, sess).catch(() => {});
        saveToFirestore('user_sessions', id, sess).catch(e => console.warn('[Firestore] user_sessions update error:', e));
      }
    }
  }

  public disconnectUserSession(sessionLogId: string): boolean {
    const sess = this.userSessionLogs.get(sessionLogId);
    if (!sess) return false;
    const now = getCasablancaIsoString();
    sess.status = 'LOGGED_OUT';
    sess.logout_at = now;
    sess.duration_minutes = Math.max(
      1,
      Math.round((new Date(now).getTime() - new Date(sess.login_at).getTime()) / 60000)
    );
    this.userSessionLogs.set(sessionLogId, sess);
    saveToMongo('user_sessions', sessionLogId, sess).catch(() => {});
    saveToFirestore('user_sessions', sessionLogId, sess).catch(e => console.warn('[Firestore] user_sessions update error:', e));
    return true;
  }

  public getUserSessionLogs(filter?: { date?: string; userId?: string }): UserSessionLog[] {
    const all = Array.from(this.userSessionLogs.values());
    const now = new Date();

    // Enrich logs dynamically with live games & revenue counts
    const enriched = all.map(log => {
      const loginTime = new Date(log.login_at).getTime();
      const logoutTime = log.logout_at ? new Date(log.logout_at).getTime() : now.getTime();

      // Current duration in minutes
      const currentDuration = Math.max(
        1,
        Math.round((logoutTime - loginTime) / 60000)
      );

      // Games handled by this user
      const userGames = Array.from(this.games.values()).filter(g => {
        const gameTime = new Date(g.start_time).getTime();
        return (
          !g.deleted &&
          (g.started_by === log.user_id || g.ended_by === log.user_id) &&
          gameTime >= loginTime - 60000 &&
          gameTime <= logoutTime + 60000
        );
      });

      const userClosedGames = userGames.filter(g => g.status === 'CLOSED');
      const revenue = userClosedGames
        .filter(g => g.payment_status === 'PAID' || g.payment_status === 'LOAN_PAID')
        .reduce((sum, g) => sum + g.final_price, 0);

      const userLoans = Array.from(this.loans.values()).filter(l => {
        const loanTime = new Date(l.created_at).getTime();
        return (
          l.created_by === log.user_id &&
          loanTime >= loginTime - 60000 &&
          loanTime <= logoutTime + 60000
        );
      });
      const loansCreated = userLoans.reduce((sum, l) => sum + l.amount, 0);

      return {
        ...log,
        id: log.id || log.session_log_id,
        duration_minutes: log.status === 'ACTIVE' ? currentDuration : log.duration_minutes,
        games_handled: userClosedGames.length,
        revenue_collected: revenue,
        loans_created: loansCreated,
      };
    });

    return enriched
      .filter(l => {
        if (filter?.date && !l.login_at.startsWith(filter.date)) return false;
        if (filter?.userId && l.user_id !== filter.userId) return false;
        return true;
      })
      .sort((a, b) => new Date(b.login_at).getTime() - new Date(a.login_at).getTime());
  }

  // ==================== CALENDAR DAY SESSION REPORT ====================

  public getCalendarDayReport(dateStr: string): CalendarDayReport {
    const targetDate = dateStr || getCasablancaDate();
    const sessionId = `SESSION-${targetDate}`;
    const session = this.sessions.get(sessionId);

    // Find all games on that date
    const dayGames = Array.from(this.games.values()).filter(g => {
      if (g.deleted) return false;
      if (g.session_id === sessionId) return true;
      return g.start_time.startsWith(targetDate);
    });

    const closedGames = dayGames.filter(g => g.status === 'CLOSED');

    const totalGames = closedGames.length;
    const totalDuration = closedGames.reduce((sum, g) => sum + (g.duration_minutes || 0), 0);
    const calculatedVal = closedGames.reduce((sum, g) => sum + (g.suggested_price || g.raw_calculated_price || 0), 0);
    const finalVal = closedGames.reduce((sum, g) => sum + (g.final_price || 0), 0);
    const totalPaid = closedGames
      .filter(g => g.payment_status === 'PAID' || g.payment_status === 'LOAN_PAID')
      .reduce((sum, g) => sum + g.final_price, 0);
    const discounts = closedGames.reduce((sum, g) => sum + (g.discount_amount || 0), 0);
    const freeGames = closedGames.filter(g => g.is_free_game);
    const freeVal = freeGames.reduce((sum, g) => sum + (g.suggested_price || g.raw_calculated_price || 0), 0);

    const mini1Games = closedGames.filter(g => g.table_id === 'MINI1');
    const mini2Games = closedGames.filter(g => g.table_id === 'MINI2');
    const mini1Rev = mini1Games.filter(g => g.payment_status === 'PAID' || g.payment_status === 'LOAN_PAID').reduce((sum, g) => sum + g.final_price, 0);
    const mini2Rev = mini2Games.filter(g => g.payment_status === 'PAID' || g.payment_status === 'LOAN_PAID').reduce((sum, g) => sum + g.final_price, 0);
    const mini1Min = mini1Games.reduce((sum, g) => sum + (g.duration_minutes || 0), 0);
    const mini2Min = mini2Games.reduce((sum, g) => sum + (g.duration_minutes || 0), 0);
    const mini1Disc = mini1Games.reduce((sum, g) => sum + (g.discount_amount || 0), 0);
    const mini2Disc = mini2Games.reduce((sum, g) => sum + (g.discount_amount || 0), 0);

    // Find loans created on that date
    const dayLoans = Array.from(this.loans.values()).filter(l => {
      if (l.status === 'CANCELLED') return false;
      return l.session_id === sessionId || l.created_at.startsWith(targetDate);
    });
    const newLoansVal = dayLoans.reduce((sum, l) => sum + l.amount, 0);

    const reste = totalPaid;

    // Hourly distribution from 00:00 to 23:00
    const hourlyMap = new Map<number, { count: number; rev: number }>();
    for (let h = 0; h < 24; h++) {
      hourlyMap.set(h, { count: 0, rev: 0 });
    }

    for (const g of closedGames) {
      const hour = new Date(g.start_time).getHours();
      const current = hourlyMap.get(hour) || { count: 0, rev: 0 };
      current.count += 1;
      if (g.payment_status === 'PAID' || g.payment_status === 'LOAN_PAID') {
        current.rev += g.final_price;
      }
      hourlyMap.set(hour, current);
    }

    const hourlyActivity = Array.from(hourlyMap.entries())
      .map(([hour, data]) => ({
        hour,
        hourLabel: `${String(hour).padStart(2, '0')}:00`,
        gamesCount: data.count,
        paidRevenue: data.rev,
      }));

    return {
      date: targetDate,
      sessionId: session?.session_id || sessionId,
      status: session?.status || (targetDate === getCasablancaDate() ? 'OPEN' : 'CLOSED'),
      openedAt: session?.opened_at,
      closedAt: session?.closed_at,
      openedByName: session?.opened_by,
      closedByName: session?.closed_by,
      gamesCount: totalGames,
      totalPlayingMinutes: totalDuration,
      financials: {
        calculatedValue: session?.calculated_value || calculatedVal,
        finalValue: session?.final_value || finalVal,
        paidRevenue: session?.total_paid || totalPaid,
        newLoans: session?.new_loans || newLoansVal,
        reste: session?.reste || reste,
        discountsGiven: session?.discount_total || discounts,
        freeGamesCount: freeGames.length,
        freePromotionalValue: session?.free_game_value || freeVal,
      },
      tableBreakdown: {
        mini1: { games: mini1Games.length, minutes: mini1Min, revenue: mini1Rev, discounts: mini1Disc },
        mini2: { games: mini2Games.length, minutes: mini2Min, revenue: mini2Rev, discounts: mini2Disc },
      },
      hourlyActivity,
      games: dayGames.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()),
      loans: dayLoans.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    };
  }

  // ==================== AUTO ADD / SYNC PLAYERS ====================

  public syncAllPlayersToCustomers(userId: string = 'SYSTEM'): { totalAdded: number; totalExisting: number } {
    let addedCount = 0;
    const names = new Set<string>();

    // Scan all games
    for (const game of this.games.values()) {
      if (game.player_name && game.player_name.trim()) names.add(game.player_name.trim());
      if (game.player1_name && game.player1_name.trim()) names.add(game.player1_name.trim());
      if (game.player2_name && game.player2_name.trim()) names.add(game.player2_name.trim());
      if (game.winner_name && game.winner_name.trim()) names.add(game.winner_name.trim());
      if (game.loser_name && game.loser_name.trim()) names.add(game.loser_name.trim());
      if (game.payer_name && game.payer_name.trim()) names.add(game.payer_name.trim());
    }

    // Scan all loans
    for (const loan of this.loans.values()) {
      if (loan.player_name && loan.player_name.trim()) names.add(loan.player_name.trim());
    }

    // Scan all waiting entries
    for (const w of this.waitingList.values()) {
      if (w.player_name && w.player_name.trim()) names.add(w.player_name.trim());
    }

    for (const name of names) {
      const norm = normalizeCustomerName(name);
      if (!norm) continue;
      const existing = this.getCustomerByName(name);
      if (!existing) {
        this.createCustomer(name, undefined, 'Auto-added from game/loan logs', userId);
        addedCount++;
      }
    }

    return {
      totalAdded: addedCount,
      totalExisting: this.customers.size,
    };
  }

  // ==================== CUSTOMERS ====================

  public getCustomers(searchTerm?: string): Customer[] {
    const all = Array.from(this.customers.values()).filter(c => c.active);
    const today = getCasablancaDate();
    const currentSessionId = `SESSION-${today}`;

    // Attach computed stats
    const enriched = all.map(cus => {
      const cusGames = Array.from(this.games.values()).filter(
        g => g.customer_id === cus.customer_id && !g.deleted
      );
      const closedGames = cusGames.filter(g => g.status === 'CLOSED');
      const todayClosedGames = closedGames.filter(g => g.session_id === currentSessionId);
      
      const lifetimeLoans = Array.from(this.loans.values()).filter(
        l => l.customer_id === cus.customer_id && l.status !== 'CANCELLED'
      );
      const openLoans = lifetimeLoans.filter(l => l.status === 'OPEN');
      const openLoanBalance = openLoans.reduce((sum, l) => sum + l.amount, 0);
      const lifetimeLoanTotal = lifetimeLoans.reduce((sum, l) => sum + l.amount, 0);

      const totalPaid = closedGames
        .filter(g => g.payment_status === 'PAID' || g.payment_status === 'LOAN_PAID')
        .reduce((sum, g) => sum + g.final_price, 0);

      const discountsReceived = closedGames.reduce((sum, g) => sum + (g.discount_amount || 0), 0);
      const freeGamesReceived = closedGames.filter(g => g.is_free_game).length;

      const lastGame = closedGames.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];

      return {
        ...cus,
        today_games_count: todayClosedGames.length,
        promo_cycle_count: (todayClosedGames.length % 5) + 1,
        lifetime_games: closedGames.length,
        total_paid_dh: totalPaid,
        open_loan_balance_dh: openLoanBalance,
        lifetime_loans_dh: lifetimeLoanTotal,
        discounts_received_dh: discountsReceived,
        free_games_received: freeGamesReceived,
        last_visit_at: lastGame?.created_at,
      };
    });

    if (!searchTerm || !searchTerm.trim()) {
      return enriched.sort((a, b) => (b.lifetime_games || 0) - (a.lifetime_games || 0));
    }

    const normSearch = normalizeCustomerName(searchTerm);
    return enriched.filter(
      c =>
        c.normalized_name.includes(normSearch) ||
        (c.phone && c.phone.toLowerCase().includes(normSearch))
    );
  }

  public getCustomerById(customerId: string): Customer | undefined {
    return this.getCustomers().find(c => c.customer_id === customerId);
  }

  public getCustomerByName(name: string): Customer | undefined {
    const norm = normalizeCustomerName(name);
    return Array.from(this.customers.values()).find(
      c => c.active && c.normalized_name === norm
    );
  }

  public createCustomer(name: string, phone?: string, notes?: string, createdBy: string = 'STAFF'): Customer {
    const norm = normalizeCustomerName(name);
    // Check if customer with same normalized name already exists
    const existing = this.getCustomerByName(name);
    if (existing) {
      return existing;
    }

    const now = getCasablancaIsoString();
    const customerId = `CUS-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
    const customer: Customer = {
      customer_id: customerId,
      name: name.trim(),
      normalized_name: norm,
      phone: phone?.trim() || undefined,
      notes: notes?.trim() || undefined,
      active: true,
      created_at: now,
      created_by: createdBy,
      updated_at: now,
    };
    this.customers.set(customerId, customer);
    this.syncCustomerToSheet(customer);
    return customer;
  }

  public updateCustomer(customerId: string, updates: Partial<Customer>): Customer | undefined {
    const customer = this.customers.get(customerId);
    if (!customer) return undefined;
    if (updates.name) {
      updates.normalized_name = normalizeCustomerName(updates.name);
    }
    const updated = { ...customer, ...updates, updated_at: getCasablancaIsoString() };
    this.customers.set(customerId, updated);
    this.syncCustomerToSheet(updated);
    return updated;
  }

  // ==================== GAMES ====================

  public getActiveGames(): Game[] {
    const today = getCasablancaDate();
    return Array.from(this.games.values()).filter(g => {
      if (g.status !== 'RUNNING' || g.deleted) return false;
      const session = this.sessions.get(g.session_id);
      if (session && session.status === 'CLOSED') return false;
      const gameDate = g.start_time ? g.start_time.split('T')[0] : '';
      if (gameDate && gameDate < today) return false;
      return true;
    });
  }

  public getActiveGameOnTable(tableId: string): Game | undefined {
    const today = getCasablancaDate();
    return Array.from(this.games.values()).find(g => {
      if (g.table_id !== tableId || g.status !== 'RUNNING' || g.deleted) return false;
      const session = this.sessions.get(g.session_id);
      if (session && session.status === 'CLOSED') return false;
      const gameDate = g.start_time ? g.start_time.split('T')[0] : '';
      if (gameDate && gameDate < today) return false;
      return true;
    });
  }

  public sanitizeAndCloseStaleOvernightGames(): number {
    const today = getCasablancaDate();
    const nowMs = Date.now();
    let autoClosedCount = 0;

    for (const game of this.games.values()) {
      if (game.status !== 'RUNNING' || game.deleted) continue;

      const session = this.sessions.get(game.session_id);
      const gameDate = game.start_time ? game.start_time.split('T')[0] : '';
      const startMs = new Date(game.start_time).getTime();
      const elapsedHours = (nowMs - startMs) / (1000 * 60 * 60);

      const isSessionClosed = session && session.status === 'CLOSED';
      const isPastDate = gameDate && gameDate < today;
      const isExcessiveOvernight = elapsedHours > 8; // Game running > 8 hours

      if (isSessionClosed || isPastDate || isExcessiveOvernight) {
        let calculatedEnd: string;
        if (session && session.closed_at) {
          calculatedEnd = session.closed_at;
        } else {
          const endMs = Math.min(startMs + 30 * 60 * 1000, nowMs);
          calculatedEnd = new Date(endMs).toISOString();
        }

        const endMs = new Date(calculatedEnd).getTime();
        const durationSec = Math.max(60, Math.min(3600, Math.round((endMs - startMs) / 1000)));
        const durationMin = Math.round(durationSec / 60);
        const price = Math.max(this.settings.minimum_price || 20, durationMin);

        game.status = 'CLOSED';
        game.end_time = calculatedEnd;
        game.duration_seconds = durationSec;
        game.duration_minutes = durationMin;
        game.raw_calculated_price = price;
        game.suggested_price = price;
        game.final_price = price;
        if (game.payment_status === 'PENDING') {
          game.payment_status = 'PAID';
        }
        game.ended_by = 'SYSTEM_OVERNIGHT_GUARD';
        game.locked = true;
        game.updated_at = getCasablancaIsoString();

        this.games.set(game.game_id, game);
        saveToMongo('games', game.game_id, game).catch(() => {});
        saveToFirestore('games', game.game_id, game).catch(() => {});
        this.syncGameToSheet(game);

        if (session) {
          this.recalculateSessionTotals(session.session_id, false);
        }
        autoClosedCount++;
      }
    }

    if (autoClosedCount > 0) {
      console.log(`[Storage] Auto-closed ${autoClosedCount} stale overnight running games.`);
      this.notifyLiveListeners();
    }

    return autoClosedCount;
  }

  public getGameById(gameId: string): Game | undefined {
    return this.games.get(gameId);
  }

  public getGames(filter?: {
    sessionId?: string;
    customerId?: string;
    tableId?: string;
    status?: string;
    paymentStatus?: string;
    date?: string;
    includeDeleted?: boolean;
  }): Game[] {
    let result = Array.from(this.games.values());

    if (!filter?.includeDeleted) {
      result = result.filter(g => !g.deleted);
    }

    if (filter?.sessionId) {
      result = result.filter(g => g.session_id === filter.sessionId);
    }

    if (filter?.customerId) {
      result = result.filter(g => g.customer_id === filter.customerId);
    }

    if (filter?.tableId) {
      result = result.filter(g => g.table_id === filter.tableId);
    }

    if (filter?.status) {
      result = result.filter(g => g.status === filter.status);
    }

    if (filter?.paymentStatus) {
      result = result.filter(g => g.payment_status === filter.paymentStatus);
    }

    return result.sort(
      (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
    );
  }

  public getCustomerCompletedGamesToday(customerId: string, sessionId: string): Game[] {
    return Array.from(this.games.values()).filter(
      g =>
        g.customer_id === customerId &&
        g.session_id === sessionId &&
        g.status === 'CLOSED' &&
        !g.deleted
    );
  }

  public startGame(params: {
    tableId: string;
    customerId: string;
    playerName: string;
    player1Name?: string;
    player2Name?: string;
    userId: string;
    userEmail: string;
    userRole: string;
    waitingId?: string;
    gamesCount?: number;
  }): { success: boolean; game?: Game; error?: string } {
    const { tableId, customerId, playerName, player1Name, player2Name, userId, userEmail, userRole, waitingId, gamesCount } = params;

    // Mutex locking for the table
    if (this.tableLocks.has(tableId)) {
      return { success: false, error: 'Table operation already in progress' };
    }
    this.tableLocks.add(tableId);

    try {
      // Check if table currently has an active game
      const existingRunning = this.getActiveGameOnTable(tableId);
      if (existingRunning) {
        return {
          success: false,
          error: `${this.tables.get(tableId)?.name || tableId} already has an active game.`,
        };
      }

      const session = this.getOrCreateCurrentSession(userId);
      const now = getCasablancaIsoString();
      const todayShort = getCasablancaDate().replace(/-/g, '');
      
      // Calculate max existing sequence to avoid collisions and never overwrite existing games
      let maxSeq = 0;
      for (const gid of this.games.keys()) {
        const match = gid.match(/GAME-\d+-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      }
      let nextSeq = maxSeq + 1;
      let gameId = `GAME-${todayShort}-${nextSeq.toString().padStart(4, '0')}`;
      while (this.games.has(gameId)) {
        nextSeq++;
        gameId = `GAME-${todayShort}-${nextSeq.toString().padStart(4, '0')}`;
      }

      // Customer today stats
      const customerGamesToday = this.getCustomerCompletedGamesToday(customerId, session.session_id);
      const gameNumberToday = customerGamesToday.length + 1;
      const promoCycleCount = (customerGamesToday.length % 5) + 1;

      const newGame: Game = {
        game_id: gameId,
        session_id: session.session_id,
        table_id: tableId,
        customer_id: customerId,
        player_name: playerName,
        player1_name: player1Name,
        player2_name: player2Name,
        start_time: now,
        duration_seconds: 0,
        duration_minutes: 0,
        raw_calculated_price: 0,
        suggested_price: this.settings.minimum_price,
        final_price: 0,
        price_difference: 0,
        discount_amount: 0,
        manual_price: false,
        game_number_today: gameNumberToday,
        promo_cycle_game_count: promoCycleCount,
        offer_eligible: false,
        offer_type: 'NONE',
        is_free_game: false,
        games_count: Math.max(1, Math.min(9, Math.round(Number(gamesCount) || 1))),
        payment_status: 'PENDING',
        status: 'RUNNING',
        started_by: userId,
        locked: false,
        waiting_id: waitingId,
        created_at: now,
        updated_at: now,
        deleted: false,
      };

      this.games.set(gameId, newGame);

      // If started from waiting list, mark waiting entry seated
      if (waitingId) {
        this.updateWaitingEntry(waitingId, {
          status: 'SEATED',
          seated_at: now,
          game_id: gameId,
        });
      }

      // Audit log
      this.logAudit({
        user_id: userId,
        user_email: userEmail,
        user_role: userRole as any,
        action: 'START_GAME',
        entity_type: 'GAME',
        entity_id: gameId,
        session_id: session.session_id,
        after_data: JSON.stringify(newGame),
        reason: `Game started on ${tableId} for ${playerName}`,
      });

      this.syncGameToSheet(newGame);
      return { success: true, game: newGame };
    } finally {
      this.tableLocks.delete(tableId);
    }
  }

  public endGame(params: {
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
    userId: string;
    userEmail: string;
    userRole: string;
  }): { success: boolean; game?: Game; loan?: Loan; error?: string } {
    const {
      gameId,
      finalPrice,
      paymentType,
      winnerName,
      loserName,
      payerName,
      payerCustomerId,
      isFreeGame = false,
      priceReason,
      priceNote,
      offerType = 'NONE',
      offerSelectedPrice,
      gamesCount,
      userId,
      userEmail,
      userRole,
    } = params;

    const game = this.games.get(gameId);
    if (!game) {
      return { success: false, error: 'Game not found' };
    }

    if (game.status !== 'RUNNING') {
      return { success: false, error: 'This game is already closed or cancelled' };
    }

    if (gamesCount !== undefined) {
      game.games_count = Math.max(1, Math.min(9, Math.round(Number(gamesCount) || 1)));
    }

    const now = getCasablancaIsoString();
    const startMs = new Date(game.start_time).getTime();
    const endMs = new Date(now).getTime();
    const diffSec = Math.max(0, Math.floor((endMs - startMs) / 1000));
    const durationMinutes = diffSec > 0 ? Math.ceil(diffSec / 60) : 0;

    const ratePerMin = (this.settings.hourly_rate || 60) / 60;
    const rawCalculated = Math.round(durationMinutes * ratePerMin);

    const gamesCountVal = game.games_count || 1;
    const partieStandardPrice = gamesCountVal * 20;
    const suggested = Math.max(partieStandardPrice, this.settings.minimum_price || 20);

    // Manual custom discounts are strictly reserved for Admin (workers can only apply standard offers)
    if (userRole !== 'ADMIN' && priceReason && priceReason.includes('REMISE ADMIN')) {
      return { success: false, error: 'Les remises manuelles en DH sont réservées aux administrateurs.' };
    }

    const effectiveFinalPrice = isFreeGame ? 0 : Math.max(0, finalPrice);
    const priceDifference = effectiveFinalPrice - suggested;
    const discountAmount = Math.max(0, suggested - effectiveFinalPrice);
    const isManual = !isFreeGame && effectiveFinalPrice !== suggested;

    const beforeData = JSON.stringify(game);

    game.end_time = now;
    game.duration_seconds = diffSec;
    game.duration_minutes = durationMinutes;
    game.raw_calculated_price = rawCalculated;
    game.suggested_price = suggested;
    game.final_price = effectiveFinalPrice;
    game.price_difference = priceDifference;
    game.discount_amount = discountAmount;
    game.manual_price = isManual;
    if (priceReason) game.price_reason = priceReason;
    if (priceNote) game.price_note = priceNote;
    game.is_free_game = isFreeGame;
    game.offer_type = offerType;
    if (offerSelectedPrice !== undefined) game.offer_selected_price = offerSelectedPrice;
    game.offer_eligible = offerType !== 'NONE';

    if (winnerName) game.winner_name = winnerName;
    if (loserName) game.loser_name = loserName;
    const effectivePayer = payerName || loserName;
    if (effectivePayer) game.payer_name = effectivePayer;

    if (winnerName && loserName) {
      game.notes = `Match Result: Winner ${winnerName} (Exempt 0 DH) • Loser ${loserName} (Charged ${effectiveFinalPrice} DH)`;
    }

    // Resolve payer customer record if paying by loan or specific player
    let payerCustomer = payerCustomerId ? this.getCustomerById(payerCustomerId) : undefined;
    if (!payerCustomer && effectivePayer) {
      payerCustomer = this.getCustomerByName(effectivePayer) || this.createCustomer(effectivePayer, undefined, undefined, userId);
      game.payer_customer_id = payerCustomer.customer_id;
    }

    game.status = 'CLOSED';
    game.ended_by = userId;
    game.updated_at = now;

    let createdLoan: Loan | undefined = undefined;

    if (paymentType === 'PAID') {
      game.payment_status = isFreeGame ? 'FREE' : 'PAID';
      game.paid_at = now;
      game.paid_by = userId;
      game.locked = true; // Worker cannot edit once locked
    } else if (paymentType === 'PAY_LATER') {
      // Customer is still in the hall, will pay when going out
      game.payment_status = 'PAY_LATER';
      game.locked = false; // Open to be collected when customer leaves
      const hallNote = 'En salle (Paiement à la sortie)';
      game.notes = game.notes ? `${game.notes} • ${hallNote}` : hallNote;
    } else {
      // LOAN
      game.payment_status = 'LOAN';
      game.locked = false; // Protected from general edit, open for payment collection

      // Create Loan record for the loser / payer
      const loanPlayerName = effectivePayer || game.player_name;
      const loanCustomerId = payerCustomer ? payerCustomer.customer_id : game.customer_id;
      const loanId = `LOAN-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;

      createdLoan = {
        loan_id: loanId,
        game_id: game.game_id,
        session_id: game.session_id,
        customer_id: loanCustomerId,
        player_name: loanPlayerName,
        amount: effectiveFinalPrice,
        created_at: now,
        created_by: userId,
        status: 'OPEN',
        notes: priceNote || (loserName ? `Match debt: ${loserName} lost to ${winnerName || 'opponent'} (Loser pays)` : `Loan created for ${game.player_name}`),
        updated_at: now,
      };
      this.loans.set(loanId, createdLoan);
      this.syncLoanToSheet(createdLoan);
    }

    this.games.set(gameId, game);

    // Recalculate session totals
    this.recalculateSessionTotals(game.session_id);

    // Audit Log
    this.logAudit({
      user_id: userId,
      user_email: userEmail,
      user_role: userRole as any,
      action: paymentType === 'PAID' ? 'END_GAME_PAID' : paymentType === 'PAY_LATER' ? 'END_GAME_PAY_LATER' : 'END_GAME_LOAN',
      entity_type: 'GAME',
      entity_id: gameId,
      session_id: game.session_id,
      before_data: beforeData,
      after_data: JSON.stringify(game),
      reason: isManual ? `Manual price entered: ${effectiveFinalPrice} DH (${priceReason || 'None'})` : `Ended game with ${paymentType}`,
    });

    this.syncGameToSheet(game);
    return { success: true, game, loan: createdLoan };
  }

  public updateGameGamesCount(
    gameId: string,
    gamesCount: number,
    user: { id: string; email: string; role?: string }
  ): { success: boolean; game?: Game; error?: string } {
    const game = this.games.get(gameId);
    if (!game) {
      return { success: false, error: 'Game not found' };
    }

    const beforeCount = game.games_count || 1;
    const count = Math.max(1, Math.min(9, Math.round(Number(gamesCount) || 1)));
    game.games_count = count;
    game.updated_at = getCasablancaIsoString();
    this.games.set(gameId, game);
    saveToMongo('games', gameId, game).catch(() => {});
    saveToFirestore('games', gameId, game).catch(() => {});

    this.logAudit({
      user_id: user.id,
      user_email: user.email,
      user_role: (user.role as any) || 'WORKER',
      action: 'EDIT_GAME',
      entity_type: 'GAME',
      entity_id: gameId,
      session_id: game.session_id,
      before_data: JSON.stringify({ games_count: beforeCount }),
      after_data: JSON.stringify({ games_count: count }),
      reason: `Updated games/frames count to ${count}`,
    });

    return { success: true, game };
  }

  public updateGamePlayers(
    gameId: string,
    data: { playerName?: string; player1Name?: string; player2Name?: string },
    user: { id: string; email: string; role?: string }
  ): { success: boolean; game?: Game; error?: string } {
    const game = this.games.get(gameId);
    if (!game) {
      return { success: false, error: 'Game not found' };
    }

    const beforeNames = {
      player_name: game.player_name,
      player1_name: game.player1_name,
      player2_name: game.player2_name,
    };

    let p1 = (data.player1Name !== undefined ? data.player1Name : game.player1_name || '').trim();
    let p2 = (data.player2Name !== undefined ? data.player2Name : game.player2_name || '').trim();
    let pName = (data.playerName !== undefined ? data.playerName : '').trim();

    if (p1 && p2) {
      pName = `${p1} vs ${p2}`;
    } else if (!pName && (p1 || p2)) {
      pName = p1 || p2;
    }

    if (!pName) {
      return { success: false, error: 'Veuillez saisir au moins un nom valide' };
    }

    game.player_name = pName;
    game.player1_name = p1 || undefined;
    game.player2_name = p2 || undefined;
    game.updated_at = getCasablancaIsoString();

    this.games.set(gameId, game);
    saveToMongo('games', gameId, game).catch(() => {});
    saveToFirestore('games', gameId, game).catch(() => {});

    this.logAudit({
      user_id: user.id,
      user_email: user.email,
      user_role: (user.role as any) || 'WORKER',
      action: 'EDIT_GAME',
      entity_type: 'GAME',
      entity_id: gameId,
      session_id: game.session_id,
      before_data: JSON.stringify(beforeNames),
      after_data: JSON.stringify({
        player_name: game.player_name,
        player1_name: game.player1_name,
        player2_name: game.player2_name,
      }),
      reason: `Correction nom joueur : ${game.player_name}`,
    });

    return { success: true, game };
  }

  public editGame(
    gameId: string,
    updates: Partial<Game>,
    adminUser: { id: string; email: string },
    reason: string
  ): { success: boolean; game?: Game; error?: string } {
    const game = this.games.get(gameId);
    if (!game) return { success: false, error: 'Game not found' };

    const beforeData = JSON.stringify(game);
    const now = getCasablancaIsoString();

    // If start_time or end_time updated, recalculate duration and raw/suggested price
    let durationMinutes = game.duration_minutes;
    let durationSeconds = game.duration_seconds;
    let rawCalculated = game.raw_calculated_price;
    let suggested = game.suggested_price;

    const startTime = updates.start_time || game.start_time;
    const endTime = updates.end_time || game.end_time;

    if (startTime && endTime) {
      const startMs = new Date(startTime).getTime();
      const endMs = new Date(endTime).getTime();
      durationSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));
      durationMinutes = durationSeconds > 0 ? Math.ceil(durationSeconds / 60) : 0;
      const ratePerMin = (this.settings.hourly_rate || 60) / 60;
      rawCalculated = Math.round(durationMinutes * ratePerMin);
      suggested = Math.max(this.settings.minimum_price || 20, rawCalculated);
    }

    const finalPrice = updates.final_price !== undefined ? updates.final_price : game.final_price;
    const priceDifference = finalPrice - suggested;
    const discountAmount = Math.max(0, suggested - finalPrice);
    const isManual = finalPrice !== suggested;

    const updatedGame: Game = {
      ...game,
      ...updates,
      duration_seconds: durationSeconds,
      duration_minutes: durationMinutes,
      raw_calculated_price: rawCalculated,
      suggested_price: suggested,
      final_price: finalPrice,
      price_difference: priceDifference,
      discount_amount: discountAmount,
      manual_price: isManual,
      updated_at: now,
    };

    this.games.set(gameId, updatedGame);

    // Recalculate session totals
    this.recalculateSessionTotals(game.session_id);

    // Audit Log
    this.logAudit({
      user_id: adminUser.id,
      user_email: adminUser.email,
      user_role: 'ADMIN',
      action: 'EDIT_GAME',
      entity_type: 'GAME',
      entity_id: gameId,
      session_id: game.session_id,
      before_data: beforeData,
      after_data: JSON.stringify(updatedGame),
      reason: reason || 'Administrator corrected game record',
    });

    this.syncGameToSheet(updatedGame);
    return { success: true, game: updatedGame };
  }

  public cancelOrDeleteGame(
    gameId: string,
    adminUser: { id: string; email: string; role?: string },
    reason: string
  ): { success: boolean; game?: Game; error?: string } {
    const game = this.games.get(gameId);
    if (!game) return { success: false, error: 'Game not found' };
    if (game.status === 'CANCELLED' || game.deleted) {
      return { success: false, error: 'Game has already been cancelled or deleted' };
    }

    const beforeData = JSON.stringify(game);
    const now = getCasablancaIsoString();

    game.status = 'CANCELLED';
    game.deleted = true;
    game.deleted_at = now;
    game.deleted_by = adminUser.id;
    game.deletion_reason = reason || 'Cancelled / Mistake removed';
    game.updated_at = now;

    this.games.set(gameId, game);

    // Save to Firestore and MongoDB
    saveToFirestore('games', gameId, game).catch(e => console.warn('[Firestore] game delete sync error:', e));
    saveToMongo('games', gameId, game).catch(e => console.warn('[MongoDB] game delete sync error:', e));

    // If there was an associated open loan, cancel it too
    const loan = Array.from(this.loans.values()).find(l => l.game_id === gameId);
    if (loan && loan.status === 'OPEN') {
      loan.status = 'CANCELLED';
      loan.cancelled_at = now;
      loan.cancelled_by = adminUser.id;
      loan.updated_at = now;
      this.loans.set(loan.loan_id, loan);
      saveToFirestore('loans', loan.loan_id, loan).catch(e => console.warn('[Firestore] loan sync error:', e));
      saveToMongo('loans', loan.loan_id, loan).catch(e => console.warn('[MongoDB] loan sync error:', e));
      this.syncLoanToSheet(loan);
    }

    // Recalculate session totals
    this.recalculateSessionTotals(game.session_id);

    // Audit Log
    this.logAudit({
      user_id: adminUser.id,
      user_email: adminUser.email,
      user_role: (adminUser.role || 'WORKER') as any,
      action: 'DELETE_GAME',
      entity_type: 'GAME',
      entity_id: gameId,
      session_id: game.session_id,
      before_data: beforeData,
      after_data: JSON.stringify(game),
      reason: reason || 'Game record soft-deleted / mistake removed',
    });

    this.syncGameToSheet(game);
    this.notifyLiveListeners();
    return { success: true, game };
  }

  // ==================== LOANS ====================

  public getLoans(status?: string): Loan[] {
    let list = Array.from(this.loans.values());
    if (status) {
      list = list.filter(l => l.status === status);
    }
    return list.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  public getLoanById(loanId: string): Loan | undefined {
    return this.loans.get(loanId);
  }

  public payLoan(
    loanId: string,
    userId: string,
    userEmail: string,
    userRole: string
  ): { success: boolean; loan?: Loan; error?: string } {
    if (this.loanLocks.has(loanId)) {
      return { success: false, error: 'Loan payment already in progress' };
    }
    this.loanLocks.add(loanId);

    try {
      const loan = this.loans.get(loanId);
      if (!loan) {
        return { success: false, error: 'Loan not found' };
      }

      if (loan.status === 'PAID') {
        return { success: false, error: 'This loan has already been paid.' };
      }

      if (loan.status === 'CANCELLED') {
        return { success: false, error: 'Cannot pay a cancelled loan.' };
      }

      const beforeData = JSON.stringify(loan);
      const now = getCasablancaIsoString();

      loan.status = 'PAID';
      loan.paid_at = now;
      loan.paid_by = userId;
      loan.updated_at = now;

      this.loans.set(loanId, loan);

      // Update associated game payment status to LOAN_PAID
      const game = this.games.get(loan.game_id);
      if (game) {
        game.payment_status = 'LOAN_PAID';
        game.paid_at = now;
        game.paid_by = userId;
        game.locked = true;
        this.games.set(game.game_id, game);
        this.syncGameToSheet(game);
      }

      // Recalculate current session (for old_loans_collected tracking)
      const currentSession = this.getCurrentSession();
      this.recalculateSessionTotals(currentSession.session_id);

      // Audit Log
      this.logAudit({
        user_id: userId,
        user_email: userEmail,
        user_role: userRole as any,
        action: 'PAY_LOAN',
        entity_type: 'LOAN',
        entity_id: loanId,
        session_id: currentSession.session_id,
        before_data: beforeData,
        after_data: JSON.stringify(loan),
        reason: `Loan of ${loan.amount} DH collected for ${loan.player_name}`,
      });

      this.syncLoanToSheet(loan);
      return { success: true, loan };
    } finally {
      this.loanLocks.delete(loanId);
    }
  }

  public payGameCredit(
    gameId: string,
    userId: string,
    userEmail: string,
    userRole: string
  ): { success: boolean; game?: Game; loan?: Loan; error?: string } {
    const game = this.games.get(gameId);
    if (!game) {
      return { success: false, error: 'Game not found' };
    }
    if (game.payment_status === 'PAID' || game.payment_status === 'LOAN_PAID') {
      return { success: false, error: 'This game has already been paid.' };
    }

    // Check for an associated open loan
    const loan = Array.from(this.loans.values()).find(
      l => l.game_id === gameId && l.status === 'OPEN'
    );
    if (loan) {
      const loanResult = this.payLoan(loan.loan_id, userId, userEmail, userRole);
      return { success: true, game: this.games.get(gameId), loan: loanResult.loan };
    }

    // Direct game payment status update
    const now = getCasablancaIsoString();
    const beforeData = JSON.stringify(game);
    const wasPayLater = game.payment_status === 'PAY_LATER';
    // If the customer was in the hall (PAY_LATER) and pays at exit, it turns into PAID!
    game.payment_status = wasPayLater ? 'PAID' : 'LOAN_PAID';
    game.paid_at = now;
    game.paid_by = userId;
    game.locked = true;
    game.updated_at = now;
    this.games.set(gameId, game);
    this.syncGameToSheet(game);

    this.recalculateSessionTotals(game.session_id);
    const currentSession = this.getCurrentSession();
    if (currentSession.session_id !== game.session_id) {
      this.recalculateSessionTotals(currentSession.session_id);
    }

    this.logAudit({
      user_id: userId,
      user_email: userEmail,
      user_role: userRole as any,
      action: wasPayLater ? 'COLLECT_PAY_LATER' : 'PAY_LOAN',
      entity_type: 'GAME',
      entity_id: gameId,
      session_id: game.session_id,
      before_data: beforeData,
      after_data: JSON.stringify(game),
      reason: wasPayLater
        ? `Payment at exit collected for ${game.payer_name || game.player_name}`
        : `Credit marked as paid for ${game.payer_name || game.player_name}`,
    });

    return { success: true, game };
  }

  public cancelLoan(
    loanId: string,
    adminUser: { id: string; email: string },
    reason: string
  ): { success: boolean; loan?: Loan; error?: string } {
    const loan = this.loans.get(loanId);
    if (!loan) return { success: false, error: 'Loan not found' };

    const beforeData = JSON.stringify(loan);
    const now = getCasablancaIsoString();

    loan.status = 'CANCELLED';
    loan.cancelled_at = now;
    loan.cancelled_by = adminUser.id;
    loan.updated_at = now;

    this.loans.set(loanId, loan);

    const currentSession = this.getCurrentSession();
    this.recalculateSessionTotals(currentSession.session_id);

    this.logAudit({
      user_id: adminUser.id,
      user_email: adminUser.email,
      user_role: 'ADMIN',
      action: 'CANCEL_LOAN',
      entity_type: 'LOAN',
      entity_id: loanId,
      session_id: currentSession.session_id,
      before_data: beforeData,
      after_data: JSON.stringify(loan),
      reason: reason || 'Loan cancelled by administrator',
    });

    this.syncLoanToSheet(loan);
    return { success: true, loan };
  }

  // ==================== WAITING LIST ====================

  public getWaitingList(tableId?: string, status: string = 'WAITING'): WaitingEntry[] {
    let list = Array.from(this.waitingList.values()).filter(w => w.status === status);
    if (tableId) {
      list = list.filter(w => w.preferred_table === tableId || w.preferred_table === 'ANY');
    }
    return list.sort(
      (a, b) => new Date(a.added_at).getTime() - new Date(b.added_at).getTime()
    );
  }

  public addWaitingCustomer(params: {
    customerId: string;
    playerName: string;
    preferredTable: 'MINI1' | 'MINI2' | 'ANY';
    notes?: string;
    userId: string;
    userEmail: string;
    userRole: string;
  }): WaitingEntry {
    const { customerId, playerName, preferredTable, notes, userId, userEmail, userRole } = params;
    const session = this.getCurrentSession();
    const now = getCasablancaIsoString();
    const waitingId = `WAIT-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;

    const entry: WaitingEntry = {
      waiting_id: waitingId,
      session_id: session.session_id,
      customer_id: customerId,
      player_name: playerName,
      preferred_table: preferredTable,
      added_at: now,
      added_by: userId,
      status: 'WAITING',
      notes,
      updated_at: now,
    };

    this.waitingList.set(waitingId, entry);

    this.logAudit({
      user_id: userId,
      user_email: userEmail,
      user_role: userRole as any,
      action: 'WAITING_ADD',
      entity_type: 'WAITING',
      entity_id: waitingId,
      session_id: session.session_id,
      after_data: JSON.stringify(entry),
      reason: `Added ${playerName} to waiting list (${preferredTable})`,
    });

    this.syncWaitingToSheet(entry);
    return entry;
  }

  public updateWaitingEntry(
    waitingId: string,
    updates: Partial<WaitingEntry>
  ): WaitingEntry | undefined {
    const entry = this.waitingList.get(waitingId);
    if (!entry) return undefined;
    const updated = { ...entry, ...updates, updated_at: getCasablancaIsoString() };
    this.waitingList.set(waitingId, updated);
    this.syncWaitingToSheet(updated);
    return updated;
  }

  // ==================== SETTINGS ====================

  public getSettings(): AppSettings {
    return { ...this.settings };
  }

  public updateSettings(
    newSettings: Partial<AppSettings>,
    adminUser: { id: string; email: string }
  ): AppSettings {
    const beforeData = JSON.stringify(this.settings);
    this.settings = {
      ...this.settings,
      ...newSettings,
      updated_at: getCasablancaIsoString(),
      updated_by: adminUser.email,
    };

    saveToMongo('settings', 'app_config', this.settings).catch(e =>
      console.warn('[MongoDB] settings sync error:', e)
    );
    saveToFirestore('settings', 'app_config', this.settings).catch(e =>
      console.warn('[Firestore] settings sync error:', e)
    );

    this.logAudit({
      user_id: adminUser.id,
      user_email: adminUser.email,
      user_role: 'ADMIN',
      action: 'CHANGE_SETTING',
      entity_type: 'SETTINGS',
      entity_id: 'GLOBAL',
      session_id: this.getCurrentSession().session_id,
      before_data: beforeData,
      after_data: JSON.stringify(this.settings),
      reason: 'Application settings updated by administrator',
    });

    return this.settings;
  }

  // ==================== AUDIT LOGS ====================

  public logAudit(entry: Omit<AuditEntry, 'audit_id' | 'timestamp'>): AuditEntry {
    const auditId = `AUD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
    const fullEntry: AuditEntry = {
      ...entry,
      audit_id: auditId,
      timestamp: getCasablancaIsoString(),
    };
    this.auditLogs.unshift(fullEntry);
    this.syncAuditToSheet(fullEntry);
    return fullEntry;
  }

  public getAuditLogs(limit: number = 100): AuditEntry[] {
    return this.auditLogs.slice(0, limit);
  }

  // ==================== LIVE DASHBOARD STATE ====================

  public getLiveDashboardData(): DashboardLiveData {
    const session = this.getCurrentSession();
    this.recalculateSessionTotals(session.session_id, false);

    const tables = this.getTables().map(table => {
      const activeGame = this.getActiveGameOnTable(table.table_id);
      const waitingQueue = this.getWaitingList(table.table_id, 'WAITING');
      return {
        table,
        activeGame,
        waitingQueue,
      };
    });

    const openLoans = this.getLoans('OPEN');
    const allRecentGames = this.getGames({ sessionId: session.session_id });
    const recentGames = allRecentGames.slice(0, 50);
    const waitingList = this.getWaitingList(undefined, 'WAITING');

    const creditPaidInSession = allRecentGames
      .filter(g => g.payment_status === 'LOAN_PAID' && !g.deleted)
      .reduce((sum, g) => sum + (g.final_price || 0), 0);
    const creditPaidToday = creditPaidInSession + (session.old_loans_collected || 0);

    const payLaterGames = allRecentGames.filter(g => g.payment_status === 'PAY_LATER' && !g.deleted);
    const totalPayLater = payLaterGames.reduce((sum, g) => sum + (g.final_price || 0), 0);
    const payLaterCount = payLaterGames.length;

    return {
      session,
      tables,
      todayTotals: {
        totalPaid: session.total_paid,
        totalLoan: session.new_loans,
        totalPayLater,
        payLaterCount,
        leReste: session.reste,
        oldLoansCollectedToday: session.old_loans_collected,
        creditPaidToday,
        totalGamesToday: session.total_games,
        totalPlayingMinutesToday: session.total_duration_minutes,
        discountsGivenToday: session.discount_total,
        freePromotionalValueToday: session.free_game_value,
        mini1Revenue: session.mini1_revenue,
        mini2Revenue: session.mini2_revenue,
      },
      openLoans,
      recentGames,
      waitingList,
    };
  }

  // ==================== GOOGLE SHEETS & CLOUD FIRESTORE ASYNC WRITERS ====================

  private async syncGameToSheet(game: Game) {
    // MongoDB & Cloud Firestore Sync
    saveToMongo('games', game.game_id, game).catch(e => console.warn('[MongoDB] game sync error:', e));
    saveToFirestore('games', game.game_id, game).catch(e => console.warn('[Firestore] game sync error:', e));
    this.notifyLiveListeners();

    if (!googleSheetsService.isConfigured()) return;
    try {
      await googleSheetsService.upsertRow('Games', 0, game.game_id, [
        game.game_id,
        game.session_id,
        game.table_id,
        game.customer_id,
        game.player_name,
        game.start_time,
        game.end_time,
        game.duration_seconds,
        game.duration_minutes,
        game.raw_calculated_price,
        game.suggested_price,
        game.final_price,
        game.price_difference,
        game.discount_amount,
        game.manual_price,
        game.price_reason,
        game.price_note,
        game.game_number_today,
        game.promo_cycle_game_count,
        game.offer_eligible,
        game.offer_type,
        game.offer_selected_price,
        game.is_free_game,
        game.payment_status,
        game.status,
        game.started_by,
        game.ended_by,
        game.paid_at,
        game.paid_by,
        game.locked,
        game.waiting_id,
        game.notes,
        game.created_at,
        game.updated_at,
        game.deleted,
        game.deleted_at,
        game.deleted_by,
        game.deletion_reason,
      ]);
    } catch (e) {
      console.warn('[Sync] Failed to sync game to sheet:', e);
    }
  }

  private async syncLoanToSheet(loan: Loan) {
    // MongoDB & Cloud Firestore Sync
    saveToMongo('loans', loan.loan_id, loan).catch(e => console.warn('[MongoDB] loan sync error:', e));
    saveToFirestore('loans', loan.loan_id, loan).catch(e => console.warn('[Firestore] loan sync error:', e));
    this.notifyLiveListeners();

    if (!googleSheetsService.isConfigured()) return;
    try {
      await googleSheetsService.upsertRow('Loans', 0, loan.loan_id, [
        loan.loan_id,
        loan.game_id,
        loan.session_id,
        loan.customer_id,
        loan.player_name,
        loan.amount,
        loan.created_at,
        loan.created_by,
        loan.status,
        loan.paid_at,
        loan.paid_by,
        loan.cancelled_at,
        loan.cancelled_by,
        loan.notes,
        loan.updated_at,
      ]);
    } catch (e) {
      console.warn('[Sync] Failed to sync loan to sheet:', e);
    }
  }

  private async syncSessionToSheet(session: DailySession) {
    // MongoDB & Cloud Firestore Sync
    saveToMongo('sessions', session.session_id, session).catch(e => console.warn('[MongoDB] session sync error:', e));
    saveToFirestore('sessions', session.session_id, session).catch(e => console.warn('[Firestore] session sync error:', e));
    this.notifyLiveListeners();

    if (!googleSheetsService.isConfigured()) return;
    try {
      await googleSheetsService.upsertRow('Sessions', 0, session.session_id, [
        session.session_id,
        session.date,
        session.opened_at,
        session.opened_by,
        session.closed_at,
        session.closed_by,
        session.status,
        session.total_games,
        session.total_duration_minutes,
        session.calculated_value,
        session.final_value,
        session.total_paid,
        session.new_loans,
        session.old_loans_collected,
        session.discount_total,
        session.free_game_value,
        session.reste,
        session.mini1_revenue,
        session.mini2_revenue,
        session.notes,
      ]);
    } catch (e) {
      console.warn('[Sync] Failed to sync session to sheet:', e);
    }
  }

  private async syncCustomerToSheet(customer: Customer) {
    // MongoDB & Cloud Firestore Sync
    saveToMongo('customers', customer.customer_id, customer).catch(e => console.warn('[MongoDB] customer sync error:', e));
    saveToFirestore('customers', customer.customer_id, customer).catch(e => console.warn('[Firestore] customer sync error:', e));
    this.notifyLiveListeners();

    if (!googleSheetsService.isConfigured()) return;
    try {
      await googleSheetsService.upsertRow('Customers', 0, customer.customer_id, [
        customer.customer_id,
        customer.name,
        customer.normalized_name,
        customer.phone,
        customer.notes,
        customer.active,
        customer.created_at,
        customer.created_by,
        customer.updated_at,
      ]);
    } catch (e) {
      console.warn('[Sync] Failed to sync customer to sheet:', e);
    }
  }

  private async syncUserToSheet(user: User) {
    // MongoDB & Cloud Firestore Sync
    saveToMongo('users', user.user_id, user).catch(e => console.warn('[MongoDB] user sync error:', e));
    saveToFirestore('users', user.user_id, user).catch(e => console.warn('[Firestore] user sync error:', e));

    if (!googleSheetsService.isConfigured()) return;
    try {
      await googleSheetsService.upsertRow('Users', 0, user.user_id, [
        user.user_id,
        user.name,
        user.email,
        user.role,
        user.active,
        user.created_at,
        user.created_by,
        user.last_login,
        user.updated_at,
      ]);
    } catch (e) {
      console.warn('[Sync] Failed to sync user to sheet:', e);
    }
  }

  private async syncWaitingToSheet(waiting: WaitingEntry) {
    // MongoDB & Cloud Firestore Sync
    saveToMongo('waiting_list', waiting.waiting_id, waiting).catch(e => console.warn('[MongoDB] waiting sync error:', e));
    saveToFirestore('waiting_list', waiting.waiting_id, waiting).catch(e => console.warn('[Firestore] waiting sync error:', e));
    this.notifyLiveListeners();

    if (!googleSheetsService.isConfigured()) return;
    try {
      await googleSheetsService.upsertRow('WaitingList', 0, waiting.waiting_id, [
        waiting.waiting_id,
        waiting.session_id,
        waiting.customer_id,
        waiting.player_name,
        waiting.preferred_table,
        waiting.added_at,
        waiting.added_by,
        waiting.status,
        waiting.seated_at,
        waiting.game_id,
        waiting.notes,
        waiting.updated_at,
      ]);
    } catch (e) {
      console.warn('[Sync] Failed to sync waiting to sheet:', e);
    }
  }

  private async syncAuditToSheet(audit: AuditEntry) {
    // MongoDB & Cloud Firestore Sync
    saveToMongo('audit_logs', audit.audit_id, audit).catch(e => console.warn('[MongoDB] audit sync error:', e));
    saveToFirestore('audit_logs', audit.audit_id, audit).catch(e => console.warn('[Firestore] audit sync error:', e));

    if (!googleSheetsService.isConfigured()) return;
    try {
      await googleSheetsService.appendRow('AuditLog', [
        audit.audit_id,
        audit.timestamp,
        audit.user_id,
        audit.user_email,
        audit.user_role,
        audit.action,
        audit.entity_type,
        audit.entity_id,
        audit.session_id,
        audit.before_data,
        audit.after_data,
        audit.reason,
        audit.ip_or_device_info_if_available,
      ]);
    } catch (e) {
      console.warn('[Sync] Failed to sync audit to sheet:', e);
    }
  }

  public async initFromFirestore(): Promise<void> {
    try {
      const status = getFirestoreStatus();
      if (!status.configured || status.isApiDisabled) {
        return;
      }
      const isOnline = await validateFirestoreConnection();
      if (!isOnline) {
        console.log('[Storage] Cloud Firestore is unprovisioned or offline. Skipping Firestore listeners & hydration.');
        return;
      }

      console.log('[Storage] Loading existing data from Cloud Firestore database...');
      const [games, customers, loans, sessions, tables, users, waitingList, userSessions, settingsDocs, auditLogs] = await Promise.all([
        loadFromFirestore('games'),
        loadFromFirestore('customers'),
        loadFromFirestore('loans'),
        loadFromFirestore('sessions'),
        loadFromFirestore('tables'),
        loadFromFirestore('users'),
        loadFromFirestore('waiting_list'),
        loadFromFirestore('user_sessions'),
        loadFromFirestore('settings'),
        loadFromFirestore('audit_logs'),
      ]);

      if (tables && tables.length > 0) {
        for (const t of tables) {
          if (t.table_id) this.tables.set(t.table_id, t);
        }
      }

      if (users && users.length > 0) {
        for (const u of users) {
          if (u.user_id) this.users.set(u.user_id, u);
        }
      }

      if (customers && customers.length > 0) {
        for (const c of customers) {
          if (c.customer_id) this.customers.set(c.customer_id, c);
        }
      }

      if (games && games.length > 0) {
        for (const g of games) {
          if (g.game_id) {
            // Clean up any previous auto-seeded synthetic demo games if they were left in RUNNING status
            if (g.status === 'RUNNING' && (g.game_id.endsWith('-LIVE1') || g.game_id.endsWith('-LIVE2'))) {
              deleteFromFirestore('games', g.game_id).catch(() => {});
              continue;
            }
            this.games.set(g.game_id, g);
          }
        }
        console.log(`[Storage] Hydrated ${games.length} games from Cloud Firestore.`);
      }

      if (loans && loans.length > 0) {
        for (const l of loans) {
          if (l.loan_id) this.loans.set(l.loan_id, l);
        }
      }

      if (sessions && sessions.length > 0) {
        for (const s of sessions) {
          if (s.session_id) {
            // If closed_at was set equal to opened_at artificially, repair it back to OPEN
            if (s.closed_at && s.closed_at === s.opened_at) {
              s.status = 'OPEN';
              delete (s as any).closed_at;
              delete (s as any).closed_by;
            } else if (s.closed_at) {
              s.status = 'CLOSED';
            }
            this.sessions.set(s.session_id, s);
          }
        }

        // Clean up empty phantom sessions (e.g. 0-game session created today when yesterday's session was never closed)
        const sept7 = this.sessions.get('SESSION-2026-09-07');
        const sept8 = this.sessions.get('SESSION-2026-09-08');
        if (sept7 && sept7.status === 'OPEN' && sept8) {
          const sept8Games = Array.from(this.games.values()).filter(g => g.session_id === 'SESSION-2026-09-08' && !g.deleted);
          if (sept8Games.length === 0) {
            this.sessions.delete('SESSION-2026-09-08');
            deleteFromFirestore('sessions', 'SESSION-2026-09-08').catch(() => {});
          }
        }
      }

      if (waitingList && waitingList.length > 0) {
        for (const w of waitingList) {
          if (w.waiting_id) this.waitingList.set(w.waiting_id, w);
        }
      }

      if (userSessions && userSessions.length > 0) {
        for (const us of userSessions) {
          const sId = us.session_log_id || us.id;
          if (sId) this.userSessionLogs.set(sId, us);
        }
      }

      if (settingsDocs && settingsDocs.length > 0) {
        const savedSettings = settingsDocs[0];
        if (savedSettings) {
          this.settings = { ...this.settings, ...savedSettings };
        }
      }

      if (auditLogs && auditLogs.length > 0) {
        this.auditLogs = auditLogs;
      }

      // Sanitize and auto-close any stale overnight running games from past dates/sessions
      this.sanitizeAndCloseStaleOvernightGames();

      // Ensure today's active session is refreshed and totals recalculated
      const currentSession = this.getOrCreateCurrentSession('SYSTEM');
      this.recalculateSessionTotals(currentSession.session_id, false);

      const totalLoaded =
        (games?.length || 0) +
        (customers?.length || 0) +
        (loans?.length || 0) +
        (sessions?.length || 0) +
        (tables?.length || 0) +
        (users?.length || 0);

      const fsStatus = getFirestoreStatus();
      if (totalLoaded > 0) {
        console.log(`[Storage] Cloud Firestore initial hydration completed successfully (${totalLoaded} total documents loaded from database ${fsStatus.databaseId}).`);
      } else if (fsStatus.isApiDisabled) {
        console.log(`[Storage] Cloud Firestore API is currently unprovisioned/disabled on project ${fsStatus.projectId}. Running with local memory repository and Google Sheets backup.`);
      } else {
        console.log(`[Storage] Cloud Firestore database ${fsStatus.databaseId} loaded 0 documents (empty collection or new instance); local storage initialized.`);
      }

      // Attach real-time subscription so changes in Cloud Firestore mirror instantly in memory
      subscribeToFirestoreChanges({
        onGameChange: (game, changeType) => {
          if (!game || !game.game_id) return;
          if (changeType === 'removed' || game.deleted) {
            this.games.delete(game.game_id);
          } else {
            this.games.set(game.game_id, game);
          }
          if (game.session_id) {
            this.recalculateSessionTotals(game.session_id, false);
          }
          this.notifyLiveListeners();
        },
        onLoanChange: (loan, changeType) => {
          if (!loan || !loan.loan_id) return;
          if (changeType === 'removed') {
            this.loans.delete(loan.loan_id);
          } else {
            this.loans.set(loan.loan_id, loan);
          }
          if (loan.session_id) {
            this.recalculateSessionTotals(loan.session_id, false);
          }
          this.notifyLiveListeners();
        },
        onTableChange: (table) => {
          if (!table || !table.table_id) return;
          this.tables.set(table.table_id, table);
          this.notifyLiveListeners();
        },
        onSessionChange: (session) => {
          if (!session || !session.session_id) return;
          this.sessions.set(session.session_id, session);
          this.notifyLiveListeners();
        },
        onCustomerChange: (customer) => {
          if (!customer || !customer.customer_id) return;
          this.customers.set(customer.customer_id, customer);
          this.notifyLiveListeners();
        },
      });
    } catch (err) {
      console.warn('[Storage] Could not hydrate from Cloud Firestore (operating with local state):', err);
    }
  }

  public async initFromMongo(): Promise<void> {
    if (this.isMongoHydrated) return;
    if (this.isMongoHydrating) {
      while (this.isMongoHydrating) {
        await new Promise(r => setTimeout(r, 100));
      }
      return;
    }
    this.isMongoHydrating = true;

    try {
      if (!isMongoAvailable()) {
        console.log('[Storage] MongoDB Atlas in retry cooldown. Skipping hydration attempt.');
        return;
      }

      console.log('[Storage] Hydrating data from MongoDB Atlas database...');
      const [games, customers, loans, sessions, tables, users, waitingList, userSessions, settingsDocs, auditLogs] = await Promise.all([
        loadFromMongo('games'),
        loadFromMongo('customers'),
        loadFromMongo('loans'),
        loadFromMongo('sessions'),
        loadFromMongo('tables'),
        loadFromMongo('users'),
        loadFromMongo('waiting_list'),
        loadFromMongo('user_sessions'),
        loadFromMongo('settings'),
        loadFromMongo('audit_logs'),
      ]);

      const status = getMongoStatus();
      if (!status.connected) {
        console.log(`[Storage] MongoDB Atlas database "${status.databaseName}" not currently accessible. Operating with in-memory store.`);
        return;
      }

      let totalLoaded = 0;

      if (tables && tables.length > 0) {
        for (const t of tables) {
          if (t.table_id) this.tables.set(t.table_id, t);
        }
        totalLoaded += tables.length;
      }

      if (users && users.length > 0) {
        for (const u of users) {
          if (u.user_id) this.users.set(u.user_id, u);
        }
        totalLoaded += users.length;
      }

      if (customers && customers.length > 0) {
        for (const c of customers) {
          if (c.customer_id) this.customers.set(c.customer_id, c);
        }
        totalLoaded += customers.length;
      }

      if (games && games.length > 0) {
        for (const g of games) {
          if (g.game_id) {
            this.games.set(g.game_id, g);
          }
        }
        totalLoaded += games.length;
      }

      if (loans && loans.length > 0) {
        for (const l of loans) {
          if (l.loan_id) this.loans.set(l.loan_id, l);
        }
        totalLoaded += loans.length;
      }

      if (sessions && sessions.length > 0) {
        for (const s of sessions) {
          if (s.session_id) {
            this.sessions.set(s.session_id, s);
          }
        }
        totalLoaded += sessions.length;
      }

      if (waitingList && waitingList.length > 0) {
        for (const w of waitingList) {
          if (w.waiting_id) this.waitingList.set(w.waiting_id, w);
        }
      }

      if (userSessions && userSessions.length > 0) {
        for (const us of userSessions) {
          const sId = us.session_log_id || us.id;
          if (sId) this.userSessionLogs.set(sId, us);
        }
      }

      if (settingsDocs && settingsDocs.length > 0) {
        const savedSettings = settingsDocs[0];
        if (savedSettings) {
          this.settings = { ...this.settings, ...savedSettings };
          if (this.settings.google_sheets_spreadsheet_id && !googleSheetsService.getSpreadsheetId()) {
            googleSheetsService.setSpreadsheetId(this.settings.google_sheets_spreadsheet_id);
          }
        }
      }

      if (auditLogs && auditLogs.length > 0) {
        this.auditLogs = auditLogs;
      }

      // Sanitize and auto-close any stale overnight running games from past dates/sessions
      this.sanitizeAndCloseStaleOvernightGames();

      const currentSession = this.getOrCreateCurrentSession('SYSTEM');
      this.recalculateSessionTotals(currentSession.session_id, false);

      if (totalLoaded > 0) {
        console.log(`[Storage] MongoDB Atlas initial hydration completed successfully (${totalLoaded} documents loaded from ${status.databaseName}).`);
      } else {
        console.log(`[Storage] MongoDB Atlas database "${status.databaseName}" connected. First run or empty database, seeding initial records.`);
        // Seed MongoDB from initial memory repository
        this.syncAllToMongo().catch(e => console.log('[Storage] Background MongoDB seed notice:', e?.message || e));
      }

      // Attach real-time watcher
      subscribeToMongoChanges({
        onGameChange: (game, changeType) => {
          if (!game || !game.game_id) return;
          if (changeType === 'removed' || game.deleted) {
            this.games.delete(game.game_id);
          } else {
            this.games.set(game.game_id, game);
          }
          if (game.session_id) {
            this.recalculateSessionTotals(game.session_id, false);
          }
          this.notifyLiveListeners();
        },
        onLoanChange: (loan, changeType) => {
          if (!loan || !loan.loan_id) return;
          if (changeType === 'removed') {
            this.loans.delete(loan.loan_id);
          } else {
            this.loans.set(loan.loan_id, loan);
          }
          if (loan.session_id) {
            this.recalculateSessionTotals(loan.session_id, false);
          }
          this.notifyLiveListeners();
        },
        onTableChange: (table) => {
          if (!table || !table.table_id) return;
          this.tables.set(table.table_id, table);
          this.notifyLiveListeners();
        },
        onSessionChange: (session) => {
          if (!session || !session.session_id) return;
          this.sessions.set(session.session_id, session);
          this.notifyLiveListeners();
        },
        onCustomerChange: (customer) => {
          if (!customer || !customer.customer_id) return;
          this.customers.set(customer.customer_id, customer);
          this.notifyLiveListeners();
        },
      });
      this.isMongoHydrated = true;
    } catch (err: any) {
      console.log('[Storage] MongoDB hydration notice (operating with local state):', err?.message || err);
    } finally {
      this.isMongoHydrating = false;
    }
  }

  public async syncAllToMongo(): Promise<{ success: boolean; syncedCounts: Record<string, number>; error?: string }> {
    return syncAllToMongo({
      games: Array.from(this.games.values()),
      customers: Array.from(this.customers.values()),
      loans: Array.from(this.loans.values()),
      sessions: Array.from(this.sessions.values()),
      tables: Array.from(this.tables.values()),
      users: Array.from(this.users.values()),
      waiting_list: Array.from(this.waitingList.values()),
      settings: this.settings,
      audit_logs: this.auditLogs,
    });
  }

  public async syncAllToCloudFirestore(): Promise<{ success: boolean; syncedCounts: Record<string, number> }> {
    return syncAllToFirestore({
      games: Array.from(this.games.values()),
      customers: Array.from(this.customers.values()),
      loans: Array.from(this.loans.values()),
      sessions: Array.from(this.sessions.values()),
      tables: Array.from(this.tables.values()),
      users: Array.from(this.users.values()),
      waiting_list: Array.from(this.waitingList.values()),
      settings: this.settings,
      audit_logs: this.auditLogs,
    });
  }

  public async syncAllToGoogleSheets(): Promise<{ success: boolean; syncedCounts: Record<string, number>; error?: string }> {
    if (!googleSheetsService.isConfigured()) {
      return {
        success: false,
        syncedCounts: {},
        error: 'Google Sheets is not configured or missing credentials',
      };
    }

    try {
      await googleSheetsService.initializeSpreadsheet();

      const games = Array.from(this.games.values());
      const customers = Array.from(this.customers.values());
      const loans = Array.from(this.loans.values());
      const sessions = Array.from(this.sessions.values());
      const tables = Array.from(this.tables.values());
      const users = Array.from(this.users.values());
      const waitingList = Array.from(this.waitingList.values());

      // Batch overwrite each sheet
      await googleSheetsService.overwriteSheetData(
        'Tables',
        ['table_id', 'name', 'active', 'hourly_rate', 'minimum_price', 'created_at', 'updated_at'],
        tables.map(t => [t.table_id, t.name, t.active, t.hourly_rate, t.minimum_price, t.created_at, t.updated_at])
      );

      await googleSheetsService.overwriteSheetData(
        'Users',
        ['user_id', 'name', 'email', 'role', 'active', 'created_at', 'created_by', 'last_login', 'updated_at'],
        users.map(u => [u.user_id, u.name, u.email, u.role, u.active, u.created_at, u.created_by, u.last_login, u.updated_at])
      );

      await googleSheetsService.overwriteSheetData(
        'Customers',
        ['customer_id', 'name', 'normalized_name', 'phone', 'notes', 'active', 'created_at', 'created_by', 'updated_at'],
        customers.map(c => [c.customer_id, c.name, c.normalized_name, c.phone, c.notes, c.active, c.created_at, c.created_by, c.updated_at])
      );

      await googleSheetsService.overwriteSheetData(
        'Games',
        [
          'game_id', 'session_id', 'table_id', 'customer_id', 'player_name', 'start_time', 'end_time',
          'duration_seconds', 'duration_minutes', 'raw_calculated_price', 'suggested_price', 'final_price',
          'price_difference', 'discount_amount', 'manual_price', 'price_reason', 'price_note',
          'game_number_today', 'promo_cycle_game_count', 'offer_eligible', 'offer_type', 'offer_selected_price',
          'is_free_game', 'payment_status', 'status', 'started_by', 'ended_by', 'paid_at', 'paid_by',
          'locked', 'waiting_id', 'notes', 'created_at', 'updated_at', 'deleted', 'deleted_at', 'deleted_by', 'deletion_reason'
        ],
        games.map(g => [
          g.game_id, g.session_id, g.table_id, g.customer_id, g.player_name, g.start_time, g.end_time,
          g.duration_seconds, g.duration_minutes, g.raw_calculated_price, g.suggested_price, g.final_price,
          g.price_difference, g.discount_amount, g.manual_price, g.price_reason, g.price_note,
          g.game_number_today, g.promo_cycle_game_count, g.offer_eligible, g.offer_type, g.offer_selected_price,
          g.is_free_game, g.payment_status, g.status, g.started_by, g.ended_by, g.paid_at, g.paid_by,
          g.locked, g.waiting_id, g.notes, g.created_at, g.updated_at, g.deleted, g.deleted_at, g.deleted_by, g.deletion_reason
        ])
      );

      await googleSheetsService.overwriteSheetData(
        'Loans',
        ['loan_id', 'game_id', 'session_id', 'customer_id', 'player_name', 'amount', 'created_at', 'created_by', 'status', 'paid_at', 'paid_by', 'cancelled_at', 'cancelled_by', 'notes', 'updated_at'],
        loans.map(l => [l.loan_id, l.game_id, l.session_id, l.customer_id, l.player_name, l.amount, l.created_at, l.created_by, l.status, l.paid_at, l.paid_by, l.cancelled_at, l.cancelled_by, l.notes, l.updated_at])
      );

      await googleSheetsService.overwriteSheetData(
        'WaitingList',
        ['waiting_id', 'session_id', 'customer_id', 'player_name', 'preferred_table', 'added_at', 'added_by', 'status', 'seated_at', 'game_id', 'notes', 'updated_at'],
        waitingList.map(w => [w.waiting_id, w.session_id, w.customer_id, w.player_name, w.preferred_table, w.added_at, w.added_by, w.status, w.seated_at, w.game_id, w.notes, w.updated_at])
      );

      await googleSheetsService.overwriteSheetData(
        'Sessions',
        ['session_id', 'date', 'opened_at', 'opened_by', 'closed_at', 'closed_by', 'status', 'total_games', 'total_duration', 'calculated_value', 'final_value', 'total_paid', 'new_loans', 'old_loans_collected', 'discount_total', 'free_game_value', 'reste', 'mini1_revenue', 'mini2_revenue', 'notes'],
        sessions.map(s => [s.session_id, s.date, s.opened_at, s.opened_by, s.closed_at, s.closed_by, s.status, s.total_games, s.total_duration_minutes, s.calculated_value, s.final_value, s.total_paid, s.new_loans, s.old_loans_collected, s.discount_total, s.free_game_value, s.reste, s.mini1_revenue, s.mini2_revenue, s.notes])
      );

      return {
        success: true,
        syncedCounts: {
          tables: tables.length,
          users: users.length,
          customers: customers.length,
          games: games.length,
          loans: loans.length,
          waiting_list: waitingList.length,
          sessions: sessions.length,
        },
      };
    } catch (error: any) {
      console.error('[Storage] Error during syncAllToGoogleSheets:', error);
      return {
        success: false,
        syncedCounts: {},
        error: error?.message || 'Sync to Google Sheets failed',
      };
    }
  }
}

export const storage = new StorageRepository();
// Initialize primary database (MongoDB Atlas) and fallback in background
(async () => {
  try {
    await storage.initFromMongo();
  } catch (e: any) {
    console.log('[Storage] MongoDB background init notice:', e?.message || e);
  }
  // Secondary check for Firestore only if MongoDB has no data and Firestore is available
  try {
    const totalLoaded = storage.getGames({ includeDeleted: true }).length + storage.getTables().length;
    if (totalLoaded === 0) {
      await storage.initFromFirestore();
    }
  } catch (e: any) {
    console.log('[Storage] Firestore fallback init notice:', e?.message || e);
  }
})();
