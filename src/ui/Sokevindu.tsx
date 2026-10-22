import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Glideflate } from "./Glideflate";
import { useInngang } from "./bevegelse";
import { Elevfoto } from "./Elevfoto";
import { hentElever } from "../data/elever";
import type { FagIAr } from "../data/fag";
import { hentOkter } from "../data/okter";
import { sok, type Sokeelev, type Sokeokt, type Treff } from "../data/sok";
import {
  erHjelp,
  erTasteliste,
  finnHjelp,
  sokKommandoer,
  TASTER,
  type Hjelp,
  type Kommando,
} from "../data/kommandoer";
import { hentVurderinger } from "../data/vurderinger";

/** En rad i lista: en kommando, et hjelpesvar, en elev eller en økt. */
type Rad =
  | { slag: "kommando"; k: Kommando }
  | { slag: "hjelp"; h: Hjelp }
  | { slag: "treff"; t: Treff };

/**
 * ⌘K — kommandolinje, hjelp og søk (SPEC §4.4, ARBEIDSLISTE 29.3, lerretet
 * Kommandolinje). Gjør · Gå til · Elever · Økter · Innstillinger. Skriver
 * du «hvordan …» eller «hjelp», blir det hjelp: korte svar med en knapp som
 * gjør det. «?» viser alle hurtigtastene. Alt ligger i appen.
 *
 * Åpnes hvor som helst i appen. Pil opp og ned flytter, Enter åpner, Esc
 * lukker.
 *
 * Dataene hentes når vinduet åpnes, ikke før — det er to spørringer, og det
 * søkes i minnet mens man skriver.
 */
