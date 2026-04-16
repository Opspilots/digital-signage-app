/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        sans: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        ds: {
          bg:         '#07090f',
          surface:    '#0d1219',
          surface2:   '#111b27',
          border:     '#1a2940',
          border2:    '#243d5c',
          cyan:       '#22d3ee',
          'cyan-dim': '#0891b2',
          'cyan-muted':'#081b26',
          amber:      '#f59e0b',
          'amber-muted':'#1e1006',
          green:      '#34d399',
          'green-muted':'#081a12',
          red:        '#f87171',
          'red-muted':'#1a0808',
          text1:      '#ddf4ff',
          text2:      '#4e7090',
          text3:      '#1e3653',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'fade-in':    'fadeIn 0.4s ease-out',
        'slide-up':   'slideUp 0.35s cubic-bezier(0.16,1,0.3,1)',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
