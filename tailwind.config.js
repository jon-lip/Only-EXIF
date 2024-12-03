/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter var', 'system-ui', '-apple-system', 'sans-serif'],
        'inter': ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#f5f5f5',
          100: '#e0e0e0',
          200: '#cccccc',
          300: '#b8b8b8',
          400: '#a3a3a3',
          500: '#8f8f8f',
          600: '#7a7a7a',
          700: '#666666',
          800: '#525252',
          900: '#3d3d3d',
        },
      },
    },
  },
  plugins: [],
} 