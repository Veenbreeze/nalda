/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#FBF7EA',
          100: '#F5EDCE',
          200: '#EADCA0',
          300: '#DEC770',
          400: '#D3B44A',
          500: '#C9A227',
          600: '#A9851F',
          700: '#866719',
          800: '#634C13',
          900: '#42330D',
        },
        ink: {
          50: '#F6F7F8',
          100: '#E9EBEE',
          200: '#D2D6DC',
          300: '#A9B0BA',
          400: '#7A8492',
          500: '#545E6C',
          600: '#3A424D',
          700: '#252B34',
          800: '#171B21',
          900: '#0B0E12',
        },
        cream: '#FAF8F4',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(11,14,18,0.04), 0 8px 24px rgba(11,14,18,0.06)',
        card: '0 1px 3px rgba(11,14,18,0.06), 0 12px 32px rgba(11,14,18,0.08)',
        gold: '0 8px 24px rgba(201,162,39,0.25)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        'slide-in': 'slide-in 0.25s ease-out',
      },
    },
  },
  plugins: [],
};
