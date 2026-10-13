import type {} from "../../data/skolear";
import type {} from "../../data/fag";
import { merknad, type Plassering } from "../../data/samtale";
import { Elevfoto } from "../../ui/Elevfoto";
import { kortDato } from "./deler";
import { type Dagplan } from "./deler";

/**
 * Hvem som hadde tidlig eller sent sist, samlet.
 *
 * Bare de som har noe å si står her — de fleste har ingenting, og det er
 * nettopp derfor de som har det er verdt å se på.
 */
export function Historikkoversikt({
  deltakere,
  historikk,
}: {
  deltakere: { id: string; navn: string }[];
  historikk: Map<string, Plassering[]>;
}) {
  const grupper = new Map<string, string[]>();
  for (const d of deltakere) {
    const notis = merknad(historikk.get(d.id) ?? []);
    if (!notis) continue;
    grupper.set(notis, [...(grupper.get(notis) ?? []), d.navn.split(" ")[0]]);
  }

  if (grupper.size === 0) {
    return (
      <p className="mt-2 text-liten text-blekk-dempet">
        Ingenting å melde ennå. Etter et par trekninger står det her hvem som
        har hatt tidlig eller sent.
      </p>
    );
  }

  const antall = [...grupper.values()].reduce((n, g) => n + g.length, 0);
  return (
    <div className="mt-2">
      <p className="text-liten text-blekk-dempet">
        {antall === 1 ? "Én elev har" : `${antall} elever har`} en merknad.
        Merknadene vises uansett.
      </p>
      <ul className="mt-1.5 space-y-1">
        {[...grupper].map(([notis, navn]) => (
          <li key={notis} className="text-liten">
            <span className="text-blekk-dempet">{notis}</span>{" "}
            <span className="text-blekk-svak">· {navn.join(", ")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
/**
 * Fordeling — ett kort per elev i tidsrekkefølge på tvers av alle dagene.
 *
 * Plassnummeret er posisjonen i køen denne trekningen, ikke en fast id.
 */
export function Fordeling({ plan }: { plan: Dagplan[] }) {
  const alle = plan.flatMap((d) => d.rader);

  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(11rem,1fr))]">
      {alle.map((r, i) => (
        <div
          key={`${r.elevId}-${r.fra}`}
          className={`rounded-vanlig border border-linje bg-ark px-3 py-2 ${
            r.motte ? "" : "opacity-50"
          }`}
        >
          <span className="text-liten tabular-nums text-blekk-svak">
            {i + 1}
          </span>
          <p className="flex items-center gap-2 text-brod font-medium">
            {r.medlemmer.length === 1 && (
              <Elevfoto elevId={r.medlemmer[0].id} storrelse={22} />
            )}
            <span className="truncate">{r.navn}</span>
          </p>
          {r.tema && (
            <p className="truncate text-liten text-blekk-dempet">{r.tema}</p>
          )}
          <p className="text-liten tabular-nums text-blekk-svak">{r.fra}</p>
        </div>
      ))}
    </div>
  );
}
/** Alfabetisk — lista sortert på navn, med tidspunkt og dag. */
export function Alfabetisk({
  plan,
  medTema,
}: {
  plan: Dagplan[];
  medTema: boolean;
}) {
  // Én rad per elev, også i gruppesamtaler — lista er til å finne seg selv.
  const rader = plan
    .flatMap((d) =>
      d.rader.flatMap((r) =>
        r.medlemmer.map((m) => ({
          ...r,
          elevId: m.id,
          navn: m.navn,
          dato: d.dag.dato,
        })),
      ),
    )
    .sort((a, b) => a.navn.localeCompare(b.navn, "nb-NO"));

  return (
    <table className="w-full text-brod">
      <thead>
        <tr className="border-b border-linje text-left text-etikett uppercase tracking-etikett text-blekk-dempet">
          <th className="py-1">Navn</th>
          {medTema && <th className="py-1">Oppgave</th>}
          <th className="py-1">Tid</th>
          <th className="py-1">Dag</th>
        </tr>
      </thead>
      <tbody>
        {rader.map((r) => (
          <tr
            key={`${r.elevId}-${r.fra}`}
            className={`border-b border-linje-svak ${
              r.motte ? "" : "text-blekk-svak line-through"
            }`}
          >
            <td className="py-1.5">
              <span className="flex items-center gap-2">
                <Elevfoto elevId={r.elevId} storrelse={20} />
                {r.navn}
              </span>
            </td>
            {medTema && (
              <td className="py-1.5 text-blekk-dempet">{r.tema ?? ""}</td>
            )}
            <td className="py-1.5 tabular-nums text-blekk-dempet">
              {r.fra}–{r.til}
            </td>
            <td className="py-1.5 tabular-nums text-blekk-dempet">
              {kortDato(r.dato)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
