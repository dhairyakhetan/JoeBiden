// Line icons (inline SVG, drawn in currentColor unless a colour is given). All decorative: aria-hidden. The stroke goes
// in the style: a CSS variable colour (var(--ink)) isn't safe in an SVG attribute everywhere.
const svg = (size, view, { stroke, ...props }, children) => <svg width={size} height={size} viewBox={`0 0 ${view} ${view}`} fill="none" aria-hidden="true" style={{ stroke }} {...props}>{children}</svg>;

// ✕ for close buttons
export const CloseIcon = ({ size = 16, weight = 2.6 }) => svg(size, 20, { stroke: "var(--ink)", strokeWidth: weight, strokeLinecap: "square" }, <><path d="M3 3 L17 17" /><path d="M17 3 L3 17" /></>);

// ‹ › ˄ ˅ for arrow buttons
const CHEVRON = { left: 'M15 4 L7 12 L15 20', right: 'M9 4 L17 12 L9 20', up: 'M4 16 L12 8 L20 16', down: 'M4 8 L12 16 L20 8' };
export const ChevronIcon = ({ dir, size = 20 }) => svg(size, 24, { stroke: "var(--ink)", strokeWidth: "2.8", strokeLinecap: "square" }, <path d={CHEVRON[dir]} />);

// a framed landscape: the "no photo yet" placeholder
export const PhotoIcon = ({ size = 18, color = "var(--slotInk)" }) => svg(size, 24, { stroke: color, strokeWidth: "1.6" }, <><rect x="3" y="4" width="18" height="16" rx="1" /><circle cx="9" cy="10" r="2" /><path d="M3 17 L9 13 L13 16 L16 13 L21 17" /></>);

// the phone header's menu button: two hand-drawn lines
export const MenuIcon = () => (
  <svg width="26" height="18" viewBox="0 0 26 18" fill="none" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" style={{ stroke: "var(--text)" }}><path d="M2 5 C9 3 17 6 24 4" /><path d="M8 13 C13 12 19 14 24 12" /></svg>
);
