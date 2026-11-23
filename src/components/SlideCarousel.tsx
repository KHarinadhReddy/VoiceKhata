import { useState } from 'react';
import { BarChart3, History, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { useStore } from '../lib/store';

export function SlideCarousel() {
  const { todaySummary, transactions, customers } = useStore();
  const [slide, setSlide] = useState(0);

  const profit = todaySummary.totalCredit;
  const loss = todaySummary.totalPayment;
  const net = profit - loss;
  const maxVal = Math.max(profit, loss, 1);

  const icons = [BarChart3, History, TrendingUp];
  const Icon = icons[slide];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Icon className="w-4 h-4 text-orange-600" /> {slide === 0 ? 'Revenue' : slide === 1 ? 'History' : 'Net'}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setSlide((s) => Math.max(0, s - 1))}
            disabled={slide === 0}
            className="px-3 py-1 rounded-lg bg-gray-100 text-gray-700 font-bold disabled:opacity-40"
          >
            ‹
          </button>
          <button
            onClick={() => setSlide((s) => Math.min(2, s + 1))}
            disabled={slide === 2}
            className="px-3 py-1 rounded-lg bg-gray-100 text-gray-700 font-bold disabled:opacity-40"
          >
            ›
          </button>
        </div>
      </div>

      {slide === 0 && (
        <div>
          <div className="flex items-end gap-3 h-32">
            <div className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full bg-green-500 rounded-t-lg" style={{ height: `${(profit / maxVal) * 100}%` }} />
              <span className="text-xs text-gray-500">Profit: ₹{Math.round(profit).toString()}</span>
            </div>
            <div className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full bg-red-400 rounded-t-lg" style={{ height: `${(loss / maxVal) * 100}%` }} />
              <span className="text-xs text-gray-500">Loss: ₹{Math.round(loss).toString()}</span>
            </div>
          </div>
          <div className="mt-3 text-sm font-medium text-gray-700">Net Profit / Loss: ₹{Math.round(net).toString()}</div>
        </div>
      )}

      {slide === 1 && (
        <div className="max-h-64 overflow-y-auto">
          {transactions.length === 0 ? (
            <p className="text-sm text-gray-500">No transactions yet</p>
          ) : (
            transactions.slice(0, 20).map((tx) => {
              const customer = customers.find((c) => c.id === tx.customerId);
              return (
                <div key={tx.id} className="px-4 py-3 border-b border-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{customer?.name}</div>
                      <div className="text-xs text-gray-400">{new Date(tx.date).toLocaleDateString()}</div>
                    </div>
                    <div className={`font-bold text-sm ${tx.type === 'credit' ? 'text-orange-600' : 'text-green-600'}`}>
                      {tx.type === 'credit' ? '+' : '-'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {slide === 2 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <TrendingUp className="w-3 h-3" />
              <span>Credit</span>
            </div>
            <div className="font-bold text-gray-900">₹{Math.round(todaySummary.totalCredit).toString()}</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <TrendingDown className="w-3 h-3" />
              <span>Payment</span>
            </div>
            <div className="font-bold text-gray-900">₹{Math.round(todaySummary.totalPayment).toString()}</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Wallet className="w-3 h-3" />
              <span>Net</span>
            </div>
            <div className="font-bold text-gray-900">₹{Math.round(net).toString()}</div>
          </div>
        </div>
      )}

      <div className="flex justify-center gap-2 mt-4">
        {[0, 1, 2].map((i) => (
          <button
            key={i}
            onClick={() => setSlide(i)}
            className={`w-2 h-2 rounded-full ${slide === i ? 'bg-orange-500' : 'bg-gray-300'}`}
          />
        ))}
      </div>
    </div>
  );
}
