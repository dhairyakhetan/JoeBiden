import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from '../../router.jsx';
import Ghost, { Crown, Trophy } from './Ghost.jsx';
import { editionLink } from '../../data/editions.js';
import { callBuddy, openGames, useBuddy, useRewards } from '../../lib/buddyState.js';
import { useEdition } from '../../lib/edition.js';
import { AQ_LOOK } from '../../host.js';
import { FONT } from '../../styles/fonts.js';
import { calm } from '../../lib/motion.js';

// Buddy, a little green ghost (an easter egg). Called from a hidden button in the web home page's top-right corner
// (it peeks out now and then while the pointer is near) or from "click me" at the bottom of the phone menu: he drops in
// from above, fast, stretched, and lands with a squash and a bounce. He stays until a reload (lib/buddyState.js).
// Tap him: a random trick (backflip, boing, twirl, jelly, dash, vanish, boo, wobble), then his games open
// (BuddyGames.jsx; the address becomes the edition's /games/<game>). His Fling rewards, for good (lib/buddyState.js
// useRewards): the winner's crown on his head (its last level won), a trophy beside him (all 150 stars). Animations: styles/buddy.css.
// Animations: styles/buddy.css.
const TRICKS = ['backflip', 'boing', 'twirl', 'jelly', 'dash', 'vanish', 'boo', 'wobble'];

function TapGhost({ size }) {
  const [trick, setTrick] = useState(null);
  const last = useRef(null), wait = useRef(0), { crown, trophy } = useRewards();
  useEffect(() => () => clearTimeout(wait.current), []);
  const tap = () => {
    let t; do t = TRICKS[Math.floor(Math.random() * TRICKS.length)]; while (t === last.current);
    last.current = t;
    setTrick(null); requestAnimationFrame(() => setTrick(t)); // restart even if it's mid-trick
    clearTimeout(wait.current);
    wait.current = setTimeout(() => openGames(), calm() ? 0 : 640); // the trick, then his games
  };
  return (
    <button className="buddy-ghost" onClick={tap} aria-label={`Buddy the ghost${crown || trophy ? `, with his ${[crown && 'crown', trophy && 'trophy'].filter(Boolean).join(' and ')}` : ''}: tap him to play his games`}>
      <span className={trick ? `buddy-trick buddy-${trick}` : 'buddy-trick'} onAnimationEnd={(e) => { if (e.target === e.currentTarget) setTrick(null); }} style={{ position: "relative" }}>
        {crown && <Crown size={Math.round(size * 0.56)} className="buddy-crown" style={{ position: "absolute", left: "50%", top: `${-Math.round(size * 0.3)}px`, marginLeft: `${-Math.round(size * 0.28)}px` }} />}
        {trophy && <Trophy size={Math.round(size * 0.5)} className="buddy-trophy" style={{ position: "absolute", left: `${Math.round(size * 0.78)}px`, top: `${Math.round(size * 0.48)}px` }} />}
        <Ghost size={size} face={trick === 'boo' ? 'boo' : 'happy'} />
      </span>
    </button>
  );
}

// The hidden call button. Invisible until the pointer comes into the area around it (within 120px), where it fades
// in; and while the pointer is anywhere near this corner (220px) he peeks out every 6.5 seconds, so it can be found.
function CallButton() {
  const btn = useRef(null);
  const [peek, setPeek] = useState(false);
  const [shown, setShown] = useState(false); // the pointer is in the area around it
  useEffect(() => {
    let near = false, first = 0, every = 0, off = 0;
    const show = () => { setPeek(true); clearTimeout(off); off = setTimeout(() => setPeek(false), 1800); };
    const move = (e) => {
      const b = btn.current?.getBoundingClientRect(); if (!b) return;
      const d = Math.hypot(e.clientX - (b.left + b.width / 2), e.clientY - (b.top + b.height / 2));
      setShown(d < 120);
      const now = d < 220;
      if (now === near) return;
      near = now;
      clearTimeout(first); clearInterval(every);
      if (near) { first = setTimeout(show, 1200); every = setInterval(show, 6500); }
    };
    addEventListener('pointermove', move);
    return () => { removeEventListener('pointermove', move); clearTimeout(first); clearInterval(every); clearTimeout(off); };
  }, []);
  return (
    <div style={{ position: "absolute", left: "1240px", top: "88px", width: "150px", height: "36px", zIndex: "6" }}>
      <button ref={btn} className={`buddy-call${shown ? ' buddy-near' : peek ? ' buddy-peek' : ''}`} onClick={callBuddy} aria-label="Call buddy?" style={{ position: "absolute", right: "0", top: "0" }}>
        <Ghost size={22} />
      </button>
      <span className="buddy-call-label" aria-hidden="true">Call buddy?</span>
    </div>
  );
}

