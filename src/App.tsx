import { useEffect, useState } from 'react';
import { Mic, MicOff, ChevronDown, Check, X, RotateCcw, Volume2 } from 'lucide-react';
import { useStore } from './lib/store';
import { DashboardView } from './components/DashboardView';
import { LoginView } from './components/LoginView';
import { TaskBar } from './components/TaskBar';
import { SettingsView } from './components/SettingsView';
import { LedgerView } from './components/LedgerView';

const LANGUAGES = [
  { code: 'hi-IN', label: 'हिन्दी', name: 'Hindi' },
  { code: 'en-IN', label: 'English', name: 'English' },
  { code: 'ta-IN', label: 'தமிழ்', name: 'Tamil' },
  { code: 'te-IN', label: 'తెలుగు', name: 'Telugu' },
  { code: 'mr-IN', label: 'मराठी', name: 'Marathi' },
  { code: 'gu-IN', label: 'ગુજરાતી', name: 'Gujarati' },
  { code: 'bn-IN', label: 'বাংলা', name: 'Bengali' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ', name: 'Kannada' },
  { code: 'ml-IN', label: 'മലയാളം', name: 'Malayalam' },
  { code: 'pa-IN', label: 'ਪੰਜਾਬੀ', name: 'Punjabi' },
  { code: 'ur-IN', label: 'اردو', name: 'Urdu' },
];

export default function App() {
  const {
    init, isListening, isProcessing, startListening, stopListening,
    error, lastResponse, aiDisclosed, setAiDisclosed,
    pendingAction, statusPipeline, confirmPending, rejectPending,
    setLanguage, language, resetDemo, shopkeeperName,
  } = useStore();
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [view, setView] = useState<'dashboard' | 'history' | 'settings'>('dashboard');

  useEffect(() => {
    init();
  }, [init]);

  // Always keep mic listening once shopkeeper is logged in
  useEffect(() => {
    if (shopkeeperName) {
      startListening();
    }
  }, [shopkeeperName, startListening]);

  const handleMicPress = async () => {
    if (isListening) {
      await stopListening();
    } else {
      await startListening();
    }
  };

  const changeLanguage = (lang: string) => {
    setLanguage(lang);
    setShowLangPicker(false);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'saved': return 'bg-green-100 text-green-800 border-green-300';
      case 'corrected': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'deleted': return 'bg-red-100 text-red-800 border-red-300';
      case 'query': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'confirming': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'error': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const currentLang = LANGUAGES.find((l) => l.code === language);

  if (!shopkeeperName) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-amber-50 to-white text-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col min-h-screen">
        {/* Header */}
        <header className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">🔊 Voice Khata</h1>
            <p className="text-sm text-gray-500">Speak. Record. Understand.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => resetDemo()}
              title="Reset demo data"
              className="p-2 bg-white border border-gray-200 rounded-full text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowLangPicker(!showLangPicker)}
                className="flex items-center gap-1 bg-white border border-gray-200 rounded-full px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span>{currentLang?.label}</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              {showLangPicker && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50 max-h-72 overflow-y-auto">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => changeLanguage(lang.code)}
                      className={`w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0 ${language === lang.code ? 'bg-orange-50 font-semibold' : ''}`}
                    >
                      {lang.name} <span className="text-gray-400">({lang.label})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* AI Disclosure banner */}
        {!aiDisclosed && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
            <div className="text-sm text-blue-700">
              <strong>AI Disclosure:</strong> I'm an AI assistant.
            </div>
            <button
              onClick={() => setAiDisclosed()}
              className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full hover:bg-blue-700 transition-colors"
            >
              OK
            </button>
          </div>
        )}

        <main className="flex-1 space-y-5">
          {/* Mic Section */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-7">
            <div className="flex justify-center">
              <button
                onClick={handleMicPress}
                className={`w-44 h-44 rounded-full text-white shadow-2xl transition-transform duration-200 hover:scale-105 active:scale-95 flex items-center justify-center focus:outline-none focus:ring-4 ${
                  isListening
                    ? 'bg-gradient-to-br from-green-400 to-green-600 focus:ring-green-300'
                    : 'bg-gradient-to-br from-red-400 to-red-600 hover:from-red-500 hover:to-red-700 focus:ring-red-300'
                }`}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <div className="animate-spin rounded-full h-14 w-14 border-4 border-white border-t-transparent" />
                ) : isListening ? (
                  <Mic className="w-14 h-14 text-white" />
                ) : (
                  <MicOff className="w-14 h-14 text-white" />
                )}
              </button>
            </div>
            <p className="text-center text-gray-500 text-sm mt-4">
              {isListening ? 'Listening... speak now' : isProcessing ? 'Processing...' : 'Tap mic and speak'}
            </p>
          </div>

          {/* Status Pipeline */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${statusColor(statusPipeline.status)}`}>
                {statusPipeline.status === 'idle' ? 'Ready' : statusPipeline.status}
              </span>
            </div>
            {statusPipeline.heard && (
              <div className="text-sm">
                <span className="text-xs font-medium text-gray-400">Heard</span>
                <p className="text-gray-700 mt-0.5">"{statusPipeline.heard}"</p>
              </div>
            )}
            {statusPipeline.parsed && (
              <div className="text-sm">
                <span className="text-xs font-medium text-gray-400">Parsed</span>
                <p className="text-gray-900 font-medium mt-0.5">{statusPipeline.parsed}</p>
              </div>
            )}

            {/* Confirm / Reject buttons */}
            {pendingAction && (
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button
                  onClick={() => confirmPending()}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white rounded-xl py-3 font-semibold hover:bg-green-700 transition-colors"
                >
                  <Check className="w-4 h-4" /> Confirm
                </button>
                <button
                  onClick={() => rejectPending()}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-500 text-white rounded-xl py-3 font-semibold hover:bg-red-600 transition-colors"
                >
                  <X className="w-4 h-4" /> Wrong
                </button>
              </div>
            )}
          </div>

          {/* Assistant response */}
          {lastResponse && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <Volume2 className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <span className="text-xs font-medium text-gray-400">Assistant</span>
                <p className="text-gray-900 mt-0.5">{lastResponse}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
              {error}
            </div>
          )}

          {/* Main view */}
          {view === 'dashboard' && <DashboardView />}
          {view === 'history' && <LedgerView />}
          {view === 'settings' && <SettingsView />}
        </main>

        <TaskBar view={view} onNavigate={setView} />

        <footer className="mt-8 text-center text-xs text-gray-400 pb-4">
          Voice Khata — AI Disclosure: This is an AI assistant.
        </footer>
      </div>
    </div>
  );
}
