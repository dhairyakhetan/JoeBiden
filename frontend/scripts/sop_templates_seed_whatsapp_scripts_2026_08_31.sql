-- ============================================================================
-- ✅ APPLIED live 2026-08-31
--
-- Seeds the 4 real recruitment WhatsApp scripts into sop_templates (table
-- created empty by sops_and_todos_desk_2026_08_29.sql). Source: the "Copy of
-- HR" sheet, "Recruitment" row, "Pre-composed Text #1-4" columns, in
-- uploads/AQ Dept-wise Goals and Procedures Tracker.xlsx - per handoff/20
-- §2 and §4.5: "Do not compose new messages. Import these verbatim as
-- templates... let HR edit them in the product." Imported verbatim,
-- including the org's own emoji/tone - do not "clean up" the copy.
--
-- department_slug: sop_templates' CHECK constraint only allows the 5 content
-- categories (events/welfare/content/operations/labs) - there is no distinct
-- "HR" slug. These are recruitment/admin scripts, closest to Operations
-- (the department the redesign handoff already describes as owning
-- "logistics, batch approvals, the stuff nobody sees") - assigned here, not
-- a literal schema fact.
--
-- Body text intentionally contains a `{{name}}` placeholder is NOT present
-- in the raw sheet text (none of the 4 scripts address the recipient by
-- name inline) - the frontend's copy-to-clipboard UI still supports
-- substituting `{{name}}` if HR edits a template to add it (handoff/20
-- §4.5's "name substituted"), but nothing is invented here that wasn't in
-- the source.
-- ============================================================================

insert into public.sop_templates (department_slug, label, body) values
('operations', 'Recruitment: first text to applicants', $tpl1$First text to all AQ applicants:

Hi!!!!
Hrishika here from Team AquaTerra.

We’re so happy to get your application! AquaTerra is a student-led NGO that’s been working for 4+ years on social, environmental & animal welfare, having conducted 500+ initiatives across Kolkata. We also run three student-led startups:
Roots (clothing brand) , ShikshAq (ed-tech platform), and AQ Ventures (marketing & consultancy agency).

Before we start, we’d love to know more about you 💃🏼
As part of our induction, we’ll have a short, friendly interview. Please pick a slot that works for you here (add your name to the slot best preferred, you'll be required to join a video interview!)
https://docs.google.com/spreadsheets/d/1KuLI1KmtYVjbPF44VYpNouyijKgqtO60sUKsy5l12GQ/edit?usp=drivesdk

Excited to meet you soon! 🥳

Stalk us here ;)
www.ngoaquaterra.com
Instagram: https://www.instagram.com/ngo.aquaterra?igsh=aG5xNmZoM3k3MGRn
LinkedIn: https://www.linkedin.com/company/aquaterrango/$tpl1$),

('operations', 'Recruitment: interview day reminder', $tpl2$Reminder on the day of interview (for joining AQ):

Hello there,
This is a friendly reminder for your NGO AquaTerra interview scheduled for today at 9pm.

Meet link: meet.google.com/zqf-envy-kmk$tpl2$),

('operations', 'Recruitment: rejection', $tpl3$Rejection (from Community AQ):

Hi! Hrishika here from Team AquaTerra.
We truly appreciate your interest in joining our NGO, and the efforts that you’ve put in throughout the application process. We regret to inform you that, due to limited spots, we won’t be able to take your application forward at this time. Thank you for your willingness to contribute, and we wish you the best ahead!$tpl3$),

('operations', 'Recruitment: acceptance', $tpl4$Acceptance (to Community AQ):

Hi! Hrishika here from Team AquaTerra.
Congratulations! Your application has been selected and we’re glad to welcome you to our family. You have been added to the Community AquaTerra WhatsApp group as part of the onboarding process.
If you have any doubts in the future as part of the team, please don’t hesitate to reach out to me!$tpl4$);

-- ============================================================================
-- VERIFICATION — run after applying. Every line should report OK.
-- ============================================================================
-- Expect: exactly 4 rows, all department_slug='operations'
--   select id, department_slug, label, length(body) from public.sop_templates order by id;
-- ============================================================================
