/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        page: 'var(--color-page)',
        surface: 'var(--color-surface)',
        border: 'var(--color-border)',
        divider: 'var(--color-divider)',
        ink: 'var(--color-ink)',
        secondary: 'var(--color-secondary)',
        muted: 'var(--color-muted)',
        scrim: 'var(--color-scrim)',
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
          tint: 'var(--color-accent-tint)',
        },
        success: {
          DEFAULT: 'var(--color-success)',
          tint: 'var(--color-success-tint)',
          text: 'var(--color-success-text)',
        },
        neutral: {
          DEFAULT: 'var(--color-neutral)',
          foreground: 'var(--color-neutral-foreground)',
        },
        'on-accent': 'var(--color-on-accent)',
        avatar: {
          coral: '#e64a2e',
          sage: '#5a9e52',
          ochre: '#c4922a',
          slate: '#6b6560',
          plum: '#8b5a6b',
          teal: '#4a8f8f',
        },
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'Arial Narrow', 'Arial', 'sans-serif'],
        body: ['"Work Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '20px',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
      },
    },
  },
  plugins: [],
};
