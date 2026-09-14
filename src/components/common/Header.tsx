/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Global Responsive Navigation Header
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  LogOut,
  RefreshCw,
  LayoutDashboard,
  CreditCard,
  Users,
  BarChart3,
  ShieldCheck,
  User,
  ChevronDown,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../lib/authContext.tsx';
import { useTranslation } from '../../lib/i18n/index.tsx';
import { LanguageSelector } from './LanguageSelector.tsx';
import { PWAInstallButton } from './PWAInstallButton.tsx';
import { formatTime, formatDate } from '../../lib/dateUtils.ts';
import { DailySession } from '../../types.ts';

export type TabType = 'DASHBOARD' | 'LOANS' | 'CUSTOMERS' | 'REPORTS' | 'ADMIN';

interface HeaderProps {
  activeTab?: TabType;
  onTabChange?: (tab: TabType) => void;
  activeView?: string;
  setActiveView?: (view: string) => void;
  onLogout?: () => void;
  session?: DailySession;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab = 'DASHBOARD',
  onTabChange,
  activeView,
  setActiveView,
  onLogout,
  onRefresh,
  isRefreshing = false,
}) => {
  const { user, isAdmin, logout } = useAuth();
  const { t } = useTranslation();
  const [currentTime, setCurrentTime] = useState<string>(new Date().toISOString());
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Clock ticker for Casablanca time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toISOString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle clicking outside to close user dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentTab = (activeTab || activeView?.toUpperCase() || 'DASHBOARD') as TabType;

  const handleSelectTab = (tab: TabType) => {
    setIsUserMenuOpen(false);
    if (onTabChange) {
      onTabChange(tab);
    } else if (setActiveView) {
      setActiveView(tab.toLowerCase());
    }
  };

  const handleLogout = () => {
    setIsUserMenuOpen(false);
    if (onLogout) {
      onLogout();
    } else {
      logout();
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-2 sm:px-4 lg:px-8 py-2 sm:py-2.5 shadow-2xs transition-colors">
      <div className="max-w-7xl mx-auto grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:gap-4">
        {/* ================= ZONE 1: Brand & Club Title ================= */}
        <div className="flex items-center gap-2 sm:gap-6 min-w-0">
          <button
            type="button"
            onClick={() => handleSelectTab('DASHBOARD')}
            className="flex items-center gap-2 group text-start min-w-0 shrink focus:outline-hidden"
            title={`${t('appName')} - ${t('snookerClub')}`}
            aria-label={`${t('appName')} - ${t('snookerClub')}`}
          >
            {/* Logo Box with Attached Realtime Cloud Status Pulse */}
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-600/20 group-hover:scale-105 transition-transform shrink-0">
              <span className="text-white font-black text-sm sm:text-base tracking-tighter">8</span>
              {/* Pulsing Cloud-Connected Indicator Dot */}
              <span
                className="absolute -top-1 -end-1 flex h-3 w-3"
                title={t('cloudConnected')}
                aria-label={t('cloudConnected')}
              >
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 ring-2 ring-white" />
              </span>
            </div>

            {/* Brand Names & Live Clock */}
            <div className="min-w-0 truncate">
              <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                <span className="font-black text-slate-900 text-xs sm:text-base tracking-wider uppercase truncate">
                  {t('appName')}
                </span>
                <span className="hidden xs:inline-flex text-[9px] sm:text-[10px] uppercase font-bold tracking-widest px-1 sm:px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                  {t('snookerClub')}
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500 font-mono truncate">
                <span>{formatDate(currentTime)}</span>
                <span>•</span>
                <span className="text-indigo-600 font-semibold">
                  {formatTime(currentTime, true)} ({t('casablancaTime')})
                </span>
              </div>
            </div>
          </button>

          {/* Desktop Navigation Tabs (Hidden on mobile) */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/80 shrink-0">
            <button
              type="button"
              id="header-nav-dashboard"
              onClick={() => handleSelectTab('DASHBOARD')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentTab === 'DASHBOARD'
                  ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>{t('navTables')}</span>
            </button>

            {isAdmin && (
              <button
                type="button"
                id="header-nav-loans"
                onClick={() => handleSelectTab('LOANS')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  currentTab === 'LOANS'
                    ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>{t('navLoans')}</span>
              </button>
            )}

            <button
              type="button"
              id="header-nav-customers"
              onClick={() => handleSelectTab('CUSTOMERS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentTab === 'CUSTOMERS'
                  ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{t('navPlayers')}</span>
            </button>

            {isAdmin && (
              <button
                type="button"
                id="header-nav-reports"
                onClick={() => handleSelectTab('REPORTS')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  currentTab === 'REPORTS'
                    ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>{t('navReports')}</span>
              </button>
            )}

            {isAdmin && (
              <button
                type="button"
                id="header-nav-admin"
                onClick={() => handleSelectTab('ADMIN')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  currentTab === 'ADMIN'
                    ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{t('navAdmin')}</span>
              </button>
            )}
          </nav>
        </div>

        {/* ================= ZONE 2: Actions Zone ================= */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 justify-end">
          {/* PWA Install Button (Icon on mobile, labeled on desktop) */}
          <PWAInstallButton />

          {/* Language Selector (Icon on mobile, labeled on desktop) */}
          <LanguageSelector />

          {/* Optional Manual Refresh Button */}
          {onRefresh && (
            <button
              type="button"
              id="header-refresh-btn"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="w-10 h-10 min-w-[40px] min-h-[40px] sm:w-auto sm:h-auto p-0 sm:p-2 flex items-center justify-center text-slate-500 hover:text-slate-800 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors active:scale-95"
              title={t('refreshData')}
              aria-label={t('refreshData')}
            >
              <RefreshCw className={`w-4 h-4 sm:w-3.5 sm:h-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          )}

          {/* User Profile & Avatar Menu Dropdown Trigger */}
          <div className="relative inline-block" ref={userMenuRef}>
            <button
              type="button"
              id="header-user-menu-btn"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="w-10 h-10 min-w-[40px] min-h-[40px] sm:w-auto sm:h-auto p-0 sm:px-2.5 sm:py-1.5 flex items-center justify-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-xs font-semibold text-slate-700 transition-colors shadow-2xs active:scale-95"
              aria-label={t('userProfile') || 'User profile and menu'}
              title={user?.name || user?.email || 'User profile'}
              aria-haspopup="true"
              aria-expanded={isUserMenuOpen}
            >
              {/* User Avatar Circle */}
              <div className="relative flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-600 text-white font-black text-xs shrink-0 shadow-xs">
                {user?.name ? user.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                <span
                  className={`absolute -bottom-0.5 -end-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                    isAdmin ? 'bg-indigo-600' : 'bg-emerald-500'
                  }`}
                />
              </div>

              {/* Desktop User Name & Role Badge */}
              <span className="hidden sm:inline-block font-bold text-slate-800 max-w-[90px] md:max-w-[120px] truncate">
                {user?.name || user?.email}
              </span>
              <span
                className={`hidden sm:inline-flex text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  isAdmin ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {user?.role === 'ADMIN' ? t('roleAdmin') : t('roleWorker')}
              </span>
              <ChevronDown
                className={`hidden sm:inline-block w-3.5 h-3.5 text-slate-400 transition-transform ${
                  isUserMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* User Dropdown Menu */}
            {isUserMenuOpen && (
              <div
                className="absolute z-50 mt-1.5 w-64 sm:w-72 bg-white rounded-2xl border border-slate-200 shadow-xl p-3 space-y-3 animate-in fade-in zoom-in-95 duration-100 end-0 text-start"
                role="menu"
                aria-orientation="vertical"
                aria-labelledby="header-user-menu-btn"
              >
                {/* User Info Header */}
                <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
                    {user?.name ? user.name.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 text-xs truncate">
                      {user?.name || 'Staff User'}
                    </div>
                    {user?.email && (
                      <div className="text-[11px] text-slate-500 truncate">
                        {user.email}
                      </div>
                    )}
                    <div className="mt-1">
                      <span
                        className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          isAdmin ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {user?.role === 'ADMIN' ? t('roleAdmin') : t('roleWorker')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Cloud & Live System Status */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] space-y-1.5">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                      <span>{t('cloudConnected')}</span>
                    </span>
                    <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      Firestore
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500 text-[10px]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{t('casablancaTime')}</span>
                    </span>
                    <span className="font-mono text-indigo-700 font-bold">
                      {formatTime(currentTime, true)}
                    </span>
                  </div>
                </div>

                {/* Admin Quick Jump (If Admin) */}
                {isAdmin && (
                  <button
                    type="button"
                    id="header-dropdown-admin-btn"
                    onClick={() => handleSelectTab('ADMIN')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      <span>{t('navAdmin')}</span>
                    </span>
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  </button>
                )}

                {/* Divider */}
                <div className="border-t border-slate-100" />

                {/* Logout Button */}
                <button
                  type="button"
                  id="header-dropdown-logout-btn"
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all active:scale-95"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t('logout')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};


