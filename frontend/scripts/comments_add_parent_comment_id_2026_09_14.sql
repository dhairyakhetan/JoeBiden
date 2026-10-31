-- APPLIED LIVE 2026-09-14 via Supabase MCP (migration name:
-- comments_add_parent_comment_id)
--
-- Social-system IA audit, per owner request ("look at the social system...
-- find gaps"). Finding: comments had no self-reference at all - a "reply"
-- (feed/PostPage.tsx's handleReplyTo) was only text-prefilling "@name " into
-- a flat, unthreaded comment, and the person being replied to was never
-- notified (only the post's author was, regardless of who the comment was
-- actually addressed to). Real threading needs a real parent link.

alter table public.comments
  add column parent_comment_id integer references public.comments(comment_id) on delete cascade;

comment on column public.comments.parent_comment_id is
  'Nullable self-FK: the comment this one is a reply to. NULL for a top-level comment.';

create index if not exists comments_parent_comment_id_idx on public.comments(parent_comment_id);

-- No RLS change needed: comments_select/insert/update/delete all key off
-- author_id/post_id, neither of which this column touches. A reply is
-- exactly as readable/writable as any other comment on the same post.
