import { Fragment, useRef, useState } from "react";
import { useArk } from "../../ui/Arkstabel";
import {
  merknad,
  tilKlokke,
  tilMin,
  type Plassering,
  type Samtaledag,
} from "../../data/samtale";
import { type Elevnotat } from "../../data/elevnotat";
import { Ikon, Kappet } from "../../ui/felles";
import { Elevfoto } from "../../ui/Elevfoto";
import { Ticker } from "../../ui/Ticker";
import { Temarute, langDato } from "./deler";
import { ELEVDRAG, type Dagplan } from "./deler";

/**
 * Timeplanen: én bolk per dag, én rad per samtale.
 *
 * Plassnummeret løper sammenhengende over alle dagene — dag 2 fortsetter der
 * dag 1 sluttet (§4.10).
 */
export function Timeplan({
  plan,
  historikk,
  laste,
  notater,
  temaer,
  kapasitetFor,
  onLas,
  onMotte,
  onApneNotat,
  onFlytt,
  onFlyttElev,
}: {
  plan: Dagplan[];
  historikk: Map<string, Plassering[]>;
  laste: ReadonlySet<string>;
  notater: Map<string, Elevnotat>;
  /** temalista fra oppsettet, så oppgavenummeret blir det samme som der */
  temaer: string[];
  onLas: (elevId: string) => void;
  /** «møtte ikke» av og på for en samtale */
  onMotte: (rad: Dagplan["rader"][number]) => void;
  /** hvor mange plasser dagen har, etter plassen i planen */
  kapasitetFor: (planIdx: number) => number;
  /** et klikk på navnet: notatet fra samtalen */
  onApneNotat: (rad: Dagplan["rader"][number], dag: Samtaledag) => void;
  onFlytt: (
    fra: { dag: number; rad: number },
    til: { dag: number; rad: number; etter: boolean },
  ) => void;
  /** en elev dras fra sin gruppe over på en annen plass */
  onFlyttElev: (elevId: string, dag: number, rad: number) => void;
}) {
  // Et navn i en gruppe åpner elevkortet som et ark over timeplanen. En
  // enkeltsamtale åpner notatet fra samtalen.
  const ark = useArk();
  let plass = 0;

  // ------------------------------------------------------------ dra
  //
  // Raden følger musa, og de andre glir unna mens du drar — du ser hvor den
  // havner før du slipper. Posisjonene måles én gang når draget begynner;
  // forskyvningene regnes ut fra dem, ikke fra en DOM som flytter seg.
  // Nederste halvdel av en rad betyr «etter denne». Er dagen det slippes på
  // full, bytter de to plass (§4.10), og raden som byttes står markert.
  type Mal = { dag: number; rad: number; etter: boolean; bytt: boolean };
  const [dra, setDra] = useState<{
    fra: { dag: number; rad: number };
    dy: number;
    h: number;
    mal: Mal | null;
  } | null>(null);
  const radEl = useRef(new Map<string, HTMLElement>());
  const malt = useRef<
    { dag: number; rad: number; top: number; bunn: number }[]
  >([]);
  const draget = useRef(false);
  // Målet slik det sto sist pekeren flyttet seg — det er dit eleven går.
  const sisteMal = useRef<Mal | null>(null);

  function begynnDra(e: React.PointerEvent, fra: { dag: number; rad: number }) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-ikke-dra], input, textarea"))
      return;
    const startY = e.clientY;
    const startX = e.clientX;
    let pekerY = startY;
    let aktiv = false;
    let h = 0;
    // Rullesonen timeplanen står i. Drar du mot kanten, ruller den, og
    // rullingen regnes inn: posisjonene ble målt før den begynte.
    const sone = (e.currentTarget as HTMLElement).closest<HTMLElement>(
      ".overflow-auto",
    );
    const startRull = sone?.scrollTop ?? 0;
    let ramme = 0;

    const oppdater = () => {
      const rullet = (sone?.scrollTop ?? 0) - startRull;
      const mal = finnMal(pekerY + rullet, fra);
      sisteMal.current = mal;
      setDra({ fra, dy: pekerY - startY + rullet, h, mal });
    };

    const rull = () => {
      ramme = 0;
      if (!aktiv || !sone) return;
      const r = sone.getBoundingClientRect();
      const kant = 48;
      const fart =
        pekerY < r.top + kant
          ? -Math.ceil((r.top + kant - pekerY) / 4)
          : pekerY > r.bottom - kant
            ? Math.ceil((pekerY - (r.bottom - kant)) / 4)
            : 0;
      if (fart === 0) return;
      sone.scrollTop += fart;
      oppdater();
      ramme = requestAnimationFrame(rull);
    };

    const flytt = (ev: PointerEvent) => {
      pekerY = ev.clientY;
      if (!aktiv) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return;
        aktiv = true;
        draget.current = true;
        malt.current = [...radEl.current].map(([k, el]) => {
          const [dag, rad] = k.split(":").map(Number);
          const r = el.getBoundingClientRect();
          return { dag, rad, top: r.top, bunn: r.bottom };
        });
        const egen = malt.current.find(
          (m) => m.dag === fra.dag && m.rad === fra.rad,
        );
        h = egen ? egen.bunn - egen.top : 0;
      }
      oppdater();
      if (!ramme) ramme = requestAnimationFrame(rull);
    };

    const slipp = () => {
      window.removeEventListener("pointermove", flytt);
      window.removeEventListener("pointerup", slipp);
      window.removeEventListener("pointercancel", slipp);
      if (ramme) cancelAnimationFrame(ramme);
      // Utføres her, ikke i en state-oppdatering: React kan kjøre dem to
      // ganger, og da ville eleven blitt flyttet to ganger.
      const mal = sisteMal.current;
      sisteMal.current = null;
      setDra(null);
      if (aktiv && mal) utfor(fra, mal);
      // Klikket som kommer etter slippet, skal ikke åpne notatet.
      window.setTimeout(() => (draget.current = false), 0);
    };

    window.addEventListener("pointermove", flytt);
    window.addEventListener("pointerup", slipp);
    window.addEventListener("pointercancel", slipp);
  }

  function finnMal(y: number, fra: { dag: number; rad: number }): Mal | null {
    const andre = malt.current
      .filter((m) => !(m.dag === fra.dag && m.rad === fra.rad))
      .sort((a, b) => a.top - b.top);
    if (andre.length === 0) return null;
    // Raden pekeren står over, eller den nærmeste.
    const over =
      andre.find((m) => y >= m.top && y < m.bunn) ??
      andre.reduce((best, m) =>
        Math.abs((m.top + m.bunn) / 2 - y) <
        Math.abs((best.top + best.bunn) / 2 - y)
          ? m
          : best,
      );
    const etter = y > (over.top + over.bunn) / 2;
    const bytt =
      over.dag !== fra.dag &&
      plan[over.dag].rader.length >= kapasitetFor(over.dag);
    return { dag: over.dag, rad: over.rad, etter: bytt ? false : etter, bytt };
  }

  /** Slippet: samme regler som før — innen dagen, eller til en annen dag. */
  function utfor(fra: { dag: number; rad: number }, mal: Mal) {
    if (mal.dag === fra.dag) {
      const t = mal.etter ? mal.rad + 1 : mal.rad;
      const til = t > fra.rad ? t - 1 : t;
      if (til !== fra.rad)
        onFlytt(fra, { dag: mal.dag, rad: til, etter: false });
    } else {
      onFlytt(fra, mal);
    }
  }

  /** Hvor langt en rad skal gli for å gi plass, mens det dras. */
  function forskyvning(dag: number, rad: number): number {
    if (!dra?.mal || dra.mal.bytt) return 0;
    const { fra, mal, h } = dra;
    const t = mal.etter ? mal.rad + 1 : mal.rad;
    if (mal.dag === fra.dag) {
      if (dag !== fra.dag) return 0;
      if (t > fra.rad) return rad > fra.rad && rad < t ? -h : 0;
      return rad >= t && rad < fra.rad ? h : 0;
    }
    if (dag === fra.dag && rad > fra.rad) return -h;
    if (dag === mal.dag && rad >= t) return h;
    return 0;
  }

  function erDratt(dag: number, rad: number): boolean {
    return dra !== null && dra.fra.dag === dag && dra.fra.rad === rad;
  }

  function byttesMed(dag: number, rad: number): boolean {
    return !!dra?.mal?.bytt && dra.mal.dag === dag && dra.mal.rad === rad;
  }

  function stil(dag: number, rad: number): React.CSSProperties | undefined {
    if (!dra) return undefined;
    if (erDratt(dag, rad))
      return { transform: `translateY(${dra.dy}px)`, transition: "none" };
    return {
      transform: `translateY(${forskyvning(dag, rad)}px)`,
      transition: "transform var(--tid-inn) var(--ease-inn)",
    };
  }

  // Plassen raden som dras havner på, og klokkeslettet der. Klokkeslettene
  // står fast mens du drar (de hører til plassene, ikke elevene); raden du
  // drar har sitt eget, som ruller til tida på plassen den er over.
  const malPlass = ((): { dag: number; rad: number } | null => {
    if (!dra?.mal) return dra ? dra.fra : null;
    const { fra, mal } = dra;
    if (mal.bytt) return { dag: mal.dag, rad: mal.rad };
    const t = mal.etter ? mal.rad + 1 : mal.rad;
    if (mal.dag === fra.dag)
      return { dag: fra.dag, rad: t > fra.rad ? t - 1 : t };
    return { dag: mal.dag, rad: t };
  })();
  function tidPa(dag: number, rad: number): string {
    const r = plan[dag].rader;
    if (rad < r.length) return r[rad].fra;
    // Etter den siste: samme lengde og pause som raden før.
    const siste = r[r.length - 1];
    if (!siste) return plan[dag].dag.fra;
    const pause =
      r.length >= 2 ? tilMin(siste.fra) - tilMin(r[r.length - 2].til) : 0;
    return tilKlokke(tilMin(siste.til) + Math.max(0, pause));
  }
  const malTid = malPlass ? tidPa(malPlass.dag, malPlass.rad) : null;

  return (
    <div className="space-y-6">
      {plan.map((d, dagIdx) => (
        <section key={d.dag.id}>
          {/* Dagen i Light (DESIGN.md §10), med tid og antall ved siden av. */}
          <div className="flex flex-wrap items-baseline gap-x-3 border-b border-linje pb-2">
            <h2 className="text-[calc(26px*var(--tekst-skala))] font-light leading-tight tracking-overskrift first-letter:uppercase">
              {langDato(d.dag.dato)}
            </h2>
            <span className="text-liten tabular-nums text-blekk-dempet">
              {d.dag.fra}–{d.dag.til} ·{" "}
              {d.rader.reduce((n, r) => n + r.medlemmer.length, 0)} elever
              {d.rader.some((r) => r.medlemmer.length > 1) &&
                ` i ${d.rader.length} grupper`}
              {d.dag.oktId && " · økt"}
            </span>
          </div>

          {d.rader.map((r, radIdx) => {
            plass++;
            // Lunsjen står på sin plass i rekka: rett før den første samtalen
            // som begynner etter at pausen er over.
            const lunsjHer =
              d.lunsj !== null &&
              r.fra >= d.lunsj.til &&
              (radIdx === 0 || d.rader[radIdx - 1].fra < d.lunsj.fra);
            // Merknaden bygges på historikken FØR denne trekningen, så den
            // sier noe om hva som har skjedd — ikke om det som nettopp ble
            // trukket.
            const notis = merknad(historikk.get(r.elevId) ?? []);
            const erLast = laste.has(r.elevId);
            return (
              // Nøkkelen er eleven, ikke klokkeslettet: en flytting gir mange
              // rader nytt klokkeslett, og da ble de laget på nytt og blinket.
              // «motte» skiller en som ikke møtte fra samme elev satt opp igjen.
              <Fragment key={`${r.elevId}${r.motte ? "" : "-ikke"}`}>
                {lunsjHer && d.lunsj && (
                  <div className="flex items-baseline gap-3 border-b border-linje-svak bg-flate py-2 text-brod text-blekk-dempet">
                    <span className="w-7 shrink-0" />
                    <span className="shrink-0 tabular-nums">
                      {d.lunsj.fra}–{d.lunsj.til}
                    </span>
                    <span className="flex-1">
                      · Lunsj ({tilMin(d.lunsj.til) - tilMin(d.lunsj.fra)} min)
                    </span>
                  </div>
                )}
                <div
                  ref={(el) => {
                    const k = `${dagIdx}:${radIdx}`;
                    if (el) radEl.current.set(k, el);
                    else radEl.current.delete(k);
                  }}
                  onPointerDown={(e) =>
                    !erLast && begynnDra(e, { dag: dagIdx, rad: radIdx })
                  }
                  // Et navn dratt ut av en gruppe: eleven flyttes hit.
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const elev = e.dataTransfer.getData(ELEVDRAG);
                    if (elev) onFlyttElev(elev, dagIdx, radIdx);
                  }}
                  className={`relative flex touch-none select-none items-center gap-3 border-b border-linje-svak py-2 text-brod ${
                    r.motte ? "" : "opacity-55"
                  } ${
                    erLast
                      ? "bg-flate-svak"
                      : dra
                        ? "cursor-grabbing"
                        : "cursor-grab hover:bg-flate-svak"
                  } ${
                    byttesMed(dagIdx, radIdx)
                      ? "bg-valgt ring-1 ring-inset ring-aksent"
                      : ""
                  }`}
                >
                  <span className="w-7 shrink-0 text-right text-liten tabular-nums text-blekk-svak">
                    {plass}
                  </span>
                  {/* Bare starttida: slutten er neste rad (§4.10). Står fast
                      mens det dras; plassen raden havner på, skjuler sin, og
                      raden som dras viser den i stedet, rullende. */}
                  <span
                    className="relative w-14 shrink-0 tabular-nums"
                    title={`${r.fra}–${r.til}`}
                  >
                    <span
                      className={
                        dra &&
                        malPlass?.dag === dagIdx &&
                        malPlass.rad === radIdx
                          ? "opacity-0"
                          : dra &&
                              dra.mal &&
                              !dra.mal.bytt &&
                              dra.mal.dag !== dra.fra.dag &&
                              dagIdx === dra.fra.dag &&
                              radIdx === d.rader.length - 1
                            ? "opacity-30"
                            : ""
                      }
                    >
                      {r.fra}
                    </span>
                    {erDratt(dagIdx, radIdx) && malTid && (
                      <span
                        className="absolute left-0 top-0 z-30 font-medium text-aksent"
                        style={{ transform: `translateY(${dra!.dy}px)` }}
                      >
                        <Ticker tekst={malTid} />
                      </span>
                    )}
                  </span>
                  <div
                    style={stil(dagIdx, radIdx)}
                    className={`flex min-w-0 flex-1 items-center gap-3 ${
                      erDratt(dagIdx, radIdx)
                        ? "relative z-20 -my-2 -ml-2 rounded-vanlig bg-ark py-2 pl-2 shadow-[var(--shadow-ark)]"
                        : ""
                    }`}
                  >
                    {r.medlemmer.length > 1 ? (
                      <span className="flex min-w-0 flex-1 flex-wrap gap-1">
                        {r.medlemmer.map((m) => (
                          <span
                            key={m.id}
                            data-ikke-dra
                            draggable={!erLast}
                            onDragStart={(e) => {
                              // Navnet, ikke hele raden: raden har sitt eget drag.
                              e.stopPropagation();
                              e.dataTransfer.setData(ELEVDRAG, m.id);
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onClick={() => ark.apneElev(m.id)}
                            title="Klikk for elevkortet, dra til en annen gruppe"
                            className={`cursor-pointer rounded-full bg-flate px-2 py-px hover:bg-linje-medium ${erLast ? "" : "active:cursor-grab"}`}
                          >
                            {m.navn}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          // Musa ble sluppet etter et drag: det var ikke et klikk.
                          if (draget.current) return;
                          if (r.samtaleId) onApneNotat(r, d.dag);
                          else if (r.medlemmer[0])
                            ark.apneElev(r.medlemmer[0].id);
                        }}
                        title={
                          r.samtaleId
                            ? (notater.get(r.elevId)?.tekst ??
                              "Skriv notat fra samtalen")
                            : undefined
                        }
                        className={`flex min-w-0 flex-1 items-center gap-2 text-left font-medium hover:text-aksent ${
                          r.motte ? "" : "line-through"
                        }`}
                      >
                        <Elevfoto
                          elevId={r.medlemmer[0]?.id ?? r.elevId}
                          storrelse={24}
                        />
                        <Kappet verdi={r.navn} />
                      </button>
                    )}
                    {r.tema && (
                      <span
                        title={r.tema}
                        className="flex w-6 min-w-0 shrink-0 items-center gap-3 @xl:w-44 @3xl:w-60"
                      >
                        {/* Oppgavenummeret som liten rute i temafargen. */}
                        {temaer.indexOf(r.tema) >= 0 && (
                          <Temarute nr={temaer.indexOf(r.tema) + 1} />
                        )}
                        <Kappet verdi={r.tema} klasse="hidden @xl:block" />
                      </span>
                    )}
                    <span className="hidden w-28 shrink-0 text-right text-liten text-blekk-dempet @3xl:block">
                      {r.motte ? notis : "møtte ikke"}
                    </span>
                    {r.samtaleId && r.medlemmer.length === 1 ? (
                      <button
                        data-ikke-dra
                        onClick={() => onApneNotat(r, d.dag)}
                        title={
                          notater.has(r.elevId)
                            ? "Notatet fra samtalen"
                            : "Ta notat fra samtalen"
                        }
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-vanlig ${
                          notater.has(r.elevId)
                            ? "text-aksent hover:bg-flate"
                            : "text-blekk-svakest hover:bg-flate hover:text-blekk"
                        }`}
                      >
                        <Ikon
                          navn={notater.has(r.elevId) ? "notat-fylt" : "notat"}
                        />
                      </button>
                    ) : (
                      <span className="w-7 shrink-0" />
                    )}
                    <button
                      data-ikke-dra
                      onClick={() => onLas(r.elevId)}
                      title={
                        erLast
                          ? "Lås opp: eleven trekkes om igjen"
                          : "Lås: eleven beholder plass og tema"
                      }
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-vanlig ${
                        erLast
                          ? "text-blekk"
                          : "text-blekk-svakest hover:bg-flate hover:text-blekk"
                      }`}
                    >
                      <Ikon navn={erLast ? "las-fylt" : "apen-las"} />
                    </button>
                    {r.samtaleId && r.medlemmer.length === 1 ? (
                      <button
                        data-ikke-dra
                        onClick={() => onMotte(r)}
                        aria-pressed={!r.motte}
                        title={
                          r.motte
                            ? "Møtte ikke: raden blir stående med klokkeslettet sitt"
                            : "Møtte likevel"
                        }
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-vanlig ${
                          r.motte
                            ? "text-blekk-svakest hover:bg-flate hover:text-blekk"
                            : "text-feil"
                        }`}
                      >
                        <Ikon navn="motte-ikke" />
                      </button>
                    ) : (
                      <span className="w-7 shrink-0" />
                    )}
                  </div>
                </div>
              </Fragment>
            );
          })}
        </section>
      ))}
    </div>
  );
}
