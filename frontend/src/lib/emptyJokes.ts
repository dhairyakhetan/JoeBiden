import { useState } from 'react'

// A small easter egg: empty states that would otherwise say the exact same
// static sentence every time now draw from a rotating pool instead - costs
// nothing, adds personality exactly where the UI would otherwise feel
// dead. One line always wins if the pool is empty/missing, so nothing here
// can ever leave a blank empty-state message.
const EMPTY_JOKES: Record<string, string[]> = {
  saved: [
    "tap the bookmark icon on any post to save it here.",
    "this is the loneliest tab on the site - go fix that.",
    "future-you is going to want to reread something. save it now.",
    "empty. bookmark-shaped void. you know what to do.",
  ],
  search: [
    "try a different word, or blame the algorithm.",
    "we looked everywhere. certainly everywhere.",
    "nothing here. the void agrees with you.",
    "not even a rumor matching that.",
  ],
  notifications: [
    "quiet in here. that's not a bad thing.",
    "nothing new. go do something notification-worthy.",
    "the notification bell is taking a break.",
  ],
  comments: [
    "silence. be the one who breaks it.",
    "no one's said anything yet. you could.",
    "empty thread. your move.",
    "first comment's the hardest. just kidding, it's easy.",
  ],
}

/** Pick once per mount (stable across re-renders) - pass a `kind` key from
 * EMPTY_JOKES and a plain-language fallback that always wins if the pool
 * is missing or empty. */
export function useEmptyJoke(kind: keyof typeof EMPTY_JOKES, fallback: string): string {
  const [line] = useState(() => {
    const pool = EMPTY_JOKES[kind]
    if (!pool || pool.length === 0) return fallback
    return pool[Math.floor(Math.random() * pool.length)]
  })
  return line
}
