import { useEffect, useMemo, useRef, useState } from "react";
import type { FagIAr } from "../data/fag";
import type { Okt } from "../data/okter";
import { hentOktrader, type Oktrad } from "../data/oktrader";
import { hentFridager } from "../data/skolear";
import { rodekart, type Fridag } from "../data/kalender";
import { mandagFor } from "../data/dashbord";
import {
  endringstekst,
  erFerieuke,
  faginnsats,
  maneder,
  skoleuker,
  type Ukesoyle,
} from "../data/innsatsuker";
import { lytt, lyttOktvisning } from "../data/endringer";
import { useArk } from "../ui/Arkstabel";
import { Kontekstmeny, Menyvalg } from "../ui/felles";
import { fagfarge } from "../ui/farger";

/**
 * Innsats over tid på I dag (ARBEIDSLISTE 12.1, lerretet «InnsatsTid»).
 *
 * Én rad per fag og én søyle per skoleuke for hele året, i felles
 * kolonner: 100 % stablet grønn, gul, rød og ikke i økta fra bunnen. Uker
 * som kommer er tomme søyler med tynn kant, ferie en kort strek, og denne
 * uka har en lilla strek under. Til høyre andelen grønn de siste fire
 * ukene og endringen mot de fire før. Hover viser tallene, klikk åpner
 * ukas økter. Ingen forklarende tekst: bolken skal forklare seg selv.
 *
 * Søylene er 14 px når det er plass, og krymper jevnt i et smalere vindu.
 */
const H = 52;
const FARGE = {
  g: "var(--color-lys-gronn)",
  y: "var(--color-lys-gul)",
  r: "var(--color-lys-rod)",
  o: "var(--color-lys-borte)",
} as const;

