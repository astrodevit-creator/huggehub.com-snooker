/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Waiting List Manager
 */

import React, { useEffect, useState } from 'react';
import {
  Users,
  Plus,
  Clock,
  Play,
  XCircle,
  AlertCircle,
  CheckCircle,
  UserPlus,
} from 'lucide-react';
import { Modal } from '../common/Modal.tsx';
import { Customer, SnookerTable, WaitingEntry } from '../../types.ts';
import { calculateWaitingMinutes, formatTime } from '../../lib/dateUtils.ts';
import { api } from '../../lib/api.ts';

interface WaitingListManagerProps {
  tables: SnookerTable[];
  onStartGameWithCustomer?: (table: SnookerTable, waitingEntry: WaitingEntry) => void;
  onWaitingUpdated?: () => void;
}

export const WaitingListManager: React.FC<WaitingListManagerProps> = ({
  tables,
  onStartGameWithCustomer,
  onWaitingUpdated,
}) => {
  const [waitingList, setWaitingList] = useState<WaitingEntry[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [selectedTablePreference, setSelectedTablePreference] = useState<'MINI1' | 'MINI2' | 'ANY'>('ANY');

  // Form State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newPhone, setNewPhone] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchWaiting = async () => {
    try {
      const data = await api.getWaitingList();
      setWaitingList(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchWaiting();
    api.getCustomers().then(setCustomers);
  }, []);

  const handleAddWaiting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer && !newName.trim()) {
      setErrorMessage('Please select or create a customer');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      let targetCustomer = selectedCustomer;
      if (isCreatingNew && newName.trim()) {
        targetCustomer = await api.createCustomer({
          name: newName.trim(),
          phone: newPhone.trim() || undefined,
        });
      }

      if (!targetCustomer) return;

      await api.addWaitingCustomer({
        customerId: targetCustomer.customer_id,
        playerName: targetCustomer.name,
        preferredTable: selectedTablePreference,
        notes: notes.trim() || undefined,
      });

      setIsAddModalOpen(false);
      setSelectedCustomer(null);
      setNewName('');
      setNewPhone('');
      setNotes('');
      setIsCreatingNew(false);
      await fetchWaiting();
      onWaitingUpdated?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to add customer to waiting list');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'CANCELLED' | 'NO_SHOW') => {
    try {
      await api.updateWaitingStatus(id, status);
      await fetchWaiting();
      onWaitingUpdated?.();
    } catch {
      // ignore
    }
  };

  const mini1Waiting = waitingList.filter(w => w.preferred_table === 'MINI1' || w.preferred_table === 'ANY');
  const mini2Waiting = waitingList.filter(w => w.preferred_table === 'MINI2' || w.preferred_table === 'ANY');

  return (
    <div className="space-y-4">
      {/* Header & Global Add Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600" />
          <h3 className="text-base font-bold text-slate-900 tracking-tight">Live Queue &amp; Waiting List</h3>
        </div>
        <button
          type="button"
          id="open-add-waiting-btn"
          onClick={() => {
            setSelectedTablePreference('ANY');
            setIsAddModalOpen(true);
          }}
          className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Waiting Player</span>
        </button>
      </div>

      {/* Dual Queue Grid (Mini 1 & Mini 2) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* MINI 1 QUEUE */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="font-bold text-sm text-slate-900 tracking-tight">WAITING — MINI 1</span>
            </div>
            <span className="text-xs font-mono font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
              {mini1Waiting.length} in queue
            </span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto">
            {mini1Waiting.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">No players waiting for Mini 1</div>
            ) : (
              mini1Waiting.map((entry, index) => {
                const waitMins = calculateWaitingMinutes(entry.added_at);
                const tableObj = tables.find(t => t.table_id === 'MINI1') || tables[0];

                return (
                  <div
                    key={entry.waiting_id}
                    id={`waiting-row-${entry.waiting_id.toLowerCase()}`}
                    className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-200 text-[11px] font-bold text-slate-700 flex items-center justify-center font-mono">
                        {index + 1}
                      </span>
                      <div>
                        <div className="font-bold text-sm text-slate-900">{entry.player_name}</div>
                        <div className="text-[11px] text-amber-700 font-mono flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          <span>Waiting {waitMins} min (since {formatTime(entry.added_at)})</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {onStartGameWithCustomer && (
                        <button
                          type="button"
                          id={`seat-player-${entry.waiting_id.toLowerCase()}-mini1`}
                          onClick={() => onStartGameWithCustomer(tableObj, entry)}
                          className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 px-2.5 transition-colors shadow-sm"
                          title="Seat on Mini 1"
                        >
                          <Play className="w-3 h-3 fill-white" />
                          <span>Seat</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(entry.waiting_id, 'CANCELLED')}
                        className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg text-xs transition-colors"
                        title="Remove player"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* MINI 2 QUEUE */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <span className="font-bold text-sm text-slate-900 tracking-tight">WAITING — MINI 2</span>
            </div>
            <span className="text-xs font-mono font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
              {mini2Waiting.length} in queue
            </span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto">
            {mini2Waiting.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">No players waiting for Mini 2</div>
            ) : (
              mini2Waiting.map((entry, index) => {
                const waitMins = calculateWaitingMinutes(entry.added_at);
                const tableObj = tables.find(t => t.table_id === 'MINI2') || tables[1] || tables[0];

                return (
                  <div
                    key={entry.waiting_id}
                    id={`waiting-row-${entry.waiting_id.toLowerCase()}`}
                    className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-200 text-[11px] font-bold text-slate-700 flex items-center justify-center font-mono">
                        {index + 1}
                      </span>
                      <div>
                        <div className="font-bold text-sm text-slate-900">{entry.player_name}</div>
                        <div className="text-[11px] text-indigo-700 font-mono flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          <span>Waiting {waitMins} min (since {formatTime(entry.added_at)})</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {onStartGameWithCustomer && (
                        <button
                          type="button"
                          id={`seat-player-${entry.waiting_id.toLowerCase()}-mini2`}
                          onClick={() => onStartGameWithCustomer(tableObj, entry)}
                          className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 px-2.5 transition-colors shadow-sm"
                          title="Seat on Mini 2"
                        >
                          <Play className="w-3 h-3 fill-white" />
                          <span>Seat</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(entry.waiting_id, 'CANCELLED')}
                        className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg text-xs transition-colors"
                        title="Remove player"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Add Waiting Customer Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Player to Waiting List"
        subtitle="Queue customer for next available table"
        maxWidth="md"
      >
        <form onSubmit={handleAddWaiting} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Table Preference */}
          <div>
            <label className="block text-xs uppercase font-bold text-slate-500 tracking-wider mb-1.5">
              Preferred Table
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['ANY', 'MINI1', 'MINI2'] as const).map(pref => (
                <button
                  key={pref}
                  type="button"
                  id={`pref-table-${pref.toLowerCase()}`}
                  onClick={() => setSelectedTablePreference(pref)}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                    selectedTablePreference === pref
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
                  }`}
                >
                  {pref === 'ANY' ? 'Any Free Table' : pref === 'MINI1' ? 'Mini 1 Only' : 'Mini 2 Only'}
                </button>
              ))}
            </div>
          </div>

          {/* Customer Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs uppercase font-bold text-slate-500 tracking-wider">
                Customer
              </label>
              <button
                type="button"
                onClick={() => setIsCreatingNew(!isCreatingNew)}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{isCreatingNew ? 'Search Existing' : '+ New Customer'}</span>
              </button>
            </div>

            {isCreatingNew ? (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <input
                  type="text"
                  required
                  placeholder="Customer Name..."
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <input
                  type="tel"
                  placeholder="Phone (Optional)..."
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Search existing customer..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />

                <div className="max-h-36 overflow-y-auto space-y-1 p-1 bg-slate-50 rounded-lg border border-slate-200">
                  {customers
                    .filter(c => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .slice(0, 8)
                    .map(c => (
                      <div
                        key={c.customer_id}
                        onClick={() => setSelectedCustomer(c)}
                        className={`p-2 rounded-lg cursor-pointer flex items-center justify-between text-xs ${
                          selectedCustomer?.customer_id === c.customer_id
                            ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200'
                            : 'text-slate-700 hover:bg-white'
                        }`}
                      >
                        <span>{c.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {c.lifetime_games || 0} games
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Optional Note */}
          <div>
            <label className="block text-xs uppercase font-bold text-slate-500 tracking-wider mb-1">
              Note (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Arrived with group of 3"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              id="confirm-add-waiting-btn"
              disabled={isSubmitting || (!selectedCustomer && !newName.trim())}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-all shadow-sm flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{isSubmitting ? 'ADDING...' : 'ADD TO QUEUE'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
