import { useState } from 'react';
import { Users, Wallet, CreditCard, TrendingUp, TrendingDown, History, UserPlus, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';

export function LedgerView() {
  const { ledger, todaySummary, customers, transactions, deleteTransaction, deleteCustomer } = useStore();
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount);
    return `₹${formatted}`;
  };

  const stats = [
    { label: "Today's Credit", value: formatCurrency(todaySummary.totalCredit), icon: TrendingUp, color: 'text-green-600' },
    { label: "Today's Payment", value: formatCurrency(todaySummary.totalPayment), icon: TrendingDown, color: 'text-blue-600' },
    { label: 'Net', value: formatCurrency(todaySummary.net), icon: Wallet, color: 'text-purple-600' },
    { label: 'Customers', value: String(customers.length), icon: Users, color: 'text-orange-600' },
  ];

  const selectedEntry = ledger.find((e) => e.customer.id === selectedCustomer);

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-xs text-gray-500 font-medium">{stat.label}</span>
            </div>
            <div className="text-xl font-bold text-gray-900">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Ledger List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Ledger</h2>
        </div>
        
        {ledger.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <History className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No udhaar yet</p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {ledger.map((entry) => (
              <div
                key={entry.customer.id}
                onClick={() => setSelectedCustomer(selectedCustomer === entry.customer.id ? null : entry.customer.id)}
                className="w-full px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors text-left cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                      <UserPlus className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{entry.customer.name}</div>
                      <div className="text-xs text-gray-400">
                        {entry.lastTransaction ? new Date(entry.lastTransaction.date).toLocaleDateString() : 'New customer'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className={`font-bold ${entry.balance > 0 ? 'text-orange-600' : entry.balance < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                        {formatCurrency(entry.balance)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {entry.totalCredit > 0 && `Credit: ${formatCurrency(entry.totalCredit)}`}
                        {entry.totalPayment > 0 && `Paid: ${formatCurrency(entry.totalPayment)}`}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteCustomer(entry.customer.id); }}
                      className="p-1.5 rounded-full hover:bg-red-50 transition-colors"
                      title="Delete customer & entries"
                    >
                      <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Customer Detail */}
      {selectedEntry && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">{selectedEntry.customer.name}</h3>
          
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <CreditCard className="w-3 h-3" />
                <span>Total Credit</span>
              </div>
              <div className="font-bold text-gray-900">{formatCurrency(selectedEntry.totalCredit)}</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Wallet className="w-3 h-3" />
                <span>Total Paid</span>
              </div>
              <div className="font-bold text-gray-900">{formatCurrency(selectedEntry.totalPayment)}</div>
            </div>
          </div>

          {selectedEntry.lastTransaction && (
            <div className="text-xs bg-orange-50 rounded-xl p-3">
              <div className="font-medium text-orange-800">Last Transaction</div>
              <div className="text-orange-700">
                {selectedEntry.lastTransaction.type === 'credit' ? 'Credit' : 'Payment'} - {formatCurrency(selectedEntry.lastTransaction.amount)}
              </div>
              <div className="text-orange-600 text-xs mt-1">"{selectedEntry.lastTransaction.rawTranscript}"</div>
              <button
                onClick={() => deleteTransaction(selectedEntry.lastTransaction!.id)}
                className="mt-2 flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium"
              >
                <Trash2 className="w-3 h-3" /> Delete this entry
              </button>
            </div>
          )}

          <button
            onClick={() => selectedEntry && deleteCustomer(selectedEntry.customer.id)}
            className="mt-3 text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" /> Remove customer & their entries
          </button>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Recent Transactions</h2>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="text-sm">No transactions yet</p>
            </div>
          ) : (
            transactions.slice(0, 10).map((tx) => {
              const customer = customers.find((c) => c.id === tx.customerId);
              return (
                <div key={tx.id} className="px-4 py-3 border-b border-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{customer?.name}</div>
                      <div className="text-xs text-gray-400">{new Date(tx.date).toLocaleDateString()}</div>
                    </div>
                    <div className={`font-bold text-sm ${tx.type === 'credit' ? 'text-orange-600' : 'text-green-600'}`}>
                      {tx.type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </div>
                    <button
                      onClick={() => deleteTransaction(tx.id)}
                      className="p-1.5 rounded-full hover:bg-red-50 transition-colors"
                      title="Delete entry"
                    >
                      <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
