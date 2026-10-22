import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  hentSkalaverdier,
  hentVurderingElever,
  type Vurdering,
  type VurderingElev,
} from "../../data/vurderinger";
import {
  endreSamtaledag,
  hentSamtaledager,
  hentSamtaler,
  lagreTrekning,
  tiderITrekning,
  tilKlokke,
  tilMin,
  type Samtale,
  type Samtaledag,
} from "../../data/samtale";
import {
  hentMuntlig,
  hentMuntligResultater,
  hentOppgavekort,
  type Muntligoppsett,
  type Muntligresultat,
  type Oppgavekort,
} from "../../data/muntlig";
import { leggUtTidsplan, type Tidsplandag } from "../../data/tidsplan";
import { lyttVurderinger, varsleVurderinger } from "../../data/endringer";
import type { Skalaverdi } from "../../skala";
import { Bryter, Fagfirkant } from "../../ui/felles";
import { kortDag } from "../../data/vurderingsoversikt";
import { Tidsplanliste } from "./Tidsplanliste";
import { Planlegg } from "./Planlegg";
import { Gjennomfor } from "./Gjennomfor";
import { Resultater } from "./Resultater";
import { kopierTidsplan } from "./eksport";

export type Modus = "plan" | "gj" | "res";

/** Alt arket vet om vurderingen, samlet så fanene kan dele det. */
export type Muntligdata = {
  vurdering: Vurdering;
  skolearId: string;
  oppsett: Muntligoppsett;
  kort: Oppgavekort[];
  elever: VurderingElev[];
  dager: Samtaledag[];
  /** elev → samtalen (den der eleven møtte, om det finnes flere) */
  samtale: Map<string, Samtale>;
  resultater: Map<string, Muntligresultat>;
  verdier: Skalaverdi[];
  /** rekkefølgen i tidsplanen, elev-id-er */
  rekke: string[];
  harPlan: boolean;
};

/**
 * Muntlig vurdering (ARBEIDSLISTE 28.1, lerretet MuntligVurdering): tre
 * faner over samme tidsplan. Planlegg setter opp dager, tider, oppgaver og
 * rubrikk; Gjennomfør er samtalen, elev for elev; Resultater er tabellen
 * etterpå. Tidsplanen står til venstre hele tida.
 */
