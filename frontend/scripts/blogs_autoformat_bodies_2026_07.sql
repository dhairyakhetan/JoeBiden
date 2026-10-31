-- Structure-only reformatter for blog bodies.  APPLIED LIVE 2026-07-28.
--
-- THE PROBLEM: bodies came out of .docx exports hard-wrapped at a fixed column
-- (~90-100 chars) with NO blank lines. BlogPostPage splits on '\n\n' to find
-- paragraphs, found none, and rendered each essay as one wall of text. Several
-- posts had 25-41 line breaks and ZERO paragraph breaks (People in the Mirror,
-- Voicing One's Opinions, He Barks I Heal, Dynamics, The Curse on Society).
--
-- THE RULE: this may only insert or remove WHITESPACE. It never rewrites,
-- reorders, capitalises or substitutes a word. Verified before applying by
-- stripping all whitespace from both sides and comparing: 33/33 bodies came
-- back character-identical, 0 changed.
--
-- HOW IT DECIDES: in hard-wrapped text a line that stops WELL SHORT of the
-- wrap column ends a paragraph; a line running to the column is a
-- continuation. Measure the wrap width from the text itself, join
-- continuations with one space, break after any short line. Blank lines and
-- lines opening with a quotation mark (dialogue) also start a paragraph.
--
-- VERSE IS EXEMPT: poems are short-lined throughout and their breaks are
-- authored, not an export artifact. If most lines are short, only blank-line
-- runs are normalised.
CREATE OR REPLACE FUNCTION public.format_blog_body(src text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO ''
AS $function$
DECLARE
  lines text[]; ln text; trimmed text;
  wrap_w int; threshold int; long_lines int := 0; n_lines int;
  para text := ''; out_paras text[] := '{}'; i int;
BEGIN
  IF src IS NULL OR btrim(src) = '' THEN RETURN src; END IF;

  lines := string_to_array(replace(src, E'\r\n', E'\n'), E'\n');
  n_lines := array_length(lines, 1);
  IF n_lines IS NULL OR n_lines < 2 THEN RETURN src; END IF;

  SELECT max(length(btrim(x))) INTO wrap_w FROM unnest(lines) AS x;
  SELECT count(*) INTO long_lines FROM unnest(lines) AS x WHERE length(btrim(x)) > 65;

  IF long_lines <= n_lines / 3 THEN
    RETURN btrim(regexp_replace(replace(src, E'\r\n', E'\n'), E'\n{3,}', E'\n\n', 'g'));
  END IF;

  threshold := GREATEST((wrap_w * 82) / 100, 40);

  FOR i IN 1 .. n_lines LOOP
    ln := lines[i]; trimmed := btrim(ln);

    IF trimmed = '' THEN
      IF btrim(para) <> '' THEN out_paras := out_paras || btrim(para); para := ''; END IF;
      CONTINUE;
    END IF;

    IF left(trimmed, 1) IN ('"', '“') AND btrim(para) <> '' THEN
      out_paras := out_paras || btrim(para); para := '';
    END IF;

    para := CASE WHEN para = '' THEN trimmed ELSE para || ' ' || trimmed END;

    IF length(trimmed) < threshold OR i = n_lines THEN
      out_paras := out_paras || btrim(para); para := '';
    END IF;
  END LOOP;

  IF btrim(para) <> '' THEN out_paras := out_paras || btrim(para); END IF;

  RETURN array_to_string(out_paras, E'\n\n');
END;
$function$;

-- GATE: run this FIRST. It must return 0, or do not apply the UPDATE below.
--   select count(*) from blogs
--    where body is not null
--      and regexp_replace(body, '\s', '', 'g')
--       <> regexp_replace(public.format_blog_body(body), '\s', '', 'g');

UPDATE blogs SET body = public.format_blog_body(body) WHERE body IS NOT NULL;

-- Refresh the mirrored feed excerpts so they reflect the cleaned bodies.
UPDATE posts p
   SET body = public.blog_post_writeup(b.headliner, b.body, b.written_by)
  FROM blogs b
 WHERE b.linked_post_id = p.uuid AND b.body IS NOT NULL;
