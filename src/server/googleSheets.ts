/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Google Sheets API Client & Synchronization
 */

import { google } from 'googleapis';
import { AppSettings, AuditEntry, Customer, DailySession, Game, Loan, SnookerTable, User, WaitingEntry } from '../types.ts';

export interface SheetHealthStatus {
  connected: boolean;
  spreadsheetId: string | null;
  serviceAccountConfigured: boolean;
  serviceAccountEmail?: string | null;
  sheetsFound: string[];
  lastSyncAt: string | null;
  errorMessage: string | null;
  pendingRetries?: number;
  consecutiveFailures?: number;
}

interface PendingUpsert {
  sheetName: string;
  idColIndex: number;
  primaryId: string;
  rowValues: (string | number | boolean | null | undefined)[];
  retryCount: number;
  nextRetryAt: number;
}

const DEFAULT_HEADERS: Record<string, string[]> = {
  Users: ['user_id', 'name', 'email', 'role', 'active', 'created_at', 'created_by', 'last_login', 'updated_at'],
  Customers: ['customer_id', 'name', 'normalized_name', 'phone', 'notes', 'active', 'created_at', 'created_by', 'updated_at'],
  Tables: ['table_id', 'name', 'active', 'hourly_rate', 'minimum_price', 'created_at', 'updated_at'],
  Games: [
    'game_id', 'session_id', 'table_id', 'customer_id', 'player_name', 'start_time', 'end_time',
    'duration_seconds', 'duration_minutes', 'raw_calculated_price', 'suggested_price', 'final_price',
    'price_difference', 'discount_amount', 'manual_price', 'price_reason', 'price_note',
    'game_number_today', 'promo_cycle_game_count', 'offer_eligible', 'offer_type', 'offer_selected_price',
    'is_free_game', 'payment_status', 'status', 'started_by', 'ended_by', 'paid_at', 'paid_by',
    'locked', 'waiting_id', 'notes', 'created_at', 'updated_at', 'deleted', 'deleted_at', 'deleted_by', 'deletion_reason'
  ],
  Loans: ['loan_id', 'game_id', 'session_id', 'customer_id', 'player_name', 'amount', 'created_at', 'created_by', 'status', 'paid_at', 'paid_by', 'cancelled_at', 'cancelled_by', 'notes', 'updated_at'],
  WaitingList: ['waiting_id', 'session_id', 'customer_id', 'player_name', 'preferred_table', 'added_at', 'added_by', 'status', 'seated_at', 'game_id', 'notes', 'updated_at'],
  Sessions: ['session_id', 'date', 'opened_at', 'opened_by', 'closed_at', 'closed_by', 'status', 'total_games', 'total_duration', 'calculated_value', 'final_value', 'total_paid', 'new_loans', 'old_loans_collected', 'discount_total', 'free_game_value', 'reste', 'mini1_revenue', 'mini2_revenue', 'notes'],
  Settings: ['setting_key', 'setting_value', 'description', 'updated_at', 'updated_by'],
  AuditLog: ['audit_id', 'timestamp', 'user_id', 'user_email', 'user_role', 'action', 'entity_type', 'entity_id', 'session_id', 'before_data', 'after_data', 'reason', 'ip_or_device_info_if_available'],
};

export class GoogleSheetsService {
  private spreadsheetId: string | null = null;
  private authClient: any = null;
  private sheetsApi: any = null;
  private driveApi: any = null;
  private lastSyncTime: string | null = null;
  private lastError: string | null = null;
  private consecutiveFailures: number = 0;
  private knownSheets: Set<string> = new Set();

  // Queue and serialization mutex for non-duplicate safe upserts
  private retryQueue: Map<string, PendingUpsert> = new Map();
  private processingQueue: boolean = false;
  private writeMutex: Promise<void> = Promise.resolve();

  constructor() {
    this.initAuth();
  }

