/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Daily Closing Shift Ledger & Financial Audit
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Lock,
  AlertTriangle,
  CheckCircle2,
  Printer,
  Download,
  ArrowRight,
} from 'lucide-react';
import { Modal } from '../common/Modal.tsx';
import { DailySession, Game, Loan } from '../../types.ts';
import { formatDate, formatTime } from '../../lib/dateUtils.ts';
import { api } from '../../lib/api.ts';
import { useAuth } from '../../lib/authContext.tsx';

interface CloseSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: DailySession | null;
  onSessionClosed: () => void;
}

export const CloseSessionModal: React.FC<CloseSessionModalProps> = ({
  isOpen,
  onClose,
  session,
  onSessionClosed,
}) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<string>('');
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [isLoadingInvoice, setIsLoadingInvoice] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isClosedSuccess, setIsClosedSuccess] = useState<boolean>(false);

  // Ledger Data
  const [invoiceSession, setInvoiceSession] = useState<DailySession | null>(session);
  const [games, setGames] = useState<Game[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loanPeople, setLoanPeople] = useState<{
    customerId: string;
    playerName: string;
    totalLoan: number;
    loans: Loan[];
  }[]>([]);
  const [printStatus, setPrintStatus] = useState<'processing' | 'opened' | 'downloaded' | 'printed' | null>(null);

  // Load complete invoice data whenever modal opens
  const loadInvoiceData = useCallback(async () => {
    if (!session) return;
    try {
      setIsLoadingInvoice(true);
      setErrorMessage(null);
      const data = await api.getSessionInvoice(session.session_id);
      setInvoiceSession(data.session);
      setGames(data.games || []);
      setLoans(data.loans || []);
      setLoanPeople(data.loanPeople || []);
    } catch {
      setInvoiceSession(session);
    } finally {
      setIsLoadingInvoice(false);
    }
  }, [session]);

  useEffect(() => {
    if (isOpen) {
      setIsClosedSuccess(false);
      setErrorMessage(null);
      setNotes('');
      loadInvoiceData();
    }
  }, [isOpen, loadInvoiceData]);

  const activeSessionData = invoiceSession || session;

  // Check if any games are currently running
  const runningGames = games.filter(g => g.status === 'RUNNING' && !g.deleted);
  const hasRunningGames = runningGames.length > 0;

  // Handle Close Daily Session
  const handleCloseSession = async () => {
    if (!activeSessionData) return;
    if (hasRunningGames) {
      setErrorMessage(
        'Cannot close daily session while games are still in play. Please end or cancel all active games first.'
      );
      return;
    }

    try {
      setIsClosing(true);
      setErrorMessage(null);

      const result = await api.closeSession({
        sessionId: activeSessionData.session_id,
        notes: notes.trim() || undefined,
      });

      if (result.session) {
        setInvoiceSession(result.session);
      }
      if (result.games) {
        setGames(result.games);
      }
      if (result.loans) {
        setLoans(result.loans);
      }
      if (result.loanPeople) {
        setLoanPeople(result.loanPeople);
      }

      setIsClosedSuccess(true);
      onSessionClosed();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to close daily session');
    } finally {
      setIsClosing(false);
    }
  };

  // Helper to safely escape HTML attributes and text
  const escapeHtml = (str: string) =>
    String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  // Generate self-contained standalone printable HTML document matching the exact requested template
  const generateInvoiceHtml = useCallback(() => {
    if (!activeSessionData) return '';

    const durHours = Math.floor((activeSessionData.total_duration_minutes || 0) / 60);
    const durMins = (activeSessionData.total_duration_minutes || 0) % 60;
    const cashierName = user?.name || user?.email || 'Super Administrator';

    const loanRowsHtml = loanPeople.length === 0
      ? `<tr><td colspan="5" style="text-align:center; color:var(--ink-soft); padding:16px;">No loans were created during this session. All games were paid in cash.</td></tr>`
      : loanPeople.map(person => {
          const matchDetail = person.loans.map(l => l.notes || 'Snooker game loan').join(' &middot; ');
          const loanTime = person.loans[0]?.created_at ? formatTime(person.loans[0].created_at) : '—';
          return `            <tr><td class="name">${escapeHtml(person.playerName)}</td><td class="num amt-cell">${person.totalLoan} DH</td><td class="reason">${escapeHtml(matchDetail)}</td><td class="mono">${loanTime}</td><td class="num"><span class="badge unpaid">Unpaid</span></td></tr>`;
        }).join('\n');

    const gameRowsHtml = games.length === 0
      ? `<tr><td colspan="6" style="text-align:center; color:var(--ink-soft); padding:16px;">No games recorded during this session yet.</td></tr>`
      : games.map(g => {
          const gameNum = escapeHtml(g.game_id.replace('GAME-', ''));
          const tableBadgeClass = g.table_id === 'MINI1' ? 'table1' : 'table2';
          const tableName = g.table_id === 'MINI1' ? 'Mini 1' : 'Mini 2';
          const isPaid = g.payment_status === 'PAID' || g.payment_status === 'LOAN_PAID';
          const isPayLater = g.payment_status === 'PAY_LATER';
          const paymentBadgeClass = isPaid ? 'paid' : isPayLater ? 'pay-later' : 'unpaid';
          const paymentText = isPaid ? 'Paid' : isPayLater ? 'Pay Later (Salle)' : 'Loan';
          return `            <tr><td class="mono reason">${gameNum}</td><td><span class="badge ${tableBadgeClass}">${tableName}</span></td><td class="name">${escapeHtml(g.player_name)}</td><td class="num mono">${g.duration_minutes || 0}m</td><td class="num amt-cell">${g.final_price} DH</td><td class="num"><span class="badge ${paymentBadgeClass}">${paymentText}</span></td></tr>`;
        }).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>EXTRABLACK Shift Ledger</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Work+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#f1ebda;
    --surface:#fffdf6;
    --surface-2:#eae1c8;
    --ink:#201a13;
    --ink-soft:#71675696;
    --ink-soft:#726757;
    --line:#ddd0ac;
    --felt:#1f5c47;
    --felt-strong:#123c2f;
    --felt-bg:#e2ede6;
    --rust:#a04b23;
    --rust-bg:#f5e4d3;
    --brass:#a8791f;
    --shadow: 0 10px 30px -12px rgba(18,40,32,0.25);
  }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){
      --bg:#0f1e18;
      --surface:#152922;
      --surface-2:#1b3329;
      --ink:#f0e9d8;
      --ink-soft:#aab8ae;
      --line:#2b4739;
      --felt:#5cab86;
      --felt-strong:#0b1a15;
      --felt-bg:#1a3327;
      --rust:#e2985f;
      --rust-bg:#3a2617;
      --brass:#dcb45c;
      --shadow: 0 10px 30px -12px rgba(0,0,0,0.5);
    }
  }
  :root[data-theme="dark"]{
    --bg:#0f1e18;
    --surface:#152922;
    --surface-2:#1b3329;
    --ink:#f0e9d8;
    --ink-soft:#aab8ae;
    --line:#2b4739;
    --felt:#5cab86;
    --felt-strong:#0b1a15;
    --felt-bg:#1a3327;
    --rust:#e2985f;
    --rust-bg:#3a2617;
    --brass:#dcb45c;
    --shadow: 0 10px 30px -12px rgba(0,0,0,0.5);
  }

  *{ box-sizing:border-box; }
  body{
    margin:0;
    background:var(--bg);
    color:var(--ink);
    font-family:'Work Sans', -apple-system, 'Segoe UI', sans-serif;
    padding:32px 18px 60px;
  }
  .mono{ font-family:'JetBrains Mono', ui-monospace, monospace; font-variant-numeric:tabular-nums; }
  .eyebrow{
    font-family:'Oswald', 'Work Sans', sans-serif;
    text-transform:uppercase;
    letter-spacing:.09em;
    font-weight:600;
    font-size:11px;
    color:var(--ink-soft);
  }

  /* action bar */
  .bar{
    max-width:800px; margin:0 auto 18px;
    display:flex; align-items:center; justify-content:space-between; gap:12px;
    background:var(--felt-strong); color:#f0ead9;
    padding:10px 16px; border-radius:10px;
  }
  .bar .tag{ font-family:'JetBrains Mono',monospace; font-size:12px; letter-spacing:.03em; opacity:.85; }
  .btn-print{
    background:var(--brass); color:#241a06; border:none;
    font-family:'Oswald',sans-serif; font-weight:600; letter-spacing:.04em; text-transform:uppercase;
    font-size:12.5px; padding:9px 18px; border-radius:7px; cursor:pointer;
  }
  .btn-print:hover{ filter:brightness(1.06); }
  .btn-print:focus-visible{ outline:2px solid #f0ead9; outline-offset:2px; }

  /* document */
  .doc{
    max-width:800px; margin:0 auto;
    background:var(--surface);
    border:1px solid var(--line);
    border-radius:14px;
    box-shadow:var(--shadow);
    padding:34px 34px 30px;
  }

  .letterhead{
    display:flex; align-items:flex-start; justify-content:space-between; gap:20px;
    padding-bottom:20px; border-bottom:2px solid var(--felt);
  }
  .brand{ display:flex; align-items:center; gap:12px; }
  .brand svg{ flex:none; }
  .brand h1{
    font-family:'Oswald', sans-serif; font-weight:700; text-transform:uppercase;
    font-size:22px; letter-spacing:.03em; margin:0; text-wrap:balance;
  }
  .brand p{ margin:4px 0 0; font-size:12.5px; color:var(--ink-soft); letter-spacing:.02em; }
  .doc-id{ text-align:right; }
  .doc-id .code{
    font-family:'JetBrains Mono',monospace; font-weight:700; font-size:13px;
    background:var(--felt-bg); color:var(--felt-strong); padding:5px 10px; border-radius:6px;
    display:inline-block;
  }
  :root[data-theme="dark"] .doc-id .code, @media (prefers-color-scheme: dark){ :root:not([data-theme="light"]) .doc-id .code{ color:#eafff1; } }
  .doc-id .date{ margin-top:6px; font-size:12px; color:var(--ink-soft); }
  .status-pill{
    margin-top:6px; display:inline-flex; align-items:center; gap:6px;
    font-size:10.5px; font-weight:600; letter-spacing:.06em; text-transform:uppercase;
    padding:3px 9px; border-radius:100px; background:var(--rust-bg); color:var(--rust);
  }
  .status-pill::before{ content:""; width:6px; height:6px; border-radius:50%; background:currentColor; }

  /* meta strip */
  .meta{
    display:grid; grid-template-columns:repeat(4,1fr); gap:1px;
    background:var(--line); border:1px solid var(--line); border-radius:10px; overflow:hidden;
    margin:22px 0 26px;
  }
  .meta div{ background:var(--surface-2); padding:11px 14px; }
  .meta span{ display:block; }
  .meta .k{ font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:var(--ink-soft); font-weight:600; margin-bottom:3px; }
  .meta .v{ font-size:13.5px; font-weight:600; }

  /* stat trio */
  .stats{ display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:22px; }
  .stat{
    border-radius:12px; padding:16px 16px 14px; border:1.5px solid var(--line);
  }
  .stat .eyebrow{ display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
  .stat .amt{ font-family:'JetBrains Mono',monospace; font-weight:700; font-size:28px; line-height:1; }
  .stat .amt small{ font-size:14px; font-weight:600; }
  .stat .note{ margin-top:7px; font-size:11.5px; color:var(--ink-soft); }
  .stat.paid{ background:var(--felt-bg); border-color:var(--felt); }
  .stat.paid .eyebrow, .stat.paid .amt{ color:var(--felt-strong); }
  :root[data-theme="dark"] .stat.paid .eyebrow, :root[data-theme="dark"] .stat.paid .amt{ color:#c9f0da; }
  @media (prefers-color-scheme: dark){ :root:not([data-theme="light"]) .stat.paid .eyebrow, :root:not([data-theme="light"]) .stat.paid .amt{ color:#c9f0da; } }
  .stat.loan{ background:var(--rust-bg); border-color:var(--rust); }
  .stat.loan .eyebrow, .stat.loan .amt{ color:var(--rust); }
  .stat.net{ background:var(--felt-strong); border-color:var(--felt-strong); color:#f0ead9; }
  .stat.net .eyebrow{ color:#cddfd3; }
  .stat.net .amt{ color:var(--brass); font-size:30px; }
  .stat.net .note{ color:#a9bfb0; font-family:'JetBrains Mono',monospace; font-size:11px; }

  /* secondary grid */
  .secondary{ display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:28px; }
  .cell{ background:var(--surface-2); border-radius:9px; padding:10px 12px; }
  .cell .k{ font-size:9.5px; text-transform:uppercase; letter-spacing:.07em; color:var(--ink-soft); font-weight:600; }
  .cell .v{ font-family:'JetBrains Mono',monospace; font-weight:700; font-size:16px; margin-top:3px; }
  .cell .v.felt{ color:var(--felt); }
  .cell .v small{ font-size:11px; font-weight:600; }
  .cell .tables .row{ display:flex; justify-content:space-between; font-family:'JetBrains Mono',monospace; font-size:12px; font-weight:600; margin-top:2px; }
  .cell .tables .row span:last-child{ color:var(--felt); }

  /* sections */
  section.block{ margin-bottom:26px; }
  .block-head{ display:flex; align-items:baseline; justify-content:space-between; gap:12px; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid var(--line); }
  .block-head h2{ font-family:'Oswald',sans-serif; font-size:14px; text-transform:uppercase; letter-spacing:.05em; margin:0; }
  .block-head .tally{ font-family:'JetBrains Mono',monospace; font-size:12px; color:var(--ink-soft); }

  .twrap{ overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
  table{ width:100%; border-collapse:collapse; min-width:560px; }
  thead th{
    text-align:left; font-family:'Oswald',sans-serif; font-size:10.5px; text-transform:uppercase;
    letter-spacing:.06em; color:var(--ink-soft); font-weight:600;
    background:var(--surface-2); padding:9px 12px; border-bottom:1px solid var(--line);
  }
  th.num, td.num{ text-align:right; }
  tbody td{ padding:9px 12px; font-size:13px; border-bottom:1px solid var(--line); }
  tbody tr:last-child td{ border-bottom:none; }
  tbody tr:nth-child(even){ background:color-mix(in srgb, var(--surface-2) 45%, transparent); }
  td.name{ font-weight:600; }
  td.reason{ color:var(--ink-soft); font-size:12px; }
  .amt-cell{ font-family:'JetBrains Mono',monospace; font-weight:700; }
  .badge{ display:inline-block; font-size:10px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; padding:2.5px 8px; border-radius:5px; }
  .badge.unpaid{ background:var(--rust-bg); color:var(--rust); }
  .badge.paid{ background:var(--felt-bg); color:var(--felt-strong); }
  :root[data-theme="dark"] .badge.paid{ color:#c9f0da; }
  @media (prefers-color-scheme: dark){ :root:not([data-theme="light"]) .badge.paid{ color:#c9f0da; } }
  .badge.table1{ background:var(--rust-bg); color:var(--rust); }
  .badge.table2{ background:var(--felt-bg); color:var(--felt-strong); }
  .badge.pay-later{ background:#e0f2fe; color:#0369a1; }
  :root[data-theme="dark"] .badge.table2{ color:#c9f0da; }
  :root[data-theme="dark"] .badge.pay-later{ background:#082f49; color:#7dd3fc; }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]) .badge.table2{ color:#c9f0da; }
    :root:not([data-theme="light"]) .badge.pay-later{ background:#082f49; color:#7dd3fc; }
  }

  .games-scroll{ max-height:340px; overflow-y:auto; }
  .games-scroll thead th{ position:sticky; top:0; }

  .signoff{ display:none; }

  .foot{ margin-top:4px; font-size:11px; color:var(--ink-soft); text-align:center; }

  @media (max-width:640px){
    .stats{ grid-template-columns:1fr; }
    .secondary{ grid-template-columns:repeat(2,1fr); }
    .meta{ grid-template-columns:repeat(2,1fr); }
    .doc{ padding:22px 16px; }
    .letterhead{ flex-direction:column; }
    .doc-id{ text-align:left; }
  }

  @media print{
    @page{ size:auto; margin:9mm; }
    body{ background:#fff !important; padding:0 !important; color:#161310 !important; }
    .no-print{ display:none !important; }
    .doc{ box-shadow:none !important; border-radius:0 !important; border:none !important; max-width:100% !important; padding:0 !important; }
    .stat.net{ background:#123c2f !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .stat.paid, .badge.paid{ background:#e2ede6 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .stat.loan, .badge.unpaid{ background:#f5e4d3 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .games-scroll{ max-height:none !important; overflow:visible !important; }
    .signoff{ display:grid !important; grid-template-columns:1fr 1fr; gap:40px; margin-top:26px; padding-top:20px; border-top:1px solid #ccc; }
    .signoff .line{ margin-top:34px; border-bottom:1px solid #161310; }
    .signoff .label{ font-family:'Oswald',sans-serif; font-size:11px; text-transform:uppercase; letter-spacing:.05em; }
    .signoff .right{ text-align:right; }
  }
</style>
</head>
<body>

  <div class="bar no-print">
    <span class="tag">EXTRABLACK &middot; ${escapeHtml(activeSessionData.session_id)} &middot; ${activeSessionData.status === 'CLOSED' ? 'closed shift' : 'closing preview'}</span>
    <button class="btn-print" onclick="window.print()">Print / Save as PDF</button>
  </div>

  <div class="doc">

    <div class="letterhead">
      <div class="brand">
        <svg width="34" height="30" viewBox="0 0 34 30" fill="none" aria-hidden="true">
          <circle cx="17" cy="4" r="3.4" fill="var(--felt)"/>
          <circle cx="10" cy="13" r="3.4" fill="var(--felt)"/>
          <circle cx="24" cy="13" r="3.4" fill="var(--felt)"/>
          <circle cx="3" cy="22" r="3.4" fill="var(--felt)"/>
          <circle cx="17" cy="22" r="3.4" fill="var(--felt)"/>
          <circle cx="31" cy="22" r="3.4" fill="var(--felt)"/>
        </svg>
        <div>
          <h1>Extrablack Snooker Lounge</h1>
          <p>Daily Financial Closing &amp; Shift Audit</p>
        </div>
      </div>
      <div class="doc-id">
        <span class="code">${escapeHtml(activeSessionData.session_id)}</span>
        <div class="date mono">${formatDate(activeSessionData.date)}</div>
        <div class="status-pill">${activeSessionData.status === 'CLOSED' ? 'Closed &middot; archived' : 'Open &middot; closing preview'}</div>
      </div>
    </div>

    <div class="meta">
      <div><span class="k">Session opened</span><span class="v mono">${formatTime(activeSessionData.opened_at)}</span></div>
      <div><span class="k">Closed at</span><span class="v mono">${activeSessionData.closed_at ? formatTime(activeSessionData.closed_at) : 'In progress'}</span></div>
      <div><span class="k">Cashier / Manager</span><span class="v">${escapeHtml(cashierName)}</span></div>
      <div><span class="k">Tables in play</span><span class="v mono">Mini 1 &middot; Mini 2</span></div>
    </div>

    <div class="stats">
      <div class="stat paid">
        <div class="eyebrow"><span>Total cash paid</span></div>
        <div class="amt">${activeSessionData.total_paid} <small>DH</small></div>
        <div class="note">Actual cash collected in register</div>
      </div>
      <div class="stat loan">
        <div class="eyebrow"><span>Total loans created</span></div>
        <div class="amt">${activeSessionData.new_loans} <small>DH</small></div>
        <div class="note">Customer debts issued today</div>
      </div>
      <div class="stat net">
        <div class="eyebrow"><span>Le reste &middot; Espèce payé</span></div>
        <div class="amt">${activeSessionData.total_paid} <small>DH</small></div>
        <div class="note">Espèces en caisse (Recette &minus; Crédits)</div>
      </div>
    </div>

    <div class="secondary">
      <div class="cell"><div class="k">Total games</div><div class="v">${activeSessionData.total_games}</div></div>
      <div class="cell"><div class="k">Playing hours</div><div class="v felt">${durHours}<small>h</small> ${durMins}<small>m</small></div></div>
      <div class="cell"><div class="k">Old loans collected</div><div class="v">${activeSessionData.old_loans_collected || 0} <small>DH</small></div></div>
      <div class="cell">
        <div class="k">Table revenue</div>
        <div class="tables">
          <div class="row"><span>Mini 1</span><span>${activeSessionData.mini1_revenue || 0} DH</span></div>
          <div class="row"><span>Mini 2</span><span>${activeSessionData.mini2_revenue || 0} DH</span></div>
        </div>
      </div>
    </div>

    <section class="block">
      <div class="block-head">
        <h2>List of loan people &mdash; dettes &amp; cr&eacute;dits accord&eacute;s aujourd&#39;hui</h2>
        <span class="tally">total ${activeSessionData.new_loans} DH</span>
      </div>
      <div class="twrap">
        <table>
          <thead>
            <tr><th>Player</th><th class="num">Amount</th><th>Match detail</th><th>Time</th><th class="num">Status</th></tr>
          </thead>
          <tbody>
${loanRowsHtml}
          </tbody>
        </table>
      </div>
    </section>

    <section class="block">
      <div class="block-head">
        <h2>All-day game log</h2>
        <span class="tally">${games.length} completed games</span>
      </div>
      <div class="twrap games-scroll">
        <table>
          <thead>
            <tr><th>Game #</th><th>Table</th><th>Players</th><th class="num">Duration</th><th class="num">Price</th><th class="num">Payment</th></tr>
          </thead>
          <tbody>
${gameRowsHtml}
          </tbody>
        </table>
      </div>
    </section>

    <div class="signoff">
      <div><div class="label">Cashier / worker signature</div><div class="line"></div></div>
      <div class="right"><div class="label">Manager / administrator signature</div><div class="line"></div></div>
    </div>

    <p class="foot mono">Generated from Extrablack shift records &middot; ${escapeHtml(activeSessionData.session_id)} &middot; figures shown as recorded at export time</p>

  </div>

  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        try { window.print(); } catch(e) {}
      }, 350);
    });
  </script>
</body>
</html>`;
  }, [activeSessionData, games, loanPeople, user]);

  // Robust Print Handler (supports top window, new tab/popup, or direct HTML export)
  const handlePrint = useCallback(() => {
    if (!activeSessionData) return;
    setPrintStatus('processing');

    let isIframe = false;
    try {
      isIframe = window.self !== window.top;
    } catch {
      isIframe = true;
    }

    if (!isIframe) {
      try {
        window.print();
        setPrintStatus('printed');
        setTimeout(() => setPrintStatus(null), 3000);
        return;
      } catch (err) {
        console.warn('Native window.print() failed:', err);
      }
    }

    // In iframe or sandboxed preview, generate HTML and open in separate window
    const htmlContent = generateInvoiceHtml();
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);

    let popupWin: Window | null = null;
    try {
      popupWin = window.open(blobUrl, '_blank');
    } catch (e) {
      console.warn('Window popup blocked:', e);
    }

    if (popupWin) {
      setPrintStatus('opened');
      setTimeout(() => setPrintStatus(null), 4000);
    } else {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `EXTRABLACK-Shift-Ledger-${activeSessionData.session_id}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setPrintStatus('downloaded');
      setTimeout(() => setPrintStatus(null), 5000);
    }
  }, [activeSessionData, generateInvoiceHtml]);

  // Direct Invoice File Download Handler
  const handleDownloadInvoice = useCallback(() => {
    if (!activeSessionData) return;
    const htmlContent = generateInvoiceHtml();
    if (!htmlContent) return;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `EXTRABLACK-Shift-Ledger-${activeSessionData.session_id}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setPrintStatus('downloaded');
    setTimeout(() => setPrintStatus(null), 5000);
  }, [activeSessionData, generateInvoiceHtml]);

  if (!session || !activeSessionData) {
    return null;
  }

  const durHours = Math.floor((activeSessionData.total_duration_minutes || 0) / 60);
  const durMins = (activeSessionData.total_duration_minutes || 0) % 60;
  const cashierName = user?.name || user?.email || 'Super Administrator';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Daily Closing Shift Ledger & Financial Audit"
      subtitle={`Session record, debts & balance for ${activeSessionData.session_id}`}
      maxWidth="4xl"
    >
      <div className="space-y-4">
        {/* Scoped CSS Styles matching the requested template */}
        <style>{`
          .ledger-theme {
            --bg: #f1ebda;
            --surface: #fffdf6;
            --surface-2: #eae1c8;
            --ink: #201a13;
            --ink-soft: #726757;
            --line: #ddd0ac;
            --felt: #1f5c47;
            --felt-strong: #123c2f;
            --felt-bg: #e2ede6;
            --rust: #a04b23;
            --rust-bg: #f5e4d3;
            --brass: #a8791f;
            --shadow: 0 10px 30px -12px rgba(18,40,32,0.25);
            font-family: 'Work Sans', -apple-system, 'Segoe UI', sans-serif;
            color: var(--ink);
          }

          .ledger-theme .mono {
            font-family: 'JetBrains Mono', ui-monospace, monospace;
            font-variant-numeric: tabular-nums;
          }

          .ledger-theme .eyebrow {
            font-family: 'Oswald', 'Work Sans', sans-serif;
            text-transform: uppercase;
            letter-spacing: .09em;
            font-weight: 600;
            font-size: 11px;
            color: var(--ink-soft);
          }

          .ledger-theme .bar {
            max-width: 800px;
            margin: 0 auto 18px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            background: var(--felt-strong);
            color: #f0ead9;
            padding: 10px 16px;
            border-radius: 10px;
          }
          .ledger-theme .bar .tag {
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            letter-spacing: .03em;
            opacity: .85;
          }
          .ledger-theme .btn-print-top {
            background: var(--brass);
            color: #241a06;
            border: none;
            font-family: 'Oswald', sans-serif;
            font-weight: 600;
            letter-spacing: .04em;
            text-transform: uppercase;
            font-size: 12.5px;
            padding: 9px 18px;
            border-radius: 7px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: filter 0.15s ease;
          }
          .ledger-theme .btn-print-top:hover {
            filter: brightness(1.06);
          }

          .ledger-theme .doc {
            max-width: 800px;
            margin: 0 auto;
            background: var(--surface);
            border: 1px solid var(--line);
            border-radius: 14px;
            box-shadow: var(--shadow);
            padding: 34px 34px 30px;
          }

          .ledger-theme .letterhead {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 20px;
            padding-bottom: 20px;
            border-bottom: 2px solid var(--felt);
          }
          .ledger-theme .brand {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .ledger-theme .brand svg {
            flex: none;
          }
          .ledger-theme .brand h1 {
            font-family: 'Oswald', sans-serif;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 22px;
            letter-spacing: .03em;
            margin: 0;
            color: var(--ink);
          }
          .ledger-theme .brand p {
            margin: 4px 0 0;
            font-size: 12.5px;
            color: var(--ink-soft);
            letter-spacing: .02em;
          }
          .ledger-theme .doc-id {
            text-align: right;
          }
          .ledger-theme .doc-id .code {
            font-family: 'JetBrains Mono', monospace;
            font-weight: 700;
            font-size: 13px;
            background: var(--felt-bg);
            color: var(--felt-strong);
            padding: 5px 10px;
            border-radius: 6px;
            display: inline-block;
          }
          .ledger-theme .doc-id .date {
            margin-top: 6px;
            font-size: 12px;
            color: var(--ink-soft);
          }
          .ledger-theme .status-pill {
            margin-top: 6px;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 10.5px;
            font-weight: 600;
            letter-spacing: .06em;
            text-transform: uppercase;
            padding: 3px 9px;
            border-radius: 100px;
            background: var(--rust-bg);
            color: var(--rust);
          }
          .ledger-theme .status-pill::before {
            content: "";
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: currentColor;
          }

          .ledger-theme .meta {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 1px;
            background: var(--line);
            border: 1px solid var(--line);
            border-radius: 10px;
            overflow: hidden;
            margin: 22px 0 26px;
          }
          .ledger-theme .meta div {
            background: var(--surface-2);
            padding: 11px 14px;
          }
          .ledger-theme .meta span {
            display: block;
          }
          .ledger-theme .meta .k {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: .08em;
            color: var(--ink-soft);
            font-weight: 600;
            margin-bottom: 3px;
          }
          .ledger-theme .meta .v {
            font-size: 13.5px;
            font-weight: 600;
            color: var(--ink);
          }

          .ledger-theme .stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-bottom: 22px;
          }
          .ledger-theme .stat {
            border-radius: 12px;
            padding: 16px 16px 14px;
            border: 1.5px solid var(--line);
          }
          .ledger-theme .stat .eyebrow {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
          }
          .ledger-theme .stat .amt {
            font-family: 'JetBrains Mono', monospace;
            font-weight: 700;
            font-size: 28px;
            line-height: 1;
          }
          .ledger-theme .stat .amt small {
            font-size: 14px;
            font-weight: 600;
          }
          .ledger-theme .stat .note {
            margin-top: 7px;
            font-size: 11.5px;
            color: var(--ink-soft);
          }
          .ledger-theme .stat.paid {
            background: var(--felt-bg);
            border-color: var(--felt);
          }
          .ledger-theme .stat.paid .eyebrow,
          .ledger-theme .stat.paid .amt {
            color: var(--felt-strong);
          }
          .ledger-theme .stat.loan {
            background: var(--rust-bg);
            border-color: var(--rust);
          }
          .ledger-theme .stat.loan .eyebrow,
          .ledger-theme .stat.loan .amt {
            color: var(--rust);
          }
          .ledger-theme .stat.net {
            background: var(--felt-strong);
            border-color: var(--felt-strong);
            color: #f0ead9;
          }
          .ledger-theme .stat.net .eyebrow {
            color: #cddfd3;
          }
          .ledger-theme .stat.net .amt {
            color: var(--brass);
            font-size: 30px;
          }
          .ledger-theme .stat.net .note {
            color: #a9bfb0;
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
          }

          .ledger-theme .secondary {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 28px;
          }
          .ledger-theme .cell {
            background: var(--surface-2);
            border-radius: 9px;
            padding: 10px 12px;
          }
          .ledger-theme .cell .k {
            font-size: 9.5px;
            text-transform: uppercase;
            letter-spacing: .07em;
            color: var(--ink-soft);
            font-weight: 600;
          }
          .ledger-theme .cell .v {
            font-family: 'JetBrains Mono', monospace;
            font-weight: 700;
            font-size: 16px;
            margin-top: 3px;
            color: var(--ink);
          }
          .ledger-theme .cell .v.felt {
            color: var(--felt);
          }
          .ledger-theme .cell .v small {
            font-size: 11px;
            font-weight: 600;
          }
          .ledger-theme .cell .tables .row {
            display: flex;
            justify-content: space-between;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            font-weight: 600;
            margin-top: 2px;
          }
          .ledger-theme .cell .tables .row span:last-child {
            color: var(--felt);
          }

          .ledger-theme section.block {
            margin-bottom: 26px;
          }
          .ledger-theme .block-head {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--line);
          }
          .ledger-theme .block-head h2 {
            font-family: 'Oswald', sans-serif;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: .05em;
            margin: 0;
            color: var(--ink);
          }
          .ledger-theme .block-head .tally {
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            color: var(--ink-soft);
          }

          .ledger-theme .twrap {
            overflow-x: auto;
            border: 1px solid var(--line);
            border-radius: 10px;
          }
          .ledger-theme table {
            width: 100%;
            border-collapse: collapse;
            min-width: 560px;
          }
          .ledger-theme thead th {
            text-align: left;
            font-family: 'Oswald', sans-serif;
            font-size: 10.5px;
            text-transform: uppercase;
            letter-spacing: .06em;
            color: var(--ink-soft);
            font-weight: 600;
            background: var(--surface-2);
            padding: 9px 12px;
            border-bottom: 1px solid var(--line);
          }
          .ledger-theme th.num,
          .ledger-theme td.num {
            text-align: right;
          }
          .ledger-theme tbody td {
            padding: 9px 12px;
            font-size: 13px;
            border-bottom: 1px solid var(--line);
            color: var(--ink);
          }
          .ledger-theme tbody tr:last-child td {
            border-bottom: none;
          }
          .ledger-theme tbody tr:nth-child(even) {
            background: rgba(234, 225, 200, 0.45);
          }
          .ledger-theme td.name {
            font-weight: 600;
          }
          .ledger-theme td.reason {
            color: var(--ink-soft);
            font-size: 12px;
          }
          .ledger-theme .amt-cell {
            font-family: 'JetBrains Mono', monospace;
            font-weight: 700;
          }
          .ledger-theme .badge {
            display: inline-block;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: .04em;
            text-transform: uppercase;
            padding: 2.5px 8px;
            border-radius: 5px;
          }
          .ledger-theme .badge.unpaid {
            background: var(--rust-bg);
            color: var(--rust);
          }
          .ledger-theme .badge.paid {
            background: var(--felt-bg);
            color: var(--felt-strong);
          }
          .ledger-theme .badge.table1 {
            background: var(--rust-bg);
            color: var(--rust);
          }
          .ledger-theme .badge.table2 {
            background: var(--felt-bg);
            color: var(--felt-strong);
          }
          .ledger-theme .badge.pay-later {
            background: #e0f2fe;
            color: #0369a1;
          }

          .ledger-theme .games-scroll {
            max-height: 340px;
            overflow-y: auto;
          }
          .ledger-theme .games-scroll thead th {
            position: sticky;
            top: 0;
          }

          .ledger-theme .signoff {
            display: none;
          }

          .ledger-theme .foot {
            margin-top: 14px;
            font-size: 11px;
            color: var(--ink-soft);
            text-align: center;
          }

          @media (max-width: 640px) {
            .ledger-theme .stats {
              grid-template-columns: 1fr;
            }
            .ledger-theme .secondary {
              grid-template-columns: repeat(2, 1fr);
            }
            .ledger-theme .meta {
              grid-template-columns: repeat(2, 1fr);
            }
            .ledger-theme .doc {
              padding: 22px 16px;
            }
            .ledger-theme .letterhead {
              flex-direction: column;
            }
            .ledger-theme .doc-id {
              text-align: left;
            }
          }

          @media print {
            @page {
              size: auto;
              margin: 9mm;
            }
            html, body {
              background: #fff !important;
              padding: 0 !important;
              color: #161310 !important;
            }
            body * {
              visibility: hidden;
            }
            #printable-closing-invoice, #printable-closing-invoice * {
              visibility: visible;
            }
            #printable-closing-invoice {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              box-shadow: none !important;
              border-radius: 0 !important;
              border: none !important;
              padding: 0 !important;
              background: #fff !important;
            }
            .no-print {
              display: none !important;
            }
            .ledger-theme .stat.net {
              background: #123c2f !important;
              color: #f0ead9 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .ledger-theme .stat.paid,
            .ledger-theme .badge.paid {
              background: #e2ede6 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .ledger-theme .stat.loan,
            .ledger-theme .badge.unpaid {
              background: #f5e4d3 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .ledger-theme .games-scroll {
              max-height: none !important;
              overflow: visible !important;
            }
            .ledger-theme .signoff {
              display: grid !important;
              grid-template-columns: 1fr 1fr;
              gap: 40px;
              margin-top: 26px;
              padding-top: 20px;
              border-top: 1px solid #ccc;
            }
            .ledger-theme .signoff .line {
              margin-top: 34px;
              border-bottom: 1px solid #161310;
            }
            .ledger-theme .signoff .label {
              font-family: 'Oswald', sans-serif;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: .05em;
            }
            .ledger-theme .signoff .right {
              text-align: right;
            }
          }
        `}</style>

        {/* Action / Notification Alerts */}
        {errorMessage && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs no-print">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
        )}

        {isClosedSuccess && (
          <div className="p-4 bg-emerald-50 border-2 border-emerald-500 rounded-2xl flex items-center justify-between gap-3 text-emerald-900 text-xs shadow-sm no-print">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <strong className="text-sm font-extrabold text-emerald-950 block">
                  Daily Shift Successfully Closed!
                </strong>
                <span>
                  All shift records and loans have been archived. The live dashboard has been reset for the next shift.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handlePrint}
              className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-sm text-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Ledger</span>
            </button>
          </div>
        )}

        {!isClosedSuccess && hasRunningGames && (
          <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-2.5 text-amber-900 text-xs no-print">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600" />
            <div>
              <strong>Action Required:</strong> A game is currently active on{' '}
              <span className="font-bold">
                {runningGames.map(g => g.table_id === 'MINI1' ? 'Mini 1' : 'Mini 2').join(', ')}
              </span>
              . You must end or pause running games before completing daily closure.
            </div>
          </div>
        )}

        {/* The Exact Shift Ledger Preview */}
        <div className="ledger-theme">
          {/* Action bar inside theme */}
          <div className="bar no-print">
            <span className="tag">
              EXTRABLACK &middot; {activeSessionData.session_id} &middot;{' '}
              {activeSessionData.status === 'CLOSED' ? 'closed shift' : 'closing preview'}
            </span>
            <button type="button" className="btn-print-top" onClick={handlePrint}>
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save as PDF</span>
            </button>
          </div>

          {/* Document Element */}
          <div id="printable-closing-invoice" className="doc">
            <div className="letterhead">
              <div className="brand">
                <svg width="34" height="30" viewBox="0 0 34 30" fill="none" aria-hidden="true">
                  <circle cx="17" cy="4" r="3.4" fill="var(--felt)" />
                  <circle cx="10" cy="13" r="3.4" fill="var(--felt)" />
                  <circle cx="24" cy="13" r="3.4" fill="var(--felt)" />
                  <circle cx="3" cy="22" r="3.4" fill="var(--felt)" />
                  <circle cx="17" cy="22" r="3.4" fill="var(--felt)" />
                  <circle cx="31" cy="22" r="3.4" fill="var(--felt)" />
                </svg>
                <div>
                  <h1>Extrablack Snooker Lounge</h1>
                  <p>Daily Financial Closing &amp; Shift Audit</p>
                </div>
              </div>
              <div className="doc-id">
                <span className="code">{activeSessionData.session_id}</span>
                <div className="date mono">{formatDate(activeSessionData.date)}</div>
                <div className="status-pill">
                  {activeSessionData.status === 'CLOSED' ? 'Closed · archived' : 'Open · closing preview'}
                </div>
              </div>
            </div>

            <div className="meta">
              <div>
                <span className="k">Session opened</span>
                <span className="v mono">{formatTime(activeSessionData.opened_at)}</span>
              </div>
              <div>
                <span className="k">Closed at</span>
                <span className="v mono">
                  {activeSessionData.closed_at ? formatTime(activeSessionData.closed_at) : 'In progress'}
                </span>
              </div>
              <div>
                <span className="k">Cashier / Manager</span>
                <span className="v">{cashierName}</span>
              </div>
              <div>
                <span className="k">Tables in play</span>
                <span className="v mono">Mini 1 &middot; Mini 2</span>
              </div>
            </div>

            <div className="stats">
              <div className="stat paid">
                <div className="eyebrow">
                  <span>Total cash paid</span>
                </div>
                <div className="amt">
                  {activeSessionData.total_paid} <small>DH</small>
                </div>
                <div className="note">Actual cash collected in register</div>
              </div>
              <div className="stat loan">
                <div className="eyebrow">
                  <span>Total loans created</span>
                </div>
                <div className="amt">
                  {activeSessionData.new_loans} <small>DH</small>
                </div>
                <div className="note">Customer debts issued today</div>
              </div>
              <div className="stat net">
                <div className="eyebrow">
                  <span>Le reste &middot; Espèce payé</span>
                </div>
                <div className="amt">
                  {activeSessionData.total_paid} <small>DH</small>
                </div>
                <div className="note">
                  Espèces en caisse (Recette &minus; Crédits)
                </div>
              </div>
            </div>

            <div className="secondary">
              <div className="cell">
                <div className="k">Total games</div>
                <div className="v">{activeSessionData.total_games}</div>
              </div>
              <div className="cell">
                <div className="k">Playing hours</div>
                <div className="v felt">
                  {durHours}<small>h</small> {durMins}<small>m</small>
                </div>
              </div>
              <div className="cell">
                <div className="k">Old loans collected</div>
                <div className="v">{activeSessionData.old_loans_collected || 0} <small>DH</small></div>
              </div>
              <div className="cell">
                <div className="k">Table revenue</div>
                <div className="tables">
                  <div className="row">
                    <span>Mini 1</span>
                    <span>{activeSessionData.mini1_revenue || 0} DH</span>
                  </div>
                  <div className="row">
                    <span>Mini 2</span>
                    <span>{activeSessionData.mini2_revenue || 0} DH</span>
                  </div>
                </div>
              </div>
            </div>

            <section className="block">
              <div className="block-head">
                <h2>List of loan people &mdash; dettes &amp; crédits accordés aujourd'hui</h2>
                <span className="tally">total {activeSessionData.new_loans} DH</span>
              </div>
              <div className="twrap">
                <table>
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th className="num">Amount</th>
                      <th>Match detail</th>
                      <th>Time</th>
                      <th className="num">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loanPeople.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: '16px' }}>
                          No loans were created during this session. All games were paid in cash.
                        </td>
                      </tr>
                    ) : (
                      loanPeople.map((person, idx) => (
                        <tr key={person.customerId || idx}>
                          <td className="name">{person.playerName}</td>
                          <td className="num amt-cell">{person.totalLoan} DH</td>
                          <td className="reason">
                            {person.loans.map(l => l.notes || 'Snooker game loan').join(' · ')}
                          </td>
                          <td className="mono">
                            {person.loans[0]?.created_at ? formatTime(person.loans[0].created_at) : '—'}
                          </td>
                          <td className="num">
                            <span className="badge unpaid">Unpaid</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="block">
              <div className="block-head">
                <h2>All-day game log</h2>
                <span className="tally">{games.length} completed games</span>
              </div>
              <div className="twrap games-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Game #</th>
                      <th>Table</th>
                      <th>Players</th>
                      <th className="num">Duration</th>
                      <th className="num">Price</th>
                      <th className="num">Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {games.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: '16px' }}>
                          No games recorded during this session yet.
                        </td>
                      </tr>
                    ) : (
                      games.map(g => (
                        <tr key={g.game_id}>
                          <td className="mono reason">{g.game_id.replace('GAME-', '')}</td>
                          <td>
                            <span className={`badge ${g.table_id === 'MINI1' ? 'table1' : 'table2'}`}>
                              {g.table_id === 'MINI1' ? 'Mini 1' : 'Mini 2'}
                            </span>
                          </td>
                          <td className="name">{g.player_name}</td>
                          <td className="num mono">{g.duration_minutes || 0}m</td>
                          <td className="num amt-cell">{g.final_price} DH</td>
                          <td className="num">
                            <span
                              className={`badge ${
                                g.payment_status === 'PAID' || g.payment_status === 'LOAN_PAID'
                                  ? 'paid'
                                  : g.payment_status === 'PAY_LATER'
                                  ? 'pay-later'
                                  : 'unpaid'
                              }`}
                            >
                              {g.payment_status === 'PAID' || g.payment_status === 'LOAN_PAID'
                                ? 'Paid'
                                : g.payment_status === 'PAY_LATER'
                                ? 'Pay Later'
                                : 'Loan'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="signoff">
              <div>
                <div className="label">Cashier / worker signature</div>
                <div className="line"></div>
              </div>
              <div className="right">
                <div className="label">Manager / administrator signature</div>
                <div className="line"></div>
              </div>
            </div>

            <p className="foot mono">
              Generated from Extrablack shift records &middot; {activeSessionData.session_id} &middot; figures shown as recorded at export time
            </p>
          </div>
        </div>

        {/* Notes (Non-print) */}
        {!isClosedSuccess && (
          <div className="no-print pt-2">
            <label className="block text-xs uppercase font-bold text-slate-500 tracking-wider mb-1">
              Closing Audit Notes (Optional)
            </label>
            <input
              type="text"
              id="close-session-notes-input"
              placeholder="e.g. Register balanced, all cash accounted for"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        )}

        {/* Print Feedback Notification */}
        {printStatus && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-2 text-emerald-900 text-xs no-print animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>
                {printStatus === 'printed' && 'Print dialog initiated successfully.'}
                {printStatus === 'opened' && 'Print-ready shift ledger opened in a separate window (ready to print or save as PDF).'}
                {printStatus === 'downloaded' && 'Ledger HTML downloaded successfully (open in any browser to print or save as PDF).'}
                {printStatus === 'processing' && 'Preparing high-resolution shift ledger...'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPrintStatus(null)}
              className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Modal Action Controls (Non-print) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-200 no-print">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              id="print-invoice-btn"
              onClick={handlePrint}
              disabled={printStatus === 'processing'}
              className="flex-1 sm:flex-initial py-2.5 px-4 bg-emerald-800 hover:bg-emerald-900 active:scale-[0.98] text-amber-100 font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4 text-amber-300" />
              <span>{printStatus === 'processing' ? 'PREPARING PRINT...' : 'PRINT / SAVE AS PDF'}</span>
            </button>

            <button
              type="button"
              id="download-invoice-btn"
              onClick={handleDownloadInvoice}
              title="Download standalone HTML shift ledger for offline viewing and PDF printing"
              className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-200"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span className="hidden sm:inline">DOWNLOAD HTML</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {!isClosedSuccess ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  CANCEL
                </button>

                <button
                  type="button"
                  id="confirm-close-session-btn"
                  disabled={isClosing || hasRunningGames}
                  onClick={handleCloseSession}
                  className="py-2.5 px-5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-md shadow-rose-600/30 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  <span>
                    {isClosing ? 'CLOSING & RESETTING...' : 'CONFIRM CLOSE & RESET DASHBOARD (0 DH)'}
                  </span>
                </button>
              </>
            ) : (
              <button
                type="button"
                id="close-invoice-modal-btn"
                onClick={onClose}
                className="w-full sm:w-auto py-2.5 px-6 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>BACK TO DASHBOARD (0 DH)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
