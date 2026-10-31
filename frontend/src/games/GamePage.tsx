import './games.css'
import { Suspense, type ComponentType, type LazyExoticComponent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { lazyWithRetry } from '../lib/lazyWithRetry'
import { useMeta } from '../hooks/useMeta'
import { gameBySlug, type MiniGame } from './games'

// One lazy component per game, made once (not per render, which would remount the game every time the page re-rendered)
const lazyGames = new Map<string, LazyExoticComponent<ComponentType>>()
const gameComponent = (g: MiniGame) => {
  let c = lazyGames.get(g.slug)
  if (!c) { c = lazyWithRetry(g.load); lazyGames.set(g.slug, c) }
  return c
}

/** /games/:slug: one game, code-split per game. An unknown slug gets a way back, not a blank page. */
export default function GamePage() {
  const { slug } = useParams()
  const game = gameBySlug(slug)
  useMeta({ title: game ? `${game.title} · Mini games · AquaTerra` : 'Mini games · AquaTerra', description: game?.blurb || 'Short games from the AquaTerra crew.', image: '', path: `/games/${slug ?? ''}`, noIndex: !game })
  const Game = game ? gameComponent(game) : null
  return (
    <div className="gm-wrap">
      <Link to="/games" className="gm-back">← all mini games</Link>
      {game && Game ? (
        <>
          <h1 className="h-display gm-title">{game.title}</h1>
          <div className="gm-stage">
            <Suspense fallback={<div className="skeleton" style={{ height: 360 }} role="status" aria-label="Loading game" />}>
              <Game />
            </Suspense>
          </div>
        </>
      ) : (
        <div className="card gm-empty" role="status">
          <h1 className="h-display">no game called that.</h1>
          <p>It may have moved. The full list is one tap away.</p>
          <Link to="/games" className="btn btn-primary">see all mini games →</Link>
        </div>
      )}
    </div>
  )
}
