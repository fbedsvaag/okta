import { useEffect, useMemo, useRef, useState } from "react";
import { hentElever } from "../data/elever";
import { hentAlleElevbilder } from "../data/elevbilde";
import { Elevbilde } from "./Elevbilde";
import type { FagIAr } from "../data/fag";
import { hentOkter } from "../data/okter";
import { sok, type Sokeelev, type Sokeokt, type Treff } from "../data/sok";

/**
 * ⌘K — søk på elev eller økt, og hopp dit. SPEC §4.4.
 *
 * Åpnes hvor som helst i appen. Pil opp og ned flytter, Enter åpner, Esc
 * lukker. En elev åpnes i elevvisningen, en økt i Økter med panelet oppe.
 *
 * Dataene hentes når vinduet åpnes, ikke før — det er to spørringer, og det
 * søkes i minnet mens man skriver.
 */
export function Sokevindu({
  skolearId,
  fag,
  onApneElev,
  onApneOkt,
  onLukk,
}: {
  skolearId: string;
  fag: FagIAr[];
  onApneElev: (id: string) => void;
  onApneOkt: (id: string) => void;
  onLukk: () => void;
}) {
  const [tekst, setTekst] = useState("");
  const [markor, setMarkor] = useState(0);
  const [elever, setElever] = useState<Sokeelev[]>([]);
  const [okter, setOkter] = useState<Sokeokt[]>([]);
  // Elevbildene, til et lite rundt bilde foran navnet.
  const [bilder, setBilder] = useState<Map<string, string>>(new Map());
  // Fagene hver elev har, med fargen, til linja under navnet.
  const [fagFor, setFagFor] = useState<
    Map<string, { kode: string; farge: string | null }[]>
  >(new Map());
  const liste = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void hentAlleElevbilder().then(setBilder);
  }, []);

  useEffect(() => {
    let avbrutt = false;
    void (async () => {
      const [e, o] = await Promise.all([
        hentElever(skolearId),
        hentOkter(skolearId),
      ]);
      if (avbrutt) return;
      const perFag = new Map(fag.map((f) => [f.id, f]));
      setFagFor(
        new Map(
          e.map((x) => [
            x.id,
            x.fagIder.flatMap((id) => {
              const f = perFag.get(id);
              return f ? [{ kode: f.alias || f.kode, farge: f.farge }] : [];
            }),
          ]),
        ),
      );
      setElever(
        e.map((x) => ({
          id: x.id,
          fornavn: x.fornavn,
          etternavn: x.etternavn,
          klasse: x.klasseNavn,
          // Både koden og aliaset, så «MFL1» også finner elevene i faget.
          fag: x.fagIder.flatMap((id) => {
            const f = perFag.get(id);
            return f ? [f.kode, f.alias ?? ""] : [];
          }),
        })),
      );
      setOkter(
        o.map((x) => ({
          id: x.id,
          dato: x.dato,
          klokkeslett: x.klokkeslett,
          tema: x.tema,
          fagKode: x.fagKode,
          fagNavn: x.fagNavn,
          alias: perFag.get(x.skolearFagId)?.alias ?? null,
        })),
      );
    })();
    return () => {
      avbrutt = true;
    };
  }, [skolearId, fag]);

  const idag = new Date().toLocaleDateString("sv-SE");
  const treff = useMemo(
    () => sok(tekst, { elever, okter, idag }),
    [tekst, elever, okter, idag],
  );

  // Ny tekst: markøren tilbake til første treff.
  useEffect(() => setMarkor(0), [tekst]);

  // Markert rad holdes synlig når man piler forbi kanten.
  useEffect(() => {
    liste.current
      ?.querySelector(`[data-nr="${markor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [markor]);

  function apne(t: Treff) {
    onLukk();
    if (t.type === "elev") onApneElev(t.elev.id);
    else onApneOkt(t.okt.id);
  }

  function tast(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onLukk();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setMarkor((m) => Math.min(m + 1, treff.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMarkor((m) => Math.max(m - 1, 0));
    } else if (e.key === "Enter" && treff[markor]) {
      e.preventDefault();
      apne(treff[markor]);
    }
  }

  const forsteOkt = treff.findIndex((t) => t.type === "okt");

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-teppe/25 px-4 pt-[14vh]"
      onMouseDown={(e) => e.target === e.currentTarget && onLukk()}
    >
      {/*
        Formet som Spotlight: store, myke hjørner, litt gjennomsiktig over
        appen, et stort søkefelt med lupe, og treff markert med en avrundet
        flate innenfor kantene. Ellers er appen skarp (DESIGN.md §6) — dette
        er det ene vinduet som skal kjennes som en del av macOS.
      */}
      <div className="w-full max-w-xl overflow-hidden rounded-[16px] border border-linje/70 bg-ark/90 shadow-[0_24px_60px_-12px_rgb(36_31_51/0.35),0_0_0_0.5px_rgb(36_31_51/0.08)] backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4">
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            className="h-5 w-5 shrink-0 text-blekk-svak"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <circle cx="8.5" cy="8.5" r="5.75" />
            <path d="M13 13l4.25 4.25" />
          </svg>
          <input
            autoFocus
            value={tekst}
            onChange={(e) => setTekst(e.target.value)}
            onKeyDown={tast}
            placeholder="Søk på elev, tema, fag eller dato"
            className="uten-fokusring w-full bg-transparent py-3.5 text-[1.3rem] outline-none placeholder:text-blekk-svak"
          />
        </div>

        <div
          ref={liste}
          className={`max-h-[55vh] overflow-y-auto pb-2 ${
            tekst.trim() === "" ? "" : "border-t border-linje-medium/70 pt-1"
          }`}
        >
          {tekst.trim() === "" ? (
            <p className="border-t border-linje-medium/70 px-4 pb-1 pt-3 text-liten text-blekk-svak">
              Navn, klasse, tema, fag (også aliaset) eller dato — 2026-10-12,
              12.10 eller 12.10.26. Flere ord snevrer inn, f.eks. «mfl1 2026-10»
              for oktoberøktene i MFL1.
            </p>
          ) : treff.length === 0 ? (
            <p className="px-4 py-3 text-brod text-blekk-svak">Ingen treff.</p>
          ) : (
            treff.map((t, i) => (
              <div key={t.type + (t.type === "elev" ? t.elev.id : t.okt.id)}>
                {(i === 0 || i === forsteOkt) && (
                  <p className="px-4 pb-0.5 pt-2 text-etikett uppercase tracking-etikett text-blekk-dempet">
                    {t.type === "elev" ? "Elever" : "Økter"}
                  </p>
                )}
                <button
                  data-nr={i}
                  onMouseMove={() => setMarkor(i)}
                  onClick={() => apne(t)}
                  className={`mx-2 flex w-[calc(100%-1rem)] items-baseline gap-3 rounded-[8px] px-3 py-1.5 text-left text-brod ${
                    i === markor ? "bg-valgt" : ""
                  }`}
                >
                  {t.type === "elev" ? (
                    <>
                      {/* To linjer: navnet, og fagene eleven har hos deg. */}
                      <span className="self-center">
                        {bilder.get(t.elev.id) ? (
                          <Elevbilde
                            src={bilder.get(t.elev.id)!}
                            storrelse={36}
                            hjorne={7}
                          />
                        ) : (
                          <span className="flex h-9 w-9 items-center justify-center rounded-[7px] bg-flate text-liten font-medium text-blekk-dempet">
                            {t.elev.fornavn[0]}
                            {t.elev.etternavn[0] ?? ""}
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1 self-center">
                        <span className="block truncate">
                          {t.elev.fornavn} {t.elev.etternavn}
                        </span>
                        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-liten text-blekk-dempet">
                          {(fagFor.get(t.elev.id) ?? []).length === 0 ? (
                            <span className="text-blekk-svak">uten fag</span>
                          ) : (
                            fagFor.get(t.elev.id)!.map((f) => (
                              <span
                                key={f.kode}
                                className="flex items-center gap-1"
                              >
                                <span
                                  aria-hidden
                                  className="h-2 w-2 rounded-full"
                                  style={{
                                    background:
                                      f.farge ?? "var(--color-linje-sterk)",
                                  }}
                                />
                                {f.kode}
                              </span>
                            ))
                          )}
                        </span>
                      </span>
                      <span className="shrink-0 self-center text-liten text-blekk-dempet">
                        {t.elev.klasse ?? ""}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="w-32 shrink-0 tabular-nums text-blekk-dempet">
                        {ukedag(t.okt.dato)} {t.okt.dato}
                      </span>
                      <span className="w-16 shrink-0 font-medium">
                        {t.okt.alias || t.okt.fagKode}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {t.okt.tema ?? (
                          <span className="text-blekk-svak">uten tema</span>
                        )}
                      </span>
                    </>
                  )}
                </button>
              </div>
            ))
          )}
        </div>

        <p className="border-t border-linje-medium/70 px-4 py-1.5 text-liten text-blekk-svak">
          ↑↓ for å velge · Enter åpner · Esc lukker
        </p>
      </div>
    </div>
  );
}

function ukedag(dato: string): string {
  const [a, m, d] = dato.split("-").map(Number);
  return ["søn", "man", "tir", "ons", "tor", "fre", "lør"][
    new Date(Date.UTC(a, m - 1, d)).getUTCDay()
  ];
}
