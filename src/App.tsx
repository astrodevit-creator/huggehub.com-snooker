/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Root Application Component
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './lib/authContext.tsx';
import { I18nProvider, useTranslation } from './lib/i18n/index.tsx';
import { Header } from './components/common/Header.tsx';
import { LoginView } from './components/auth/LoginView.tsx';
import { DashboardView } from './components/dashboard/DashboardView.tsx';
import { LoansManager } from './components/loans/LoansManager.tsx';
import { CustomersManager } from './components/customers/CustomersManager.tsx';
import { ReportsView } from './components/reports/ReportsView.tsx';
import { AuditLogsView } from './components/admin/AuditLogsView.tsx';
import { StaffUsersManager } from './components/admin/StaffUsersManager.tsx';
import { DatabaseInspectorView } from './components/admin/DatabaseInspectorView.tsx';
import { DiagnosticsView } from './components/admin/DiagnosticsView.tsx';
import { LayoutDashboard, CreditCard, Users, BarChart3, ShieldCheck, WifiOff, Database, Activity } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { user, isLoading, logout } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'LOANS' | 'CUSTOMERS' | 'REPORTS' | 'ADMIN'>('DASHBOARD');
  const [adminSubTab, setAdminSubTab] = useState<'DIAGNOSTICS' | 'DATABASE' | 'AUDIT' | 'STAFF'>('DIAGNOSTICS');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <div className="text-xs font-mono uppercase tracking-widest text-slate-500">
          {t('loading')}
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-indigo-500/20 selection:text-indigo-900">
      {/* Offline Alert Banner */}
      {!isOnline && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-xs text-amber-800 font-medium flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4 text-amber-600" />
          <span>{t('offlineMode')}</span>
        </div>
      )}

      {/* Main Header */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={logout}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 pb-24 md:pb-10">
        {activeTab === 'DASHBOARD' && <DashboardView />}
        {activeTab === 'LOANS' && (user.role === 'ADMIN' ? <LoansManager /> : <DashboardView />)}
        {activeTab === 'CUSTOMERS' && <CustomersManager />}
        {activeTab === 'REPORTS' && <ReportsView />}
        {activeTab === 'ADMIN' && (
          <div className="space-y-6">
            {/* Admin Subtabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3 flex-wrap">
              <button
                type="button"
                id="admin-subtab-diagnostics"
                onClick={() => setAdminSubTab('DIAGNOSTICS')}
                className={`py-2 px-4 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  adminSubTab === 'DIAGNOSTICS'
                    ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Diagnostics</span>
              </button>

              <button
                type="button"
                id="admin-subtab-database"
                onClick={() => setAdminSubTab('DATABASE')}
                className={`py-2 px-4 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  adminSubTab === 'DATABASE'
                    ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>{t('navDatabase')}</span>
              </button>

              <button
                type="button"
                id="admin-subtab-audit"
                onClick={() => setAdminSubTab('AUDIT')}
                className={`py-2 px-4 rounded-lg text-xs font-semibold transition-all ${
                  adminSubTab === 'AUDIT'
                    ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {t('navAudit')}
              </button>

              <button
                type="button"
                id="admin-subtab-staff"
                onClick={() => setAdminSubTab('STAFF')}
                className={`py-2 px-4 rounded-lg text-xs font-semibold transition-all ${
                  adminSubTab === 'STAFF'
                    ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {t('navStaff')}
              </button>
            </div>

            {adminSubTab === 'DIAGNOSTICS' && <DiagnosticsView />}
            {adminSubTab === 'DATABASE' && <DatabaseInspectorView />}
            {adminSubTab === 'AUDIT' && <AuditLogsView />}
            {adminSubTab === 'STAFF' && <StaffUsersManager />}
          </div>
        )}
      </main>

      {/* Mobile Bottom Fixed Navigation Bar */}
      <nav aria-label="Mobile Navigation" className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 px-2 py-2 flex items-center justify-around shadow-lg">
        <button
          type="button"
          id="mobile-nav-dashboard"
          onClick={() => setActiveTab('DASHBOARD')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-all ${
            activeTab === 'DASHBOARD' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] uppercase tracking-wider font-semibold">{t('navTables')}</span>
        </button>

        {user.role === 'ADMIN' && (
          <button
            type="button"
            id="mobile-nav-loans"
            onClick={() => setActiveTab('LOANS')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-all ${
              activeTab === 'LOANS' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <CreditCard className="w-5 h-5" />
            <span className="text-[10px] uppercase tracking-wider font-semibold">{t('navLoans')}</span>
          </button>
        )}

        <button
          type="button"
          id="mobile-nav-customers"
          onClick={() => setActiveTab('CUSTOMERS')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-all ${
            activeTab === 'CUSTOMERS' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] uppercase tracking-wider font-semibold">{t('navPlayers')}</span>
        </button>

        {user.role === 'ADMIN' && (
          <button
            type="button"
            id="mobile-nav-reports"
            onClick={() => setActiveTab('REPORTS')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-all ${
              activeTab === 'REPORTS' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-[10px] uppercase tracking-wider font-semibold">{t('navReports')}</span>
          </button>
        )}

        {user.role === 'ADMIN' && (
          <button
            type="button"
            id="mobile-nav-admin"
            onClick={() => setActiveTab('ADMIN')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-all ${
              activeTab === 'ADMIN' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
            <span className="text-[10px] uppercase tracking-wider font-semibold">{t('navAdmin')}</span>
          </button>
        )}
      </nav>
    </div>
  );
};

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <MainLayout />
      </AuthProvider>
    </I18nProvider>
  );
}

