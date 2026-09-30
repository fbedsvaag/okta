import { useEffect, useMemo, useRef, useState } from "react";
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
  Felt,
  Ikon,
  Kappet,
  Knapp,
  Kolonnevelger,
  Kontekstmeny,
  Menyvalg,
  Tomtilstand,
  Velger,
} from "../ui/felles";
import { invoke } from "@tauri-apps/api/core";
import { OktPanel } from "./OktPanel";
import { Arsplan } from "./Arsplan";
import { Arsplanmeny } from "./Arsplanmeny";
import { hentArk, type Ark } from "../data/arsplanark";
import { TRAFIKKLYS } from "../ui/farger";
import {
  fargelegg,
  hentAllePerioder,
  periodeFor,
  type Periode,
} from "../data/perioder";
import { Penselrad, VISK, type Pensel } from "./Penselrad";
import { ElevPanel } from "./ElevPanel";
import { useGlidende } from "../ui/bevegelse";
import type { Skolear } from "../data/skolear";
import { NySerie } from "./NySerie";

/**
 * Årsplan — økter, SPEC §4.2.
 *
 * Alle fag i én kronologisk liste, med fagfilter og søk i tema. Klikk på en
 * rad åpner det utvidede viewet til høyre — ikke en ny side.
 */
export type KolonneId =
  | "uke"
  | "tid"
  | "varighet"
  | "periode"
  | "vurdering"
  | "logg"
  | "innsats"
  | "sted"
  | "agenda";

const STANDARDKOLONNER: KolonneId[] = [
  "uke",
  "tid",
  "varighet",
  "periode",
  "vurdering",
  "innsats",
];

