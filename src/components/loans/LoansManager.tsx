/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Loans Manager Component
 */

import React, { useEffect, useState } from 'react';
import {
  CreditCard,
  Search,
  CheckCircle2,
  Clock,
  User,
  DollarSign,
  AlertCircle,
  XCircle,
  Filter,
  Trash2,
} from 'lucide-react';
import { Modal } from '../common/Modal.tsx';
import { DeleteMistakeModal } from '../common/DeleteMistakeModal.tsx';
import { Loan } from '../../types.ts';
import { formatDate, formatDateTime, formatTime } from '../../lib/dateUtils.ts';
import { useAuth } from '../../lib/authContext.tsx';
import { useTranslation } from '../../lib/i18n/index.tsx';
import { api } from '../../lib/api.ts';
import { useFirestoreRealtimeStream } from '../../lib/useFirestoreStream.ts';

interface LoansManagerProps {
  onLoanUpdated?: () => void;
}

export const LoansManager: React.FC<LoansManagerProps> = ({ onLoanUpdated }) => {
  const { isAdmin } = useAuth();
  const { t } = useTranslation();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [activeTab, setActiveTab] = useState<'ALL' | 'OPEN' | 'PAID' | 'CANCELLED'>('OPEN');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Settlement Modal State
  const [selectedLoanToPay, setSelectedLoanToPay] = useState<Loan | null>(null);
  const [isPaying, setIsPaying] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Mistake Loan Deletion State (Password 753159 or Admin)
  const [selectedLoanToCancel, setSelectedLoanToCancel] = useState<Loan | null>(null);

  const fetchLoans = async () => {
    try {
      setIsLoading(true);
      const data = await api.getLoans();
      setLoans(data);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useFirestoreRealtimeStream(() => {
    if (!selectedLoanToPay && !selectedLoanToCancel) {
      fetchLoans();
    }
  });

  useEffect(() => {
    fetchLoans();
  }, []);

  const openLoans = loans.filter(l => l.status === 'OPEN');
  const totalOpenAmount = openLoans.reduce((sum, l) => sum + l.amount, 0);
  const paidLoans = loans.filter(l => l.status === 'PAID');
  const totalPaidAmount = paidLoans.reduce((sum, l) => sum + l.amount, 0);

  const filteredLoans = loans.filter(l => {
    if (activeTab !== 'ALL' && l.status !== activeTab) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      l.player_name.toLowerCase().includes(q) ||
      l.amount.toString().includes(q) ||
      l.loan_id.toLowerCase().includes(q)
    );
  });

  const handleConfirmPayment = async () => {
    if (!selectedLoanToPay) return;
    try {
      setIsPaying(true);
      setErrorMessage(null);
      await api.payLoan(selectedLoanToPay.loan_id);
      setSelectedLoanToPay(null);
      await fetchLoans();
      onLoanUpdated?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to settle loan');
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Outstanding Open Loans */}
        <div className="p-5 bg-neutral-900/80 rounded-2xl border border-amber-500/30">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-amber-400">{t('unpaidLoans')}</span>
            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-mono text-amber-400 mt-2">
            {totalOpenAmount} <span className="text-lg text-amber-300">{t('dh')}</span>
          </div>
          <div className="text-xs text-neutral-400 mt-1">{openLoans.length} {t('openLoans')}</div>
        </div>

        {/* Total Collected Loans */}
        <div className="p-5 bg-neutral-900/80 rounded-2xl border border-emerald-500/30">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-emerald-400">{t('loansCollected')}</span>
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-mono text-emerald-400 mt-2">
            {totalPaidAmount} <span className="text-lg text-emerald-300">{t('dh')}</span>
          </div>
          <div className="text-xs text-neutral-400 mt-1">{paidLoans.length} {t('paidLoans')}</div>
        </div>

        {/* Loan Policy Info */}
        <div className="p-5 bg-neutral-900/80 rounded-2xl border border-neutral-800">
          <div className="text-xs uppercase font-bold tracking-wider text-neutral-400">{t('loansHistory')}</div>
          <p className="text-xs text-neutral-300 mt-2 leading-relaxed">
            {t('loansHistory')} • {loans.length} {t('allLoans')}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex items-center p-1 bg-neutral-900 rounded-xl border border-neutral-800 overflow-x-auto">
          {(['OPEN', 'PAID', 'ALL', 'CANCELLED'] as const).map(tab => (
            <button
              key={tab}
              id={`loans-tab-${tab.toLowerCase()}`}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab
                  ? 'bg-amber-500 text-black shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {tab === 'OPEN' ? `${t('openLoans')} (${openLoans.length})` : tab === 'PAID' ? t('paidLoans') : tab === 'ALL' ? t('allLoans') : t('cancelled')}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 rtl:left-auto rtl:right-3 top-3" />
          <input
            type="text"
            id="loans-search-input"
            placeholder={t('searchPlayer')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-4 rtl:pl-4 rtl:pr-9 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Loans List */}
      <div className="space-y-2.5">
        {filteredLoans.length === 0 ? (
          <div className="p-12 text-center bg-neutral-900/40 rounded-2xl border border-neutral-800/80">
            <CreditCard className="w-10 h-10 text-neutral-600 mx-auto mb-2" />
            <div className="text-base font-semibold text-neutral-300">{t('noOpenLoans')}</div>
          </div>
        ) : (
          filteredLoans.map(loan => {
            const isOpen = loan.status === 'OPEN';
            const isPaid = loan.status === 'PAID';

            return (
              <div
                key={loan.loan_id}
                id={`loan-row-${loan.loan_id.toLowerCase()}`}
                className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  isOpen
                    ? 'bg-neutral-900/90 border-amber-500/30 hover:border-amber-500/50'
                    : 'bg-neutral-900/40 border-neutral-800'
                }`}
              >
                {/* Left: Customer & Details */}
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                      isOpen
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : isPaid
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-neutral-800 text-neutral-400'
                    }`}
                  >
                    <User className="w-5 h-5" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-white">{loan.player_name}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          isOpen
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : isPaid
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-neutral-800 text-neutral-400'
                        }`}
                      >
                        {isOpen ? t('openLoans') : isPaid ? t('paid') : loan.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-neutral-400 font-mono mt-1">
                      <span>{t('created')}: {formatDateTime(loan.created_at)}</span>
                      {loan.paid_at && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-400 font-semibold">
                            {t('paid')}: {formatDateTime(loan.paid_at)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Amount & Actions */}
                <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4">
                  <div className="text-right rtl:text-left">
                    <div className="text-2xl font-extrabold font-mono text-white">
                      {loan.amount} <span className="text-sm text-amber-400">{t('dh')}</span>
                    </div>
                    {loan.notes && <div className="text-[11px] text-neutral-500">{loan.notes}</div>}
                  </div>

                  {isOpen && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        id={`mark-paid-btn-${loan.loan_id.toLowerCase()}`}
                        onClick={() => setSelectedLoanToPay(loan)}
                        className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{t('markAsPaid')}</span>
                      </button>

                      {/* Cancel / Mistake Delete (Admin only - hidden from employees) */}
                      {isAdmin && (
                        <button
                          type="button"
                          id={`cancel-loan-btn-${loan.loan_id.toLowerCase()}`}
                          onClick={() => setSelectedLoanToCancel(loan)}
                          className="py-2 px-2.5 bg-neutral-800 hover:bg-rose-950 text-neutral-400 hover:text-rose-400 text-xs rounded-xl border border-neutral-700 transition-colors cursor-pointer"
                          title={t('startedByMistake')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Settle / Pay Loan Modal */}
      <Modal
        isOpen={!!selectedLoanToPay}
        onClose={() => setSelectedLoanToPay(null)}
        title={t('confirmPayment')}
        subtitle={t('settleDebt')}
        maxWidth="sm"
      >
        {selectedLoanToPay && (
          <div className="space-y-4">
            {errorMessage && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs">
                {errorMessage}
              </div>
            )}

            <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2 text-center">
              <div className="text-xs uppercase font-bold text-neutral-400">{t('payer')}</div>
              <div className="text-lg font-bold text-white">{selectedLoanToPay.player_name}</div>
              <div className="text-xs uppercase font-bold text-neutral-400 pt-2">{t('loan')}</div>
              <div className="text-3xl font-extrabold font-mono text-emerald-400">
                {selectedLoanToPay.amount} <span className="text-base text-emerald-300">{t('dh')}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedLoanToPay(null)}
                className="py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-xs rounded-xl cursor-pointer"
              >
                {t('cancel')}
              </button>

              <button
                type="button"
                id="confirm-loan-payment-btn"
                disabled={isPaying}
                onClick={handleConfirmPayment}
                className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isPaying ? t('saving') : t('confirmPayment')}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Mistake Removal Modal for Loan (PIN 753159) */}
      {selectedLoanToCancel && (
        <DeleteMistakeModal
          isOpen={!!selectedLoanToCancel}
          onClose={() => setSelectedLoanToCancel(null)}
          recordIdentifier={`Loan: ${selectedLoanToCancel.player_name} (${selectedLoanToCancel.amount} DH)`}
          recordType="LOAN"
          onConfirm={async (reason, password) => {
            await api.cancelLoan(selectedLoanToCancel.loan_id, reason, password);
            setSelectedLoanToCancel(null);
            await fetchLoans();
            onLoanUpdated?.();
          }}
        />
      )}
    </div>
  );
};

