/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Background palette
        'casino-black': '#0a0a0f',
        'casino-dark': '#0d0d1a',
        'casino-purple-dark': '#12082a',
        'casino-purple': '#1a0a3d',
        // Accent colors
        'neon-yellow': '#FFD700',
        'neon-yellow-glow': '#FFD70080',
        'electric-purple': '#8B00FF',
        'electric-purple-glow': '#8B00FF80',
        'neon-cyan': '#00FFFF',
        'neon-cyan-glow': '#00FFFF80',
        'neon-pink': '#FF00FF',
        // UI shades
        'glass-white': 'rgba(255,255,255,0.05)',
        'glass-border': 'rgba(255,255,255,0.1)',
      },
      fontFamily: {
        orbitron: ['Orbitron', 'monospace', 'system-ui'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'casino-gradient': 'linear-gradient(135deg, #0a0a0f 0%, #12082a 50%, #0d0d1a 100%)',
        'neon-yellow-glow': 'radial-gradient(circle, #FFD70040 0%, transparent 70%)',
        'purple-glow': 'radial-gradient(circle, #8B00FF40 0%, transparent 70%)',
      },
      boxShadow: {
        'neon-yellow': '0 0 10px #FFD700, 0 0 20px #FFD70080, 0 0 40px #FFD70040',
        'neon-purple': '0 0 10px #8B00FF, 0 0 20px #8B00FF80, 0 0 40px #8B00FF40',
        'neon-cyan': '0 0 10px #00FFFF, 0 0 20px #00FFFF80, 0 0 40px #00FFFF40',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
      },
      animation: {
        'pulse-neon': 'pulseNeon 2s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s infinite',
        'float': 'float 6s ease-in-out infinite',
        'spin-reel': 'spinReel 0.5s linear',
        'win-pulse': 'winPulse 2s ease-in-out',
        'counter-tick': 'counterTick 0.1s ease-out',
      },
      keyframes: {
        pulseNeon: {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '50%': { opacity: '0.7', filter: 'brightness(1.3)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        spinReel: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0%)' },
        },
        winPulse: {
          '0%, 100%': { boxShadow: '0 0 5px #FFD700' },
          '50%': { boxShadow: '0 0 30px #FFD700, 0 0 60px #FFD70080' },
        },
        counterTick: {
          '0%': { transform: 'scale(1.05)', color: '#FFD700' },
          '100%': { transform: 'scale(1)', color: 'inherit' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      transitionDuration: {
        '250': '250ms',
      },
    },
  },
  plugins: [],
};
