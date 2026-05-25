/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#2563EB',
          light: '#DBEAFE',
          dark: '#1E40AF',
        },
        preferred: '#16A34A',
        willing: '#6B7280',
        never: '#DC2626',
      },
    },
  },
  plugins: [],
};
