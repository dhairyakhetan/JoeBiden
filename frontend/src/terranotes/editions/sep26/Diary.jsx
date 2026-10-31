import { useEffect, useRef, useState } from 'react';
import { pageZoom } from '../../lib/layoutMode.js';
import { FONT } from '../../styles/fonts.js';
import { RULE } from './ruled.js';

// September 2026's diary, under "Meet the team" (src/editions/pages.js TEAM_NOTE; shared/TeamSection.jsx places it:
// web under the legend, phone beside it). Like Tom Riddle's diary: stay on the section a while and a line writes
// itself out in a neat copperplate script (the look's script font), letter by letter, sits a moment, then sinks back
// into the page; another comes a little later, picked at random. It writes on the notebook's ruled lines: its line
// height is the ruling's, and it shifts itself so the script's baseline sits on a line (RULE: ruled.js = look.css).
// Only while it's on screen: scrolling away wipes it
// and holds the clock. Reduced motion: lines appear and go without the writing. Fun only, so hidden from screen readers.
const LINES = [
  'Hello. Who are you?',
  'ayo wtf',
  "you've been here a while…",
  "stop scrolling, i'm talking",
  'psst. tap the ghost up top',
  'exam in 3 days and you’re here?',
  'i remember every face on this page',
  'this page is haunted, btw',
  'nice of you to stay',
  'bro. study.',
  'who let you in here',
  'do not tell the heads i said that',
  'the ink remembers.',
  'ok fine, you can stay',
];
const FIRST = 6000, GAP = [7000, 14000], HOLD = 3200, SINK = 1600, PER = 70; // ms; PER: one letter's stroke

export default function Diary({ style, size, web }) {
  const box = useRef(null), probe = useRef(null);
  const R = RULE[web ? 'web' : 'phone'];
  const [shift, setShift] = useState(0);
  // where the baseline falls on the sheet (the probe is a 0-high box on the baseline), moved down onto the next line
  const fit = useRef(null);
  useEffect(() => {
    let gone = false;
    fit.current = () => {
      const sheet = box.current?.closest('.page-sheet'); if (!sheet || gone) return;
      const base = (probe.current.getBoundingClientRect().top - sheet.getBoundingClientRect().top) / pageZoom();
      setShift((s) => { const y = base - s, line = R.start + Math.ceil((y + 2 - R.start) / R.gap) * R.gap - 1; return Math.round(line - 2 - y); });
    };
    fit.current(); document.fonts?.ready.then(() => fit.current());
    return () => { gone = true; };
  }, [web]);
  const [line, setLine] = useState(null); // { text, k, out }
  useEffect(() => {
    const el = box.current;
    let timer = 0, phase = 'wait', left = FIRST, since = 0, last = -1, k = 0;
    const gap = () => GAP[0] + Math.random() * (GAP[1] - GAP[0]);
    const wait = () => { phase = 'wait'; since = Date.now(); timer = setTimeout(write, left); };
    const write = () => {
      let i; do i = Math.floor(Math.random() * LINES.length); while (i === last); last = i;
      fit.current?.(); // measured again here: the section's rise-in (lib/reveal.js) moves it while it first shows
      phase = 'show'; setLine({ text: LINES[i], k: k++, out: false });
      timer = setTimeout(() => {
        setLine((l) => l && { ...l, out: true });
        timer = setTimeout(() => { setLine(null); left = gap(); wait(); }, SINK);
      }, LINES[i].length * PER + 500 + HOLD);
    };
    const io = new IntersectionObserver(([e]) => {
      clearTimeout(timer);
      if (e.isIntersecting) { wait(); return; }
      if (phase === 'wait') left = Math.max(0, left - (Date.now() - since)); // the clock holds while it's away
      else { setLine(null); left = gap(); phase = 'wait'; }
    }, { threshold: 0.6 });
    io.observe(el);
    return () => { io.disconnect(); clearTimeout(timer); };
  }, []);
  return (
    <div ref={box} aria-hidden="true" style={{ position: "absolute", minHeight: `${R.gap * 2}px`, fontFamily: FONT.script, fontSize: `${size}px`, lineHeight: `${R.gap}px`, color: "var(--ink)", pointerEvents: "none", ...style, translate: `0 ${shift}px` }}>
      <span ref={probe} style={{ display: "inline-block", width: "0", height: "0" }} />
      {line && (
        <span key={line.k} className={line.out ? 'diary-line diary-sink' : 'diary-line'} style={{ marginTop: `-${R.gap}px` }}>
          {[...line.text].map((ch, i) => <span key={i} className="diary-ch" style={{ animationDelay: `${i * PER}ms` }}>{ch}</span>)}
        </span>
      )}
    </div>
  );
}
