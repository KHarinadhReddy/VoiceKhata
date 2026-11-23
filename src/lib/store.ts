import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { db } from './db';
import type { Customer, Transaction, LedgerEntry } from './db';
import { extractAmount, extractCustomerName, extractIntent, extractDate, detectLanguage as detectLanguageFn } from './numberParser';
import { speech } from './speech';

export interface PendingAction {
  customerId: string;
  customerName: string;
  amount: number;
  type: 'credit' | 'payment';
  date: number;
  transcript: string;
  confidence: number;
  language?: string;
}

export interface StatusPipeline {
  heard: string;
  parsed: string;
  status: 'idle' | 'parsing' | 'confirming' | 'saved' | 'corrected' | 'deleted' | 'query' | 'error';
}

interface AppState {
  customers: Customer[];
  transactions: Transaction[];
  ledger: LedgerEntry[];
  todaySummary: { totalCredit: number; totalPayment: number; net: number; count: number };
  isListening: boolean;
  isProcessing: boolean;
  transcript: string;
  lastResponse: string;
  error: string | null;
  aiDisclosed: boolean;
  language: string;
  pendingAction: PendingAction | null;
  statusPipeline: StatusPipeline;
  lastActiveCustomerId: string | null;
  lastSavedTxId: string | null;
  shopkeeperName: string;
  init: () => Promise<void>;
  loadData: () => Promise<void>;
  processTranscript: (text: string, confidence: number) => Promise<void>;
  confirmPending: () => Promise<void>;
  rejectPending: () => Promise<void>;
  addCustomer: (name: string, aliases?: string[]) => Promise<void>;
  speakResponse: (text: string) => Promise<void>;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  clearError: () => void;
  setAiDisclosed: () => void;
  setCustomerOptIn: (customerId: string, optedIn: boolean) => Promise<void>;
  sendReminder: (customerId: string) => Promise<void>;
  setLanguage: (lang: string) => void;
  resetDemo: () => Promise<void>;
  setShopkeeperName: (name: string) => void;
  deleteTransaction: (txId: string) => Promise<void>;
  deleteCustomer: (customerId: string) => Promise<void>;
  detectLanguage: (text: string) => string;
}

