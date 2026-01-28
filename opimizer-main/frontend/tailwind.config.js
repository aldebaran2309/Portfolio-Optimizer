module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        obsidian: '#050505',
        charcoal: '#0A0A0A',
        gunmetal: '#121212',
        'electric-indigo': '#6366F1',
        'neon-mint': '#10B981',
        'cyber-rose': '#F43F5E',
      },
      fontFamily: {
        heading: ['Chivo', 'sans-serif'],
        body: ['Manrope', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
