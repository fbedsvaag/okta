import { flytt, type Utlagtdag } from "../../data/tidsplan";
import { nyPlass, useDra, type Mal } from "../../ui/dra";
import { langDato } from "../samtaler/deler";
import type { Modus, Muntligdata } from "./MuntligArk";

/**
 * Tidsplanen til venstre i muntlig vurdering (28.2b, 28.3). I Planlegg kan
 * rekkefølgen dras (⋮⋮) med samtaletimeplanens dra-mekanikk, og tidene
 * følger med. I Gjennomfør er dra skrudd av, og et klikk velger eleven.
 */
export function Tidsplanliste({
  data,
  utlagt,
  modus,
  valgt,
  onVelg,
  onFlytt,
}: {
  data: Muntligdata;
  utlagt: Utlagtdag[];
  modus: Modus;
  valgt: string | null;
  onVelg: (elevId: string) => void;
  onFlytt: (rekke: string[]) => void;
}) {
  const kanDra = modus === "plan" && data.harPlan;
  const flat = utlagt.flatMap((d) => d.rader.map((r) => r.elevId));
  const start = (dag: number) =>
    utlagt.slice(0, dag).reduce((n, d) => n + d.rader.length, 0);

  const { reg, begynn, draget, stil } = useDra({
    nokkel: (p) => utlagt[p.gruppe]?.rader[p.nr]?.elevId,
    onSlipp: (fra, mal: Mal) => {
      const til = nyPlass(fra, mal);
      const a = start(fra.gruppe) + fra.nr;
      let b = start(til.gruppe) + til.nr;
      if (til.gruppe > fra.gruppe) b -= 1;
      if (a !== b) onFlytt(flytt(flat, a, Math.max(0, b)));
    },
  });

  const navn = new Map(
    data.elever.map((e) => [e.elevId, `${e.fornavn} ${e.etternavn}`]),
  );
  const verdi = new Map(data.verdier.map((v) => [v.id, v]));

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
              {d.slutt ? `–${d.slutt}` : ""} · {data.oppsett.samtaleMin} min
              {data.oppsett.pauseMin
                ? ` + ${data.oppsett.pauseMin} min pause`
                : ""}
            </span>
          </div>
          {d.rader.map((r, ri) => {
            const s = data.samtale.get(r.elevId);
            const res = data.resultater.get(r.elevId);
            const kar = res?.skalaverdiId ? verdi.get(res.skalaverdiId) : null;
            const borte = s?.motte === false;
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
                >
                  <div
                    data-dra-innhold={r.elevId}
                    style={kanDra ? stil({ gruppe: di, nr: ri }) : undefined}
                    onClick={() => {
                      if (draget.current) return;
                      onVelg(r.elevId);
                    }}
                    className={`grid h-11 cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 text-[calc(13.5px*var(--tekst-skala))] transition-[background-color,box-shadow] duration-200 ${
                      kanDra
                        ? "grid-cols-[14px_96px_minmax(0,1fr)_34px]"
                        : "grid-cols-[96px_minmax(0,1fr)_34px]"
                    } ${
                      erValgt
                        ? "bg-ark shadow-[inset_0_0_0_1.5px_var(--color-aksent),0_4px_14px_rgba(74,61,125,.12)]"
                        : "hover:bg-flate-svak"
                    }`}
                  >
                    {kanDra && (
                      <span
                        aria-hidden
                        className="cursor-grab text-[12px] leading-none tracking-[-2px] text-blekk-svakest"
                      >
                        ⋮⋮
                      </span>
                    )}
                    <span className="text-[12.5px] tabular-nums text-blekk-dempet">
                      {r.fra}–{r.til}
                    </span>
                    <span
                      className={`min-w-0 truncate ${
                        borte
                          ? "text-blekk-svakest line-through"
                          : kar
                            ? "text-blekk-dempet"
                            : ""
                      }`}
                    >
                      {navn.get(r.elevId) ?? "?"}
                      <small className="mt-px block truncate text-[11.5px] text-blekk-svak no-underline">
                        {borte ? "møtte ikke" : (s?.tema ?? "")}
                      </small>
                    </span>
                    <span
                      className={`inline-grid h-7 w-7 place-items-center rounded-lg text-[13px] font-semibold ${
                        kar
                          ? "bg-flate"
                          : "shadow-[inset_0_0_0_1.5px_var(--color-linje)] [border-style:dashed]"
                      }`}
                    >
                      {kar?.kode ?? (borte ? "–" : "")}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
      {modus === "plan" && data.harPlan && (
        <p className="mx-1.5 my-3 text-liten text-blekk-svak">
          Dra i ⋮⋮ for å endre rekkefølgen. Tidene følger med.
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
