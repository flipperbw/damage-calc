import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    screens: {
      sm: '640px',
      md: '900px',  // custom desktop breakpoint per spec
      lg: '1280px',
    },
    extend: {
      colors: {
        'bg-base': '#050714',
        surface: 'rgba(255,255,255,0.04)',
        // Solid equivalent of `surface` rendered on top of the panel
        // gradient. Used wherever the rgba surface would let underlying
        // content bleed through (sticky table columns, opaque modals on top
        // of complex layouts). Eyeballed to match how `surface` looks
        // against the panel-gradient midpoint.
        'surface-solid': '#1a1830',
        'surface-hi': 'rgba(255,255,255,0.07)',
        text: '#e8ecff',
        'text-mute': '#888fb5',
        accent: '#7c5cff',
        'accent-2': '#5c8cff',
        ok: '#22c55e',
        warn: '#fab005',
        danger: '#ff6b6b',
        priority: '#fb923c',
      },
      backgroundImage: {
        'panel-gradient':
          'linear-gradient(165deg, #0a0e25 0%, #1c0f2e 50%, #0a0e25 100%)',
        'accent-gradient': 'linear-gradient(135deg, #7c5cff, #5c8cff)',
      },
      borderRadius: {
        card: '16px',
      },
      fontFamily: {
        sans: ['ui-sans-serif', '-apple-system', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xxs: ['10px', '14px'],
      },
    },
  },
  plugins: [],
} satisfies Config;
