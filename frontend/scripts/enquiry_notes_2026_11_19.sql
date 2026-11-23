-- Enquiries desk: one free-text notes box per collaboration request / contact message.
-- Bug tracker report c2547dee (3 Nov 2026): "a simple space ... to record their notes wrt
-- the collaboration (along w being able to record status)", one box per request.
--
-- Additive and nullable. Both tables already grant UPDATE to `authenticated` and gate it
-- with the existing *_director_update RLS policies (is_director()), so no new policy or
-- grant is needed. Applied live 19 Nov 2026 via the Supabase connector.
alter table public.collaboration_submissions add column if not exists notes text;
alter table public.contact_submissions       add column if not exists notes text;
