import type { Skolear } from "../data/skolear";
import type { FagIAr } from "../data/fag";
import type { Okt, OktVurdering } from "../data/okter";

/**
 * Utskriftsvisning av årsplanen, SPEC §4.9.
 *
 * Egen visning, ikke utskrift av skjermbildet. Ett fag per side, lesbar i
 * svart-hvitt. Cmd+P gir «Lagre som PDF» i macOS-dialogen.
 *
 * **Dette er arket elevene får.** Derfor står bare dato, ukedag, varighet,
 * tema og eventuell vurdering her. Plan, øktlogg, skåringer og notater er
 * lærerens eget materiale og skal ikke følge med ut.
 */
export function Arsplan({
  skolear,
  fag,
  okter,
  vurderinger,
}: {
  skolear: Skolear;
  fag: FagIAr[];
  okter: Okt[];
  vurderinger: Map<string, OktVurdering[]>;
}) {
  const medOkter = fag.filter((f) => okter.some((o) => o.skolearFagId === f.id));

  return (
    <div className="kunutskrift">
      {medOkter.map((f) => {
        const egne = okter.filter((o) => o.skolearFagId === f.id);
        const timer = Math.round((egne.reduce((s, o) => s + o.varighetMin, 0) / 60) * 10) / 10;

        return (
          <section key={f.id} className="fagside">
            <header className="mb-3 border-b-2 border-black pb-1">
              <h1 className="text-[15pt] font-bold">
                {f.kode} — {f.navn}
              </h1>
              <p className="text-[10pt]">
                Årsplan {skolear.navn} · {egne.length} økter · {timer} timer
              </p>
            </header>

            <table className="w-full text-[10pt]">
              <thead>
                <tr className="border-b border-black text-left">
                  <th className="w-[4.5rem] py-1 font-semibold">Dato</th>
                  <th className="w-[4rem] py-1 font-semibold">Dag</th>
                  <th className="w-[3.5rem] py-1 font-semibold">Tid</th>
                  <th className="py-1 font-semibold">Tema</th>
                  <th className="w-[11rem] py-1 font-semibold">Vurdering</th>
                </tr>
              </thead>
              <tbody>
                {egne.map((o) => (
                  <tr key={o.id} className="border-b border-neutral-300 align-top">
                    <td className="py-1 tabular-nums">{kortDato(o.dato)}</td>
                    <td className="py-1">{ukedag(o.dato)}</td>
                    <td className="py-1 tabular-nums">{o.klokkeslett ?? ""}</td>
                    <td className="py-1">{o.tema ?? ""}</td>
                    <td className="py-1">
                      {(vurderinger.get(o.id) ?? []).map((v) => v.tittel).join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="mt-3 text-[8pt] text-neutral-600">
              Med forbehold om endringer.
            </p>
          </section>
        );
      })}
    </div>
  );
}

function kortDato(dato: string): string {
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function ukedag(dato: string): string {
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    weekday: "long",
  });
}
