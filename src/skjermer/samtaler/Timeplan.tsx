import { Fragment } from "react";
import { nyPlass, useDra, type Mal } from "../../ui/dra";
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
  // Den felles mekanikken (ui/dra.ts): raden følger musa, og de andre glir
  // unna mens du drar. Gruppene er dagene. Er dagen det slippes på full,
  // bytter de to plass (§4.10), og raden som byttes står markert.
  const {
    dra,
    reg,
    begynn,
    draget,
    erDratt: erDrattP,
    byttesMed: byttesMedP,
    malPlass: malP,
    stil: stilP,
  } = useDra({
    full: (dag) => plan[dag].rader.length >= kapasitetFor(dag),
    nokkel: (p) => plan[p.gruppe]?.rader[p.nr]?.elevId,
    onSlipp: (fra, mal) => utfor({ dag: fra.gruppe, rad: fra.nr }, mal),
  });
  const P = (dag: number, rad: number) => ({ gruppe: dag, nr: rad });
  const erDratt = (dag: number, rad: number) => erDrattP(P(dag, rad));
  const byttesMed = (dag: number, rad: number) => byttesMedP(P(dag, rad));
  const stil = (dag: number, rad: number) => stilP(P(dag, rad));

  /** Slippet: innen dagen, eller til en annen dag. */
  function utfor(fra: { dag: number; rad: number }, mal: Mal) {
    if (mal.gruppe === fra.dag) {
      const til = nyPlass({ gruppe: fra.dag, nr: fra.rad }, mal).nr;
      if (til !== fra.rad)
        onFlytt(fra, { dag: mal.gruppe, rad: til, etter: false });
    } else {
      onFlytt(fra, { dag: mal.gruppe, rad: mal.nr, etter: mal.etter });
    }
  }

  // Plassen raden som dras havner på, og klokkeslettet der. Klokkeslettene
  // står fast mens du drar (de hører til plassene, ikke elevene); raden du
  // drar har sitt eget, som ruller til tida på plassen den er over.
  const malPlass = malP ? { dag: malP.gruppe, rad: malP.nr } : null;
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
    // Luft nederst, og klipt loddrett: kortet som dras og en rad som gjør
    // plass nederst, skal ikke gjøre lista høyere. Ellers vokste den mens
    // det ble dratt (og rulleflata fulgte med) og krympet ved slipp, så
    // vinduet rullet opp et stykke.
    <div
      className="space-y-6 overflow-y-clip pb-16"
      style={{ overflowAnchor: "none" }}
    >
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

          {d.rader.flatMap((r, radIdx) => {
            plass++;
            // Lunsjen er sitt eget element med fast nøkkel. Lå den inne i
            // raden etter, ble den laget på nytt (og blinket) når
            // rekkefølgen endret seg.
            const lunsjHer =
              d.lunsj !== null &&
              r.fra >= d.lunsj.til &&
              (radIdx === 0 || d.rader[radIdx - 1].fra < d.lunsj.fra);

            // Samme elev to ganger i en dag skal ikke skje, men gjør det,
            // må nøklene likevel være unike, ellers blir rader hengende igjen.
            const like = d.rader
              .slice(0, radIdx)
              .filter(
                (x) => x.elevId === r.elevId && x.motte === r.motte,
              ).length;
            // Merknaden bygges på historikken FØR denne trekningen, så den
            // sier noe om hva som har skjedd — ikke om det som nettopp ble
            // trukket.
            const notis = merknad(historikk.get(r.elevId) ?? []);
            const erLast = laste.has(r.elevId);
            return [
              // Nøkkelen er eleven, ikke klokkeslettet: en flytting gir mange
              // rader nytt klokkeslett, og da ble de laget på nytt og blinket.
              // «motte» skiller en som ikke møtte fra samme elev satt opp igjen.
              ...(lunsjHer && d.lunsj
                ? [
                    <div
                      key={`lunsj-${d.dag.id}`}
                      className="flex items-baseline gap-3 border-b border-linje-svak bg-flate py-2 text-brod text-blekk-dempet"
                    >
                      <span className="w-7 shrink-0" />
                      <span className="shrink-0 tabular-nums">
                        {d.lunsj.fra}–{d.lunsj.til}
                      </span>
                      <span className="flex-1">
                        · Lunsj ({tilMin(d.lunsj.til) - tilMin(d.lunsj.fra)}{" "}
                        min)
                      </span>
                    </div>,
                  ]
                : []),
              <Fragment
                key={`${r.elevId}${r.motte ? "" : "-ikke"}${like ? `-${like}` : ""}`}
              >
                <div
                  ref={reg(P(dagIdx, radIdx))}
                  onPointerDown={(e) => !erLast && begynn(e, P(dagIdx, radIdx))}
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
                              dra.mal.gruppe !== dra.fra.gruppe &&
                              dagIdx === dra.fra.gruppe &&
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
                        style={{ transform: `translateY(${dra!.d}px)` }}
                      >
                        <Ticker tekst={malTid} />
                      </span>
                    )}
                  </span>
                  <div
                    data-dra-innhold={r.elevId}
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
              </Fragment>,
            ];
          })}
        </section>
      ))}
    </div>
  );
}
