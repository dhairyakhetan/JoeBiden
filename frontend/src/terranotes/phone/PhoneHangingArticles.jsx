import { Link } from '../router.jsx';
import ArticleCard, { TagRow, cardCover } from '../shared/ArticleCard.jsx';
import ImageSlot from '../shared/ImageSlot.jsx';
import { ByTape, Clip, FeaturedTape } from '../shared/Tapes.jsx';
import { tagOf } from '../data/articles.js';
import { articleLink } from '../data/editions.js';
import { pad2 } from '../lib/format.js';
import { useFitTitle } from '../lib/fitTitle.js';
import { useByWriter } from '../lib/byWriter.js';
import { useEdition } from '../lib/edition.js';
import { flight } from '../lib/cardFlight.js';
import { FONT } from '../styles/fonts.js';

// The phone home page's articles: every card of its edition hangs on a string, in page coordinates (the
// parent box starts at the page's top-left). The chain:
//   "Articles" label (tied to the intro card's knot) → 02 → 04          01 (string from above the screen) → 03 → 05
//   06: the wide card, hanging from both 04 and 05        07 onwards: in pairs below it, a row each
// A card nested inside another card's box hangs from it and swings with it. .sway = swinging on the string (--a
// angle, --d duration), .flutter = wobbling on its clip (--r = resting tilt): styles/loops.css.
// With ?by=<writer>, that writer's pieces come first, taped (lib/byWriter.js).
const ROW = 300;
// how much taller (or, with under six cards, shorter) than the original design this is for these articles (PhoneHome
// moves the rest by it): the photo wall starts 70px under the lowest card, so a short edition leaves no hole
const LOWEST = [600, 780, 880, 1072, 1172]; // the bottom of the lowest card with 1–5 articles (page px)
export const hangExtra = (articles) => {
  const n = articles.length;
  if (n > 0 && n < 6) return LOWEST[n - 1] + 70 - 1190;
  return 270 + Math.ceil(Math.max(0, n - 6) / 2) * ROW;
};

const Thread = ({ left, top = 0, h }) => <div style={{ position: "absolute", left: `${left}px`, top: `${top}px`, width: "1.4px", height: `${h}px`, background: "var(--string)" }} />;
// one hanging card: a swinging hanger (box: left, top, w, h, a, d, delay) with its string, and the card on a flutter
function Hang({ box, string, card: [top, r, delay2], children }) {
  return (
    <div className="hang sway" style={{ position: "absolute", left: `${box.left}px`, top: `${box.top}px`, width: `${box.w}px`, height: `${box.h}px`, "--a": box.a, "--d": box.d, animationDelay: box.delay }}>
      <Thread left={box.w / 2 - 0.7} h={string} />
      <div className="flutter" style={{ position: "absolute", left: "0", top: `${top}px`, width: `${box.w}px`, height: "240px", "--r": r, transform: `rotate(${r})`, animationDelay: delay2 }}>{children}</div>
    </div>
  );
}

