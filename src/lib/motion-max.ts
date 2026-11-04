// Motions fulle funksjonssett (drag, layout), lastet dynamisk der det trengs
// (Bunnark). Resten av appen bruker det lette `domAnimation`-settet via
// Bevegelsesramme, så drag-koden kommer aldri med i hovedbundelen.
import { domMax } from "motion/react";

export default domMax;
