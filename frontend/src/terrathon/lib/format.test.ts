import { describe, it, expect } from 'vitest'
import { rupees, normalisePhone, prettyPhone, waNumber, istDate, dayRange, relativeTime, statusLabel, initials, tidyPhone, daySpan, squadLabel, cleanVenue, windowForDay, clockMinutes } from './format'

describe('rupees', () => {
  it('formats with the Indian grouping', () => {
    expect(rupees(2400)).toBe('₹2,400')
    expect(rupees(100000)).toBe('₹1,00,000')
  })
  it('renders an em-free placeholder rather than ₹0 for missing money', () => {
    // A blank amount and a genuine zero mean different things on the admin
    // table: zero collected is a fact, unknown is not. The placeholder is a
    // hyphen, not an em dash: this repo's zero-em-dash rule applies to
    // rendered copy as much as to source comments.
    expect(rupees(null)).toBe('-')
    expect(rupees(undefined)).toBe('-')
    expect(rupees(0)).toBe('₹0')
  })
})

describe('normalisePhone', () => {
  it('accepts the three shapes captains actually type', () => {
    expect(normalisePhone('9876543210')).toBe('+919876543210')
    expect(normalisePhone('+91 98765 43210')).toBe('+919876543210')
    expect(normalisePhone('919876543210')).toBe('+919876543210')
  })
  it('strips a leading zero', () => {
    expect(normalisePhone('09876543210')).toBe('+919876543210')
  })
  it('rejects anything that is not a 10-digit Indian mobile', () => {
    expect(normalisePhone('12345')).toBeNull()
    expect(normalisePhone('5876543210')).toBeNull()   // must start 6-9
    expect(normalisePhone('98765432100')).toBeNull()  // 11 digits
    expect(normalisePhone('')).toBeNull()
  })
  it('matches the server, so a resubmit in +91 form still hits DUPLICATE', () => {
    expect(normalisePhone('9876543210')).toBe(normalisePhone('+919876543210'))
  })
})

describe('prettyPhone and waNumber', () => {
  it('splits five and five for display', () => {
    expect(prettyPhone('+919876543210')).toBe('98765 43210')
  })
  it('gives wa.me a bare 12-digit number with no plus', () => {
    expect(waNumber('+919876543210')).toBe('919876543210')
    expect(waNumber('9876543210')).toBe('919876543210')
  })
})

describe('istDate and dayRange', () => {
  it('renders a date in IST regardless of the host timezone', () => {
    // 2026-10-02T00:00:00Z is still 2 Oct in IST (UTC+5:30).
    expect(istDate('2026-10-02T00:00:00.000Z')).toContain('2 Oct')
  })
  it('collapses a single-day sport', () => {
    const s = dayRange('2026-10-02T00:00:00.000Z', '2026-10-02T00:00:00.000Z')
    expect(s).not.toContain('+')
  })
  it('joins a two-day sport', () => {
    const s = dayRange('2026-10-03T00:00:00.000Z', '2026-10-04T00:00:00.000Z')
    expect(s).toContain('+')
  })
  it('says the date is missing rather than rendering Invalid Date', () => {
    expect(dayRange(null, null)).toBe('Date TBA')
  })
})

describe('relativeTime', () => {
  const now = new Date('2026-09-19T12:00:00.000Z')
  it('reads as just now inside a minute', () => {
    expect(relativeTime('2026-09-19T11:59:30.000Z', now)).toBe('just now')
  })
  it('counts minutes, then hours, then days', () => {
    expect(relativeTime('2026-09-19T11:30:00.000Z', now)).toBe('30 min ago')
    expect(relativeTime('2026-09-19T08:00:00.000Z', now)).toBe('4 h ago')
    expect(relativeTime('2026-09-17T12:00:00.000Z', now)).toBe('2 d ago')
  })
  it('clamps a future timestamp to "just now" instead of extrapolating a negative delta', () => {
    // An uncorrected device clock running behind can hand this function a
    // timestamp that is "later" than `now`. A 10-minute-old registration
    // must not read as "just now" just because the delta went negative.
    expect(relativeTime('2026-09-19T12:20:00.000Z', now)).toBe('just now')
  })
})

describe('statusLabel', () => {
  const base = { status: 'pending_payment', paid: false, utr: null, hold_expires_at: null }
  const now = new Date('2026-09-19T12:00:00.000Z')

  it('prefers the explicit terminal states', () => {
    expect(statusLabel({ ...base, status: 'cancelled' }, now)).toBe('Cancelled')
    expect(statusLabel({ ...base, status: 'waitlist' }, now)).toBe('Waitlist')
  })
  it('treats paid as confirmed whatever the stored status says', () => {
    expect(statusLabel({ ...base, paid: true }, now)).toBe('Confirmed')
  })
  it('computes Hold expired from the clock, not from a stored flag', () => {
    // Nothing in the database flips a row when a hold lapses, so this MUST be
    // derived or the admin table and the export will disagree.
    expect(statusLabel({ ...base, hold_expires_at: '2026-09-19T11:00:00.000Z' }, now)).toBe('Hold expired')
    expect(statusLabel({ ...base, hold_expires_at: '2026-09-19T13:00:00.000Z' }, now)).toBe('Pending payment')
  })
  it('never calls a paid row expired', () => {
    expect(statusLabel({ ...base, paid: true, hold_expires_at: '2026-09-19T11:00:00.000Z' }, now)).toBe('Confirmed')
  })
  it('shows a UTR claim as claimed, not confirmed', () => {
    expect(statusLabel({ ...base, utr: '123456789012' }, now)).toBe('Payment claimed')
  })
})

