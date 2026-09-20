/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Manrope', 'sans-serif'],
      },
      colors: {
        ink: '#1C1E21',
        paper: '#F7F8FA',
        line: '#E3E4E8',
        yellow: { DEFAULT: '#F0C419', 700: '#B8930A', 900: '#5C4A08' },
        amber: { 
          50: '#F7F0E4', 
          100: '#EFE3D0', 
          200: '#DDC49B', 
          300: '#C79F62', 
          400: '#A9793F', 
          500: '#8A5A2A', 
          600: '#6B441F', 
          700: '#4A2E15' 
        },
        go: { DEFAULT: '#2F9E52', bg: '#E8F5EC' },
        warn: { DEFAULT: '#D97F13', bg: '#FCF0DF' },
        bad: { DEFAULT: '#C6402B', bg: '#FBEAE7' },
      },
      boxShadow: { 
        card: '0 1px 2px rgba(28,30,33,0.04), 0 1px 1px rgba(28,30,33,0.03)' 
      }
    },
  },
  plugins: [],
}
