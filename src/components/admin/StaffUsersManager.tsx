/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Staff Users & PIN Password Manager
 */

import React, { useEffect, useState } from 'react';
import { UserCheck, UserPlus, Shield, User, KeyRound, Edit2, Check, AlertCircle } from 'lucide-react';
import { Modal } from '../common/Modal.tsx';
import { User as StaffUser, UserRole } from '../../types.ts';
import { api } from '../../lib/api.ts';

export const StaffUsersManager: React.FC = () => {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);

  // Form states
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [role, setRole] = useState<UserRole>('WORKER');
  const [pin, setPin] = useState<string>('');
  const [editPin, setEditPin] = useState<string>('');
  const [editRole, setEditRole] = useState<UserRole>('WORKER');
  const [editActive, setEditActive] = useState<boolean>(true);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setIsSubmitting(true);
      setMessage(null);
      const generatedEmail = email.trim() || `${name.trim().toLowerCase().replace(/\s+/g, '.')}@extrablack.ma`;
      await api.createUser({
        name: name.trim(),
        email: generatedEmail,
        role,
        pin: pin.trim() || undefined,
      });

      setIsAddModalOpen(false);
      setName('');
      setEmail('');
      setPin('');
      setRole('WORKER');
      await fetchUsers();
      setMessage({ type: 'success', text: `Staff member "${name.trim()}" created successfully.` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to create user' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (u: StaffUser) => {
    setEditingUser(u);
    setEditPin(u.pin || '');
    setEditRole(u.role);
    setEditActive(u.active);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      setIsSubmitting(true);
      setMessage(null);
      await api.updateUser(editingUser.user_id, {
        role: editRole,
        active: editActive,
        pin: editPin.trim() || undefined,
      });

      setEditingUser(null);
      await fetchUsers();
      setMessage({ type: 'success', text: `Password / PIN updated for ${editingUser.name}.` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update user' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {message && (
        <div
          className={`p-3 rounded-xl flex items-center gap-2 text-xs font-semibold ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
          }`}
        >
          {message.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="font-bold text-sm text-white uppercase tracking-wider">Staff &amp; Access Controls</h4>
          <p className="text-xs text-neutral-400 mt-0.5">Manage workers, admin roles, and login PIN passwords</p>
        </div>

        <button
          type="button"
          id="open-add-staff-btn"
          onClick={() => {
            setName('');
            setEmail('');
            setPin('');
            setRole('WORKER');
            setIsAddModalOpen(true);
          }}
          className="py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98]"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Staff Member</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {users.map(u => (
          <div
            key={u.user_id}
            id={`staff-card-${u.user_id.toLowerCase()}`}
            className="p-4 bg-neutral-900/90 rounded-2xl border border-neutral-800 space-y-3 shadow-sm hover:border-neutral-700 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    u.role === 'ADMIN'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-neutral-800 text-neutral-300'
                  }`}
                >
                  {u.role === 'ADMIN' ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>
                <div>
                  <div className="font-bold text-sm text-white">{u.name}</div>
                  <div className="text-[11px] text-neutral-400 font-mono">{u.role}</div>
                </div>
              </div>

              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                  u.active
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-neutral-800 text-neutral-500 border border-neutral-700'
                }`}
              >
                {u.active ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-neutral-800/80">
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                <KeyRound className="w-3.5 h-3.5 text-neutral-500" />
                {u.pin ? (
                  <span className="font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                    PIN: {u.pin}
                  </span>
                ) : (
                  <span className="text-neutral-500 italic">No PIN set</span>
                )}
              </div>

              <button
                type="button"
                id={`edit-staff-${u.user_id.toLowerCase()}`}
                onClick={() => openEditModal(u)}
                className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-white font-medium text-xs rounded-lg transition-colors flex items-center gap-1"
              >
                <Edit2 className="w-3 h-3 text-neutral-400" />
                <span>Set PIN</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Staff Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Staff Member"
        subtitle="Register a new team member and set their login PIN"
        maxWidth="md"
      >
        <form onSubmit={handleAddUser} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-neutral-300 mb-1.5">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              id="new-staff-name"
              placeholder="e.g. Yassin"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-300 mb-1.5">
              Login PIN / Password (4 to 6 Digits)
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              id="new-staff-pin"
              placeholder="e.g. 1998 or 2026"
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono tracking-widest placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
            <p className="text-[11px] text-neutral-400 mt-1">
              Used on the login screen keypad to log into the terminal.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-300 mb-1.5">Email (Optional)</label>
            <input
              type="email"
              id="new-staff-email"
              placeholder="yassin@extrablack.ma"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-300 mb-1.5">Role</label>
            <select
              value={role}
              id="new-staff-role"
              onChange={e => setRole(e.target.value as UserRole)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            >
              <option value="WORKER">WORKER (Standard Cashier &amp; Matches)</option>
              <option value="ADMIN">ADMIN (Full Access &amp; Reports)</option>
            </select>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              id="submit-create-staff-btn"
              disabled={isSubmitting || !name.trim()}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold text-xs rounded-xl shadow-sm transition-all"
            >
              {isSubmitting ? 'Creating...' : 'Create Staff Member'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Staff & PIN Modal */}
      {editingUser && (
        <Modal
          isOpen={true}
          onClose={() => setEditingUser(null)}
          title={`Edit ${editingUser.name}`}
          subtitle="Set login PIN password and permissions"
          maxWidth="md"
        >
          <form onSubmit={handleUpdateUser} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                Staff Name
              </label>
              <input
                type="text"
                disabled
                value={editingUser.name}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-400 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                Login PIN / Password (4 to 6 Digits)
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                id="edit-staff-pin"
                placeholder="e.g. 1998 or 2026"
                value={editPin}
                onChange={e => setEditPin(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono tracking-widest placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
              <p className="text-[11px] text-neutral-400 mt-1">
                Enter a 4 to 6-digit numeric PIN for {editingUser.name} to enter on the login screen.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1.5">Role</label>
              <select
                value={editRole}
                id="edit-staff-role"
                onChange={e => setEditRole(e.target.value as UserRole)}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              >
                <option value="WORKER">WORKER (Standard Cashier &amp; Matches)</option>
                <option value="ADMIN">ADMIN (Full Access &amp; Reports)</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="edit-staff-active"
                checked={editActive}
                onChange={e => setEditActive(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 bg-neutral-900 border-neutral-700 focus:ring-amber-500/20"
              />
              <label htmlFor="edit-staff-active" className="text-xs font-medium text-neutral-300">
                Account is Active (can log in)
              </label>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="submit-update-staff-btn"
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold text-xs rounded-xl shadow-sm transition-all"
              >
                {isSubmitting ? 'Saving...' : 'Save Password / PIN'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
