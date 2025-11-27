/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        // Apple-style System Blue
        blue: {
          50: '#F2F7FF',
          100: '#E6F0FF',
          200: '#CCE0FF',
          300: '#99C2FF',
          400: '#66A3FF',
          500: '#007AFF', // The classic iOS Blue
          600: '#0062CC',
          700: '#004999',
          800: '#003166',
          900: '#001833',
        },
        // Apple-style Backgrounds
        gray: {
          50: '#F5F5F7', // iOS Light Background
          100: '#E5E5EA',
          200: '#D1D1D6',
          300: '#C7C7CC',
          400: '#AEAEB2',
          500: '#8E8E93',
          600: '#636366',
          700: '#48484A',
          800: '#2C2C2E', // iOS Dark Elevation
          900: '#1C1C1E', // iOS Dark Background
          950: '#000000',
        }
      },
      boxShadow: {
        'apple': '0 4px 24px rgba(0, 0, 0, 0.06)',
        'apple-hover': '0 8px 32px rgba(0, 0, 0, 0.12)',
      }
    },
  },
  plugins: [],
}