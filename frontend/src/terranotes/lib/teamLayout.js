import { useEffect, useRef, useState } from 'react';
import { teamsOf } from './format.js';
import { calm } from './motion.js';

// Geometry and colour logic for the "Meet the team" section (shared/TeamSection.jsx), both layouts. members / teams:
// the edition's MEMBERS and TEAMS (src/editions/<id>/team.js).

// the colour a member wears: their first team's
export const colorOf = (m, teams) => teams[teamsOf(m)[0]].color;

// Face positions for `count` members: rows alternate between the x-centres in rows[0] and rows[1] (a honeycomb), the
// walking direction flips every two rows, and each face is nudged so it looks hand-placed.
// Returns [{ cx, cy, size, float }] in member order; float = its drifting animation class (fl1–fl6, loops.css).
export function faceSpots({ rows, sizes, nudgeX, nudgeY, top, rowH }, count) {
  const spots = [];
  for (let row = 0; spots.length < count; row++) {
    const xs = row % 4 < 2 ? rows[row % 2] : [...rows[row % 2]].reverse();
    for (const x of xs) {
      if (spots.length === count) break;
      const i = spots.length, size = sizes[i % sizes.length];
      spots.push({ cx: x + nudgeX[i % nudgeX.length], cy: top + row * rowH + nudgeY[i % nudgeY.length] + size / 2, size, float: `fl${(i % 6) + 1}` });
    }
  }
  return spots;
}

// One dotted path per team through its members' faces (nearest face next, starting top-left), so people who work
// together are joined. bend = how much each link curves. Returns [{ team, d }].
export function teamLinks(spots, bend, members, teams) {
  return Object.keys(teams).map((team) => {
    const left = members.map((m, i) => i).filter((i) => teamsOf(members[i]).includes(team));
    if (left.length < 2) return { team, d: '' };
    left.sort((a, b) => spots[a].cx + spots[a].cy - spots[b].cx - spots[b].cy);
    const path = [left.shift()];
    while (left.length) {
      const p = spots[path[path.length - 1]];
      left.sort((a, b) => Math.hypot(spots[a].cx - p.cx, spots[a].cy - p.cy) - Math.hypot(spots[b].cx - p.cx, spots[b].cy - p.cy));
      path.push(left.shift());
    }
    return { team, d: path.slice(1).map((j, k) => { const a = spots[path[k]], b = spots[j]; return `M${a.cx} ${a.cy} Q${(a.cx + b.cx) / 2 + bend} ${(a.cy + b.cy) / 2 + bend} ${b.cx} ${b.cy}`; }).join(' ') };
  });
}

// Ring colour of each face. People in two teams alternate between their teams' colours every 35 s (fading slowly);
// picking one of their teams in the legend (filter) switches them to it at once (steady: true = keep the first team).
// Returns { colorFor(member), fade } where fade is the CSS transition time for the change.
export function useFaceColors(filter, teams) {
  const [phase, setPhase] = useState(0);
  const mode = useRef('fast');
  const lastFilter = useRef(filter);
  if (lastFilter.current !== filter) { lastFilter.current = filter; mode.current = 'fast'; }
  useEffect(() => {
    if (calm()) return undefined;
    const t = setInterval(() => { mode.current = 'slow'; setPhase((p) => p + 1); }, 35000);
    return () => clearInterval(t);
  }, []);
  const colorFor = (m) => {
    const ts = teamsOf(m);
    if (ts.length < 2) return colorOf(m, teams);
    if (ts.includes(filter)) return teams[filter].color;
    return m.steady ? colorOf(m, teams) : teams[ts[phase % ts.length]].color;
  };
  return { colorFor, fade: mode.current === 'slow' ? '3s' : '0.8s' };
}

// Where a profile card opens (px from the top of the team section): as near the middle of the screen as it can be
// while staying level with the tapped face (face centre cy at least `hug` px inside the card), always wholly on screen.
// header = sticky header height; zoom = --web-zoom.
export function profileTop({ section, header, cy, height, zoom = 1, hug = 70, pad = 16 }) {
  const y0 = -section.getBoundingClientRect().top / zoom; // how far the screen's top is into the section (offsetTop misses the artboard's own offset)
  const vTop = y0 + header + pad, vBot = y0 + innerHeight / zoom - pad;
  let top = (vTop + vBot - height) / 2;
  top = Math.min(Math.max(top, cy - height + hug), cy - hug);
  top = Math.min(Math.max(top, 0), section.offsetHeight - height);
  top = vBot - vTop >= height ? Math.min(Math.max(top, vTop), vBot - height) : vTop;
  return Math.round(top);
}
