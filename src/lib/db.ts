import { Capacitor } from '@capacitor/core';

export interface Customer {
  id: string;
  name: string;
  aliases: string[];
  phone?: string;
  optedInReminders: boolean;
  createdAt: number;
}

export interface Transaction {
  id: string;
  customerId: string;
  amount: number;
  type: 'credit' | 'payment';
  date: number;
  rawTranscript: string;
  confidence: number;
  createdAt: number;
  language?: string;
}

export interface LedgerEntry {
  customer: Customer;
  totalCredit: number;
  totalPayment: number;
  balance: number;
  lastTransaction?: Transaction;
}

class Database {
  private db: any = null;
  private isWeb = Capacitor.getPlatform() === 'web';
  private sqlJs: any = null;

  async init() {
    if (this.isWeb) {
      await this.initWeb();
    }
    await this.createTables();
  }

  private async initWeb() {
    const initSqlJs = (await import('sql.js')).default;
    this.sqlJs = await initSqlJs({
      // Relative path so the wasm resolves under the Pages path (e.g. /VoiceKhata/)
      locateFile: () => 'sql-wasm.wasm'
    });
    const saved = localStorage.getItem('voice_khata_db');
    if (saved) {
      const uint8 = new Uint8Array(JSON.parse(saved));
      this.db = new this.sqlJs.Database(uint8);
    } else {
      this.db = new this.sqlJs.Database();
    }
  }

  private async createTables() {
    const schema = `
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        aliases TEXT NOT NULL,
        phone TEXT,
        opted_in_reminders INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('credit', 'payment')),
        date INTEGER NOT NULL,
        raw_transcript TEXT NOT NULL,
        confidence REAL NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY(customer_id) REFERENCES customers(id)
      );
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        before_json TEXT,
        after_json TEXT,
        timestamp INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    `;
    await this.exec(schema);
  }

  private async exec(sql: string, params: any[] = []) {
    if (this.isWeb) {
      this.db!.exec(sql);
      this.persistWeb();
    } else {
      await (this.db as any).execute(sql, params);
    }
  }

  async run(sql: string, params: any[] = []) {
    if (this.isWeb) {
      const stmt = (this.db as any).prepare(sql);
      stmt.bind(params);
      stmt.step();
      stmt.free();
      this.persistWeb();
      return { changes: 1 };
    } else {
      return await (this.db as any).run(sql, params);
    }
  }

  private async query(sql: string, params: any[] = []): Promise<any[]> {
    if (this.isWeb) {
      const stmt = (this.db as any).prepare(sql);
      stmt.bind(params);
      const results: any[] = [];
      while (stmt.step()) results.push(stmt.getAsObject());
      stmt.free();
      return results;
    } else {
      const res = await (this.db as any).query(sql, params);
      return res.values || [];
    }
  }

  private persistWeb() {
    if (this.isWeb && this.db) {
      localStorage.setItem('voice_khata_db', JSON.stringify(Array.from((this.db as any).export())));
    }
  }

  async addCustomer(customer: Customer) {
    await this.run(
      'INSERT INTO customers (id, name, aliases, phone, opted_in_reminders, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [customer.id, customer.name, JSON.stringify(customer.aliases), customer.phone || null, customer.optedInReminders ? 1 : 0, customer.createdAt]
    );
  }

  async getCustomers(): Promise<Customer[]> {
    const rows = await this.query('SELECT * FROM customers ORDER BY name');
    return (rows as any[]).map((r: any) => ({ ...r, aliases: JSON.parse(r.aliases), optedInReminders: Boolean(r.opted_in_reminders) }));
  }

  async findCustomerByName(name: string): Promise<Customer[]> {
    const rows = await this.query(`SELECT * FROM customers WHERE name LIKE ? OR ? IN (SELECT value FROM json_each(aliases))`, [`%${name}%`, name]);
    return (rows as any[]).map((r: any) => ({ ...r, aliases: JSON.parse(r.aliases), optedInReminders: Boolean(r.opted_in_reminders) }));
  }

  async addTransaction(tx: Transaction) {
    await this.run(
      'INSERT INTO transactions (id, customer_id, amount, type, date, raw_transcript, confidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [tx.id, tx.customerId, tx.amount, tx.type, tx.date, tx.rawTranscript, tx.confidence, tx.createdAt]
    );
  }

  async getTransactions(customerId?: string, startDate?: number, endDate?: number): Promise<Transaction[]> {
    let sql = 'SELECT * FROM transactions WHERE 1=1';
    const params: any[] = [];
    if (customerId) { sql += ' AND customer_id = ?'; params.push(customerId); }
    if (startDate) { sql += ' AND date >= ?'; params.push(startDate); }
    if (endDate) { sql += ' AND date <= ?'; params.push(endDate); }
    sql += ' ORDER BY date DESC';
    const rows = await this.query(sql, params);
    return rows as Transaction[];
  }

  async getLedger(): Promise<LedgerEntry[]> {
    const customers = await this.getCustomers();
    const entries: LedgerEntry[] = [];
    for (const c of customers) {
      const txs = await this.getTransactions(c.id);
      const totalCredit = txs.filter((t) => t.type === 'credit').reduce((s: number, t) => s + t.amount, 0);
      const totalPayment = txs.filter((t) => t.type === 'payment').reduce((s: number, t) => s + t.amount, 0);
      entries.push({
        customer: c,
        totalCredit,
        totalPayment,
        balance: totalCredit - totalPayment,
        lastTransaction: txs[0]
      });
    }
    return entries;
  }

  async getTodaySummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const txs = await this.getTransactions(undefined, today.getTime(), tomorrow.getTime() - 1);
    const totalCredit = txs.filter((t) => t.type === 'credit').reduce((s: number, t) => s + t.amount, 0);
    const totalPayment = txs.filter((t) => t.type === 'payment').reduce((s: number, t) => s + t.amount, 0);
    return { totalCredit, totalPayment, net: totalCredit - totalPayment, count: txs.length };
  }

  async updateTransactionAmount(txId: string, amount: number) {
    await this.run('UPDATE transactions SET amount = ? WHERE id = ?', [amount, txId]);
  }

  async getTransactionById(txId: string): Promise<Transaction | null> {
    const rows = await this.query('SELECT * FROM transactions WHERE id = ?', [txId]);
    const row = (rows as any[])[0];
    return row ? (row as Transaction) : null;
  }

  async deleteTransaction(txId: string) {
    await this.run('DELETE FROM transactions WHERE id = ?', [txId]);
  }

  async deleteCustomer(customerId: string) {
    // Remove customer's transactions first, then the customer
    await this.run('DELETE FROM transactions WHERE customer_id = ?', [customerId]);
    await this.run('DELETE FROM customers WHERE id = ?', [customerId]);
  }

  async clearAllData() {
    await this.run('DELETE FROM transactions', []);
    await this.run('DELETE FROM customers', []);
    this.persistWeb();
  }
}
export const db = new Database();
