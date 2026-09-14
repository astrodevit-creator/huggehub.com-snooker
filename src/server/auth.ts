/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Authentication & Role Verification
 */

import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { storage, SUPER_ADMIN_EMAIL } from './storage.ts';
import { User, UserRole } from '../types.ts';

const googleOAuthClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export interface AuthSessionUser {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthSessionUser;
    }
  }
}

/**
 * Creates a signed/simple session token encoding user credentials.
 */
export function createSessionToken(user: User): string {
  const payload = {
    userId: user.user_id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    issuedAt: Date.now(),
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * Decodes session token into AuthSessionUser.
 */
export function verifySessionToken(token: string): AuthSessionUser | null {
  try {
    const raw = Buffer.from(token, 'base64').toString('utf-8');
    const payload = JSON.parse(raw);
    if (!payload.userId || !payload.email || !payload.role) {
      return null;
    }

    // Always ensure super admin email has ADMIN role
    if (payload.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      payload.role = 'ADMIN';
      payload.active = true;
    }

    return {
      userId: payload.userId,
      name: payload.name,
      email: payload.email,
      role: payload.role as UserRole,
      active: payload.active !== false,
    };
  } catch {
    return null;
  }
}

/**
 * Express middleware to authenticate requests via cookie or Bearer header.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  let token = req.cookies?.['extrablack_session'];

  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7);
  }

  if (token) {
    const sessionUser = verifySessionToken(token);
    if (sessionUser) {
      // Re-check database state for user active status
      const dbUser = storage.getUserByEmail(sessionUser.email);
      if (dbUser && dbUser.active) {
        req.user = {
          userId: dbUser.user_id,
          name: dbUser.name,
          email: dbUser.email,
          role: dbUser.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() ? 'ADMIN' : dbUser.role,
          active: dbUser.active,
        };
      } else if (sessionUser.active) {
        req.user = sessionUser;
      }
    }
  }

  next();
}

/**
 * Middleware requiring authenticated user.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.user.active) {
    return res.status(401).json({ error: 'Unauthorized. Please login.' });
  }
  next();
}

/**
 * Middleware requiring ADMIN role.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.user.active) {
    return res.status(401).json({ error: 'Unauthorized. Please login.' });
  }

  if (req.user.role !== 'ADMIN' && req.user.email.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }

  next();
}

/**
 * Authenticates with email address (and optional password or role matching).
 */
export async function authenticateWithEmail(
  emailInput: string,
  nameInput?: string,
  roleInput?: UserRole
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const email = emailInput.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    const isSuperAdmin = email === SUPER_ADMIN_EMAIL.toLowerCase();

    // Check if user exists
    let existingUser = storage.getUserByEmail(email);

    if (!existingUser) {
      // Create user automatically for super admin or new staff with provided/default role
      const assignedRole: UserRole = isSuperAdmin ? 'ADMIN' : (roleInput || 'WORKER');
      const assignedName = nameInput?.trim() || (isSuperAdmin ? 'Super Administrator' : email.split('@')[0]);

      existingUser = storage.createUser({
        name: assignedName,
        email,
        role: assignedRole,
        active: true,
        created_by: 'EMAIL_AUTH',
      });
    }

    if (!existingUser.active) {
      return { success: false, error: 'Your account has been deactivated. Contact administrator.' };
    }

    // Ensure super admin role
    if (isSuperAdmin && existingUser.role !== 'ADMIN') {
      existingUser = storage.updateUser(existingUser.user_id, { role: 'ADMIN' }) || existingUser;
    }

    // Update last login
    storage.updateUser(existingUser.user_id, {
      last_login: new Date().toISOString(),
    });

    return { success: true, user: existingUser };
  } catch (err: any) {
    return { success: false, error: err.message || 'Email authentication failed' };
  }
}

/**
 * Verifies a Google OAuth ID token or email against the system.
 */
export async function authenticateWithGoogle(idTokenOrEmail: string): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    let email = idTokenOrEmail.trim().toLowerCase();
    let name = 'Google User';

    // If string looks like a JWT, verify with Google Auth Library
    if (idTokenOrEmail.includes('.')) {
      try {
        const ticket = await googleOAuthClient.verifyIdToken({
          idToken: idTokenOrEmail,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (payload?.email) {
          email = payload.email.toLowerCase();
          name = payload.name || payload.email.split('@')[0];
        }
      } catch (jwtErr) {
        // Fallback for mock/direct dev authentication
        console.warn('[Auth] Google Token verification fallback:', jwtErr);
      }
    }

    // Check if Super Admin
    if (email === SUPER_ADMIN_EMAIL.toLowerCase()) {
      let adminUser = storage.getUserByEmail(email);
      if (!adminUser) {
        adminUser = storage.createUser({
          name: name || 'Super Administrator',
          email: SUPER_ADMIN_EMAIL,
          role: 'ADMIN',
          active: true,
          created_by: 'SYSTEM',
        });
      }
      return { success: true, user: adminUser };
    }

    // Check existing registered active users
    const existingUser = storage.getUserByEmail(email);
    if (!existingUser) {
      return { success: false, error: 'Access denied. Contact administrator to authorize your email.' };
    }

    if (!existingUser.active) {
      return { success: false, error: 'Your account has been deactivated. Contact administrator.' };
    }

    // Update last login
    storage.updateUser(existingUser.user_id, {
      last_login: new Date().toISOString(),
    });

    return { success: true, user: existingUser };
  } catch (err: any) {
    return { success: false, error: err.message || 'Authentication failed' };
  }
}
