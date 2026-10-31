---
tags: [data, storage, media]
---

# Storage Buckets

Seven buckets. Uploads go **directly from the browser** to Supabase Storage —
there is no server to proxy them.

| Bucket | Public | Size cap | MIME allow-list | Used by |
|---|---|---|---|---|
| `post-images` | ✅ | none | none | `CreatePostModal`, team posts |
| `avatars` | ✅ | none | none | `profileService.uploadAvatar` |
| `post-documents` | ✅ | **15 MB** | none | PDF/PPTX attachments → `post_documents` |
| `project-images` | ✅ | none | none | `director/ProjectManager` → `welfare_projects` |
| `photobooth-assets` | ✅ | none | none | Paradox photobooth |
| `photobooth-raw-photos` | ❌ private | 10 MB | `image/jpeg` only | Paradox photobooth |
| `photobooth-print-sheets` | ❌ private | 25 MB | `application/pdf` only | Paradox photobooth |

## Two clear standards, and four buckets that meet neither

The photobooth buckets are **correctly configured**: private, size-capped, and
MIME-restricted to exactly one type each.

The four content buckets are public with **no size cap and no MIME allow-list**.

> [!warning] What that permits
> Any authenticated user can upload a 200 MB file, or a `.svg` (which can carry
> script and is served from a public URL on your domain's storage host), or an
> `.html`, to `post-images` or `avatars`. Nothing in the schema stops it.
>
> Concrete fix, no code change required — set on each bucket:
> - `post-images`: cap ~10 MB, allow `image/jpeg,image/png,image/webp,image/avif`
> - `avatars`: cap ~2 MB, same list
> - `project-images`: cap ~10 MB, same list
> - `post-documents`: already capped; add
>   `application/pdf` + the two PPTX/PPT MIME types
>
> Note deliberately **excluding `image/svg+xml`** from the image lists. See
> [[Known Gaps and Debt]].

## Public buckets and deletion

Public buckets mean permanent unauthenticated URLs. Deleting a post's row does
**not** delete its objects — `post_images` CASCADEs, the file does not. There is
no orphan cleanup job, so storage grows monotonically.

Two `protect_delete` triggers exist on `storage.buckets` and `storage.objects`,
which suggests deliberate delete protection at the platform level. Confirm the
intent before writing any cleanup job.

## Serving: `sized()` is mandatory, but does not cover these

`lib/imageUrl.ts`'s `sized(url, ctx)` only rewrites **`framerusercontent.com`**
URLs — it passes Supabase Storage, Google avatars, `data:` and `blob:` URLs
through untouched.

> [!important] So the sizing win does not apply to your own uploads
> A 4 MB photo uploaded to `post-images` is served at full size into a 400 px card.
> The historical performance bug was Framer-hosted imagery, and `sized()` fixed
> that; **Supabase-hosted uploads remain unoptimised.** Supabase's own image
> transformation (`?width=`) would close the gap — a genuine, contained
> performance win. See [[Image Pipeline]] and [[Improvement Backlog]].

## Naming convention

Attachment rows store both `blob_url` and `blob_name`, where `blob_name` is
derived client-side as `url.split('/').pop()`. There is no stable server-assigned
key, so renaming or re-pathing a bucket breaks the link.

Related: [[Image Pipeline]] · [[posts]] · [[Paradox Sub-App]]
