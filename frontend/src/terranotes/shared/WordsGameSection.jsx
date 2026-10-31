import { useRef } from 'react';
import { fitWord, useWordsGame } from '../lib/useWordsGame.js';
import { useEdition } from '../lib/edition.js';
import { FONT } from '../styles/fonts.js';
import { useReveal } from '../lib/reveal.js';
import { LAYOUT, WORDS_ART } from '../editions/pages.js';

// "Words we should bring back." (id="words"), both layouts: an old word on a cloud (with how to say it), three meanings
// to pick from, the verdict + real definition, a "psst." hint after a while, and a score card after 5 words. Game
// state: lib/useWordsGame.js; words: the edition's (src/editions/<id>/words.js). Phone: cloud on top, options under it;
// web: cloud left, options right; with the edition's LAYOUT wordsRow (src/editions/pages.js), the heading on one line
// above, and the cloud and its options side by side, centred on each other (WEB_ROW), the verdict under the options.
const CLOUD = 'M26 104 H176 A24 24 0 0 0 178 56 A36 36 0 0 0 110 30 A30 30 0 0 0 56 42 A30 30 0 0 0 26 104 Z';
const PHONE = {
  section: { top: "1830px", width: "390px", height: "650px" }, btn: 'press',
  title: { left: "20px", top: "18px", width: "260px", fontSize: "36px", lineHeight: "0.98" },
  score: { right: "20px", top: "26px", textAlign: "right", fontSize: "9px", letterSpacing: "1.6px", lineHeight: "1.6" },
  cloud: { left: 10, top: 110, w: 370, h: 200, textTop: "78px", count: { fontSize: "9.5px", letterSpacing: "1.6px" }, word: [42, 266], gap: "4px", say: { fontSize: "11px", letterSpacing: "0.5px" }, sayGap: "2px", wordSpacing: "-0.5px", ask: "20px" },
  options: { left: "20px", top: "330px", width: "350px", gap: "12px" },
  option: { minHeight: "52px", padding: "10px 14px", gap: "12px", boxShadow: "4px 4px 0 var(--ink)", fontSize: "15px", transition: "background-color 120ms ease, opacity 120ms ease" }, mark: ["26px", "12px"],
  hint: { left: "34px", top: "550px", width: "300px", boxShadow: "5px 5px 0 var(--yellow)", padding: "12px 16px 10px 18px" }, psst: { left: "-12px", top: "-17px", fontSize: "20px", padding: "2px 12px" }, hintText: "21px",
  reveal: { left: "20px", top: "534px", width: "350px", gap: "12px" }, def: { fontSize: "13.5px", lineHeight: "1.45" },
  next: { minHeight: "44px", padding: "0 14px", boxShadow: "3px 3px 0 var(--yellow)", fontSize: "11px" },
  done: { left: "20px", top: "330px", width: "350px", boxShadow: "7px 7px 0 var(--ink)", padding: "18px" }, doneLabel: { fontSize: "10px", letterSpacing: "1.6px" }, doneScore: "64px", doneMsg: { marginTop: "6px", fontSize: "23px" },
  again: { marginTop: "14px", minHeight: "44px", padding: "0 16px", fontSize: "11px" },
};
const WEB = {
  section: { top: "1910px", width: "1440px", height: "600px" }, btn: 'btn',
  title: { left: "80px", top: "20px", width: "560px", fontSize: "68px", lineHeight: "0.95" },
  score: { left: "84px", top: "172px", fontSize: "12px", letterSpacing: "1.8px" },
  cloud: { left: 50, top: 230, w: 620, h: 320, textTop: "128px", count: { fontSize: "11px", letterSpacing: "1.8px" }, word: [68, 500], gap: "6px", say: { fontSize: "14px", letterSpacing: "0.6px" }, sayGap: "4px", wordSpacing: "-1px", ask: "26px" },
  options: { left: "760px", top: "110px", width: "600px", gap: "18px" },
  option: { minHeight: "68px", padding: "12px 20px", gap: "16px", boxShadow: "5px 5px 0 var(--ink)", fontSize: "19px", transition: "background-color 120ms ease, opacity 120ms ease, translate 160ms ease" }, mark: ["34px", "14px"],
  hint: { left: "790px", top: "414px", width: "440px", boxShadow: "6px 6px 0 var(--yellow)", padding: "14px 20px 12px 22px" }, psst: { left: "-14px", top: "-19px", fontSize: "23px", padding: "2px 14px" }, hintText: "26px",
  reveal: { left: "760px", top: "400px", width: "600px", gap: "20px" }, def: { fontSize: "16px", lineHeight: "1.5" },
  next: { minHeight: "48px", padding: "0 18px", boxShadow: "4px 4px 0 var(--yellow)", fontSize: "12px" },
  done: { left: "780px", top: "120px", width: "520px", boxShadow: "9px 9px 0 var(--ink)", padding: "28px" }, doneLabel: { fontSize: "12px", letterSpacing: "1.8px" }, doneScore: "96px", doneMsg: { marginTop: "8px", fontSize: "30px" },
  again: { marginTop: "18px", minHeight: "48px", padding: "0 20px", fontSize: "12px" },
};
const WEB_ROW = {
  ...WEB,
  title: { left: "80px", top: "24px", width: "900px", fontSize: "68px", lineHeight: "0.95" },
  score: { right: "80px", top: "54px", textAlign: "right", fontSize: "12px", letterSpacing: "1.8px" },
  cloud: { ...WEB.cloud, left: 70, top: 130 },
  options: { left: "760px", top: "170px", width: "600px", gap: "18px" }, // 3 × 68 + 2 × 18 = 240, centred on the 320 cloud
  hint: { ...WEB.hint, top: "452px" },
  reveal: { left: "760px", top: "450px", width: "600px", gap: "20px" },
  done: { ...WEB.done, top: "150px" },
};
const DARK_BTN = { background: "var(--ink)", color: "var(--card)", border: "2px solid var(--ink)", fontFamily: FONT.mono, fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase" };

export default function WordsGameSection({ web }) {
  const edition = useEdition();
  const L = web ? (LAYOUT[edition.id]?.wordsRow ? WEB_ROW : WEB) : PHONE, C = L.cloud;
  const ref = useRef(null);
  useReveal(ref);
  const w = useWordsGame(ref, edition.words);
  const art = WORDS_ART[edition.id]; // the edition's own cloud and option marks (src/editions/pages.js), if it has them
  return (
    <section id="words" ref={ref} style={{ position: "absolute", left: "0", ...L.section }}>
      <h2 data-ruled="2" data-rid="words-title" style={{ position: "absolute", margin: "0", fontFamily: FONT.serif, fontStyle: "italic", fontWeight: "400", color: "var(--ink)", ...L.title }}>Words we should bring back.</h2>
      <div data-ruled="1" data-rid="words-score" style={{ position: "absolute", fontFamily: FONT.mono, color: "var(--ink)", ...L.score }}>{web ? `MINI GAME · SCORE ${w.score} / ${w.total}` : <>MINI GAME<br />SCORE {w.score} / {w.total}</>}</div>
      {/* the word, on a cloud */}
      <div style={{ position: "absolute", left: `${C.left}px`, top: `${C.top}px`, width: `${C.w}px`, height: `${C.h}px` }}>
        {art ? <art.Cloud w={C.w} h={C.h} /> : (
          <svg width={C.w} height={C.h} viewBox="0 0 200 110" preserveAspectRatio="none" style={{ position: "absolute", left: "0", top: "0", overflow: "visible" }} aria-hidden="true">
            <path d={CLOUD} transform="translate(2.5 3)" style={{ fill: "var(--ink)" }} />
            <path d={CLOUD} strokeWidth="2" vectorEffect="non-scaling-stroke" style={{ fill: "var(--card)", stroke: "var(--ink)" }} />
          </svg>
        )}
        <div style={{ position: "absolute", left: "0", top: C.textTop, width: `${C.w}px`, textAlign: "center" }}>
          <div style={{ fontFamily: FONT.mono, color: "var(--grey)", ...C.count }}>{`WORD ${w.n} / ${w.total}`}</div>
          <div key={w.word} className="word-pop" style={{ marginTop: C.gap, fontFamily: FONT.head, fontSize: fitWord(w.word, ...C.word), lineHeight: "1", textTransform: "uppercase", letterSpacing: C.wordSpacing, color: "var(--ink)" }}>{w.word}</div>
          <div key={`${w.word}-say`} className="word-pop" style={{ marginTop: C.sayGap, fontFamily: FONT.mono, color: "var(--grey)", ...C.say }}>/ {w.say} /</div>
          <div style={{ marginTop: C.gap, fontFamily: FONT.hand, fontSize: C.ask, color: "var(--hand)" }}>what do you think it means?</div>
        </div>
      </div>
      {w.playing && (
        <>
          <div key={w.word} className="w-in" style={{ position: "absolute", display: "flex", flexDirection: "column", ...L.options }}>
            {w.options.map((o, i) => (
              <button key={o.text} className={`w-opt ${web ? 'btn ' : ''}${o.mood}`} onClick={o.pick} disabled={w.locked} style={{ width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", textAlign: "left", background: o.bg, color: o.fg, border: "2px solid var(--ink)", opacity: o.op, fontFamily: FONT.body, fontWeight: "500", lineHeight: "1.25", ...L.option }}>
                <span style={{ width: L.mark[0], height: L.mark[0], flexShrink: "0", border: "2px solid currentColor", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT.mono, fontWeight: "700", fontSize: L.mark[1] }}>{art ? art.marks[i % art.marks.length]({ size: Math.round(parseFloat(L.mark[0]) * 0.7) }) : o.mark}</span>
                <span style={{ flexGrow: "1" }}>{o.text}</span>
              </button>
            ))}
          </div>
          {/* the "psst." hint; the verdict replaces it once they answer */}
          {w.showHint && (
            <div className="w-hint" role="status" style={{ position: "absolute", boxSizing: "border-box", background: "var(--card)", border: "2px solid var(--ink)", transform: "rotate(-1.5deg)", ...L.hint }}>
              <div style={{ position: "absolute", background: "var(--ink)", color: "var(--yellow)", fontFamily: FONT.hand, transform: "rotate(-6deg)", ...L.psst }}>psst.</div>
              <div style={{ fontFamily: FONT.hand, fontSize: L.hintText, lineHeight: "1.1", color: "var(--ink)" }}>{w.hint}</div>
            </div>
          )}
          {w.locked && (
            <div className="w-reveal" style={{ position: "absolute", display: "flex", alignItems: "flex-start", ...L.reveal }}>
              <p style={{ margin: "0", flexGrow: "1", color: "var(--text)", ...L.def }}><strong style={{ fontWeight: "600" }}>{w.verdict}</strong>{" "}{w.def}</p>
              <button className={L.btn} onClick={w.next} style={{ "--c": "var(--yellow)", flexShrink: "0", ...DARK_BTN, ...L.next }}>{`${w.nextLabel} →`}</button>
            </div>
          )}
        </>
      )}
      {w.done && (
        <div className="w-reveal" style={{ position: "absolute", boxSizing: "border-box", background: "var(--yellow)", border: "2px solid var(--ink)", transform: "rotate(-1.5deg)", ...L.done }}>
          <div style={{ fontFamily: FONT.mono, ...L.doneLabel }}>YOUR SCORE</div>
          <div style={{ fontFamily: FONT.head, fontSize: L.doneScore, lineHeight: "1", color: "var(--ink)" }}>{`${w.score} / ${w.total}`}</div>
          <div style={{ fontFamily: FONT.hand, lineHeight: "1.1", color: "var(--ink)", ...L.doneMsg }}>{w.message}</div>
          <button className={web ? 'btn' : undefined} onClick={w.restart} style={{ ...DARK_BTN, ...L.again }}>Play again ↺</button>
        </div>
      )}
    </section>
  );
}
