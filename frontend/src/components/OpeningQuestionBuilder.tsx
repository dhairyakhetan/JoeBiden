import { CustomQuestion, CustomQuestionType } from '../lib/jobOpenings'
import feedService from '../services/feedService'
import { safeExternalHref } from '../lib/safeUrl'
import { useRef, useState } from 'react'

// Shared across both places a HoD builds/answers/reviews an opening's custom
// application form (teams/TeamDetailPage's Openings tab, and the standalone
// public/OpportunitiesPage), so the builder UI, the applicant-facing fields,
// and the answers list stay one implementation instead of three copies.

const TYPE_META: Record<CustomQuestionType, { icon: string; label: string }> = {
  text:     { icon: '✎', label: 'short text' },
  textarea: { icon: '📄', label: 'long text' },
  file:     { icon: '📎', label: 'file upload' },
  video:    { icon: '🎬', label: 'video upload' },
  url:      { icon: '🔗', label: 'link' },
  select:   { icon: '☰', label: 'multiple choice' },
}
const UPLOAD_TYPES: CustomQuestionType[] = ['file', 'video']

const labelSt: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', display: 'block', marginBottom: 6 }
// Inputs and their question cards: 1.5px --line-2 edges -> --hair-3 (the
// control edge) / --hair-2 (a card edge), 12 and 8 radii -> --r-tight, which
// is what .input/.textarea already resolve to in v6.css.
const inputSt: React.CSSProperties = { width: '100%', padding: '10px 12px', background: 'var(--bg-2)', border: 'var(--hair-3)', borderRadius: 'var(--r-tight)', color: 'var(--ink)', fontFamily: 'var(--sans)', fontSize: 16, outline: 'none' }

