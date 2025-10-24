
import React from 'react';
import { useBibleStudy } from './hooks/useBibleStudy';
import { MicrophoneIcon, StopIcon, LoadingIcon, SpeakingIcon, ThinkingIcon } from './components/IconComponents';
import { SessionStatus } from './types';

const App: React.FC = () => {
  const { 
    status, 
    transcript, 
    startSession, 
    endSession 
  } = useBibleStudy();

  const isSessionActive = status !== SessionStatus.IDLE && status !== SessionStatus.ERROR;

  const renderStatusIndicator = () => {
    switch (status) {
      case SessionStatus.LISTENING:
        return <div className="flex items-center text-blue-400"><MicrophoneIcon className="w-5 h-5 mr-2 animate-pulse" /> Listening...</div>;
      case SessionStatus.THINKING:
        return <div className="flex items-center text-purple-400"><ThinkingIcon className="w-5 h-5 mr-2 animate-spin" /> Thinking...</div>;
      case SessionStatus.SPEAKING:
        return <div className="flex items-center text-green-400"><SpeakingIcon className="w-5 h-5 mr-2" /> Speaking...</div>;
       case SessionStatus.ERROR:
        return <div className="flex items-center text-red-400">An error occurred. Please refresh.</div>;
      default:
        return <div className="flex items-center text-slate-400">Press Start to begin</div>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl mx-auto flex flex-col h-[90vh] bg-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        <header className="p-4 border-b border-slate-700 text-center">
          <h1 className="text-2xl font-bold text-white">Socratic Bible Study</h1>
          <p className="text-sm text-slate-400">An Interactive Exploration of John 3:16</p>
        </header>

        <main className="flex-1 p-6 overflow-y-auto space-y-6">
          <div className="p-4 bg-slate-900/50 rounded-lg">
            <h2 className="text-lg font-semibold text-white">John 3:16 (KJV)</h2>
            <blockquote className="mt-2 text-slate-300 italic border-l-4 border-blue-500 pl-4">
              "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life."
            </blockquote>
          </div>
          
          <div className="space-y-4">
            {transcript.map((entry, index) => (
              <div key={index} className={`flex items-start gap-3 ${entry.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
                {entry.speaker === 'facilitator' && <div className="w-8 h-8 rounded-full bg-blue-500 flex-shrink-0"></div>}
                <div className={`max-w-[80%] p-3 rounded-lg ${entry.speaker === 'user' ? 'bg-slate-700' : 'bg-slate-700/50'}`}>
                  <p className="text-sm">{entry.text}</p>
                </div>
                {entry.speaker === 'user' && <div className="w-8 h-8 rounded-full bg-purple-500 flex-shrink-0"></div>}
              </div>
            ))}
          </div>
        </main>

        <footer className="p-4 bg-slate-900/50 border-t border-slate-700 flex items-center justify-between">
          <div className="text-sm font-medium">{renderStatusIndicator()}</div>
          {!isSessionActive ? (
            <button
              onClick={startSession}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:bg-slate-500 disabled:cursor-not-allowed"
              disabled={isSessionActive}
            >
              <MicrophoneIcon className="w-5 h-5" />
              Start Session
            </button>
          ) : (
            <button
              onClick={endSession}
              className="px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
            >
              <StopIcon className="w-5 h-5" />
              End Session
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};

export default App;
