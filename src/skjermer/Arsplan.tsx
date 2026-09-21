import type { Skolear } from "../data/skolear";
import type { FagIAr } from "../data/fag";
import type { Okt, OktVurdering } from "../data/okter";
import type { Periode } from "../data/perioder";

/**
 * Utskriftsvisning av årsplanen, SPEC §4.9.
 *
 * Egen visning, ikke utskrift av skjermbildet. Ett fag per side, lesbar i
 * svart-hvitt. Cmd+P gir «Lagre som PDF» i macOS-dialogen.
 *
 * **Dette er arket elevene får.** Derfor står bare dato, ukedag, varighet,
 * tema og eventuell vurdering her. Plan, øktlogg, skåringer og notater er
 * lærerens eget materiale og skal ikke følge med ut.
 *
 * Øktene er gruppert under perioden sin, med spenn og timetall i overskriften.
 * Det er periodiseringen som gjør arket lesbart som en plan og ikke bare en
 * dataliste — eleven ser hvilket tema som gjelder når.
 */
export function Arsplan({
  skolear,
  fag,
  okter,
  vurderinger,
  perioder,
}: {
  skolear: Skolear;
  fag: FagIAr[];
  okter: Okt[];
  vurderinger: Map<string, OktVurdering[]>;
  /** Perioden hver økt faller inn under, utledet av datoen */
  perioder: Map<string, Periode>;
}) {
  const medOkter = fag.filter((f) =>
    okter.some((o) => o.skolearFagId === f.id),
  );

  return (
    <div className="kunutskrift">
      {medOkter.map((f) => {
        const egne = okter.filter((o) => o.skolearFagId === f.id);
        const grupper = grupperPaPeriode(egne, perioder);

        return (
          <section key={f.id} className="fagside">
            <header className="mb-3 border-b-2 border-black pb-1">
              <h1 className="text-[15pt] font-bold">
                {f.kode} — {f.navn}
              </h1>
              <p className="text-[10pt]">
                Årsplan {skolear.navn} · {egne.length} økter · {timer(egne)}{" "}
                timer
              </p>
            </header>

            {grupper.map((g) => (
              <div key={g.navn} className="mb-4 break-inside-avoid">
                <h2 className="border-b border-black pb-0.5 text-[11pt] font-semibold">
                  {g.navn}
                  <span className="float-right font-normal">
                    {spenn(g.okter)} · {g.okter.length} økter · {timer(g.okter)}{" "}
                    t
                  </span>
                </h2>

                {g.kompetansemal && (
                  <p className="mt-1 text-[9pt] italic">{g.kompetansemal}</p>
                )}

                <table className="mt-1 w-full text-[10pt]">
                  <thead>
                    <tr className="border-b border-black text-left">
                      <th className="w-[4.5rem] py-1 font-semibold">Dato</th>
                      <th className="w-[4rem] py-1 font-semibold">Dag</th>
                      <th className="w-[3.5rem] py-1 font-semibold">Tid</th>
                      <th className="py-1 font-semibold">Tema</th>
                      <th className="w-[11rem] py-1 font-semibold">
                        Vurdering
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.okter.map((o) => (
                      <tr
                        key={o.id}
                        className="border-b border-linje align-top"
                      >
                        <td className="py-1 tabular-nums">
                          {kortDato(o.dato)}
                        </td>
                        <td className="py-1">{ukedag(o.dato)}</td>
                        <td className="py-1 tabular-nums">
                          {o.klokkeslett ?? ""}
                        </td>
                        <td className="py-1">{o.tema ?? ""}</td>
                        <td className="py-1">
                          {(vurderinger.get(o.id) ?? [])
                            .map((v) => v.tittel)
                            .join(", ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

            <p className="mt-3 text-[8pt] text-blekk-dempet">
              Med forbehold om endringer.
            </p>
          </section>
        );
      })}
    </div>
  );
}

type Gruppe = {
  navn: string;
  kompetansemal: string | null;
  okter: Okt[];
};

/**
 * Øktene gruppert under perioden sin, i kronologisk rekkefølge.
 *
 * Rekkefølgen følger øktene, ikke `periode.rekkefolge`. Faller to perioder
 * over hverandre i tid, er det datoene eleven forholder seg til. Økter uten
 * periode havner i en egen bolk til slutt framfor å bli usynlige (§4.2).
 */
function grupperPaPeriode(
  okter: Okt[],
  perioder: Map<string, Periode>,
): Gruppe[] {
  const rekkefolge: string[] = [];
  const kart = new Map<string, Gruppe>();

  for (const o of okter) {
    const p = perioder.get(o.id) ?? null;
    const navn = p?.navn ?? "Uten periode";
    if (!kart.has(navn)) {
      kart.set(navn, {
        navn,
        kompetansemal: p?.kompetansemal ?? null,
        okter: [],
      });
      rekkefolge.push(navn);
    }
    kart.get(navn)!.okter.push(o);
  }

  // «Uten periode» sist, uansett når den første uplasserte økta ligger.
  const navn = rekkefolge.filter((n) => n !== "Uten periode");
  if (rekkefolge.includes("Uten periode")) navn.push("Uten periode");
  return navn.map((n) => kart.get(n)!);
}

function timer(okter: Okt[]): string {
  const t = okter.reduce((s, o) => s + o.varighetMin, 0) / 60;
  return (Math.round(t * 10) / 10).toLocaleString("nb-NO");
}

/** Det faktiske spennet øktene dekker — ikke det planlagte (§3.3). */
function spenn(okter: Okt[]): string {
  if (okter.length === 0) return "";
  const datoer = okter.map((o) => o.dato).sort();
  const fra = kortDato(datoer[0]);
  const til = kortDato(datoer[datoer.length - 1]);
  return fra === til ? fra : `${fra}–${til}`;
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
