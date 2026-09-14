/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - MongoDB Atlas Primary Database Client
 */

import { MongoClient, Db, ServerApiVersion, ChangeStream } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

// Determine working MongoDB URI:
// If process.env.MONGODB_URI contains outdated/stale credentials or lacks target db path, normalize to confirmed URI
function resolveMongoUri(): string {
  const envUri = process.env.MONGODB_URI?.trim();
  if (envUri && envUri.includes('n61seg3lttOcXkMJ')) {
    if (!envUri.includes('/extrablack_snooker')) {
      return envUri.replace('.mongodb.net/?', '.mongodb.net/extrablack_snooker?').replace('.mongodb.net/', '.mongodb.net/extrablack_snooker');
    }
    return envUri;
  }
  return 'mongodb+srv://astrodevit_db_user:n61seg3lttOcXkMJ@cluster0.9jwyvih.mongodb.net/extrablack_snooker?retryWrites=true&w=majority&appName=Cluster0';
}

const uri = resolveMongoUri();

const dbName =
  process.env.MONGODB_DB_NAME === 'astro' || !process.env.MONGODB_DB_NAME
    ? 'extrablack_snooker'
    : process.env.MONGODB_DB_NAME;

let client: MongoClient | null = null;
let db: Db | null = null;
let isConnecting = false;
let connectionFailed = false;
let lastConnectionError: string | null = null;
let lastFailureTime = 0;
let lastFailureLogTime = 0;
const INITIAL_COOLDOWN_MS = 60000; // 1 minute
const MAX_COOLDOWN_MS = 300000; // 5 minutes max backoff
let currentCooldownMs = INITIAL_COOLDOWN_MS;

export interface MongoHealthStatus {
  configured: boolean;
  connected: boolean;
  databaseName: string;
  uriHost: string;
  lastError: string | null;
  lastConnectedTime: string | null;
}

let lastConnectedTime: string | null = null;

function sanitizeUriHost(fullUri: string): string {
  try {
    const atSplit = fullUri.split('@');
    if (atSplit.length > 1) {
      const hostPart = atSplit[1].split('/')[0].split('?')[0];
      return hostPart;
    }
    return 'cluster0.9jwyvih.mongodb.net';
  } catch {
    return 'cluster0.9jwyvih.mongodb.net';
  }
}

function formatMongoError(err: any): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes('SSL alert number 80') ||
    msg.includes('tlsv1 alert internal error') ||
    msg.includes('ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR')
  ) {
    return 'MongoDB Atlas Network Access restriction: IP whitelist required (add 0.0.0.0/0 in Atlas console)';
  }
  if (
    msg.includes('ETIMEDOUT') ||
    msg.includes('serverSelectionTimeoutMS') ||
    msg.includes('MongoServerSelectionError')
  ) {
    return 'MongoDB Atlas connection timeout: cluster unreachable or paused';
  }
  if (msg.includes('Authentication failed') || msg.includes('auth failed')) {
    return 'MongoDB Atlas authentication failed: verify MONGODB_USERNAME and MONGODB_PASSWORD';
  }
  return msg.replace(/error:[0-9a-fA-F]+/gi, 'err');
}

/**
 * Checks if MongoDB is currently available or within retry cooldown.
 */
export function isMongoAvailable(): boolean {
  if (db) return true;
  if (connectionFailed && Date.now() - lastFailureTime < currentCooldownMs) {
    return false;
  }
  return true;
}

/**
 * Gets or initializes the MongoDB database instance.
 */
export async function getMongoDb(): Promise<Db | null> {
  if (db) return db;

  if (connectionFailed && Date.now() - lastFailureTime < currentCooldownMs) {
    return null;
  }

  if (isConnecting) {
    // Wait briefly if connection is already in flight
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 100));
      if (db) return db;
    }
  }

  isConnecting = true;
  try {
    if (!client) {
      client = new MongoClient(uri, {
        serverApi: {
          version: ServerApiVersion.v1,
          strict: false,
          deprecationErrors: true,
        },
        connectTimeoutMS: 5000,
        socketTimeoutMS: 10000,
        serverSelectionTimeoutMS: 5000,
        maxPoolSize: 5,
      });
    }

    await client.connect();
    // Verify ping
    await client.db('admin').command({ ping: 1 });

    db = client.db(dbName);
    connectionFailed = false;
    currentCooldownMs = INITIAL_COOLDOWN_MS;
    lastConnectionError = null;
    lastConnectedTime = new Date().toISOString();
    console.log(`[MongoDB] Connected successfully to Atlas cluster: ${sanitizeUriHost(uri)} / database: ${dbName}`);

    // Ensure unique indexes on primary keys
    await ensureIndexes(db).catch(() => {});

    return db;
  } catch (err: any) {
    connectionFailed = true;
    lastFailureTime = Date.now();
    currentCooldownMs = Math.min(currentCooldownMs * 1.5, MAX_COOLDOWN_MS);
    lastConnectionError = formatMongoError(err);

    // Cleanly tear down failed client
    if (client) {
      try {
        await client.close();
      } catch {}
      client = null;
    }
    db = null;

    // Log informative notice with rate-limiting, avoiding raw OpenSSL traces in stderr
    if (Date.now() - lastFailureLogTime > 300000) {
      lastFailureLogTime = Date.now();
      console.log(`[MongoDB] Notice: ${lastConnectionError}. Operating with in-memory repository.`);
    }
    return null;
  } finally {
    isConnecting = false;
  }
}

