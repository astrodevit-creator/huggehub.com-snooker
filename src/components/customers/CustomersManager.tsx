/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Customers Manager Component
 */

import React, { useEffect, useState } from 'react';
import {
  Users,
  Search,
  UserPlus,
  Phone,
  Calendar,
  DollarSign,
  Gift,
  CreditCard,
  History,
  ChevronRight,
  Clock,
  Sparkles,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { Modal } from '../common/Modal.tsx';
import { Customer, Game } from '../../types.ts';
import { formatDate, formatDateTime, formatDurationHuman } from '../../lib/dateUtils.ts';
import { api } from '../../lib/api.ts';
import { useTranslation } from '../../lib/i18n/useTranslation.ts';
import { useFirestoreRealtimeStream } from '../../lib/useFirestoreStream.ts';

export const CustomersManager: React.FC = () => {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerGames, setCustomerGames] = useState<Game[]>([]);
  const [isLoadingGames, setIsLoadingGames] = useState<boolean>(false);
  const [isSyncingPlayers, setIsSyncingPlayers] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // New customer form
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchCustomers = async () => {
    try {
      const data = await api.getCustomers();
      setCustomers(data);
    } catch {
      // ignore
    }
  };

  useFirestoreRealtimeStream(() => {
    if (!isAddModalOpen && !selectedCustomer && !isSyncingPlayers) {
      fetchCustomers();
    }
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleAutoSyncPlayers = async () => {
    try {
      setIsSyncingPlayers(true);
      setSyncFeedback(null);
      const res = await api.autoSyncAllPlayers();
      await fetchCustomers();
      if (res.totalAdded > 0) {
        setSyncFeedback(t('autoSyncSuccess').replace('{count}', String(res.totalAdded)));
      } else {
        setSyncFeedback(t('autoAddedCustomer'));
      }
      setTimeout(() => setSyncFeedback(null), 6000);
    } catch (err: any) {
      alert(err.message || 'Failed to auto-sync players');
    } finally {
      setIsSyncingPlayers(false);
    }
  };

  const handleOpenCustomerProfile = async (customer: Customer) => {
    setSelectedCustomer(customer);
    try {
      setIsLoadingGames(true);
      const games = await api.getGames({ customerId: customer.customer_id });
      setCustomerGames(games);
    } catch {
      setCustomerGames([]);
    } finally {
      setIsLoadingGames(false);
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setIsSubmitting(true);
      await api.createCustomer({
        name: name.trim(),
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      setIsAddModalOpen(false);
      setName('');
      setPhone('');
      setNotes('');
      await fetchCustomers();
    } catch (err: any) {
      alert(err.message || 'Failed to add customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = customers.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q));
  });

  return (
    <div className="space-y-6">
      {/* Search & Add Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
          <input
            type="text"
            id="customers-search-input"
            placeholder="Search customers by name or phone..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Auto-Add / Sync All Players Button */}
          <button
            type="button"
            id="auto-sync-players-btn"
            onClick={handleAutoSyncPlayers}
            disabled={isSyncingPlayers}
            title={t('syncAllPlayersDesc')}
            className="py-2.5 px-3.5 bg-neutral-900 hover:bg-neutral-800 text-amber-400 hover:text-amber-300 font-bold text-xs rounded-xl border border-amber-500/30 transition-all flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Sparkles className={`w-4 h-4 ${isSyncingPlayers ? 'animate-spin' : ''}`} />
            <span>{isSyncingPlayers ? t('syncingPlayers') : t('syncPlayersBtn')}</span>
          </button>

          <button
            type="button"
            id="open-create-customer-btn"
            onClick={() => setIsAddModalOpen(true)}
            className="py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-md shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Add Customer</span>
          </button>
        </div>
      </div>

      {/* Sync feedback notification */}
      {syncFeedback && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-xs text-emerald-400 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{syncFeedback}</span>
        </div>
      )}

      {/* Customers List / Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filtered.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-neutral-900/40 rounded-2xl border border-neutral-800">
            <Users className="w-10 h-10 text-neutral-600 mx-auto mb-2" />
            <div className="text-base font-semibold text-neutral-300">No customers found</div>
            <div className="text-xs text-neutral-500 mt-1">Try a different search term or add a new customer.</div>
          </div>
        ) : (
          filtered.map(cus => (
            <div
              key={cus.customer_id}
              id={`customer-card-${cus.customer_id.toLowerCase()}`}
              onClick={() => handleOpenCustomerProfile(cus)}
              className="p-4 bg-neutral-900/80 hover:bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 rounded-2xl cursor-pointer transition-all space-y-3 group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-base text-white group-hover:text-amber-300 transition-colors">
                    {cus.name}
                  </h4>
                  {cus.phone && (
                    <div className="text-xs text-neutral-400 flex items-center gap-1 mt-0.5 font-mono">
                      <Phone className="w-3 h-3 text-neutral-500" />
                      <span>{cus.phone}</span>
                    </div>
                  )}
                </div>

                <ChevronRight className="w-4 h-4 text-neutral-600 group-hover:text-amber-400 transition-colors" />
              </div>

              {/* Quick stats row */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-neutral-800/80 text-center">
                <div className="p-1.5 bg-neutral-950 rounded-lg">
                  <div className="text-[9px] uppercase font-bold text-neutral-500">Today</div>
                  <div className="text-sm font-bold text-amber-400 font-mono">
                    {cus.today_games_count || 0}
                  </div>
                </div>

                <div className="p-1.5 bg-neutral-950 rounded-lg">
                  <div className="text-[9px] uppercase font-bold text-neutral-500">Lifetime</div>
                  <div className="text-sm font-bold text-neutral-200 font-mono">
                    {cus.lifetime_games || 0}
                  </div>
                </div>

                <div className="p-1.5 bg-neutral-950 rounded-lg">
                  <div className="text-[9px] uppercase font-bold text-neutral-500">Open Loan</div>
                  <div className={`text-sm font-bold font-mono ${(cus.open_loan_balance_dh || 0) > 0 ? 'text-amber-400' : 'text-neutral-400'}`}>
                    {cus.open_loan_balance_dh || 0} DH
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Customer Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Customer"
        subtitle="Register customer in EXTRABLACK directory"
        maxWidth="md"
      >
        <form onSubmit={handleAddCustomer} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-neutral-300 mb-1">
              Customer Name <span className="text-amber-400">*</span>
            </label>
            <input
              type="text"
              required
              id="create-customer-name"
              placeholder="e.g. Youssef Alami"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-300 mb-1">Phone Number (Optional)</label>
            <input
              type="tel"
              id="create-customer-phone"
              placeholder="0600112233"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-300 mb-1">Notes (Optional)</label>
            <input
              type="text"
              id="create-customer-notes"
              placeholder="e.g. Regular tournament player"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              id="submit-create-customer-btn"
              disabled={isSubmitting || !name.trim()}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl transition-colors shadow-md disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Customer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Customer Full Profile Modal */}
      <Modal
        isOpen={!!selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        title="Customer Profile"
        subtitle={selectedCustomer?.name || ''}
        maxWidth="xl"
      >
        {selectedCustomer && (
          <div className="space-y-5">
            {/* Header info card */}
            <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 flex items-center justify-between">
              <div>
                <h4 className="text-xl font-bold text-white">{selectedCustomer.name}</h4>
                <div className="text-xs text-neutral-400 mt-1 font-mono">
                  {selectedCustomer.phone || 'No phone recorded'} • Member since {formatDate(selectedCustomer.created_at)}
                </div>
                {selectedCustomer.notes && (
                  <div className="text-xs text-amber-300/80 mt-1 italic">{selectedCustomer.notes}</div>
                )}
              </div>

              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-neutral-500">Current Loan Balance</div>
                <div className="text-2xl font-extrabold font-mono text-amber-400">
                  {selectedCustomer.open_loan_balance_dh || 0} <span className="text-sm">DH</span>
                </div>
              </div>
            </div>

            {/* Lifetime Statistics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
                <div className="text-[10px] uppercase font-bold text-neutral-500">Games Today</div>
                <div className="text-lg font-bold text-amber-400 font-mono mt-0.5">
                  {selectedCustomer.today_games_count || 0}
                </div>
              </div>

              <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
                <div className="text-[10px] uppercase font-bold text-neutral-500">Lifetime Games</div>
                <div className="text-lg font-bold text-white font-mono mt-0.5">
                  {selectedCustomer.lifetime_games || 0}
                </div>
              </div>

              <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
                <div className="text-[10px] uppercase font-bold text-neutral-500">Discounts Received</div>
                <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5">
                  {selectedCustomer.discounts_received_dh || 0} DH
                </div>
              </div>

              <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
                <div className="text-[10px] uppercase font-bold text-neutral-500">Free Games (Promo)</div>
                <div className="text-lg font-bold text-blue-400 font-mono mt-0.5">
                  {selectedCustomer.free_games_received || 0}
                </div>
              </div>
            </div>

            {/* Past Game History */}
            <div>
              <h5 className="text-xs uppercase font-bold text-neutral-400 tracking-wider mb-2">
                Recent Game Records
              </h5>
              <div className="max-h-56 overflow-y-auto space-y-2">
                {isLoadingGames ? (
                  <div className="py-6 text-center text-xs text-neutral-500">Loading history...</div>
                ) : customerGames.length === 0 ? (
                  <div className="py-6 text-center text-xs text-neutral-500">No past games found.</div>
                ) : (
                  customerGames.map(g => (
                    <div
                      key={g.game_id}
                      className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-white">
                          <span className="uppercase text-amber-400 mr-1.5">{g.table_id}</span>
                          <span>{formatDurationHuman(g.duration_minutes)}</span>
                        </div>
                        <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
                          {formatDateTime(g.start_time)}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-mono font-bold text-white">{g.final_price} DH</div>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            g.payment_status === 'PAID' || g.payment_status === 'LOAN_PAID'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : g.payment_status === 'LOAN'
                              ? 'bg-orange-500/20 text-orange-400'
                              : 'bg-neutral-800 text-neutral-400'
                          }`}
                        >
                          {g.payment_status === 'LOAN_PAID' ? 'PAID' : g.payment_status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
