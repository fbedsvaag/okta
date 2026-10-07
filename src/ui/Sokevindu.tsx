import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Glideflate } from "./Glideflate";
import { useInngang } from "./bevegelse";
import { Elevfoto } from "./Elevfoto";
import { hentElever } from "../data/elever";
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
  const inne = useInngang();
  const [markorEl, setMarkorEl] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setMarkorEl(
      liste.current?.querySelector<HTMLElement>(`[data-nr="${markor}"]`) ??
        null,
    );
  });
  const [elever, setElever] = useState<Sokeelev[]>([]);
  const [okter, setOkter] = useState<Sokeokt[]>([]);
  // Fagene hver elev har, med fargen, til linja under navnet.
  const [fagFor, setFagFor] = useState<
    Map<string, { kode: string; farge: string | null }[]>
  >(new Map());
  const liste = useRef<HTMLDivElement>(null);

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
      data-inngang="teppe"
      data-inne={inne}
      className="matt-teppe fixed inset-0 z-50 flex items-start justify-center px-4 pt-[14vh]"
      onMouseDown={(e) => e.target === e.currentTarget && onLukk()}
    >
      {/*
        Formet som Spotlight: store, myke hjørner (26 px), glass over appen
        (DESIGN.md §7: .74, blur 40 px), et stort søkefelt med lupe, og treff
        markert med en avrundet flate innenfor kantene.
      */}
      <div
        data-inngang="midt"
        data-inne={inne}
        className="glass-sok w-full max-w-xl overflow-hidden rounded-[26px]"
      >
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
          className={`relative max-h-[55vh] overflow-y-auto pb-2 ${
            tekst.trim() === "" ? "" : "border-t border-linje-medium/70 pt-1"
          }`}
        >
          {/*
            Markøren glir med piltastene (DESIGN.md §8). Aksentflate under
            teksten (10.2): før lå en hvit flate over treffet, og det valgte
            ble det blekeste i lista.
          */}
          <Glideflate
            beholder={liste}
            mal={markorEl}
            klasse="rounded-[10px] bg-[color-mix(in_srgb,var(--color-aksent)_12%,transparent)]"
          />
          {tekst.trim() === "" ? (
            <p className="border-t border-linje-medium/70 px-4 pb-1 pt-3 text-liten text-blekk-svak">
              Navn, klasse, tema, fag (også aliaset) eller dato, for eksempel
              2026-10-12, 12.10 eller 12.10.26. Flere ord snevrer inn, f.eks.
              «mfl1 2026-10» for oktoberøktene i MFL1.
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
                  className="relative z-[1] mx-2 flex w-[calc(100%-1rem)] items-baseline gap-3 rounded-[10px] px-3 py-1.5 text-left text-brod text-blekk"
                >
                  {t.type === "elev" ? (
                    <>
                      {/* To linjer: navnet, og fagene eleven har hos deg. */}
                      <span className="self-center">
                        <Elevfoto elevId={t.elev.id} storrelse={36} />
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
