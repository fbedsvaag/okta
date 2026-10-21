import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { flushSync } from "react-dom";
import { confirm as bekreft } from "@tauri-apps/plugin-dialog";
import {
  hentOkter,
  endreOkt,
  hentOktVurderinger,
  opprettOkt,
  slettetekst,
  byttOkter,
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
import { hentAllePerioder, periodeFor, type Periode } from "../data/perioder";
import {
  Periodefiltre,
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
import { Avkrysning, nyttValg } from "../ui/Flervalg";
import { Oktvalg, settPeriodeMedAngre } from "./Oktvalg";
import { DRATID, useDra } from "../ui/dra";
import { leggTilAngring } from "../ui/angre";
import { visToast } from "../ui/Toast";
import { Fagbrytere, useSkjulteFag } from "./Fagbrytere";

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
  // Fagene som er skjult under «Alle fag», huskes for lista (17.1).
  const [skjultFag, vekslFag] = useSkjulteFag("okter_skjulte_fag");
  // Perioden lista er filtrert på (merkelappene over lista).
  const [periodeFilter, setPeriodeFilter] = useState<Periodefilter>(null);
  // Raden som sist ble krysset av, så ⇧-klikk kan velge et spenn (16.3).
  const sistKrysset = useRef<string | null>(null);
  // De to øktene som nettopp byttet innhold, blinker kort (16.4).
  const [blink, setBlink] = useState<Set<string>>(new Set());

  /**
   * Bytter innholdet i to økter (16.4). Datoene, tid og rom står. Skårede
   * økter ligger fast. Angres med ⌘Z, som er å bytte de samme igjen.
   */
  async function bytt(a: Okt, b: Okt) {
    if (a.id === b.id) return;
    if (a.skaret > 0 || b.skaret > 0) {
      visToast("Skårede økter ligger fast");
      return;
    }
    // Byttet vises med en gang; lagringen går etterpå, og lista lastes
    // på nytt fra databasen når den er ferdig (eller feilet).
    const felt = [
      "tema",
      "agenda",
      "plan",
      "lekse",
      "kompetansemal",
      "periodeId",
      "kladd",
    ] as const;
    const fra = (o: Okt) => Object.fromEntries(felt.map((f) => [f, o[f]]));
    setOkter((l) =>
      l.map((o) =>
        o.id === a.id
          ? { ...o, ...fra(b) }
          : o.id === b.id
            ? { ...o, ...fra(a) }
            : o,
      ),
    );
    setVurderinger((m) => {
      const n = new Map(m);
      const va = m.get(a.id);
      const vb = m.get(b.id);
      n.delete(a.id);
      n.delete(b.id);
      if (vb) n.set(a.id, vb);
      if (va) n.set(b.id, va);
      return n;
    });
    const ok = await byttOkter(a.id, b.id);
    await last();
    if (!ok) return;
    setBlink(new Set([a.id, b.id]));
    window.setTimeout(() => setBlink(new Set()), 950);
    const tekst = `Byttet ${kortDato(a.dato)} og ${kortDato(b.dato)}: «${
      a.tema || "tom økt"
    }» ligger nå ${kortDato(b.dato)}`;
    const angring = {
      tekst,
      angre: async () => {
        await byttOkter(a.id, b.id);
        await last();
      },
    };
    leggTilAngring(angring);
    visToast(tekst, { angring });
  }

  // Periodene hører til ett fag. Byttes faget, nullstilles filteret.
  useEffect(() => setPeriodeFilter(null), [filterFag]);

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
      // Alle fag: fagbrikkene skjuler og viser fag (17.1).
      if (!filterFag && skjultFag.has(o.skolearFagId)) return false;
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
  }, [okter, filterFag, sok, periodeFilter, periodePerOkt, skjultFag]);

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
    // Kolonnehodet og månedsoverskriften står fast øverst. Raden skal ligge under den med
    // én rad luft, så i dag-linja (16.5) og forrige økt synes over.
    const overskrift = [...sone.querySelectorAll<HTMLElement>("[data-fast]")]
      .slice(0, 2)
      .reduce((sum, el) => sum + el.offsetHeight, 0);
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
              {!filterFag && (
                <Fagbrytere
                  klasse=""
                  fag={fag}
                  samtaler={false}
                  skjult={skjultFag}
                  onVeksle={vekslFag}
                />
              )}
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

          {/*
            Ny økt og ny serie flyter som et kort over lista, der du står:
            lå de øverst i lista, var de ute av syne når man hadde rullet ned.
          */}
          {(lagerNy || lagerSerie) && (
            <div
              className="okter-flytende"
              onKeyDown={(e) => {
                if (e.key !== "Escape") return;
                e.stopPropagation();
                setLagerNy(false);
                setLagerSerie(false);
              }}
            >
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
            </div>
          )}

          {/* Én rullesone. Hadde lista hatt sin egen overflow-x, ville
            månedene festet seg til DEN i stedet for til denne. */}
          <div
            ref={rullesone}
            className="min-h-0 flex-1 scroll-pt-[64px] overflow-auto"
          >
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
                onMerkAlle={() => setMerket(new Set(synlige.map((o) => o.id)))}
                onKryss={(id, spenn) => {
                  setMerket((f) =>
                    nyttValg(
                      f,
                      synlige.map((o) => o.id),
                      id,
                      // ⇧ uten et klikk å regne fra: fra markøren.
                      sistKrysset.current ?? valgt,
                      spenn,
                    ),
                  );
                  sistKrysset.current = id;
                }}
                onKryssAlle={() =>
                  setMerket((f) =>
                    f.size === synlige.length
                      ? new Set()
                      : new Set(synlige.map((o) => o.id)),
                  )
                }
                periodevalg={(o) =>
                  perioder.filter((p) => p.skolearFagId === o.skolearFagId)
                }
                onBytt={(a, b) => void bytt(a, b)}
                blink={blink}
                onPeriode={(o, periode) => {
                  // Klikker man perioden på en valgt rad, gjelder valget
                  // alle valgte i samme fag (16.3).
                  const malet =
                    merket.has(o.id) && merket.size > 1
                      ? okter.filter(
                          (x) =>
                            merket.has(x.id) &&
                            x.skolearFagId === o.skolearFagId,
                        )
                      : [o];
                  void settPeriodeMedAngre(
                    malet,
                    periode?.id ?? null,
                    periode?.navn ?? null,
                    () => void last(),
                  );
                }}
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
              Flere økter samtidig (16.3): den mørke linja nederst, med
              Periode · Tid og rom · Lekse · Vurdering · Flytt · Slett.
            */}
            <Oktvalg
              valgte={okter.filter((o) => merket.has(o.id))}
              perioder={perioder}
              onEndret={() => void last()}
              onTom={() => setMerket(new Set())}
            />

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
  onMerkAlle,
  onApneVurdering,
  onMeny,
  onKryss,
  onKryssAlle,
  periodevalg,
  onPeriode,
  onBytt,
  blink,
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
  /** merk eller ta bort én rad; brukes når man maler et utvalg (19.3) */
  onMerk: (id: string, pa: boolean) => void;
  /** ⌘A: alle radene i lista */
  onMerkAlle: () => void;
  /** muntlig: trekningen i Samtaler; ellers vurderingskortet */
  onApneVurdering: (v: OktVurdering) => void;
  onMeny: (okt: Okt, x: number, y: number) => void;
  /** avkrysningen i raden; spenn: ⇧ holdt inne */
  onKryss: (id: string, spenn: boolean) => void;
  onKryssAlle: () => void;
  /** periodene økta kan få: de i dens fag */
  periodevalg: (okt: Okt) => Periode[];
  onPeriode: (okt: Okt, periode: Periode | null) => void;
  /** dra en økt og slipp på en annen, eller ⌥↑↓: de bytter innhold */
  onBytt: (a: Okt, b: Okt) => void;
  /** øktene som nettopp byttet, og blinker kort */
  blink: Set<string>;
}) {
  const [apen, setApen] = useState<string | null>(null);
  // Bytt to økter (16.4): samme dra-mekanikk som samtaletimeplanen. Hver
  // rad er sin egen gruppe, og alle er «fulle», så et slipp er alltid et
  // bytte, aldri en innsetting.
  const {
    dra,
    reg,
    begynn,
    startPos,
    startRom,
    draget: dradd,
  } = useDra({
    full: () => true,
    nokkel: () => undefined,
    onSlipp: (fra, mal) => {
      const a = okter[fra.gruppe];
      const b = okter[mal.gruppe];
      if (!mal.bytt || !a || !b || a.id === b.id) return;
      // Skåret: ingen landing; byttet sier selv fra at den ligger fast.
      if (b.skaret || a.skaret) return onBytt(a, b);
      // Innholdet du slapp, lander på målraden fra der det svevde.
      const fraA = startPos(fra);
      const tilA = startPos(mal);
      if (fraA !== undefined && tilA !== undefined && dra)
        setLanding({ id: b.id, y: fraA + dra.d - tilA, fase: 0 });
      onBytt(a, b);
    },
  });

  /*
   * Bytte ved å dra (16.4, gjort tydelig 21.10). Datoene står; innholdet
   * flytter seg. Mens du drar, svever innholdet ditt over radene, og det du
   * står over, glir opp eller ned til plassen du kom fra. Slik ser du
   * byttet før du slipper. Ved slipp lander innholdet der det svevde.
   */
  const fraNr = dra?.fra.gruppe ?? null;
  const malNr =
    dra?.mal?.bytt && dra.mal.gruppe !== fraNr ? dra.mal.gruppe : null;
  const malOkt = malNr !== null ? okter[malNr] : undefined;

  /*
   * Båndet på plassen du drar fra (21.10): et vindu inn i en rulletekst med
   * alle øktene, som ruller i takt med draget. `bandPos` er hvor i lista
   * midten av kortet står, som et desimaltall: 4,5 er midt mellom økt 4 og 5.
   */
  let bandPos: number | null = null;
  let radH = 30;
  if (dra && fraNr !== null) {
    const rom = okter.map((_, k) => startRom({ gruppe: k, nr: 0 }));
    const egen = rom[fraNr];
    if (egen) {
      radH = egen.b - egen.a;
      const midt = (egen.a + egen.b) / 2 + dra.d;
      const midter = rom.map((r) => (r ? (r.a + r.b) / 2 : NaN));
      bandPos = fraNr;
      for (let k = 0; k < midter.length - 1; k++) {
        const [m0, m1] = [midter[k], midter[k + 1]];
        if (midt >= m0 && midt < m1) {
          bandPos = k + (midt - m0) / (m1 - m0);
          break;
        }
      }
      if (midt < midter[0]) bandPos = 0;
      if (midt >= midter[midter.length - 1]) bandPos = midter.length - 1;
    }
  }
  const lastMal = !!malOkt && malOkt.skaret > 0;
  const [landing, setLanding] = useState<{
    id: string;
    y: number;
    fase: 0 | 1;
  } | null>(null);
  useLayoutEffect(() => {
    if (!landing || landing.fase === 1) return;
    // Én ramme i startposisjonen, så glir det på plass.
    const r = requestAnimationFrame(() =>
      setLanding((l) => (l ? { ...l, fase: 1 } : l)),
    );
    const t = window.setTimeout(() => setLanding(null), 400);
    return () => {
      cancelAnimationFrame(r);
      window.clearTimeout(t);
    };
  }, [landing?.id, landing?.fase]);

  /** Transform for innholdscellene i rad `i` (tema, periode, vurdering, agenda). */
  function innholdsstil(i: number, id: string): CSSProperties | undefined {
    if (fraNr === i && dra)
      return {
        transform: `translateY(${dra.d}px)`,
        transition: "none",
        position: "relative",
        zIndex: 41,
      };
    // Det du står over, blir der det er, tonet ned. Det reiser ikke til
    // plassen du kom fra; der vises en stille forhåndsvisning i stedet.
    if (malNr === i && !lastMal)
      return { opacity: 0.3, transition: "opacity 150ms ease-out" };
    if (landing?.id === id)
      return landing.fase === 0
        ? {
            transform: `translateY(${landing.y}px)`,
            transition: "none",
            position: "relative",
            zIndex: 41,
          }
        : {
            transform: "translateY(0)",
            transition: `transform ${DRATID}`,
            position: "relative",
            zIndex: 41,
          };
    if (dra) return { transition: "opacity 150ms ease-out" };
    return undefined;
  }
  const liste = useRef<HTMLDivElement>(null);

  // Mal et utvalg ved å dra over avkrysningene (19.3). Første rad avgjør om
  // det merkes eller tas bort. Uten bevegelse er det et vanlig klikk.
  const maling = useRef<{ pa: boolean; start: string; rorte: boolean } | null>(
    null,
  );
  const malt = useRef(false);
  function begynnMaling(e: React.PointerEvent, id: string) {
    if (e.button !== 0 || e.shiftKey || harModifikator(e)) return;
    maling.current = { pa: !merket.has(id), start: id, rorte: false };
    const slutt = () => {
      window.removeEventListener("pointerup", slutt);
      if (maling.current?.rorte) {
        // Klikket som følger slippet, skal ikke telle.
        malt.current = true;
        setTimeout(() => (malt.current = false), 0);
      }
      maling.current = null;
      liste.current?.classList.remove("select-none");
    };
    window.addEventListener("pointerup", slutt);
  }
  function malOver(id: string) {
    const m = maling.current;
    if (!m || (id === m.start && !m.rorte)) return;
    if (!m.rorte) {
      m.rorte = true;
      liste.current?.classList.add("select-none");
      onMerk(m.start, m.pa);
    }
    onMerk(id, m.pa);
  }
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
    "16px",
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

  /**
   * Temaet endres med dobbeltklikk (eller T), ikke ett klikk: da kan raden
   * dras i temaet uten at teksten markeres (21.10). Enter lagrer og går til
   * neste rads tema, Shift+Enter til forrige, så et helt år kan fylles ut
   * i ett strekk.
   */
  const [redigerer, setRedigerer] = useState<string | null>(null);
  function hopp(fra: string, retning: 1 | -1) {
    const i = okter.findIndex((o) => o.id === fra);
    const neste = okter[i + retning];
    setRedigerer(neste?.id ?? null);
    if (neste) onMarkor(neste.id);
    else liste.current?.focus();
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
    // ⌥↑ / ⌥↓ bytter med økta over eller under (16.4), også fra temafeltet.
    if (
      e.altKey &&
      !harModifikator(e) &&
      (e.key === "ArrowUp" || e.key === "ArrowDown")
    ) {
      const id =
        (e.target as HTMLElement).closest<HTMLElement>("[data-okt]")?.dataset
          .okt ?? valgt;
      const i = okter.findIndex((o) => o.id === id);
      const j = i + (e.key === "ArrowUp" ? -1 : 1);
      if (i >= 0 && okter[j]) {
        e.preventDefault();
        onBytt(okter[i], okter[j]);
        onMarkor(okter[j].id);
      }
      return;
    }
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
    } else if (e.key.toLowerCase() === "t") {
      e.preventDefault();
      if (valgt) setRedigerer(valgt);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (valgt) onVelg(valgt);
    } else if (e.key === "Escape" && apen) {
      e.preventDefault();
      e.stopPropagation();
      setApen(null);
    }
  }

  // Et klikk utenfor den utfoldede økta legger den sammen. Klikk i menyer,
  // ark og toasten over lista teller ikke som «utenfor».
  useEffect(() => {
    if (!apen) return;
    const ut = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest?.(`[data-okt="${CSS.escape(apen)}"]`)) return;
      if (
        t.closest?.(
          ".glass-meny, [role='listbox'], [role='menu'], [role='dialog'], .toast, .flervalgslinje",
        )
      )
        return;
      setApen(null);
    };
    window.addEventListener("mousedown", ut);
    return () => window.removeEventListener("mousedown", ut);
  }, [apen]);

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
      className="okter-liste uten-fokusring relative select-none outline-none"
    >
      {/* Markøren glir med piltastene (DESIGN.md §8). */}
      <Glideflate
        beholder={liste}
        mal={markorEl}
        klasse="z-[2] rounded-lg bg-[color-mix(in_srgb,var(--color-aksent)_8%,transparent)]"
      />
      {/* Kolonnehodet står fast mens lista ruller (19.2), i glass. */}
      <div
        data-fast
        className="okter-hode sticky top-0 z-20 grid h-[26px] items-center gap-x-3 border-b border-linje px-2 text-etikett text-blekk-dempet"
        style={kolonner}
      >
        <Avkrysning
          pa={okter.length > 0 && okter.every((o) => merket.has(o.id))}
          delvis={merket.size > 0 && okter.some((o) => !merket.has(o.id))}
          etikett="Velg alle"
          onKlikk={onKryssAlle}
        />
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
          <div
            data-fast
            className="okter-hode sticky top-[26px] z-10 border-b border-linje-medium px-2 pb-1 pt-3 text-liten font-semibold first-letter:uppercase"
          >
            {manedsnavn(maned + "-01")}
          </div>
          {gruppe.map((o) => {
            const i = okter.indexOf(o);
            const erApen = apen === o.id;
            const vurd = vurderinger.get(o.id) ?? [];
            // Utkast (§24) markeres ikke som vurderingsdag før de er bekreftet.
            const fast = vurd.some((v) => v.utkast !== 1);
            const per = perioder.get(o.id);
            return (
              <div
                key={o.id}
                data-okt={o.id}
                ref={reg({ gruppe: okter.indexOf(o), nr: 0 })}
                className="relative px-0"
              >
                {o.id === idagFor && <Idaglinje dato={idag} />}
                <div
                  onPointerDown={(e) => {
                    // Dra i tittelen eller i ⋮⋮ (16.4). Skårede ligger fast.
                    if (o.skaret > 0) return;
                    const mal = e.target as HTMLElement;
                    const p = { gruppe: okter.indexOf(o), nr: 0 };
                    if (mal.closest("[data-grep], [data-tema-tekst]"))
                      begynn(e, p);
                  }}
                  onPointerEnter={() => malOver(o.id)}
                  onMouseDown={(e) => {
                    // Ingen tekstmarkering når et drag eller ⇧-klikk begynner.
                    if (
                      e.shiftKey ||
                      (e.target as HTMLElement).closest(
                        "[data-tema-tekst], [data-grep]",
                      )
                    )
                      e.preventDefault();
                  }}
                  onClick={(e) => {
                    if (dradd.current || malt.current) return;
                    if ((e.target as HTMLElement).closest("input")) return;
                    // Andre klikk i et dobbeltklikk: titten blir stående.
                    if (e.detail > 1) return;
                    // Markering (19.3): ⌘ tar én, ⇧ et spenn, og når noe
                    // alt er valgt, velger et klikk på raden.
                    if (hovedtast(e) || e.shiftKey || merket.size > 0) {
                      onKryss(o.id, e.shiftKey);
                      onMarkor(o.id);
                      return;
                    }
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
                  data-dra-innhold={o.id}
                  style={{
                    ...kolonner,
                    // Gyllen strek til venstre på økter med vurdering (§6).
                    boxShadow: fast
                      ? "inset 3px 0 0 var(--color-vurdering)"
                      : undefined,
                  }}
                  className={`group relative grid h-[30px] cursor-default select-none items-center gap-x-3 px-2 text-[calc(13px*var(--tekst-skala))] tabular-nums ${
                    blink.has(o.id) ? "bytteblink" : ""
                  } ${
                    erApen
                      ? "rounded-t-lg bg-flate"
                      : merket.has(o.id)
                        ? "border-b border-linje-svak bg-valgt"
                        : fast
                          ? "border-b border-linje-svak bg-vurdering-flate hover:bg-flate-svak"
                          : "border-b border-linje-svak hover:bg-flate-svak"
                  }`}
                >
                  {/* Kortet bak innholdet som svever eller glir (16.4). */}
                  {fraNr === i && dra && (
                    <span
                      aria-hidden
                      className={`pointer-events-none absolute -inset-x-2 -inset-y-[3px] rounded-lg bg-ark ${
                        lastMal
                          ? "shadow-[0_10px_28px_rgba(36,31,51,0.22),inset_0_0_0_1.5px_var(--color-feil)]"
                          : "shadow-[0_10px_28px_rgba(36,31,51,0.22),inset_0_0_0_1.5px_var(--color-aksent)]"
                      }`}
                      style={{
                        ...innholdsstil(i, o.id),
                        gridRow: 1,
                        gridColumn: `${visFag ? 6 : 5} / -1`,
                        position: "absolute",
                        zIndex: 40,
                      }}
                    />
                  )}
                  {/* Plassen du drar fra: båndet som ruller med draget. */}
                  {fraNr === i && bandPos !== null && (
                    <span
                      aria-hidden
                      className="dra-band pointer-events-none absolute inset-y-0 overflow-hidden border-l-2 border-aksent/50"
                      style={{
                        gridRow: 1,
                        gridColumn: `${visFag ? 6 : 5} / -1`,
                        left: -8,
                        right: 0,
                      }}
                    >
                      {okter.map((b, k) => {
                        const avstand = k - bandPos!;
                        if (k === fraNr || Math.abs(avstand) > 1.5) return null;
                        const per = perioder.get(b.id);
                        return (
                          <span
                            key={b.id}
                            className="absolute inset-x-0 grid items-center gap-x-3 pl-2 text-blekk-dempet"
                            style={{
                              top: avstand * radH,
                              height: radH,
                              gridTemplateColumns: spor
                                .split(" ")
                                .slice(visFag ? 5 : 4)
                                .join(" "),
                              opacity: Math.max(0, 1 - Math.abs(avstand) * 0.9),
                            }}
                          >
                            <span
                              className={`min-w-0 truncate ${b.skaret ? "text-feil" : ""}`}
                            >
                              {b.skaret
                                ? "Skåret, ligger fast"
                                : b.tema || "tom økt"}
                            </span>
                            {per && !b.skaret && (
                              <span className="flex min-w-0 items-center gap-1.5 pl-2.5 text-[calc(12.5px*var(--tekst-skala))]">
                                <span
                                  className="h-[7px] w-[7px] shrink-0 rounded-full"
                                  style={{ background: per.farge ?? undefined }}
                                />
                                <span className="truncate">{per.navn}</span>
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </span>
                  )}
                  {/* ⋮⋮: dra til en annen økt for å bytte innhold (16.4). */}
                  {!o.skaret && (
                    <span
                      data-grep
                      title="Dra til en annen økt for å bytte innhold"
                      className="absolute -left-3.5 top-1/2 -translate-y-1/2 cursor-grab touch-none select-none px-0.5 text-[13px] tracking-[-1px] text-blekk-svakest opacity-0 hover:text-aksent group-hover:opacity-100"
                    >
                      ⋮⋮
                    </span>
                  )}
                  <span
                    className="flex"
                    onPointerDown={(e) => begynnMaling(e, o.id)}
                  >
                    <Avkrysning
                      pa={merket.has(o.id)}
                      etikett={`Velg ${o.tema ?? kortDato(o.dato)}`}
                      onKlikk={(e) => {
                        if (malt.current) return;
                        onKryss(o.id, e.shiftKey);
                      }}
                    />
                  </span>
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
                  <span
                    className="relative flex min-w-0 items-center"
                    style={innholdsstil(i, o.id)}
                  >
                    {vurd.length > 0 && (
                      <Vurderingsikon
                        type={vurd[0].type}
                        utkast={vurd.every((v) => v.utkast === 1)}
                        klasse="absolute -left-[21px] top-1/2 -mt-2"
                      />
                    )}
                    {redigerer === o.id ? (
                      <input
                        data-tema
                        autoFocus
                        defaultValue={o.tema ?? ""}
                        placeholder="Skriv tema …"
                        onFocus={(e) => e.currentTarget.select()}
                        onKeyDown={(e) => {
                          const ny = e.currentTarget.value.trim() || null;
                          if (e.key === "Enter") {
                            e.preventDefault();
                            e.stopPropagation();
                            if (ny !== o.tema) onTema(o.id, ny);
                            hopp(o.id, e.shiftKey ? -1 : 1);
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            e.stopPropagation();
                            e.currentTarget.value = o.tema ?? "";
                            setRedigerer(null);
                            liste.current?.focus();
                          }
                        }}
                        onBlur={(e) => {
                          const ny = e.target.value.trim() || null;
                          if (ny !== o.tema) onTema(o.id, ny);
                          setRedigerer((r) => (r === o.id ? null : r));
                        }}
                        className={`-mx-1 w-full min-w-0 truncate rounded border border-aksent bg-ark px-1 py-0.5 outline-none placeholder:text-blekk-svakest ${
                          fast ? "font-semibold" : ""
                        }`}
                      />
                    ) : (
                      <span
                        data-tema-tekst
                        title={
                          o.tema
                            ? `${o.tema} · dobbeltklikk for å endre`
                            : "Dobbeltklikk for å skrive tema"
                        }
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setRedigerer(o.id);
                        }}
                        className={`-mx-1 min-w-0 flex-1 truncate border border-transparent px-1 py-0.5 ${
                          o.skaret ? "" : "cursor-grab active:cursor-grabbing"
                        } ${fast ? "font-semibold" : ""} ${
                          o.tema ? "" : "text-blekk-svakest"
                        }`}
                      >
                        {o.tema || "Skriv tema …"}
                      </span>
                    )}
                  </span>
                  {/* Perioden med ett klikk (16.2). */}
                  <span
                    className="min-w-0"
                    style={innholdsstil(i, o.id)}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                  >
                    <Velger
                      variant="brikke"
                      bredde="max-w-full"
                      etikett="Periode"
                      plassholder="Velg periode"
                      verdi={per?.id ?? ""}
                      settVerdi={(v) =>
                        onPeriode(
                          o,
                          periodevalg(o).find((p) => p.id === v) ?? null,
                        )
                      }
                      valg={[
                        { verdi: "", tekst: "Ingen periode", dempet: true },
                        ...periodevalg(o).map((p) => ({
                          verdi: p.id,
                          tekst: p.navn,
                          farge: p.farge,
                        })),
                      ]}
                    />
                  </span>
                  {/* Bare typen; temaet står i titten og på vurderingen. */}
                  <span className="min-w-0" style={innholdsstil(i, o.id)}>
                    <Kappet
                      verdi={[
                        ...new Set(
                          vurd.map(
                            (v) =>
                              vurderingstype(v.type) +
                              (v.utkast === 1 ? " (utkast)" : ""),
                          ),
                        ),
                      ].join(", ")}
                      tom=""
                      klasse="text-[calc(12.5px*var(--tekst-skala))] font-semibold text-vurdering-tekst"
                    />
                  </span>
                  {vis.has("varighet") && (
                    <span className="text-right text-blekk-dempet">
                      {o.varighetMin} min
                    </span>
                  )}
                  {vis.has("sted") && (
                    <Kappet verdi={o.sted} tom="" klasse="text-blekk-dempet" />
                  )}
                  {vis.has("agenda") && (
                    <span className="min-w-0" style={innholdsstil(i, o.id)}>
                      <Kappet
                        verdi={o.agenda}
                        tom=""
                        klasse="text-blekk-dempet"
                      />
                    </span>
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
                    {v.tittel}
                    {v.utkast === 1 && " (utkast)"} · Åpne i{" "}
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
      <Tastestripe id="titt">
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
