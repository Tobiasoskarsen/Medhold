import { FRIST_HJEMMEL } from "./gjeld.ts";

export function fristKontrollStottes(type: string | null): boolean {
  return !!type && Object.hasOwn(FRIST_HJEMMEL, type) && !!FRIST_HJEMMEL[type as keyof typeof FRIST_HJEMMEL];
}

export const GEBYR_OMFANG = "Vi sammenligner støttede gebyrbeløp med maksimalsatser. Vi har ikke kontrollert om disse kostnadene kan kreves samlet.";
export const FRIST_IKKE_KONTROLLERT = "Medhold har ikke kontrollert den juridiske fristen for denne brevtypen.";
