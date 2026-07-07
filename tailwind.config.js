/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e8f1fb',
          100: '#c5d9f5',
          200: '#9ebfee',
          300: '#77a5e7',
          400: '#5991e2',
          500: '#1a6dbf',
          600: '#1560aa',
          700: '#104f8e',
          800: '#0b3f72',
          900: '#072f56',
        },
        orange: {
          400: '#f7b93c',
          500: '#F5A623',
          600: '#e0921a',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