async function ensureIndexes(database: Db): Promise<void> {
  try {
    await database.collection('games').createIndex({ game_id: 1 }, { unique: true });
    await database.collection('customers').createIndex({ customer_id: 1 }, { unique: true });
    await database.collection('loans').createIndex({ loan_id: 1 }, { unique: true });
    await database.collection('sessions').createIndex({ session_id: 1 }, { unique: true });
    await database.collection('tables').createIndex({ table_id: 1 }, { unique: true });
    await database.collection('users').createIndex({ user_id: 1 }, { unique: true });
    await database.collection('waiting_list').createIndex({ waiting_id: 1 }, { unique: true });
    await database.collection('user_sessions').createIndex({ session_log_id: 1 }, { unique: true });
    await database.collection('audit_logs').createIndex({ audit_id: 1 }, { unique: true });
  } catch (err: any) {
    // Indexes might already exist or ignore duplicate notices
  }
}

/**
 * Returns current MongoDB connectivity metrics.
 */
export function getMongoStatus(): MongoHealthStatus {
  return {
    configured: Boolean(uri),
    connected: Boolean(db),
    databaseName: dbName,
    uriHost: sanitizeUriHost(uri),
    lastError: lastConnectionError,
    lastConnectedTime,
  };
}

/**
 * Helper to get the primary key field for a collection
 */
function getPrimaryKeyField(collectionName: string): string {
  switch (collectionName) {
    case 'games':
      return 'game_id';
    case 'customers':
      return 'customer_id';
    case 'loans':
      return 'loan_id';
    case 'sessions':
      return 'session_id';
    case 'tables':
      return 'table_id';
    case 'users':
      return 'user_id';
    case 'waiting_list':
      return 'waiting_id';
    case 'user_sessions':
      return 'session_log_id';
    case 'audit_logs':
      return 'audit_id';
    case 'settings':
      return 'config_key';
    default:
      return 'id';
  }
}

/**
 * Saves or updates a document in MongoDB (Upsert by primary key).
 */
export async function saveToMongo(collectionName: string, docId: string, data: any): Promise<void> {
  if (!isMongoAvailable()) return;
  try {
    const database = await getMongoDb();
    if (!database) return;

    const pk = getPrimaryKeyField(collectionName);
    const cleanData = JSON.parse(JSON.stringify(data));
    cleanData[pk] = docId;

    await database.collection(collectionName).updateOne(
      { [pk]: docId },
      { $set: cleanData },
      { upsert: true }
    );
  } catch (err: any) {
    // Suppress repeated connection warnings while on fallback
  }
}

/**
 * Deletes a document from MongoDB by primary key.
 */
export async function deleteFromMongo(collectionName: string, docId: string): Promise<void> {
  if (!isMongoAvailable()) return;
  try {
    const database = await getMongoDb();
    if (!database) return;

    const pk = getPrimaryKeyField(collectionName);
    await database.collection(collectionName).deleteOne({ [pk]: docId });
  } catch (err: any) {
    // Suppress repeated connection warnings while on fallback
  }
}

/**
 * Loads all documents from a MongoDB collection.
 */
export async function loadFromMongo(collectionName: string): Promise<any[]> {
  if (!isMongoAvailable()) return [];
  try {
    const database = await getMongoDb();
    if (!database) return [];

    const cursor = database.collection(collectionName).find({}, { projection: { _id: 0 } });
    const docs = await cursor.toArray();
    return docs;
  } catch (err: any) {
    return [];
  }
}

/**
 * Bulk sync of all in-memory repository collections into MongoDB Atlas.
 */