  public static extractSpreadsheetId(input: string | null | undefined): string | null {
    if (!input) return null;
    let trimmed = input.trim().replace(/^["']|["']$/g, '');
    if (!trimmed) return null;
    // Extract ID from full Google Sheets URL (e.g. https://docs.google.com/spreadsheets/d/1BxiM.../edit#gid=0)
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return match[1];
    }
    // Clean any trailing query parameters or slashes
    const cleanId = trimmed.split(/[?#/]/)[0];
    return cleanId || null;
  }

  public setSpreadsheetId(id: string): void {
    const cleanId = GoogleSheetsService.extractSpreadsheetId(id);
    if (cleanId !== this.spreadsheetId) {
      this.spreadsheetId = cleanId;
      this.knownSheets.clear();
      if (this.spreadsheetId && this.sheetsApi) {
        this.initializeSpreadsheet().catch(err => {
          console.warn('[GoogleSheets] Auto-init notice:', err.message);
        });
      }
    }
  }

  public getSpreadsheetId(): string | null {
    return this.spreadsheetId;
  }

  public formatRange(sheetName: string, rangeA1: string): string {
    const escaped = sheetName.replace(/'/g, "''");
    return `'${escaped}'!${rangeA1}`;
  }

  /**
   * Checks if a tab exists in the spreadsheet; if not, automatically creates it and writes default headers.
   */
  public async ensureSheetExists(sheetName: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    if (this.knownSheets.has(sheetName)) return true;

    try {
      const res = await this.sheetsApi.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      const existingSheets = new Set((res.data.sheets || []).map((s: any) => s.properties?.title));
      existingSheets.forEach((name: string) => this.knownSheets.add(name));

      if (!existingSheets.has(sheetName)) {
        // Create the missing sheet tab
        await this.sheetsApi.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: { title: sheetName },
                },
              },
            ],
          },
        });
        this.knownSheets.add(sheetName);

        // If default headers exist for this sheet, write them to row 1
        const headers = DEFAULT_HEADERS[sheetName];
        if (headers && headers.length > 0) {
          const endCol = this.getColumnLetter(headers.length);
          await this.sheetsApi.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: this.formatRange(sheetName, `A1:${endCol}1`),
            valueInputOption: 'RAW',
            requestBody: {
              values: [headers],
            },
          });
        }
      }
      return true;
    } catch (err: any) {
      console.warn(`[GoogleSheets] Warning in ensureSheetExists for ${sheetName}:`, err.message);
      return false;
    }
  }

  private initAuth() {
    try {
      this.spreadsheetId = GoogleSheetsService.extractSpreadsheetId(process.env.GOOGLE_SHEETS_SPREADSHEET_ID);
      const clientEmail = (
        process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
        'snooker-sheets-backup@gen-lang-client-0888214459.iam.gserviceaccount.com'
      ).trim().replace(/^["']|["']$/g, '');

      let privateKey = (
        process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ||
        `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCsrmpb6fAVs6Ml\nYvJjDKCK5WRw1+WBBpxr3HEp/rHIKvkLYxiUM7uMog8gYJj6wYVrOsZkoXDEzrPI\nND2+OoRR+coiKq8QZiCzMrPBpJPp33yEAYp5EYcIJcvcC0/A8aG64RgAYn+wSo2c\ncaFOe/jhoBWbaIFUhkFBTwZgrIVw4gUnODBnZJzCtHAQhFDXv+jzHeiU/UHHBEwG\n2IX7NaL7oP202RLFuP9n30n3ishjmW58G1N9PPBIsmhT3rSDTHEiaC7sEbuFJvws\nwR/jZ1Q3HcHFVm1RZrYEQxcDLUplpEEiYRHqgTJSwxK/B8RFd9ypXL/y91MVR4TW\n9E9++bezAgMBAAECggEAC8Nr8mv603ejzwmxCmdTTnL3Byrl8wawxDZFrT8w/DpV\nMd3j0EC/74Igtqtt8HMbdCUSW8uVo4qTO7m3VQymc/EowHAY8eyLILn8/d2Ix/9V\n+6YhOUMk6Dyu6QQKQFIVmuX3nRsYqLlDcVtaSj7uwuwFXMtfOBNXQaww+of2JSzb\n0HP38JUM1fwCEJRyXvNw7UOxQsoWW0YnNadIfJVWhNg+BCI06oNGfjQDybZH1ql0\nuGuCTinCyhcoAt/oSjWpcWuYqMafzM7POOLFbbY02y8nr0nU+Pggy2g8ACjMBY7v\nTdpAR7ci8vtt/ScRiWU5zk5RunFwd3Y5t8zdW/ylWQKBgQDcZ8gCACD4MpLFAmDZ\nKUuL69pPR3y5u9xw48ICb//QXDwzxcHjEIGO3YN0fmxe2Zj+Ne7vH8JjdKNoFELX\nAmle35nj45zSsu+BlzzhhB018GbQAYKRKDHMV+ahVxBNZJ3Ch+bAcygGL5L3WmIe\n3narz814a9qC/LjOL3t9SVGgeQKBgQDIkZPh4OoNRCJ32C4FZ/4wqcMnKoECrQA0\nmbo3DueLy7QZh90RcqHkr7dShXjOzpf4NWqm16tK+v8VO8zh8NHjjULdAKRa4HWx\nP2tIPGO+8+Jx+7Smwk1TNTRTeW9n7NCotD/hQFWM7DRhbkbvqU4EPI1bREzmEDQL\n8qQ/e1rGiwKBgEoxUT2DJ5YFCCzzQQC5Cuo96Y4YZV7sYydJM+y4IOfVtJpE7qBt\n1P7viCm1yOsg2oRwSU8LZNcv0zXc5CcWc7vxDw+MdiTjAQahj2fmniKjGyjX6UjN\nu/2qdUNIWH+E6CosrzuHSCjU6OcE8NStVEs/t03bGIJRajBWAX7KKIUZAoGBAKxo\nLzWYT7jNm89m/dBZ3y/XjdCKAdHaAnY0utR/NFx/4zWbC1XnMvDQdwYxg3JKNmn/\nCMmYVD8k2MZY3DpP9yvijtpIpf8UOTb+q+qxNpC7NikC0/wQw8VF08/5b+FmuMp7\n/vlSgvebRz+FOubioxSTNHOCl5Of1A19KuEC2ToXAoGAenhpRDaAIe/Vxo1Tu3hj\n/NOJ7aqjAwV+5YTvDx6JFo4b/voL8bFpOkpIH1bSC4W2ZvvrrADf8WOhs4IqCxqG\nvGVHiEPoIPX26Wcv4xZHBf9dGzRwySfFQNPg/P9i4IsJ++O7/Q7G3CuvAh3nuTY6\n8SQnQSt3ESUdx9PZ1u67EL0=\n-----END PRIVATE KEY-----\n`
      );

      if (clientEmail && privateKey) {
        // Fix any escaped newlines or surrounding quotes in the private key
        privateKey = privateKey.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n').trim();
        
        const jwtClient = new google.auth.JWT({
          email: clientEmail,
          key: privateKey,
          scopes: [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive.file',
          ],
        });

        this.authClient = jwtClient;
        this.sheetsApi = google.sheets({ version: 'v4', auth: jwtClient });
        this.driveApi = google.drive({ version: 'v3', auth: jwtClient });
        console.log('[GoogleSheets] Initialized with Service Account:', clientEmail);
      } else {
        console.log('[GoogleSheets] Ready for backup (Spreadsheet ID or Service Account key can be configured)');
      }
    } catch (err: any) {
      console.error('[GoogleSheets] Initialization error:', err.message);
      this.lastError = err.message;
    }
  }

  public isConfigured(): boolean {
    return !!(this.sheetsApi && this.spreadsheetId);
  }

  public async getHealth(): Promise<SheetHealthStatus> {
    const serviceAccountEmail =
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      'snooker-sheets-backup@gen-lang-client-0888214459.iam.gserviceaccount.com';

    if (!this.isConfigured()) {
      let msg = this.lastError;
      if (!msg) {
        if (!this.spreadsheetId) {
          msg = 'Google Sheets Spreadsheet URL or ID not yet connected. Enter your Google Sheet URL or ID and click Connect.';
        } else if (!this.authClient) {
          msg = 'Service Account authentication credentials could not be loaded.';
        }
      }
      return {
        connected: false,
        spreadsheetId: this.spreadsheetId,
        serviceAccountConfigured: !!this.authClient,
        serviceAccountEmail,
        sheetsFound: [],
        lastSyncAt: this.lastSyncTime,
        errorMessage: msg || 'Spreadsheet not configured',
        pendingRetries: this.retryQueue.size,
        consecutiveFailures: this.consecutiveFailures,
      };
    }

    try {
      const res = await this.sheetsApi.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      const sheetsFound = (res.data.sheets || []).map((s: any) => s.properties?.title || '');
      this.lastSyncTime = new Date().toISOString();
      this.lastError = null;
      this.consecutiveFailures = 0;

      // Trigger background retry queue processing if any pending
      if (this.retryQueue.size > 0) {
        this.processRetryQueue().catch(() => {});
      }

      return {
        connected: true,
        spreadsheetId: this.spreadsheetId,
        serviceAccountConfigured: true,
        serviceAccountEmail,
        sheetsFound,
        lastSyncAt: this.lastSyncTime,
        errorMessage: null,
        pendingRetries: this.retryQueue.size,
        consecutiveFailures: 0,
      };
    } catch (err: any) {
      this.lastError = err.message;
      this.consecutiveFailures++;
      return {
        connected: false,
        spreadsheetId: this.spreadsheetId,
        serviceAccountConfigured: !!this.authClient,
        serviceAccountEmail,
        sheetsFound: [],
        lastSyncAt: this.lastSyncTime,
        errorMessage: err.message,
        pendingRetries: this.retryQueue.size,
        consecutiveFailures: this.consecutiveFailures,
      };
    }
  }

  /**
   * Creates a new Google Spreadsheet backup sheet automatically if needed.
   */
  public async createNewBackupSpreadsheet(title: string = `EXTRABLACK Snooker Live Backup - ${new Date().toISOString().split('T')[0]}`): Promise<string | null> {
    if (!this.sheetsApi) return null;
    try {
      const res = await this.sheetsApi.spreadsheets.create({
        requestBody: {
          properties: {
            title,
          },
        },
      });
      const newId = res.data.spreadsheetId;
      if (newId) {
        this.spreadsheetId = newId;
        await this.initializeSpreadsheet();
        return newId;
      }
      return null;
    } catch (err: any) {
      console.error('[GoogleSheets] Error creating spreadsheet:', err.message);
      this.lastError = err.message;
      return null;
    }
  }

  /**
   * Initializes all required tabs with exact column headers if they don't exist.
   */
  public async initializeSpreadsheet(): Promise<boolean> {
    if (!this.isConfigured()) return false;

    try {
      const res = await this.sheetsApi.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      const existingSheets = new Set((res.data.sheets || []).map((s: any) => s.properties?.title));
      existingSheets.forEach((title: string) => this.knownSheets.add(title));

      const addRequests: any[] = [];
      for (const title of Object.keys(DEFAULT_HEADERS)) {
        if (!existingSheets.has(title)) {
          addRequests.push({
            addSheet: {
              properties: { title },
            },
          });
        }
      }

      if (addRequests.length > 0) {
        await this.sheetsApi.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: { requests: addRequests },
        });
        Object.keys(DEFAULT_HEADERS).forEach(title => this.knownSheets.add(title));
      }

      // Write Header Rows for all sheets
      const updateData: any[] = [];
      for (const [sheetName, cols] of Object.entries(DEFAULT_HEADERS)) {
        const endCol = this.getColumnLetter(cols.length);
        updateData.push({
          range: this.formatRange(sheetName, `A1:${endCol}1`),
          values: [cols],
        });
      }

      await this.sheetsApi.spreadsheets.values.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: updateData,
        },
      });

      this.lastSyncTime = new Date().toISOString();
      return true;
    } catch (err: any) {
      console.error('[GoogleSheets] Failed to initialize sheets:', err.message);
      this.lastError = err.message;
      return false;
    }
  }

  /**
   * Converts 1-based column number to Excel/Sheets column letters (e.g., 1 -> 'A', 26 -> 'Z', 27 -> 'AA', 38 -> 'AL')
   */
  private getColumnLetter(colNum: number): string {
    let temp = colNum;
    let letter = '';
    while (temp > 0) {
      const mod = (temp - 1) % 26;
      letter = String.fromCharCode(65 + mod) + letter;
      temp = Math.floor((temp - mod) / 26);
    }
    return letter || 'A';
  }

  /**
   * Executes a write operation within a serialized mutex to prevent concurrent write races.
   */
  private async runWithWriteMutex<T>(operation: () => Promise<T>): Promise<T> {
    const prev = this.writeMutex;
    let release: () => void;
    this.writeMutex = new Promise<void>(resolve => {
      release = resolve;
    });

    try {
      await prev;
      return await operation();
    } finally {
      release!();
    }
  }

  /**
   * Internal execution of an upsert without queueing
   */
  private async executeUpsert(sheetName: string, idColIndex: number, primaryId: string, rowValues: (string | number | boolean | null | undefined)[]): Promise<boolean> {
    await this.ensureSheetExists(sheetName);
    const formattedValues = rowValues.map(v => (v === undefined || v === null ? '' : String(v)));

    // Check if row already exists in Sheet
    const existing = await this.readSheet(sheetName);
    let targetRowIndex = -1;

    if (existing && existing.length > 1) {
      for (let i = 1; i < existing.length; i++) {
        if (existing[i] && existing[i][idColIndex] === primaryId) {
          targetRowIndex = i + 1; // 1-based index
          break;
        }
      }
    }

    const endCol = this.getColumnLetter(formattedValues.length);

    if (targetRowIndex > 0) {
      // Update existing row
      await this.sheetsApi.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: this.formatRange(sheetName, `A${targetRowIndex}:${endCol}${targetRowIndex}`),
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [formattedValues],
        },
      });
    } else {
      // Append new row
      await this.sheetsApi.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: this.formatRange(sheetName, 'A:A'),
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [formattedValues],
        },
      });
    }

    this.lastSyncTime = new Date().toISOString();
    this.lastError = null;
    this.consecutiveFailures = 0;
    return true;
  }

  /**
   * Processes failed writes with exponential backoff
   */
  public async processRetryQueue(): Promise<void> {
    if (this.processingQueue || this.retryQueue.size === 0 || !this.isConfigured()) return;
    this.processingQueue = true;

    try {
      const now = Date.now();
      for (const [key, item] of Array.from(this.retryQueue.entries())) {
        if (now < item.nextRetryAt) continue;

        try {
          await this.runWithWriteMutex(() =>
            this.executeUpsert(item.sheetName, item.idColIndex, item.primaryId, item.rowValues)
          );
          this.retryQueue.delete(key);
        } catch (err: any) {
          item.retryCount++;
          if (item.retryCount > 8) {
            console.error(`[GoogleSheets] Exhausted 8 retries for ${item.sheetName} (${item.primaryId}):`, err.message);
            this.retryQueue.delete(key);
          } else {
            // Exponential backoff: 3s, 6s, 12s, 24s... max 60s
            const delay = Math.min(3000 * Math.pow(2, item.retryCount - 1), 60000);
            item.nextRetryAt = Date.now() + delay;
          }
        }
      }
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Appends or updates a row by primary ID key to keep Google Sheets exactly mirroring the database.
   * Features mutex serialization and automatic background retries on transient failures.
   */
  public async upsertRow(sheetName: string, idColIndex: number, primaryId: string, rowValues: (string | number | boolean | null | undefined)[]): Promise<boolean> {
    if (!this.isConfigured()) return false;

    const queueKey = `${sheetName}:${primaryId}`;

    try {
      await this.runWithWriteMutex(() =>
        this.executeUpsert(sheetName, idColIndex, primaryId, rowValues)
      );
      this.retryQueue.delete(queueKey);
      return true;
    } catch (err: any) {
      console.error(`[GoogleSheets] Error upserting row in ${sheetName} (${primaryId}):`, err.message);
      this.lastError = err.message;
      this.consecutiveFailures++;

      // Enqueue for background retry with exponential backoff (initial delay 3s)
      this.retryQueue.set(queueKey, {
        sheetName,
        idColIndex,
        primaryId,
        rowValues,
        retryCount: 1,
        nextRetryAt: Date.now() + 3000,
      });

      // Schedule background processor
      setTimeout(() => {
        this.processRetryQueue().catch(() => {});
      }, 3000);

      return false;
    }
  }

  /**
   * Appends a row to a specified sheet.
   */
  public async appendRow(sheetName: string, rowValues: (string | number | boolean | null | undefined)[]): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      await this.ensureSheetExists(sheetName);
      await this.sheetsApi.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: this.formatRange(sheetName, 'A:A'),
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [rowValues.map(v => (v === undefined || v === null ? '' : String(v)))],
        },
      });
      this.lastSyncTime = new Date().toISOString();
      return true;
    } catch (err: any) {
      console.error(`[GoogleSheets] Error appending row to ${sheetName}:`, err.message);
      this.lastError = err.message;
      return false;
    }
  }

  /**
   * Performs full batch overwrite of a collection tab with current records.
   */
  public async overwriteSheetData(sheetName: string, headers: string[], rows: (string | number | boolean | null | undefined)[][]): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      await this.ensureSheetExists(sheetName);
      const allData = [
        headers,
        ...rows.map(r => r.map(v => (v === undefined || v === null ? '' : String(v)))),
      ];

      // Clear existing content
      await this.sheetsApi.spreadsheets.values.clear({
        spreadsheetId: this.spreadsheetId,
        range: this.formatRange(sheetName, 'A:ZZ'),
      });

      // Write updated content
      await this.sheetsApi.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: this.formatRange(sheetName, 'A1'),
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: allData,
        },
      });

      this.lastSyncTime = new Date().toISOString();
      return true;
    } catch (err: any) {
      console.error(`[GoogleSheets] Error overwriting ${sheetName}:`, err.message);
      this.lastError = err.message;
      return false;
    }
  }

  /**
   * Reads all data from a sheet tab.
   */
  public async readSheet(sheetName: string): Promise<string[][]> {
    if (!this.isConfigured()) return [];
    try {
      await this.ensureSheetExists(sheetName);
      const res = await this.sheetsApi.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: this.formatRange(sheetName, 'A:ZZ'),
      });
      this.lastSyncTime = new Date().toISOString();
      return res.data.values || [];
    } catch (err: any) {
      console.error(`[GoogleSheets] Error reading ${sheetName}:`, err.message);
      this.lastError = err.message;
      return [];
    }
  }
}

export const googleSheetsService = new GoogleSheetsService();
