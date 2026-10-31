-- APPLIED LIVE 2026-09-07 (via the Supabase MCP connector).
--
-- AQ.Ventures (team_id 12) was the only team with a banner_url set, and it
-- pointed at '/team-ventures-banner.jpg', which does not exist in
-- frontend/public/. The team page rendered a broken image.
--
-- Nulled so the page falls through to the no-banner design. Upload a real
-- banner and set this whenever; nothing else is blocked on it.
update teams
   set banner_url = null
 where team_id = 12
   and banner_url = '/team-ventures-banner.jpg';
