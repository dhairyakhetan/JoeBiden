"""Simulation of the sheet triage row-selection spec (v2) against real + adversarial states.
Each case is (name, rows, ledger, expected_actionable_keys_description_prefixes)."""
import hashlib, re

def norm(s): return re.sub(r'\s+', ' ', (s or '').strip().lower())
def key(tab, date, link, text):
    return hashlib.sha1(f"{tab}|{norm(date)}|{norm(link)}|{norm(text)[:80]}".encode()).hexdigest()[:10]

PLACEHOLDERS = {'high/med/low', 'not started/in process/blocked/completed/cancelled'}
def severity(v):
    v = norm(v)
    return {'high': 0, 'med': 1, 'low': 2}.get(v, 1) if v not in PLACEHOLDERS else 1

def select_bugs(rows, ledger):
    out = []
    for i, r in enumerate(rows):
        desc = (r.get('desc') or '').strip()
        if not desc: continue                                   # merged/blank screenshot rows
        if norm(r.get('solved')) == 'true' or norm(r.get('taken')) == 'true': continue  # a human ticked it
        k = key('BUGS', r.get('date'), r.get('link'), desc)
        if k in ledger: continue                                # already handled and text unchanged
        out.append((severity(r.get('sev')), i, k, desc))
    return [(k, d) for _, _, k, d in sorted(out)]

def hr_state(status):
    s = norm(status)
    if s in PLACEHOLDERS or s == '': return 'not_started'
    for p, name in (('not started', 'not_started'), ('in process', 'in_process'), ('blocked', 'blocked'),
                    ('completed', 'done'), ('cancelled', 'done')):
        if s.startswith(p): return name
    return 'unknown'

def select_hr(rows, ledger):
    out = []
    for i, r in enumerate(rows):
        task = (r.get('task') or '').strip()
        if not task: continue
        if hr_state(r.get('status')) != 'not_started': continue
        k = key('HR', r.get('start'), '', task)
        if k in ledger: continue
        out.append((severity(r.get('prio')), i, k, task))
    return [(k, t) for _, _, k, t in sorted(out)]

# ---- real payloads (2026-10-02) ----
B1 = dict(date='01.10.2026', link='/projects/1018', sev='HIGH/MED/LOW', desc='the sticker has over flowing text that crops the home button', taken='', solved='FALSE')
B2 = dict(date='2.10.2026', link='/director/member-of-month', sev='MED', desc="nysa - HOD of social media is already assigned HOD on website but still it doesn't allow her to select the member of thr month for her team", taken='FALSE', solved='FALSE')
BLANK = dict(date='', link='', sev='', desc='', taken='', solved='')
B3 = dict(date='2.10.26', link='/director/member-of-month', sev='HIGH', desc="members of the month pick feature doesn't allow to choose more than 1 member per team for member of the month.", taken='FALSE', solved='FALSE')
H = [
  dict(task="MAKE TEAM PICUTRE EDITABLE BY hOd'S", prio='HIGH/MED/LOW', status='NOT STARTED/IN PROCESS/BLOCKED/COMPLETED/CANCELLED', start='01.10.2026'),
  dict(task='Design a visual hierarchy chart', prio='HIGH', status='NOT STARTED(collecting info started)', start='2.10.26'),
  dict(task='Create a reusable team page template', prio='HIGH', status='NOT STARTED (however collecting info started)', start='2.10.26'),
  dict(task='Add a permanently open roles section', prio='HIGH', status='', start=''),
  dict(task='Add a "tag team(s)" option', prio='HIGH', status='', start=''),
]
ledger0 = {key('BUGS', B1['date'], B1['link'], B1['desc'])}
cases = []
def case(name, got, want):
    ok = len(got) == len(want) and all(d.startswith(w) for (_, d), w in zip(got, want))
    cases.append(ok); print(('PASS ' if ok else 'FAIL ') + name + ('' if ok else f'\n   got  {[d[:30] for _, d in got]}\n   want {want}'))

case('first real read: 1018 row is the only actionable bug', select_bugs([B1], set()), ['the sticker has over flowing'])
case('second real read, 1018 in ledger: HIGH MoM row sorts before MED, blanks ignored', select_bugs([B1, B2, BLANK, BLANK, B3], ledger0),
     ['members of the month pick f', 'nysa - HOD of social medi'])
case('human ticked TAKEN UP: skipped even though not in ledger', select_bugs([dict(B2, taken='TRUE')], set()), [])
case('row text edited after being handled: becomes actionable again', select_bugs([dict(B1, desc=B1['desc'] + ' also on mobile')], ledger0), ['the sticker has over flowing'])
case('row moved/sorted (different position, same text): still deduped', select_bugs([BLANK, BLANK, B1], ledger0), [])
case('template placeholder severity defaults to MED, not skipped', select_bugs([dict(B2, sev='HIGH/MED/LOW')], set()), ['nysa - HOD of social medi'])
case('HR: blank status and "NOT STARTED(collecting info started)" are both actionable; placeholder status too', select_hr(H, set()),
     ['Design a visual hierarchy', 'Create a reusable team page', 'Add a permanently open role', 'Add a "tag team(s)" option', 'MAKE TEAM PICUTRE EDITABLE'])
case('HR: COMPLETED / CANCELLED / BLOCKED / IN PROCESS are skipped', select_hr([dict(H[0], status=s) for s in ('COMPLETED', 'cancelled', 'BLOCKED', 'IN PROCESS')], set()), [])
case('HR: unknown free-text status is NOT silently treated as actionable', select_hr([dict(H[0], status='waiting on naishha')], set()), [])
print(f"\n{sum(cases)}/{len(cases)} cases pass")
