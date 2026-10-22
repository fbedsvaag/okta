import { useCallback, useEffect, useMemo, useState } from "react";
import {
  hentSkalaverdier,
  hentVurderingElever,
  type Vurdering,
  type VurderingElev,
} from "../../data/vurderinger";
import {
  hentSamtaledager,
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
import {
  lesTidsplan,
  leggUtTidsplan,
  type Tidsplandag,
} from "../../data/tidsplan";
import { lyttVurderinger, varsleVurderinger } from "../../data/endringer";
import type { Skalaverdi } from "../../skala";
import { Bryter, Fagfirkant } from "../../ui/felles";
import { kortDag } from "../../data/vurderingsoversikt";
import { Tidsplanliste } from "../tidsplan/Tidsplanliste";
import { useLagrePlan } from "../tidsplan/bruk";
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
    const plan = await lesTidsplan(dager, elever);
    // En tidsplan som er trukket i samtaletrekkeren, har sine egne tider.
    // De gjelder til noe settes her.
    if (!oppsett.egneTider && plan.tider) {
      oppsett.samtaleMin = plan.tider.minutter;
      oppsett.pauseMin = plan.tider.pause;
    }
    setData({
      vurdering,
      skolearId,
      oppsett,
      kort,
      elever,
      dager,
      samtale: plan.samtale,
      resultater,
      verdier,
      rekke: plan.rekke,
      harPlan: plan.harPlan,
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
        oktId: d.oktId,
        til: d.til,
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

  const lagrePlan = useLagrePlan({
    dager: tpDager,
    min: data?.oppsett.samtaleMin ?? 12,
    pause: data?.oppsett.pauseMin ?? 3,
    vis: (rekke, harPlan) => setData((d) => (d ? { ...d, rekke, harPlan } : d)),
    etter: async () => {
      varsleVurderinger();
      await last();
    },
  });

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
            utlagt={utlagt}
            navn={
              new Map(
                data.elever.map((e) => [
                  e.elevId,
                  `${e.fornavn} ${e.etternavn}`,
                ]),
              )
            }
            min={data.oppsett.samtaleMin}
            pause={data.oppsett.pauseMin}
            kanDra={modus === "plan" && data.harPlan}
            rad={(id) => {
              const s = data.samtale.get(id);
              const r = data.resultater.get(id);
              const kar = r?.skalaverdiId
                ? data.verdier.find((x) => x.id === r.skalaverdiId)
                : undefined;
              const borte = s?.motte === false;
              return {
                under: borte ? "møtte ikke" : (s?.tema ?? ""),
                merke: kar?.kode ?? (borte ? "–" : ""),
                fylt: !!kar,
                borte,
              };
            }}
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
