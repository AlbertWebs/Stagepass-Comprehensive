/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}', './src/**/*.css'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#172455',
          50: '#eef1f9',
          100: '#d9e0f0',
          200: '#b3c1e1',
          300: '#8a9ed0',
          400: '#657fbf',
          500: '#4a64ab',
          600: '#3a5092',
          700: '#2f4178',
          800: '#1e2d5c',
          900: '#172455',
          950: '#0f1838',
        },
        'brand-light': '#2a3a6e',
        'brand-accent': '#ca8a04',
        'brand-accent-dark': '#a16204',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'sidebar': '4px 0 24px -4px rgb(0 0 0 / 0.08)',
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'card-hover': '0 4px 12px -2px rgb(23 36 85 / 0.12), 0 2px 6px -2px rgb(0 0 0 / 0.06)',
        'header': '0 1px 3px 0 rgb(0 0 0 / 0.05)',
        'glow': '0 0 0 1px rgb(23 36 85 / 0.06), 0 2px 8px -2px rgb(23 36 85 / 0.12)',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};
