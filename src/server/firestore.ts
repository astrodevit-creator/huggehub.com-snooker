/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Cloud Firestore Integration
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDocs,
  collection,
  deleteDoc,
  onSnapshot,
  Firestore,
  getDocFromServer,
  terminate,
  setLogLevel,
} from 'firebase/firestore';
import firebaseConfigJson from '../../firebase-applet-config.json';

// Silence gRPC internal logging to prevent unhandled stream errors in stderr
try {
  setLogLevel('silent');
} catch {
  // ignore
}

let db: Firestore | null = null;
let isFirestoreDisabled: boolean = false;
let isFirestoreVerified: boolean = false;
let lastFailureTime: number = 0;
const RETRY_COOLDOWN_MS = 60000; // 1 minute cooldown before testing again

export function getFirestoreStatus(): {
  configured: boolean;
  projectId: string;
  databaseId: string;
  isApiDisabled: boolean;
  isVerified: boolean;
  lastFailureTime: number;
} {
  const config = firebaseConfigJson as any;
  return {
    configured: Boolean(config?.projectId && config?.apiKey),
    projectId: config?.projectId || '',
    databaseId: config?.firestoreDatabaseId || '(default)',
    isApiDisabled: isFirestoreDisabled,
    isVerified: isFirestoreVerified,
    lastFailureTime,
  };
}

export function getCloudFirestore(): Firestore | null {
  if (isFirestoreDisabled && Date.now() - lastFailureTime < RETRY_COOLDOWN_MS) {
    return null;
  }
  if (db) return db;

  try {
    const config = firebaseConfigJson as {
      projectId: string;
      appId: string;
      apiKey: string;
      authDomain: string;
      storageBucket: string;
      messagingSenderId: string;
      firestoreDatabaseId?: string;
    };

    if (!config || !config.projectId || !config.apiKey) {
      console.warn('[Firestore] Invalid firebase-applet-config.json');
      return null;
    }

    const firebaseConfig = {
      projectId: config.projectId,
      appId: config.appId,
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
    };

    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const databaseId = config.firestoreDatabaseId || '(default)';
    
    db = getFirestore(app, databaseId);
    return db;
  } catch (error) {
    console.error('[Firestore] Initialization error:', error);
    return null;
  }
}

/**
 * Validates connectivity to Cloud Firestore with a non-intrusive probe.
 * If the database is missing or unprovisioned (e.g. 5 NOT_FOUND), terminates the instance
 * to prevent background gRPC stream retries and marks Firestore disabled.
 */
export async function validateFirestoreConnection(): Promise<boolean> {
  if (isFirestoreDisabled && Date.now() - lastFailureTime < RETRY_COOLDOWN_MS) {
    return false;
  }
  const firestore = getCloudFirestore();
  if (!firestore) {
    isFirestoreDisabled = true;
    lastFailureTime = Date.now();
    return false;
  }

  try {
    const probeDoc = doc(firestore, '_system_', 'connection_probe');
    await getDocFromServer(probeDoc);
    isFirestoreVerified = true;
    isFirestoreDisabled = false;
    return true;
  } catch (error: any) {
    await handleFirestoreErrorNotice(error);
    return false;
  }
}

