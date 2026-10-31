import { useEffect, useRef, useState } from 'react';
import PhoneHeader from './PhoneHeader.jsx';
import PhoneHangingArticles, { hangExtra } from './PhoneHangingArticles.jsx';
import HomeIntroCard from '../shared/HomeIntroCard.jsx';
import PhotoWallSection from '../shared/PhotoWallSection.jsx';
import PhotoViewer from '../shared/PhotoViewer.jsx';
import WordsGameSection from '../shared/WordsGameSection.jsx';
import TeamSection, { teamHeight } from '../shared/TeamSection.jsx';
import { PhoneBuddy } from '../shared/buddy/Buddy.jsx';
import EditionDecor from '../shared/EditionDecor.jsx';
import { EditionPills } from '../shared/InsideAQ.jsx';
import EndCards, { endCardsSpace } from '../shared/EndCards.jsx';
import { homeTitle, useEdition } from '../lib/edition.js';
import { usePauseOffscreen } from '../lib/pauseOffscreen.js';
import { usePresence } from '../lib/usePresence.js';
import { FONT } from '../styles/fonts.js';
import { useRuledPage } from '../lib/ruled.js';

// The phone home page of an edition (the latest's at /, also at /articles, /photos, /words, /members, scrolled to that
// section; an older one's at /sep26…): a 390px page where everything under the sticky header is absolutely placed.
// Top to bottom: intro card, hanging articles, photo wall, words game, team. The hanging articles keep page
// coordinates (their box starts at the page's top-left) and run hangExtra taller than the original design, so
// everything after them sits in a box moved down by that much.
export default function PhoneHome() {
  const [photo, setPhoto] = useState(null); // index open in the photo viewer
  const [shownPhoto, photoLeaving] = usePresence(photo, 180);
  const edition = useEdition(), extra = hangExtra(edition.articles);
  const sheet = useRef(null);
  useRuledPage(sheet, edition, false, edition.articles.length); // a ruled-paper edition writes its text on the lines
  const snake = endCardsSpace(false); // the games (+ editions) cards under the team
  useEffect(() => { document.title = homeTitle(edition); }, [edition]);
  const hangers = useRef(null);
  usePauseOffscreen(hangers); // the swinging cards hold still once scrolled away

  return (
    <>
      <div id="top" ref={sheet} className="page-home page-sheet" style={{ position: "relative", width: "390px", height: `${2480 + teamHeight(edition, 'phone') + extra + snake}px`, margin: "0 auto", overflow: "clip", background: "var(--page)", fontFamily: FONT.body, color: "var(--text)" }}>
        <PhoneHeader current="home" />
        <EditionDecor />
        <PhoneBuddy />
        <EditionPills />
        <HomeIntroCard />
        <div id="articles" aria-hidden="true" style={{ position: "absolute", left: "0", top: "236px", width: "1px", height: "1px" }} />
        <div ref={hangers} style={{ position: "absolute", left: "0", top: "0", width: "390px", height: `${1100 + extra}px`, pointerEvents: "none" }}>
          <PhoneHangingArticles />
        </div>
        <div style={{ position: "absolute", left: "0", top: `${extra}px`, width: "390px", height: "0" }}>
          <PhotoWallSection onOpen={setPhoto} />
          <WordsGameSection />
          <TeamSection />
        </div>
        <EndCards top={2480 + teamHeight(edition, 'phone') + extra + 40} />
      </div>
      {shownPhoto != null && <PhotoViewer start={shownPhoto} closing={photoLeaving} onClose={() => setPhoto(null)} />}
    </>
  );
}
