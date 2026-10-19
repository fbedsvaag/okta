import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { confirm as bekreft } from "@tauri-apps/plugin-dialog";
import {
  hentOkter,
  endreOkt,
  hentOktVurderinger,
  opprettOkt,
  slettetekst,
  slettOkter,
  type Okt,
  type OktVurdering,
} from "../data/okter";
import {
  hentFridager,
  hentInnstilling,
  settInnstilling,
} from "../data/skolear";
import {
  blokkering,
  rodekart,
  ukenummer,
  type Blokkering,
  type Fridag,
} from "../data/kalender";
import type { FagIAr } from "../data/fag";
import {
  Fagfirkant,
  Felt,
  Ikon,
  Kappet,
  Knapp,
  Kolonnevelger,
  Kontekstmeny,
  Menyvalg,
  Tomtilstand,
} from "../ui/felles";
import { invoke } from "@tauri-apps/api/core";
import { Arsplan } from "./Arsplan";
import { Velger } from "../ui/Velger";
import { Arsplanmeny } from "./Arsplanmeny";
import { hentArk, type Ark } from "../data/arsplanark";
import { TRAFIKKLYS } from "../ui/farger";
import {
  fargelegg,
  hentAllePerioder,
  periodeFor,
  type Periode,
} from "../data/perioder";
import {
  Periodefiltre,
  Periodemerke,
  UTEN,
  type Periodefilter,
  type Periodetall,
} from "./Periodefiltre";
import { Periodemal } from "./Malvelger";
import { useArk } from "../ui/Arkstabel";
import { lytt, lyttOktvisning } from "../data/endringer";
import type { Skolear } from "../data/skolear";
import { NySerie } from "./NySerie";
import { IVerktoylinja } from "../ui/Verktoylinje";
import { Utfold } from "../ui/Utfold";
import { Glideflate } from "../ui/Glideflate";
import { Vurderingsikon, vurderingstype } from "../ui/Vurderingsikon";
import { Tastestripe, Tasthint } from "../ui/Tastestripe";
import { enLinje, forrigeOkt } from "../data/dagen";
import { hovedtast, harModifikator } from "../ui/taster";
import { useIdag } from "../ui/useIdag";

/**
 * Årsplan — økter, SPEC §4.2.
 *
 * Alle fag i én kronologisk liste, med fagfilter og søk i tema. Klikk på en
 * rad åpner det utvidede viewet til høyre — ikke en ny side.
 */
/**
 * Kolonnene Uke · Dato · Tid · Tema · Periode · Vurdering står alltid
 * (ARBEIDSLISTE 7.3, lerretet). Disse kan slås på i tillegg.
 */
export type KolonneId =
  "varighet" | "logg" | "innsats" | "oppmote" | "sted" | "agenda";

const STANDARDKOLONNER: KolonneId[] = [];

/** Innstillingen kolonnevalget lagres under. Ny nøkkel med 7.3, så de
 *  gamle valgene (der Uke, Tid og Periode kunne slås av) ikke henger igjen. */
const KOLONNER = "okt_kolonner_ekstra";