// ── Builder - HoD side, add/edit/reorder/remove questions ──────────────────
export function OpeningQuestionBuilder({ questions, onChange }: {
  questions: CustomQuestion[]
  onChange: (next: CustomQuestion[]) => void
}) {
  const addQuestion = () => onChange([...questions, { id: crypto.randomUUID(), label: '', type: 'text', required: false }])
  const updateQuestion = (id: string, patch: Partial<CustomQuestion>) =>
    onChange(questions.map(q => q.id === id ? { ...q, ...patch } : q))
  const removeQuestion = (id: string) => onChange(questions.filter(q => q.id !== id))
  const move = (id: string, dir: -1 | 1) => {
    const i = questions.findIndex(q => q.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= questions.length) return
    const next = [...questions]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    /* A repeating builder, not one control — role="group" carries the name;
       each generated row labels its own fields. */
    <div role="group" aria-labelledby="oqb-cap">
      <span id="oqb-cap" style={labelSt}>
        Application questions <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional - asked in addition to the default message field)</span>
      </span>
      {questions.length === 0 && (
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-3)', marginBottom: 10 }}>
          No custom questions yet - add one to collect a resume, a video reel, a portfolio link, or anything specific to this role.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {questions.map((q, i) => (
          <div key={q.id} style={{ background: 'var(--bg-2)', border: 'var(--hair-2)', borderRadius: 'var(--r-tight)', padding: 10 }}>
            {/* `flexWrap` is load-bearing, not tidiness. Every child of this
                row except the question input is flexShrink:0 - the 32px
                reorder column, the index, the answer-type select, the "req."
                label and the remove button - so at 375px their combined width
                overran the ~258px content box and the input, the only
                shrinkable child, collapsed to 22px: about one character, in
                the field where the question is actually typed. The remove
                button was pushed past the container's right edge, and because
                that ancestor is overflow-x:hidden it was clipped rather than
                scrollable-to, so a wrongly added question could not be
                deleted.

                The fix is flex-wrap plus a real flex-basis on the input
                (180px), so the type/req/remove group drops to a second line on
                a phone and everything stays on one line on a desktop. No
                `order` anywhere: that would put the visual order out of step
                with the tab order, which is its own defect. */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 6 }}>
              {/* Reorder. These were 19px tall - the previous pass traded the
                  hit-area floor away to keep the row short, reasoning that two
                  STACKED buttons cannot both reach 40x40 without colliding.
                  True, but the floor is not the thing to trade: 19px fails
                  DESIGN.md's 32px absolute minimum outright, and these are the
                  fiddliest controls in the builder. Each is now 32x32 and the
                  row is ~20px taller, which this surface can afford - it is a
                  form builder, not a dense list. */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                <button type="button" onClick={() => move(q.id, -1)} disabled={i === 0} className="btn btn-sm" style={{ padding: 0, fontSize: 10, minWidth: 32, width: 32, minHeight: 32, height: 32, opacity: i === 0 ? 0.3 : 1 }} aria-label="Move up">▲</button>
                <button type="button" onClick={() => move(q.id, 1)} disabled={i === questions.length - 1} className="btn btn-sm" style={{ padding: 0, fontSize: 10, minWidth: 32, width: 32, minHeight: 32, height: 32, opacity: i === questions.length - 1 ? 0.3 : 1 }} aria-label="Move down">▼</button>
              </div>
              <span className="mono xs muted" style={{ flexShrink: 0, width: 14, textAlign: 'center' }}>{i + 1}</span>
              {/* Repeating builder rows: a visible <label> per field would
                  triple the row height, so each control names itself and its
                  row instead. Without this a screen reader reads the whole
                  builder as "edit text, blank" over and over, with nothing to
                  say which question is which. The move/remove buttons above
                  already did this; the fields had been missed. */}
              <input
                style={{ ...inputSt, padding: '8px 10px', flex: '1 1 180px', minWidth: 0 }}
                value={q.label}
                onChange={e => updateQuestion(q.id, { label: e.target.value })}
                placeholder="Question, e.g. Why this role?"
                aria-label={`Question ${i + 1} text`}
              />
              <select
                value={q.type}
                onChange={e => updateQuestion(q.id, { type: e.target.value as CustomQuestionType })}
                /* 16px, not 10: this file's own `inputSt` base is 16 and
                   DESIGN.md requires it on any input (iOS focus-zoom). The
                   10px here had no comment justifying the exception. */
                style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700, padding: '8px 6px', minHeight: 44, borderRadius: 'var(--r-tight)', border: 'var(--hair-3)', background: 'var(--card)', color: 'var(--ink)', flexShrink: 0, minWidth: 0 }}
                aria-label={`Question ${i + 1} answer type`}
              >
                {(Object.keys(TYPE_META) as CustomQuestionType[]).map(t => (
                  <option key={t} value={t}>{TYPE_META[t].icon} {TYPE_META[t].label}</option>
                ))}
              </select>
              <label className="mono xs muted" style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, cursor: 'pointer' }}>
                <input type="checkbox" checked={q.required} onChange={e => updateQuestion(q.id, { required: e.target.checked })} />
                req.
              </label>
              <button type="button" onClick={() => removeQuestion(q.id)} className="btn btn-sm" style={{ padding: '6px 8px', color: 'var(--danger)', flexShrink: 0 }} aria-label="Remove question">✕</button>
            </div>
            {/* Options editor - only for multiple-choice questions */}
            {q.type === 'select' && (
              <input
                style={{ ...inputSt, padding: '6px 10px', fontSize: 12, marginLeft: 34, width: 'calc(100% - 34px)', marginBottom: 6 }}
                value={(q.options || []).join(', ')}
                onChange={e => updateQuestion(q.id, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                placeholder="Choices, comma separated - e.g. Weekdays, Weekends, Either"
                aria-label={`Question ${i + 1} choices, comma separated`}
              />
            )}
            {/* Optional hint line - helper text shown to applicants under the question */}
            <input
              style={{ ...inputSt, padding: '6px 10px', fontSize: 12, marginLeft: 34, width: 'calc(100% - 34px)' }}
              value={q.hint || ''}
              onChange={e => updateQuestion(q.id, { hint: e.target.value })}
              placeholder={'Optional hint shown under this question, e.g. "PDF preferred" or "under 2 minutes"'}
              aria-label={`Question ${i + 1} optional hint`}
            />
          </div>
        ))}
      </div>
      <button type="button" onClick={addQuestion} className="btn btn-sm" style={{ marginTop: 8 }}>+ add question</button>
    </div>
  )
}

