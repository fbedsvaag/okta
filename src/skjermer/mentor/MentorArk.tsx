import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { confirm as bekreft } from "@tauri-apps/plugin-dialog";
import {
  hentSamtaledager,
  opprettSamtaledag,
  settMotte,
  type Samtaledag,
} from "../../data/samtale";
import {
  delMal,
  endreRunde,
  hentDetaljer,
  hentElevoversikt,
  hentMal,
  hentMentorelever,
  hentRunder,
  hentSamtalensNotat,
  leggTilMal,
  settForesatt,
  settGuideStilt,
  settNadd,
  hentMentorklasse,
  slettMal,
  slettRunde,
  type Elevoversikt,
  type Samtaledetaljer,
  type Samtalemal,
  type Samtalerunde,
} from "../../data/samtalerunde";
import {
  framdrift,
  leggUtTidsplan,
  dagrekkefolge,
  lesTidsplan,
  type Lesttidsplan,
  type Utlagtdag,
} from "../../data/tidsplan";
import { endreElevnotat, opprettElevnotat } from "../../data/elevnotat";
import {
  fjernOnske,
  hentOnsker,
  leggTilOnske,
  type Onske,
} from "../../data/onsker";
import { lyttVurderinger, varsleVurderinger } from "../../data/endringer";
import { idag } from "../../db";
import { Bryter } from "../../ui/felles";
import { Elevfoto } from "../../ui/Elevfoto";
import { Notat } from "../../ui/Notat";
import { Velger } from "../../ui/Velger";
import { tast as visTast } from "../../ui/taster";
import { kortDag, MENTORORD } from "../../data/vurderingsoversikt";
import { Generator, iDag, tilTidsplandager } from "../tidsplan/Generator";
import { Tidsplanliste } from "../tidsplan/Tidsplanliste";
import { useLagrePlan } from "../tidsplan/bruk";
import { somMarkdown, somTeamsHtml } from "../../data/samtale";

type Modus = "plan" | "gj" | "sum";

type Mentorelev = { elevId: string; fornavn: string; etternavn: string };

/**
 * Mentorsamtalene i ny stil (ARBEIDSLISTE 29.6, lerretet Kontaktsamtaler):
 * samme skall som muntlig vurdering. Planlegg (samme generator) ·
 * Gjennomfør (guide, notat, mål, ønsker, en liten oversikt) ·
 * Oppsummering. Ingen karakter.
 *
 * Notatene, målene og ønskene er bare lærerens. De vises aldri i fag,
 * eksport, utskrift, Teams eller kalender; tidsplanen til Teams har bare
 * navn og tider.
 */
