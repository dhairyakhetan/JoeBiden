import GameCard from './GameCard.jsx';
import { EditionsCard } from './InsideAQ.jsx';
import { AQ_LOOK } from '../host.js';

// The end of the home pages, under the team: the mini games card and (with AQ's look, src/host.js) the editions card.
// Web: side by side; phone: one above the other. `top` is where they start on the artboard; endCardsSpace() is how much
// taller the home page gets for them.
export const endCardsSpace = (web) => (web ? 420 : AQ_LOOK ? 600 : 300);

export default function EndCards({ web, top }) {
  return (
    <div style={{ position: "absolute", left: "0", right: "0", top: `${top}px`, display: "flex", flexDirection: web ? "row" : "column", alignItems: web ? "stretch" : "center", justifyContent: "center", gap: web ? "44px" : "36px" }}>
      <GameCard web={web} />
      <EditionsCard web={web} />
    </div>
  );
}