// ── Applicant-facing fields - rendered on the Apply form ───────────────────
export function OpeningQuestionFields({
  questions, answers, onAnswerChange, files, onFileChange,
}: {
  questions: CustomQuestion[]
  answers: Record<string, string>
  onAnswerChange: (id: string, value: string) => void
  files: Record<string, File | null>
  onFileChange: (id: string, file: File | null) => void
}) {
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})
  if (!questions.length) return null
  return (
    <>
      {questions.map(q => (
        <div key={q.id} style={{ marginBottom: 16 }}>
          {/* `htmlFor` + a matching `id` on every control. Without it this
              label named nothing: a screen reader reached an unlabelled text
              box and the HoD's question text was read as loose prose somewhere
              above it, so the applicant could not tell which box answered
              which question. `aria-describedby` does the same for the hint. */}
          <label
            htmlFor={`opening-q-${q.id}`}
            style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', display: 'block', marginBottom: q.hint ? 2 : 6 }}
          >
            {q.label}{q.required && <span style={{ color: 'var(--accent-ink)' }}> *</span>}
          </label>
          {q.hint && <div id={`opening-hint-${q.id}`} style={{ fontFamily: 'var(--eina)', fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>{q.hint}</div>}
          {q.type === 'text' && (
            <input id={`opening-q-${q.id}`} aria-describedby={q.hint ? `opening-hint-${q.id}` : undefined} required={q.required}
              className="input" value={answers[q.id] || ''} onChange={e => onAnswerChange(q.id, e.target.value)} />
          )}
          {q.type === 'textarea' && (
            <textarea id={`opening-q-${q.id}`} aria-describedby={q.hint ? `opening-hint-${q.id}` : undefined} required={q.required}
              className="textarea" rows={3} value={answers[q.id] || ''} onChange={e => onAnswerChange(q.id, e.target.value)}
              style={{ resize: 'vertical', fontFamily: 'var(--eina)', fontSize: 15 }} />
          )}
          {q.type === 'url' && (
            <input id={`opening-q-${q.id}`} aria-describedby={q.hint ? `opening-hint-${q.id}` : undefined} required={q.required}
              className="input" type="url" inputMode="url" placeholder="https://…" value={answers[q.id] || ''} onChange={e => onAnswerChange(q.id, e.target.value)} />
          )}
          {q.type === 'select' && (
            <select id={`opening-q-${q.id}`} aria-describedby={q.hint ? `opening-hint-${q.id}` : undefined} required={q.required}
              className="input" value={answers[q.id] || ''} onChange={e => onAnswerChange(q.id, e.target.value)}>
              <option value="">choose one…</option>
              {(q.options || []).map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          )}
          {(q.type === 'file' || q.type === 'video') && (
            <div>
              {/* A <label for> pointing at a display:none input is reachable by
                  MOUSE ONLY - a label is not focusable and a display:none input
                  is not either, so tabbing skipped this control entirely. When
                  the HoD marked the upload required, Submit stayed gated on a
                  field a keyboard user could never fill, and the application
                  could not be sent at all. A real button is focusable and
                  forwards the click; the input stays mounted (not display:none)
                  but hidden and out of the tab order. */}
              <input
                type="file"
                id={`opening-q-${q.id}`}
                ref={el => { fileInputs.current[q.id] = el }}
                accept={q.type === 'video' ? 'video/*' : undefined}
                tabIndex={-1}
                aria-hidden="true"
                style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                onChange={e => onFileChange(q.id, e.target.files?.[0] || null)}
              />
              <button
                type="button"
                className="btn btn-sm"
                style={{ display: 'inline-flex' }}
                aria-describedby={q.hint ? `opening-hint-${q.id}` : undefined}
                onClick={() => fileInputs.current[q.id]?.click()}
              >
                {files[q.id] ? `✓ ${files[q.id]!.name}` : q.type === 'video' ? 'choose video →' : 'choose file →'}
              </button>
            </div>
          )}
        </div>
      ))}
    </>
  )
}

// Local state + upload orchestration for the two "apply" fields above -
// keeps the required-field check and the file-upload-then-submit sequence
// in one place instead of duplicated per apply modal. Also owns the
// applicant's phone number, which - unlike custom questions - is a fixed
// field asked on every single opening's application, not something a HoD
// configures per-role.
export function useOpeningAnswers(questions: CustomQuestion[]) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [files, setFiles] = useState<Record<string, File | null>>({})
  const [phone, setPhone] = useState('')

  const missingRequired = questions.find(q => q.required && (
    UPLOAD_TYPES.includes(q.type) ? !files[q.id] : !(answers[q.id] || '').trim()
  ))
  const phoneMissing = !phone.trim()

  const reset = () => { setAnswers({}); setFiles({}); setPhone('') }

  const buildCustomAnswers = async (): Promise<Record<string, string>> => {
    const customAnswers: Record<string, string> = {}
    for (const q of questions) {
      if (UPLOAD_TYPES.includes(q.type)) {
        const file = files[q.id]
        if (file) {
          const uploadResult = await feedService.uploadDocuments([file])
          if (uploadResult.success) customAnswers[q.id] = uploadResult.data.documents[0].url
        }
      } else if (answers[q.id]?.trim()) {
        customAnswers[q.id] = answers[q.id].trim()
      }
    }
    return customAnswers
  }

  return {
    answers, setAnswer: (id: string, v: string) => setAnswers(a => ({ ...a, [id]: v })),
    files, setFile: (id: string, f: File | null) => setFiles(fl => ({ ...fl, [id]: f })),
    phone, setPhone, phoneMissing,
    missingRequired, reset, buildCustomAnswers,
  }
}

// ── Answers display - HoD side, reviewing a submitted application ──────────
// Lists EVERY question the opening asked, not just the ones the applicant
// answered - an unanswered question shows as "not answered" instead of
// silently disappearing, so a reviewer sees the complete form, not just
// whatever happened to come back.
export function OpeningAnswersDisplay({ questions, answers, compact }: {
  questions: CustomQuestion[]
  answers: Record<string, string> | null | undefined
  compact?: boolean
}) {
  if (!questions.length) return null
  const fontSize = compact ? 12 : 13
  return (
    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: compact ? 6 : 8 }}>
      {questions.map(q => {
        const answer = answers?.[q.id]
        return (
          <div key={q.id} style={{ borderLeft: `1px solid ${answer ? 'var(--line-2)' : 'var(--line)'}`, paddingLeft: compact ? 8 : 10 }}>
            <div className="mono xs muted" style={{ marginBottom: 2 }}>{q.label}</div>
            {!answer ? (
              <div style={{ fontFamily: 'var(--eina)', fontStyle: 'italic', fontSize, color: 'var(--ink-3)' }}>not answered</div>
            ) : q.type === 'video' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 280 }}>
                <video src={answer} controls preload="metadata" style={{ width: '100%', borderRadius: 'var(--r-tight)', outline: '1px solid rgba(0,0,0,0.1)' }} />
                <a href={safeExternalHref(answer)} target="_blank" rel="noopener noreferrer" style={{ fontSize: fontSize - 1, color: 'var(--welfare-ink)' }}>open in new tab ↗</a>
              </div>
            ) : q.type === 'file' ? (
              <a href={safeExternalHref(answer)} target="_blank" rel="noopener noreferrer" style={{ fontSize, color: 'var(--welfare-ink)' }}>view file ↗</a>
            ) : q.type === 'url' ? (
              <a href={safeExternalHref(answer)} target="_blank" rel="noopener noreferrer" style={{ fontSize, color: 'var(--welfare-ink)', wordBreak: 'break-all' }}>{answer} ↗</a>
            ) : (
              <div style={{ fontFamily: 'var(--eina)', fontSize, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>{answer}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