export function InnsatsOverTid({
  skolearId,
  start,
  slutt,
  fag,
  okter,
}: {
  skolearId: string;
  start: string;
  slutt: string;
  fag: FagIAr[];
  /** øktene i året, så en søyle kan åpne ukas økter */
  okter: Okt[];
}) {
  const ark = useArk();
  const boks = useRef<HTMLElement>(null);
  const [rader, setRader] = useState<Oktrad[]>([]);
  const [fridager, setFridager] = useState<Fridag[]>([]);
  const [hov, setHov] = useState<{
    fag: string;
    mandag: string;
    x: number;
    y: number;
  } | null>(null);
  const [meny, setMeny] = useState<{
    x: number;
    y: number;
    okter: Okt[];
  } | null>(null);

  useEffect(() => {
    let avbrutt = false;
    const last = () =>
      void Promise.all([hentOktrader(skolearId), hentFridager(skolearId)]).then(
        ([r, f]) => {
          if (avbrutt) return;
          setRader(r);
          setFridager(f);
        },
      );
    last();
    const a = lytt(last);
    const b = lyttOktvisning(last);
    return () => {
      avbrutt = true;
      a();
      b();
    };
  }, [skolearId]);

  const idag = new Date().toLocaleDateString("sv-SE");
  const mandager = useMemo(() => skoleuker(start, slutt), [start, slutt]);
  const ferie = useMemo(() => {
    const rode = rodekart(start, slutt);
    return new Set(mandager.filter((m) => erFerieuke(m, fridager, rode)));
  }, [mandager, fridager, start, slutt]);
  const linjer = useMemo(
    () =>
      fag.map((f) => ({
        fag: f,
        ...faginnsats(rader, f.id, mandager, ferie, idag),
      })),
    [fag, rader, mandager, ferie, idag],
  );
  const mnd = useMemo(() => maneder(mandager), [mandager]);
  const denneMnd = idag.slice(0, 7);

  const kolonner = {
    display: "grid",
    gridTemplateColumns: `repeat(${mandager.length}, minmax(0, 14px))`,
    columnGap: 3,
  } as const;
  const rutenett = "grid grid-cols-[150px_minmax(0,1fr)_120px] gap-x-5";

  /** Én økt den uka åpnes rett; flere gir en liste å velge fra. */
  function apneUke(fagId: string, mandag: string, el: HTMLElement) {
    const ukas = okter
      .filter(
        (o) =>
          o.skolearFagId === fagId &&
          mandagFor(o.dato) === mandag &&
          o.dato <= idag,
      )
      .sort(
        (a, b) =>
          a.dato.localeCompare(b.dato) ||
          (a.klokkeslett ?? "").localeCompare(b.klokkeslett ?? ""),
      );
    if (ukas.length === 1) return ark.apneOkt(ukas[0].id, "skaring");
    if (ukas.length === 0) return;
    const r = el.getBoundingClientRect();
    setMeny({ x: r.left, y: r.bottom + 4, okter: ukas });
  }

  const tips = (() => {
    if (!hov) return null;
    const l = linjer.find((x) => x.fag.id === hov.fag);
    const u = l?.uker.find((x) => x.mandag === hov.mandag);
    if (!l || !u) return null;
    return { l, u };
  })();

  return (
    <section ref={boks} className="relative">
      <div className="flex items-baseline gap-2.5 border-b border-linje-medium pb-2.5">
        <h2 className="text-[calc(15px*var(--tekst-skala))] font-semibold">
          Innsats over tid
        </h2>
        <span className="flex-1" />
        <span className="flex gap-3 text-[calc(12px*var(--tekst-skala))] text-blekk-dempet">
          {(
            [
              ["g", "Grønn"],
              ["y", "Gul"],
              ["r", "Rød"],
              ["o", "Ikke i økta"],
            ] as const
          ).map(([k, navn]) => (
            <span key={k} className="inline-flex items-center gap-[5px]">
              <i
                className="inline-block h-[9px] w-[9px] rounded-[2px]"
                style={{ background: FARGE[k] }}
              />
              {navn}
            </span>
          ))}
        </span>
      </div>

      <div
        className={`${rutenett} items-end pb-1.5 pt-2 text-[calc(11.5px*var(--tekst-skala))] text-blekk-svak`}
      >
        <span />
        <span />
        <span className="text-right">Grønn, siste 4 uker</span>
      </div>

      {linjer.map(({ fag: f, uker, siste, endring }) => (
        <div
          key={f.id}
          className={`${rutenett} items-end border-b border-linje-svak py-2.5`}
        >
          <div className="min-w-0 self-center">
            <div className="flex items-center gap-[7px] text-[calc(14px*var(--tekst-skala))] font-semibold">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={{
                  background: f.farge
                    ? fagfarge(f.farge)
                    : "var(--color-linje-sterk)",
                }}
              />
              {f.kode}
            </div>
            <div className="ml-[17px] mt-0.5 truncate text-[calc(12px*var(--tekst-skala))] text-blekk-dempet">
              {f.navn}
            </div>
          </div>
          <div
            className="items-end"
            style={kolonner}
            onMouseLeave={() => setHov(null)}
          >
            {uker.map((u) => (
              <Soyle
                key={u.mandag}
                u={u}
                dempet={
                  !!hov &&
                  u.status === "data" &&
                  !(hov.fag === f.id && hov.mandag === u.mandag)
                }
                onInn={(el) => {
                  const r = el.getBoundingClientRect();
                  const p = boks.current!.getBoundingClientRect();
                  setHov({
                    fag: f.id,
                    mandag: u.mandag,
                    x: r.left - p.left + r.width / 2,
                    y: r.top - p.top - 8,
                  });
                }}
                onKlikk={(el) =>
                  u.status === "data" && apneUke(f.id, u.mandag, el)
                }
              />
            ))}
          </div>
          <div className="self-center text-right">
            <div className="text-[calc(24px*var(--tekst-skala))] font-light leading-tight tracking-[-0.02em] tabular-nums">
              {siste === null ? "–" : `${Math.round(siste * 100)} %`}
            </div>
            {endring !== null && (
              <div
                className={`text-[calc(12px*var(--tekst-skala))] tabular-nums ${endring < 0 ? "text-feil" : "text-blekk-dempet"}`}
              >
                {endringstekst(endring)}
              </div>
            )}
          </div>
        </div>
      ))}

      <div className={`${rutenett} pt-2`}>
        <span />
        <div className="text-[calc(11px*var(--tekst-skala))]" style={kolonner}>
          {mnd.map((m) => (
            <span
              key={m.mnd}
              className="overflow-hidden whitespace-nowrap"
              style={{
                gridColumn: `span ${m.uker}`,
                color:
                  m.mnd === denneMnd
                    ? "var(--color-aksent)"
                    : "var(--color-blekk-svak)",
                fontWeight: m.mnd === denneMnd ? 600 : 400,
              }}
            >
              {m.navn}
            </span>
          ))}
        </div>
        <span />
      </div>

      {tips && hov && !meny && (
        <div
          className="pointer-events-none absolute z-20 whitespace-nowrap rounded-[10px] px-3 py-[9px] text-[12px] leading-[1.5] text-white shadow-[0_8px_24px_rgba(36,31,51,0.25)]"
          style={{
            left: hov.x,
            top: hov.y,
            transform: "translate(-50%, -100%)",
            background: "rgba(36,31,51,.92)",
          }}
        >
          <div className="font-semibold">
            {tips.l.fag.kode} · uke {tips.u.uke}
          </div>
          <div className="text-[#d9d4e8]">
            {tips.u.status === "data"
              ? `${tips.u.okter} ${tips.u.okter === 1 ? "økt" : "økter"} · ${tips.u.g + tips.u.y + tips.u.r + tips.u.o} skåringer`
              : tips.u.status === "ferie"
                ? "Ferie"
                : tips.u.status === "kommer"
                  ? "Kommer"
                  : "Ingen økter"}
          </div>
          {tips.u.status === "data" && (
            <div className="mt-0.5 flex gap-2.5 tabular-nums">
              <span>
                <span className="text-[#7fd08a]">●</span> {tips.u.g}
              </span>
              <span>
                <span className="text-[#f0c75a]">●</span> {tips.u.y}
              </span>
              <span>
                <span className="text-[#ef7d70]">●</span> {tips.u.r}
              </span>
              <span>
                <span className="text-[#bfc3c9]">●</span> {tips.u.o}
              </span>
            </div>
          )}
        </div>
      )}

      {meny && (
        <Kontekstmeny x={meny.x} y={meny.y} onLukk={() => setMeny(null)}>
          {meny.okter.map((o) => (
            <Menyvalg
              key={o.id}
              onKlikk={() => {
                setMeny(null);
                ark.apneOkt(o.id, "skaring");
              }}
            >
              <span className="tabular-nums">
                {new Date(`${o.dato}T00:00:00`).toLocaleDateString("nb-NO", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </span>
              {o.klokkeslett && (
                <span className="ml-2 tabular-nums text-blekk-dempet">
                  {o.klokkeslett}
                </span>
              )}
              {o.tema && (
                <span className="ml-2 text-blekk-dempet">{o.tema}</span>
              )}
            </Menyvalg>
          ))}
        </Kontekstmeny>
      )}
    </section>
  );
}

/** Én uke: stablet søyle, tom søyle med kant, ferie-strek eller ingenting. */
function Soyle({
  u,
  dempet,
  onInn,
  onKlikk,
}: {
  u: Ukesoyle;
  dempet: boolean;
  onInn: (el: HTMLElement) => void;
  onKlikk: (el: HTMLElement) => void;
}) {
  const n = u.g + u.y + u.r + u.o;
  const deler = (["g", "y", "r", "o"] as const).filter((k) => u[k] > 0);
  return (
    <div
      onMouseEnter={(e) => onInn(e.currentTarget)}
      onClick={(e) => onKlikk(e.currentTarget)}
      className={`relative flex flex-col-reverse gap-px ${u.status === "data" ? "cursor-pointer" : "cursor-default"}`}
      style={{
        height: H,
        opacity: dempet ? 0.55 : 1,
        transition: "opacity 120ms",
      }}
    >
      {u.status === "data" &&
        deler.map((k, i) => (
          <span
            key={k}
            className="w-full flex-none"
            style={{
              height: Math.max(
                2,
                Math.round(((H - (deler.length - 1)) * u[k]) / n),
              ),
              background: FARGE[k],
              borderRadius: i === deler.length - 1 ? "3px 3px 0 0" : undefined,
            }}
          />
        ))}
      {u.status === "kommer" && (
        <span className="h-full w-full rounded-[3px] shadow-[inset_0_0_0_1px_var(--color-linje-medium)]" />
      )}
      {u.status === "ferie" && (
        <span className="h-0.5 w-full rounded-[1px] bg-linje" />
      )}
      {u.na && (
        <span className="absolute -inset-x-0.5 -bottom-[7px] h-0.5 rounded-[1px] bg-aksent" />
      )}
    </div>
  );
}
