#!/usr/bin/env python3
"""Integrity checks for a generated seed.sql.

Run this after every `python supabase/generate_seed.py`, before committing the
result. These are the same checks that were run against production after the
2026-08-08 content audit (migrations 060-066) — see docs/NEXT-SESSION.md §12.

    python supabase/verify_seed.py                  # checks supabase/seed.sql
    python supabase/verify_seed.py path/to/seed.sql

Exits non-zero if anything fails, so it can gate a commit.

On Windows the console defaults to cp1252 and cannot print CJK, which makes this
script die on its own output rather than on a real failure. Either run it as
`PYTHONIOENCODING=utf-8 python supabase/verify_seed.py` or rely on the
reconfigure() below.

WHY EACH CHECK EXISTS
  old strings      Content the audit removed. If one reappears, the generator's
                   vocabulary tuples were edited back or a merge undid them.
  mojibake         PS 5.1's Get-Content/Set-Content default to the ANSI codepage
                   and silently mangle every non-ASCII character in this file.
                   See NEXT-SESSION.md §2.2 Trap 4.
  degenerate       A fill_blank whose prompt is just "_____ (Gloss)" has no stem
                   to reason from. The generator produced 549 of these because
                   its length threshold assumed Latin script.
  answer missing   multiple_choice built its options from the target language
                   while correct_answer was English, so the answer was absent
                   from its own options.
  duplicate opts   Two identical options, usually from a vocabulary change that
                   collapsed two entries onto one string.
  padded answer    Splitting "Buenas tardes" at the midpoint yields the answer
                   " tardes", so the learner must type a leading space.
"""
import io
import re
import sys

DEFAULT_PATH = 'supabase/seed.sql'

# Content removed by migrations 060-066. None of these may come back.
RETIRED = [
    'Estar en las nubes', 'Estar nas nuvens', 'De vez em quando', 'Bon matin',
    'Quarto de dormir', 'Excité', '氷を破る', '얼음을 깨다', '구름 위에 떠있다',
    '공은 당신에게 있다', '눈이 휘둥그레지다', '가물에', '식은 죄', '정곱', '訤弁',
    '慰概', '씨다', 'Деепричастие', 'someones', '当时', '당신',
]

MOJIBAKE = ['â€', 'Ã©', 'ï¿½']

ROW = re.compile(
    r"^  \('([^']*)', '([^']*)', '([^']*)', '((?:[^']|'')*)', '((?:[^']|'')*)', (NULL|'\{.*?\}'), "
)


def unesc(s):
    return s.replace("''", "'")


def parse_options(raw):
    if raw == 'NULL':
        return None
    inner = raw[2:-2]
    if not inner:
        return []
    return [unesc(o) for o in re.findall(r'"((?:[^"]|"")*)"', inner)]


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PATH
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    src = io.open(path, encoding='utf-8').read()
    failures = []

    for s in RETIRED:
        n = src.count(s)
        if n:
            failures.append('retired content is back: %s (x%d)' % (s, n))

    for bad in MOJIBAKE:
        if bad in src:
            failures.append('encoding damage: %s — the file was written with a non-UTF-8 codec' % bad)

    rows = []
    for line in src.split('\n'):
        m = ROW.match(line)
        if m:
            rows.append(m.groups())
    print('parsed exercise rows: %d' % len(rows))
    if len(rows) < 12000:
        failures.append('parsed only %d rows — the row parser no longer matches the file format' % len(rows))

    degenerate = missing = dupes = padded = 0
    for _id, _lesson, typ, prompt, answer, rawopts in rows:
        prompt, answer = unesc(prompt), unesc(answer)
        if typ == 'fill_blank' and re.match(r'^_+\s*\(', prompt):
            degenerate += 1
        if answer != answer.strip():
            padded += 1
        opts = parse_options(rawopts)
        if opts is not None and typ in ('multiple_choice', 'listening_choice'):
            if answer not in opts:
                missing += 1
            if len(opts) != len(set(opts)):
                dupes += 1

    for label, n in [
        ('fill_blank with no stem', degenerate),
        ('multiple_choice missing its own answer', missing),
        ('multiple_choice with duplicate options', dupes),
        ('answer padded with whitespace', padded),
    ]:
        print('%-42s %d' % (label, n))
        if n:
            failures.append('%s: %d' % (label, n))

    if failures:
        print('\nFAILED')
        for f in failures:
            print('  ' + f)
        return 1
    print('\nALL CHECKS PASSED')
    return 0


if __name__ == '__main__':
    sys.exit(main())