export function MentorArk({
  rundeId,
  skolearId,
  onLukk,
  onApneElev,
}: {
  rundeId: string;
  skolearId: string;
  onLukk: () => void;
  onApneElev: (elevId: string) => void;
}) {
  const [runde, setRunde] = useState<Samtalerunde | null>(null);
  const [dager, setDager] = useState<Samtaledag[]>([]);
  const [elever, setElever] = useState<Mentorelev[]>([]);
  const [plan, setPlan] = useState<Lesttidsplan | null>(null);
  const [detaljer, setDetaljer] = useState<Map<string, Samtaledetaljer>>(
    new Map(),
  );
  const [modus, setModus] = useState<Modus | null>(null);
  const [valgt, setValgt] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState(false);
  const [naa, setNaa] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNaa(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Klassen til mentorgruppa i arkhodet, når alle går i samme (29.6).
  const [klasse, setKlasse] = useState<string | null>(null);
  useEffect(() => {
    void hentMentorklasse(skolearId).then(setKlasse);
  }, [skolearId]);

  const last = useCallback(async () => {
    const [r, alle, e] = await Promise.all([
      hentRunder(skolearId),
      hentSamtaledager(skolearId),
      hentMentorelever(skolearId),
    ]);
    const d = alle
      .filter((x) => x.samtalerundeId === rundeId)
      .sort(dagrekkefolge);
    const p = await lesTidsplan(d, e);
    setRunde(r.find((x) => x.id === rundeId) ?? null);
    setDager(d);
    setElever(e);
    setPlan(p);
    setDetaljer(await hentDetaljer([...p.samtale.values()].map((s) => s.id)));
  }, [rundeId, skolearId]);
  useEffect(() => {
    void last();
  }, [last]);
  useEffect(() => lyttVurderinger(() => void last()), [last]);

  const min = runde?.samtaleMin ?? plan?.tider?.minutter ?? 20;
  const pause = runde?.pauseMin ?? plan?.tider?.pause ?? 5;
  const tp = useMemo(() => tilTidsplandager(dager), [dager]);
  const utlagt = useMemo(
    () => (plan ? leggUtTidsplan(plan.rekke, tp, min, pause) : []),
    [plan, tp, min, pause],
  );
  const lagrePlan = useLagrePlan({
    dager: tp,
    min,
    pause,
    vis: (rekke, harPlan) => setPlan((p) => (p ? { ...p, rekke, harPlan } : p)),
    etter: async () => {
      varsleVurderinger();
      await last();
    },
  });

  // Holdt: tida er passert, og eleven møtte.
  const holdt = (elevId: string) => {
    const s = plan?.samtale.get(elevId);
    const d = utlagt.find((x) => x.rader.some((r) => r.elevId === elevId));
    const r = d?.rader.find((x) => x.elevId === elevId);
    if (!s || !s.motte || !d || !r || !d.dag.dato) return false;
    const i = idag();
    const kl = `${String(naa.getHours()).padStart(2, "0")}:${String(naa.getMinutes()).padStart(2, "0")}`;
    return d.dag.dato < i || (d.dag.dato === i && r.til <= kl);
  };
  const antHoldt = elever.filter((e) => holdt(e.elevId)).length;

  const gjeldende = useMemo(() => {
    if (!plan) return null;
    for (const d of utlagt)
      for (const r of d.rader)
        if (!holdt(r.elevId) && plan.samtale.get(r.elevId)?.motte !== false)
          return r.elevId;
    return utlagt[0]?.rader[0]?.elevId ?? null;
    // holdt avhenger av klokka; et nytt valg per minutt holder.
  }, [plan, utlagt]);
  useEffect(() => {
    if (valgt === null && gjeldende) setValgt(gjeldende);
  }, [valgt, gjeldende]);
  useEffect(() => {
    if (!plan || modus) return;
    setModus(plan.harPlan ? "gj" : "plan");
  }, [plan, modus]);

  if (!runde || !plan || !modus) return null;
  const navn = new Map(
    elever.map((e) => [e.elevId, `${e.fornavn} ${e.etternavn}`]),
  );
  const datoer = dager
    .map((d) => d.dato)
    .filter(Boolean)
    .sort();
  const spenn =
    datoer.length === 0
      ? null
      : datoer.length === 1
        ? kortDag(datoer[0])
        : `${kortDag(datoer[0])} – ${kortDag(datoer[datoer.length - 1])}`;

  function neste() {
    const rekke = utlagt.flatMap((d) => d.rader.map((r) => r.elevId));
    const i = valgt ? rekke.indexOf(valgt) : -1;
    const ny = rekke
      .slice(i + 1)
      .find((id) => plan!.samtale.get(id)?.motte !== false);
    if (ny) setValgt(ny);
  }

  async function kopierTidsplan() {
    // Bare navn og tider. Aldri notater, mål eller ønsker.
    const dagene = utlagt.map((d) => ({
      dato: d.dag.dato,
      lunsj: d.lunsj,
      rader: d.rader.map((r) => ({
        navn: navn.get(r.elevId) ?? "",
        tema: null,
        fra: r.fra,
        til: r.til,
        motte: plan!.samtale.get(r.elevId)?.motte !== false,
      })),
    }));
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([somTeamsHtml(dagene, false)], {
          type: "text/html",
        }),
        "text/plain": new Blob([somMarkdown(dagene, false)], {
          type: "text/plain",
        }),
      }),
    ]);
    setKopiert(true);
    window.setTimeout(() => setKopiert(false), 1500);
  }

  const valgtSamtale = valgt ? plan.samtale.get(valgt) : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-2.5 px-6 pb-3 pt-1">
        <span className="h-[11px] w-[11px] rounded-[3px] bg-aksent" />
        <span className="text-[calc(15px*var(--tekst-skala))] font-semibold">
          {runde.navn}
        </span>
        <span className="text-[calc(13px*var(--tekst-skala))] text-blekk-dempet">
          {[klasse, spenn, "ikke en vurdering"].filter(Boolean).join(" · ")}
        </span>
        <span className="ml-2.5">
          <Bryter
            storrelse="liten"
            verdi={modus}
            settVerdi={(m) => setModus(m as Modus)}
            valg={[
              { id: "plan", navn: "Planlegg" },
              { id: "gj", navn: "Gjennomfør" },
              { id: "sum", navn: "Oppsummering" },
            ]}
          />
        </span>
        <span className="flex-1" />
        <span className="rounded-full bg-flate px-2.5 py-0.5 text-liten tabular-nums">
          {antHoldt} av {elever.length} holdt
        </span>
        <button
          onClick={() => void kopierTidsplan()}
          disabled={!plan.harPlan}
          title="Bare navn og tider"
          className="h-[30px] rounded-full border border-linje-sterk bg-ark px-3 text-[13px] hover:bg-flate disabled:opacity-40"
        >
          {kopiert ? "Kopiert ✓" : "Kopier tidsplan til Teams"}
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[320px_minmax(0,1fr)] gap-[26px] px-6">
        <div className="min-h-0 overflow-auto pb-5">
          <Tidsplanliste
            utlagt={utlagt}
            navn={navn}
            min={min}
            pause={pause}
            kanDra={modus === "plan" && plan.harPlan}
            valgt={modus === "gj" ? valgt : null}
            rad={(id) => {
              const s = plan.samtale.get(id);
              const borte = s?.motte === false;
              const h = holdt(id);
              return {
                under: borte
                  ? "møtte ikke"
                  : s && detaljer.get(s.id)?.medForesatt
                    ? "med foresatt"
                    : "eleven alene",
                merke: h ? "✓" : null,
                fylt: h,
                borte,
              };
            }}
            onVelg={(id) => {
              setValgt(id);
              if (modus !== "gj") setModus("gj");
            }}
            onFlytt={(rekke) => void lagrePlan(rekke, () => null)}
          />
          {modus === "gj" && (
            <p className="mx-1.5 my-3 text-liten text-blekk-svak">
              Dagene, tidene og rekkefølgen lages i Planlegg, med samme
              generator som muntlig vurdering.
            </p>
          )}
        </div>
        <div className="min-h-0 overflow-auto pb-5">
          {modus === "plan" && (
            <Planlegg
              runde={runde}
              dager={dager}
              elever={elever}
              plan={plan}
              utlagt={utlagt}
              min={min}
              pause={pause}
              lagrePlan={lagrePlan}
              last={last}
              skolearId={skolearId}
              onSlettet={onLukk}
              detaljer={detaljer}
            />
          )}
          {modus === "gj" && valgt && valgtSamtale && (
            <Gjennomfor
              key={valgt}
              skolearId={skolearId}
              runde={runde}
              elev={elever.find((e) => e.elevId === valgt)!}
              elever={elever}
              samtaleId={valgtSamtale.id}
              motte={valgtSamtale.motte}
              detaljer={detaljer.get(valgtSamtale.id)}
              dag={utlagt.find((d) => d.rader.some((r) => r.elevId === valgt))}
              naa={naa}
              onNeste={neste}
              onApneElev={() => onApneElev(valgt)}
              last={last}
            />
          )}
          {modus === "gj" && !valgtSamtale && (
            <p className="mt-10 text-center text-brod text-blekk-dempet">
              Ingen tidsplan ennå. Sett den opp under Planlegg.
            </p>
          )}
          {modus === "sum" && (
            <Oppsummering
              utlagt={utlagt}
              navn={navn}
              plan={plan}
              detaljer={detaljer}
              holdt={holdt}
            />
          )}
          <p className="mt-[22px] max-w-[620px] text-liten leading-relaxed text-blekk-svak">
            {MENTORORD.samtaler} er ikke vurderinger. Notatene er bare dine og
            vises aldri i fagene, i eksport eller i kalenderen. Kalenderen får
            bare fornavn og klokkeslett.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- planlegg

