import { useEffect, useState } from 'react';

// Buddy the ghost (shared/buddy/): whether he's been called. Memory only, so he stays while you move between pages
// and is gone after a reload. Components talk through window events: 'aq-buddy' (he arrives), 'aq-games' (open his
// games popup, detail = 'snake' | 'float').
let called = false;
export function callBuddy() {
  called = true;
  dispatchEvent(new Event('aq-buddy'));
}
// → { here, fresh }: fresh = he was called while this component was on screen (so it plays his entrance)
export function useBuddy() {
  const [here, setHere] = useState(called);
  const [fresh, setFresh] = useState(false);
  useEffect(() => { const on = () => { setHere(true); setFresh(true); }; addEventListener('aq-buddy', on); return () => removeEventListener('aq-buddy', on); }, []);
  return { here, fresh };
}
export const openGames = (game) => dispatchEvent(new CustomEvent('aq-games', { detail: game }));

// Buddy's rewards from Fling (shared/buddy/Fling.jsx), kept for good on this device and shown whenever he's called:
//   crown   clearing its last level: the winner's crown, on his head            (localStorage 'aq-buddy-crown')
//   trophy  every star of every level (150): a trophy he holds beside him        ('aq-buddy-trophy-stars')
// 'aq-reward' tells him at once. (Before the crown, a won last level was stored as 'aq-buddy-trophy': it becomes the crown.)
const KEYS = { crown: 'aq-buddy-crown', trophy: 'aq-buddy-trophy-stars' };
const read = () => {
  const has = (k) => { try { return !!localStorage.getItem(k); } catch { return false; } };
  try { if (localStorage.getItem('aq-buddy-trophy')) { localStorage.setItem(KEYS.crown, localStorage.getItem('aq-buddy-trophy')); localStorage.removeItem('aq-buddy-trophy'); } } catch { /* no storage */ }
  return { crown: has(KEYS.crown), trophy: has(KEYS.trophy) };
};
let rewards = typeof window !== 'undefined' ? read() : { crown: false, trophy: false };
export const hasReward = (kind) => rewards[kind];
export function giveReward(kind) {
  try { localStorage.setItem(KEYS[kind], String(Date.now())); } catch { /* private mode: just this visit */ }
  rewards = { ...rewards, [kind]: true };
  dispatchEvent(new Event('aq-reward'));
}
export function useRewards() {
  const [now, setNow] = useState(rewards);
  useEffect(() => { const on = () => setNow(rewards); addEventListener('aq-reward', on); return () => removeEventListener('aq-reward', on); }, []);
  return now;
}

// Where the last tap / click landed (screen px), so Buddy's games popup can grow out of the button that opened it
// (shared/buddy/BuddyGames.jsx). Recorded before any click handler runs.
export const lastTap = { x: null, y: null };
if (typeof window !== 'undefined') addEventListener('pointerdown', (e) => { lastTap.x = e.clientX; lastTap.y = e.clientY; }, { capture: true, passive: true });
