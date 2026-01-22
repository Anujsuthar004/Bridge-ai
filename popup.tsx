import { useState } from 'react';
import './style.css';

function IndexPopup() {
  const [isEnabled, setIsEnabled] = useState(true);

  const platforms = [
    { name: 'ChatGPT', url: 'https://chat.openai.com', icon: '🤖', color: '#10a37f' },
    { name: 'Claude', url: 'https://claude.ai', icon: '🧠', color: '#d97706' },
    { name: 'Gemini', url: 'https://gemini.google.com', icon: '✨', color: '#4285f4' },
  ];

  return (
    <div className="w-80 p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 min-h-[320px]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-bridge-primary to-bridge-secondary flex items-center justify-center shadow-lg">
          <span className="text-white text-xl">🌉</span>
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">BridgeAI</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Context Transfer Tool</p>
        </div>
      </div>

      {/* Status Toggle */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-gray-800 shadow-sm mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-green-500' : 'bg-gray-400'}`} />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {isEnabled ? 'Active' : 'Disabled'}
          </span>
        </div>
        <button
          onClick={() => setIsEnabled(!isEnabled)}
          className={`relative w-12 h-6 rounded-full transition-colors ${isEnabled ? 'bg-bridge-primary' : 'bg-gray-300 dark:bg-gray-600'
            }`}
        >
          <div
            className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-transform ${isEnabled ? 'translate-x-7' : 'translate-x-1'
              }`}
          />
        </button>
      </div>

      {/* Quick Links */}
      <div className="mb-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Quick Access
        </h3>
        <div className="space-y-2">
          {platforms.map((platform) => (
            <a
              key={platform.name}
              href={platform.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 hover:shadow-md transition-all hover:scale-[1.02] group"
            >
              <span className="text-2xl group-hover:scale-110 transition-transform">
                {platform.icon}
              </span>
              <span className="flex-1 font-medium text-gray-700 dark:text-gray-200">
                {platform.name}
              </span>
              <svg
                className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200 group-hover:translate-x-1 transition-all"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="p-3 rounded-xl bg-gradient-to-r from-bridge-primary/10 to-bridge-secondary/10 border border-bridge-primary/20">
        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
          <strong className="text-bridge-primary">How to use:</strong> Open any AI chat above,
          start a conversation, then click the <strong>"Transfer"</strong> button to move your context
          to another AI platform.
        </p>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 text-center">
        <p className="text-xs text-gray-400">v0.0.1 • Made with ❤️</p>
      </div>
    </div>
  );
}

export default IndexPopup;
