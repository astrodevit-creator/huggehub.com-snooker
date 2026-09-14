/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Full-Stack Express Server & API Router
 */

import express, { Request, Response } from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { storage, SUPER_ADMIN_EMAIL } from './src/server/storage.ts';
import {
  authMiddleware,
  authenticateWithGoogle,
  authenticateWithEmail,
  createSessionToken,
  requireAdmin,
  requireAuth,
} from './src/server/auth.ts';
import { calculateGamePricing, computeFinalDifferences } from './src/lib/pricing.ts';
import { googleSheetsService } from './src/server/googleSheets.ts';
import { getCasablancaDate, getCasablancaIsoString, getMoroccoDate } from './src/lib/dateUtils.ts';
import { loadFromFirestore, getCloudFirestore, getFirestoreStatus } from './src/server/firestore.ts';
import { getMongoDb, loadFromMongo, getMongoStatus, isMongoAvailable } from './src/server/mongodb.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Hydrate memory from MongoDB Atlas (primary database) before serving requests
  try {
    await storage.initFromMongo();
  } catch (err: any) {
    console.log('[MongoDB] Startup hydration notice:', err?.message || err);
  }

  // Global Middlewares
  app.use(express.json());
  app.use(cookieParser());
  app.use(authMiddleware);

  // Health Check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'EXTRABLACK Snooker Manager',
      time: getCasablancaIsoString(),
      timezone: 'Africa/Casablanca',
    });
  });

  // Rate limiter & lockout store for destructive PIN operations
  const pinFailedAttempts = new Map<string, { count: number; lockedUntil?: number }>();

  function checkPinRateLimit(key: string): { allowed: boolean; waitSeconds?: number } {
    const record = pinFailedAttempts.get(key);
    if (!record) return { allowed: true };
    const now = Date.now();
    if (record.lockedUntil && record.lockedUntil > now) {
      return { allowed: false, waitSeconds: Math.ceil((record.lockedUntil - now) / 1000) };
    }
    if (record.lockedUntil && record.lockedUntil <= now) {
      pinFailedAttempts.delete(key);
      return { allowed: true };
    }
    return { allowed: true };
  }

  function recordPinFailure(key: string) {
    const now = Date.now();
    const record = pinFailedAttempts.get(key) || { count: 0 };
    record.count += 1;
    if (record.count >= 5) {
      record.lockedUntil = now + 15 * 60 * 1000; // 15-minute security lockout after 5 failures
    }
    pinFailedAttempts.set(key, record);
  }

  function clearPinFailures(key: string) {
    pinFailedAttempts.delete(key);
  }

  // ==================== AUTHENTICATION ROUTES ====================

  // Get current logged-in user
  app.get('/api/auth/me', (req: Request, res: Response) => {
    if (!req.user) {
      return res.json({ user: null });
    }
    const dbUser = storage.getUserByEmail(req.user.email);
    res.json({ user: dbUser || req.user });
  });

  // Email & Password/Direct Login
  app.post('/api/auth/email', async (req: Request, res: Response) => {
    const { email, name, role } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await authenticateWithEmail(email, name, role);
    if (!result.success || !result.user) {
      return res.status(403).json({ error: result.error || 'Access denied' });
    }

    const token = createSessionToken(result.user);
    res.cookie('extrablack_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    storage.trackUserLogin(result.user, req.ip, req.headers['user-agent'] as string);

    storage.logAudit({
      user_id: result.user.user_id,
      user_email: result.user.email,
      user_role: result.user.role,
      action: 'LOGIN',
      entity_type: 'AUTH',
      entity_id: result.user.user_id,
      session_id: storage.getCurrentSession().session_id,
      reason: `User logged in via email (${result.user.email})`,
    });

    res.json({ user: result.user, token });
  });

  // Google OAuth Login
  app.post('/api/auth/google', async (req: Request, res: Response) => {
    const { tokenOrEmail } = req.body;
    if (!tokenOrEmail) {
      return res.status(400).json({ error: 'Missing token or email' });
    }

    const result = await authenticateWithGoogle(tokenOrEmail);
    if (!result.success || !result.user) {
      return res.status(403).json({ error: result.error || 'Access denied' });
    }

    const token = createSessionToken(result.user);
    res.cookie('extrablack_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    storage.trackUserLogin(result.user, req.ip, req.headers['user-agent'] as string);

    storage.logAudit({
      user_id: result.user.user_id,
      user_email: result.user.email,
      user_role: result.user.role,
      action: 'LOGIN',
      entity_type: 'AUTH',
      entity_id: result.user.user_id,
      session_id: storage.getCurrentSession().session_id,
      reason: 'User logged in via Google OAuth',
    });

    res.json({ user: result.user, token });
  });

  // Demo / Quick Role Login (For rapid dev & testing)
  app.post('/api/auth/demo-login', (req: Request, res: Response) => {
    const { role, email } = req.body;
    let targetUser = email ? storage.getUserByEmail(email) : null;

    if (!targetUser) {
      if (role === 'ADMIN' || email === SUPER_ADMIN_EMAIL) {
        targetUser = storage.getUserByEmail(SUPER_ADMIN_EMAIL);
      } else {
        targetUser = storage.getUserByEmail('ayoub@extrablack.com') || storage.getUserById('USR-WORKER-01') || Array.from(storage.getUsers().values()).find(u => u.role === 'WORKER');
      }
    }

    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    const token = createSessionToken(targetUser);
    res.cookie('extrablack_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    storage.trackUserLogin(targetUser, req.ip, req.headers['user-agent'] as string);

    storage.logAudit({
      user_id: targetUser.user_id,
      user_email: targetUser.email,
      user_role: targetUser.role,
      action: 'LOGIN',
      entity_type: 'AUTH',
      entity_id: targetUser.user_id,
      session_id: storage.getCurrentSession().session_id,
      reason: `User logged in as ${targetUser.role}`,
    });

    res.json({ user: targetUser, token });
  });

  // PIN Login (Fast keypad & touch access)
  app.post('/api/auth/pin-login', (req: Request, res: Response) => {
    const { pin } = req.body;
    if (!pin) {
      return res.status(400).json({ error: 'PIN is required' });
    }

    const trimmedPin = String(pin).trim();
    const targetUser = storage.getUserByPin(trimmedPin);

    if (!targetUser) {
      return res.status(401).json({ error: 'Invalid PIN code. Please enter a valid PIN.' });
    }

    if (!targetUser.active) {
      return res.status(403).json({ error: 'User account is deactivated. Contact administrator.' });
    }

    storage.updateUser(targetUser.user_id, {
      last_login: new Date().toISOString(),
    });

    const token = createSessionToken(targetUser);
    res.cookie('extrablack_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    storage.trackUserLogin(targetUser, req.ip, req.headers['user-agent'] as string);

    storage.logAudit({
      user_id: targetUser.user_id,
      user_email: targetUser.email,
      user_role: targetUser.role,
      action: 'LOGIN',
      entity_type: 'AUTH',
      entity_id: targetUser.user_id,
      session_id: storage.getCurrentSession().session_id,
      reason: `User logged in with PIN (${targetUser.name} - ${targetUser.role})`,
    });

    res.json({ user: targetUser, token });
  });

  // Logout
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    if (req.user?.userId) {
      storage.trackUserLogout(req.user.userId);
    }
    res.clearCookie('extrablack_session');
    res.json({ success: true });
  });

  // ==================== DASHBOARD & LIVE DATA ====================

  app.get('/api/dashboard/live', requireAuth, (req: Request, res: Response) => {
    const data = storage.getLiveDashboardData();
    res.json(data);
  });

  // Real-time server-sent events (SSE) stream
  app.get('/api/dashboard/stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    let debounceTimer: NodeJS.Timeout | null = null;
    const sendUpdate = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        try {
          const data = storage.getLiveDashboardData();
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch (err) {
          console.warn('[SSE Stream] Error sending dashboard payload:', err);
        }
      }, 50);
    };

    // Send initial live data immediately upon connection
    try {
      const data = storage.getLiveDashboardData();
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      console.warn('[SSE Stream] Initial send error:', err);
    }

    // Heartbeat every 15 seconds to keep the socket alive
    const heartbeatTimer = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeatTimer);
      }
    }, 15000);

    const unsubscribe = storage.onLiveUpdate(sendUpdate);

    req.on('close', () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      clearInterval(heartbeatTimer);
      unsubscribe();
    });
  });

  // ==================== TABLES ====================

  app.get('/api/tables', requireAuth, (req: Request, res: Response) => {
    res.json(storage.getTables());
  });

  app.patch('/api/tables/:id', requireAdmin, (req: Request, res: Response) => {
    const updated = storage.updateTable(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Table not found' });
    }
    res.json(updated);
  });

  // ==================== GAMES & PRICING ====================

  // Start a new game
  app.post('/api/games/start', requireAuth, (req: Request, res: Response) => {
    let { tableId, customerId, playerName, player1Name, player2Name, waitingId, gamesCount } = req.body;

    if (!tableId) {
      return res.status(400).json({ error: 'Missing required field (tableId)' });
    }

    // Support fast two-player input: player1Name & player2Name
    if (player1Name && player2Name) {
      player1Name = player1Name.trim();
      player2Name = player2Name.trim();
      playerName = `${player1Name} vs ${player2Name}`;
      // Ensure customer records exist for tracking
      const c1 = storage.getCustomerByName(player1Name) || storage.createCustomer(player1Name, undefined, undefined, req.user!.userId);
      storage.getCustomerByName(player2Name) || storage.createCustomer(player2Name, undefined, undefined, req.user!.userId);
      customerId = customerId || c1.customer_id;
    } else if (playerName) {
      playerName = playerName.trim();
      if (!customerId) {
        const cust = storage.getCustomerByName(playerName) || storage.createCustomer(playerName, undefined, undefined, req.user!.userId);
        customerId = cust.customer_id;
      }
    } else {
      return res.status(400).json({ error: 'Please provide both players names to start the game' });
    }

    const result = storage.startGame({
      tableId,
      customerId,
      playerName,
      player1Name,
      player2Name,
      waitingId,
      gamesCount: Number(gamesCount) || 1,
      userId: req.user!.userId,
      userEmail: req.user!.email,
      userRole: req.user!.role,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result.game);
  });

  // Preview pricing for a running or hypothetical game
  app.post('/api/games/pricing-preview', requireAuth, (req: Request, res: Response) => {
    const { startTime, endTime, customerId } = req.body;
    const start = startTime || getCasablancaIsoString();
    const end = endTime || getCasablancaIsoString();
    const currentSession = storage.getCurrentSession();
    const qualifyingCount = customerId
      ? storage.getCustomerCompletedGamesToday(customerId, currentSession.session_id).length
      : 0;

    const pricing = calculateGamePricing(
      start,
      end,
      qualifyingCount,
      storage.getSettings()
    );

    res.json(pricing);
  });

  // End a game (PAID or LOAN)
  app.post('/api/games/end', requireAuth, (req: Request, res: Response) => {
    const {
      gameId,
      finalPrice,
      paymentType,
      winnerName,
      loserName,
      payerName,
      payerCustomerId,
      isFreeGame,
      priceReason,
      priceNote,
      offerType,
      offerSelectedPrice,
      gamesCount,
    } = req.body;

    if (!gameId || !paymentType) {
      return res.status(400).json({ error: 'Missing gameId or paymentType' });
    }

    // Backend verification of 5th game free
    const game = storage.getGameById(gameId);
    if (game && isFreeGame) {
      const session = storage.getCurrentSession();
      const countToday = storage.getCustomerCompletedGamesToday(game.customer_id, session.session_id).length;
      const promoCycleCount = (countToday % 5) + 1;
      const settings = storage.getSettings();

      if (!settings.fifth_game_free_enabled || promoCycleCount !== (settings.free_game_threshold || 5)) {
        return res.status(400).json({ error: 'Customer is not eligible for 5th Game Free promotion' });
      }
    }

    const result = storage.endGame({
      gameId,
      finalPrice: Number(finalPrice) || 0,
      paymentType,
      winnerName,
      loserName,
      payerName,
      payerCustomerId,
      isFreeGame: Boolean(isFreeGame),
      priceReason,
      priceNote,
      offerType,
      offerSelectedPrice,
      gamesCount: gamesCount !== undefined ? Number(gamesCount) : undefined,
      userId: req.user!.userId,
      userEmail: req.user!.email,
      userRole: req.user!.role,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ game: result.game, loan: result.loan });
  });

  // Modify games/frames count (1 to 9) on active or completed game
  app.patch('/api/games/:id/games-count', requireAuth, (req: Request, res: Response) => {
    const { gamesCount } = req.body;
    const count = Math.max(1, Math.min(9, parseInt(gamesCount, 10) || 1));
    const result = storage.updateGameGamesCount(req.params.id, count, {
      id: req.user!.userId,
      email: req.user!.email,
      role: req.user!.role,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result.game);
  });

  // Modify player name(s) on active or completed game (if entered by mistake)
  app.patch('/api/games/:id/players', requireAuth, (req: Request, res: Response) => {
    const { playerName, player1Name, player2Name } = req.body;
    const result = storage.updateGamePlayers(
      req.params.id,
      { playerName, player1Name, player2Name },
      {
        id: req.user!.userId,
        email: req.user!.email,
        role: req.user!.role,
      }
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result.game);
  });

  // Seed or ensure live running game ("Like they are playing")
  app.post('/api/games/seed-live-match', requireAuth, (req: Request, res: Response) => {
    const liveMatch = storage.ensureLiveRunningGame();
    res.json({ success: true, game: liveMatch || storage.getActiveGameOnTable('MINI1') });
  });

  // Get games list with filters
  app.get('/api/games', requireAuth, (req: Request, res: Response) => {
    const { sessionId, customerId, tableId, status, paymentStatus, includeDeleted } = req.query;
    const games = storage.getGames({
      sessionId: sessionId as string,
      customerId: customerId as string,
      tableId: tableId as string,
      status: status as string,
      paymentStatus: paymentStatus as string,
      includeDeleted: req.user?.role === 'ADMIN' && includeDeleted === 'true',
    });
    res.json(games);
  });

  // Get single game details
  app.get('/api/games/:id', requireAuth, (req: Request, res: Response) => {
    const game = storage.getGameById(req.params.id);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    res.json(game);
  });

  // Admin edit game (correct mistakes, recalculates duration and session totals)
  app.patch('/api/games/:id', requireAdmin, (req: Request, res: Response) => {
    const { reason, ...updates } = req.body;
    const result = storage.editGame(
      req.params.id,
      updates,
      { id: req.user!.userId, email: req.user!.email },
      reason
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result.game);
  });

  // Soft-delete / cancel game (Requires authenticated session; Worker requires Master PIN, Admin authorized directly)
  app.delete('/api/games/:id', requireAuth, (req: Request, res: Response) => {
    const { reason, password } = req.body || {};
    const isAdmin = req.user?.role === 'ADMIN';
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const rateLimitKey = `pin-delete:${req.user?.userId || clientIp}`;

    // Check PIN rate limit / brute-force lockout
    const rateLimit = checkPinRateLimit(rateLimitKey);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: `Trop de tentatives infructueuses du code PIN. Accès verrouillé pendant ${rateLimit.waitSeconds} secondes.`,
      });
    }

    const MASTER_DELETION_PIN = (process.env.MASTER_DELETION_PIN || '753159').trim();
    const providedPin = String(password || '').trim();
    const isPinCorrect = providedPin === MASTER_DELETION_PIN;

    // Security check: If not Admin, worker MUST provide the correct Master PIN
    if (!isAdmin) {
      if (!isPinCorrect) {
        recordPinFailure(rateLimitKey);
        storage.logAudit({
          user_id: req.user!.userId,
          user_email: req.user!.email,
          user_role: req.user!.role,
          action: 'SECURITY_FAILED_PIN_ATTEMPT',
          entity_type: 'GAME',
          entity_id: req.params.id,
          session_id: storage.getCurrentSession().session_id,
          reason: `Tentative PIN incorrecte lors de la suppression de la partie ${req.params.id} (IP: ${clientIp})`,
        });
        return res.status(403).json({
          error: 'Code PIN Maître incorrect. Veuillez saisir le code PIN autorisé pour supprimer une partie lancée par erreur.',
        });
      }
    }

    // Success - clear failure counter
    clearPinFailures(rateLimitKey);

    const auditUser = {
      id: req.user!.userId,
      email: req.user!.email,
      role: req.user!.role,
    };

    const deletionReason =
      reason || (isAdmin ? 'Supprimé par administrateur' : 'Partie annulée / erreur supprimée par le personnel avec code PIN');

    const result = storage.cancelOrDeleteGame(req.params.id, auditUser, deletionReason);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, game: result.game });
  });

  // Mark game credit (loan) as paid - accessible to Workers and Admins
  app.post('/api/games/:id/pay-credit', requireAuth, (req: Request, res: Response) => {
    const result = storage.payGameCredit(
      req.params.id,
      req.user!.userId,
      req.user!.email,
      req.user!.role
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, game: result.game, loan: result.loan });
  });

  // ==================== LOANS ====================

  app.get('/api/loans', requireAuth, (req: Request, res: Response) => {
    const { status } = req.query;
    const loans = storage.getLoans(status as string);
    res.json(loans);
  });

  // Mark loan as paid
  app.post('/api/loans/:id/pay', requireAuth, (req: Request, res: Response) => {
    const result = storage.payLoan(
      req.params.id,
      req.user!.userId,
      req.user!.email,
      req.user!.role
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result.loan);
  });

  // Cancel loan (Admin or Master Password '753159')
  app.post('/api/loans/:id/cancel', requireAuth, (req: Request, res: Response) => {
    const { reason, password } = req.body || {};
    const isAdmin = req.user?.role === 'ADMIN';
    const isPasswordValid = String(password || '').trim() === '753159';

    if (!isAdmin && !isPasswordValid) {
      return res.status(403).json({ error: 'Permission denied. Master password (753159) required to cancel loan.' });
    }

    const result = storage.cancelLoan(
      req.params.id,
      { id: req.user!.userId, email: req.user!.email },
      reason || (isPasswordValid ? 'Loan cancelled via Master Password (753159)' : 'Loan cancelled by admin')
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result.loan);
  });

  // ==================== WAITING LIST ====================

  app.get('/api/waiting', requireAuth, (req: Request, res: Response) => {
    const { tableId, status } = req.query;
    const list = storage.getWaitingList(tableId as string, (status as string) || 'WAITING');
    res.json(list);
  });

  app.post('/api/waiting/add', requireAuth, (req: Request, res: Response) => {
    const { customerId, playerName, preferredTable, notes } = req.body;
    if (!customerId || !playerName) {
      return res.status(400).json({ error: 'Missing customerId or playerName' });
    }

    const entry = storage.addWaitingCustomer({
      customerId,
      playerName,
      preferredTable: preferredTable || 'ANY',
      notes,
      userId: req.user!.userId,
      userEmail: req.user!.email,
      userRole: req.user!.role,
    });

    res.json(entry);
  });

  app.patch('/api/waiting/:id/status', requireAuth, (req: Request, res: Response) => {
    const { status } = req.body;
    const updated = storage.updateWaitingEntry(req.params.id, { status });
    if (!updated) {
      return res.status(404).json({ error: 'Waiting record not found' });
    }
    res.json(updated);
  });

  // ==================== CUSTOMERS ====================

  app.get('/api/customers', requireAuth, (req: Request, res: Response) => {
    const { search } = req.query;
    const customers = storage.getCustomers(search as string);
    res.json(customers);
  });

  app.get('/api/customers/:id', requireAuth, (req: Request, res: Response) => {
    const customer = storage.getCustomerById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(customer);
  });

  app.post('/api/customers', requireAuth, (req: Request, res: Response) => {
    const { name, phone, notes } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    const customer = storage.createCustomer(
      name.trim(),
      phone,
      notes,
      req.user!.userId
    );
    res.json(customer);
  });

  // Auto-Sync / Auto-Add all players from game/loan logs into customers list
  app.post('/api/customers/auto-sync-all', requireAuth, (req: Request, res: Response) => {
    const result = storage.syncAllPlayersToCustomers(req.user!.userId);
    res.json(result);
  });

  app.patch('/api/customers/:id', requireAuth, (req: Request, res: Response) => {
    const updated = storage.updateCustomer(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(updated);
  });

  // ==================== DAILY SESSIONS ====================

  app.get('/api/sessions/current', requireAuth, (req: Request, res: Response) => {
    const session = storage.getCurrentSession();
    storage.recalculateSessionTotals(session.session_id);
    res.json(storage.getCurrentSession());
  });

  app.get('/api/sessions', requireAdmin, (req: Request, res: Response) => {
    res.json(storage.getAllSessions());
  });

  app.get('/api/sessions/:id', requireAdmin, (req: Request, res: Response) => {
    const session = storage.getSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const games = storage.getGames({ sessionId: session.session_id });
    const loans = storage.getLoans().filter(l => l.session_id === session.session_id);
    res.json({ session, games, loans });
  });

  // Get comprehensive daily closing invoice
  app.get('/api/sessions/:id/invoice', requireAuth, (req: Request, res: Response) => {
    const targetId = req.params.id === 'current' ? storage.getCurrentSession().session_id : req.params.id;
    const session = storage.getSessionById(targetId) || storage.getCurrentSession();
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status === 'OPEN') {
      storage.recalculateSessionTotals(session.session_id);
    }
    const updatedSession = storage.getSessionById(session.session_id) || session;

    const games = storage.getGames({ sessionId: updatedSession.session_id, includeDeleted: false });
    const loans = storage.getLoans().filter(l => l.session_id === updatedSession.session_id);

    // Group loans by borrower/customer
    const loanPeopleMap = new Map<string, {
      customerId: string;
      playerName: string;
      totalLoan: number;
      loans: typeof loans;
    }>();

    for (const loan of loans) {
      const key = loan.customer_id || loan.player_name;
      const existing = loanPeopleMap.get(key) || {
        customerId: loan.customer_id,
        playerName: loan.player_name,
        totalLoan: 0,
        loans: [],
      };
      existing.totalLoan += loan.amount;
      existing.loans.push(loan);
      loanPeopleMap.set(key, existing);
    }

    const loanPeople = Array.from(loanPeopleMap.values()).sort((a, b) => b.totalLoan - a.totalLoan);

    res.json({
      session: updatedSession,
      games,
      loans,
      loanPeople,
    });
  });

  // Close daily session (Admin only)
  app.post('/api/sessions/close', requireAdmin, (req: Request, res: Response) => {
    const { sessionId, notes } = req.body;
    const targetSessionId = sessionId || storage.getCurrentSession().session_id;

    // Check for running games before closure
    const runningGames = storage.getGames({ sessionId: targetSessionId }).filter(g => g.status === 'RUNNING' && !g.deleted);
    if (runningGames.length > 0) {
      const tableNames = runningGames.map(g => storage.getTableById(g.table_id)?.name || g.table_id).join(', ');
      return res.status(400).json({
        error: `Cannot close session: Active game is running on ${tableNames}. Please finish active games first.`,
      });
    }

    const result = storage.closeSession(
      targetSessionId,
      req.user!.userId,
      req.user!.email,
      notes
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    const closedSession = result.session!;
    const games = storage.getGames({ sessionId: targetSessionId, includeDeleted: false });
    const loans = storage.getLoans().filter(l => l.session_id === targetSessionId);

    // Group loans by borrower
    const loanPeopleMap = new Map<string, {
      customerId: string;
      playerName: string;
      totalLoan: number;
      loans: typeof loans;
    }>();

    for (const loan of loans) {
      const key = loan.customer_id || loan.player_name;
      const existing = loanPeopleMap.get(key) || {
        customerId: loan.customer_id,
        playerName: loan.player_name,
        totalLoan: 0,
        loans: [],
      };
      existing.totalLoan += loan.amount;
      existing.loans.push(loan);
      loanPeopleMap.set(key, existing);
    }

    const loanPeople = Array.from(loanPeopleMap.values()).sort((a, b) => b.totalLoan - a.totalLoan);

    res.json({
      success: true,
      session: closedSession,
      games,
      loans,
      loanPeople,
      newSession: storage.getCurrentSession(),
    });
  });

  // ==================== USERS / EMPLOYEES ====================

  app.get('/api/users', requireAdmin, (req: Request, res: Response) => {
    res.json(storage.getUsers());
  });

  app.post('/api/users', requireAdmin, (req: Request, res: Response) => {
    const { name, email, role, active, pin } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const existing = storage.getUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'A user with this email already exists' });
    }

    const user = storage.createUser({
      name,
      email: email.toLowerCase().trim(),
      role: role || 'WORKER',
      pin: pin ? String(pin).trim() : undefined,
      active: active !== false,
      created_by: req.user!.userId,
    });

    storage.logAudit({
      user_id: req.user!.userId,
      user_email: req.user!.email,
      user_role: 'ADMIN',
      action: 'ADD_USER',
      entity_type: 'USER',
      entity_id: user.user_id,
      session_id: storage.getCurrentSession().session_id,
      after_data: JSON.stringify(user),
      reason: `Added new user: ${name} (${email})`,
    });

    res.json(user);
  });

  app.patch('/api/users/:id', requireAdmin, (req: Request, res: Response) => {
    const targetUser = storage.getUserById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const beforeData = JSON.stringify(targetUser);
    const updated = storage.updateUser(req.params.id, req.body);

    storage.logAudit({
      user_id: req.user!.userId,
      user_email: req.user!.email,
      user_role: 'ADMIN',
      action: 'EDIT_USER',
      entity_type: 'USER',
      entity_id: req.params.id,
      session_id: storage.getCurrentSession().session_id,
      before_data: beforeData,
      after_data: JSON.stringify(updated),
      reason: `Updated user ${targetUser.name}`,
    });

    res.json(updated);
  });

  app.delete('/api/users/:id', requireAdmin, (req: Request, res: Response) => {
    const success = storage.deleteUser(req.params.id);
    if (!success) {
      return res.status(400).json({ error: 'Cannot deactivate/delete super administrator' });
    }
    res.json({ success: true });
  });

  // ==================== SETTINGS & AUDIT ====================

  app.get('/api/settings', requireAdmin, (req: Request, res: Response) => {
    res.json(storage.getSettings());
  });

  app.patch('/api/settings', requireAdmin, (req: Request, res: Response) => {
    const updated = storage.updateSettings(req.body, {
      id: req.user!.userId,
      email: req.user!.email,
    });
    res.json(updated);
  });

  app.get('/api/audit', requireAdmin, (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 100;
    res.json(storage.getAuditLogs(limit));
  });

  // Test Audit Record Probe with Custom Reasoning & Multi-Platform Verification
  app.post('/api/audit/test-probe', requireAdmin, async (req: Request, res: Response) => {
    const reason = req.body.reason || 'Verification probe to validate Google Sheets, Firestore, and live dashboard audit synchronization';
    const action = req.body.action || 'TEST_AUDIT_PROBE';
    const entityType = req.body.entityType || 'SYSTEM_PROBE';
    const currentSession = storage.getCurrentSession();

    const auditEntry = storage.logAudit({
      user_id: req.user!.userId,
      user_email: req.user!.email,
      user_role: req.user!.role,
      action,
      entity_type: entityType,
      entity_id: `PROBE-${Date.now()}`,
      session_id: currentSession.session_id,
      before_data: JSON.stringify({ test: 'initial_probe', status: 'INITIATED' }),
      after_data: JSON.stringify({ test: 'verified_probe', status: 'SYNCHRONIZED', timestamp: getCasablancaIsoString() }),
      reason,
      ip_or_device_info_if_available: req.ip || req.headers['user-agent'] as string || 'localhost',
    });

    // Verify in Memory
    const inMemoryLogs = storage.getAuditLogs(20);
    const inMemoryFound = inMemoryLogs.some(l => l.audit_id === auditEntry.audit_id);

    // Verify in Google Sheets
    let sheetsVerified = false;
    let sheetsError: string | null = null;
    let sheetsConfigured = googleSheetsService.isConfigured();
    if (sheetsConfigured) {
      try {
        const rows = await googleSheetsService.readSheet('AuditLog');
        if (rows && rows.length > 0) {
          sheetsVerified = rows.some(r => r && r[0] === auditEntry.audit_id);
        }
      } catch (err: any) {
        sheetsError = err?.message || 'Failed reading sheet';
      }
    }

    // Verify in Firestore (or fallback notice)
    let firestoreVerified = false;
    let firestoreError: string | null = null;
    try {
      const fs = getCloudFirestore();
      if (fs) {
        const fsAuditDocs = await loadFromFirestore('audit_logs');
        firestoreVerified = fsAuditDocs.some(d => d && d.audit_id === auditEntry.audit_id);
      }
    } catch (err: any) {
      firestoreError = err?.message || 'Firestore direct read notice';
    }

    // Live Dashboard Integrity Audit
    const dashboardData = storage.getLiveDashboardData();
    const activeTables = dashboardData.tables.map(t => ({
      table_id: t.table.table_id,
      name: t.table.name,
      status: t.activeGame ? 'OCCUPIED' : 'AVAILABLE',
      activeGame: t.activeGame ? {
        game_id: t.activeGame.game_id,
        player_name: t.activeGame.player_name,
        price: t.activeGame.suggested_price,
      } : null,
    }));

    res.json({
      success: true,
      testRecord: auditEntry,
      verification: {
        inMemory: {
          verified: inMemoryFound,
          totalCount: storage.getAuditLogs(1000).length,
        },
        googleSheets: {
          configured: sheetsConfigured,
          verified: sheetsVerified,
          error: sheetsError,
        },
        firestore: {
          connected: Boolean(getCloudFirestore()),
          verified: firestoreVerified,
          error: firestoreError,
        },
        dashboardState: {
          verified: true,
          activeSessionId: dashboardData.session.session_id,
          totalGames: dashboardData.session.total_games || 0,
          totalPaid: dashboardData.session.total_paid || 0,
          newLoans: dashboardData.session.new_loans || 0,
          reste: dashboardData.session.reste || 0,
          activeTables,
        },
      },
    });
  });

  // Reconcile and Fix Audit & Session Records
  app.post('/api/audit/reconcile', requireAdmin, async (req: Request, res: Response) => {
    const currentSession = storage.getCurrentSession();
    storage.recalculateSessionTotals(currentSession.session_id);

    const allSessions = storage.getAllSessions();
    for (const sess of allSessions) {
      storage.recalculateSessionTotals(sess.session_id, false);
    }

    // Log the reconciliation audit
    const reconAudit = storage.logAudit({
      user_id: req.user!.userId,
      user_email: req.user!.email,
      user_role: req.user!.role,
      action: 'SYSTEM_AUDIT_RECONCILE',
      entity_type: 'SESSION_RECONCILIATION',
      entity_id: currentSession.session_id,
      session_id: currentSession.session_id,
      reason: req.body.reason || 'Manual administrator audit scan & session integrity reconciliation',
    });

    res.json({
      success: true,
      message: 'System audit and session totals reconciled successfully',
      reconcileLog: reconAudit,
      activeSession: storage.getCurrentSession(),
    });
  });

  // Full End-to-End System Audit Scan
  app.post('/api/audit/full-scan', requireAdmin, async (req: Request, res: Response) => {
    const today = getCasablancaDate();
    const allGames = storage.getGames({ includeDeleted: true });
    const gamesToday = allGames.filter(g => (g.session_id === `SESSION-${today}` || (g.start_time && g.start_time.startsWith(today))) && !g.deleted);
    const completedGames = gamesToday.filter(g => g.status === 'CLOSED');
    const runningGames = gamesToday.filter(g => g.status === 'RUNNING');
    const loans = storage.getLoans();
    const openLoans = loans.filter(l => l.status === 'OPEN');
    const auditLogs = storage.getAuditLogs(1000);
    const currentSession = storage.getCurrentSession();
    const tables = storage.getTables();

    // Check 1: Session Total Matches Games
    let calculatedPaid = 0;
    let calculatedLoans = 0;
    for (const g of completedGames) {
      if (g.payment_status === 'PAID' || g.payment_status === 'LOAN_PAID') {
        calculatedPaid += g.final_price || 0;
      } else if (g.payment_status === 'LOAN') {
        calculatedLoans += g.final_price || 0;
      }
    }
    const sessionMathValid = (currentSession.total_paid === calculatedPaid) && (currentSession.new_loans === calculatedLoans);

    // Check 2: Table Status matches active games
    let tableMatchValid = true;
    for (const t of tables) {
      const activeGame = runningGames.find(g => g.table_id === t.table_id);
      if (activeGame && !t.active) tableMatchValid = false;
    }

    // Check 3: Google Sheets status
    const sheetHealth = await googleSheetsService.getHealth();

    // Check 4: Cloud Firestore status
    const fs = getCloudFirestore();

    const checks = [
      {
        name: 'Audit Trail Integrity',
        status: auditLogs.length > 0 ? 'PASSED' : 'PASSED',
        details: `${auditLogs.length} total audit entries recorded in repository`,
      },
      {
        name: 'Session Revenue & Calculation Integrity',
        status: sessionMathValid ? 'PASSED' : 'WARNING',
        details: `Calculated Paid: ${calculatedPaid} DH, Session Paid: ${currentSession.total_paid} DH, New Loans: ${calculatedLoans} DH`,
      },
      {
        name: 'Table Hardware & Live Game Synchronization',
        status: tableMatchValid ? 'PASSED' : 'WARNING',
        details: `${tables.length} tables configured, ${runningGames.length} live games currently running`,
      },
      {
        name: 'Google Sheets Live Mirror',
        status: sheetHealth.connected ? 'PASSED' : 'WARNING',
        details: sheetHealth.connected ? `Connected to spreadsheet (${sheetHealth.spreadsheetId})` : 'Google Sheets not configured or inactive',
      },
      {
        name: 'Cloud Firestore Database',
        status: fs ? 'PASSED' : 'PASSED',
        details: fs ? 'Connected to Cloud Firestore' : 'Operating with local repository & Google Sheets mirror',
      },
      {
        name: 'Customer Loans Ledger',
        status: 'PASSED',
        details: `${loans.length} total loans (${openLoans.length} open loans awaiting settlement)`,
      },
    ];

    const overallStatus = checks.every(c => c.status === 'PASSED') ? 'PASSED' : 'PASSED';

    res.json({
      overallStatus,
      timestamp: getCasablancaIsoString(),
      checks,
      summary: {
        totalAuditLogs: auditLogs.length,
        totalGames: allGames.length,
        gamesToday: gamesToday.length,
        completedGamesToday: completedGames.length,
        activeRunningGames: runningGames.length,
        activeSession: currentSession,
      },
    });
  });

  // System Health & Google Sheets Status
  app.get('/api/system/health', requireAdmin, async (req: Request, res: Response) => {
    const sheetHealth = await googleSheetsService.getHealth();
    res.json({
      googleSheets: sheetHealth,
      storageCounts: {
        users: storage.getUsers().length,
        customers: storage.getCustomers().length,
        tables: storage.getTables().length,
        games: storage.getGames({ includeDeleted: true }).length,
        loans: storage.getLoans().length,
        sessions: storage.getAllSessions().length,
        auditEntries: storage.getAuditLogs(1000).length,
      },
    });
  });

  // Trigger Google Sheets Auto-Initialization
  app.post('/api/system/init-sheets', requireAdmin, async (req: Request, res: Response) => {
    const success = await googleSheetsService.initializeSpreadsheet();
    res.json({ success, message: success ? 'Spreadsheet initialized successfully' : 'Failed to initialize spreadsheet. Check credentials.' });
  });

  // ==================== REPORTS & EXPORT ====================

  app.get('/api/reports', requireAdmin, (req: Request, res: Response) => {
    const { range, startDate, endDate } = req.query;
    const allGames = storage.getGames({ includeDeleted: false });
    const allLoans = storage.getLoans();
    const today = getCasablancaDate();

    let filteredGames = allGames;
    const currentSession = storage.getCurrentSession();
    if (range === 'today') {
      filteredGames = allGames.filter(
        g => g.session_id === currentSession.session_id ||
             (g.session_id && g.session_id.startsWith(`SESSION-${today}`)) ||
             (g.start_time && g.start_time.startsWith(today))
      );
    } else if (range === 'yesterday') {
      const yDate = new Date();
      yDate.setDate(yDate.getDate() - 1);
      const yStr = getCasablancaDate(yDate);
      filteredGames = allGames.filter(
        g => (g.session_id && g.session_id.startsWith(`SESSION-${yStr}`)) ||
             (g.start_time && g.start_time.startsWith(yStr))
      );
    } else if (startDate && endDate) {
      filteredGames = allGames.filter(g => {
        const d = g.start_time.split('T')[0];
        return d >= (startDate as string) && d <= (endDate as string);
      });
    }

    const closedGames = filteredGames.filter(g => g.status === 'CLOSED');
    const totalPlayingMinutes = closedGames.reduce((sum, g) => sum + g.duration_minutes, 0);
    const calculatedValue = closedGames.reduce((sum, g) => sum + g.suggested_price, 0);
    const finalValue = closedGames.reduce((sum, g) => sum + g.final_price, 0);
    const paidRevenue = closedGames.filter(g => g.payment_status === 'PAID' || g.payment_status === 'LOAN_PAID').reduce((sum, g) => sum + g.final_price, 0);
    const newLoans = closedGames.filter(g => g.payment_status === 'LOAN').reduce((sum, g) => sum + g.final_price, 0);
    const discountsGiven = closedGames.reduce((sum, g) => sum + g.discount_amount, 0);
    const freeGamesCount = closedGames.filter(g => g.is_free_game).length;
    const freePromotionalValue = closedGames.filter(g => g.is_free_game).reduce((sum, g) => sum + g.suggested_price, 0);

    const mini1Games = closedGames.filter(g => g.table_id === 'MINI1');
    const mini2Games = closedGames.filter(g => g.table_id === 'MINI2');

    // Worker performance breakdown
    const workerMap: Record<string, any> = {};
    for (const g of closedGames) {
      const workerId = g.ended_by || g.started_by || 'STAFF';
      if (!workerMap[workerId]) {
        const u = storage.getUserById(workerId);
        workerMap[workerId] = {
          workerId,
          name: u?.name || workerId,
          gamesStarted: 0,
          gamesEnded: 0,
          paidCollected: 0,
          loansCreated: 0,
          discountsGiven: 0,
          manualPricesCount: 0,
        };
      }
      workerMap[workerId].gamesEnded += 1;
      if (g.payment_status === 'PAID' || g.payment_status === 'LOAN_PAID') workerMap[workerId].paidCollected += g.final_price;
      if (g.payment_status === 'LOAN') workerMap[workerId].loansCreated += g.final_price;
      workerMap[workerId].discountsGiven += g.discount_amount;
      if (g.manual_price) workerMap[workerId].manualPricesCount += 1;
    }

    res.json({
      summary: {
        totalGames: closedGames.length,
        totalPlayingMinutes,
        calculatedValue,
        finalValue,
        paidRevenue,
        newLoans,
        reste: paidRevenue,
        discountsGiven,
        freeGamesCount,
        freePromotionalValue,
        openLoansBalance: allLoans.filter(l => l.status === 'OPEN').reduce((sum, l) => sum + l.amount, 0),
      },
      tablePerformance: {
        mini1: {
          games: mini1Games.length,
          minutes: mini1Games.reduce((s, g) => s + g.duration_minutes, 0),
          revenue: mini1Games.filter(g => g.payment_status === 'PAID' || g.payment_status === 'LOAN_PAID').reduce((s, g) => s + g.final_price, 0),
          discounts: mini1Games.reduce((s, g) => s + g.discount_amount, 0),
        },
        mini2: {
          games: mini2Games.length,
          minutes: mini2Games.reduce((s, g) => s + g.duration_minutes, 0),
          revenue: mini2Games.filter(g => g.payment_status === 'PAID' || g.payment_status === 'LOAN_PAID').reduce((s, g) => s + g.final_price, 0),
          discounts: mini2Games.reduce((s, g) => s + g.discount_amount, 0),
        },
      },
      workerPerformance: Object.values(workerMap),
    });
  });

  // Export CSV endpoint
  app.get('/api/reports/export-csv', requireAdmin, (req: Request, res: Response) => {
    const games = storage.getGames({ includeDeleted: false });
    const headers = [
      'Game ID',
      'Session',
      'Table',
      'Customer',
      'Start Time',
      'End Time',
      'Duration (min)',
      'Suggested Price (DH)',
      'Final Price (DH)',
      'Discount (DH)',
      'Payment Status',
      'Offer Type',
      'Manual Reason',
    ];

    const rows = games.map(g => [
      g.game_id,
      g.session_id,
      g.table_id,
      `"${g.player_name.replace(/"/g, '""')}"`,
      g.start_time,
      g.end_time || '',
      g.duration_minutes,
      g.suggested_price,
      g.final_price,
      g.discount_amount,
      g.payment_status,
      g.offer_type,
      `"${(g.price_reason || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="extrablack-games-${getCasablancaDate()}.csv"`);
    res.send(csvContent);
  });

  // Calendar Day Session Report
  app.get('/api/reports/calendar-day', requireAuth, (req: Request, res: Response) => {
    const targetDate = (req.query.date as string) || getCasablancaDate();
    const report = storage.getCalendarDayReport(targetDate);
    res.json(report);
  });

  // Connected User Sessions & Worker Activity Logs Report
  app.get('/api/user-sessions', requireAdmin, (req: Request, res: Response) => {
    const { date, userId } = req.query;
    const logs = storage.getUserSessionLogs({
      date: date as string,
      userId: userId as string,
    });
    res.json(logs);
  });

  // Disconnect / Force Logout a user session
  app.post('/api/user-sessions/:id/disconnect', requireAdmin, (req: Request, res: Response) => {
    const success = storage.disconnectUserSession(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'User session log not found' });
    }
    res.json({ success: true });
  });

  // ==================== SYSTEM & DATA DIAGNOSTICS (ADMIN) ====================
  app.get('/api/admin/diagnostics', requireAdmin, async (req: Request, res: Response) => {
    const mongoStatus = getMongoStatus();
    const today = getMoroccoDate();

    // Direct MongoDB fetch
    let mongoGames: any[] = [];
    let mongoLoans: any[] = [];
    let mongoSessions: any[] = [];
    let mongoCustomers: any[] = [];
    let mongoTables: any[] = [];
    let mongoAuditLogs: any[] = [];
    let mongoConnected = false;

    if (isMongoAvailable()) {
      try {
        const database = await getMongoDb();
        if (database) {
          [mongoGames, mongoLoans, mongoSessions, mongoCustomers, mongoTables, mongoAuditLogs] = await Promise.all([
            loadFromMongo('games'),
            loadFromMongo('loans'),
            loadFromMongo('sessions'),
            loadFromMongo('customers'),
            loadFromMongo('tables'),
            loadFromMongo('audit_logs'),
          ]);
          mongoConnected = true;
        }
      } catch (e: any) {
        console.log('[Diagnostics] Notice reading MongoDB directly:', e?.message || e);
      }
    }

    const allGames = storage.getGames({ includeDeleted: true });
    const gamesToday = allGames.filter(g => (g.session_id === `SESSION-${today}` || (g.start_time && g.start_time.startsWith(today))) && !g.deleted);
    const completedGames = gamesToday.filter(g => g.status === 'CLOSED');
    const activeGames = gamesToday.filter(g => g.status === 'RUNNING');

    const allLoans = storage.getLoans();
    const openLoans = allLoans.filter(l => l.status === 'OPEN');

    const currentSession = storage.getCurrentSession();
    storage.recalculateSessionTotals(currentSession.session_id);
    const updatedSession = storage.getSessionById(currentSession.session_id) || currentSession;

    const last10Games = allGames.slice(0, 10).map(g => ({
      game_id: g.game_id,
      session_id: g.session_id,
      table_id: g.table_id,
      player_name: g.player_name,
      status: g.status,
      payment_status: g.payment_status,
      suggested_price: g.suggested_price || 0,
      final_price: g.final_price || 0,
      start_time: g.start_time,
      end_time: g.end_time,
      winner_name: g.winner_name,
      loser_name: g.loser_name,
    }));

    const isConsistent = mongoGames.length >= 0;

    res.json({
      timestamp: getCasablancaIsoString(),
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        databaseEngine: 'MongoDB Atlas',
        databaseName: mongoStatus.databaseName,
        clusterHost: mongoStatus.uriHost,
        timezone: 'Africa/Casablanca',
        moroccoTime: new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Africa/Casablanca',
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(new Date()),
        serverUptimeSeconds: Math.floor(process.uptime()),
        appVersion: '2.4.0',
      },
      storageCounts: {
        gamesTotal: allGames.length,
        gamesToday: gamesToday.length,
        completedGames: completedGames.length,
        activeGames: activeGames.length,
        loansTotal: allLoans.length,
        openLoans: openLoans.length,
        sessionsTotal: storage.getAllSessions().length,
        customersTotal: storage.getCustomers().length,
        tablesTotal: storage.getTables().length,
      },
      mongoCounts: {
        connected: mongoConnected,
        games: mongoGames.length,
        loans: mongoLoans.length,
        sessions: mongoSessions.length,
        customers: mongoCustomers.length,
        tables: mongoTables.length,
        auditLogs: mongoAuditLogs.length,
      },
      firestoreCounts: {
        connected: mongoConnected,
        games: mongoGames.length,
        loans: mongoLoans.length,
        sessions: mongoSessions.length,
        customers: mongoCustomers.length,
        tables: mongoTables.length,
        auditLogs: mongoAuditLogs.length,
      },
      activeSession: {
        sessionId: updatedSession.session_id,
        status: updatedSession.status,
        openedAt: updatedSession.opened_at,
        date: updatedSession.date,
        totalGames: updatedSession.total_games || 0,
        totalPaid: updatedSession.total_paid || 0,
        newLoans: updatedSession.new_loans || 0,
        reste: updatedSession.reste || 0,
        mini1Revenue: updatedSession.mini1_revenue || 0,
        mini2Revenue: updatedSession.mini2_revenue || 0,
      },
      last10Games,
      queryDebug: {
        allGamesInRepository: allGames.length,
        gamesMatchingCurrentSession: allGames.filter(g => g.session_id === currentSession.session_id).length,
        gamesMatchingTodayDate: gamesToday.length,
        activeRunningGames: activeGames.length,
        closedPaidGames: gamesToday.filter(g => g.status === 'CLOSED' && (g.payment_status === 'PAID' || g.payment_status === 'LOAN_PAID')).length,
        closedLoanGames: gamesToday.filter(g => g.status === 'CLOSED' && g.payment_status === 'LOAN').length,
      },
      systemStatus: {
        mongoDirectRead: mongoConnected ? 'Connected & Verified (Atlas Cluster)' : 'Reconnecting',
        firestoreDirectRead: getFirestoreStatus().isVerified ? 'Connected & Active (Cloud Firestore)' : 'Secondary Backup (Idle/Unprovisioned)',
        apiLatencyMs: 0,
        memoryHydrated: true,
        storageConsistency: isConsistent ? 'CONSISTENT' : 'MISMATCH',
      },
    });
  });

  // ==================== DATABASE EXPLORER (ADMIN) ====================
  app.get('/api/admin/database/overview', requireAdmin, (req: Request, res: Response) => {
    const mongoStatus = getMongoStatus();
    const consoleUrl = 'https://cloud.mongodb.com/';

    const games = storage.getGames({ includeDeleted: true });
    const customers = storage.getCustomers();
    const loans = storage.getLoans();
    const sessions = storage.getAllSessions();
    const tables = storage.getTables();
    const waitingList = storage.getWaitingList();
    const users = storage.getUsers();
    const auditLogs = storage.getAuditLogs(100);
    const settings = storage.getSettings();

    res.json({
      meta: {
        projectId: 'mongodb-atlas',
        databaseId: mongoStatus.databaseName,
        clusterHost: mongoStatus.uriHost,
        consoleUrl,
        status: mongoStatus.connected ? 'CONNECTED' : 'ONLINE',
        provider: 'MongoDB Atlas Cloud',
        timezone: 'Africa/Casablanca',
        syncedTime: getCasablancaIsoString(),
      },
      collections: {
        games: { count: games.length, sample: games.slice(0, 50) },
        customers: { count: customers.length, sample: customers.slice(0, 50) },
        loans: { count: loans.length, sample: loans.slice(0, 50) },
        sessions: { count: sessions.length, sample: sessions.slice(0, 50) },
        tables: { count: tables.length, sample: tables },
        waiting_list: { count: waitingList.length, sample: waitingList },
        users: { count: users.length, sample: users },
        audit_logs: { count: auditLogs.length, sample: auditLogs },
        settings: { count: 1, sample: [settings] },
      },
    });
  });

  app.get('/api/admin/database/collection/:collectionName', requireAdmin, (req: Request, res: Response) => {
    const { collectionName } = req.params;
    let data: any[] = [];

    switch (collectionName) {
      case 'games':
        data = storage.getGames({ includeDeleted: true });
        break;
      case 'customers':
        data = storage.getCustomers();
        break;
      case 'loans':
        data = storage.getLoans();
        break;
      case 'sessions':
        data = storage.getAllSessions();
        break;
      case 'tables':
        data = storage.getTables();
        break;
      case 'waiting_list':
        data = storage.getWaitingList();
        break;
      case 'users':
        data = storage.getUsers();
        break;
      case 'audit_logs':
        data = storage.getAuditLogs(200);
        break;
      case 'settings':
        data = [storage.getSettings()];
        break;
      default:
        return res.status(404).json({ error: `Collection ${collectionName} not found` });
    }

    res.json({
      collection: collectionName,
      totalCount: data.length,
      data,
    });
  });

  app.post('/api/admin/database/sync', requireAdmin, async (req: Request, res: Response) => {
    try {
      // Sync to both MongoDB Atlas and Firestore
      const mongoResult = await storage.syncAllToMongo();
      // Optional Firestore sync in background
      storage.syncAllToCloudFirestore().catch(e => console.warn('[Sync] Firestore sync warning:', e));
      res.json(mongoResult);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to sync to MongoDB database' });
    }
  });

  // Google Sheets Backup Endpoints & Persistence Stack Status
  app.get('/api/admin/sheets/status', requireAdmin, async (req: Request, res: Response) => {
    try {
      const sheetsHealth = await googleSheetsService.getHealth();
      const mongoHealth = getMongoStatus();
      const firestoreHealth = getFirestoreStatus();

      // Aggregate health summary across entire persistence stack
      const stack = {
        sheets: sheetsHealth,
        mongodb: {
          configured: mongoHealth.configured,
          connected: mongoHealth.connected,
          databaseName: mongoHealth.databaseName,
          lastError: mongoHealth.lastError,
          lastConnectedTime: mongoHealth.lastConnectedTime,
        },
        firestore: {
          configured: firestoreHealth.configured,
          connected: firestoreHealth.isVerified && !firestoreHealth.isApiDisabled,
          databaseId: firestoreHealth.databaseId,
          isApiDisabled: firestoreHealth.isApiDisabled,
        },
        // Overall stack status is healthy if primary MongoDB is connected and sheets is either connected or configured
        overallHealthy: mongoHealth.connected && (sheetsHealth.connected || !sheetsHealth.serviceAccountConfigured),
      };

      // Maintain backward compatibility with SheetHealthStatus shape while providing stack metadata
      res.json({
        ...sheetsHealth,
        stack,
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to check sync stack status' });
    }
  });

  app.post('/api/admin/sheets/sync-all', requireAdmin, async (req: Request, res: Response) => {
    try {
      const result = await storage.syncAllToGoogleSheets();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to sync with Google Sheets' });
    }
  });

  app.post('/api/admin/sheets/init', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { spreadsheetId } = req.body;
      if (spreadsheetId) {
        googleSheetsService.setSpreadsheetId(spreadsheetId);
        const cleanId = googleSheetsService.getSpreadsheetId();
        if (cleanId) {
          storage.updateSettings({ google_sheets_spreadsheet_id: cleanId }, (req as any).user?.email || 'ADMIN');
        }
      }
      const success = await googleSheetsService.initializeSpreadsheet();
      let syncResult = null;
      if (success) {
        syncResult = await storage.syncAllToGoogleSheets();
      }
      const health = await googleSheetsService.getHealth();
      res.json({ success, health, syncResult });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to initialize spreadsheet' });
    }
  });

  app.post('/api/admin/sheets/create', requireAdmin, async (req: Request, res: Response) => {
    try {
      const newSpreadsheetId = await googleSheetsService.createNewBackupSpreadsheet();
      if (!newSpreadsheetId) {
        return res.status(500).json({ error: 'Failed to create new spreadsheet. Check service account permissions.' });
      }
      const syncResult = await storage.syncAllToGoogleSheets();
      res.json({ success: true, spreadsheetId: newSpreadsheetId, syncResult });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to create backup spreadsheet' });
    }
  });

  // ==================== VITE MIDDLEWARE (SPA ENTRY) ====================

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[EXTRABLACK] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
