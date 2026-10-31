import { useEffect } from 'react';
import { cardCover } from '../shared/ArticleCard.jsx';
import { Link } from '../router.jsx';
import PhoneHeader from '../phone/PhoneHeader.jsx';
import WebHeader from '../web/WebHeader.jsx';
import { LatestTag } from '../shared/Tapes.jsx';
import { BackToMagazine } from '../shared/InsideAQ.jsx';
import { AQ_LOOK } from '../host.js';
import { EDITIONS, LATEST, PUBLISHED, articleLink, editionLink, editionName } from '../data/editions.js';
import { editionData } from '../editions/index.js';
import { pad2 } from '../lib/format.js';
import { FONT } from '../styles/fonts.js';

// /editions: every monthly edition, each drawn in its own colours and heading font (its look.js, put on the tile as the
// same CSS variables the pages use, so var(--ink) inside a tile is that edition's ink). The latest (the home page's) on
// top, big: its covers, its theme, its intro line and its pieces. Under it every other issue, a shelf of same-size
// tiles (cover, number, month, theme, pieces, "open →"), newest first. Then the editions still being made (draft: true), as dashed "coming"
// tiles with only their month, no link and nothing of their content. Both layouts, in normal document flow.
const MONO = { fontFamily: FONT.mono, letterSpacing: "1.4px", textTransform: "uppercase" };
const HEAD = { fontFamily: FONT.head, fontWeight: "400", lineHeight: "calc(0.95 * var(--head-lead, 1))" };
// an edition's look as CSS variables, for its tile
const lookOf = (n) => {
  const { look } = editionData(n);
  return { ...Object.fromEntries(Object.entries(look.colors).map(([k, v]) => [`--${k}`, v])), ...Object.fromEntries(Object.entries(look.fonts).map(([k, v]) => [`--font-${k}`, v])) };
};
const coverOf = (list) => (list.find((a) => a.featured) || list[0])?.cover;

function Frame({ web, children }) {
  useEffect(() => { document.title = 'Aquaterra — Editions'; }, []);
  if (web) {
    return (
      <div className="web">
        <div style={{ position: "relative", width: "1440px", margin: "0 auto", overflow: "clip", background: "var(--page)", color: "var(--ink)", fontFamily: FONT.body, paddingBottom: "110px" }}>
          <WebHeader />
          <BackToMagazine web />
          <div style={{ width: "1120px", margin: "0 auto", paddingTop: "60px" }}>{children}</div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ position: "relative", width: "390px", margin: "0 auto", overflow: "clip", background: "var(--page)", color: "var(--ink)", fontFamily: FONT.body, paddingBottom: "70px" }}>
      <PhoneHeader current="editions" />
      <BackToMagazine />
      <div style={{ padding: AQ_LOOK ? "84px 20px 0" : "30px 20px 0" }}>{children}</div>{/* AQ's look: clear of the back pill */}
    </div>
  );
}

const Kicker = ({ web, children }) => <h2 style={{ ...MONO, margin: web ? "80px 0 22px" : "50px 0 16px", fontSize: web ? "13px" : "11px", fontWeight: "700", display: "flex", alignItems: "center", gap: "12px" }}>{children}<span style={{ flexGrow: "1", height: "2px", background: "var(--ink)" }} /></h2>;