export function Sokevindu({
  skolearId,
  fag,
  onApneElev,
  onApneOkt,
  onApneVurdering,
  kommandoer,
  startTekst = "",
  onLukk,
}: {
  skolearId: string;
  fag: FagIAr[];
  onApneElev: (id: string) => void;
  onApneOkt: (id: string) => void;
  onApneVurdering: (id: string) => void;
  /** Gjør, Gå til og Innstillinger */
  kommandoer: Kommando[];
  /** «?» åpner med hurtigtastene */
  startTekst?: string;
  onLukk: () => void;
}) {
  const [tekst, setTekst] = useState(startTekst);
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
  const [vurderingskommandoer, setVurderingskommandoer] = useState<Kommando[]>(
    [],
  );
  useEffect(() => {
    void hentVurderinger(skolearId).then((v) =>
      setVurderingskommandoer(
        v.map((x) => ({
          id: `vurdering:${x.id}`,
          gruppe: "Gå til" as const,
          navn: x.tittel,
          hint: `${x.fagKode} · vurdering`,
          ord: x.type ?? "",
          gjor: () => onApneVurdering(x.id),
        })),
      ),
    );
  }, [skolearId]);

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
  const alleKommandoer = useMemo(
    () => [...kommandoer, ...vurderingskommandoer],
    [kommandoer, vurderingskommandoer],
  );
  const hjelp = erHjelp(tekst);
  const taster = erTasteliste(tekst);
  const rader = useMemo<Rad[]>(() => {
    if (taster) return [];
    if (hjelp) return finnHjelp(tekst).map((h): Rad => ({ slag: "hjelp", h }));
    // Uten tekst: det man oftest gjør, og sidene.
    if (tekst.trim() === "")
      return alleKommandoer
        .filter((k) => k.gruppe === "Gjør" || k.id.startsWith("ga:"))
        .slice(0, 11)
        .map((k): Rad => ({ slag: "kommando", k }));
    const k = sokKommandoer(tekst, alleKommandoer, 8);
    const t = sok(tekst, { elever, okter, idag }, { elever: 6, okter: 6 });
    return [
      ...k
        .filter((x) => x.gruppe !== "Innstillinger")
        .map((x): Rad => ({ slag: "kommando", k: x })),
      ...t.map((x): Rad => ({ slag: "treff", t: x })),
      ...k
        .filter((x) => x.gruppe === "Innstillinger")
        .map((x): Rad => ({ slag: "kommando", k: x })),
    ];
  }, [tekst, hjelp, taster, alleKommandoer, elever, okter, idag]);

  // Ny tekst: markøren tilbake til første treff.
  useEffect(() => setMarkor(0), [tekst]);

  // Markert rad holdes synlig når man piler forbi kanten.
  useEffect(() => {
    liste.current
      ?.querySelector(`[data-nr="${markor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [markor]);

  function utfor(id: string) {
    const k = alleKommandoer.find((x) => x.id === id);
    if (id === "taster") return setTekst("?");
    onLukk();
    k?.gjor();
  }

  function apne(r: Rad) {
    if (r.slag === "hjelp") return utfor(r.h.kommando);
    onLukk();
    if (r.slag === "kommando") r.k.gjor();
    else if (r.t.type === "elev") onApneElev(r.t.elev.id);
    else onApneOkt(r.t.okt.id);
  }

  const gruppe = (r: Rad) =>
    r.slag === "kommando"
      ? r.k.gruppe
      : r.slag === "hjelp"
        ? "Hjelp"
        : r.t.type === "elev"
          ? "Elever"
          : "Økter";

  function tast(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onLukk();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setMarkor((m) => Math.min(m + 1, rader.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMarkor((m) => Math.max(m - 1, 0));
    } else if (e.key === "Enter" && rader[markor]) {
      e.preventDefault();
      apne(rader[markor]);
    }
  }

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
            placeholder="Gjør, gå til, søk … eller skriv «hvordan»"
            className="uten-fokusring w-full bg-transparent py-3.5 text-[1.3rem] outline-none placeholder:text-blekk-svak"
          />
        </div>

        <div
          ref={liste}
          className={`relative max-h-[55vh] overflow-y-auto pb-2 ${"border-t border-linje-medium/70 pt-1"}`}
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
          {taster ? (
            <div className="px-4 pb-2 pt-3">
              <p className="pb-1.5 text-etikett uppercase tracking-etikett text-blekk-dempet">
                Hurtigtaster
              </p>
              {TASTER.map(([t, hva]) => (
                <div
                  key={t}
                  className="flex items-baseline gap-3 py-1 text-brod"
                >
                  <kbd className="w-[170px] shrink-0 font-sans text-liten tabular-nums text-blekk-dempet">
                    {t}
                  </kbd>
                  <span>{hva}</span>
                </div>
              ))}
            </div>
          ) : rader.length === 0 ? (
            <p className="px-4 py-3 text-brod text-blekk-svak">
              {hjelp
                ? "Fant ingen hjelp om det. Prøv andre ord, eller «?» for hurtigtastene."
                : "Ingen treff. Skriv «hvordan …» for hjelp."}
            </p>
          ) : (
            rader.map((r, i) => (
              <div
                key={
                  r.slag === "kommando"
                    ? r.k.id
                    : r.slag === "hjelp"
                      ? r.h.sporsmal
                      : r.t.type +
                        (r.t.type === "elev" ? r.t.elev.id : r.t.okt.id)
                }
              >
                {(i === 0 || gruppe(rader[i - 1]) !== gruppe(r)) && (
                  <p className="px-4 pb-0.5 pt-2 text-etikett uppercase tracking-etikett text-blekk-dempet">
                    {gruppe(r)}
                  </p>
                )}
                {r.slag === "hjelp" ? (
                  <div
                    data-nr={i}
                    onMouseMove={() => setMarkor(i)}
                    className="relative z-[1] mx-2 rounded-[10px] px-3 py-2 text-brod text-blekk"
                  >
                    <b className="block font-medium">{r.h.sporsmal}</b>
                    <span className="mt-0.5 block text-liten leading-snug text-blekk-dempet">
                      {r.h.svar}
                    </span>
                    <button
                      onClick={() => apne(r)}
                      className="mt-1.5 rounded-full bg-aksent px-3 py-1 text-liten font-medium text-ark hover:bg-aksent-mork"
                    >
                      {r.h.knapp} ↵
                    </button>
                  </div>
                ) : (
                  <button
                    data-nr={i}
                    onMouseMove={() => setMarkor(i)}
                    onClick={() => apne(r)}
                    className="relative z-[1] mx-2 flex w-[calc(100%-1rem)] items-baseline gap-3 rounded-[10px] px-3 py-1.5 text-left text-brod text-blekk"
                  >
                    {r.slag === "kommando" ? (
                      <>
                        <span
                          aria-hidden
                          className="w-4 shrink-0 text-center text-blekk-svak"
                        >
                          {r.k.gruppe === "Gjør"
                            ? "＋"
                            : r.k.gruppe === "Innstillinger"
                              ? "⚙"
                              : "→"}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {r.k.navn}
                          {r.k.hint && (
                            <span className="ml-2 text-liten text-blekk-svak">
                              {r.k.hint}
                            </span>
                          )}
                        </span>
                        {r.k.tast && (
                          <kbd className="shrink-0 font-sans text-etikett text-blekk-dempet">
                            {r.k.tast}
                          </kbd>
                        )}
                      </>
                    ) : r.t.type === "elev" ? (
                      <>
                        {/* To linjer: navnet, og fagene eleven har hos deg. */}
                        <span className="self-center">
                          <Elevfoto elevId={r.t.elev.id} storrelse={36} />
                        </span>
                        <span className="min-w-0 flex-1 self-center">
                          <span className="block truncate">
                            {r.t.elev.fornavn} {r.t.elev.etternavn}
                          </span>
                          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-liten text-blekk-dempet">
                            {(fagFor.get(r.t.elev.id) ?? []).length === 0 ? (
                              <span className="text-blekk-svak">uten fag</span>
                            ) : (
                              fagFor.get(r.t.elev.id)!.map((f) => (
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
                          {r.t.elev.klasse ?? ""}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="w-32 shrink-0 tabular-nums text-blekk-dempet">
                          {ukedag(r.t.okt.dato)} {r.t.okt.dato}
                        </span>
                        <span className="w-16 shrink-0 font-medium">
                          {r.t.okt.alias || r.t.okt.fagKode}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {r.t.okt.tema ?? (
                            <span className="text-blekk-svak">uten tema</span>
                          )}
                        </span>
                      </>
                    )}
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        <p className="border-t border-linje-medium/70 px-4 py-1.5 text-liten text-blekk-svak">
          ↑↓ for å velge · Enter · «hvordan …» for hjelp · «?» for hurtigtaster
          · Esc lukker
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
