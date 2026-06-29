import MalKort from "@/components/MalKort";
import { opprettFraMal } from "@/app/saker/actions";
import { MALER } from "@/lib/maler";

export default function MalListe() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {MALER.map((mal) => (
        <form key={mal.id} action={opprettFraMal}>
          <input type="hidden" name="mal" value={mal.id} />
          <MalKort mal={mal} />
        </form>
      ))}
    </div>
  );
}