function Planlegg({
  runde,
  dager,
  elever,
  plan,
  utlagt,
  min,
  pause,
  lagrePlan,
  last,
  skolearId,
  onSlettet,
  detaljer,
}: {
  detaljer: Map<string, Samtaledetaljer>;
  runde: Samtalerunde;
  dager: Samtaledag[];
  elever: Mentorelev[];
  plan: Lesttidsplan;
  utlagt: Utlagtdag[];
  min: number;
  pause: number;
  lagrePlan: ReturnType<typeof useLagrePlan>;
  last: () => Promise<void>;
  skolearId: string;
  onSlettet: () => void;
}) {
  const [guide, setGuide] = useState(runde.guide);
  const foresatt = [...plan.samtale.values()].filter(
    (x) => detaljer.get(x.id)?.medForesatt,
  ).length;
  const alene = elever.length - foresatt;
  const venter = useRef<number | null>(null);
  function endreGuide(ny: string[]) {
    setGuide(ny);
    if (venter.current !== null) window.clearTimeout(venter.current);
    venter.current = window.setTimeout(() => {
      venter.current = null;
      void endreRunde(runde.id, { guide: ny });
    }, 500);
  }
  return (
    <div>
      <Generator
        tittel={`Planlegg ${MENTORORD.samtalerSmaa}`}
        kilde={{
          dager,
          elever,
          rekke: plan.rekke,
          harPlan: plan.harPlan,
          min,
          pause,
          tema: () => null,
        }}
        utlagt={utlagt}
        lagrePlan={lagrePlan}
        last={last}
        opprettDag={(d) =>
          opprettSamtaledag(skolearId, {
            skolearFagId: null,
            samtalerundeId: runde.id,
            til: d.fra,
            ...d,
          })
        }
        settTider={(m, p) =>
          endreRunde(runde.id, { samtaleMin: m, pauseMin: p })
        }
        standardDato={iDag()}
        tom={
          elever.length === 0
            ? `Du har ingen ${MENTORORD.elever} ennå. Kryss dem av under Elever.`
            : `Legg til en dag, så legges de ${elever.length} ${MENTORORD.elevene} ut med tider.`
        }
      />
      <section className="mb-4 rounded-[14px] bg-flate-svak px-[18px] py-4 shadow-[inset_0_0_0_1px_var(--color-linje-svak)]">
        <h3 className="mb-2.5 text-[13px] font-semibold">Hvem deltar</h3>
        <div className="flex flex-wrap gap-1.5">
          {[
            [`Eleven alene · ${alene}`, true],
            [`Med foresatt · ${foresatt}`, foresatt > 0],
          ].map(([t, pa]) => (
            <span
              key={String(t)}
              className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-ark px-2.5 text-[12.5px] shadow-[inset_0_0_0_1px_var(--color-linje-svak)]"
            >
              {pa && <span className="text-[#3f9d49]">✓</span>}
              {t}
            </span>
          ))}
        </div>
        <p className="mt-2.5 text-liten text-blekk-svak">
          Merk «med foresatt» på eleven under Gjennomfør.
        </p>
      </section>
      <section className="mb-4 rounded-[14px] bg-flate-svak px-[18px] py-4 shadow-[inset_0_0_0_1px_var(--color-linje-svak)]">
        <h3 className="mb-2 text-[13px] font-semibold">Samtaleguide</h3>
        {guide.map((q, i) => (
          <div key={i} className="group flex items-center gap-1.5">
            <span className="h-4 w-4 shrink-0 rounded-full shadow-[inset_0_0_0_1.5px_var(--color-linje-sterk)]" />
            <input
              value={q}
              data-guide={i}
              placeholder="Spørsmål"
              onChange={(e) =>
                endreGuide(guide.map((x, j) => (j === i ? e.target.value : x)))
              }
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const ny = [...guide];
                ny.splice(i + 1, 0, "");
                endreGuide(ny);
                window.setTimeout(
                  () =>
                    document
                      .querySelector<HTMLInputElement>(
                        `[data-guide="${i + 1}"]`,
                      )
                      ?.focus(),
                  30,
                );
              }}
              className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-[3px] text-[13px] outline-none placeholder:text-blekk-svakest hover:bg-ark focus:bg-ark focus:shadow-[inset_0_0_0_1.5px_var(--color-aksent)]"
            />
            <button
              onClick={() => endreGuide(guide.filter((_, j) => j !== i))}
              title="Fjern"
              className="px-1 text-[15px] text-blekk-svakest opacity-0 hover:text-feil group-hover:opacity-100"
            >
              ×
            </button>
          </div>
        ))}
        <button
          onClick={() => endreGuide([...guide, ""])}
          className="ml-[22px] mt-1.5 text-[12.5px] text-aksent hover:underline"
        >
          + Spørsmål
        </button>
        <p className="ml-[22px] mt-1 text-liten text-blekk-svak">
          Krysses av under samtalen. Gjelder alle samtalene i runden.
        </p>
      </section>
      <p className="mx-0.5 mb-5 text-liten text-blekk-svak">
        Tidsplanen vises til venstre og kan kopieres til Teams. Bytt til
        Gjennomfør når samtalene starter.
      </p>
      <label className="mb-3 flex items-center gap-2.5">
        <span className="text-liten text-blekk-dempet">Navn</span>
        <input
          defaultValue={runde.navn}
          onBlur={(e) => {
            const n = e.target.value.trim();
            if (n && n !== runde.navn) void endreRunde(runde.id, { navn: n });
          }}
          className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-[15px] font-medium outline-none hover:bg-flate-svak focus:bg-ark focus:shadow-[inset_0_0_0_1.5px_var(--color-aksent)]"
        />
      </label>
      <button
        onClick={async () => {
          if (
            !(await bekreft(
              `Slette «${runde.navn}»? Dagene og tidsplanen forsvinner. Notatene og målene blir stående på elevene.`,
            ))
          )
            return;
          await slettRunde(runde.id);
          onSlettet();
        }}
        className="text-liten text-blekk-svak hover:text-feil"
      >
        Slett runden
      </button>
    </div>
  );
}

