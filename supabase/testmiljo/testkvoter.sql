-- KUN FOR TESTPROSJEKTET I SUPABASE. ALDRI I PRODUKSJON.
--
-- Egne, kontrollerte kvoter for testing (A4). Lave grenser og et vindu på ti
-- minutter, så det går fort å se at en grense slår inn og slipper igjen.
-- Ingen omgåelse: koden er lik i alle miljøer, bare tallene i kvoter er ulike.
--
-- Før du kjører: sjekk at prosjektnavnet øverst i SQL Editor er testprosjektet.
-- Kjøres etter 0029. Tilbake til betaverdiene: kjør insert-setningen i 0029
-- med «do update» i stedet for «do nothing», eller sett verdiene for hånd.

update public.kvoter set grense = 3, vindu_sekunder = 600 where handling = 'dokumentanalyse';
update public.kvoter set grense = 5, vindu_sekunder = 600 where handling = 'chat';
update public.kvoter set grense = 2, vindu_sekunder = 600 where handling = 'utkast';
update public.kvoter set grense = 3, vindu_sekunder = 600 where handling = 'innlogging_epost';
update public.kvoter set grense = 10, vindu_sekunder = 600 where handling = 'innlogging_ip';
update public.kvoter set oppdatert = now();

select handling, grense, vindu_sekunder from public.kvoter order by handling;