// the latest edition, big
function Latest({ e, web }) {
  const d = editionData(e.number), list = d.articles, covers = list.filter((a) => a.cover).slice(0, 3);
  return (
    <article style={{ ...lookOf(e.number), position: "relative", display: "grid", gridTemplateColumns: web ? "460px 1fr" : "1fr", background: "var(--page)", color: "var(--ink)", border: "3px solid var(--ink)", boxShadow: `${web ? 12 : 8}px ${web ? 12 : 8}px 0 var(--yellow)` }}>
      <Link to={editionLink(e.number)} aria-label={`Open ${editionName(e.number)}, ${e.month}`} style={{ position: "relative", display: "block", height: web ? "100%" : "250px", minHeight: web ? "440px" : "0", background: "var(--ink)", overflow: "hidden", borderRight: web ? "3px solid var(--ink)" : "none", borderBottom: web ? "none" : "3px solid var(--ink)" }}>
        {covers.map((a, i) => (
          <img key={a.slug} src={cardCover(a.cover)} alt="" loading="eager" decoding="async" style={{ position: "absolute", objectFit: "cover", border: "3px solid var(--card)", boxShadow: "6px 6px 0 var(--ink)", ...[
            { left: web ? "110px" : "120px", top: web ? "40px" : "18px", width: web ? "240px" : "150px", height: web ? "320px" : "200px", rotate: "-2deg", zIndex: "2" },
            { left: web ? "24px" : "22px", top: web ? "150px" : "60px", width: web ? "150px" : "100px", height: web ? "200px" : "134px", rotate: "-8deg" },
            { left: web ? "290px" : "236px", top: web ? "170px" : "56px", width: web ? "150px" : "100px", height: web ? "200px" : "134px", rotate: "7deg" },
          ][i] }} />
        ))}
      </Link>
      <div style={{ padding: web ? "38px 44px 40px" : "20px 18px 24px", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span style={{ ...MONO, fontSize: web ? "12px" : "10.5px", fontWeight: "700" }}>{`${editionName(e.number).replace('Edition ', 'No. ')} · ${e.month}`}</span>
          <LatestTag size={web ? '11px' : '10px'} />
        </div>
        <h3 style={{ ...HEAD, margin: web ? "14px 0 0" : "10px 0 0", fontSize: web ? "84px" : "48px", color: "var(--ink)" }}>{e.theme || e.month}</h3>
        <p style={{ margin: web ? "12px 0 0" : "8px 0 0", fontFamily: FONT.hand, fontSize: web ? "30px" : "23px", lineHeight: "1.1", color: "var(--hand)" }}>{d.intro}</p>
        <ol style={{ margin: web ? "22px 0 0" : "16px 0 0", padding: "0", listStyle: "none", display: "grid", gap: web ? "6px" : "4px" }}>
          {list.map((a, i) => (
            <li key={a.slug} style={{ display: "flex", gap: "10px", alignItems: "baseline", fontSize: web ? "17px" : "15px", lineHeight: "1.35" }}>
              <span style={{ ...MONO, fontSize: "11px", color: "var(--muted)", flexShrink: "0" }}>{pad2(i + 1)}</span>
              <Link to={articleLink(a)} className="ed-line" style={{ color: "var(--text)", textDecoration: "none" }}>{a.title}{a.author ? <span style={{ color: "var(--muted)" }}>{` · ${a.author}`}</span> : null}</Link>
            </li>
          ))}
        </ol>
        <Link className="press btn" to={editionLink(e.number)} style={{ "--c": "var(--ink)", ...MONO, alignSelf: "flex-start", fontWeight: "700", fontSize: "11px", marginTop: web ? "28px" : "20px", minHeight: "44px", padding: "0 20px", display: "inline-flex", alignItems: "center", background: "var(--ink)", color: "var(--card)", border: "2px solid var(--ink)", boxShadow: "4px 4px 0 var(--yellow)", textDecoration: "none" }}>Open the latest edition →</Link>
      </div>
    </article>
  );
}

// a back issue on the shelf: same size for every edition, in its own colours
function Tile({ e, web }) {
  const d = editionData(e.number), cover = coverOf(d.articles);
  return (
    <Link to={editionLink(e.number)} className="ed-tile" aria-label={`${editionName(e.number)}, ${e.month}${e.theme ? `: ${e.theme}` : ''}`} style={{ ...lookOf(e.number), display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box", background: "var(--page)", color: "var(--ink)", border: "2px solid var(--ink)", boxShadow: `${web ? 7 : 5}px ${web ? 7 : 5}px 0 var(--ink)`, textDecoration: "none" }}>
      <span style={{ display: "block", aspectRatio: "4 / 3", background: "var(--blank)", borderBottom: "2px solid var(--ink)", overflow: "hidden" }}>
        {cover && <img src={cardCover(cover)} alt="" loading="lazy" decoding="async" style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 25%" }} />}
      </span>
      <span style={{ display: "flex", flexDirection: "column", flexGrow: "1", padding: web ? "16px 18px 18px" : "10px 11px 12px" }}>
        <span style={{ ...MONO, fontSize: web ? "11px" : "9px", fontWeight: "700", letterSpacing: web ? "1.4px" : "0.8px" }}>{`${editionName(e.number).replace('Edition ', 'No. ')} · ${e.month.replace(/^(\w{3})\w*/, '$1')}`}</span>
        <span style={{ ...HEAD, marginTop: web ? "8px" : "6px", fontSize: web ? "34px" : "21px", color: "var(--ink)" }}>{e.theme || e.month}</span>
        {web && <span style={{ marginTop: "6px", fontFamily: FONT.hand, fontSize: "21px", lineHeight: "1.1", color: "var(--hand)" }}>{d.intro}</span>}
        <span style={{ flexGrow: "1" }} />
        <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: web ? "14px" : "10px", ...MONO, fontSize: web ? "11px" : "9.5px", letterSpacing: "1px" }}>
          <span style={{ color: "var(--muted)" }}>{`${pad2(d.articles.length)} pieces`}</span>
          <span style={{ fontWeight: "700" }}>open →</span>
        </span>
      </span>
    </Link>
  );
}

function Coming({ e, web }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", minHeight: web ? "130px" : "100px", boxSizing: "border-box", border: "2px dashed var(--slotLine)", background: "var(--cream)", padding: "12px", textAlign: "center" }}>
      <span style={{ ...MONO, fontSize: web ? "11px" : "9.5px", fontWeight: "700", color: "var(--slotInk)" }}>{editionName(e.number).replace('Edition ', 'No. ')}</span>
      <span style={{ fontFamily: FONT.hand, fontSize: web ? "26px" : "21px", lineHeight: "1", color: "var(--hand)" }}>{e.month.split(' ')[0]}</span>
      <span style={{ ...MONO, fontSize: web ? "10px" : "9px", color: "var(--muted)" }}>coming soon</span>
    </div>
  );
}

export function EditionsPage({ web }) {
  const latest = PUBLISHED.find((e) => e.number === LATEST);
  const past = [...PUBLISHED].reverse().filter((e) => e.number !== LATEST), coming = EDITIONS.filter((e) => e.draft && e.number > LATEST);
  return (
    <Frame web={web}>
      <div className="cascade-in">
        <div style={{ ...MONO, fontSize: web ? "12px" : "11px" }}>TerraNotes · one edition a month</div>
        <h1 style={{ ...HEAD, margin: "8px 0 0", fontSize: web ? "110px" : "60px", lineHeight: "0.9", textTransform: "uppercase", color: "var(--ink)" }}>Editions</h1>
        <div style={{ marginTop: "8px", fontFamily: FONT.hand, fontSize: web ? "30px" : "22px", color: "var(--hand)", transform: "rotate(-1deg)" }}>every issue, each in its own colours</div>
      </div>
      <Kicker web={web}>On the front page</Kicker>
      <Latest e={latest} web={web} />
      <Kicker web={web}>{`${past.some((e) => e.number > LATEST) ? 'Every other issue' : 'Back issues'} · ${past.length}`}</Kicker>
      {past.length ? (
        <div style={{ display: "grid", gridTemplateColumns: web ? "repeat(3, 1fr)" : "1fr 1fr", gap: web ? "34px" : "18px 14px" }}>{past.map((e) => <Tile key={e.number} e={e} web={web} />)}</div>
      ) : (
        <p style={{ margin: "0", fontFamily: FONT.hand, fontSize: web ? "28px" : "22px", color: "var(--hand)" }}>This is the first one. Older issues will line up here.</p>
      )}
      {coming.length > 0 && <>
        <Kicker web={web}>Coming up</Kicker>
        <div style={{ display: "grid", gridTemplateColumns: web ? "repeat(4, 1fr)" : "1fr 1fr", gap: web ? "24px" : "14px" }}>{coming.map((e) => <Coming key={e.number} e={e} web={web} />)}</div>
      </>}
    </Frame>
  );
}