export default function PhoneHangingArticles() {
  const { by, isMine, list } = useByWriter();
  const count = useEdition().articles.length;
  const [a1, a2, a3, a4, a5, a6, ...more] = list;
  const mark = (a) => (isMine(a) ? by : undefined);
  const card = (a, w, title) => <ArticleCard article={a} mark={mark(a)} className="card" style={{ position: "absolute", left: "0", top: "0", width: `${w}px`, height: "240px" }} imgH="92px" titleSize={title} dekSize="15px" />;
  const fitWide = useFitTitle(a6?.title, 22, 15);
  return (
    <>
      {/* 07 onwards: pairs below the wide card (an odd one out hangs centred), strings tucked behind the card above */}
      {more.map((a, i) => {
        const row = Math.floor(i / 2), alone = i % 2 === 0 && i === more.length - 1;
        return (
          <Hang key={a.slug} box={{ left: alone ? 112 : i % 2 ? 208 : 30, top: 1376 + row * ROW, w: 166, h: 334, a: "0.9deg", d: i % 2 ? "6.1s" : "5.5s", delay: `${-0.8 - i}s` }} string={96} card={[94, ['-1.2deg', '1.4deg'][i % 2], `${-1.5 - i}s`]}>
            {card(a, 166, '15px')}
          </Hang>
        );
      })}
      {/* 06, the wide card: hangs from both 04 and 05; painted before them so its strings tuck behind */}
      {a6 && (
        <div className="hang sway" style={{ position: "absolute", left: "28px", top: "1052px", width: "334px", height: "344px", "--a": "0.35deg", "--d": "6.4s", animationDelay: "-2.6s" }}>
          <Thread left={121.3} h={150} />
          <Thread left={261.3} top={100} h={50} />
          <Link className="card" {...flight(a6)} style={{ position: "absolute", left: "0", top: "148px", width: "334px", height: "196px", display: "block", textDecoration: "none", color: "var(--ink)" }} to={articleLink(a6)}>
            {mark(a6) && <ByTape name={by} />}
            {a6.featured && <FeaturedTape />}
            <Clip color={tagOf(a6).color} w={24} h={9} top="-6px" left={110} />
            <Clip color={tagOf(a6).color} w={24} h={9} top="-6px" left={250} />
            <article style={{ width: "100%", height: "100%", boxSizing: "border-box", background: "var(--card)", border: "2px solid var(--ink)", boxShadow: `7px 7px 0 ${a6.featured ? "var(--yellow)" : "var(--ink)"}`, padding: "8px", display: "flex", gap: "12px" }}>
              <ImageSlot src={cardCover(a6.cover)} fallback={a6.cover} alt={a6.alt} box={{ width: "122px", flexShrink: "0", height: "176px" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingTop: "4px", flexGrow: "1" }}>
                <TagRow a={a6} />
                <h3 ref={fitWide} style={{ flexShrink: "0", margin: "0", fontFamily: FONT.head, fontWeight: "400", fontSize: "22px", lineHeight: "calc(0.95 * var(--head-lead, 1))", letterSpacing: "-0.3px", textTransform: "uppercase", color: "var(--ink)" }}>{a6.title}</h3>
                <p style={{ flexShrink: "0", margin: "0", fontFamily: FONT.hand, fontSize: "16px", lineHeight: "1.1", color: "var(--dek)" }}>{a6.dek}</p>
              </div>
            </article>
          </Link>
        </div>
      )}
      {/* 04 and 05: their own strings, tucked behind 02 and 03 (not nested, so the swings don't add up) */}
      {[[a4, 30, 760, "-1.4deg", "5.6s", "-2.2s"], [a5, 208, 860, "1.2deg", "6.2s", "-0.6s"]].map(([a, left, top, r, d, delay]) => a && (
        <Hang key={a.slug} box={{ left, top, w: 166, h: 312, a: "0.9deg", d, delay }} string={74} card={[72, r, delay]}>{card(a, 166, '15px')}</Hang>
      ))}
      {/* the "Articles" label card, tied to the intro card's knot; 02 hangs from it */}
      <div className="hang sway" style={{ position: "absolute", left: "20px", top: "312px", width: "150px", height: "196px", "--a": "1.79deg", "--d": "5.0s", animationDelay: "-0.4s" }}>
        <Thread left={74.3} h={62} />
        <div className="flutter" style={{ position: "absolute", left: "0", top: "60px", width: "150px", height: "136px", "--r": "-2.5deg", transform: "rotate(-2.5deg)", animationDelay: "-1.1s" }}>
          <div className="label-card" style={{ position: "absolute", left: "0", top: "0", width: "150px", height: "136px" }}>
            <Clip color="var(--red)" w={24} h={9} top="-6px" />
            <div style={{ width: "100%", height: "100%", boxSizing: "border-box", background: "var(--ink)", color: "var(--page)", padding: "16px", border: "2px solid var(--ink)", boxShadow: "6px 6px 0 var(--red)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <h2 style={{ margin: "0", fontFamily: FONT.hand, fontWeight: "700", fontSize: "46px", lineHeight: "0.9" }}>Articles</h2>
              <div style={{ fontFamily: FONT.mono, fontSize: "10px", letterSpacing: "1.4px", textTransform: "uppercase", color: "var(--faint)" }}>{`${pad2(count)} pieces`}</div>
            </div>
          </div>
          {a2 && <Hang box={{ left: 6, top: 136, w: 176, h: 272, a: "1.51deg", d: "5.8s", delay: "-3.4s" }} string={34} card={[32, "0.9deg", "-4.1s"]}>{card(a2, 176, '15.5px')}</Hang>}
        </div>
      </div>
      {/* 01: its string comes in from above the screen; 03 hangs from it */}
      {a1 && (
        <Hang box={{ left: 196, top: -60, w: 176, h: 648, a: "0.76deg", d: "6.0s", delay: "-2.0s" }} string={410} card={[408, "1.8deg", "-2.7s"]}>
          {card(a1, 176, '16px')}
          {a3 && <Hang box={{ left: 16, top: 240, w: 166, h: 292, a: "1.33deg", d: "5.4s", delay: "-1.1s" }} string={54} card={[52, "0.6deg", "-1.8s"]}>{card(a3, 166, '15px')}</Hang>}
        </Hang>
      )}
    </>
  );
}
