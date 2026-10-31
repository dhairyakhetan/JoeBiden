# Purging leaked files from git history

Decided 2026-09-18, runbook written 2026-09-19. **Not run.** It rewrites every
commit SHA in the repository and force-pushes over `main`, so it is a deliberate
act with a person watching, not something to automate.

---

## What is in there

Verified against the live repo on 2026-09-19, not copied from an older audit.

**1. About 2,360 member emails and phone numbers.** Four Excel workbooks added
in a single commit:

```
72c28f5  2026-08-31  "Aug 2026 redesign + new-product build ..."

  Mobile-first redesign changelog-handoff/mobile-first-redesign-changelog/project/uploads/AQ Dept-wise Goals and Procedures Tracker.xlsx
  Mobile-first redesign changelog-handoff/mobile-first-redesign-changelog/project/uploads/AquaTerra Core Records.xlsx
  Mobile-first redesign changelog-handoff/mobile-first-redesign-changelog/project/uploads/COMMUNITY AQUATERRA.xlsx
  Mobile-first redesign changelog-handoff/mobile-first-redesign-changelog/project/uploads/Cross Departmental Database.xlsx
```

**2. The `service_role` key**, in root `migrate.js`, across four commits:

```
c8778ae  Initial commit
f44bd57  Update Paradox section dates ...
1f77cfd  Update Paradox section dates ...
3bacd92  Phase 12: dead code removal (with a security finding along the way)
```

`3bacd92` deleted the file. That removes it from the working tree, not from
history.

**Neither is tracked at HEAD.** `git ls-files` returns zero `.xlsx` and zero
`.csv`. This is purely a history problem. `.git` is 72 MB.

---

## Do the rotation first, and understand the order

**Rotating the key matters more than this runbook does.** A purge makes the
leaked value harder to find; a rotation makes it worthless. Do
`ROTATE_SERVICE_KEY.md` first. If you only ever do one of the two, do that one.

Purging does not help the emails in the same way, because member emails cannot
be "rotated". For those, the purge is the only remedy, which is why it is worth
doing at all.

---

## Before you start

1. **Rotate the service_role key.** See above.
2. **Merge or abandon every open branch.** A rewrite orphans anything not
   merged, because every SHA changes. As of 2026-09-19 there are no open PRs,
   but check again: `gh pr list --state open`.
3. **Tell anyone with a clone.** After the force-push their clone is
   unreconcilable. They must re-clone. A `git pull` will produce a horrifying
   merge, not an update.
4. **Take a backup you can actually restore from:**

   ```bash
   cd ..
   git clone --mirror https://github.com/kaxx4/vercelaq.git vercelaq-backup-pre-purge.git
   ```

   Keep that somewhere safe until you are certain. It is the only undo.

---

## Install the tool

`git filter-repo` is not installed here. Use it rather than `git filter-branch`,
which is slow, error-prone and discouraged by git's own documentation.

```bash
pip install git-filter-repo
```

Verify: `git filter-repo --version`.

---

## The purge

Run from the repository root. **`filter-repo` refuses to run on a repo with
uncommitted changes**, so commit or discard first.

```bash
# 1. Remove the four workbooks and the leaked migrate.js from every commit.
git filter-repo \
  --path "Mobile-first redesign changelog-handoff/mobile-first-redesign-changelog/project/uploads/AQ Dept-wise Goals and Procedures Tracker.xlsx" \
  --path "Mobile-first redesign changelog-handoff/mobile-first-redesign-changelog/project/uploads/AquaTerra Core Records.xlsx" \
  --path "Mobile-first redesign changelog-handoff/mobile-first-redesign-changelog/project/uploads/COMMUNITY AQUATERRA.xlsx" \
  --path "Mobile-first redesign changelog-handoff/mobile-first-redesign-changelog/project/uploads/Cross Departmental Database.xlsx" \
  --path migrate.js \
  --invert-paths
```

A belt-and-braces alternative that catches any workbook you did not enumerate:

```bash
git filter-repo --path-glob '*.xlsx' --path-glob '*.csv' --path migrate.js --invert-paths
```

Check nothing survived:

```bash
git log --all --diff-filter=A --name-only --format="%h" -- "*.xlsx" migrate.js | head
# expect no output at all

git rev-list --objects --all | grep -iE '\.xlsx$|migrate\.js$'
# expect no output at all
```

---

## Push it

`filter-repo` **removes the `origin` remote on purpose**, so that you cannot
force-push by muscle memory before you have checked the result. Re-add it
deliberately:

```bash
git remote add origin https://github.com/kaxx4/vercelaq.git
git push --force --all origin
git push --force --tags origin
```

---

## Afterwards

- **Re-clone locally.** Do not keep working in the filtered repo; clone fresh
  from the pushed result so your local state matches the remote exactly.
- **GitHub keeps unreferenced objects for a while.** A force-push does not
  immediately make old blobs unreachable through the API. To be thorough, open a
  GitHub support request asking them to garbage-collect the repository, or
  accept the residual window.
- **Vercel will redeploy** off the rewritten `main`. The tree content is
  unchanged, so the build output is identical. No action needed, but expect a
  deploy.
- **Delete the backup mirror** once you are satisfied, since it still contains
  everything you just removed.

---

## If you would rather not

The honest alternative is to leave it, on the basis that the repo is private,
and record the decision. That is defensible right up until the repo is made
public or a collaborator is added, at which point the whole history goes with
it. `DECISIONS_2026_09_18.md` item 3 has the reasoning that led to choosing the
purge instead.
