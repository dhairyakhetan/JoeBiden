// @ts-nocheck
// Mascots.tsx — Paradox 2026 geometric mascot system.
// Shapes pulled from CSS theme variables so palette swaps re-tint everything.

const C = {
  c1: 'var(--c1)',
  c2: 'var(--c2)',
  c3: 'var(--c3)',
  c4: 'var(--c3)',
  ink: 'var(--ink)',
  bg: 'var(--bg)',
}

// ── Primitive shapes ────────────────────────────────────────────────────────
export function Disc({ size = 60, fill = C.c1 }: { size?: number; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden fill="none">
      <circle cx="50" cy="50" r="46" fill={fill} />
    </svg>
  )
}

export function Ring({ size = 60, fill = C.c1, sw = 14 }: { size?: number; fill?: string; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden fill="none">
      <circle cx="50" cy="50" r={50 - sw / 2 - 2} fill="none" stroke={fill} strokeWidth={sw} />
    </svg>
  )
}

export function Tri({ size = 60, fill = C.c2, rotate = 0 }: { size?: number; fill?: string; rotate?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden fill="none"
      style={{ transform: `rotate(${rotate}deg)` }}>
      <path d="M50 6L92 86H8z" fill={fill} />
    </svg>
  )
}

export function Sq({ size = 60, fill = C.c3 }: { size?: number; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden fill="none">
      <rect x="6" y="6" width="88" height="88" fill={fill} />
    </svg>
  )
}

export function Plus({ size = 50, fill = C.c1 }: { size?: number; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden fill="none">
      <path d="M40 8h20v32h32v20H60v32H40V60H8V40h32z" fill={fill} />
    </svg>
  )
}

export function Star4({ size = 80, fill = C.c2 }: { size?: number; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden fill="none">
      <path d="M50 5 Q55 45 95 50 Q55 55 50 95 Q45 55 5 50 Q45 45 50 5z" fill={fill} />
    </svg>
  )
}

export function Burst({ size = 80, fill = C.c2 }: { size?: number; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden fill="none">
      <path d="M50 4l8 26 26-14-14 26 26 8-26 8 14 26-26-14-8 26-8-26-26 14 14-26-26-8 26-8-14-26 26 14z" fill={fill} />
    </svg>
  )
}

export function Diamond({ size = 60, fill = C.c3 }: { size?: number; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden fill="none">
      <rect x="20" y="20" width="60" height="60" fill={fill} transform="rotate(45 50 50)" />
    </svg>
  )
}

export function Halfmoon({ size = 70, fill = C.c3 }: { size?: number; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden fill="none">
      <path d="M50 4a46 46 0 100 92 30 30 0 010-92z" fill={fill} />
    </svg>
  )
}

export function Concentric({
  size = 80, c1 = C.c1, c2 = C.c2, c3 = C.c3,
}: { size?: number; c1?: string; c2?: string; c3?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden fill="none">
      <circle cx="50" cy="50" r="46" fill={c1} />
      <circle cx="50" cy="50" r="30" fill={c2} />
      <circle cx="50" cy="50" r="14" fill={c3} />
    </svg>
  )
}

export function Pellet({ size = 80, fill = C.c2 }: { size?: number; fill?: string }) {
  return (
    <svg width={size * 1.6} height={size * 0.5} viewBox="0 0 160 50" aria-hidden fill="none">
      <rect x="0" y="0" width="160" height="50" rx="25" fill={fill} />
    </svg>
  )
}

export function Wave({ size = 120, fill = C.c1 }: { size?: number; fill?: string }) {
  return (
    <svg width={size} height={size * 0.25} viewBox="0 0 120 30" aria-hidden fill="none">
      <path d="M0 15 Q15 -2 30 15 T60 15 T90 15 T120 15" fill="none" stroke={fill} strokeWidth="6" strokeLinecap="round" />
    </svg>
  )
}

