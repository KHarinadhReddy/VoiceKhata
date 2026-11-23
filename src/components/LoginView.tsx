import { useState } from 'react';
import { Mic, Volume2 } from 'lucide-react';
import { useStore } from '../lib/store';

export function LoginView() {
  const { shopkeeperName, setShopkeeperName } = useStore();
  const [name, setName] = useState(shopkeeperName || '');
  const [error, setError] = useState('');

  const submit = () => {
    if (!name.trim()) {
      setError('Please enter your shop name or your name');
      return;
    }
    setShopkeeperName(name.trim());
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-amber-50 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center mb-3">
            <Mic className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Voice Khata</h1>
          <p className="text-sm text-gray-500 mt-1">Voice-first udhara ledger</p>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Shop name / your name (e.g. Ramesh)"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={submit}
            className="w-full bg-orange-600 text-white rounded-xl py-3 font-semibold hover:bg-orange-700 transition-colors"
          >
            Login
          </button>
        </div>

        <div className="mt-6 flex items-center gap-2 text-xs text-gray-400 justify-center">
          <Volume2 className="w-3 h-3" />
          <span>Speak. Record. Understand.</span>
        </div>
      </div>
    </div>
  );
}