const EMPTY_PIPELINE: StatusPipeline = { heard: '', parsed: '', status: 'idle' };

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      customers: [],
      transactions: [],
      ledger: [],
      todaySummary: { totalCredit: 0, totalPayment: 0, net: 0, count: 0 },
      isListening: false,
      isProcessing: false,
      transcript: '',
      lastResponse: '',
      error: null,
      aiDisclosed: false,
      language: 'en-IN',
      pendingAction: null,
      statusPipeline: EMPTY_PIPELINE,
      lastActiveCustomerId: null,
      lastSavedTxId: null,
      shopkeeperName: '',

      init: async () => {
        await db.init();
        await get().loadData();
        // Force English-first default for the demo (overrides any persisted value)
        set({ language: 'en-IN' });
        speech.setLanguage('en-IN');
        const ok = await speech.init();
        if (!ok) {
          set({ error: 'Microphone not available. Please check mic permission in browser settings and try again.' });
        }
      },

      loadData: async () => {
        const [customers, ledger, todaySummary] = await Promise.all([
          db.getCustomers(),
          db.getLedger(),
          db.getTodaySummary()
        ]);
        set({ customers, ledger, todaySummary });
      },

      processTranscript: async (text: string, confidence: number) => {
        const lower = text.toLowerCase().trim();
        const pending = get().pendingAction;

        // Confirmation handling
        if (pending) {
          if (/^(haan|ha|yes|theek|sahi|correct|ok|thik|bilkul)\b/.test(lower)) {
            await get().confirmPending();
            return;
          }
          if (/^(nahi|no|galat|wrong|cancel|cancel)\b/.test(lower)) {
            await get().rejectPending();
            return;
          }
        }

        const pipeline: StatusPipeline = { heard: text, parsed: '', status: 'parsing' };
        set({ isProcessing: true, transcript: text, error: null, statusPipeline: pipeline, pendingAction: null });
        try {
          const knownNames = get().customers.flatMap((c) => [c.name, ...c.aliases]);
          let amountResult = extractAmount(text);
          const customerName = extractCustomerName(text, knownNames);
          const intent = extractIntent(text);
          const date = extractDate(text);
          if (!amountResult && intent === 'credit') {
            // "Even if there is a word [credit], it has to credit too the khata":
            // a credit word with no parseable amount still creates a credit entry.
            amountResult = { amount: 1, confidence: 0.5, raw: 'credit-word only' };
          }

          // Resolve customer
          let customer: Customer | null = null;
          if (customerName) {
            const matches = await db.findCustomerByName(customerName);
            if (matches.length === 1) {
              customer = matches[0];
            } else if (matches.length > 1) {
              const names = matches.map((m) => m.name).join(' ya ');
              await get().speakResponse(`Which customer? ${names}`);
              set({ isProcessing: false, statusPipeline: { ...pipeline, status: 'error', parsed: 'Ambiguous name' } });
              return;
            } else {
              const newCustomer: Customer = {
                id: crypto.randomUUID(),
                name: customerName,
                aliases: [],
                optedInReminders: false,
                createdAt: Date.now()
              };
              await db.addCustomer(newCustomer);
              customer = newCustomer;
            }
          }

          let response = '';
          let newPipeline = pipeline;

          switch (intent) {
            case 'credit':
            case 'payment': {
              const type = intent;
              let effectiveCustomer = customer;
              const contextWords = ['aur', 'waise', 'phir', 'aurhi', 'aur se'];
              const hasContext = contextWords.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(text));
              if (!customer && hasContext && get().lastActiveCustomerId) {
                effectiveCustomer = get().customers.find((c) => c.id === get().lastActiveCustomerId) || customer;
              }
              if (!effectiveCustomer) {
                response = 'Please tell the customer name';
                newPipeline = { ...pipeline, status: 'error', parsed: 'No customer' };
                break;
              }
              if (!amountResult) {
                response = 'Please tell the amount';
                newPipeline = { ...pipeline, status: 'error', parsed: 'No amount' };
                break;
              }
              // Ask for confirmation
              const typeLabel = type === 'credit' ? 'credit (udhaar)' : 'payment';
              const pending: PendingAction = {
                customerId: effectiveCustomer.id,
                customerName: effectiveCustomer.name,
                amount: amountResult.amount,
                type,
                date,
                transcript: text,
                confidence: Math.min(confidence, amountResult.confidence)
              };
              set({
                pendingAction: pending,
                statusPipeline: {
                  heard: text,
                  parsed: `${effectiveCustomer.name} — ₹${amountResult.amount} ${typeLabel}`,
                  status: 'confirming'
                }
              });
              await get().speakResponse(`${effectiveCustomer.name}, ${amountResult.amount} rupees ${typeLabel}. Correct?`);
              set({ isProcessing: false });
              return;
            }

            case 'query': {
              if (customer) {
                const entry = (await db.getLedger()).find((e) => e.customer.id === customer!.id);
                if (entry) {
                  if (entry.balance > 0) {
                    response = `${customer!.name} has ${entry.balance} rupees pending`;
                    newPipeline = { ...pipeline, status: 'query', parsed: `${customer!.name}: ₹${entry.balance} pending` };
                  } else if (entry.balance < 0) {
                    response = `${customer!.name} owes you ${Math.abs(entry.balance)} rupees`;
                    newPipeline = { ...pipeline, status: 'query', parsed: `${customer!.name}: ₹${Math.abs(entry.balance)} to pay` };
                  } else {
                    response = `${customer!.name}'s account is settled`;
                    newPipeline = { ...pipeline, status: 'query', parsed: `${customer!.name}: settled` };
                  }
                }
              } else {
                const summary = await db.getTodaySummary();
                response = `Today: ${summary.totalCredit} credit, ${summary.totalPayment} payment, net ${summary.net} rupees`;
                newPipeline = { ...pipeline, status: 'query', parsed: `Today ₹${summary.totalCredit} credit / ₹${summary.totalPayment} paid` };
              }
              break;
            }

            case 'correction': {
              // Correction: update the most recent transaction of the customer
              const targetCustomerId = customer?.id || get().lastActiveCustomerId;
              if (!targetCustomerId) {
                response = 'Which entry should I correct?';
                newPipeline = { ...pipeline, status: 'error', parsed: 'No target for correction' };
                break;
              }
              const txs = await db.getTransactions(targetCustomerId);
              if (txs.length === 0) {
                response = 'No entry to correct';
                newPipeline = { ...pipeline, status: 'error', parsed: 'No entry' };
                break;
              }
              const lastTx = txs[0];
              const newAmount = amountResult ? amountResult.amount : lastTx.amount;
              await db.updateTransactionAmount(lastTx.id, newAmount);
              const name = customer?.name || get().customers.find((c) => c.id === targetCustomerId)?.name || 'Customer';
              set({ lastActiveCustomerId: targetCustomerId });
              response = `Corrected: ${name} ${lastTx.amount} to ${newAmount} rupees`;
              newPipeline = { ...pipeline, status: 'corrected', parsed: `${name}: ₹${lastTx.amount} → ₹${newAmount}` };
              await get().loadData();
              break;
            }

            case 'delete': {
              const targetCustomerId = customer?.id || get().lastActiveCustomerId;
              if (!targetCustomerId) {
                response = 'Which entry should I delete?';
                newPipeline = { ...pipeline, status: 'error', parsed: 'No target for delete' };
                break;
              }
              const txs = await db.getTransactions(targetCustomerId);
              if (txs.length === 0) {
                response = 'No entry to delete';
                newPipeline = { ...pipeline, status: 'error', parsed: 'No entry' };
                break;
              }
              const lastTx = txs[0];
              await db.deleteTransaction(lastTx.id);
              const name = customer?.name || get().customers.find((c) => c.id === targetCustomerId)?.name || 'Customer';
              set({ lastActiveCustomerId: null });
              response = `Deleted: ${name} ${lastTx.amount} rupees entry`;
              newPipeline = { ...pipeline, status: 'deleted', parsed: `${name}: entry deleted` };
              await get().loadData();
              break;
            }

            default: {
              if (!get().aiDisclosed) {
                response = 'I am an AI assistant. Tell me name and amount, e.g. Ramesh ka 340 udhaar';
                get().setAiDisclosed();
              } else {
                response = 'Sorry, I did not understand. Please say again.';
              }
              newPipeline = { ...pipeline, status: 'error', parsed: 'Not understood' };
            }
          }

          await get().loadData();
          set({ statusPipeline: newPipeline });
          await get().speakResponse(response);
        } catch (e: any) {
          console.error('Process error:', e);
          set({ error: e.message, statusPipeline: { heard: text, parsed: 'Error', status: 'error' } });
          await get().speakResponse('Error. Please try again.');
        } finally {
          set({ isProcessing: false });
          // Keep mic always listening: auto-restart after processing completes
          if (!get().pendingAction) {
            void get().startListening();
          }
        }
      },

      confirmPending: async () => {
        const pending = get().pendingAction;
        if (!pending) return;
        const tx: Transaction = {
          id: crypto.randomUUID(),
          customerId: pending.customerId,
          amount: pending.amount,
          type: pending.type,
          date: pending.date,
          rawTranscript: pending.transcript,
          confidence: pending.confidence,
          createdAt: Date.now(),
          language: pending.language || get().language
        };
        await db.addTransaction(tx);
        await get().loadData();
        const typeLabel = pending.type === 'credit' ? 'credit' : 'payment';
        const response = `Saved: ${pending.customerName} ₹${pending.amount} ${typeLabel}`;
        set({
          pendingAction: null,
          lastActiveCustomerId: pending.customerId,
          lastSavedTxId: tx.id,
          statusPipeline: {
            heard: pending.transcript,
            parsed: `${pending.customerName} — ₹${pending.amount} ${typeLabel}`,
            status: 'saved'
          }
        });
        await get().speakResponse(response);
      },

      rejectPending: async () => {
        const pending = get().pendingAction;
        if (!pending) return;
        set({
          pendingAction: null,
          statusPipeline: {
            heard: pending.transcript,
            parsed: `${pending.customerName} — ₹${pending.amount} (cancelled)`,
            status: 'error'
          }
        });
        await get().speakResponse('Cancelled. Please say the correct amount.');
      },

      addCustomer: async (name: string, aliases: string[] = []) => {
        const customer: Customer = {
          id: crypto.randomUUID(),
          name,
          aliases,
          optedInReminders: false,
          createdAt: Date.now()
        };
        await db.addCustomer(customer);
        await get().loadData();
      },

      speakResponse: async (text: string) => {
        set({ lastResponse: text });
        await speech.speak(text, get().language);
      },

      startListening: async () => {
        if (get().isListening || get().isProcessing) return;
        set({ isListening: true, error: null });
        const cleanup = await speech.startListening(
          (result) => {
            if (result.isFinal && result.transcript.trim()) {
              const detected = detectLanguageFn(result.transcript);
              if (detected !== get().language) {
                set({ language: detected });
                speech.setLanguage(detected);
              }
              get().processTranscript(result.transcript, result.confidence);
            }
          },
          () => {
            set({ isListening: false });
          }
        );
        (window as any).__speechCleanup = cleanup;
        // If mic failed to start, reset listening state so UI doesn't stay stuck
        if (!speech.getIsListening()) {
          set({ isListening: false, error: 'Microphone not ready. Please tap the mic again.' });
        }
      },

      stopListening: async () => {
        await speech.stopListening();
        set({ isListening: false });
        if ((window as any).__speechCleanup) {
          (window as any).__speechCleanup();
        }
      },

      clearError: () => set({ error: null }),
      setAiDisclosed: () => set({ aiDisclosed: true }),
      setLanguage: (lang: string) => {
        set({ language: lang });
        speech.setLanguage(lang);
      },

      setCustomerOptIn: async (customerId: string, optedIn: boolean) => {
        set({
          customers: get().customers.map((c) => (c.id === customerId ? { ...c, optedInReminders: optedIn } : c))
        });
        await db.run('UPDATE customers SET opted_in_reminders = ? WHERE id = ?', [optedIn ? 1 : 0, customerId]);
      },

      sendReminder: async (customerId: string) => {
        const customer = get().customers.find((c) => c.id === customerId);
        if (!customer || !customer.optedInReminders) return;
        const entry = (await db.getLedger()).find((e) => e.customer.id === customerId);
        const balance = entry?.balance || 0;
        if (balance > 0) {
          const response = `Reminder: ${customer.name} has ${Math.round(balance)} rupees pending`;
          await get().speakResponse(response);
          try {
            const moduleName = '@capacitor-community/local-notifications';
            const localNotifModule: any = await import(moduleName);
            const notifications = localNotifModule.LocalNotifications;
            const perm = await notifications.requestPermissions();
            if (perm?.display === 'granted') {
              await notifications.schedule({
                notifications: [{
                  title: 'Voice Khata',
                  body: `${customer.name} has ${Math.round(balance)} rupees pending`,
                  id: Math.floor(Math.random() * 10000) + 1,
                  schedule: { at: new Date(Date.now() + 3600000) },
                  extra: { customerId }
                }]
              });
            }
          } catch (e) {
            console.warn('Reminder scheduling failed:', e);
          }
        }
      },

      resetDemo: async () => {
        await db.clearAllData();
        // Re-seed demo customers
        const demoCustomers: Array<{ name: string; balance: number }> = [
          { name: 'Ramesh', balance: 340 },
          { name: 'Suresh', balance: 120 },
          { name: 'Mohan', balance: 560 },
        ];
        for (const dc of demoCustomers) {
          const customer: Customer = {
            id: crypto.randomUUID(),
            name: dc.name,
            aliases: [],
            optedInReminders: false,
            createdAt: Date.now()
          };
          await db.addCustomer(customer);
          if (dc.balance > 0) {
            await db.addTransaction({
              id: crypto.randomUUID(),
              customerId: customer.id,
              amount: dc.balance,
              type: 'credit',
              date: Date.now(),
              rawTranscript: `${dc.name} ka ${dc.balance} udhaar`,
              confidence: 0.9,
              createdAt: Date.now()
            });
          }
        }
        set({ pendingAction: null, statusPipeline: EMPTY_PIPELINE, lastActiveCustomerId: null, lastSavedTxId: null });
        await get().loadData();
        await get().speakResponse('Demo reset. Ready.');
      },

      setShopkeeperName: (name: string) => set({ shopkeeperName: name }),

      deleteTransaction: async (txId: string) => {
        await db.deleteTransaction(txId);
        await get().loadData();
      },

      deleteCustomer: async (customerId: string) => {
        await db.deleteCustomer(customerId);
        await get().loadData();
      },

      detectLanguage: (text: string) => detectLanguageFn(text)
    }),
    {
      name: 'voice-khata-state',
      partialize: (state) => ({ aiDisclosed: state.aiDisclosed, language: state.language, shopkeeperName: state.shopkeeperName })
    }
  )
);
