# MEDHOLD R8b — Rydd etter R8 (arbeidsordre, sammendrag)

Ingenting merges til `main` eller deployes uten godkjenning. Kun Vercel Preview. Ingen produksjonsdata, ingen serverlogikk. Følg `AGENTS.md` og `docs/testing/R3_RELEASE_GATE.md`. Mål: fjerne støy, ikke legge til noe nytt. Ikke nye farger, skrifter eller radier.

| PR | Innhold |
| --- | --- |
| 0 | Prototype og ordrer inn (kun docs) |
| 1 | Hjem: fjern hurtigrad (`Hurtigrad.tsx`), rolig kort, «2 dager igjen» uten dato, kreditornavn `line-clamp-2` |
| 2 | Legg til brev: ett hovedvalg («Ta bilde»), to stille valg, behold PDF-grensen som én liten linje, fjern `?inntak=`/`InntakKort` hvis ubrukt |
| 3 | Sak-oversikt: fjern «Du sender brevet selv.», kortere valgtekster, global `summary`-regel + `.detaljkort` for frist-raden, ett sammenslått forbehold (begge setninger ordrett), verifiser toppstripen på 390 px |
| 4 | Bunnmeny: `-translate-y-2` på selve sirkelen, ikke hele lenken; etiketter på samme grunnlinje (±1 px, 390 og 320 px) |
| 5 | Verifisering: skjermbilder med funn, rente, rettsgebyr, «Mulig avvik»-chip og mørk modus fra testmiljø |

## Ikke gjør
Ingen «Spør om saken»-felt, varsler eller betalingsark. Ingen endringer i `gebyr.ts`, `rente.ts`, `frist.ts`, AI-uttrekk, RPC-er eller migrasjoner. Ikke fjern eller omformuler sikkerhets- og forbrukertekster (forbeholdet, «Ingenting sendes automatisk», frist-forklaringer, «Oppfølgingen er separat …»); kun layout.

## Ferdig når
`npm run lint`, `npx tsc --noEmit`, `npm test` og `npm run test:db` er grønne i hver PR; hver PR-beskrivelse lister avvik fra prototypen og det som bevisst ikke er gjort.
