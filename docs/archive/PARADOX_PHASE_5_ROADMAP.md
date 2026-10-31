# Paradox Admin Phase 5 — Implementation Roadmap

**Status:** Documented (not implemented — requires external services)
**Estimated Effort:** 2-3 weeks
**Prerequisites:** Service accounts + API keys for Twilio, Firebase, SendGrid (or alternatives)

---

## Why Phase 5 is Deferred

Phase 5 features require **third-party integrations** that:
1. Cost money (Twilio SMS ~$0.0075/msg, Firebase free tier limits, SendGrid free 100/day then paid)
2. Need user-owned accounts and API keys (cannot create on user's behalf)
3. Require domain verification (SendGrid SPF/DKIM, FCM service worker)
4. Have privacy/legal implications (collecting phone numbers, push notification consent)

The previous 4 waves + Paradox Phases 2-4 deliver all the **structural** improvements. Phase 5 is the **integration layer** that connects the admin to communication channels.

---

## Phase 5 Feature Roadmap

### 1. Push Notifications (FCM / Web Push)

**Use case:** Notify attendees about event start, venue change, winners announcement, schedule shifts.

**Implementation:**
1. **Service Worker** at `frontend/public/firebase-messaging-sw.js`
2. Install `firebase` SDK in frontend
3. Backend endpoint: `POST /api/paradox/push` (super-admin only)
4. Database: `paradox_push_subscriptions` table (user_id, fcm_token, created_at)
5. Admin UI: Already scaffolded in Updates tab — add toggle "Send as push notification"

**Cost:** Free up to 100K messages/month via Firebase

**Steps:**
```bash
npm install firebase
```

```typescript
// frontend/src/lib/firebase.ts
import { initializeApp } from 'firebase/app'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
})

export const messaging = getMessaging(app)
```

User opt-in flow:
```typescript
const enableNotifications = async () => {
  const permission = await Notification.requestPermission()
  if (permission === 'granted') {
    const token = await getToken(messaging, { vapidKey: 'YOUR_VAPID_KEY' })
    await supabase.from('paradox_push_subscriptions').insert({ fcm_token: token })
  }
}
```

**Admin send flow:** backend uses Firebase Admin SDK to push to all subscribed tokens.

---

### 2. SMS Integration (Twilio)

**Use case:** Last-minute event reminders, payment confirmation, ticket details to non-app users.

**Implementation:**
1. Twilio account + verified sender number
2. Backend service: `backend/src/services/sms.js` using `twilio` npm package
3. Endpoint: `POST /api/paradox/sms` with `{to: string, body: string}`
4. Admin UI: "Send SMS" action on registration cards, bulk send to filtered registrations
5. Throttling: max 100 SMS/min to avoid Twilio rate limits

**Cost:** ~$0.0075 per SMS in India

**Backend setup:**
```bash
cd backend && npm install twilio
```

```javascript
// backend/src/services/sms.js
const twilio = require('twilio')
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

async function sendSMS(to, body) {
  return client.messages.create({
    from: process.env.TWILIO_PHONE_NUMBER,
    to,
    body,
  })
}

module.exports = { sendSMS }
```

**Required env vars:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`

---

### 3. Email Templates

**Use case:** Registration confirmation, payment reminder, event reminders, winner announcements.

**Implementation:**
1. SendGrid account + domain authentication (SPF, DKIM)
2. Backend service: `backend/src/services/email.js`
3. Template system: store templates in `paradox_email_templates` table (subject, html_body, vars)
4. Trigger system: send on registration creation, payment status change, day-before reminder cron
5. Admin UI: template editor in Comms tab + manual "Send email" action

**Cost:** Free 100 emails/day, then $19.95/mo for 50K

**Backend setup:**
```bash
cd backend && npm install @sendgrid/mail
```

```javascript
// backend/src/services/email.js
const sgMail = require('@sendgrid/mail')
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

async function sendEmail({ to, subject, html, from }) {
  return sgMail.send({ to, from: from || 'noreply@aquaterra.in', subject, html })
}

module.exports = { sendEmail }
```

**Templates schema:**
```sql
CREATE TABLE paradox_email_templates (
  id SERIAL PRIMARY KEY,
  key VARCHAR(50) UNIQUE NOT NULL,  -- e.g. 'registration_confirmed', 'payment_reminder'
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  variables TEXT[],
  active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Variable substitution:** Use Handlebars or simple `{{var_name}}` replacement.

---

### 4. PDF Roster Exports

**Use case:** Print volunteer schedules, judge assignments, event check-in sheets for day-of use.

**Implementation:**
1. Use `jsPDF` (client-side) or `puppeteer` (server-side, better fonts/layouts)
2. Add "Export PDF" buttons next to existing "Export CSV"
3. Pre-formatted layouts: portrait for rosters, landscape for schedules

**Recommendation:** Client-side jsPDF for speed (no server roundtrip)

**Setup:**
```bash
cd frontend && npm install jspdf jspdf-autotable
```

```typescript
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const exportVolunteersPDF = (volunteers) => {
  const doc = new jsPDF()
  doc.text('Paradox 2026 — Volunteer Roster', 14, 16)
  autoTable(doc, {
    startY: 22,
    head: [['Name', 'Role', 'Event', 'Phone', 'Status']],
    body: volunteers.map(v => [v.name, v.role, v.event, v.phone, v.status]),
  })
  doc.save('paradox-volunteers.pdf')
}
```

---

### 5. Analytics Dashboard

**Use case:** Track registration trends, payment funnel, popular events, peak check-in times.

**Implementation:**
1. New Analytics subtab in Dashboard (or top-level Analytics tab)
2. Charts via `recharts` (lightweight, React-native)
3. Pre-aggregated data from existing tables (no new schema)

**Required charts:**
- Registration trend over time (line chart)
- Payment funnel (registered → paid → attended, bar chart)
- Event popularity (bar chart, top 10)
- Check-in heatmap by hour (heatmap)
- Score distribution per event (boxplot)

**Setup:**
```bash
cd frontend && npm install recharts
```

```typescript
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts'

const RegistrationTrend = ({ data }) => (
  <ResponsiveContainer width="100%" height={300}>
    <LineChart data={data}>
      <XAxis dataKey="date" />
      <YAxis />
      <Line type="monotone" dataKey="count" stroke="#00E5A0" />
    </LineChart>
  </ResponsiveContainer>
)
```

Data preparation example:
```typescript
const registrationsByDay = useMemo(() => {
  const byDay = {}
  rows.forEach(r => {
    const day = r.created_at?.slice(0, 10)
    if (day) byDay[day] = (byDay[day] || 0) + 1
  })
  return Object.entries(byDay).map(([date, count]) => ({ date, count }))
}, [rows])
```

---

### 6. Dark Mode Toggle

**Use case:** Reduce eye strain in low-light event venues, support OS preference.

**Implementation:**
1. CSS variables already use `var(--bg)`, `var(--ink)` etc. — extend with `[data-theme="dark"]` overrides
2. Toggle button in admin top bar
3. Persist preference in localStorage
4. Respect `prefers-color-scheme` for initial value

```css
/* In aq-design-system.css */
[data-theme="dark"] {
  --bg: #0A2540;
  --bg-2: #112B47;
  --ink: #F4EFE0;
  --ink-2: #D1CCC0;
  --ink-3: #8B8779;
  --line: #2A3F5F;
}
```

```typescript
const toggleTheme = () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', next)
  localStorage.setItem('aq-theme', next)
}

useEffect(() => {
  const saved = localStorage.getItem('aq-theme')
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.setAttribute('data-theme', saved || (prefersDark ? 'dark' : 'light'))
}, [])
```

---

## Implementation Priority

| # | Feature | Effort | Cost | Impact |
|---|---------|--------|------|--------|
| 1 | Email templates (SendGrid) | 3 days | Free tier | 🔥 High — automate registration flow |
| 2 | PDF roster export | 1 day | Free | 🔥 High — day-of need |
| 3 | Analytics dashboard | 3 days | Free | 🟡 Medium — insights |
| 4 | Push notifications (FCM) | 5 days | Free | 🟡 Medium — needs user opt-in |
| 5 | SMS (Twilio) | 2 days | ~$50/event budget | 🟡 Medium — high cost per msg |
| 6 | Dark mode | 1 day | Free | 🟢 Low — nice-to-have |

**Recommended sequence:**
1. PDF export (fastest, immediate value)
2. Email templates (foundation for automation)
3. Dark mode (quick polish)
4. Analytics dashboard
5. Push notifications
6. SMS (highest cost, last)

**Total estimated effort:** 15 days of focused work, $50-100/month in service costs for active events.

---

## Decision Points Before Starting

1. **Email provider:** SendGrid vs. Resend vs. Postmark vs. Mailgun?
   - **Recommendation:** Resend (modern API, generous free tier)
2. **SMS provider:** Twilio vs. MessageBird vs. AWS SNS?
   - **Recommendation:** Twilio (best India coverage, mature SDK)
3. **Push notifications:** FCM vs. OneSignal vs. self-hosted Web Push?
   - **Recommendation:** OneSignal (no service worker hassle, free)
4. **Charts library:** Recharts vs. Chart.js vs. Victory?
   - **Recommendation:** Recharts (best React integration)

---

## Service Account Checklist

Before implementation:

- [ ] Sign up for SendGrid/Resend account
- [ ] Verify sender domain (DNS records for SPF/DKIM)
- [ ] Sign up for Twilio account
- [ ] Purchase a verified Indian phone number for sending
- [ ] Create Firebase project
- [ ] Generate FCM server key + VAPID key
- [ ] Add all API keys to `.env` (NEVER commit)
- [ ] Add corresponding entries to Vercel environment variables

---

## Required env vars (final state)

```bash
# Frontend (.env.local or Vercel env)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_VAPID_KEY=...

# Backend (.env)
SENDGRID_API_KEY=...
SENDGRID_FROM_EMAIL=noreply@aquaterra.in
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+91...
FIREBASE_ADMIN_KEY=... (service account JSON, base64)
```

---

**Status:** Awaiting:
1. User decision on providers
2. Service account creation
3. Budget approval for paid services (SMS, SendGrid above free tier)

Once these are in place, the 15-day implementation can begin.