// ── Named mascots (stable shape + color assignments) ──────────────────────
export const Drop      = ({ size = 60 }: { size?: number }) => <Disc     size={size} fill={C.c1} />
export const Sparkle   = ({ size = 60 }: { size?: number }) => <Star4    size={size} fill={C.c2} />
export const Trophy    = ({ size = 60 }: { size?: number }) => <Diamond  size={size} fill={C.c3} />
export const Book      = ({ size = 60 }: { size?: number }) => <Sq       size={size} fill={C.c1} />
export const CrossPlus = ({ size = 50 }: { size?: number }) => <Plus     size={size} fill={C.c2} />
export const Ball      = ({ size = 60 }: { size?: number }) => <Disc     size={size} fill={C.c3} />
export const Eye       = ({ size = 60 }: { size?: number }) => <Ring     size={size} fill={C.c1} />
export const Hand      = ({ size = 60 }: { size?: number }) => <Tri      size={size} fill={C.c2} />
export const Flower    = ({ size = 60 }: { size?: number }) => <Burst    size={size} fill={C.c2} />
export const Heart     = ({ size = 60 }: { size?: number }) => <Halfmoon size={size} fill={C.c3} />
export const SunBurst  = ({ size = 60 }: { size?: number }) => <Burst    size={size} fill={C.c1} />
export const Badge     = ({ size = 110 }: { size?: number }) => <Concentric size={size} c1={C.c1} c2={C.c2} c3={C.ink} />
export const Coin      = ({ size = 70 }: { size?: number }) => <Concentric size={size} />
export const Medal     = ({ size = 70 }: { size?: number }) => <Concentric size={size} c1={C.c2} c2={C.c1} c3={C.c3} />

// ── Inline sticker shapes (used as SVG decorations) ──────────────────────
export function StarSticker({ size = 40, fill = '#FF5A36' }: { size?: number; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden fill="none">
      <path d="M50 4c2 30 14 42 44 46-30 4-42 16-44 46-2-30-14-42-44-46 30-4 42-16 44-46z"
        fill={fill} stroke="#111" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  )
}

export function SparkleSticker({ size = 40, fill = '#FFD23F' }: { size?: number; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden fill="none">
      <path d="M50 4l9 32 32 9-32 9-9 32-9-32-32-9 32-9z"
        fill={fill} stroke="#111" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="50" cy="50" r="6" fill="#111" />
    </svg>
  )
}

export function HeartSticker({ size = 40, fill = '#B79CED' }: { size?: number; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden fill="none">
      <path d="M50 85 C30 70 5 55 5 35a25 25 0 0145 0 25 25 0 0145 0C95 55 70 70 50 85z"
        fill={fill} stroke="#111" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  )
}

export function LightningSticker({ size = 40, fill = '#FFD23F' }: { size?: number; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden fill="none">
      <path d="M60 5L25 55h28L30 95l50-55H55z"
        fill={fill} stroke="#111" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  )
}

export function BlobSticker({ size = 60, fill = '#FF4338' }: { size?: number; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden fill="none">
      <path d="M73 18c15 8 24 28 20 46S75 92 56 95s-40-5-48-22 2-44 18-55 32-8 47 0z"
        fill={fill} stroke="#111" strokeWidth="3" />
    </svg>
  )
}

// ── Sticker scatter (decorative positional elements) ─────────────────────
type StickerItem = {
  top?: string; bottom?: string; left?: string; right?: string;
  size: number; rotate: number;
  component: React.ReactNode;
}

export function StickerScatter({ items }: { items: StickerItem[] }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {items.map((item, i) => (
        <div
          key={i}
          className="absolute animate-ss-float sticker"
          style={{
            top: item.top, bottom: item.bottom,
            left: item.left, right: item.right,
            transform: `rotate(${item.rotate}deg)`,
            animationDelay: `${i * 0.4}s`,
            animationDuration: `${3 + i * 0.5}s`,
          } as React.CSSProperties}
        >
          {item.component}
        </div>
      ))}
    </div>
  )
}