describe('initials', () => {
  it('takes at most two', () => {
    expect(initials('Kanishk Agarwal')).toBe('KA')
    expect(initials('Rachit')).toBe('R')
    expect(initials('A B C D')).toBe('AB')
  })
})


describe('tidyPhone', () => {
  // The field sits beside a +91 chip, so the numbers people paste carry one.
  // Every one of these is the same ten digits wearing different clothes.
  it('takes the shapes people actually paste', () => {
    for (const raw of ['+91 98305 54654', '+919830554654', '91 98305 54654',
                       '098305 54654', '098305-54654', '98305 54654', '9830554654']) {
      expect(tidyPhone(raw)).toBe('9830554654')
    }
  })

  it('never rejects a partial, so typing is not a fight', () => {
    expect(tidyPhone('98')).toBe('98')
    expect(tidyPhone('98305')).toBe('98305')
    expect(tidyPhone('')).toBe('')
  })

  it('caps at ten digits rather than letting a long paste through', () => {
    expect(tidyPhone('9830554654999')).toHaveLength(10)
  })

  it('leaves a leading zero alone while it could still be the number itself', () => {
    // Ten digits already, so the 0 is not a trunk code to strip. Invalid as an
    // Indian mobile, but that is normalisePhone's call on submit, not this
    // function's job mid-keystroke.
    expect(tidyPhone('0983055465')).toBe('0983055465')
  })
})

describe('daySpan', () => {
  it('reads as a range, not a pair', () => {
    // The bug it exists for: dayRange gave "Fri, 2 Oct + Sun, 4 Oct" for the
    // whole festival, naming the two ends of a three-day weekend and reading
    // as though nothing ran on the Saturday.
    expect(daySpan('2026-10-02', '2026-10-04')).toContain(' to ')
    expect(daySpan('2026-10-02', '2026-10-04')).not.toContain(' + ')
  })

  it('collapses a single day', () => {
    expect(daySpan('2026-10-02', '2026-10-02')).toBe(daySpan('2026-10-02', null))
    expect(daySpan('2026-10-02', null)).not.toContain(' to ')
  })

  it('does not invent a date it was not given', () => {
    expect(daySpan(null, null)).toBe('Dates TBA')
    expect(daySpan(null, '2026-10-04')).toBe('Dates TBA')
  })
})

describe('squadLabel', () => {
  it('names a substitute rather than a range', () => {
    // "7-8 a side" read as a squad of seven OR eight. It is seven and a sub.
    expect(squadLabel({ team_size_min: 7, team_size_max: 8 })).toBe('7 + 1')
  })

  it('does not say 2-2', () => {
    expect(squadLabel({ team_size_min: 2, team_size_max: 2 })).toBe('2 players')
  })

  it('calls a one-player entry solo', () => {
    expect(squadLabel({ team_size_min: 1, team_size_max: 1 })).toBe('Solo')
  })
})

describe('timetable helpers', () => {
  it('treats a clock time typed into the venue field as no venue', () => {
    expect(cleanVenue('11:11')).toBeNull()
    expect(cleanVenue(' 11.30 am ')).toBeNull()
    expect(cleanVenue('')).toBeNull()
    expect(cleanVenue(null)).toBeNull()
    expect(cleanVenue('Turf XL, New Alipore')).toBe('Turf XL, New Alipore')
  })
  it('picks the part of a match window that belongs to a day', () => {
    const w = 'Sat 10am to 4pm, Sun 10am to 2pm'
    expect(windowForDay(w, '2026-10-03')).toBe('10am to 4pm')
    expect(windowForDay(w, '2026-10-04')).toBe('10am to 2pm')
    expect(windowForDay('12pm to 7pm', '2026-10-02')).toBe('12pm to 7pm')
    expect(windowForDay(null, '2026-10-02')).toBeNull()
    expect(windowForDay('Sat 10am to 4pm, then finals', '2026-10-03')).toBe('Sat 10am to 4pm, then finals')
  })
  it('reads clock strings into minutes', () => {
    expect(clockMinutes('9:45 am')).toBe(585)
    expect(clockMinutes('11.30am')).toBe(690)
    expect(clockMinutes('12pm')).toBe(720)
    expect(clockMinutes('12 am')).toBe(0)
    expect(clockMinutes('TBC')).toBeNull()
  })
})
