/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        page: 'var(--color-page)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          muted: 'var(--color-surface-muted)',
        },
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
          coral: 'var(--color-avatar-coral)',
          sage: 'var(--color-avatar-sage)',
          ochre: 'var(--color-avatar-ochre)',
          slate: 'var(--color-avatar-slate)',
          plum: 'var(--color-avatar-plum)',
          teal: 'var(--color-avatar-teal)',
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
