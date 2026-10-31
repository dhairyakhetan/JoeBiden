import { Routes, Route } from 'react-router-dom'
import PublicLayout from '../components/PublicLayout'
import DemoLauncherPage from './DemoLauncherPage'
import DemoFlowPage from './DemoFlowPage'

/**
 * Everything under /demo/* (App.tsx's one new route branch - see that
 * file's single `<Route path="/demo/*" element={<DemoRoute />} />`).
 * PublicLayout gives both pages the real nav/footer, matching every other
 * public route; DemoFlowPage's own fixed ribbon sits above it.
 *
 * DemoProvider (the thing that actually shadows auth + data) is mounted
 * ONLY inside DemoFlowPage, i.e. only for /demo/:flowId, never for the
 * launcher itself - the launcher makes no member-shaped read, so there is
 * nothing for it to shadow.
 */
export default function DemoRoute() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<DemoLauncherPage />} />
        <Route path=":flowId" element={<DemoFlowPage />} />
      </Route>
    </Routes>
  )
}
