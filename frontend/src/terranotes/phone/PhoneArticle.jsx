import { useEffect, useLayoutEffect, useRef } from 'react';
import PhoneHeader from './PhoneHeader.jsx';
import { BackToMagazine } from '../shared/InsideAQ.jsx';
import { AQ_LOOK } from '../host.js';
import ArticleCard, { TagPill, coverSet } from '../shared/ArticleCard.jsx';
import ArticleBody, { AuthorBox, EndMark } from '../shared/ArticleBody.jsx';
import PassItOn from '../shared/PassItOn.jsx';
import { ReadingBar } from '../shared/Reading.jsx';
import { useReadProgress } from '../lib/readProgress.js';
import { useReadDepth } from '../lib/analytics.js';
import BackHome from '../shared/BackHome.jsx';
import ImageSlot from '../shared/ImageSlot.jsx';
import { Clip, FeaturedTape } from '../shared/Tapes.jsx';
import { placeOf, tagOf } from '../data/articles.js';
import { pad2 } from '../lib/format.js';
import { useFitTitle } from '../lib/fitTitle.js';
import { flyInFromCard } from '../lib/cardFlight.js';
import { FONT } from '../styles/fonts.js';
// AQ's look: the "← Back to home" pill floats over the page's top-left, so the hanging cover starts lower, clear of it
const DROP = AQ_LOOK ? 30 : 0;

// One article, phone layout (data: data/articles.js; `next` = the following article in its edition). The cover card
// hangs from a wire: it drops in (or flies straight out of the tapped card) and keeps swaying (styles/motion.css,
// loops.css). Then the byline strip, the body (shared/ArticleBody.jsx), the "words by" box, the next article on its
// own wire, and "back to home". Hero, byline and body are in normal flow: a taller cover pushes the rest down.
export default function PhoneArticle({ article: a, next }) {
  const hero = useRef(null), text = useRef(null);
  const read = useReadProgress(text);
  useReadDepth(a.slug, read.p);
  useLayoutEffect(() => { flyInFromCard(hero.current, true); }, []);
  useEffect(() => { document.title = `Aquaterra — ${a.title}`; }, [a.title]);
  const tag = tagOf(a), { i, n } = placeOf(a);
  const title = useFitTitle(a.title, 42, 30, 4); // at most four lines

  return (
    <div className="page-article page-sheet" style={{ position: "relative", width: "390px", margin: "0 auto", overflow: "clip", background: "var(--page)", fontFamily: FONT.body, color: "var(--ink)" }}>
      <PhoneHeader current="article" edge={tag.color} />
      <ReadingBar p={read.p} color={tag.color} />
      <BackToMagazine />
      <div style={{ position: "absolute", left: "0", top: `${100 + DROP}px`, width: "390px", height: "2px", background: "var(--string)" }} />
      <div ref={hero} className="hero-drop" style={{ position: "relative", margin: `${70 + DROP}px 0 0 16px`, width: "358px", minHeight: "484px", transformOrigin: "50% -32px" }}>
        <div className="hero-sway" style={{ transformOrigin: "50% -32px", transform: "rotate(-0.8deg)" }}>
          <div style={{ position: "absolute", left: "178.3px", top: "-32px", width: "1.4px", height: "34px", background: "var(--string)" }} />
          <Clip color={tag.color} w={34} h={9} top="-7px" />
          {a.featured && <FeaturedTape style={{ left: "-6px", top: "-10px" }} />}
          <article style={{ boxSizing: "border-box", background: "var(--card)", border: "2px solid var(--ink)", boxShadow: `8px 8px 0 ${a.featured ? "var(--yellow)" : "var(--ink)"}`, padding: "10px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <ImageSlot src={a.cover} srcSet={coverSet(a.cover)} sizes="340px" first alt={a.alt} label={`${a.alt} — lead photo`} box={a.cover ? { height: "auto" } : { height: "240px" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <TagPill a={a} size="10px" pad="3px 8px" lh="1.2" />
              <span style={{ fontFamily: FONT.mono, fontSize: "11px", letterSpacing: "1px", color: "var(--ink)" }}>{`${pad2(i + 1)} / ${pad2(n)}`}</span>
            </div>
            <h1 ref={title} style={{ margin: "0", fontFamily: FONT.head, fontWeight: "400", fontSize: "42px", lineHeight: "calc(0.95 * var(--head-lead, 1))", letterSpacing: "-0.3px", textTransform: "uppercase", color: "var(--ink)" }}>{a.title}</h1>
            <p style={{ margin: "0", fontFamily: FONT.hand, fontSize: "22px", lineHeight: "1.1", color: "var(--dek)" }}>{a.dek}</p>
          </article>
        </div>
      </div>
      <div className="rise-in" style={{ position: "relative", margin: "28px 0 0 20px", width: "350px", display: "flex", border: "2px solid var(--ink)", background: "var(--card)", fontFamily: FONT.mono, fontSize: "10px", letterSpacing: "1px", textTransform: "uppercase" }}>
        {a.author !== null && <div style={{ flexGrow: "1", padding: "10px", borderRight: "2px solid var(--ink)" }}>{`By ${a.author || '[Author]'}`}</div>}
        <div style={{ flexGrow: a.author === null ? "1" : undefined, padding: "10px", borderRight: "2px solid var(--ink)" }}>{a.date || '[Date]'}</div>
        <div style={{ padding: "10px", background: tag.color, color: tag.ink }}>{`${a.readTime || '[x]'} min`}</div>
      </div>
      <div className="rise-in" style={{ position: "relative", margin: "39px 0 0 24px", width: "342px", minHeight: "2606px", display: "flex", flexDirection: "column", gap: "22px" }}>
        <div ref={text} style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          <ArticleBody a={a} tag={tag} />
          <EndMark />
        </div>
        <AuthorBox a={a} />
        <PassItOn a={a} />
        {/* next on the line */}
        <div style={{ position: "relative", margin: "10px -24px 0", width: "390px", height: "470px" }}>
          <div style={{ position: "absolute", left: "20px", top: "0", fontFamily: FONT.mono, fontSize: "11px", letterSpacing: "1.6px" }}>NEXT ON THE LINE</div>
          <div style={{ position: "absolute", left: "0", top: "30px", width: "390px", height: "2px", background: "var(--string)" }} />
          <div style={{ position: "absolute", left: "200px", top: "32px", width: "1.4px", height: "36px", background: "var(--string)" }} />
          <ArticleCard article={next} style={{ position: "absolute", left: "70px", top: "70px", width: "250px", height: "330px", transform: "rotate(-2deg)" }} imgH="150px" titleSize="22px" dekSize="18px" />
          <BackHome className="lift-link" style={{ position: "absolute", left: "20px", top: "420px", minHeight: "44px", display: "flex", alignItems: "center", fontFamily: FONT.hand, fontSize: "21px", textDecoration: "none" }}>← back to home</BackHome>
        </div>
      </div>
    </div>
  );
}
