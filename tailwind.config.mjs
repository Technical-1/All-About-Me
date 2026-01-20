/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Light mode base
        cream: {
          DEFAULT: '#FAF8F5',
          50: '#FFFFFF',
          100: '#FAF8F5',
          200: '#F5F0E8',
          300: '#E8E0D4',
        },
        // Dark mode base
        void: {
          DEFAULT: '#0A0A0C',
          50: '#1A1A1E',
          100: '#14141A',
          200: '#0A0A0C',
        },
        // Accent colors
        'accent-red': {
          DEFAULT: '#C41E3A',
          light: '#E8364F',
          dark: '#9A1830',
        },
        'accent-teal': {
          DEFAULT: '#4A9B9B',
          light: '#5FB5B5',
          dark: '#3A7B7B',
        },
        // Neutral palette
        surface: {
          light: '#FFFFFF',
          dark: '#14141A',
        },
        card: {
          light: '#FFFFFF',
          dark: '#1A1A1E',
        },
        border: {
          light: '#E8E0D4',
          dark: '#2A2A32',
        },
        muted: {
          light: '#6B7280',
          dark: '#9CA3AF',
        },
      },
      fontFamily: {
        display: ['DM Sans', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-body': 'var(--text-primary)',
            '--tw-prose-headings': 'var(--text-heading)',
            '--tw-prose-links': 'var(--accent-primary)',
            '--tw-prose-bold': 'var(--text-heading)',
            '--tw-prose-code': 'var(--accent-primary)',
            '--tw-prose-pre-bg': 'var(--bg-card)',
            '--tw-prose-pre-code': 'var(--text-primary)',
            code: {
              backgroundColor: 'var(--bg-card)',
              padding: '0.25rem 0.5rem',
              borderRadius: '0.25rem',
              fontWeight: '400',
            },
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
          },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'scale-in': 'scaleIn 0.3s ease-out forwards',
        'particle-float': 'particleFloat 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        particleFloat: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      boxShadow: {
        'glow-red': '0 0 20px rgba(196, 30, 58, 0.3)',
        'glow-teal': '0 0 20px rgba(74, 155, 155, 0.3)',
        'card-light': '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06)',
        'card-hover-light': '0 10px 25px rgba(0, 0, 0, 0.1)',
        'card-dark': '0 1px 3px rgba(0, 0, 0, 0.3)',
        'card-hover-dark': '0 10px 25px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