export function MuntligArk({
  vurdering,
  skolearId,
  onApneElev,
  onLukk,
  onEndret,
}: {
  vurdering: Vurdering;
  skolearId: string;
  onApneElev: (elevId: string) => void;
  onLukk: () => void;
  onEndret: () => void;
}) {
  const [data, setData] = useState<Muntligdata | null>(null);
  const [modus, setModus] = useState<Modus | null>(null);
  const [valgt, setValgt] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState(false);

  const last = useCallback(async () => {
    const [oppsett, kort, elever, alleDager, resultater, verdier] =
      await Promise.all([
        hentMuntlig(vurdering.id),
        hentOppgavekort(vurdering.id),
        hentVurderingElever(vurdering.id, vurdering.skolearFagId),
        hentSamtaledager(skolearId),
        hentMuntligResultater(vurdering.id),
        hentSkalaverdier(vurdering.skalaId),
      ]);
    const dager = alleDager
      .filter((d) => d.vurderingId === vurdering.id)
      .sort((a, b) => (a.dato || "9").localeCompare(b.dato || "9"));
    const alle = (await Promise.all(dager.map((d) => hentSamtaler(d.id))))
      .map((s, i) => s.map((x) => ({ x, dato: dager[i].dato })))
      .flat()
      .sort(
        (a, b) =>
          a.dato.localeCompare(b.dato) ||
          a.x.klokkeslett.localeCompare(b.x.klokkeslett),
      );
    // En tidsplan som er trukket i samtaletrekkeren, har sine egne tider.
    // De gjelder til noe settes her.
    if (!oppsett.egneTider) {
      const t = tiderITrekning(
        dager.map((d) =>
          alle
            .filter(({ x }) => x.samtaledagId === d.id)
            .map(({ x }) => ({
              fra: x.klokkeslett,
              til: tilKlokke(tilMin(x.klokkeslett) + x.varighetMin),
            })),
        ),
      );
      if (t) {
        oppsett.samtaleMin = t.minutter;
        oppsett.pauseMin = t.pause;
      }
    }
    const samtale = new Map<string, Samtale>();
    for (const { x } of alle) {
      const f = samtale.get(x.elevId);
      if (!f || (!f.motte && x.motte)) samtale.set(x.elevId, x);
    }
    const iFaget = new Set(elever.map((e) => e.elevId));
    const rekke = [
      ...new Set(alle.map(({ x }) => x.elevId).filter((id) => iFaget.has(id))),
    ];
    // De som ikke står i planen (nye i faget), legges til sist.
    for (const e of [...elever].sort((a, b) =>
      a.fornavn.localeCompare(b.fornavn, "nb"),
    ))
      if (!rekke.includes(e.elevId)) rekke.push(e.elevId);
    setData({
      vurdering,
      skolearId,
      oppsett,
      kort,
      elever,
      dager,
      samtale,
      resultater,
      verdier,
      rekke,
      harPlan: alle.length > 0,
    });
  }, [vurdering, skolearId]);

  useEffect(() => {
    void last();
  }, [last]);
  useEffect(() => lyttVurderinger(() => void last()), [last]);

  const tpDager: Tidsplandag[] = useMemo(
    () =>
      (data?.dager ?? []).map((d) => ({
        id: d.id,
        dato: d.dato,
        fra: d.fra,
        lunsjFra: d.lunsjFra,
        lunsjMin: d.lunsjMin,
      })),
    [data?.dager],
  );
  const utlagt = useMemo(
    () =>
      data
        ? leggUtTidsplan(
            data.rekke,
            tpDager,
            data.oppsett.samtaleMin,
            data.oppsett.pauseMin,
          )
        : [],
    [data, tpDager],
  );

  // Første gang: Gjennomfør når planen finnes og noen står igjen,
  // Resultater når alle er ført, ellers Planlegg.
  const ferdige = data
    ? data.elever.filter(
        (e) =>
          data.resultater.get(e.elevId)?.skalaverdiId ||
          data.samtale.get(e.elevId)?.motte === false,
      ).length
    : 0;
  useEffect(() => {
    if (!data || modus) return;
    setModus(
      !data.harPlan
        ? "plan"
        : ferdige >= data.elever.length && data.elever.length > 0
          ? "res"
          : "gj",
    );
  }, [data, modus, ferdige]);

  // Gjeldende elev: den første som verken har karakter eller er borte.
  const gjeldende = useMemo(() => {
    if (!data) return null;
    for (const d of utlagt)
      for (const r of d.rader)
        if (
          !data.resultater.get(r.elevId)?.skalaverdiId &&
          data.samtale.get(r.elevId)?.motte !== false
        )
          return r.elevId;
    return utlagt[0]?.rader[0]?.elevId ?? null;
  }, [data, utlagt]);
  // Eleven står til du går videre selv: en karakter flytter ikke valget.
  useEffect(() => {
    if (valgt === null && gjeldende) setValgt(gjeldende);
  }, [valgt, gjeldende]);
  const valgtElev = valgt ?? gjeldende;

  // Lagringene etter hverandre, så raske klikk på − / + ikke krysser.
  const ko = useRef(Promise.resolve());
  const lagrePlan = useCallback(
    (
      rekke: string[],
      tema: (elevId: string) => string | null,
      dager: Tidsplandag[] = tpDager,
      min = data?.oppsett.samtaleMin ?? 12,
      pause = data?.oppsett.pauseMin ?? 3,
    ) => {
      // Vises med en gang; basen følger etter.
      setData((d) => (d ? { ...d, rekke, harPlan: dager.length > 0 } : d));
      ko.current = ko.current.then(async () => {
        const ut = leggUtTidsplan(rekke, dager, min, pause);
        for (const d of ut) {
          await lagreTrekning(
            d.dag.id,
            d.rader.map((r) => ({
              elevId: r.elevId,
              klokkeslett: r.fra,
              varighetMin: min,
              tema: tema(r.elevId),
            })),
          );
          await endreSamtaledag(d.dag.id, { til: d.slutt ?? d.dag.fra });
        }
        varsleVurderinger();
        await last();
      });
      return ko.current;
    },
    [tpDager, data?.oppsett.samtaleMin, data?.oppsett.pauseMin, last],
  );

  if (!data || !modus) return null;
  const v = vurdering;
  const fortsatt = data.elever.length - ferdige;
  const forste = data.dager.find((d) => d.dato)?.dato;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-2.5 px-6 pb-3 pt-1">
        <Fagfirkant farge={v.farge} storrelse={10} />
        <span className="text-[calc(15px*var(--tekst-skala))] font-semibold">
          {v.tittel}
        </span>
        <span className="text-[calc(13px*var(--tekst-skala))] text-blekk-dempet">
          {[v.fagKode, forste ? kortDag(forste) : null, v.skalaNavn]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <span className="ml-2.5">
          <Bryter
            storrelse="liten"
            verdi={modus}
            settVerdi={(m) => setModus(m as Modus)}
            valg={[
              { id: "plan", navn: "Planlegg" },
              { id: "gj", navn: "Gjennomfør" },
              { id: "res", navn: "Resultater" },
            ]}
          />
        </span>
        <span className="flex-1" />
        <span className="rounded-full bg-flate px-2.5 py-0.5 text-liten tabular-nums">
          {data.elever.length - fortsatt} av {data.elever.length} ferdig
        </span>
        <button
          onClick={async () => {
            await kopierTidsplan(data, utlagt);
            setKopiert(true);
            window.setTimeout(() => setKopiert(false), 1500);
          }}
          disabled={!data.harPlan}
          className="h-[30px] rounded-full border border-linje-sterk bg-ark px-3 text-[13px] hover:bg-flate disabled:opacity-40"
        >
          {kopiert ? "Kopiert ✓" : "Kopier tidsplan til Teams"}
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[340px_minmax(0,1fr)] gap-[26px] px-6">
        <div className="min-h-0 overflow-auto pb-5">
          <Tidsplanliste
            data={data}
            utlagt={utlagt}
            modus={modus}
            valgt={modus === "gj" ? valgtElev : null}
            onVelg={(id) => {
              setValgt(id);
              if (modus === "res") setModus("gj");
            }}
            onFlytt={(rekke) =>
              void lagrePlan(rekke, (id) => data.samtale.get(id)?.tema ?? null)
            }
          />
        </div>
        <div className="min-h-0 overflow-auto pb-5">
          {modus === "plan" && (
            <Planlegg
              data={data}
              utlagt={utlagt}
              lagrePlan={lagrePlan}
              last={last}
              onLukk={onLukk}
              onEndret={onEndret}
            />
          )}
          {modus === "gj" && valgtElev && (
            <Gjennomfor
              key={valgtElev}
              data={data}
              utlagt={utlagt}
              elevId={valgtElev}
              onNeste={() => {
                const rekke = utlagt.flatMap((d) =>
                  d.rader.map((r) => r.elevId),
                );
                const i = rekke.indexOf(valgtElev);
                const neste = [
                  ...rekke.slice(i + 1),
                  ...rekke.slice(0, i),
                ].find(
                  (id) =>
                    !data.resultater.get(id)?.skalaverdiId &&
                    data.samtale.get(id)?.motte !== false,
                );
                setValgt(neste ?? null);
              }}
              onApneElev={onApneElev}
              last={last}
            />
          )}
          {modus === "gj" && !valgtElev && (
            <p className="mt-10 text-center text-brod text-blekk-dempet">
              Ingen tidsplan ennå. Sett den opp under Planlegg.
            </p>
          )}
          {modus === "res" && <Resultater data={data} />}
        </div>
      </div>
    </div>
  );
}
