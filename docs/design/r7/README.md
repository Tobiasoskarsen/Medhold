# R7: funn og tone – skjermbilder

Tatt 11. november 2026 i Vercel Preview for PR #70 (`a0ac832`). Preview-en peker mot testprosjektet «medhold test», der 0032 er kjørt. Bredde 390 px, lys og mørk modus. Bare syntetiske testbrev 37 og 38 i en testkonto. Mørk modus er satt med `.mork` på `<html>`, slik appens tema-skript gjør.

| Fil | Viser |
|---|---|
| `hjem-lys.jpg`, `hjem-mork.jpg` | Heltekortet for testbrev 37: «I morgen · 12. november» i rød chip og «Gebyrsjekk: 150 kr over maksimalsats». |
| `sak38-funn-lys.jpg`, `sak38-funn-mork.jpg` | Saken for testbrev 38 etter at svaret er sendt: fortsatt «Du venter på svar». Under «Funn i brevet» står «Beløpskontroll · 100 kr uten forklaring», og forbeholdet står én gang, rett over «Hva er kontrollert?». |
| `brev38-lys.jpg`, `brev38-mork.jpg` | Brevvisningen for testbrev 38: forklaringen i to setninger, beløpskontrollen over gebyrsjekken, pillene «Innenfor» og ett forbehold. |
| `kontroll37-lys.jpg`, `kontroll37-mork.jpg` | Kontrollsteget for testbrev 37: funnkortet «150 kr over maksimalsats» øverst, «Ett gebyr er høyere enn loven tillater. Renter sjekker vi ikke ennå.», og pillene «150 kr for mye» og «Ikke sjekket». |
| `kontroll38-lys.jpg`, `kontroll38-mork.jpg` | Kontrollsteget for testbrev 38: funnkortet «100 kr uten forklaring» øverst og «Gebyrene vi kunne sjekke, er innenfor det loven tillater.» |

Kontrollstegene er tatt fra nye analyser av de samme syntetiske brevene, forkastet uten lagring.

**Ikke vist:**
- **Hjem-linjen om beløpskontroll:** Saken for testbrev 38 venter på svar og er ikke viktigste sak på Hjem nå. Linjen vises bare i kortet for viktigste sak.
- **Utkastet:** Ingen bilder av utkastet med «Bare beløpet som ikke går opp» eller av duplikatadvarselen. Begge er dekket av tester.
