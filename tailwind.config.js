/**
 * Hệ thiết kế SignBridge 2: màu lấy từ biến CSS (xem src/index.css) để đổi được 3 chủ đề:
 * sáng · tối · tương phản cao. Cặp chữ/nền được kiểm tra WCAG AAA (≥ 7:1) bởi `npm test`.
 */
const c = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        paper: c('paper'),
        card: c('card'),
        card2: c('card2'),
        ink: c('ink'),
        muted: c('muted'),
        line: c('line'),
        rule: c('rule'),
        primary: { DEFAULT: c('primary'), hover: c('primary-hover'), on: c('onprimary') },
        accent: c('accent'),
        marker: c('marker'),
        stage: c('stage'),
        onstage: c('onstage'),
        ok: { DEFAULT: c('ok'), soft: c('oksoft') },
        warn: { DEFAULT: c('warn'), soft: c('warnsoft') },
        bad: { DEFAULT: c('bad'), soft: c('badsoft') },
        info: { DEFAULT: c('info'), soft: c('infosoft') },
        focus: c('focus'),
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Lexend Variable"', '"Be Vietnam Pro"', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      borderRadius: { xl: '1rem', '2xl': '1.35rem', '3xl': '1.75rem' },
      spacing: { 18: '4.5rem' },
      boxShadow: {
        card: '0 1px 2px rgb(var(--shadow) / .08), 0 14px 34px -16px rgb(var(--shadow) / .32)',
        lift: '0 2px 4px rgb(var(--shadow) / .1), 0 22px 44px -18px rgb(var(--shadow) / .42)',
        press: '0 3px 0 0 rgb(var(--shadow) / .55)',
        glow: '0 0 0 6px rgb(var(--primary) / .22)',
      },
      keyframes: {
        rise: { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'none' } },
        pop: { '0%': { transform: 'scale(.6)', opacity: 0 }, '70%': { transform: 'scale(1.08)' }, '100%': { transform: 'scale(1)', opacity: 1 } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        ripple: { from: { transform: 'translate(-50%,-50%) scale(.3)', opacity: 0.9 }, to: { transform: 'translate(-50%,-50%) scale(1.4)', opacity: 0 } },
        confetti: { '0%': { transform: 'translateY(-10vh) rotate(0)', opacity: 1 }, '100%': { transform: 'translateY(105vh) rotate(720deg)', opacity: 0.9 } },
        shrink: { from: { width: '100%' }, to: { width: '0%' } },
      },
      animation: {
        rise: 'rise .35s cubic-bezier(.2,.7,.2,1) both',
        pop: 'pop .4s cubic-bezier(.2,.9,.3,1.2) both',
      },
    },
  },
  plugins: [],
};
