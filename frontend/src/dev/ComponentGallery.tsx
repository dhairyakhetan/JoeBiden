import { useEffect, useState } from 'react'
import Button from '../components/Button'
import Card from '../components/Card'
import Badge from '../components/Badge'
import Avatar from '../components/Avatar'
import Toggle from '../components/Toggle'
import Tabs from '../components/Tabs'
import Input from '../components/Input'
import TextArea from '../components/TextArea'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { useConfirm, HoldToConfirmButton } from '../components/Confirm'

const CATS = ['events', 'welfare', 'labs', 'ops', 'content'] as const

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 'var(--sp-8)' }}>
      <h2 className="h-display" style={{ fontSize: 22, marginBottom: 'var(--sp-4)', color: 'var(--ink)' }}>{title}</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', alignItems: 'center' }}>{children}</div>
    </section>
  )
}

/**
 * Phase 2 exit-gate deliverable - a scratch route that renders every shared
 * primitive in every state. Unlisted, DEV-only (see App.tsx). Not a product
 * page; the point is to eyeball/keyboard-test the component library in isolation.
 */
export default function ComponentGallery() {
  const toast = useToast()
  const confirm = useConfirm()
  const [on, setOn] = useState(true)
  const [tab, setTab] = useState('one')
  const [modal, setModal] = useState(false)

  useEffect(() => {
    document.title = 'components - AquaTerra (dev)'
    const m = document.createElement('meta')
    m.name = 'robots'; m.content = 'noindex'
    document.head.appendChild(m)
    return () => { document.head.removeChild(m) }
  }, [])

  const tabs = [{ id: 'one', label: 'first' }, { id: 'two', label: 'second' }, { id: 'three', label: 'third' }]

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 'var(--sp-7) var(--page-px) var(--sp-8)' }}>
      <p className="mono upper" style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>★ dev · component library</p>
      <h1 className="h-display" style={{ fontSize: 'clamp(34px,6vw,52px)', color: 'var(--ink)', marginBottom: 'var(--sp-7)' }}>every part, every state.</h1>

      <Section title="button - variants">
        <Button variant="primary">primary</Button>
        <Button variant="secondary">secondary</Button>
        <Button variant="danger">danger</Button>
        <Button variant="success">success</Button>
        <Button variant="ghost">ghost</Button>
      </Section>

      <Section title="button - category hues">
        {CATS.map(c => <Button key={c} variant="category" category={c}>{c}</Button>)}
      </Section>

      <Section title="button - states & sizes">
        <Button size="sm">small</Button>
        <Button size="md">medium</Button>
        <Button size="lg">large</Button>
        <Button disabled>disabled</Button>
        <Button loading>loading</Button>
      </Section>

      <Section title="badge">
        <Badge variant="default">default</Badge>
        <Badge variant="success">success</Badge>
        <Badge variant="warning">warning</Badge>
        <Badge variant="error">error</Badge>
        <Badge variant="info">info</Badge>
        <Badge variant="forest">forest</Badge>
      </Section>

      <Section title="avatar - sizes & fallback">
        <Avatar name="Riya Sen" size="sm" />
        <Avatar name="Arjun K" size="md" />
        <Avatar name="Dev M" size="lg" />
        <Avatar name="Tara" size="xl" />
      </Section>

      <Section title="toggle">
        <Toggle checked={on} onChange={setOn} label="notifications" />
        <Toggle checked={!on} onChange={v => setOn(!v)} label="off state" />
        <Toggle checked disabled onChange={() => {}} label="disabled" />
      </Section>

      <Section title="tabs (arrow-key navigable)">
        <div style={{ width: '100%' }}>
          <Tabs tabs={tabs} active={tab} onChange={setTab} ariaLabel="demo tabs" idBase="demo" />
          <div
            role="tabpanel"
            id={`demo-panel-${tab}`}
            aria-labelledby={`demo-tab-${tab}`}
            style={{ marginTop: 'var(--sp-3)', fontFamily: 'var(--eina)', color: 'var(--ink-2)' }}
          >
            showing panel: <b>{tab}</b>
          </div>
        </div>
      </Section>

      <Section title="form fields">
        <div style={{ display: 'grid', gap: 'var(--sp-3)', width: '100%', maxWidth: 420 }}>
          <Input label="name" placeholder="type here…" />
          <Input label="email" defaultValue="not-an-email" error="that doesn't look like an email." required />
          <Input label="locked" value="can't touch this" disabled readOnly />
          <TextArea label="about" placeholder="a few words…" rows={3} />
        </div>
      </Section>

      <Section title="card">
        <Card hover className="max-w-sm">
          <Card.Header><b>card header</b></Card.Header>
          <Card.Body>Hard 2px ink border, offset shadow, hover-lift.</Card.Body>
          <Card.Footer>footer</Card.Footer>
        </Card>
      </Section>

      <Section title="overlays & feedback">
        <Button variant="secondary" onClick={() => setModal(true)}>open modal</Button>
        <Button onClick={() => toast.success('saved.', 'your change is live.')}>toast success</Button>
        <Button variant="danger" onClick={() => toast.error('something broke.', 'try again in a moment.')}>toast error</Button>
        <Button variant="ghost" onClick={async () => {
          const ok = await confirm({ title: 'delete this?', body: 'this cannot be undone.', confirmLabel: 'delete', danger: true })
          toast.info(ok ? 'confirmed.' : 'cancelled.')
        }}>confirm dialog</Button>
        <Button variant="ghost" onClick={async () => {
          const ok = await confirm({ title: 'delete this account?', body: 'destroys posts, comments, likes and sessions - unrecoverable.', confirmLabel: 'delete it', danger: true, holdMs: 1200 })
          toast.info(ok ? 'confirmed (held).' : 'cancelled.')
        }}>confirm dialog (hold-to-delete)</Button>
      </Section>

      <Section title="hold-to-confirm (account deletion, delete-a-team, reject-an-application)">
        <div style={{ width: 260 }}>
          <HoldToConfirmButton
            holdMs={1200}
            danger
            label="hold to delete permanently"
            onConfirm={() => toast.success('held the full 1.2s - confirmed.')}
          />
        </div>
        <p className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', maxWidth: 260 }}>
          A quick click/tap must NOT fire onConfirm - only completing the full hold does. Releasing early resets with no side effect.
        </p>
      </Section>

      <Modal isOpen={modal} onClose={() => setModal(false)} title="a modal">
        <p style={{ fontFamily: 'var(--eina)', color: 'var(--ink-2)' }}>
          Focus-trapped, Esc-closable, returns focus on close. Try Tab.
        </p>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setModal(false)}>cancel</Button>
          <Button onClick={() => setModal(false)}>done</Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