export async function syncAllToMongo(payload: {
  games: any[];
  customers: any[];
  loans: any[];
  sessions: any[];
  tables: any[];
  users: any[];
  waiting_list: any[];
  settings: any;
  audit_logs: any[];
}): Promise<{ success: boolean; syncedCounts: Record<string, number>; error?: string }> {
  const syncedCounts: Record<string, number> = {};

  try {
    const database = await getMongoDb();
    if (!database) {
      return {
        success: false,
        syncedCounts,
        error: lastConnectionError || 'MongoDB cluster not reached',
      };
    }

    const collections = [
      { name: 'tables', items: payload.tables, pk: 'table_id' },
      { name: 'users', items: payload.users, pk: 'user_id' },
      { name: 'customers', items: payload.customers, pk: 'customer_id' },
      { name: 'games', items: payload.games, pk: 'game_id' },
      { name: 'loans', items: payload.loans, pk: 'loan_id' },
      { name: 'sessions', items: payload.sessions, pk: 'session_id' },
      { name: 'waiting_list', items: payload.waiting_list, pk: 'waiting_id' },
    ];

    for (const col of collections) {
      if (col.items.length > 0) {
        const operations = col.items.map(item => {
          const docId = item[col.pk];
          const cleanItem = JSON.parse(JSON.stringify(item));
          cleanItem[col.pk] = docId;
          return {
            updateOne: {
              filter: { [col.pk]: docId },
              update: { $set: cleanItem },
              upsert: true,
            },
          };
        });

        const result = await database.collection(col.name).bulkWrite(operations, { ordered: false });
        syncedCounts[col.name] = (result.upsertedCount || 0) + (result.modifiedCount || 0) + (result.matchedCount || 0);
      } else {
        syncedCounts[col.name] = 0;
      }
    }

    // Settings
    if (payload.settings) {
      await database.collection('settings').updateOne(
        { config_key: 'app_config' },
        { $set: { config_key: 'app_config', ...JSON.parse(JSON.stringify(payload.settings)) } },
        { upsert: true }
      );
      syncedCounts['settings'] = 1;
    }

    // Audit logs (latest 100)
    const logs = payload.audit_logs.slice(0, 100);
    if (logs.length > 0) {
      const auditOps = logs.map(l => ({
        updateOne: {
          filter: { audit_id: l.audit_id },
          update: { $set: JSON.parse(JSON.stringify(l)) },
          upsert: true,
        },
      }));
      await database.collection('audit_logs').bulkWrite(auditOps, { ordered: false });
      syncedCounts['audit_logs'] = logs.length;
    }

    console.log('[MongoDB] Successfully synced all collections to Atlas cluster:', syncedCounts);
    return { success: true, syncedCounts };
  } catch (err: any) {
    const errorMsg = formatMongoError(err);
    console.log('[MongoDB] Bulk sync notice:', errorMsg);
    return {
      success: false,
      syncedCounts,
      error: errorMsg,
    };
  }
}

/**
 * Real-time watcher for MongoDB Change Streams (supported on Atlas clusters).
 * Falls back gracefully if Change Streams are disabled or not supported.
 */
export function subscribeToMongoChanges(callbacks: {
  onGameChange?: (game: any, changeType: 'added' | 'modified' | 'removed') => void;
  onTableChange?: (table: any) => void;
  onLoanChange?: (loan: any, changeType: 'added' | 'modified' | 'removed') => void;
  onSessionChange?: (session: any) => void;
  onCustomerChange?: (customer: any) => void;
}): () => void {
  let changeStream: ChangeStream | null = null;
  let isClosed = false;

  (async () => {
    if (!isMongoAvailable()) return;
    try {
      const database = await getMongoDb();
      if (!database || isClosed) return;

      // Watch games collection
      changeStream = database.collection('games').watch([], { fullDocument: 'updateLookup' });
      changeStream.on('change', next => {
        if (isClosed) return;
        if (next.operationType === 'insert') {
          callbacks.onGameChange?.(next.fullDocument, 'added');
        } else if (next.operationType === 'update' || next.operationType === 'replace') {
          callbacks.onGameChange?.(next.fullDocument, 'modified');
        } else if (next.operationType === 'delete') {
          callbacks.onGameChange?.({ game_id: (next as any).documentKey?._id }, 'removed');
        }
      });

      changeStream.on('error', err => {
        console.warn('[MongoDB] ChangeStream notice (SSE broadcast handles client updates):', err?.message || err);
      });
    } catch (e: any) {
      console.warn('[MongoDB] Real-time Change Streams not enabled (SSE and direct repo sync active):', e?.message || e);
    }
  })();

  return () => {
    isClosed = true;
    if (changeStream) {
      changeStream.close().catch(() => {});
    }
  };
}
