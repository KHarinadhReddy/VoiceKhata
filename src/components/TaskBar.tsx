import { Home, History, Settings } from 'lucide-react';

export type View = 'dashboard' | 'history' | 'settings';

export function TaskBar({ view, onNavigate }: { view: View; onNavigate: (v: View) => void }) {
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'history', label: 'History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50">
      {items.map((it) => {
        const Icon = it.icon;
        const active = view === it.id;
        return (
          <button
            key={it.id}
            onClick={() => onNavigate(it.id)}
            className={`flex-1 py-3 flex flex-col items-center gap-1 text-xs ${active ? 'text-orange-600 font-semibold' : 'text-gray-400'}`}
          >
            <Icon className="w-5 h-5" />
            {it.label}
          </button>
        );
      })}
    </nav>
  );
}
