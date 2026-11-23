import { Suspense, type ComponentProps } from 'react'
import { lazyWithRetry as lazy } from '../lib/lazyWithRetry'

/**
 * Lazy wrappers for components/ImpactLibrary.tsx. The pages that end with the library (About, a project write-up,
 * the pillar pages) import these instead, so the library's code, its topic list and its stylesheet load only when
 * the page renders, and the app's entry file does not grow by the preload list a static import would add.
 */
const Directory = lazy(() => import('./ImpactLibrary').then(m => ({ default: m.LibraryDirectory })))
const DriveCard = lazy(() => import('./ImpactLibrary').then(m => ({ default: m.DriveTopicsCard })))

export function LibraryDirectory(props: ComponentProps<typeof Directory>) {
  return <Suspense fallback={null}><Directory {...props} /></Suspense>
}
export function DriveTopicsCard(props: ComponentProps<typeof DriveCard>) {
  return <Suspense fallback={null}><DriveCard {...props} /></Suspense>
}
