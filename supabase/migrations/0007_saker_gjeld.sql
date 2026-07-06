-- Medhold Fase 1: utvid saker med gjeld/inkasso-felter (arbeidsordre 4.1).
-- Alle nye kolonner er nullable — eksisterende saker (andre kategorier) er
-- upåvirket. Kjør i Supabase SQL Editor etter 0006_varsler.sql.

alter table public.saker
  add column if not exists kreditor text,
  add column if not exists opprinnelig_kreditor text,
  add column if not exists saksnummer text,
  add column if not exists belop_hovedstol numeric(12, 2),
  add column if not exists belop_totalt numeric(12, 2),
  add column if not exists stadium text
    check (stadium in (
      'faktura', 'purring', 'inkassovarsel', 'betalingsoppfordring',
      'forliksrad', 'namsmann', 'nedbetaling', 'avsluttet'
    ));
