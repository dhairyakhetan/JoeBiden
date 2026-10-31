# Rotating the service_role key

The oldest open item in this repo. Written 2026-09-19 so the rotation itself is
two minutes of work instead of an afternoon of finding out what broke.

**Nothing here has been done for you.** The preparation is done; the rotation is
yours, because it needs the Supabase dashboard and because it invalidates a
credential that four scripts use.

---

## Why this matters

`frontend/.env` holds `SUPABASE_SERVICE_KEY`, a `service_role` JWT for project
`hzowuwffjqtgszecngpe` expiring around 2036. A `service_role` key **bypasses
every RLS policy**. With it, anyone can read all 1,327 members' emails and phone
numbers, write any table, and delete anything.

The file is gitignored and untracked. That is not the problem. The problem is
that **the identical value was committed** to a root `migrate.js` and still sits
in four commits: `c8778ae` (initial), `f44bd57`, `1f77cfd`, and `3bacd92`, which
deleted the file. Deleting a file does not remove it from history.

The `.env` value is byte-identical to the historical one, which is how we know
the key was never rotated. It has been open in this repo's own docs since
2026-07-31 (`docs/CODEBASE_AUDIT_2026_07_31.md`).

Rotating is what actually closes this. Purging git history (see
`PURGE_GIT_HISTORY.md`) is worth doing too, but it is secondary: rotation makes
the leaked value worthless, and no amount of history rewriting does that.

---

## What has been prepared

Four scripts use the key, and they disagreed on what to call it:

| script | old variable |
|---|---|
| `seed-teams.mjs` | `SUPABASE_SERVICE_KEY` |
| `compress-storage-buckets.mjs` | `SUPABASE_SERVICE_KEY` |
| `compute-org-facts.mjs` | `SUPABASE_SERVICE_ROLE_KEY` |
| `hr-import/import-hr-workbooks.mjs` | `SUPABASE_SERVICE_ROLE_KEY` |

All four now read `scripts/serviceKey.mjs`, which prefers
`SUPABASE_SERVICE_ROLE_KEY` and still accepts the old `SUPABASE_SERVICE_KEY`
with a deprecation warning. So **nothing breaks before you rotate**, and after
you rotate there is exactly one name to set.

`SUPABASE_SERVICE_ROLE_KEY` won because it is Supabase's own name for it.

---

## The rotation

1. **Supabase Dashboard** → Project Settings → API → find the `service_role`
   key → roll / regenerate it. Copy the new value.

2. **`frontend/.env`**: add the new value under the new name.

   ```
   SUPABASE_SERVICE_ROLE_KEY=<the new value>
   ```

3. **Delete the old `SUPABASE_SERVICE_KEY=` line entirely.** This is the step
   that matters: it is what stops the leaked value being referenced by anything
   in the working tree.

4. Confirm nothing still names the old variable:

   ```bash
   grep -rn "SUPABASE_SERVICE_KEY" frontend/ --exclude-dir=node_modules
   ```

   The only hits should be `scripts/serviceKey.mjs` (the compatibility branch)
   and this file. If a script still reads it directly, that script was added
   after this was written; point it at `serviceKey()` too.

5. Sanity-check one script that uses the key. `--dry-run` writes nothing:

   ```bash
   cd frontend && SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY node scripts/compress-storage-buckets.mjs --dry-run
   ```

---

## After rotating

- **Vercel is unaffected.** No service key is set in the Vercel project's
  environment variables, which is why `compute-org-facts` skips on every deploy
  and keeps the committed `orgFacts.ts`. That is deliberate: a build step that
  can bypass RLS is a build step that can leak. If you ever do want ORG_FACTS
  regenerated per deploy, add `SUPABASE_SERVICE_ROLE_KEY` to Production and
  Preview there, and understand you are handing the build RLS-bypass power.

- **Nothing in `frontend/src` uses a service key**, and nothing should. The
  browser talks to Supabase with the anon key and RLS is the only real access
  control. If a service key ever appears in `src/`, that is a P0.

- `scripts/loadEnv.mjs` strips both names from `process.env` on purpose, so a
  build script that imports it cannot bypass RLS even by accident. Leave that.

---

## What rotation does NOT fix

The old key stays in git history at `c8778ae`, `f44bd57`, `1f77cfd` and
`3bacd92` regardless. After rotation it is a dead credential rather than a live
one, which is the point, but if you want it gone see `PURGE_GIT_HISTORY.md`.

Rotation also does not touch the ~2,360 member emails and phone numbers in
history from the HR workbook at `72c28f5`. Different problem, same file.
