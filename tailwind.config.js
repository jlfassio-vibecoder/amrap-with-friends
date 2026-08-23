/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        page: '#f7f2ea',
        surface: '#fffdf8',
        border: '#e8ddc9',
        divider: '#efe6d6',
        ink: '#211d18',
        secondary: '#8a8072',
        muted: '#a89f8e',
        accent: {
          DEFAULT: '#e64a2e',
          hover: '#c93c22',
          tint: '#fbe4dc',
        },
        success: {
          DEFAULT: '#5a9e52',
          tint: '#e9f4e5',
          text: '#3f7d38',
        },
        neutral: {
          DEFAULT: '#211d18',
          foreground: '#fffdf8',
        },
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
        card: '0 2px 0 0 #e8ddc9',
      },
    },
  },
  plugins: [],
};
