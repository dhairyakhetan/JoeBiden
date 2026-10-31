import { useEffect, useRef, useState } from 'react';
import WebHeader from './WebHeader.jsx';
import WebArticleLine from './WebArticleLine.jsx';
import HomeIntroCard from '../shared/HomeIntroCard.jsx';
import PhotoWallSection from '../shared/PhotoWallSection.jsx';
import PhotoViewer from '../shared/PhotoViewer.jsx';
import WordsGameSection from '../shared/WordsGameSection.jsx';
import TeamSection, { teamHeight } from '../shared/TeamSection.jsx';
import { WebBuddy } from '../shared/buddy/Buddy.jsx';
import EditionDecor from '../shared/EditionDecor.jsx';
import { EditionPills } from '../shared/InsideAQ.jsx';
import EndCards, { endCardsSpace } from '../shared/EndCards.jsx';
import { homeTitle, useEdition } from '../lib/edition.js';
import { usePauseEach } from '../lib/pauseOffscreen.js';
import { usePresence } from '../lib/usePresence.js';
import { FONT } from '../styles/fonts.js';
import { useRuledPage } from '../lib/ruled.js';

// The web home page of an edition (the latest's at /, also at /articles, /photos, /words, /members, scrolled to that
// section; an older one's at /sep26…): a 1440px page where everything under the sticky header is absolutely placed.
// Intro card + "Land. Water. City." masthead, Buddy's corner, the sideways article line, photo wall, words game, team.
const DOT = <span style={{ color: "var(--blue)" }}>.</span>;

export default function WebHome() {
  const [photo, setPhoto] = useState(null); // index open in the photo viewer
  const [shownPhoto, photoLeaving] = usePresence(photo, 180);
  const edition = useEdition();
  useEffect(() => { document.title = homeTitle(edition); }, [edition]);
  const page = useRef(null);
  useRuledPage(page, edition, true, edition.articles.length); // a ruled-paper edition writes its text on the lines
  usePauseEach(page, '.hero-sway,.fl1,.fl2,.fl3,.fl4,.fl5,.fl6,.fk1,.fk2,.fk3,.fk4,.spark,.bulb,.buddy-bob'); // loops hold still once scrolled away
  const snake = endCardsSpace(true); // the games (+ editions) cards under the team

  return (
    <div className="web">
      <div id="top" ref={page} className="page-sheet" style={{ position: "relative", width: "1440px", height: `${2610 + teamHeight(edition, 'web') + snake}px`, margin: "0 auto", overflow: "clip", background: "var(--page)", fontFamily: FONT.body, color: "var(--ink)" }}>
        <WebHeader />
        <EditionDecor web />
        <HomeIntroCard web />
        <div data-ruled="1" style={{ position: "absolute", left: "720px", top: "132px", fontFamily: FONT.mono, fontSize: "12px", letterSpacing: "1.8px" }}>TERRANOTES · WRITE-UPS, PHOTOS &amp; WORDS</div>
        <div data-ruled="3" data-rid="hero" style={{ position: "absolute", left: "716px", top: "160px", fontFamily: FONT.head, fontSize: "96px", lineHeight: "0.9", letterSpacing: "-2px", textTransform: "uppercase", color: "var(--ink)" }}>
          <div>Land{DOT}</div>
          <div style={{ paddingLeft: "70px" }}>Water{DOT}</div>
          <div style={{ paddingLeft: "20px" }}>City{DOT}</div>
        </div>
        <div data-ruled="1" style={{ position: "absolute", left: "1150px", top: "380px", width: "220px", fontFamily: FONT.hand, fontSize: "26px", lineHeight: "1.05", color: "var(--hand)", transform: "rotate(-4deg)" }}>write-ups, fresh off the line ↓</div>
        <WebBuddy />
        <EditionPills web />
        {edition.articles.length > 0 && <WebArticleLine />}
        <PhotoWallSection web onOpen={setPhoto} />
        <WordsGameSection web />
        <TeamSection web />
        <EndCards web top={2610 + teamHeight(edition, 'web') + 40} />
      </div>
      {shownPhoto != null && <PhotoViewer web start={shownPhoto} closing={photoLeaving} onClose={() => setPhoto(null)} />}
    </div>
  );
}
