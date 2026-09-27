export default function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="logo-mark">
      <rect x="9" y="3" width="17" height="21" rx="4" className="logo-back" transform="rotate(12 18 14)" />
      <rect x="5" y="7" width="18" height="22" rx="4" className="logo-front" />
      <path d="M9.5 18.5l3 3 5.5-6" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
