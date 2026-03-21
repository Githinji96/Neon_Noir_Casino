import React from 'react';

interface BottomNavProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

const tabs = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'promos', label: 'Promos', icon: '🎁' },
  { id: 'spin', label: 'Spin', icon: '🎰' },
  { id: 'history', label: 'History', icon: '📜' },
  { id: 'support', label: 'Support', icon: '💬' },
];

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-black/80 backdrop-blur-md border-t border-white/10 pb-4"
      role="navigation"
      aria-label="Mobile navigation"
    >
      <div className="flex items-end justify-around px-2 pt-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const isSpin = tab.id === 'spin';

          if (isSpin) {
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange?.(tab.id)}
                className="flex-1 flex flex-col items-center gap-0.5 -mt-4"
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <span
                  className={`
                    flex items-center justify-center w-14 h-14 rounded-full text-2xl
                    transition-all duration-250
                    ${isActive
                      ? 'bg-neon-yellow shadow-neon-yellow scale-110'
                      : 'bg-neon-yellow/90 shadow-[0_0_12px_#FFD70080]'
                    }
                  `}
                >
                  {tab.icon}
                </span>
                <span
                  className={`text-[10px] font-semibold transition-colors duration-250 ${
                    isActive ? 'text-neon-yellow' : 'text-gray-400'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange?.(tab.id)}
              className="flex-1 flex flex-col items-center gap-0.5 py-1"
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <span
                className={`text-xl transition-all duration-250 ${
                  isActive ? 'scale-110' : ''
                }`}
              >
                {tab.icon}
              </span>
              <span
                className={`text-[10px] font-medium transition-colors duration-250 ${
                  isActive ? 'text-neon-yellow' : 'text-gray-500'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
