import ImageSlot from './ImageSlot.jsx';
import { Clip } from './Tapes.jsx';
import { PhotoIcon } from './Icons.jsx';
import { editionData } from '../editions/index.js';
import { partId } from '../lib/readProgress.js';
import { FONT } from '../styles/fonts.js';

// An article's body, rendered from its `body` list (block formats: top of data/articles.js), on either layout.
// The phone draws it in a 342px column, web (`web`) in a 700px one at a bigger size; the page supplies the column.
// Web leaves out the field log (`log` block): the web article page pins it in the right margin instead.
const P = { phone: { fontSize: "18px", lineHeight: "1.6" }, web: { fontSize: "21px", lineHeight: "1.65" } };
const MONO = { fontFamily: FONT.mono, letterSpacing: "1px", textTransform: "uppercase" };
const HEAD = { fontFamily: FONT.head, textTransform: "uppercase", lineHeight: "1" };
const cap = (t) => t.match(/^[“‘"'(]*./u)[0]; // the drop cap: first letter, with any opening quote mark before it

function Block({ b, first, part, a, tag, web }) {
  const para = { fontFamily: FONT.read, color: "var(--text)", margin: "0", ...P[web ? 'web' : 'phone'], ...(typeof b === 'string' && b.includes('\n') && { whiteSpace: "pre-line" }) }; // a poem's stanza keeps its lines
  if (typeof b === 'string') {
    if (!first) return <p style={para}>{b}</p>;
    const draft = b.startsWith('['); // still a [placeholder]: the drop cap is the title's first letter
    return <p style={para}><span style={{ float: "left", fontFamily: FONT.head, fontSize: web ? "78px" : "62px", lineHeight: "0.8", margin: web ? "8px 14px 0 0" : "6px 10px 0 0", padding: web ? "8px 10px" : "6px 8px", background: tag.color, color: tag.ink, border: "2px solid var(--ink)" }}>{draft ? a.title[0] : cap(b)}</span>{draft ? b : b.slice(cap(b).length)}</p>;
  }
  if (b.h2 != null) {
    // numbered: a little tag-coloured tab with the section's number, then the heading (id part-N: the web rail's links)
    return (
      <h2 id={partId(part)} data-part="" style={{ margin: web ? "24px 0 0" : "16px 0 0", scrollMarginTop: web ? "36px" : "20px", fontFamily: FONT.head, fontWeight: "400", fontSize: web ? "34px" : "25px", lineHeight: "1.02", textTransform: "uppercase", display: "flex", alignItems: "flex-start", gap: web ? "16px" : "12px" }}>
        <span aria-hidden="true" style={{ ...MONO, flexShrink: "0", marginTop: web ? "2px" : "1px", fontSize: web ? "13px" : "11px", fontWeight: "700", lineHeight: "1", padding: web ? "7px 8px" : "6px 6px", background: tag.color, color: tag.ink, border: "2px solid var(--ink)", boxShadow: "3px 3px 0 var(--ink)", transform: "rotate(-3deg)" }}>{String(part + 1).padStart(2, '0')}</span>
        <span>{b.h2}</span>
      </h2>
    );
  }
  if (b.quote != null) {
    return (
      <blockquote style={{ margin: web ? "16px -120px" : "8px 0", boxSizing: "border-box", width: web ? undefined : "342px", transform: `rotate(${web ? -1.2 : -1.5}deg)`, background: "var(--card)", border: "2px solid var(--ink)", boxShadow: web ? `10px 10px 0 ${tag.color}` : `8px 8px 0 ${tag.color}`, padding: web ? "30px 34px 26px" : "20px 18px 18px" }}>
        <div style={{ fontFamily: FONT.head, fontSize: web ? "40px" : "26px", lineHeight: "1", textTransform: "uppercase", letterSpacing: web ? "-0.6px" : "-0.4px" }}>{`“${b.quote}”`}</div>
        <div style={{ ...MONO, marginTop: web ? "14px" : "12px", fontSize: web ? "12px" : "10px" }}>{`— ${b.by}`}</div>
      </blockquote>
    );
  }
  if (b.log) return web ? null : <FieldLog log={b.log} />;
  if (b.photos) {
    const small = (p, left, top, deg) => (
      <figure style={{ position: "absolute", left, top, width: web ? "360px" : "158px", margin: "0", transform: `rotate(${deg}deg)`, background: "var(--card)", border: "2px solid var(--ink)", boxShadow: web ? "7px 7px 0 var(--ink)" : "5px 5px 0 var(--ink)", padding: web ? "9px 9px 0" : "6px 6px 0" }}>
        <ImageSlot src={p.photo} alt={p.caption} label="photo" box={{ height: web ? "220px" : "130px" }} icon={web ? 22 : 18} font={web ? "12px" : "11px"} />
        <figcaption style={{ fontFamily: FONT.hand, fontSize: web ? "20px" : "16px", padding: web ? "6px 0 8px" : "4px 0 6px" }}>{p.caption || '[caption]'}</figcaption>
      </figure>
    );
    return (
      <div style={{ position: "relative", height: web ? "330px" : "230px" }}>
        {small(b.photos[0], web ? "-40px" : "0", "0", -3)}
        {b.photos[1] && small(b.photos[1], web ? "380px" : "176px", "40px", 3)}
      </div>
    );
  }
  if (b.photo != null) {
    return (
      <figure style={{ position: "relative", margin: web ? "14px 0 0 40px" : "10px 0 0 18px", width: web ? "600px" : "290px", transform: `rotate(${web ? 1.5 : 2}deg)` }}>
        <Clip color={tag.color} w={web ? 36 : 30} h={web ? 10 : 9} top={web ? "-8px" : "-7px"} />
        <div style={{ background: "var(--card)", border: "2px solid var(--ink)", boxShadow: web ? "8px 8px 0 var(--ink)" : "6px 6px 0 var(--ink)", padding: web ? "12px 12px 0" : "8px 8px 0" }}>
          <ImageSlot src={b.photo} alt={b.caption} label="photo" box={{ height: web ? "360px" : "200px" }} icon={web ? 22 : 18} font={web ? "12px" : "11px"} />
          <figcaption style={{ fontFamily: FONT.hand, fontSize: web ? "24px" : "19px", padding: web ? "8px 2px 10px" : "6px 2px 8px" }}>{b.caption || "[caption — what we're looking at]"}</figcaption>
        </div>
      </figure>
    );
  }
  return <Extra b={b} tag={tag} web={web} />;
}

// The yellow "Field log" box ({ log: [['PLACE', 'Kolkata'], …] }). Phone: in the text; web: in the right margin, at the
// top of the column the "in this piece" rail sticks in (web/WebArticle.jsx).
export function FieldLog({ log, web }) {
  return (
    <aside style={web
      ? { position: "relative", marginBottom: "48px", width: "250px", boxSizing: "border-box", transform: "rotate(1.5deg)", background: "var(--yellow)", border: "2px solid var(--ink)", boxShadow: "7px 7px 0 var(--ink)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: "9px", fontFamily: FONT.mono, fontSize: "12px", lineHeight: "1.4" }
      : { boxSizing: "border-box", width: "300px", marginLeft: "30px", transform: "rotate(1.2deg)", background: "var(--yellow)", border: "2px solid var(--ink)", boxShadow: "6px 6px 0 var(--ink)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px", fontFamily: FONT.mono, fontSize: "12px", lineHeight: "1.4" }}>
      <div style={{ fontFamily: FONT.head, fontSize: web ? "20px" : "18px", textTransform: "uppercase", letterSpacing: web ? undefined : "-0.2px" }}>Field log</div>
      {log.map(([label, value], i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: web ? "10px" : undefined, borderTop: "1.5px solid var(--ink)", paddingTop: web ? "7px" : "6px" }}>
          <span>{label}</span>
          <span style={{ textAlign: web ? "right" : undefined }}>{value}</span>
        </div>
      ))}
    </aside>
  );
}

// The small editorial pieces (numbers / checklist / loop / then / projects blocks), drawn a size up (×1.25) on web.
function Extra({ b, tag, web }) {
  const z = web ? 1.25 : 1, px = (n) => `${Math.round(n * z)}px`;
  if (b.projects) {
    // AQ Labs: a numbered stack of rounded bars in each project's own colours; two per row on web
    return (
      <ol style={{ listStyle: "none", margin: web ? "4px 0" : "2px 0", padding: "0", display: web ? "grid" : "flex", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", flexDirection: "column", gap: px(10) }}>
        {b.projects.map((p, i) => (
          <li key={p.name} style={{ boxSizing: "border-box", background: p.color, color: p.ink, borderRadius: px(18), padding: `${px(14)} ${px(18)} ${px(15)}`, display: "flex", alignItems: "flex-start", gap: px(12) }}>
            <div style={{ flexGrow: "1", minWidth: "0" }}>
              <div style={{ ...HEAD, fontSize: web ? "24px" : px(22), letterSpacing: "-0.6px" }}>{p.name}</div>
              <div style={{ fontFamily: FONT.mono, fontWeight: "700", fontSize: px(10.5), lineHeight: "1.4", marginTop: px(5) }}>{p.meta}</div>
              <div style={{ fontSize: px(13.5), lineHeight: "1.4", marginTop: px(7), opacity: ".9" }}>{p.what}</div>
            </div>
            <span style={{ ...HEAD, fontSize: px(15), paddingTop: px(4), flexShrink: "0" }}>{String(i + 1).padStart(2, '0')}</span>
          </li>
        ))}
      </ol>
    );
  }
  if (b.numbers) {
    return (
      <aside style={{ boxSizing: "border-box", width: px(300), marginLeft: web ? "60px" : "22px", transform: "rotate(1.2deg)", background: "var(--yellow)", border: "2px solid var(--ink)", boxShadow: "6px 6px 0 var(--ink)", padding: `${px(14)} ${px(16)}`, display: "flex", flexDirection: "column", gap: px(8) }}>
        <div style={{ ...HEAD, fontSize: px(18) }}>{b.title}</div>
        {b.numbers.map(([label, value], i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px", borderTop: "1.5px solid var(--ink)", paddingTop: px(6) }}>
            <span style={{ ...MONO, fontSize: px(10.5) }}>{label}</span>
            <span style={{ fontFamily: FONT.hand, fontSize: px(22), lineHeight: "1", textAlign: "right" }}>{value}</span>
          </div>
        ))}
      </aside>
    );
  }
  if (b.checklist) {
    return (
      <aside style={{ position: "relative", boxSizing: "border-box", width: px(290), marginLeft: web ? "40px" : "14px", transform: "rotate(-1.5deg)", background: "var(--card)", border: "2px solid var(--ink)", boxShadow: `6px 6px 0 ${tag.color}`, padding: `${px(18)} ${px(18)} ${px(14)}` }}>
        <div style={{ position: "absolute", left: "50%", top: "-8px", marginLeft: "-22px", width: "44px", height: "14px", background: tag.color, opacity: ".85", transform: "rotate(-3deg)" }} />
        <div style={{ ...MONO, fontSize: px(10), marginBottom: px(8) }}>{b.title}</div>
        {b.checklist.map(([item, done], i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: px(10), padding: `${px(3)} 0` }}>
            <span style={{ flexShrink: "0", width: px(16), height: px(16), marginTop: px(4), boxSizing: "border-box", border: "2px solid var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: px(13), lineHeight: "1", fontWeight: "700" }}>{done ? '✓' : ''}</span>
            <span style={{ fontFamily: FONT.hand, fontSize: px(22), lineHeight: "1.1", color: done ? "var(--done)" : "var(--ink)", textDecoration: done ? "line-through" : "none" }}>{item}</span>
          </div>
        ))}
      </aside>
    );
  }
  if (b.loop) {
    return (
      <aside style={{ boxSizing: "border-box", margin: web ? "8px -60px" : "4px 0", transform: "rotate(-0.8deg)", background: "var(--ink)", color: "var(--page)", border: "2px solid var(--ink)", boxShadow: `7px 7px 0 ${tag.color}`, padding: `${px(18)} ${px(18)}` }}>
        <div style={{ ...HEAD, fontSize: px(18), color: tag.color, marginBottom: px(12) }}>{b.title}</div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: `${px(8)} ${px(8)}` }}>
          {b.loop.map((step, i) => (
            <span key={i} style={{ display: "contents" }}>
              <span style={{ ...MONO, fontSize: px(10.5), lineHeight: "1.3", padding: `${px(5)} ${px(9)}`, border: "1.5px solid var(--page)", borderRadius: "999px" }}>{step}</span>
              <span aria-hidden="true" style={{ fontFamily: FONT.mono, fontSize: px(14), color: tag.color }}>→</span>
            </span>
          ))}
          <span style={{ fontFamily: FONT.hand, fontSize: px(22), lineHeight: "1", color: tag.color }}>↺ and again</span>
        </div>
      </aside>
    );
  }
  if (b.then) {
    const [left, right] = b.labels || ['then', 'now'];
    const cell = { padding: `${px(8)} ${px(12)}`, borderTop: "1.5px solid var(--ink)" };
    return (
      <aside style={{ boxSizing: "border-box", margin: web ? "8px -40px" : "4px 0", transform: "rotate(0.8deg)", background: "var(--card)", border: "2px solid var(--ink)", boxShadow: "7px 7px 0 var(--ink)" }}>
        <div style={{ ...HEAD, fontSize: px(18), padding: `${px(14)} ${px(12)} ${px(10)}` }}>{b.title}</div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
          <div style={{ ...cell, ...MONO, fontSize: px(10), background: tag.color, color: tag.ink, borderRight: "1.5px solid var(--ink)" }}>{left}</div>
          <div style={{ ...cell, ...MONO, fontSize: px(10), background: "var(--ink)", color: "var(--page)" }}>{right}</div>
          {b.then.map(([a, c], i) => [
            <div key={`a${i}`} style={{ ...cell, borderRight: "1.5px solid var(--ink)", fontFamily: FONT.hand, fontSize: px(20), lineHeight: "1.1", color: "var(--hand)" }}>{a}</div>,
            <div key={`b${i}`} style={{ ...cell, fontFamily: FONT.body, fontSize: px(14), lineHeight: "1.35", color: "var(--ink)" }}>{c}</div>,
          ])}
        </div>
      </aside>
    );
  }
  return null;
}

// Every block of the article, in order (the first paragraph gets the drop cap).
export default function ArticleBody({ a, tag, web }) {
  const first = a.body.findIndex((b) => typeof b === 'string');
  let part = -1; // section headings are numbered in order
  return a.body.map((b, i) => <Block key={i} b={b} first={i === first} part={b?.h2 != null ? ++part : part} a={a} tag={tag} web={web} />);
}

// The end of the text: a small ink square, "end of the piece", and a rule
export function EndMark({ web }) {
  return (
    <div aria-hidden="true" style={{ display: "flex", alignItems: "center", gap: web ? "14px" : "10px", marginTop: web ? "8px" : "4px" }}>
      <span style={{ width: web ? "18px" : "14px", height: web ? "18px" : "14px", background: "var(--ink)", flexShrink: "0" }} />
      <span style={{ ...MONO, fontSize: web ? "12px" : "10.5px", fontWeight: "700", whiteSpace: "nowrap" }}>end of the piece</span>
      <span style={{ flexGrow: "1", height: "2px", background: "var(--ink)" }} />
    </div>
  );
}

// The "words by" box under the text (not for articles from Aquaterra itself: author null).
export function AuthorBox({ a, web }) {
  if (a.author === null) return null;
  const who = editionData(a.edition).members.find((m) => m.name === a.author), d = web ? "88px" : "72px";
  return (
    <div style={{ ...(web ? { marginTop: "20px" } : { margin: "18px 0 0 -4px", width: "350px" }), boxSizing: "border-box", background: "var(--card)", border: "2px solid var(--ink)", boxShadow: web ? "7px 7px 0 var(--ink)" : "6px 6px 0 var(--ink)", padding: web ? "18px" : "14px", display: "flex", gap: web ? "18px" : "14px", alignItems: "center" }}>
      <div style={{ width: d, height: d, flexShrink: "0", boxSizing: web ? "border-box" : undefined, borderRadius: "50%", border: "2px solid var(--ink)", background: "var(--blank)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {who?.photo ? <img src={who.photo} alt="" style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} /> : <PhotoIcon size={22} />}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: web ? "5px" : "4px" }}>
        <div style={{ fontFamily: FONT.mono, fontSize: web ? "11px" : "10px", letterSpacing: "1px" }}>WORDS BY</div>
        <div style={{ fontFamily: FONT.head, fontSize: web ? "24px" : "20px", textTransform: "uppercase", lineHeight: "1" }}>{a.author || '[Name]'}</div>
      </div>
    </div>
  );
}
