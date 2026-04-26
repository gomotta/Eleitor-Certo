import { useState } from 'react';

interface Props {
  size?: number;
  className?: string;
}

// SVG fallback que imita a forma geral da logo (checkmark verde + arco dourado)
function LogoFallback({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Arco dourado */}
      <path
        d="M72 14 A44 44 0 1 1 14 72 L26 63 A32 32 0 1 0 63 26 Z"
        fill="#F5B20A"
      />
      {/* Checkmark verde */}
      <path
        d="M 12 50 L 40 78 L 88 18"
        stroke="#1D6B1D"
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LogoImg({ size = 40, className = '' }: Props) {
  const [failed, setFailed] = useState(false);

  if (failed) return <LogoFallback size={size} />;

  return (
    <img
      src="/logo.png"
      alt="Eleitor Certo"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain' }}
      onError={() => setFailed(true)}
    />
  );
}

export function BrandLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoImg size={32} />
      <span className="font-bold text-gray-900 text-base tracking-tight">Eleitor Certo</span>
    </div>
  );
}
