/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Connected User Sessions & Worker Activity Report
 */

import React, { useEffect, useState } from 'react';
import {
  Users,
  Activity,
  LogOut,
  Clock,
  DollarSign,
  CreditCard,
  Percent,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Smartphone,
  Globe,
  Radio,
} from 'lucide-react';
import { UserSessionLog } from '../../types.ts';
import { api } from '../../lib/api.ts';
import { formatDurationHuman } from '../../lib/dateUtils.ts';
import { useTranslation } from '../../lib/i18n/useTranslation.ts';

export const UserSessionsReportView: React.FC = () => {
  const { t } = useTranslation();
  const [sessionLogs, setSessionLogs] = useState<UserSessionLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterUser, setFilterUser] = useState<string>('all');
  const [isDisconnecting, setIsDisconnecting] = useState<string | null>(null);

  const fetchSessionLogs = async () => {
    try {
      setIsLoading(true);
      const data = await api.getUserSessionLogs();
      setSessionLogs(data);
    } catch (err) {
      console.error('Failed to load user session logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionLogs();
    const timer = setInterval(fetchSessionLogs, 15000); // Live poll every 15s
    return () => clearInterval(timer);
  }, []);

  const handleDisconnect = async (sessionLogId: string) => {
    if (!window.confirm('Are you sure you want to disconnect this active staff session?')) {
      return;
    }

    try {
      setIsDisconnecting(sessionLogId);
      await api.disconnectUserSession(sessionLogId);
      await fetchSessionLogs();
    } catch (err) {
      console.error('Failed to disconnect session:', err);
    } finally {
      setIsDisconnecting(null);
    }
  };

  const activeSessions = sessionLogs.filter(s => s.status === 'ACTIVE');
  const pastSessions = sessionLogs.filter(s => s.status === 'LOGGED_OUT' || s.status === 'EXPIRED');

  const filteredLogs = filterUser === 'all'
    ? sessionLogs
    : sessionLogs.filter(s => s.user_id === filterUser);

  const uniqueUsers = Array.from(new Set(sessionLogs.map(s => JSON.stringify({ id: s.user_id, name: s.user_name }))))
    .map((str: string) => JSON.parse(str));

  return (
    <div className="space-y-6">
      {/* Top Header & Stats */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-neutral-900/90 rounded-2xl border border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <h3 className="text-base font-bold text-white">{t('userSessionsTitle')}</h3>
          </div>
          <p className="text-xs text-neutral-400 mt-1">{t('userSessionsDesc')}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 font-mono text-xs font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>{activeSessions.length} {t('onlineNow')}</span>
          </div>

          <button
            type="button"
            id="refresh-sessions-btn"
            onClick={fetchSessionLogs}
            disabled={isLoading}
            className="p-2 bg-neutral-950 hover:bg-neutral-800 text-neutral-300 rounded-xl border border-neutral-800 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Online Active Workers Section */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3 flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-amber-400" />
          <span>{t('activeWorkersCount')} ({activeSessions.length})</span>
        </div>

        {activeSessions.length === 0 ? (
          <div className="p-8 text-center bg-neutral-900/40 rounded-2xl border border-neutral-800/60 text-neutral-500 text-xs">
            No active staff sessions currently online.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeSessions.map(session => (
              <div
                key={session.id}
                className="p-5 bg-neutral-900/90 rounded-2xl border border-emerald-500/40 space-y-4 shadow-lg shadow-emerald-950/10 relative overflow-hidden"
              >
                {/* Active Indicator Ribbon */}
                <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-emerald-500 to-amber-500" />

                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      <span className="font-bold text-white text-base">{session.user_name}</span>
                    </div>
                    <div className="text-xs text-neutral-400 font-mono mt-0.5">{session.user_email}</div>
                  </div>

                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    {session.user_role}
                  </span>
                </div>

                {/* Session Shift Performance */}
                <div className="grid grid-cols-3 gap-2 bg-neutral-950 p-2.5 rounded-xl border border-neutral-800/80 text-center font-mono">
                  <div>
                    <div className="text-[9px] uppercase font-bold text-neutral-500">{t('gamesHandled')}</div>
                    <div className="text-sm font-extrabold text-white mt-0.5">{session.games_handled}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase font-bold text-neutral-500">{t('revenueHandled')}</div>
                    <div className="text-sm font-extrabold text-emerald-400 mt-0.5">{session.revenue_collected} DH</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase font-bold text-neutral-500">{t('loansCreated')}</div>
                    <div className="text-sm font-extrabold text-amber-400 mt-0.5">{session.loans_created} DH</div>
                  </div>
                </div>

                {/* Timing & IP Info */}
                <div className="text-[11px] text-neutral-400 space-y-1 font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">{t('sessionDuration')}:</span>
                    <span className="text-white font-bold">{formatDurationHuman(session.duration_minutes)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">{t('lastActive')}:</span>
                    <span className="text-neutral-300">{session.last_active_at.split('T')[1]?.slice(0, 8)}</span>
                  </div>
                  {session.ip_address && (
                    <div className="flex items-center justify-between text-[10px] text-neutral-500">
                      <span>IP / Device:</span>
                      <span className="truncate max-w-[150px]">{session.ip_address}</span>
                    </div>
                  )}
                </div>

                {/* Disconnect Action */}
                <button
                  type="button"
                  id={`disconnect-session-${session.id}`}
                  onClick={() => handleDisconnect(session.id)}
                  disabled={isDisconnecting === session.id}
                  className="w-full py-2 px-3 bg-neutral-950 hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 font-bold text-xs rounded-xl border border-neutral-800 hover:border-rose-700/50 transition-all flex items-center justify-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{isDisconnecting === session.id ? 'Disconnecting...' : t('disconnectSession')}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Complete Historical Login & Session Logs */}
      <div className="p-5 bg-neutral-900/80 rounded-2xl border border-neutral-800 space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              {t('loginHistory')} ({filteredLogs.length})
            </h4>
          </div>

          {/* User filter */}
          {uniqueUsers.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400">Filter Staff:</span>
              <select
                id="filter-staff-session"
                value={filterUser}
                onChange={e => setFilterUser(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 text-neutral-200 text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none"
              >
                <option value="all">All Staff</option>
                {uniqueUsers.map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center bg-neutral-950 rounded-xl border border-neutral-800/60 text-neutral-500 text-xs">
            No session logs found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 text-neutral-400 uppercase font-mono text-[10px]">
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Staff Member</th>
                  <th className="py-2.5 px-3">Login Time</th>
                  <th className="py-2.5 px-3">Logout Time</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3 text-center">Games</th>
                  <th className="py-2.5 px-3 text-right">Revenue</th>
                  <th className="py-2.5 px-3 text-right">Loans</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 font-mono">
                {filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-neutral-800/40 transition-colors">
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-neutral-800 text-neutral-400'
                        }`}
                      >
                        {log.status === 'ACTIVE' ? t('onlineNow') : t('loggedOut')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      <div className="font-bold text-white">{log.user_name}</div>
                      <div className="text-[10px] text-neutral-500 font-mono">{log.user_role}</div>
                    </td>
                    <td className="py-2.5 px-3 text-neutral-300 text-[11px]">
                      {log.login_at ? `${log.login_at.split('T')[0]} ${log.login_at.split('T')[1]?.slice(0, 5)}` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-400 text-[11px]">
                      {log.logout_at ? `${log.logout_at.split('T')[0]} ${log.logout_at.split('T')[1]?.slice(0, 5)}` : log.status === 'ACTIVE' ? 'Active now' : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-200">
                      {formatDurationHuman(log.duration_minutes)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-white">
                      {log.games_handled}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                      {log.revenue_collected} DH
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-amber-400">
                      {log.loans_created} DH
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
