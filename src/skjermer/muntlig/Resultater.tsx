import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { kriterierMedTekst } from "../../data/muntlig";
import type { Muntligdata } from "./MuntligArk";
import { kopierKarakterliste, renTekst, type Resultatrad } from "./eksport";

/**
 * Resultater (28.5): elev, oppgave, karakter og notat som ren tekst.
 * «Skriv ut tilbakemeldinger» gir ett ark per elev med oppgaven, de valgte
 * nivåene i rubrikken, karakteren og notatet.
 */
export function Resultater({ data }: { data: Muntligdata }) {
  const [kopiert, setKopiert] = useState(false);
  const [skriver, setSkriver] = useState(false);
  const verdi = new Map(data.verdier.map((v) => [v.id, v]));
  const elever = [...data.elever].sort((a, b) =>
    a.fornavn.localeCompare(b.fornavn, "nb"),
  );
  const rader: (Resultatrad & { elevId: string })[] = elever.map((e) => {
    const r = data.resultater.get(e.elevId);
    const s = data.samtale.get(e.elevId);
    return {
      elevId: e.elevId,
      navn: `${e.fornavn} ${e.etternavn}`,
      oppgave: s?.motte === false ? "møtte ikke" : (s?.tema ?? ""),
      karakter: r?.skalaverdiId ? (verdi.get(r.skalaverdiId)?.kode ?? "") : "",
      notat: renTekst(r?.kommentar ?? null),
    };
  });

  // Utskriften: arket legges i body, og resten av appen skjules på papiret.
  useEffect(() => {
    if (!skriver) return;
    document.body.classList.add("skriver-eget");
    const t = window.setTimeout(() => void invoke("skriv_ut"), 50);
    return () => {
      window.clearTimeout(t);
      document.body.classList.remove("skriver-eget");
    };
  }, [skriver]);
  useEffect(() => {
    const ferdig = () => setSkriver(false);
    window.addEventListener("afterprint", ferdig);
    return () => window.removeEventListener("afterprint", ferdig);
  }, []);

  const r = data.oppsett.rubrikk;
  const krit = kriterierMedTekst(r);

  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[.06em] text-blekk-svak">
        Resultater
      </div>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="text-left text-liten text-blekk-svak">
            <th className="py-1.5 pr-3 font-normal">Elev</th>
            <th className="py-1.5 pr-3 font-normal">Oppgave</th>
            <th className="py-1.5 pr-3 font-normal">Karakter</th>
            <th className="py-1.5 font-normal">Notat</th>
          </tr>
        </thead>
        <tbody>
          {rader.map((x) => (
            <tr key={x.elevId} className="border-t border-linje-svak align-top">
              <td className="whitespace-nowrap py-2 pr-3">{x.navn}</td>
              <td className="py-2 pr-3 text-blekk-dempet">{x.oppgave}</td>
              <td className="py-2 pr-3 font-semibold">{x.karakter}</td>
              <td className="py-2 text-blekk-dempet">{x.notat}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3.5 flex gap-2">
        <button
          onClick={() => setSkriver(true)}
          className="h-[30px] rounded-full border border-linje-sterk bg-ark px-3 text-[13px] hover:bg-flate"
        >
          Skriv ut tilbakemeldinger
        </button>
        <button
          onClick={async () => {
            await kopierKarakterliste(data.vurdering.tittel, rader, true);
            setKopiert(true);
            window.setTimeout(() => setKopiert(false), 1500);
          }}
          className="h-[30px] rounded-full border border-linje-sterk bg-ark px-3 text-[13px] hover:bg-flate"
        >
          {kopiert ? "Kopiert ✓" : "Kopier karakterlista"}
        </button>
      </div>

      {skriver &&
        createPortal(
          <div className="kunutskrift text-[11pt] text-black">
            {rader.map((x) => {
              const res = data.resultater.get(x.elevId);
              return (
                <section key={x.elevId} className="break-after-page">
                  <h1 className="text-[16pt] font-semibold">{x.navn}</h1>
                  <p className="mb-4">
                    {data.vurdering.fagKode} · {data.vurdering.tittel}
                  </p>
                  {x.oppgave && (
                    <p>
                      <b>Oppgave:</b> {x.oppgave}
                    </p>
                  )}
                  {data.oppsett.form === "rubrikk" && krit.length > 0 && (
                    <table className="my-3 w-full border-collapse">
                      <tbody>
                        {krit.map((k) => {
                          const n = r.nivaer.find(
                            (n) => n.id === res?.rubrikkvalg[k.id],
                          );
                          return (
                            <tr key={k.id} className="border-b border-gray-300">
                              <td className="py-1 pr-3 font-medium">
                                {k.tekst}
                              </td>
                              <td className="py-1 pr-3">{n?.navn ?? "–"}</td>
                              <td className="py-1">
                                {n ? (k.celler[n.id] ?? "") : ""}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                  {x.karakter && (
                    <p>
                      <b>Karakter:</b> {x.karakter}
                    </p>
                  )}
                  {x.notat && <p className="mt-3">{x.notat}</p>}
                </section>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
