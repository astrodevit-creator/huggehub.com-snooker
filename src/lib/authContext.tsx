/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Auth Context & State Provider
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, UserRole } from '../types.ts';
import { api } from './api.ts';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  isAdmin: boolean;
  isWorker: boolean;
  isLoading: boolean;
  error: string | null;
  loginWithPin: (pin: string) => Promise<boolean>;
  loginEmail: (email: string, name?: string, role?: UserRole) => Promise<boolean>;
  loginGoogle: (tokenOrEmail: string) => Promise<boolean>;
  loginDemo: (role: UserRole, email?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = async () => {
    try {
      const data = await api.getMe();
      setUser(data.user);
      setError(null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const loginWithPin = async (pin: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.loginWithPin(pin);
      setUser(res.user);
      return true;
    } catch (err: any) {
      setError(err.message || 'Invalid PIN code');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const loginEmail = async (email: string, name?: string, role?: UserRole): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.loginEmail(email, name, role);
      setUser(res.user);
      return true;
    } catch (err: any) {
      setError(err.message || 'Login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const loginGoogle = async (tokenOrEmail: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.loginGoogle(tokenOrEmail);
      setUser(res.user);
      return true;
    } catch (err: any) {
      setError(err.message || 'Login failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const loginDemo = async (role: UserRole, email?: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.loginDemo(role, email);
      setUser(res.user);
      return true;
    } catch (err: any) {
      setError(err.message || 'Login failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    setUser(null);
  };

  const role = user?.role || null;
  const isAdmin = role === 'ADMIN';
  const isWorker = role === 'WORKER' || role === 'ADMIN';

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAdmin,
        isWorker,
        isLoading,
        error,
        loginWithPin,
        loginEmail,
        loginGoogle,
        loginDemo,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
