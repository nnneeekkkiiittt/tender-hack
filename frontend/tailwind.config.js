/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#174A85',
          light: '#2F6FB3',
          dark: '#123C6B',
        },
        accent: {
          DEFAULT: '#D71920',
          dark: '#B51218',
        },
        bg: '#F7F9FC',
        ink: {
          DEFAULT: '#1F2937',
          muted: '#6B7280',
        },
        border: '#E5E7EB',
        success: {
          DEFAULT: '#15803D',
          bg: '#DCFCE7',
        },
        warning: {
          DEFAULT: '#B45309',
          bg: '#FEF3C7',
        },
        info: {
          DEFAULT: '#174A85',
          bg: '#E8F0FA',
        },
        danger: {
          DEFAULT: '#B91C1C',
          bg: '#FEE2E2',
        },
      },
      fontFamily: {
        sans: ['"Inter"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(15, 23, 42, 0.04), 0 1px 3px 0 rgba(15, 23, 42, 0.06)',
        popover: '0 4px 16px -2px rgba(15, 23, 42, 0.12), 0 2px 6px -1px rgba(15, 23, 42, 0.06)',
      },
      borderRadius: {
        md: '8px',
        lg: '10px',
        xl: '14px',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.25s ease-out',
      },
    },
  },
  plugins: [],
}
