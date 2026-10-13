import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  hentOppsett,
  lagreOppsett,
  sammenFor,
  type Elevregel,
  type Innstillinger,
  type Kart,
  type Kartelev,
  type Oppsett,
} from "../data/klassekart";
import {
  fordelGrupper,
  gruppestorrelser,
  type Brudd,
  type Modus,
} from "../data/fordeling";
import { gruppeListe, kortnavn } from "../data/karttegning";
import { IVerktoylinja } from "../ui/Verktoylinje";
import { Bryter, Fagfirkant } from "../ui/felles";
import { Elevfoto } from "../ui/Elevfoto";
import { Avkrysning, innsatsfarge } from "./KlassekartKart";
import { hovedtast, tast as visTast } from "../ui/taster";

/**
 * Klassekartet — Grupper (SPEC §4.11, lerretet «KlassekartGrupper»).
 *
 * Antall grupper med − og +; størrelsen regnes ut («á 4–5»), og går det
 * ikke opp, blir noen én større. Gruppene er kort med svak farge og nummer,
 * og navnet kan skrives om. Elever dras mellom gruppene. Kopier til Teams og
 * Skriv ut lagrer gruppesettet, som blir historikken «Unngå samme grupper
 * som sist» regner på.
 */
export function KlassekartGrupper({
  kart,
  innst,
  elever,
  regler,
  onEndreInnst,
}: {
  kart: Kart;
  innst: Innstillinger;
  elever: Kartelev[];
  regler: Elevregel[];
  onEndreInnst: (endring: Partial<Innstillinger>) => void;
}) {
  const [grupper, setGrupper] = useState<string[][]>([]);
  const [navn, setNavn] = useState<(string | null)[]>([]);
  const [historikk, setHistorikk] = useState<Oppsett[]>([]);
  const [brudd, setBrudd] = useState<Brudd[]>([]);
  const [lagret, setLagret] = useState(true);
  const [melding, setMelding] = useState<string | null>(null);

  const elevAv = new Map(elever.map((e) => [e.id, e]));
  const antall = innst.antallGrupper;
  const storrelser = gruppestorrelser(elever.length, antall);
  const minst = Math.min(...storrelser);
  const storst = Math.max(...storrelser);

  useEffect(() => {
    void (async () => {
      const h = await hentOppsett(kart.id, "gruppe");
      setHistorikk(h);
      // Start fra sist brukte gruppesett, med de elevene som fortsatt er med.
      const sist = h[0];
      if (sist) {
        const iKilden = new Set(elever.map((e) => e.id));
        const n = Math.max(...sist.rader.map((r) => r.gruppe ?? 0)) + 1;
        const gr: string[][] = Array.from({ length: n }, () => []);
        const nv: (string | null)[] = Array(n).fill(null);
        for (const r of sist.rader)
          if (r.gruppe !== null && iKilden.has(r.elevId)) {
            gr[r.gruppe].push(r.elevId);
            nv[r.gruppe] = r.gruppenavn;
          }
        // Nye elever i den minste gruppa.
        const med = new Set(gr.flat());
        for (const e of elever)
          if (!med.has(e.id))
            gr.reduce((a, b) => (b.length < a.length ? b : a)).push(e.id);
        setGrupper(gr);
        setNavn(nv);
      } else stokk(h);
    })();
  }, [kart.id, elever]);

  function stokk(h = historikk, n = antall) {
    const hist = sammenFor(
      h,
      (a, b) => a.gruppe !== null && a.gruppe === b.gruppe,
    );
    const r = fordelGrupper({
      elever,
      antall: n,
      laste: new Map(),
      holdFra: regler.map((x) => [x.elevA, x.elevB] as [string, string]),
      historikk: hist.vekt,
      modus: innst.fordeling as Modus,
      bland: innst.bland,
      unnga: innst.unnga,
      frø: Math.floor(Math.random() * 2 ** 31),
    });
    setGrupper(r.grupper);
    setNavn((nv) => r.grupper.map((_, i) => nv[i] ?? null));
    setBrudd(r.brudd);
    setLagret(false);
  }

  function settAntall(n: number) {
    const maks = Math.max(1, Math.floor(elever.length / 2));
    const ny = Math.max(1, Math.min(maks, n));
    if (ny === antall) return;
    onEndreInnst({ antallGrupper: ny });
    stokk(historikk, ny);
  }

  async function bruk(hvorfor?: string) {
    await lagreOppsett(
      kart.id,
      "gruppe",
      grupper.flatMap((g, i) =>
        g.map((elevId) => ({ elevId, gruppe: i, gruppenavn: navn[i] ?? null })),
      ),
    );
    setHistorikk(await hentOppsett(kart.id, "gruppe"));
    setLagret(true);
    setMelding(hvorfor ?? "Gruppene er lagret");
  }

  const tekst = () =>
    gruppeListe({ tittel: kart.kildeNavn, grupper, navn, elever });

  async function teams() {
    await navigator.clipboard.writeText(tekst());
    if (!lagret) await bruk("Kopiert til Teams, og lagret");
    else setMelding("Kopiert til Teams");
  }

  async function skrivUt() {
    if (!lagret) await bruk();
    await invoke("skriv_ut");
  }

  useEffect(() => {
    const tast = (e: KeyboardEvent) => {
      if (!hovedtast(e)) return;
      const k = e.key.toLowerCase();
      if (k === "r" && !e.shiftKey) {
        e.preventDefault();
        stokk();
      } else if (k === "p" && !e.shiftKey) {
        e.preventDefault();
        void skrivUt();
      }
    };
    window.addEventListener("keydown", tast);
    return () => window.removeEventListener("keydown", tast);
  });

  useEffect(() => {
    if (!melding) return;
    const t = window.setTimeout(() => setMelding(null), 3500);
    return () => window.clearTimeout(t);
  }, [melding]);

  // ------------------------------------------------------------- å dra

  const [dra, setDra] = useState<{
    elevId: string;
    x: number;
    y: number;
    flyttet: boolean;
  } | null>(null);
  const draRef = useRef(dra);
  draRef.current = dra;

  useEffect(() => {
    if (!dra) return;
    const flytter = (e: PointerEvent) =>
      setDra(
        (d) =>
          d && {
            ...d,
            x: e.clientX,
            y: e.clientY,
            flyttet:
              d.flyttet || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4,
          },
      );
    const slipp = (e: PointerEvent) => {
      const d = draRef.current;
      setDra(null);
      if (!d?.flyttet) return;
      const mal = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest<HTMLElement>("[data-gruppe]");
      if (!mal) return;
      const til = Number(mal.dataset.gruppe);
      setGrupper((gr) => {
        const ny = gr.map((g) => g.filter((x) => x !== d.elevId));
        ny[til].push(d.elevId);
        return ny;
      });
      setLagret(false);
    };
    window.addEventListener("pointermove", flytter);
    window.addEventListener("pointerup", slipp);
    return () => {
      window.removeEventListener("pointermove", flytter);
      window.removeEventListener("pointerup", slipp);
    };
  }, [dra !== null]);

  const navnPa = (id: string) => {
    const e = elevAv.get(id);
    return e ? kortnavn(e) : "?";
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <IVerktoylinja>
        {kart.kildeType === "mentorgruppe" ? (
          <span className="h-2.5 w-2.5 rounded-full bg-aksent" />
        ) : (
          <Fagfirkant farge={kart.farge} storrelse={10} />
        )}
        <h2 className="text-[calc(15px*var(--tekst-skala))] font-semibold">
          {kart.kildeNavn}
        </h2>
        <span className="text-liten text-blekk-dempet">
          {elever.length} elever
        </span>
        <Bryter
          storrelse="liten"
          verdi="grupper"
          settVerdi={(v) => onEndreInnst({ visning: v as "plasser" })}
          valg={[
            { id: "plasser", navn: "Plasser" },
            { id: "grupper", navn: "Grupper" },
          ]}
        />
        {melding && (
          <span role="status" className="truncate text-liten text-aksent">
            {melding}
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          <button
            onClick={() => void teams()}
            className="flex h-8 items-center rounded-full border border-linje-sterk bg-ark/70 px-3.5 text-brod hover:bg-ark"
          >
            Kopier til Teams
          </button>
          <button
            onClick={() => void skrivUt()}
            className="flex h-8 items-center rounded-full border border-linje-sterk bg-ark/70 px-3.5 text-brod hover:bg-ark"
          >
            Skriv ut
          </button>
        </span>
      </IVerktoylinja>

      {/* Papiret: gruppene med navn, uten bilder og farger. */}
      <div className="kunutskrift">
        <h1 className="mb-4 text-[18px] font-semibold">{kart.kildeNavn}</h1>
        <div className="grid grid-cols-3 gap-4">
          {grupper.map((g, i) => (
            <div
              key={i}
              className="break-inside-avoid border border-[#ccc] p-3"
            >
              <p className="mb-1.5 font-semibold">
                {navn[i]?.trim() || `Gruppe ${i + 1}`}
              </p>
              {g.map((id) => (
                <p key={id}>{navnPa(id)}</p>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="ikkeutskrift flex flex-wrap items-center gap-x-[18px] gap-y-3 pb-1.5">
        <span className="flex items-center gap-2 text-[calc(13.5px*var(--tekst-skala))]">
          <span className="text-blekk-dempet">Grupper</span>
          <span className="inline-flex items-center rounded-md shadow-[inset_0_0_0_1px_var(--color-linje)]">
            <button
              aria-label="Færre grupper"
              onClick={() => settAntall(antall - 1)}
              className="h-7 w-7 text-blekk-dempet hover:text-blekk"
            >
              −
            </button>
            <span className="min-w-[22px] text-center font-semibold tabular-nums">
              {storrelser.length}
            </span>
            <button
              aria-label="Flere grupper"
              onClick={() => settAntall(antall + 1)}
              className="h-7 w-7 text-blekk-dempet hover:text-blekk"
            >
              +
            </button>
          </span>
          <span className="text-[calc(12.5px*var(--tekst-skala))] tabular-nums text-blekk-svak">
            {elever.length === 0
              ? ""
              : minst === storst
                ? `á ${minst}`
                : `á ${minst}–${storst}`}
          </span>
        </span>
        <Bryter
          storrelse="liten"
          verdi={innst.fordeling}
          settVerdi={(v) => onEndreInnst({ fordeling: v as Modus })}
          valg={[
            { id: "tilfeldig", navn: "Tilfeldig" },
            { id: "spre", navn: "Spre" },
            { id: "samle", navn: "Samle" },
          ]}
        />
        <Avkrysning
          verdi={innst.bland}
          sett={(v) => onEndreInnst({ bland: v })}
        >
          Bland jenter og gutter
        </Avkrysning>
        <Avkrysning
          verdi={innst.unnga}
          sett={(v) => onEndreInnst({ unnga: v })}
        >
          Unngå samme grupper som sist
        </Avkrysning>
        <span className="flex-1" />
        <button
          onClick={() => void bruk()}
          disabled={lagret}
          className="flex h-[30px] items-center rounded-full border border-linje-sterk bg-ark px-3 text-[13px] hover:bg-flate disabled:border-transparent disabled:bg-transparent disabled:text-blekk-svak"
        >
          {lagret ? (historikk[0] ? "Brukt" : "Ikke brukt ennå") : "Bruk"}
        </button>
        <button
          onClick={() => stokk()}
          className="flex h-[30px] items-center gap-2 rounded-full bg-aksent px-3 text-[13px] font-medium text-ark hover:bg-aksent-mork"
        >
          Stokk på nytt
          <span className="text-[11px] opacity-65">{visTast("⌘R")}</span>
        </button>
      </div>
      {brudd.length > 0 && (
        <p className="ikkeutskrift text-[calc(12px*var(--tekst-skala))] text-varsel">
          {brudd
            .map((b) =>
              b.regel === "hold"
                ? `${b.tekst.split("|").map(navnPa).join(" og ")} er i samme gruppe.`
                : b.tekst,
            )
            .join(" ")}
        </p>
      )}

      <div className="ikkeutskrift grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(240px,1fr))] content-start gap-3.5 overflow-auto pb-7 pt-3">
        {grupper.map((g, i) => {
          const farge = GRUPPEFARGER[i % GRUPPEFARGER.length];
          return (
            <section
              key={i}
              data-gruppe={i}
              className="rounded-xl px-3 pb-2.5 pt-3"
              style={{
                background: `color-mix(in srgb, ${farge} 6%, var(--color-ark))`,
                boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${farge} 20%, transparent)`,
              }}
            >
              <div className="flex items-center gap-2 px-1 pb-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: farge }}
                />
                <input
                  aria-label="Gruppenavn"
                  value={navn[i] ?? `Gruppe ${i + 1}`}
                  onChange={(e) => {
                    const v = e.target.value;
                    setNavn((nv) => nv.map((x, j) => (j === i ? v : x)));
                    setLagret(false);
                  }}
                  className="w-32 rounded bg-transparent text-[calc(14px*var(--tekst-skala))] font-semibold outline-none focus:bg-ark"
                />
                <span className="ml-auto text-[12px] tabular-nums text-blekk-dempet">
                  {g.length} elever
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {g.map((id) => {
                  const e = elevAv.get(id);
                  if (!e) return null;
                  return (
                    <div
                      key={id}
                      onPointerDown={(ev) => {
                        ev.preventDefault();
                        setDra({
                          elevId: id,
                          x: ev.clientX,
                          y: ev.clientY,
                          flyttet: false,
                        });
                      }}
                      className={`flex h-9 cursor-grab items-center gap-[9px] rounded-lg bg-ark px-2 shadow-[0_0_0_1px_var(--color-linje-medium)] ${
                        dra?.flyttet && dra.elevId === id ? "opacity-30" : ""
                      }`}
                    >
                      <Elevfoto
                        elevId={id}
                        storrelse={24}
                        navn={`${e.fornavn} ${e.etternavn}`}
                      />
                      <span className="truncate text-[calc(13.5px*var(--tekst-skala))]">
                        {e.fornavn} {e.etternavn}
                      </span>
                      {e.harSkar && (
                        <span
                          className="ml-auto h-2 w-2 shrink-0 rounded-full"
                          style={{ background: innsatsfarge(e.innsats) }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {dra?.flyttet && (
        <div
          className="pointer-events-none fixed z-50 flex -translate-x-1/2 -translate-y-1/2 rotate-[-1.5deg] items-center gap-2 rounded-lg bg-ark px-3 py-1.5 text-brod shadow-[0_10px_24px_rgba(36,31,51,.22)]"
          style={{ left: dra.x, top: dra.y }}
        >
          <Elevfoto elevId={dra.elevId} storrelse={22} />
          {elevAv.get(dra.elevId)?.fornavn}
        </div>
      )}
    </div>
  );
}

/** Gruppefargene fra lerretet. Bare på skjermen, aldri på papiret. */
const GRUPPEFARGER = [
  "#4f7fc0",
  "#c9922e",
  "#2f9a8a",
  "#c0607a",
  "#8a6fc8",
  "#6f8f3a",
  "#b0674a",
  "#3f7f9f",
];
