import { useEffect } from 'react';
import { Mic, MicOff, Loader2, X } from 'lucide-react';
import { useStore } from '../lib/store';

export function MicButton() {
  const { isListening, isProcessing, startListening, stopListening, error, clearError, transcript, lastResponse } = useStore();

  useEffect(() => {
    if (error) {
      const timer = setTimeout(clearError, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  const handlePress = async () => {
    if (isListening) {
      await stopListening();
    } else {
      await startListening();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      handlePress();
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <button
        onClick={handlePress}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        aria-label={isListening ? 'Stop listening' : 'Start listening'}
        className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-offset-2 ${isListening ? 'bg-red-500 ring-red-300 animate-pulse shadow-[0_0_0_8px_rgba(239,68,68,0.4)]' : 'bg-green-500 ring-green-300 hover:bg-green-600 shadow-[0_0_0_4px_rgba(34,197,94,0.3)]'} ${isProcessing ? ' opacity-75 cursor-wait' : ' cursor-pointer'}`}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <Loader2 className="w-10 h-10 text-white animate-spin" />
        ) : isListening ? (
          <MicOff className="w-10 h-10 text-white" />
        ) : (
          <Mic className="w-10 h-10 text-white" />
        )}
        
        {isListening && !isProcessing && (
          <>
            <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-75" />
            <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-50" style={{animationDelay: '500ms'}} />
          </>
        )}
      </button>

      <div className="text-center px-4">
        {isListening && (
          <p className="text-lg font-medium text-red-600 animate-pulse">सुन रहा हूँ... बोलें</p>
        )}
        {isProcessing && (
          <p className="text-lg font-medium text-blue-600">समझ रहा हूँ...</p>
        )}
        {!isListening && !isProcessing && !lastResponse && (
          <p className="text-gray-500">माइक दबाकर बोलें</p>
        )}
        {transcript && !isListening && !isProcessing && (
          <p className="text-sm text-gray-600 italic max-w-xs mx-auto">"{transcript}"</p>
        )}
        {lastResponse && !isListening && !isProcessing && (
          <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg max-w-xs mx-auto">{lastResponse}</p>
        )}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg max-w-xs mx-auto flex items-center gap-2">
            <X className="w-4 h-4" />
            {error}
          </p>
        )}
      </div>

      {isListening && (
        <div className="flex items-center gap-1 h-6">
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="w-1.5 bg-red-400 rounded animate-pulse" style={{height: `${20 + Math.random() * 40}px`, animationDelay: `${i * 50}ms`}} />
          ))}
        </div>
      )}
    </div>
  );
}