// ------------------------------------------------------------- gjennomfør

function Gjennomfor({
  skolearId,
  runde,
  elev,
  elever,
  samtaleId,
  motte,
  detaljer,
  dag,
  naa,
  onNeste,
  onApneElev,
  last,
}: {
  skolearId: string;
  runde: Samtalerunde;
  elev: Mentorelev;
  elever: Mentorelev[];
  samtaleId: string;
  motte: boolean;
  detaljer: Samtaledetaljer | undefined;
  dag: Utlagtdag | undefined;
  naa: Date;
  onNeste: () => void;
  onApneElev: () => void;
  last: () => Promise<void>;
}) {
  const [stilt, setStilt] = useState(detaljer?.guideStilt ?? []);
  const [foresatt, setForesattState] = useState(detaljer?.medForesatt ?? false);
  const [notat, setNotat] = useState<{
    id: string | null;
    tekst: string;
  } | null>(null);
  const [mal, setMal] = useState<Samtalemal[]>([]);
  const [nyttMal, setNyttMal] = useState<string | null>(null);
  const [onsker, setOnsker] = useState<Onske[]>([]);
  const [oversikt, setOversikt] = useState<Elevoversikt | null>(null);
  const [leggerTil, setLeggerTil] = useState(false);
  const rad = dag?.rader.find((r) => r.elevId === elev.elevId);

  const lastMal = () => void hentMal(elev.elevId).then(setMal);
  const lastOnsker = () =>
    void hentOnsker().then((o) =>
      setOnsker(o.filter((x) => x.elevId === elev.elevId)),
    );
  useEffect(() => {
    void hentSamtalensNotat(samtaleId).then((n) =>
      setNotat(n ? { id: n.id, tekst: n.tekst } : { id: null, tekst: "" }),
    );
    lastMal();
    lastOnsker();
    void hentElevoversikt(elev.elevId, skolearId).then(setOversikt);
  }, [samtaleId, elev.elevId, skolearId]);

  // Notatet lagres litt etter siste tastetrykk. Første gang lages det, med
  // samtalens id, så det står på elevkortet under møteloggen.
  const venter = useRef<number | null>(null);
  const notatId = useRef<string | null>(null);
  useEffect(() => {
    notatId.current = notat?.id ?? null;
  }, [notat?.id]);
  const siste = useRef<string | null>(null);
  async function lagreNotat(tekst: string) {
    if (notatId.current) await endreElevnotat(notatId.current, { tekst });
    else if (tekst.trim()) {
      notatId.current = await opprettElevnotat(elev.elevId, skolearId, {
        dato: dag?.dag.dato || idag(),
        tekst,
        samtaleId,
      });
    }
  }
  function skrivNotat(t: string) {
    siste.current = t;
    if (venter.current !== null) window.clearTimeout(venter.current);
    venter.current = window.setTimeout(() => {
      venter.current = null;
      void lagreNotat(t);
    }, 700);
  }
  useEffect(
    () => () => {
      if (venter.current !== null && siste.current !== null) {
        window.clearTimeout(venter.current);
        void lagreNotat(siste.current);
      }
    },
    [],
  );

  // ⌘↵ neste elev.
  const fersk = useRef(onNeste);
  fersk.current = onNeste;
  useEffect(() => {
    const t = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        fersk.current();
      }
    };
    window.addEventListener("keydown", t);
    return () => window.removeEventListener("keydown", t);
  }, []);

  const p = rad && dag ? framdrift(rad, dag.dag.dato, naa) : null;
  const sek = p !== null ? Math.floor(p * (tilMinutter(rad!) * 60)) : 0;
  const { fraForrige, tilNeste } = delMal(mal, samtaleId);
  const navn = new Map(
    elever.map((e) => [e.elevId, `${e.fornavn} ${e.etternavn}`]),
  );

  return (
    <div>
      <div className="flex items-center gap-3.5">
        <button onClick={onApneElev} title="Åpne elevkortet">
          <Elevfoto
            elevId={elev.elevId}
            storrelse={52}
            navn={`${elev.fornavn} ${elev.etternavn}`}
          />
        </button>
        <div className="min-w-0">
          <div className="truncate text-[24px] font-light tracking-[-.01em]">
            {elev.fornavn} {elev.etternavn}
          </div>
          <div className="flex items-center gap-1.5 text-[13px] tabular-nums text-blekk-svak">
            {!motte
              ? "Møtte ikke"
              : rad
                ? `${rad.fra}–${rad.til}` +
                  (p !== null
                    ? ` · pågår · ${Math.floor(sek / 60)}:${String(sek % 60).padStart(2, "0")} av ${tilMinutter(rad)}:00`
                    : "")
                : ""}
            {motte && (
              <button
                onClick={async () => {
                  const ny = !foresatt;
                  setForesattState(ny);
                  await settForesatt(samtaleId, ny);
                  await last();
                }}
                title="Bytt"
                className="rounded-full bg-flate px-2 py-px text-liten text-blekk-dempet hover:text-blekk"
              >
                {foresatt ? "med foresatt" : "eleven alene"}
              </button>
            )}
          </div>
        </div>
        <span className="flex-1" />
        <button
          onClick={async () => {
            await settMotte(samtaleId, !motte);
            varsleVurderinger();
            await last();
            if (motte) onNeste();
          }}
          className="h-[30px] rounded-full border border-linje-sterk bg-ark px-3 text-[13px] hover:bg-flate"
        >
          {motte ? "Møtte ikke" : "Møtte likevel"}
        </button>
        <button
          onClick={onNeste}
          className="flex h-[30px] items-center gap-1.5 rounded-full bg-aksent px-3.5 text-[13px] font-medium text-ark hover:bg-aksent-mork"
        >
          Neste elev
          <span className="text-[11px] opacity-60">{visTast("⌘↵")}</span>
        </button>
      </div>
      <div className="mb-[18px] mt-3.5 h-1.5 overflow-hidden rounded-[3px] bg-flate">
        <span
          className="block h-full rounded-[3px] bg-aksent/70 transition-[width] duration-1000 ease-linear"
          style={{ width: `${Math.round((p ?? 0) * 100)}%` }}
        />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_290px] gap-6">
        <div className="min-w-0">
          <Overskrift>Samtaleguide</Overskrift>
          {runde.guide
            .map((q, i) => [q, i] as const)
            .filter(([q]) => q.trim())
            .map(([q, i]) => {
              const pa = stilt.includes(i);
              return (
                <button
                  key={i}
                  onClick={async () => {
                    const ny = pa
                      ? stilt.filter((x) => x !== i)
                      : [...stilt, i];
                    setStilt(ny);
                    await settGuideStilt(samtaleId, ny);
                  }}
                  className={`flex w-full items-start gap-2.5 py-[5px] text-left text-[13.5px] leading-snug transition-colors duration-200 ${
                    pa ? "text-blekk-svak" : ""
                  }`}
                >
                  <span
                    className={`mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] text-ark ${
                      pa
                        ? "bg-aksent/50"
                        : "shadow-[inset_0_0_0_1.5px_var(--color-linje-sterk)]"
                    }`}
                  >
                    {pa ? "✓" : ""}
                  </span>
                  {q}
                </button>
              );
            })}
          <div className="mt-5">
            <Overskrift>Notat</Overskrift>
            {notat && (
              <div className="text-[calc(14px*var(--tekst-skala))]">
                <Notat
                  verdi={notat.tekst}
                  onEndre={skrivNotat}
                  minHoyde={150}
                  plassholder="Skriv mens dere snakker …  # overskrift, - punkt, / for meny"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3.5">
          <Kort>
            <Overskrift>
              Fra forrige samtale
              {fraForrige[0]?.dato ? ` · ${kortDato(fraForrige[0].dato)}` : ""}
            </Overskrift>
            {fraForrige.length === 0 && (
              <p className="text-liten text-blekk-svak">Ingen mål fra før.</p>
            )}
            {fraForrige.map((m) => (
              <Mal
                key={m.id}
                mal={m}
                onVeksle={async () => {
                  await settNadd(m.id, !m.nadd);
                  lastMal();
                }}
              />
            ))}
          </Kort>
          <Kort>
            <Overskrift>Til neste gang</Overskrift>
            {tilNeste.map((m) => (
              <Mal
                key={m.id}
                mal={m}
                onVeksle={async () => {
                  await settNadd(m.id, !m.nadd);
                  lastMal();
                }}
                onSlett={async () => {
                  await slettMal(m.id);
                  lastMal();
                }}
              />
            ))}
            {nyttMal === null ? (
              <button
                onClick={() => setNyttMal("")}
                className="mt-1 text-[12.5px] text-aksent hover:underline"
              >
                + Mål eller avtale
              </button>
            ) : (
              <input
                autoFocus
                value={nyttMal}
                onChange={(e) => setNyttMal(e.target.value)}
                onBlur={() => setNyttMal(null)}
                onKeyDown={async (e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    setNyttMal(null);
                  }
                  if (e.key === "Enter" && nyttMal.trim()) {
                    await leggTilMal(elev.elevId, samtaleId, nyttMal.trim());
                    setNyttMal("");
                    lastMal();
                  }
                }}
                placeholder="Målet ↵"
                className="mt-1 w-full rounded-md bg-ark px-2 py-1 text-[13px] outline-none shadow-[inset_0_0_0_1.5px_var(--color-aksent)]"
              />
            )}
          </Kort>
          <Kort>
            <div className="flex items-center">
              <Overskrift ingenMarg>Trives med · vil sitte med</Overskrift>
              <span className="flex-1" />
              <button
                onClick={() => setLeggerTil((x) => !x)}
                className="text-[12.5px] text-aksent hover:underline"
              >
                + Legg til
              </button>
            </div>
            {leggerTil && (
              <div className="mt-2">
                <Velger
                  verdi=""
                  startApen
                  onLukk={() => setLeggerTil(false)}
                  settVerdi={async (id) => {
                    await leggTilOnske(elev.elevId, id, "samtale", samtaleId);
                    setLeggerTil(false);
                    lastOnsker();
                  }}
                  valg={elever
                    .filter(
                      (e) =>
                        e.elevId !== elev.elevId &&
                        !onsker.some((o) => o.onskerElevId === e.elevId),
                    )
                    .map((e) => ({
                      verdi: e.elevId,
                      tekst: `${e.fornavn} ${e.etternavn}`,
                    }))}
                  plassholder="Velg en elev …"
                  bredde="w-full"
                />
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {onsker.map((o) => (
                <span
                  key={o.id}
                  className="group inline-flex items-center gap-1 rounded-full bg-flate py-0.5 pl-2 pr-1 text-[12px]"
                >
                  <b className="text-aksent">★</b>
                  {navn.get(o.onskerElevId) ?? "Elev"}
                  <button
                    onClick={async () => {
                      await fjernOnske(o.id);
                      lastOnsker();
                    }}
                    title="Fjern"
                    className="px-0.5 text-blekk-svakest opacity-0 hover:text-feil group-hover:opacity-100"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <p className="mt-1.5 text-liten text-blekk-svak">
              Lagres på elevkortet og vises i Plasser og grupper.
            </p>
          </Kort>
          {oversikt && (
            <Kort>
              <Overskrift>Oversikt</Overskrift>
              <div className="text-liten leading-[1.8] text-blekk-dempet">
                Fravær i dine fag: {oversikt.fravaer}{" "}
                {oversikt.fravaer === 1 ? "økt" : "økter"}
                {oversikt.innsats.map((i) => (
                  <div key={i.fagKode}>
                    Innsats {i.fagKode}:{" "}
                    {i.farger.map((f, j) => (
                      <span
                        key={j}
                        className="mr-0.5 inline-block h-2 w-2 rounded-full"
                        style={{
                          background:
                            f === "gronn"
                              ? "#3f9d49"
                              : f === "gul"
                                ? "#d9a92f"
                                : f === "rod"
                                  ? "#c04a3d"
                                  : "#d5d8dd",
                        }}
                      />
                    ))}
                  </div>
                ))}
                <div>
                  Frister:{" "}
                  {oversikt.ikkeLevert === 0
                    ? "alt levert"
                    : `${oversikt.ikkeLevert} ikke levert`}
                </div>
              </div>
            </Kort>
          )}
        </div>
      </div>
    </div>
  );
}

function tilMinutter(r: { fra: string; til: string }): number {
  const m = (k: string) => Number(k.slice(0, 2)) * 60 + Number(k.slice(3, 5));
  return m(r.til) - m(r.fra);
}

function kortDato(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return `${d.getDate()}.${d.getMonth() + 1}`;
}

function Mal({
  mal,
  onVeksle,
  onSlett,
}: {
  mal: Samtalemal;
  onVeksle: () => void;
  onSlett?: () => void;
}) {
  return (
    <div className="group flex items-start gap-2 py-1 text-[13px]">
      <button
        onClick={onVeksle}
        title={mal.nadd ? "Ikke nådd likevel" : "Nådd"}
        className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-[5px] text-[10px] text-ark ${
          mal.nadd
            ? "bg-aksent"
            : "shadow-[inset_0_0_0_1.5px_var(--color-linje-sterk)]"
        }`}
      >
        {mal.nadd ? "✓" : ""}
      </button>
      <span
        className={`flex-1 ${mal.nadd ? "text-blekk-svak line-through" : ""}`}
      >
        {mal.tekst}
      </span>
      {onSlett && (
        <button
          onClick={onSlett}
          title="Fjern"
          className="px-0.5 text-blekk-svakest opacity-0 hover:text-feil group-hover:opacity-100"
        >
          ×
        </button>
      )}
    </div>
  );
}

function Kort({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] bg-flate-svak px-4 py-3.5 shadow-[inset_0_0_0_1px_var(--color-linje-svak)]">
      {children}
    </div>
  );
}

function Overskrift({
  children,
  ingenMarg,
}: {
  children: React.ReactNode;
  ingenMarg?: boolean;
}) {
  return (
    <div
      className={`text-[calc(13px*var(--tekst-skala))] font-semibold text-blekk ${
        ingenMarg ? "" : "mb-2"
      }`}
    >
      {children}
    </div>
  );
}

// ----------------------------------------------------------- oppsummering

function Oppsummering({
  utlagt,
  navn,
  plan,
  detaljer,
  holdt,
}: {
  utlagt: Utlagtdag[];
  navn: Map<string, string>;
  plan: Lesttidsplan;
  detaljer: Map<string, Samtaledetaljer>;
  holdt: (elevId: string) => boolean;
}) {
  const [mal, setMal] = useState<Map<string, Samtalemal[]>>(new Map());
  useEffect(() => {
    const ider = utlagt.flatMap((d) => d.rader.map((r) => r.elevId));
    void Promise.all(ider.map((id) => hentMal(id))).then((alle) =>
      setMal(new Map(ider.map((id, i) => [id, alle[i]]))),
    );
  }, [utlagt]);
  return (
    <div>
      <div className="mb-2 text-[calc(13px*var(--tekst-skala))] font-semibold text-blekk">
        Oppsummering
      </div>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="text-left text-liten text-blekk-svak">
            <th className="py-1.5 pr-3 font-normal">Elev</th>
            <th className="py-1.5 pr-3 font-normal">Tid</th>
            <th className="py-1.5 pr-3 font-normal">Status</th>
            <th className="py-1.5 font-normal">Til neste gang</th>
          </tr>
        </thead>
        <tbody>
          {utlagt.flatMap((d) =>
            d.rader.map((r) => {
              const s = plan.samtale.get(r.elevId);
              const til = s
                ? (mal.get(r.elevId) ?? []).filter((m) => m.samtaleId === s.id)
                : [];
              return (
                <tr
                  key={r.elevId}
                  className="border-t border-linje-svak align-top"
                >
                  <td className="whitespace-nowrap py-2 pr-3">
                    {navn.get(r.elevId)}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-blekk-dempet">
                    {d.dag.dato ? kortDag(d.dag.dato) : ""} {r.fra}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3 text-blekk-dempet">
                    {s?.motte === false
                      ? "møtte ikke"
                      : holdt(r.elevId)
                        ? s && detaljer.get(s.id)?.medForesatt
                          ? "holdt · med foresatt"
                          : "holdt"
                        : "ikke ennå"}
                  </td>
                  <td className="py-2 text-blekk-dempet">
                    {til.map((m) => m.tekst).join(" · ")}
                  </td>
                </tr>
              );
            }),
          )}
        </tbody>
      </table>
    </div>
  );
}
