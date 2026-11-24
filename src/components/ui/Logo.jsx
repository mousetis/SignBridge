export default function Logo({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="SignBridge" className="shrink-0">
      <defs>
        <linearGradient id="sbg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5B61F0" />
          <stop offset="1" stopColor="#0A6872" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#sbg)" />
      <g fill="#fff">
        <rect x="14" y="24" width="7" height="22" rx="3.5" />
        <rect x="23" y="14" width="7" height="32" rx="3.5" />
        <rect x="32" y="11" width="7" height="35" rx="3.5" />
        <rect x="41" y="17" width="7" height="29" rx="3.5" />
        <path d="M10 46c0-3 2-5 5-5h30c3 0 6 2 6 5v2c0 3-3 6-6 6H16c-3 0-6-3-6-6z" fillOpacity=".92" />
      </g>
      <path d="M8 52q24-12 48 0" stroke="#FFC93C" strokeWidth="3.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}