async function handleFirestoreErrorNotice(error: any) {
  const msg = error instanceof Error ? error.message : String(error);
  const code = (error as any)?.code;
  if (
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('has not been used') ||
    msg.includes('disabled') ||
    msg.includes('NOT_FOUND') ||
    msg.includes('not-found') ||
    msg.includes('Code: 5') ||
    msg.includes('offline') ||
    code === 'not-found' ||
    code === 'unavailable' ||
    code === 5
  ) {
    isFirestoreDisabled = true;
    isFirestoreVerified = false;
    lastFailureTime = Date.now();
    console.warn(`[Firestore] Cloud Firestore database is offline/unprovisioned (${msg.slice(0, 80)}). Firestore sync paused.`);
    if (db) {
      const activeDb = db;
      db = null;
      try {
        await terminate(activeDb);
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Saves a document to Cloud Firestore
 */
export async function saveToFirestore(collectionName: string, docId: string, data: any): Promise<void> {
  if (isFirestoreDisabled || !isFirestoreVerified) return;
  if (Date.now() - lastFailureTime < RETRY_COOLDOWN_MS) return;

  try {
    const firestore = getCloudFirestore();
    if (!firestore) return;

    // Clean undefined values for Firestore compatibility
    const cleanData = JSON.parse(JSON.stringify(data));
    const docRef = doc(firestore, collectionName, docId);
    await setDoc(docRef, cleanData, { merge: true });
  } catch (error: any) {
    await handleFirestoreErrorNotice(error);
  }
}

/**
 * Deletes a document from Cloud Firestore
 */
export async function deleteFromFirestore(collectionName: string, docId: string): Promise<void> {
  if (isFirestoreDisabled || !isFirestoreVerified) return;
  if (Date.now() - lastFailureTime < RETRY_COOLDOWN_MS) return;

  try {
    const firestore = getCloudFirestore();
    if (!firestore) return;

    const docRef = doc(firestore, collectionName, docId);
    await deleteDoc(docRef);
  } catch (error: any) {
    await handleFirestoreErrorNotice(error);
  }
}

/**
 * Loads all documents from a Cloud Firestore collection
 */
export async function loadFromFirestore(collectionName: string): Promise<any[]> {
  if (isFirestoreDisabled || !isFirestoreVerified) return [];
  if (Date.now() - lastFailureTime < RETRY_COOLDOWN_MS) return [];

  try {
    const firestore = getCloudFirestore();
    if (!firestore) return [];

    const colRef = collection(firestore, collectionName);
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map(d => d.data());
  } catch (error: any) {
    await handleFirestoreErrorNotice(error);
    return [];
  }
}

/**
 * Performs a full bulk sync of memory maps to Cloud Firestore
 */
export async function syncAllToFirestore(payload: {
  games: any[];
  customers: any[];
  loans: any[];
  sessions: any[];
  tables: any[];
  users: any[];
  waiting_list: any[];
  settings: any;
  audit_logs: any[];
}): Promise<{ success: boolean; syncedCounts: Record<string, number> }> {
  const syncedCounts: Record<string, number> = {};
  const firestore = getCloudFirestore();

  if (!firestore) {
    return { success: false, syncedCounts };
  }

  try {
    // 1. Tables
    for (const table of payload.tables) {
      await saveToFirestore('tables', table.table_id, table);
    }
    syncedCounts['tables'] = payload.tables.length;

    // 2. Users
    for (const user of payload.users) {
      await saveToFirestore('users', user.user_id, user);
    }
    syncedCounts['users'] = payload.users.length;

    // 3. Customers
    for (const customer of payload.customers) {
      await saveToFirestore('customers', customer.customer_id, customer);
    }
    syncedCounts['customers'] = payload.customers.length;

    // 4. Games
    for (const game of payload.games) {
      await saveToFirestore('games', game.game_id, game);
    }
    syncedCounts['games'] = payload.games.length;

    // 5. Loans
    for (const loan of payload.loans) {
      await saveToFirestore('loans', loan.loan_id, loan);
    }
    syncedCounts['loans'] = payload.loans.length;

    // 6. Sessions
    for (const session of payload.sessions) {
      await saveToFirestore('sessions', session.session_id, session);
    }
    syncedCounts['sessions'] = payload.sessions.length;

    // 7. Settings
    if (payload.settings) {
      await saveToFirestore('settings', 'app_config', payload.settings);
      syncedCounts['settings'] = 1;
    }

    // 8. Waiting list
    for (const item of payload.waiting_list) {
      await saveToFirestore('waiting_list', item.waiting_id, item);
    }
    syncedCounts['waiting_list'] = payload.waiting_list.length;

    // 9. Audit logs (latest 50)
    for (const log of payload.audit_logs.slice(0, 50)) {
      await saveToFirestore('audit_logs', log.audit_id, log);
    }
    syncedCounts['audit_logs'] = Math.min(payload.audit_logs.length, 50);

    console.log('[Firestore] Successfully synced all collections to Cloud Firestore:', syncedCounts);
    return { success: true, syncedCounts };
  } catch (error) {
    console.error('[Firestore] Bulk sync error:', error);
    return { success: false, syncedCounts };
  }
}

export function subscribeToFirestoreChanges(callbacks: {
  onGameChange?: (game: any, changeType: 'added' | 'modified' | 'removed') => void;
  onTableChange?: (table: any) => void;
  onLoanChange?: (loan: any, changeType: 'added' | 'modified' | 'removed') => void;
  onSessionChange?: (session: any) => void;
  onCustomerChange?: (customer: any) => void;
  onSettingsChange?: (settings: any) => void;
}): () => void {
  // CRITICAL: Never register real-time listeners unless Firestore is explicitly verified online.
  // Registering listeners against an unprovisioned or non-existent database causes endless gRPC 5 NOT_FOUND retries.
  if (isFirestoreDisabled || !isFirestoreVerified) return () => {};

  const firestore = getCloudFirestore();
  if (!firestore) return () => {};

  const unsubs: (() => void)[] = [];
  try {
    const registerSafeListener = (colName: string, onDocs: (snapshot: any) => void) => {
      let unsub: (() => void) | null = null;
      unsub = onSnapshot(
        collection(firestore, colName),
        snapshot => {
          onDocs(snapshot);
        },
        async err => {
          await handleFirestoreErrorNotice(err);
          if (unsub) {
            try {
              unsub();
            } catch {
              // ignore
            }
          }
          // Clean up all active listeners to prevent repeated RPC stream errors
          unsubs.forEach(u => {
            try { u(); } catch {}
          });
        }
      );
      if (unsub) unsubs.push(unsub);
    };

    // 1. Games real-time listener
    registerSafeListener('games', snapshot => {
      snapshot.docChanges().forEach((change: any) => {
        callbacks.onGameChange?.(change.doc.data(), change.type);
      });
    });

    // 2. Loans real-time listener
    registerSafeListener('loans', snapshot => {
      snapshot.docChanges().forEach((change: any) => {
        callbacks.onLoanChange?.(change.doc.data(), change.type);
      });
    });

    // 3. Tables real-time listener
    registerSafeListener('tables', snapshot => {
      snapshot.docChanges().forEach((change: any) => {
        callbacks.onTableChange?.(change.doc.data());
      });
    });

    // 4. Sessions real-time listener
    registerSafeListener('sessions', snapshot => {
      snapshot.docChanges().forEach((change: any) => {
        callbacks.onSessionChange?.(change.doc.data());
      });
    });

    // 5. Customers real-time listener
    registerSafeListener('customers', snapshot => {
      snapshot.docChanges().forEach((change: any) => {
        callbacks.onCustomerChange?.(change.doc.data());
      });
    });

    console.log('[Firestore Realtime] Attached real-time server listeners to Cloud Firestore.');
  } catch (err) {
    console.warn('[Firestore Realtime] Failed to register listeners:', err);
  }

  return () => {
    unsubs.forEach(unsub => {
      try {
        unsub();
      } catch {}
    });
  };
}

