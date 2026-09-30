import { useEffect, useMemo, useRef, useState } from "react";
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
  const [elever, setElever] = useState<Sokeelev[]>([]);
  const [okter, setOkter] = useState<Sokeokt[]>([]);
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
      className="fixed inset-0 z-50 flex items-start justify-center bg-blekk/20 px-4 pt-[14vh]"
      onMouseDown={(e) => e.target === e.currentTarget && onLukk()}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-vanlig border border-linje bg-ark shadow-[var(--shadow-ark)]">
        <input
          autoFocus
          value={tekst}
          onChange={(e) => setTekst(e.target.value)}
          onKeyDown={tast}
          placeholder="Søk på elev, tema, fag eller dato"
          className="w-full border-b border-linje-medium bg-transparent px-4 py-3 text-medium outline-none placeholder:text-blekk-svak"
        />

        <div ref={liste} className="max-h-[55vh] overflow-y-auto py-1">
          {tekst.trim() === "" ? (
            <p className="px-4 py-3 text-liten text-blekk-svak">
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
                  className={`flex w-full items-baseline gap-3 px-4 py-1.5 text-left text-brod ${
                    i === markor ? "bg-valgt" : ""
                  }`}
                >
                  {t.type === "elev" ? (
                    <>
                      <span className="min-w-0 flex-1 truncate">
                        {t.elev.fornavn} {t.elev.etternavn}
                      </span>
                      <span className="shrink-0 text-liten text-blekk-dempet">
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

        <p className="border-t border-linje-medium px-4 py-1.5 text-liten text-blekk-svak">
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
