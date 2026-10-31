import type { History } from 'react-router-dom'
export type AnimatedHistory = History & {
  /** Runs each time a page has been put on screen, with its real pathname. Returns the unsubscribe. */
  onShown(fn: (pathname: string) => void): () => void
}
export function createAnimatedHistory(): AnimatedHistory
