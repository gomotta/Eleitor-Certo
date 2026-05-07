/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50:  '#f0fdf2',
          100: '#dcfce4',
          200: '#b8f5c4',
          300: '#7de09a',
          400: '#43c46a',
          500: '#28a84a',
          600: '#1D6B1D',
          700: '#165416',
          800: '#104010',
          900: '#0a2e0a',
        },
      },
      boxShadow: {
        card:       '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'card-hover': '0 4px 12px 0 rgb(0 0 0 / 0.08), 0 2px 4px -1px rgb(0 0 0 / 0.06)',
        'card-md':  '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 6px 24px -4px rgb(0 0 0 / 0.08)',
        'input':    '0 1px 2px 0 rgb(0 0 0 / 0.04)',
      },
    },
  },
  plugins: [],
};
