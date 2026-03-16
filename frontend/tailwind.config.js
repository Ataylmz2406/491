/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    50:  '#f0fdfa',
                    100: '#ccfbf1',
                    200: '#99f6e4',
                    300: '#5eead4',
                    400: '#2dd4bf',
                    500: '#14b8a6',
                    600: '#0d9488',
                    700: '#0f766e',
                    800: '#115e59',
                    900: '#134e4a',
                },
                surface: {
                    dark: '#0f172a',
                    darker: '#020617',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
            },
            keyframes: {
                'fade-in': {
                    '0%':   { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                'fade-in-up': {
                    '0%':   { opacity: '0', transform: 'translateY(12px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'slide-up': {
                    '0%':   { opacity: '0', transform: 'translateY(24px) scale(0.98)' },
                    '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
                },
                'shimmer': {
                    '0%':   { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
                'pulse-soft': {
                    '0%, 100%': { opacity: '1' },
                    '50%':      { opacity: '0.6' },
                },
            },
            animation: {
                'fade-in':     'fade-in 0.2s ease-out',
                'fade-in-up':  'fade-in-up 0.4s ease-out',
                'slide-up':    'slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                'shimmer':     'shimmer 1.5s infinite linear',
                'pulse-soft':  'pulse-soft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
        },
    },
    plugins: [],
}
