/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        parchment: '#f5f4ed',
        ivory: '#faf9f5',
        'warm-sand': '#e8e6dc',
        'ink-blue': '#1b365d',
        'ink-blue-dark': '#142a48',
        'ink-blue-soft': '#e4ecf5',
        fg: '#141413',
        'fg-2': '#3d3d3a',
        muted: '#504e49',
        meta: '#6b6a64',
        'kami-border': '#e8e6dc',
        'kami-border-soft': '#e5e3d8',
      },
      fontFamily: {
        display: ['Charter', 'Georgia', 'Noto Serif SC', 'serif'],
        body: ['-apple-system', 'BlinkMacSystemFont', 'PingFang SC', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'ui-monospace', 'Menlo', 'monospace'],
      },
      maxWidth: {
        container: '1080px',
      },
      borderRadius: {
        kami: '8px',
        'kami-lg': '12px',
      },
    },
  },
  plugins: [],
}
