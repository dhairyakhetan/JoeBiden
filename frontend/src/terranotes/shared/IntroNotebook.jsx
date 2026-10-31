import { useEffect, useRef, useState } from 'react';
import { cardCover } from './ArticleCard.jsx';
import { editionOf } from '../data/editions.js';
import { editionData } from '../editions/index.js';
import { editionAt } from '../lib/routes.js';
import { useLocation } from '../router.jsx';
import { withBase } from '../lib/base.js';
import { introSeen } from '../lib/introNotebook.js';
import { calm } from '../lib/motion.js';

// The opening animation (when: lib/introNotebook.js), over the site while it loads underneath: a notebook slides in
// spinning, opens on the Aquaterra logo, "TerraNotes" is written in, a CERTIFIED stamp thumps down, and it lifts away
// after 4.3 s (1.8 s with reduced motion). Skip button, Enter or Space ends it early. Meanwhile the covers and photos
// start downloading (the covers on screen first; the rest waits for its turn). It's the edition of the page it opens on
// (an older one's address shows that one): its number and month pressed into the cover and on the stamp. All timings: styles/intro.css.
const PLAY = 4300, REDUCED = 1800, LEAVE = 450;
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

export default function IntroNotebook() {
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const skip = useRef(null);
  const n = editionAt(useLocation().pathname), { month } = editionOf(n), data = editionData(n);
  const issue = String(n).padStart(2, '0');

  const leave = () => setLeaving(true);

  useEffect(() => {
    introSeen();
    window.aqIntro = true; // (AQ's site reads this too)
    dispatchEvent(new Event('aq-intro'));
    // fetch what the pages will need while the notebook plays
    for (const src of [withBase('/brand/aquaterra-globe.webp'), withBase('/brand/aquaterra-wordmark.webp'), ...data.articles.slice(0, 6).map((a) => cardCover(a.cover))].filter(Boolean)) {
      const img = new Image();
      img.src = src;
    }
    const root = document.documentElement, was = root.style.overflow;
    root.style.overflow = 'hidden'; // no scrolling the page behind it
    skip.current?.focus({ preventScroll: true });
    const t = setTimeout(leave, calm() ? REDUCED : PLAY);
    const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); leave(); } };
    addEventListener('keydown', onKey);
    return () => { clearTimeout(t); removeEventListener('keydown', onKey); root.style.overflow = was; };
  }, []);

  useEffect(() => {
    if (!leaving) return undefined;
    document.documentElement.style.overflow = '';
    const t = setTimeout(() => setGone(true), LEAVE);
    return () => clearTimeout(t);
  }, [leaving]);

  if (gone) return null;
  return (
    <div className={leaving ? 'intro intro-out' : 'intro'}>
      {/* rough edges and specks for the stamp's ink */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <filter id="aq-ink" x="-5%" y="-10%" width="110%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.4" result="rough" />
          <feComponentTransfer in="noise" result="specks"><feFuncA type="discrete" tableValues="0 0 0 0 0 0 0 0.9" /></feComponentTransfer>
          <feComposite in="rough" in2="specks" operator="out" />
        </filter>
      </svg>
      <div className="intro-stage" aria-hidden="true">
        <div className="nb">
          <div className="nb-thump">
            <div className="nb-book">
              {/* the first page, under the cover */}
              <div className="nb-page nb-right">
                <div className="nb-name">TerraNotes</div>
                <div className="nb-line">notes from where the land meets the water</div>
                <div className="nb-stamp">
                  <div className="nb-stamp-in">
                    <div className="nb-stamp-small">Aquaterra · Issue {WORDS[n] || issue}</div>
                    <div className="nb-stamp-big">Certified</div>
                    <div className="nb-stamp-small">Field approved</div>
                  </div>
                </div>
              </div>
              {/* the cover: its outside, then (once it swings past halfway) its inside with the logo */}
              <div className="nb-cover">
                <div className="nb-face nb-front">
                  {/* pressed into the cover, not stuck on: a blind-stamped frame, the issue, and a worn foil "Top secret" */}
                  <div className="nb-imprint">
                    <div className="nb-imp-small">Aquaterra · field notes</div>
                    <div className="nb-imp-secret">Top<br />secret</div>
                    <div className="nb-imp-small">do not open before the bell</div>
                    <div className="nb-imp-rule" />
                    <div className="nb-imp-name">TerraNotes</div>
                    <div className="nb-imp-issue">Issue {issue}</div>
                    <div className="nb-imp-month">{month}</div>
                  </div>
                </div>
                <div className="nb-face nb-back">
                  <img src={withBase('/brand/aquaterra-globe.webp')} alt="" className="nb-logo" />
                  <div className="nb-word"><img className="nb-wordmark" src={withBase('/brand/aquaterra-wordmark.webp')} alt="Aquaterra" /></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <button ref={skip} className="intro-skip" onClick={leave}>Skip loading <span aria-hidden="true">→</span></button>
    </div>
  );
}