export function Okter({
  skolear,
  fag,
  startValgt = null,
  onApnePerioder,
  bryter,
}: {
  /** Liste | Kalender | Perioder, først i verktøylinja */
  bryter?: React.ReactNode;
  skolear: Skolear;
  fag: FagIAr[];
  onApnePerioder: () => void;
  /** Økt som skal stå åpen med en gang, f.eks. klikket fra forsiden. */
  startValgt?: string | null;
}) {
  const [okter, setOkter] = useState<Okt[]>([]);
  const [valgt, setValgt] = useState<string | null>(startValgt);
  const [filterFag, setFilterFag] = useState("");
  const [sok, setSok] = useState("");
  const [lagerNy, setLagerNy] = useState(false);
  const [lagerSerie, setLagerSerie] = useState(false);
  const [valgtElev, setValgtElev] = useState<string | null>(null);
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
  // Perioden som males med akkurat nå, eller viskelæret (§4.2).
  const [pensel, setPensel] = useState<Pensel>(null);

  // Penselen hører til ett fag. Byttes faget, legges den fra seg.
  useEffect(() => setPensel(null), [filterFag]);

  async function mal(ider: string[], p: Exclude<Pensel, null>) {
    await fargelegg(ider, p === VISK ? null : p);
    await last();
  }

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
    void hentInnstilling("okt_kolonner").then((v) => {
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
      void settInnstilling("okt_kolonner", JSON.stringify([...ny]));
      return ny;
    });
  }

  // Navigerer du hit med en økt i sikte — fra forsiden, kalenderen eller et
  // heatmap — skal den åpne seg, også når panelet allerede står åpent på en
  // annen økt. Historikkpilene bruker samme vei.
  useEffect(() => {
    if (startValgt) setValgt(startValgt);
  }, [startValgt]);

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

  const synlige = useMemo(() => {
    const s = sok.trim().toLocaleLowerCase("nb-NO");
    return okter.filter((o) => {
      if (filterFag && o.skolearFagId !== filterFag) return false;
      if (s && !(o.tema ?? "").toLocaleLowerCase("nb-NO").includes(s))
        return false;
      return true;
    });
  }, [okter, filterFag, sok]);

  // Perioden står på økta; den settes ved å fargelegge (§4.2).
  const periodePerOkt = useMemo(() => {
    const kart = new Map<string, Periode>();
    for (const o of okter) {
      const egne = perioder.filter((p) => p.skolearFagId === o.skolearFagId);
      const p = periodeFor(o, egne);
      if (p) kart.set(o.id, p);
    }
    return kart;
  }, [okter, perioder]);

  // Periodens farge per økt, til tonen over raden. Vises uavhengig av om
  // Periode-kolonnen er slått på: det er fargen som er periodiseringen.
  const periodeFarge = useMemo(() => {
    const kart = new Map<string, string>();
    for (const [id, p] of periodePerOkt) if (p.farge) kart.set(id, p.farge);
    return kart;
  }, [periodePerOkt]);

  const periodeAntall = useMemo(() => {
    const kart = new Map<string, number>();
    for (const p of periodePerOkt.values())
      kart.set(p.id, (kart.get(p.id) ?? 0) + 1);
    return kart;
  }, [periodePerOkt]);

  const { vist: apen, apen: glir } = useGlidende(
    okter.find((o) => o.id === valgt) ?? null,
  );

  return (
    <>
      <Arsplan ark={ark} />

      <div className="ikkeutskrift mx-auto flex min-h-0 w-full max-w-6xl flex-1 gap-0 overflow-clip">
        <div
          className={`liste-bredde flex min-w-0 flex-col ${glir ? "hidden w-full pr-4 lg:flex lg:w-1/3" : "w-full"}`}
        >
          {/* Verktøylinja er header: den ruller ikke bort, og månedene
            fester seg rett under den. */}
          <div className="shrink-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {bryter}
              <Felt
                verdi={sok}
                settVerdi={setSok}
                plassholder="Søk i tema"
                bredde={apen ? "w-full" : "w-56"}
              />
              <Velger verdi={filterFag} settVerdi={setFilterFag}>
                <option value="">Alle fag</option>
                {fag.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.kode}
                  </option>
                ))}
              </Velger>
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
                <Knapp variant="primar" onClick={() => setLagerNy(true)}>
                  + Ny økt
                </Knapp>
              </div>
            </div>
          </div>

          {/*
            Periodiseringen som fargelegging. Bare når ett fag er valgt —
            periodene hører til faget.
          */}
          {filterFag && (
            <div className="shrink-0">
              <Penselrad
                skolearFagId={filterFag}
                perioder={perioder.filter((p) => p.skolearFagId === filterFag)}
                antall={periodeAntall}
                pensel={pensel}
                harMerket={merket.size > 0}
                onVelg={setPensel}
                onMalMerkede={async (p) => {
                  await mal([...merket], p);
                  setMerket(new Set());
                }}
                onEndret={() => void last()}
                onNy={async (id) => {
                  await last();
                  setPensel(id);
                }}
              />
            </div>
          )}

          {/* Én rullesone. Hadde lista hatt sin egen overflow-x, ville
            månedene festet seg til DEN i stedet for til denne. */}
          <div className="min-h-0 flex-1 overflow-auto">
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
                  setValgt(id);
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
                    : "Ingen økter i dette skoleåret ennå — opprett den første."
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
                valgt={valgt}
                merket={merket}
                vis={apen ? new Set<KolonneId>() : kolonner}
                blokkert={blokkert}
                vurderinger={vurderinger}
                perioder={medPerioder ? periodePerOkt : new Map()}
                periodeFarge={periodeFarge}
                pensel={pensel}
                penselFarge={
                  pensel && pensel !== VISK
                    ? (perioder.find((p) => p.id === pensel)?.farge ?? null)
                    : null
                }
                onMal={(ider) => pensel && void mal(ider, pensel)}
                onTema={(id, tema) => void lagreTema(id, tema)}
                onApnePerioder={onApnePerioder}
                onVelg={setValgt}
                onMerk={(id, pa) =>
                  setMerket((f) => {
                    const ny = new Set(f);
                    if (pa) ny.add(id);
                    else ny.delete(id);
                    return ny;
                  })
                }
                onMerkAlle={(pa) =>
                  setMerket(pa ? new Set(synlige.map((o) => o.id)) : new Set())
                }
                onMeny={(okt, x, y) => setMeny({ okt, x, y })}
              />
            )}

            {meny && (
              <Kontekstmeny x={meny.x} y={meny.y} onLukk={() => setMeny(null)}>
                <Menyvalg
                  onKlikk={() => {
                    setValgt(meny.okt.id);
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
                <div className="ml-auto flex items-center gap-2">
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

        {apen && (
          <div
            className={`panel min-h-0 min-w-0 w-full overflow-auto lg:w-2/3 ${glir ? "" : "panel-ute"}`}
          >
            {valgtElev ? (
              <ElevPanel
                key={valgtElev}
                elevId={valgtElev}
                aktivtSkolearId={skolearId}
                onLukk={() => setValgtElev(null)}
                onApneOkt={(id) => {
                  setValgtElev(null);
                  setValgt(id);
                }}
              />
            ) : (
              <OktPanel
                okt={apen}
                onLukk={() => setValgt(null)}
                onEndret={last}
                onApneElev={setValgtElev}
              />
            )}
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Kolonnene du kan slå av og på. Fag, dato, tema og skåret er alltid med —
 * uten dem er ikke raden en økt lenger.
 */
const VALGBARE: { id: KolonneId; navn: string }[] = [
  { id: "uke", navn: "Uke" },
  { id: "tid", navn: "Tid" },
  { id: "varighet", navn: "Varighet" },
  { id: "periode", navn: "Periode" },
  { id: "vurdering", navn: "Vurdering" },
  { id: "logg", navn: "Øktlogg" },
  { id: "innsats", navn: "Innsats" },
  { id: "sted", navn: "Sted" },
  { id: "agenda", navn: "Agenda" },
];

function Liste({
  okter,
  valgt,
  merket,
  vis,
  blokkert,
  vurderinger,
  perioder,
  periodeFarge,
  pensel,
  penselFarge,
  onMal,
  onTema,
  onApnePerioder,
  onVelg,
  onMerk,
  onMerkAlle,
  onMeny,
}: {
  okter: Okt[];
  valgt: string | null;
  merket: Set<string>;
  vis: Set<KolonneId>;
  blokkert: Map<string, Blokkering>;
  vurderinger: Map<string, OktVurdering[]>;
  perioder: Map<string, Periode>;
  /** periodens farge per økt, til tonen over raden */
  periodeFarge: Map<string, string>;
  /** perioden som males med, eller viskelæret; null = vanlig klikk */
  pensel: Pensel;
  /** fargen på penselen, til å vise det som males før det er lagret */
  penselFarge: string | null;
  onMal: (ider: string[]) => void;
  onTema: (id: string, tema: string | null) => void;
  onApnePerioder: () => void;
  onVelg: (id: string) => void;
  onMerk: (id: string, pa: boolean) => void;
  onMerkAlle: (pa: boolean) => void;
  onMeny: (okt: Okt, x: number, y: number) => void;
}) {
  const alleMerket = okter.length > 0 && okter.every((o) => merket.has(o.id));

  // Fargelegging med dra: museknappen ned på én rad, over flere, og slipp.
  // Radene som males vises med penselens farge med en gang, og lagres samlet
  // når knappen slippes.
  const [malte, setMalte] = useState<Set<string>>(new Set());
  const drar = useRef(false);

  useEffect(() => {
    const slipp = () => {
      if (!drar.current) return;
      drar.current = false;
      setMalte((m) => {
        if (m.size > 0) onMal([...m]);
        return new Set();
      });
    };
    window.addEventListener("mouseup", slipp);
    return () => window.removeEventListener("mouseup", slipp);
  }, [onMal]);

  /** Tonen over raden: det som males nå, ellers periodens farge. */
  function tone(id: string): string | undefined {
    if (malte.has(id)) return penselFarge ? `${penselFarge}33` : undefined;
    const f = periodeFarge.get(id);
    return f ? `${f}1f` : undefined;
  }

  /** Enter hopper til neste rads tema, Shift+Enter til forrige. */
  function hopp(fra: HTMLInputElement, retning: 1 | -1) {
    const alle = [
      ...document.querySelectorAll<HTMLInputElement>("input[data-tema]"),
    ];
    const neste = alle[alle.indexOf(fra) + retning];
    if (neste) {
      neste.focus();
      neste.select();
    } else fra.blur();
  }

  return (
    <div>
      <div className="flex items-center gap-3 border-b border-linje px-2 py-1 text-etikett uppercase tracking-etikett text-blekk-dempet">
        <input
          type="checkbox"
          checked={alleMerket}
          title={alleMerket ? "Fjern merkingen" : "Merk alle i lista"}
          onChange={(e) => onMerkAlle(e.target.checked)}
          className="shrink-0"
        />
        {vis.has("uke") && (
          <span className="w-7 shrink-0" title="Ukenummer">
            Uke
          </span>
        )}
        <span className="w-[3px] shrink-0" />
        <span className="w-20 shrink-0">Fag</span>
        <span className="w-24 shrink-0">Dato</span>
        {vis.has("tid") && <span className="w-12 shrink-0">Tid</span>}
        {vis.has("varighet") && (
          <span className="w-16 shrink-0 text-right">Varighet</span>
        )}
        <span className="flex-1">Tema</span>
        {vis.has("periode") && <span className="w-36 shrink-0">Periode</span>}
        {vis.has("vurdering") && (
          <span className="w-40 shrink-0">Vurdering</span>
        )}
        {vis.has("sted") && <span className="w-24 shrink-0">Sted</span>}
        {vis.has("agenda") && <span className="w-48 shrink-0">Agenda</span>}
        {vis.has("logg") && <span className="w-40 shrink-0">Øktlogg</span>}
        {vis.has("innsats") && <span className="w-24 shrink-0">Innsats</span>}
        <span className="w-14 shrink-0 text-right">Oppmøte</span>
      </div>

      {/*
        Én bolk per måned, ikke én per økt. Overskriften kan bare feste seg
        innenfor sin egen forelder — lå den i en boks på høyde med én rad,
        hadde den ingenting å stå i. Nå blir august stående til september
        skyver den opp.
      */}
      {perManed(okter).map(([maned, gruppe]) => (
        <div key={maned}>
          <div className="sticky top-0 z-10 border-y border-linje-medium bg-flate px-2 py-1 text-etikett uppercase tracking-etikett text-blekk-dempet">
            {manedsnavn(maned + "-01")}
          </div>
          {gruppe.map((o) => (
            <div key={o.id}>
              {/*
                Avkrysningsboksen ligger utenfor knappen, ikke inni: en knapp
                kan ikke inneholde en annen kontroll. Derfor bærer wrapperen
                raden sin ramme, og knappen fyller resten av bredden.
              */}
              <div
                onContextMenu={(e) => {
                  e.preventDefault();
                  onMeny(o, e.clientX, e.clientY);
                }}
                onMouseDown={(e) => {
                  if (!pensel || e.button !== 0) return;
                  if ((e.target as HTMLElement).closest("input")) return;
                  // Ingen tekstmarkering mens det males.
                  e.preventDefault();
                  drar.current = true;
                  setMalte(new Set([o.id]));
                }}
                onMouseOver={() => {
                  // mouseover, ikke mouseenter: den kommer hver gang musa er
                  // over raden, og å legge samme rad til på nytt gjør ingenting.
                  if (drar.current && !malte.has(o.id))
                    setMalte((m) => new Set(m).add(o.id));
                }}
                style={
                  valgt === o.id || merket.has(o.id)
                    ? undefined
                    : { background: tone(o.id) }
                }
                className={`flex w-full items-center gap-3 border-b border-linje-svak px-2 ${
                  pensel ? "cursor-cell select-none" : ""
                } ${
                  valgt === o.id
                    ? "bg-valgt"
                    : merket.has(o.id)
                      ? "bg-flate-svak"
                      : "hover:bg-flate"
                }`}
              >
                <input
                  type="checkbox"
                  checked={merket.has(o.id)}
                  onChange={(e) => onMerk(o.id, e.target.checked)}
                  title="Merk for sletting eller fargelegging"
                  className="shrink-0"
                />
                {/*
                  Raden er ikke en <button>: tema-feltet ligger inni, og en
                  knapp kan ikke inneholde et felt. Klikk hvor som helst
                  utenom feltet åpner økta.
                */}
                <div
                  role="button"
                  onClick={(e) => {
                    if (pensel) return;
                    if ((e.target as HTMLElement).closest("input")) return;
                    onVelg(o.id);
                  }}
                  className="flex min-w-0 flex-1 cursor-default items-center gap-3 py-1 text-left text-brod"
                >
                  {vis.has("uke") && (
                    <span className="w-7 shrink-0 tabular-nums text-blekk-svak">
                      {ukenummer(o.dato)}
                    </span>
                  )}
                  <span
                    aria-hidden
                    className="h-3.5 w-[3px] shrink-0 rounded-full"
                    style={{
                      background: o.farge ?? "var(--color-linje-sterk)",
                    }}
                  />
                  <Kappet
                    verdi={o.fagKode}
                    klasse="w-20 shrink-0 font-medium"
                  />
                  <span
                    className={`w-24 shrink-0 tabular-nums ${
                      blokkert.has(o.id)
                        ? "font-medium text-feil"
                        : "text-blekk-dempet"
                    }`}
                    title={blokkert.get(o.id)?.navn}
                  >
                    {kortDato(o.dato)}
                    {blokkert.has(o.id) && " !"}
                  </span>
                  {vis.has("tid") && (
                    <span className="w-12 shrink-0 tabular-nums text-blekk-dempet">
                      {o.klokkeslett ?? "–"}
                    </span>
                  )}
                  {vis.has("varighet") && (
                    <span className="w-16 shrink-0 text-right tabular-nums text-blekk-dempet">
                      {o.varighetMin} min
                    </span>
                  )}
                  <input
                    data-tema
                    defaultValue={o.tema ?? ""}
                    key={o.tema ?? ""}
                    placeholder="Skriv tema …"
                    readOnly={pensel !== null}
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
                    className={`min-w-0 flex-1 truncate rounded border border-transparent bg-transparent px-1 py-0.5 outline-none placeholder:text-blekk-svakest ${
                      pensel
                        ? "pointer-events-none"
                        : "hover:border-linje focus:border-aksent focus:bg-ark"
                    }`}
                  />
                  {vis.has("periode") && (
                    <span className="w-36 shrink-0 truncate">
                      {perioder.has(o.id) ? (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            onApnePerioder();
                          }}
                          title={`${perioder.get(o.id)!.navn} — åpne periodevisningen`}
                          className="rounded-sm bg-flate px-1.5 py-0.5 text-liten text-blekk-dempet hover:bg-linje-medium"
                        >
                          {perioder.get(o.id)!.navn}
                        </span>
                      ) : (
                        <span className="text-blekk-svakest">—</span>
                      )}
                    </span>
                  )}
                  {vis.has("vurdering") && (
                    <Kappet
                      verdi={(vurderinger.get(o.id) ?? [])
                        .map((v) => v.tittel)
                        .join(", ")}
                      tom=""
                      klasse="w-40 shrink-0 text-blekk-dempet"
                    />
                  )}
                  {vis.has("sted") && (
                    <span
                      className="w-24 shrink-0 truncate"
                      title={o.sted ?? undefined}
                    >
                      {o.sted ?? ""}
                    </span>
                  )}
                  {vis.has("agenda") && (
                    <span
                      className="w-48 shrink-0 truncate text-liten text-blekk-dempet"
                      title={o.agenda ?? undefined}
                    >
                      {o.agenda ?? ""}
                    </span>
                  )}
                  {vis.has("logg") && (
                    <span
                      className="w-40 shrink-0 truncate text-liten italic text-blekk-dempet"
                      title={o.logg ?? undefined}
                    >
                      {o.logg ?? ""}
                    </span>
                  )}
                  {vis.has("innsats") && (
                    <span className="w-24 shrink-0">
                      <Innsats okt={o} />
                    </span>
                  )}
                  <Status okt={o} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Skåringene i økta som én tett stripe — grønt, gult, rødt i forhold.
 * Ikke et diagram, bare noe å skumme nedover.
 */
function Innsats({ okt }: { okt: Okt }) {
  const talt = okt.gronn + okt.gul + okt.rod;
  if (talt === 0)
    return <span className="text-liten text-blekk-svakest">—</span>;

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
        <select
          value={fagId}
          onChange={(e) => setFagId(e.target.value)}
          className="rounded border border-linje bg-ark px-2 py-1.5 text-brod"
        >
          {fag.map((f) => (
            <option key={f.id} value={f.id}>
              {f.kode}
            </option>
          ))}
        </select>
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

function kortDato(dato: string): string {
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
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
