import { RotateCcw } from 'lucide-react';
import { useStore } from '../lib/store';

export function SettingsView() {
  const { resetDemo } = useStore();

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <h2 className="font-semibold text-gray-900 mb-3">Settings</h2>
      <button
        onClick={() => resetDemo()}
        className="flex items-center gap-2 bg-red-50 text-red-600 rounded-xl px-4 py-3 font-medium hover:bg-red-100 transition-colors"
      >
        <RotateCcw className="w-4 h-4" /> Reset Demo Data
      </button>
      <p className="text-xs text-gray-400 mt-3">Voice Khata — AI Disclosure: This is an AI assistant.</p>
    </div>
  );
}
