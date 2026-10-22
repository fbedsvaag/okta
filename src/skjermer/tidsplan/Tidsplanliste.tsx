import { flytt, type Utlagtdag } from "../../data/tidsplan";
import { nyPlass, useDra, type Mal } from "../../ui/dra";
import { langDato } from "../samtaler/deler";
import type { ReactNode } from "react";
import { Ticker } from "../../ui/Ticker";

/** Det som står på raden for en elev, utenom tida og navnet. */
export type Radinfo = {
  /** liten linje under navnet: oppgaven, «med foresatt», «møtte ikke» */
  under: string;
  /** ruta til høyre: karakteren, ✓, tom rute; null = ingen rute */
  merke: ReactNode | null;
  /** merket er fylt (en karakter, en hake) */
  fylt: boolean;
  /** eleven møtte ikke: navnet streket over */
  borte: boolean;
};

/**
 * Tidsplanen til venstre i muntlig vurdering og mentorsamtalene (28.2b,
 * 28.3, 29.6). I Planlegg kan rekkefølgen dras (⋮⋮) med samtaletimeplanens
 * dra-mekanikk, og tidene følger med. Ellers er dra skrudd av, og et klikk
 * velger eleven.
 */
export function Tidsplanliste({
  utlagt,
  navn,
  min,
  pause,
  kanDra,
  valgt,
  rad,
  onVelg,
  onFlytt,
}: {
  utlagt: Utlagtdag[];
  navn: Map<string, string>;
  min: number;
  pause: number;
  kanDra: boolean;
  valgt: string | null;
  rad: (elevId: string) => Radinfo;
  onVelg: (elevId: string) => void;
  onFlytt: (rekke: string[]) => void;
}) {
  const flat = utlagt.flatMap((d) => d.rader.map((r) => r.elevId));
  const start = (dag: number) =>
    utlagt.slice(0, dag).reduce((n, d) => n + d.rader.length, 0);

  const { dra, reg, begynn, draget, stil, erDratt, malPlass } = useDra({
    nokkel: (p) => utlagt[p.gruppe]?.rader[p.nr]?.elevId,
    onSlipp: (fra, mal: Mal) => {
      const til = nyPlass(fra, mal);
      const a = start(fra.gruppe) + fra.nr;
      let b = start(til.gruppe) + til.nr;
      if (til.gruppe > fra.gruppe) b -= 1;
      if (a !== b) onFlytt(flytt(flat, a, Math.max(0, b)));
    },
  });

  // Klokkeslettene hører til plassene og står fast mens du drar. Plassen
  // raden havner på, skjuler sitt; raden du drar viser det i stedet, og det
  // ruller som et telleverk (samtaletimeplanen, 7.x).
  const malTid = malPlass
    ? (utlagt[malPlass.gruppe]?.rader[malPlass.nr] ??
      utlagt[malPlass.gruppe]?.rader[malPlass.nr - 1])
    : undefined;

  if (utlagt.length === 0)
    return (
      <p className="mx-1 mt-1 text-liten text-blekk-svak">
        Ingen dager ennå. Legg til en dag under Planlegg, så legges elevene ut
        her.
      </p>
    );

  return (
    <div>
      {utlagt.map((d, di) => (
        <div key={d.dag.id} className="mb-3">
          <div className="mx-1 mb-2.5 mt-0.5 flex items-center gap-2">
            <b className="whitespace-nowrap text-[13px] font-semibold first-letter:uppercase">
              {langDato(d.dag.dato)}
            </b>
            <span className="truncate text-liten text-blekk-svak tabular-nums">
              {d.dag.fra}
              {d.slutt ? `–${d.slutt}` : ""} · {min} min
              {pause ? ` + ${pause} min pause` : ""}
            </span>
          </div>
          {d.rader.map((r, ri) => {
            const info = rad(r.elevId);
            const borte = info.borte;
            const erValgt = valgt === r.elevId;
            // Lunsjen står foran den første samtalen etter den.
            const lunsjHer =
              d.lunsj &&
              r.fra >= d.lunsj.til &&
              (ri === 0 || d.rader[ri - 1].fra < d.lunsj.fra);
            return (
              <div key={r.elevId}>
                {lunsjHer && d.lunsj && (
                  <Lunsj fra={d.lunsj.fra} til={d.lunsj.til} />
                )}
                <div
                  ref={reg({ gruppe: di, nr: ri })}
                  onPointerDown={
                    kanDra
                      ? (e) => begynn(e, { gruppe: di, nr: ri })
                      : undefined
                  }
                  onClick={() => {
                    if (draget.current) return;
                    onVelg(r.elevId);
                  }}
                  className={`group relative grid h-11 cursor-pointer select-none items-center gap-2.5 rounded-[10px] px-2.5 text-[calc(13.5px*var(--tekst-skala))] transition-[background-color,box-shadow] duration-200 ${
                    kanDra
                      ? "touch-none grid-cols-[14px_96px_minmax(0,1fr)]"
                      : "grid-cols-[96px_minmax(0,1fr)]"
                  } ${
                    erValgt
                      ? "bg-ark shadow-[inset_0_0_0_1.5px_var(--color-aksent),0_4px_14px_rgba(74,61,125,.12)]"
                      : dra
                        ? ""
                        : "hover:bg-flate-svak"
                  }`}
                >
                  {kanDra && (
                    <span
                      aria-hidden
                      className="cursor-grab text-[12px] leading-none tracking-[-2px] text-blekk-svakest opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                    >
                      ⋮⋮
                    </span>
                  )}
                  {/* Tida står på plassen, ikke på eleven. */}
                  <span className="relative text-[12.5px] tabular-nums text-blekk-dempet">
                    <span
                      className={
                        dra && malPlass?.gruppe === di && malPlass.nr === ri
                          ? "opacity-0"
                          : ""
                      }
                    >
                      {r.fra}–{r.til}
                    </span>
                    {erDratt({ gruppe: di, nr: ri }) && malTid && (
                      <span
                        className="absolute left-0 top-0 z-30 font-medium text-aksent"
                        style={{ transform: `translateY(${dra!.d}px)` }}
                      >
                        <Ticker tekst={`${malTid.fra}–${malTid.til}`} />
                      </span>
                    )}
                  </span>
                  <div
                    data-dra-innhold={r.elevId}
                    style={kanDra ? stil({ gruppe: di, nr: ri }) : undefined}
                    className={`grid min-w-0 grid-cols-[minmax(0,1fr)_34px] items-center gap-2.5 ${
                      erDratt({ gruppe: di, nr: ri })
                        ? "relative z-20 -my-1.5 -ml-2 rounded-[10px] bg-ark py-1.5 pl-2 shadow-[var(--shadow-ark)]"
                        : ""
                    }`}
                  >
                    <span
                      className={`min-w-0 truncate ${
                        borte
                          ? "text-blekk-svakest line-through"
                          : info.fylt
                            ? "text-blekk-dempet"
                            : ""
                      }`}
                    >
                      {navn.get(r.elevId) ?? "?"}
                      <small className="mt-px block truncate text-[11.5px] text-blekk-svak no-underline">
                        {info.under}
                      </small>
                    </span>
                    {info.merke === null ? (
                      <span />
                    ) : info.fylt && info.merke === "✓" ? (
                      <span className="inline-grid h-[22px] w-[22px] place-items-center justify-self-center rounded-full bg-aksent text-[11px] text-ark">
                        ✓
                      </span>
                    ) : (
                      <span
                        className={`inline-grid h-7 w-7 place-items-center rounded-lg text-[13px] font-semibold ${
                          info.fylt
                            ? "bg-flate"
                            : "shadow-[inset_0_0_0_1.5px_var(--color-linje)] [border-style:dashed]"
                        }`}
                      >
                        {info.merke}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
      {kanDra && (
        <p className="mx-1.5 my-3 text-liten text-blekk-svak">
          Dra i ⋮⋮ for å endre rekkefølgen. Tidene står på plassene.
        </p>
      )}
    </div>
  );
}

function Lunsj({ fra, til }: { fra: string; til: string }) {
  return (
    <div className="flex h-[30px] items-center gap-2.5 px-2.5 text-liten tabular-nums text-blekk-svak after:h-px after:flex-1 after:bg-linje-svak">
      {fra}–{til} lunsj
    </div>
  );
}