export function Okter({
  skolear,
  fag,
  startValgt = null,
  bryter,
  filterFag,
  onFilterFag,
  onRedigerFag,
  onApneSamtaler,
}: {
  /** en muntlig vurdering: trekningen i Samtaler */
  onApneSamtaler: (skolearFagId: string) => void;
  /** «Rediger fag» i verktøylinja: fagsiden, eller fagtabellen med alle fag */
  onRedigerFag: (skolearFagId: string | null) => void;
  /** faget lista står filtrert på; "" = alle. Styres fra sidemenyen også. */
  filterFag: string;
  onFilterFag: (id: string) => void;
  /** Liste | Kalender, først i verktøylinja */
  bryter?: React.ReactNode;
  skolear: Skolear;
  fag: FagIAr[];
  /** Økt som skal stå åpen med en gang, f.eks. klikket fra forsiden. */
  startValgt?: string | null;
}) {
  const [okter, setOkter] = useState<Okt[]>([]);
  const [valgt, setValgt] = useState<string | null>(startValgt);
  const setFilterFag = onFilterFag;
  const [sok, setSok] = useState("");
  const [lagerNy, setLagerNy] = useState(false);
  const [lagerSerie, setLagerSerie] = useState(false);
  const arkstabel = useArk();
  const [perioder, setPerioder] = useState<Periode[]>([]);
  // Om årsplanen grupperes under perioder på papiret. Valget hører til
  // brukeren og lagres i innstilling, som kolonnevalgene.
  const [medPerioder, setMedPerioder] = useState(true);
  // Arkene som står klare til utskrift. Bygges først når noen ber om dem.
  const [ark, setArk] = useState<Ark[]>([]);
  // Kolonnevalget ligger i innstilling, ikke i nettleseren, så det følger
  // databasen hvis du flytter den til en annen maskin.
  const [kolonner, setKolonner] = useState<Set<KolonneId>>(
    new Set(STANDARDKOLONNER),
  );
  const [fridager, setFridager] = useState<Fridag[]>([]);
  const [vurderinger, setVurderinger] = useState<Map<string, OktVurdering[]>>(
    new Map(),
  );
  // Flervalg til sletting. Holdes atskilt fra `valgt`, som er økta panelet
  // viser — å hake av rader er noe annet enn å åpne én.
  const [merket, setMerket] = useState<Set<string>>(new Set());
  const [meny, setMeny] = useState<{ okt: Okt; x: number; y: number } | null>(
    null,
  );
  // Perioden lista er filtrert på (merkelappene over lista), og om
  // periodevelgeren for de merkede øktene står åpen (P).
  const [periodeFilter, setPeriodeFilter] = useState<Periodefilter>(null);
  const [velgerPeriode, setVelgerPeriode] = useState(false);

  // Periodene hører til ett fag. Byttes faget, nullstilles filteret.
  useEffect(() => setPeriodeFilter(null), [filterFag]);

  /** Setter perioden på alle de merkede øktene på én gang. */
  async function settPeriode(periodeId: string | null) {
    await fargelegg([...merket], periodeId);
    setMerket(new Set());
    setVelgerPeriode(false);
    await last();
  }

  // P setter periode på de merkede øktene (DESIGN.md §10). Ikke mens man
  // skriver i et felt — da er P bare en bokstav.
  useEffect(() => {
    if (merket.size === 0) {
      setVelgerPeriode(false);
      return;
    }
    const tast = (e: KeyboardEvent) => {
      if (harModifikator(e) || e.altKey) return;
      const mal = e.target as HTMLElement;
      if (mal.closest?.("input, textarea, select, [contenteditable]")) return;
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        setVelgerPeriode((v) => !v);
      }
      if (e.key === "Escape") setVelgerPeriode(false);
    };
    window.addEventListener("keydown", tast);
    return () => window.removeEventListener("keydown", tast);
  }, [merket.size]);

  /**
   * Temaet skrives rett i lista. Lagres uten å laste alt på nytt, så
   * markøren kan gå videre til neste rad uten at lista tegnes om under den.
   */
  async function lagreTema(id: string, tema: string | null) {
    setOkter((f) => f.map((o) => (o.id === id ? { ...o, tema } : o)));
    await endreOkt(id, { tema });
  }

  const skolearId = skolear.id;
  const skolearStart = skolear.start;
  const skolearSlutt = skolear.slutt;

  async function last() {
    setOkter(await hentOkter(skolearId));
    setFridager(await hentFridager(skolearId));
    setVurderinger(await hentOktVurderinger(skolearId));
    setPerioder(await hentAllePerioder(skolearId));
  }

  useEffect(() => {
    void last();
    void hentInnstilling(KOLONNER).then((v) => {
      if (v) setKolonner(new Set(JSON.parse(v) as KolonneId[]));
    });
    void hentInnstilling("utskrift_perioder").then((v) => {
      if (v !== null) setMedPerioder(v === "1");
    });
  }, [skolearId]);

  function byttKolonne(id: KolonneId, pa: boolean) {
    setKolonner((f) => {
      const ny = new Set(f);
      if (pa) ny.add(id);
      else ny.delete(id);
      void settInnstilling(KOLONNER, JSON.stringify([...ny]));
      return ny;
    });
  }

  // Kommer du hit med en økt i sikte — «Vis i Økter» fra et øktkort, eller
  // historikkpilene — står den markert, og lista ruller dit (under).
  useEffect(() => {
    if (startValgt) setValgt(startValgt);
  }, [startValgt]);

  // Økta åpnes som et kort over lista (Arkstabel), som elever, vurderinger
  // og fag. Lista beholder bredden og kolonnene sine under.
  function apne(id: string) {
    setValgt(id);
    arkstabel.apneOkt(id);
  }

  // Endres økta i kortet — tema, skåringer, notater — skal lista vise det.
  useEffect(() => lytt(() => void last()), [skolearId]);
  useEffect(() => lyttOktvisning(() => void last()), [skolearId]);

  // Ligger en økt på en ferie eller en rød dag, skal det synes. Datoen kan
  // ha blitt blokkert etter at økta ble lagt inn.
  const rode = useMemo(
    () => rodekart(skolearStart, skolearSlutt),
    [skolearStart, skolearSlutt],
  );
  const blokkert = useMemo(() => {
    const kart = new Map<string, Blokkering>();
    for (const o of okter) {
      const b = blokkering(o.dato, fridager, rode);
      if (b) kart.set(o.id, b);
    }
    return kart;
  }, [okter, fridager, rode]);

  // Perioden står på økta som en merkelapp (§4.2). Radene fargelegges ikke.
  const periodePerOkt = useMemo(() => {
    const kart = new Map<string, Periode>();
    for (const o of okter) {
      const egne = perioder.filter((p) => p.skolearFagId === o.skolearFagId);
      const p = periodeFor(o, egne);
      if (p) kart.set(o.id, p);
    }
    return kart;
  }, [okter, perioder]);

  const synlige = useMemo(() => {
    const s = sok.trim().toLocaleLowerCase("nb-NO");
    return okter.filter((o) => {
      if (filterFag && o.skolearFagId !== filterFag) return false;
      if (s && !(o.tema ?? "").toLocaleLowerCase("nb-NO").includes(s))
        return false;
      if (periodeFilter === UTEN && periodePerOkt.has(o.id)) return false;
      if (
        periodeFilter &&
        periodeFilter !== UTEN &&
        periodePerOkt.get(o.id)?.id !== periodeFilter
      )
        return false;
      return true;
    });
  }, [okter, filterFag, sok, periodeFilter, periodePerOkt]);

  // Antall økter og timer per periode i faget, til merkelappene.
  const periodeTall = useMemo(() => {
    const kart: Periodetall = new Map();
    for (const o of okter) {
      if (o.skolearFagId !== filterFag) continue;
      const id = periodePerOkt.get(o.id)?.id ?? UTEN;
      const t = kart.get(id) ?? { antall: 0, minutter: 0 };
      kart.set(id, {
        antall: t.antall + 1,
        minutter: t.minutter + o.varighetMin,
      });
    }
    return kart;
  }, [okter, periodePerOkt, filterFag]);

  // Periodene de merkede øktene kan få: bare når alle er i samme fag, for
  // periodene hører til faget.
  const merketFag = useMemo(() => {
    const fagene = new Set(
      okter.filter((o) => merket.has(o.id)).map((o) => o.skolearFagId),
    );
    return fagene.size === 1 ? [...fagene][0] : null;
  }, [okter, merket]);

  // Lista åpner på dagens dato: den første økta fra i dag står øverst, og
  // det som har vært ligger over. Gjøres når skjermen åpnes og når faget
  // byttes — ikke når lista lastes på nytt mens man jobber i den.
  const rullesone = useRef<HTMLDivElement>(null);
  const skalRulle = useRef(true);
  useEffect(() => {
    skalRulle.current = true;
  }, [filterFag, startValgt]);
  // Før skjermen tegnes, så lista ikke blinker øverst først.
  useLayoutEffect(() => {
    if (!skalRulle.current || synlige.length === 0) return;
    const sone = rullesone.current;
    if (!sone) return;
    skalRulle.current = false;
    // Åpnet fra søket eller en lenke: den økta, ikke dagens.
    const mal = startValgt
      ? synlige.find((o) => o.id === startValgt)
      : (synlige.find((o) => o.dato >= iDag()) ?? synlige[synlige.length - 1]);
    const rad =
      mal && sone.querySelector<HTMLElement>(`[data-okt="${mal.id}"]`);
    if (!rad) return;
    // Månedsoverskriften står fast øverst. Raden skal ligge under den med
    // én rad luft, så i dag-linja (16.5) og forrige økt synes over.
    const overskrift =
      sone.querySelector<HTMLElement>(".sticky")?.offsetHeight ?? 0;
    const luft = startValgt ? 0 : 36;
    sone.scrollTop +=
      rad.getBoundingClientRect().top -
      sone.getBoundingClientRect().top -
      overskrift -
      luft;
  }, [synlige, startValgt]);

  return (
    <>
      <Arsplan ark={ark} />

      {/*
        Verktøylinja (lerretet A): «Rediger fag» når et fag er valgt, og
        «Ny økt» som hovedknapp.
      */}
      <IVerktoylinja>
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          <button
            onClick={() => onRedigerFag(filterFag || null)}
            className="flex h-8 items-center rounded-full border border-linje-sterk bg-ark/70 px-3.5 text-brod hover:bg-ark"
          >
            {filterFag ? "Rediger fag" : "Fagene i år"}
          </button>
          <button
            onClick={() => setLagerNy(true)}
            className="flex h-8 items-center rounded-full bg-aksent px-3.5 text-brod font-medium text-ark hover:bg-aksent-mork"
          >
            Ny økt
          </button>
        </span>
      </IVerktoylinja>

      <div className="ikkeutskrift mx-auto flex min-h-0 w-full max-w-6xl flex-1 gap-0 overflow-clip">
        <div className="liste-bredde flex w-full min-w-0 flex-col">
          {/* Verktøylinja er header: den ruller ikke bort, og månedene
            fester seg rett under den. */}
          <div className="shrink-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {bryter}
              <Felt
                verdi={sok}
                settVerdi={setSok}
                plassholder="Søk i tema"
                bredde="w-56"
              />
              <Velger
                verdi={filterFag}
                settVerdi={setFilterFag}
                etikett="Fag"
                valg={[
                  { verdi: "", tekst: "Alle fag" },
                  ...fag.map((f) => ({
                    verdi: f.id,
                    tekst: f.kode,
                    farge: f.farge,
                    firkant: true,
                  })),
                ]}
              />
              <div className="ml-auto flex items-center gap-2">
                <Kolonnevelger
                  valgbare={VALGBARE}
                  vis={kolonner}
                  onEndre={(id, pa) => byttKolonne(id as KolonneId, pa)}
                />
                <label
                  title="Grupper øktene under perioden sin på arket"
                  className="flex select-none items-center gap-1.5 text-brod text-blekk-dempet"
                >
                  <input
                    type="checkbox"
                    checked={medPerioder}
                    onChange={(e) => {
                      setMedPerioder(e.target.checked);
                      void settInnstilling(
                        "utskrift_perioder",
                        e.target.checked ? "1" : "0",
                      );
                    }}
                  />
                  Perioder
                </label>
                <Arsplanmeny
                  hentArk={(felt) => {
                    // Faget i filteret, eller alle fag som har økter.
                    const liste = filterFag
                      ? fag.filter((f) => f.id === filterFag)
                      : fag.filter((f) =>
                          okter.some((o) => o.skolearFagId === f.id),
                        );
                    return Promise.all(
                      liste.map((f) => hentArk(skolear, f, medPerioder, felt)),
                    );
                  }}
                  onSkrivUt={async (a) => {
                    // Arket må stå i DOM-en før dialogen åpnes, ellers
                    // skrives det forrige ut.
                    flushSync(() => setArk(a));
                    await invoke("skriv_ut");
                  }}
                />
                <Knapp onClick={() => setLagerSerie(true)}>+ Serie</Knapp>
              </div>
            </div>
          </div>

          {/*
            Periodene som filtre over lista. Bare når ett fag er valgt —
            periodene hører til faget.
          */}
          {filterFag && (
            <div className="shrink-0">
              <Periodefiltre
                skolearFagId={filterFag}
                perioder={perioder.filter((p) => p.skolearFagId === filterFag)}
                tall={periodeTall}
                filter={periodeFilter}
                onFilter={setPeriodeFilter}
                onEndret={() => void last()}
              />
              {/* Målene for perioden lista er filtrert på. */}
              {periodeFilter && periodeFilter !== UTEN && (
                <Periodemal
                  skolearFagId={filterFag}
                  periodeId={periodeFilter}
                  grepKode={
                    fag.find((f) => f.id === filterFag)?.grepKode ?? null
                  }
                />
              )}
            </div>
          )}

          {/* Én rullesone. Hadde lista hatt sin egen overflow-x, ville
            månedene festet seg til DEN i stedet for til denne. */}
          <div ref={rullesone} className="min-h-0 flex-1 overflow-auto">
            {lagerNy && (
              <NyOkt
                fag={fag}
                startFagId={filterFag || fag[0]?.id}
                sisteDato={
                  okter.length > 0 ? okter[okter.length - 1].dato : undefined
                }
                onLagret={async (id) => {
                  setLagerNy(false);
                  await last();
                  apne(id);
                }}
                onAvbryt={() => setLagerNy(false)}
              />
            )}

            {lagerSerie && (
              <NySerie
                skolearId={skolearId}
                skolearStart={skolearStart}
                skolearSlutt={skolearSlutt}
                fag={fag}
                startFagId={filterFag || fag[0]?.id}
                onLagret={async () => {
                  setLagerSerie(false);
                  await last();
                }}
                onAvbryt={() => setLagerSerie(false)}
              />
            )}

            {okter.length === 0 && !lagerNy && !lagerSerie ? (
              <Tomtilstand
                tekst={
                  fag.length === 0
                    ? "Legg inn fagene dine først, så kan du planlegge øktene."
                    : "Ingen økter i dette skoleåret ennå. Opprett den første."
                }
                handling={
                  fag.length > 0 ? (
                    <div className="flex gap-2">
                      <Knapp
                        variant="primar"
                        onClick={() => setLagerSerie(true)}
                      >
                        Legg inn en serie
                      </Knapp>
                      <Knapp onClick={() => setLagerNy(true)}>Én økt</Knapp>
                    </div>
                  ) : undefined
                }
              />
            ) : (
              <Liste
                okter={synlige}
                alle={okter}
                valgt={valgt}
                merket={merket}
                vis={kolonner}
                visFag={!filterFag}
                blokkert={blokkert}
                vurderinger={vurderinger}
                perioder={periodePerOkt}
                onTema={(id, tema) => void lagreTema(id, tema)}
                onVelg={apne}
                onMarkor={setValgt}
                onMerk={(id, pa) =>
                  setMerket((f) => {
                    const ny = new Set(f);
                    if (pa) ny.add(id);
                    else ny.delete(id);
                    return ny;
                  })
                }
                onMerkSpenn={(fra, til) => {
                  const a = synlige.findIndex((o) => o.id === fra);
                  const b = synlige.findIndex((o) => o.id === til);
                  if (a < 0 || b < 0) return;
                  const [l, h] = a < b ? [a, b] : [b, a];
                  setMerket(
                    (f) =>
                      new Set([
                        ...f,
                        ...synlige.slice(l, h + 1).map((o) => o.id),
                      ]),
                  );
                }}
                onMerkAlle={() => setMerket(new Set(synlige.map((o) => o.id)))}
                onApneVurdering={(v) =>
                  v.type === "muntlig"
                    ? onApneSamtaler(v.skolearFagId)
                    : arkstabel.apneVurdering(v.id)
                }
                onMeny={(okt, x, y) => setMeny({ okt, x, y })}
              />
            )}

            {meny && (
              <Kontekstmeny x={meny.x} y={meny.y} onLukk={() => setMeny(null)}>
                <Menyvalg
                  onKlikk={() => {
                    apne(meny.okt.id);
                    setMeny(null);
                  }}
                >
                  Rediger
                </Menyvalg>
                <Menyvalg
                  farlig
                  onKlikk={async () => {
                    const okt = meny.okt;
                    setMeny(null);
                    if (!(await bekreft(slettetekst([okt])))) return;
                    await slettOkter([okt.id]);
                    if (valgt === okt.id) setValgt(null);
                    setMerket((f) => {
                      const ny = new Set(f);
                      ny.delete(okt.id);
                      return ny;
                    });
                    await last();
                  }}
                >
                  Slett
                </Menyvalg>
              </Kontekstmeny>
            )}

            {/*
            Handlingslinja for flervalg. Den ligger nederst i lista og ikke
            i verktøylinja, fordi den bare finnes når noe er merket — en
            knapp som kommer og går i toppen ville flyttet resten.
          */}
            {merket.size > 0 && (
              <div className="sticky bottom-0 mt-3 flex items-center gap-3 border border-linje bg-flate px-3 py-2 text-brod shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
                <span className="tabular-nums">
                  {merket.size} {merket.size === 1 ? "økt" : "økter"} merket
                </span>
                <span className="tabular-nums text-blekk-dempet">
                  {timer(
                    okter
                      .filter((o) => merket.has(o.id))
                      .reduce((sum, o) => sum + o.varighetMin, 0),
                  )}
                </span>
                {velgerPeriode && merketFag && (
                  <span className="flex flex-wrap items-center gap-1.5">
                    {perioder
                      .filter((p) => p.skolearFagId === merketFag)
                      .map((p) => (
                        <button
                          key={p.id}
                          onClick={() => void settPeriode(p.id)}
                          className="hover:brightness-95"
                        >
                          <Periodemerke navn={p.navn} farge={p.farge} />
                        </button>
                      ))}
                    <button
                      onClick={() => void settPeriode(null)}
                      className="rounded-stor border border-dashed border-linje px-1.5 py-0.5 text-liten text-blekk-dempet hover:text-blekk"
                    >
                      Ingen periode
                    </button>
                  </span>
                )}
                {velgerPeriode && !merketFag && (
                  <span className="text-liten text-blekk-dempet">
                    Merk økter i ett fag for å sette periode.
                  </span>
                )}
                <div className="ml-auto flex items-center gap-2">
                  {!velgerPeriode && (
                    <Knapp onClick={() => setVelgerPeriode(true)}>
                      Sett periode{" "}
                      <kbd className="font-sans text-blekk-svak">P</kbd>
                    </Knapp>
                  )}
                  <Knapp variant="stille" onClick={() => setMerket(new Set())}>
                    Nullstill
                  </Knapp>
                  <button
                    onClick={async () => {
                      const valgte = okter.filter((o) => merket.has(o.id));
                      if (!(await bekreft(slettetekst(valgte)))) return;
                      await slettOkter(valgte.map((o) => o.id));
                      setMerket(new Set());
                      if (valgt && merket.has(valgt)) setValgt(null);
                      await last();
                    }}
                    className="text-brod text-feil hover:text-feil-mork"
                  >
                    Slett{" "}
                    {merket.size === 1 ? "økta" : `de ${merket.size} øktene`}
                  </button>
                </div>
              </div>
            )}

            {okter.length > 0 && (
              <p className="mt-3 text-liten text-blekk-dempet">
                {synlige.length} av {okter.length} økter ·{" "}
                {timer(synlige.reduce((sum, o) => sum + o.varighetMin, 0))}
                {blokkert.size > 0 && (
                  <span className="ml-2 text-feil">
                    ! {blokkert.size}{" "}
                    {blokkert.size === 1 ? "økt ligger" : "økter ligger"} på en
                    fridag
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/** Kolonnene som kan slås på i tillegg til de faste. */
const VALGBARE: { id: KolonneId; navn: string }[] = [
  { id: "varighet", navn: "Varighet" },
  { id: "sted", navn: "Rom" },
  { id: "agenda", navn: "Agenda" },
  { id: "logg", navn: "Øktlogg" },
  { id: "innsats", navn: "Innsats" },
  { id: "oppmote", navn: "Oppmøte" },
];

/**
 * Øktlista (ARBEIDSLISTE 7.3, lerretet «Utfolding»): Uke · Dato · Tid ·
 * Tema · Periode · Vurdering, under månedsoverskrifter.
 *
 * Lista har en markør (↑↓). Mellomrom eller et klikk folder ut en rask titt
 * under raden; ↑↓ flytter titten med til neste økt, Enter åpner økta, og
 * Esc legger titten sammen. ⌘-klikk og ⇧-klikk merker rader — så kan de
 * få periode (P) eller slettes. Temaet skrives rett i lista (§4.2).
 */
function Liste({
  okter,
  alle,
  valgt,
  merket,
  vis,
  visFag,
  blokkert,
  vurderinger,
  perioder,
  onTema,
  onVelg,
  onMarkor,
  onMerk,
  onMerkSpenn,
  onMerkAlle,
  onApneVurdering,
  onMeny,
}: {
  okter: Okt[];
  /** alle øktene i året, så titten finner forrige økt i faget */
  alle: Okt[];
  /** raden markøren står på */
  valgt: string | null;
  merket: Set<string>;
  vis: Set<KolonneId>;
  /** «Alle fag»: da trengs en fagkolonne */
  visFag: boolean;
  blokkert: Map<string, Blokkering>;
  vurderinger: Map<string, OktVurdering[]>;
  perioder: Map<string, Periode>;
  onTema: (id: string, tema: string | null) => void;
  /** åpner økta (Enter, «Åpne økta») */
  onVelg: (id: string) => void;
  onMarkor: (id: string) => void;
  onMerk: (id: string, pa: boolean) => void;
  /** ⇧-klikk: alt mellom markøren og raden */
  onMerkSpenn: (fra: string, til: string) => void;
  /** ⌘A: alle radene i lista */
  onMerkAlle: () => void;
  /** muntlig: trekningen i Samtaler; ellers vurderingskortet */
  onApneVurdering: (v: OktVurdering) => void;
  onMeny: (okt: Okt, x: number, y: number) => void;
}) {
  const [apen, setApen] = useState<string | null>(null);
  const liste = useRef<HTMLDivElement>(null);
  // I dag-linja (16.5) står over den første økta i dag eller senere — men
  // bare når lista har økter på begge sider av i dag, eller en i dag.
  const idag = useIdag();
  const forsteFra = okter.findIndex((o) => o.dato >= idag);
  const idagFor =
    forsteFra < 0 || (forsteFra === 0 && okter[0].dato !== idag)
      ? null
      : okter[forsteFra].id;
  const [markorEl, setMarkorEl] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setMarkorEl(
      valgt
        ? (liste.current?.querySelector<HTMLElement>(
            `[data-okt="${valgt}"] > div:first-child`,
          ) ?? null)
        : null,
    );
  });

  // Kolonnene: de faste, fag når alle fag vises, og tilleggene som er på.
  const spor = [
    "26px",
    "44px",
    "78px",
    ...(visFag ? ["64px"] : []),
    "minmax(0,1fr)",
    "120px",
    "128px",
    ...(vis.has("varighet") ? ["64px"] : []),
    ...(vis.has("sted") ? ["72px"] : []),
    ...(vis.has("agenda") ? ["180px"] : []),
    ...(vis.has("logg") ? ["160px"] : []),
    ...(vis.has("innsats") ? ["88px"] : []),
    ...(vis.has("oppmote") ? ["56px"] : []),
  ].join(" ");
  const kolonner = { gridTemplateColumns: spor };

  /** Enter hopper til neste rads tema, Shift+Enter til forrige. */
  function hopp(fra: HTMLInputElement, retning: 1 | -1) {
    const felt = [
      ...document.querySelectorAll<HTMLInputElement>("input[data-tema]"),
    ];
    const neste = felt[felt.indexOf(fra) + retning];
    if (neste) {
      neste.focus();
      neste.select();
    } else fra.blur();
  }

  function flytt(retning: 1 | -1) {
    const i = okter.findIndex((o) => o.id === valgt);
    const neste =
      okter[i < 0 ? 0 : Math.min(Math.max(i + retning, 0), okter.length - 1)];
    if (!neste) return;
    onMarkor(neste.id);
    // Titten følger med til neste økt.
    if (apen) setApen(neste.id);
  }

  function tast(e: React.KeyboardEvent) {
    if ((e.target as HTMLElement).closest("input, textarea, select")) return;
    if (hovedtast(e) && e.key.toLowerCase() === "a") {
      e.preventDefault();
      onMerkAlle();
      return;
    }
    if (harModifikator(e) || e.altKey) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      flytt(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      flytt(-1);
    } else if (e.key === " ") {
      e.preventDefault();
      if (valgt) setApen((a) => (a === valgt ? null : valgt));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (valgt) onVelg(valgt);
    } else if (e.key === "Escape" && apen) {
      e.preventDefault();
      e.stopPropagation();
      setApen(null);
    }
  }

  // Markøren står alltid synlig.
  useEffect(() => {
    if (!valgt) return;
    liste.current
      ?.querySelector<HTMLElement>(`[data-okt="${valgt}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [valgt]);

  return (
    <div
      ref={liste}
      tabIndex={0}
      onKeyDown={tast}
      className="uten-fokusring relative outline-none"
    >
      {/* Markøren glir med piltastene (DESIGN.md §8). */}
      <Glideflate
        beholder={liste}
        mal={markorEl}
        klasse="z-[2] rounded-lg bg-[color-mix(in_srgb,var(--color-aksent)_8%,transparent)]"
      />
      <div
        className="grid h-[26px] items-center gap-x-3 border-b border-linje px-2 text-etikett text-blekk-dempet"
        style={kolonner}
      >
        <span title="Ukenummer">Uke</span>
        <span>Dato</span>
        <span>Tid</span>
        {visFag && <span>Fag</span>}
        <span>Tema</span>
        <span>Periode</span>
        <span>Vurdering</span>
        {vis.has("varighet") && <span className="text-right">Varighet</span>}
        {vis.has("sted") && <span>Rom</span>}
        {vis.has("agenda") && <span>Agenda</span>}
        {vis.has("logg") && <span>Øktlogg</span>}
        {vis.has("innsats") && <span>Innsats</span>}
        {vis.has("oppmote") && <span className="text-right">Oppmøte</span>}
      </div>

      {/*
        Én bolk per måned, ikke én per økt. Overskriften kan bare feste seg
        innenfor sin egen forelder — lå den i en boks på høyde med én rad,
        hadde den ingenting å stå i. Nå blir august stående til september
        skyver den opp.
      */}
      {perManed(okter).map(([maned, gruppe]) => (
        <div key={maned}>
          <div className="sticky top-0 z-10 border-b border-linje-medium bg-ark/95 px-2 pb-1 pt-3 text-liten font-semibold first-letter:uppercase">
            {manedsnavn(maned + "-01")}
          </div>
          {gruppe.map((o) => {
            const erApen = apen === o.id;
            const vurd = vurderinger.get(o.id) ?? [];
            const per = perioder.get(o.id);
            return (
              <div key={o.id} data-okt={o.id} className="px-0">
                {o.id === idagFor && <Idaglinje dato={idag} />}
                <div
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("input")) return;
                    if (hovedtast(e)) return onMerk(o.id, !merket.has(o.id));
                    if (e.shiftKey && valgt) return onMerkSpenn(valgt, o.id);
                    onMarkor(o.id);
                    setApen((a) => (a === o.id ? null : o.id));
                    liste.current?.focus();
                  }}
                  onDoubleClick={(e) => {
                    if ((e.target as HTMLElement).closest("input")) return;
                    onVelg(o.id);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onMeny(o, e.clientX, e.clientY);
                  }}
                  style={{
                    ...kolonner,
                    // Gyllen strek til venstre på økter med vurdering (§6).
                    boxShadow:
                      vurd.length > 0
                        ? "inset 3px 0 0 var(--color-vurdering)"
                        : undefined,
                  }}
                  className={`grid h-[30px] cursor-default items-center gap-x-3 px-2 text-[calc(13px*var(--tekst-skala))] tabular-nums ${
                    erApen
                      ? "rounded-t-lg bg-flate"
                      : merket.has(o.id)
                        ? "border-b border-linje-svak bg-valgt"
                        : vurd.length > 0
                          ? "border-b border-linje-svak bg-vurdering-flate hover:bg-flate-svak"
                          : "border-b border-linje-svak hover:bg-flate-svak"
                  }`}
                >
                  <span className="text-blekk-dempet">{ukenummer(o.dato)}</span>
                  <span
                    className={
                      blokkert.has(o.id) ? "font-medium text-feil" : ""
                    }
                    title={blokkert.get(o.id)?.navn}
                  >
                    {kortDato(o.dato)}
                    {blokkert.has(o.id) && " !"}
                  </span>
                  <span className="truncate text-blekk-dempet">
                    {ukedag(o.dato)} {o.klokkeslett ?? ""}
                  </span>
                  {visFag && (
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Fagfirkant farge={o.farge} />
                      <Kappet verdi={o.fagKode} klasse="font-medium" />
                    </span>
                  )}
                  {/*
                    Vurderingsikonet henger ut i mellomrommet foran temaet,
                    så alle titlene starter på samme linje (§6).
                  */}
                  <span className="relative flex min-w-0 items-center">
                    {vurd.length > 0 && (
                      <Vurderingsikon
                        type={vurd[0].type}
                        klasse="absolute -left-[21px] top-1/2 -mt-2"
                      />
                    )}
                    <input
                      data-tema
                      defaultValue={o.tema ?? ""}
                      key={o.tema ?? ""}
                      placeholder="Skriv tema …"
                      title={o.tema ?? undefined}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          hopp(e.currentTarget, e.shiftKey ? -1 : 1);
                        }
                        if (e.key === "Escape") {
                          e.currentTarget.value = o.tema ?? "";
                          e.currentTarget.blur();
                        }
                      }}
                      onBlur={(e) => {
                        const ny = e.target.value.trim() || null;
                        if (ny !== o.tema) onTema(o.id, ny);
                      }}
                      className={`-mx-1 w-full min-w-0 truncate rounded border border-transparent bg-transparent px-1 py-0.5 outline-none placeholder:text-blekk-svakest hover:border-linje focus:border-aksent focus:bg-ark ${
                        vurd.length > 0 ? "font-semibold" : ""
                      }`}
                    />
                  </span>
                  <span className="min-w-0">
                    {per && <Periodemerke navn={per.navn} farge={per.farge} />}
                  </span>
                  {/* Bare typen; temaet står i titten og på vurderingen. */}
                  <Kappet
                    verdi={[
                      ...new Set(vurd.map((v) => vurderingstype(v.type))),
                    ].join(", ")}
                    tom=""
                    klasse="text-[calc(12.5px*var(--tekst-skala))] font-semibold text-vurdering-tekst"
                  />
                  {vis.has("varighet") && (
                    <span className="text-right text-blekk-dempet">
                      {o.varighetMin} min
                    </span>
                  )}
                  {vis.has("sted") && (
                    <Kappet verdi={o.sted} tom="" klasse="text-blekk-dempet" />
                  )}
                  {vis.has("agenda") && (
                    <Kappet
                      verdi={o.agenda}
                      tom=""
                      klasse="text-blekk-dempet"
                    />
                  )}
                  {vis.has("logg") && (
                    <Kappet
                      verdi={o.logg}
                      tom=""
                      klasse="italic text-blekk-dempet"
                    />
                  )}
                  {vis.has("innsats") && <Innsats okt={o} />}
                  {vis.has("oppmote") && <Status okt={o} />}
                </div>

                <Utfold apen={erApen}>
                  <Titt
                    okt={o}
                    alle={alle}
                    vurderinger={vurd}
                    onApne={() => onVelg(o.id)}
                    onApneVurdering={onApneVurdering}
                  />
                </Utfold>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/**
 * I dag-linja i lista (16.5): en mørk strek med prikk til venstre og
 * «I dag · ons 14.10» til høyre, samme uttrykk som nå-linja i uka på I dag.
 * Den tar ingen plass; den ligger på skillet mellom radene.
 */
function Idaglinje({ dato }: { dato: string }) {
  return (
    <div aria-label="I dag" className="pointer-events-none relative z-[3] h-0">
      <span className="absolute inset-x-0 -top-[0.75px] h-[1.5px] bg-blekk" />
      <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-blekk" />
      <span className="absolute -top-2.5 right-0 rounded-full bg-blekk px-2 py-px text-[calc(11.5px*var(--tekst-skala))] font-medium tabular-nums text-ark">
        I dag · {ukedag(dato)} {kortDato(dato)}
      </span>
    </div>
  );
}

/**
 * Den raske titten under en utfoldet rad (variant F i lerretet): fakta til
 * venstre, plan og forrige notat til høyre, og en tonet tastestripe nederst
 * med tastene og «Åpne økta» samlet til høyre.
 */
function Titt({
  okt,
  alle,
  vurderinger,
  onApne,
  onApneVurdering,
}: {
  okt: Okt;
  alle: Okt[];
  vurderinger: OktVurdering[];
  onApne: () => void;
  onApneVurdering: (v: OktVurdering) => void;
}) {
  const forrige = forrigeOkt(okt, alle);
  const slutt = okt.klokkeslett
    ? leggTilMin(okt.klokkeslett, okt.varighetMin)
    : null;
  return (
    <div
      className="mb-2 overflow-hidden rounded-b-lg bg-flate text-[calc(12.5px*var(--tekst-skala))] leading-normal"
      style={{
        boxShadow:
          vurderinger.length > 0
            ? "inset 3px 0 0 var(--color-vurdering), 0 1px 0 var(--color-linje-medium)"
            : "0 1px 0 var(--color-linje-medium)",
      }}
    >
      <div className="grid grid-cols-2 gap-x-8 pb-3 pl-[74px] pr-3.5 pt-2">
        <div className="grid grid-cols-[96px_minmax(0,1fr)] content-start gap-x-3 gap-y-1.5">
          <span className="text-blekk-dempet">Dato</span>
          <span className="first-letter:uppercase">{langDato(okt.dato)}</span>
          <span className="text-blekk-dempet">Tid</span>
          <span className="tabular-nums">
            {okt.klokkeslett
              ? `${okt.klokkeslett}–${slutt}`
              : "Uten klokkeslett"}
          </span>
          <span className="text-blekk-dempet">Rom</span>
          <span>{okt.sted ?? "–"}</span>
          {vurderinger.length > 0 && (
            <>
              <span className="text-blekk-dempet">Vurdering</span>
              <span className="flex flex-col gap-0.5">
                {vurderinger.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => onApneVurdering(v)}
                    className="text-left font-medium text-vurdering-tekst hover:underline"
                  >
                    {v.tittel} · Åpne i{" "}
                    <i>{v.type === "muntlig" ? "Samtaler" : "Vurderinger"}</i> →
                  </button>
                ))}
              </span>
            </>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-2.5">
          <div>
            <div className="mb-0.5 text-etikett text-blekk-dempet">Plan</div>
            <div className={okt.plan ? "" : "text-blekk-svak"}>
              {okt.plan ? enLinje(okt.plan) : "Ingen plan ennå"}
            </div>
          </div>
          <div>
            <div className="mb-0.5 text-etikett text-blekk-dempet">
              Fra forrige økt
            </div>
            <div className={forrige?.logg ? "text-blekk" : "text-blekk-svak"}>
              {!forrige
                ? "Første økt i faget"
                : forrige.logg
                  ? `«${enLinje(forrige.logg)}»`
                  : "Ingen notat"}
            </div>
          </div>
        </div>
      </div>
      <Tastestripe>
        <Tasthint taster={["↑", "↓"]}>neste økt</Tasthint>
        <Tasthint taster={["mellomrom"]}>lukk</Tasthint>
        <button
          onClick={onApne}
          className="flex h-6 items-center gap-2 rounded-full bg-aksent px-3 text-etikett font-medium text-ark hover:bg-aksent-mork"
        >
          Åpne økta <span className="opacity-70">↵</span>
        </button>
      </Tastestripe>
    </div>
  );
}

function leggTilMin(kl: string, min: number): string {
  const [t, m] = kl.split(":").map(Number);
  const tot = t * 60 + m + min;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(tot / 60) % 24)}:${p(tot % 60)}`;
}

/** «tor» */
function ukedag(dato: string): string {
  return new Date(`${dato}T00:00:00`)
    .toLocaleDateString("nb-NO", { weekday: "short" })
    .replace(/\.$/, "");
}

/** «torsdag 15. oktober» */
function langDato(dato: string): string {
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/**
 * Skåringene i økta som én tett stripe — grønt, gult, rødt i forhold.
 * Ikke et diagram, bare noe å skumme nedover.
 */
function Innsats({ okt }: { okt: Okt }) {
  const talt = okt.gronn + okt.gul + okt.rod;
  if (talt === 0)
    return <span className="text-liten text-blekk-svakest">–</span>;

  const deler = [
    { antall: okt.gronn, farge: TRAFIKKLYS.gronn },
    { antall: okt.gul, farge: TRAFIKKLYS.gul },
    { antall: okt.rod, farge: TRAFIKKLYS.rod },
  ];

  return (
    <span
      title={`${okt.gronn} grønne, ${okt.gul} gule, ${okt.rod} røde`}
      className="flex h-2 w-20 overflow-clip rounded-full bg-flate"
    >
      {deler.map((d, i) => (
        <span
          key={i}
          style={{ width: `${(d.antall / talt) * 100}%`, background: d.farge }}
        />
      ))}
    </span>
  );
}

function Status({ okt }: { okt: Okt }) {
  if (okt.skaret === 0)
    return (
      <span className="w-14 shrink-0 text-right text-blekk-svakest">·</span>
    );
  if (okt.skaret >= okt.elever)
    return (
      <span className="w-14 shrink-0 text-right text-lys-gronn">
        <Ikon navn="hake" />
      </span>
    );
  return (
    <span className="w-14 shrink-0 text-right tabular-nums text-blekk-dempet">
      {okt.skaret}/{okt.elever}
    </span>
  );
}

function NyOkt({
  fag,
  startFagId,
  sisteDato,
  onLagret,
  onAvbryt,
}: {
  fag: FagIAr[];
  startFagId?: string;
  sisteDato?: string;
  onLagret: (id: string) => void;
  onAvbryt: () => void;
}) {
  const [fagId, setFagId] = useState(startFagId ?? fag[0]?.id ?? "");
  const [dato, setDato] = useState(sisteDato ?? iDag());
  const [klokke, setKlokke] = useState("");
  const [varighet, setVarighet] = useState("");
  const [global, setGlobal] = useState("180");

  useEffect(() => {
    void hentInnstilling("standard_varighet_min").then((v) =>
      setGlobal(v ?? "180"),
    );
  }, []);

  const valgtFag = fag.find((f) => f.id === fagId);
  const arvet = String(valgtFag?.standardVarighetMin ?? global);

  async function lagre() {
    if (!valgtFag || !dato) return;
    const id = await opprettOkt(
      valgtFag.id,
      valgtFag.fagkode,
      dato,
      klokke || null,
      Number(varighet || arvet),
    );
    onLagret(id);
  }

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 border border-linje bg-flate p-3">
      <label className="block">
        <span className="mb-1 block text-etikett uppercase tracking-etikett text-blekk-dempet">
          Fag
        </span>
        <Velger
          verdi={fagId}
          settVerdi={setFagId}
          valg={fag.map((f) => ({
            verdi: f.id,
            tekst: f.kode,
            farge: f.farge,
            firkant: true,
          }))}
        />
      </label>

      <Felt
        etikett="Dato"
        verdi={dato}
        settVerdi={setDato}
        type="date"
        bredde="w-40"
      />
      <Felt
        etikett="Klokkeslett"
        verdi={klokke}
        settVerdi={setKlokke}
        plassholder="09:15"
        bredde="w-28"
        onEnter={lagre}
      />
      <Felt
        etikett="Varighet"
        verdi={varighet}
        settVerdi={setVarighet}
        plassholder={`${arvet} (arvet)`}
        bredde="w-32"
        onEnter={lagre}
      />

      <Knapp variant="primar" onClick={lagre} disabled={!fagId || !dato}>
        Opprett
      </Knapp>
      <Knapp variant="stille" onClick={onAvbryt}>
        Avbryt
      </Knapp>
    </div>
  );
}

function iDag(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** «8.10» */
function kortDato(dato: string): string {
  const d = new Date(`${dato}T00:00:00`);
  return `${d.getDate()}.${d.getMonth() + 1}`;
}

/** Øktene gruppert per måned, i den rekkefølgen de kom inn. */
function perManed(okter: Okt[]): [string, Okt[]][] {
  const kart = new Map<string, Okt[]>();
  for (const o of okter) {
    const m = o.dato.slice(0, 7);
    kart.set(m, [...(kart.get(m) ?? []), o]);
  }
  return [...kart.entries()];
}

function manedsnavn(dato: string): string {
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    month: "long",
    year: "numeric",
  });
}

function timer(minutter: number): string {
  return `${Math.round((minutter / 60) * 10) / 10} timer`;
}