// Web home, top right, under the Website / Instagram buttons. at: a page's own spot for him (an edition's own home page, e.g. beside its
// cover), { left, top } on the artboard, with "tap him" above him instead of to his left.
export function WebBuddy({ at }) {
  const { here, fresh } = useBuddy();
  return (
    <>
      {!here && <CallButton />}
      {here && (
        <div className={fresh ? 'buddy-arrive' : undefined} style={{ position: "absolute", left: `${at ? at.left : 1296}px`, top: `${at ? at.top : 80}px`, width: "64px", zIndex: "6" }}>
          <div className="buddy-hang" style={{ paddingTop: at ? "52px" : "108px" }}>
            <div className="buddy-bob">
              <TapGhost size={64} />
            </div>
            <div className={fresh ? 'buddy-note buddy-note-late' : 'buddy-note'} style={{ position: "absolute", ...(at ? { left: "50%", top: "0px", translate: "-50% 0" } : { right: "74px", top: "118px" }), fontFamily: FONT.hand, fontSize: "21px", color: "var(--hand)", transform: "rotate(-6deg)", whiteSpace: "nowrap", pointerEvents: "none" }}>{at ? 'tap him ↓' : 'tap him →'}</div>
          </div>
        </div>
      )}
    </>
  );
}

// Phone home: he floats next to the intro card, above its sticky note. at: a page's own spot, { left, top } (an
// edition's own home page)
export function PhoneBuddy({ at }) {
  const { here, fresh } = useBuddy(), { crown } = useRewards();
  // The phone menu's "click me" (MenuCall) calls him; inside AQ's website that menu isn't drawn, so a small visible
  // ghost button stands where he floats and calls him instead (44px: a touch target).
  if (!here) {
    return AQ_LOOK ? (
      <div style={{ position: "absolute", left: `${at ? at.left + 13 : 312}px`, top: `${at ? at.top + 30 : 132}px`, width: "44px", height: "44px", zIndex: "5" }}>
        <button className="buddy-call buddy-near" onClick={callBuddy} aria-label="Call buddy the ghost" style={{ width: "44px", height: "44px" }}>
          <Ghost size={24} />
        </button>
      </div>
    ) : null;
  }
  return (
    <div className={fresh ? 'buddy-float-in' : undefined} style={{ position: "absolute", left: `${at ? at.left : 298}px`, top: `${at ? at.top : 108}px`, width: "70px", zIndex: "5" }}>
      <div style={{ fontFamily: FONT.hand, fontSize: "18px", color: "var(--hand)", transform: "rotate(6deg)", whiteSpace: "nowrap", pointerEvents: "none", textAlign: "center", marginBottom: "4px" }}>tap him</div>
      <div className="buddy-bob" style={{ display: "flex", justifyContent: "center", marginTop: crown ? "16px" : "0" }}>
        <TapGhost size={46} />
      </div>
    </div>
  );
}

// Phone menu, at the bottom under "TerraNotes": "click me". Calls him, closes the menu and heads to the edition's home.
export function MenuCall({ onClose }) {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const home = editionLink(useEdition().number);
  const go = () => {
    callBuddy();
    onClose?.();
    if (pathname !== home) nav(home);
    setTimeout(() => scrollTo({ top: 0, behavior: 'smooth' }), 60);
  };
  return (
    <button className="buddy-menu-call" onClick={go} aria-label="Call buddy the ghost">
      <Ghost size={20} />
      <span>click me</span>
    </button>
  );
}
