import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { useStore } from '../lib/store';
import { SlideCarousel } from './SlideCarousel';

export function DashboardView() {
  const { todaySummary } = useStore();

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount);
    return `₹${formatted}`;
  };

  const profit = todaySummary.totalCredit;
  const loss = todaySummary.totalPayment;
  const net = profit - loss;

  return (
    <div className="space-y-6">
      {/* Three summary lines */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="text-xs text-gray-500 font-medium">Credit</span>
          </div>
          <div className="text-xl font-bold text-gray-900">{formatCurrency(todaySummary.totalCredit)}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-blue-600" />
            <span className="text-xs text-gray-500 font-medium">Payment</span>
          </div>
          <div className="text-xl font-bold text-gray-900">{formatCurrency(todaySummary.totalPayment)}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-4 h-4 text-purple-600" />
            <span className="text-xs text-gray-500 font-medium">Net</span>
          </div>
          <div className="text-xl font-bold text-gray-900">{formatCurrency(net)}</div>
        </div>
      </div>

      {/* Slides: Revenue / History / Net */}
      <SlideCarousel />
    </div>
  );
}
