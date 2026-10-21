import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { confirm as bekreft } from "@tauri-apps/plugin-dialog";
import {
  blokkering,
  iso,
  rodekart,
  ukenummer,
  type Blokkering,
  type Fridag,
} from "../data/kalender";
import {
  hentFridager,
  hentInnstilling,
  settInnstilling,
  type Skolear,
} from "../data/skolear";
import {
  hentOkter,
  opprettOkt,
  slettetekst,
  slettOkter,
  type Okt,
} from "../data/okter";
import type { FagIAr } from "../data/fag";
import { Bryter, Fagfirkant, Knapp } from "../ui/felles";
import { Kalenderuke } from "./Kalenderuke";
import { hentSamtaledager, type Samtaledag } from "../data/samtale";
import { Fagbrytere, SAMTALER, useSkjulteFag } from "./Fagbrytere";

// --------------------------------------------------------------- cellehøyde

/** Bredden på ukenummerkolonna (1.6rem) og de fem stregene mellom kolonnene. */
const UKEKOLONNE = 25.6;
const STREKER = 5;

/**
 * Høyden på en dagrute i forhold til bredden.
 *
 * Ruta er litt høyere enn den er bred. Er vinduet smalt blir rutene lave og
 * det er plass til færre økter i hver; er det bredt, er det plass til flere.
 * Det er dette som gjør at høyden følger plassen som finnes i stedet for å
 * være en fast verdi som klipper på en liten skjerm.
 */
const FORHOLD = 1.12;
const HOYDE_MINST = 64;
const HOYDE_MEST = 170;

/**
 * Målene i en dagrute, i piksler ved tekstskala 1 (lerretet KalenderTitler).
 * Ruta regner med dem for å vite hvor mange brikker den har plass til.
 */
const RAMME = 6 + 8; // polstring over og under
const DATOLINJE = 20 + 4; // datoen (merket for i dag er 20 høyt) og luft
const MERKELAPP = 16 + 4;
const SAMTALELINJE = 22 + 4;
const TELLER = 16;
/** Brikka uten tittel: polstring, fag og klokkeslett, og luft til neste. */
const OKTRAMME = 4 + 5 + 13 + 4;
const TITTELLINJE = 15.6;
/** Snittbredden på et tegn i tittelen (12 px), og brikkas polstring. */
const TEGN = 6.3;
const POLSTRING = 12 + 14;

/** Hvor mange linjer tittelen tar i en rute så bred: 0, 1 eller 2. */
export function tittellinjer(tittel: string | null, dagbredde: number): number {
  if (!tittel) return 0;
  const plass = Math.max(dagbredde - POLSTRING, 20);
  return Math.min(2, Math.ceil((tittel.length * TEGN) / plass));
}

/** Høyden på en øktbrikke, med luft til neste. */
export function okthoyde(linjer: number, skala = 1): number {
  return (OKTRAMME + linjer * TITTELLINJE) * skala;
}

/**
 * Hvor mye plass øktene har i ruta, når datoen, merkelappen for ferie og
 * samtalelinja er trukket fra.
 */
export function plassTilOkter(
  cellehoyde: number,
  { merkelapp = false, samtaler = false, skala = 1 } = {},
): number {
  return (
    cellehoyde -
    RAMME -
    (DATOLINJE + (merkelapp ? MERKELAPP : 0) + (samtaler ? SAMTALELINJE : 0)) *
      skala
  );
}

/**
 * Kapper øktene til det ruta har plass til, etter høyden på hver.
 *
 * Går det ikke opp, gis det plass til telleren nederst — ellers ville
 * «+n til» selv skjøvet en økt ut uten å si fra om det.
 */
export function kappOkter<T>(
  okter: T[],
  hoyder: number[],
  plass: number,
  teller = TELLER,
): { synlige: T[]; skjulte: number } {
  const sum = hoyder.reduce((a, b) => a + b, 0);
  if (sum <= plass) return { synlige: okter, skjulte: 0 };
  let brukt = teller;
  let n = 0;
  while (n < okter.length && brukt + hoyder[n] <= plass) brukt += hoyder[n++];
  return { synlige: okter.slice(0, n), skjulte: okter.length - n };
}

/**
 * Måler hvor brede månedskortene faktisk ble, og regner ut cellehøyden.
 *
 * Bredden leses av rutenettets egne kolonnespor framfor å gjettes, så tallet
 * stemmer uansett hvor mange måneder som fikk plass ved siden av hverandre.
 */
type Rutemal = { hoyde: number; bredde: number; skala: number };

function useCellehoyde(): [React.RefObject<HTMLDivElement | null>, Rutemal] {
  const rutenett = useRef<HTMLDivElement>(null);
  const [mal, setMal] = useState<Rutemal>({
    hoyde: HOYDE_MINST,
    bredde: 120,
    skala: 1,
  });

  useLayoutEffect(() => {
    const el = rutenett.current;
    if (!el) return;

    const maal = () => {
      const spor = getComputedStyle(el)
        .gridTemplateColumns.split(" ")
        .map(parseFloat)
        .filter((n) => !Number.isNaN(n));
      const kortbredde = spor[0] ?? el.clientWidth;
      const dagbredde = (kortbredde - UKEKOLONNE - STREKER) / 5;
      if (dagbredde <= 0) return;
      // Større tekst gir høyere brikker, så plassen regnes med skalaen.
      const skala =
        parseFloat(getComputedStyle(el).getPropertyValue("--tekst-skala")) || 1;
      const hoyde = Math.min(
        HOYDE_MEST,
        Math.max(HOYDE_MINST, Math.round(dagbredde * FORHOLD)),
      );
      setMal((f) =>
        f.hoyde === hoyde && f.bredde === dagbredde && f.skala === skala
          ? f
          : { hoyde, bredde: dagbredde, skala },
      );
    };

    maal();
    const ro = new ResizeObserver(maal);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [rutenett, mal];
}

/**
 * Kalenderen over skoleåret.
 *
 * Månedene under hverandre, hver som et rutenett mandag–fredag. Helg er ikke
 * tatt med i det hele tatt — den tar plass uten å inneholde noe (§4.2).
 *
 * Blokkerte dager tones og får navnet sitt. Da ser du hva du sperrer mens du
 * sperrer det, og oppdager med en gang hvis det allerede ligger økter der.
 *
 * Alle ruter er like høye, uansett hvor mange økter som ligger i dem. En uke
 * i november med fem økter hver dag skal ikke gjøre resten av måneden
 * uleselig — det som ikke får plass telles opp som «+n til».
 */
export function Skolekalender({
  skolear,
  fag,
  onApneOkt,
  bryter,
}: {
  /** Liste | Kalender, først i verktøylinja */
  bryter?: React.ReactNode;
  skolear: Skolear;
  fag: FagIAr[];
  onApneOkt: (oktId: string) => void;
}) {
  const [okter, setOkter] = useState<Okt[]>([]);
  const [fridager, setFridager] = useState<Fridag[]>([]);
  // Samtaledager er ikke økter (§3.6), så de må hentes for seg og vises som
  // sin egen slags dag. Det er den kjente kostnaden ved egen tabell.
  const [samtaledager, setSamtaledager] = useState<Samtaledag[]>([]);
  const [global, setGlobal] = useState("180");
  // Flere dager kan være valgt samtidig. Å klikke seg gjennom tirsdagene og
  // legge inn alle på én gang er enklere enn et serieskjema, og du ser hele
  // tiden hvor de havner.
  const [valgte, setValgte] = useState<Set<string>>(new Set());
  const [rutenett, rutemal] = useCellehoyde();
  const cellehoyde = rutemal.hoyde;

  // Fagene som er skjult i kalenderen (ARBEIDSLISTE 15.1). Gjelder uke,
  // måned og årsheatmapet, og huskes.
  const [skjult, vekslFag] = useSkjulteFag("kalender_skjulte_fag");
  const synligeOkter = useMemo(
    () => okter.filter((o) => !skjult.has(o.skolearFagId)),
    [okter, skjult],
  );
  const synligeSamtaler = useMemo(
    () => (skjult.has(SAMTALER) ? [] : samtaledager),
    [samtaledager, skjult],
  );

  async function last() {
    setOkter(await hentOkter(skolear.id));
    setFridager(await hentFridager(skolear.id));
    setSamtaledager(await hentSamtaledager(skolear.id));
  }

  /**
   * Sletting er soft delete (§3.1), så ingenting går tapt i basen. Men en økt
   * med skåringer på seg er noe annet enn en tom plan, og da sier vi fra om
   * hvor mye som forsvinner fra elevenes heatmap før vi gjør det.
   */
  async function slettValgte(valgte: Okt[]) {
    if (valgte.length === 0) return;
    if (!(await bekreft(slettetekst(valgte)))) return;
    await slettOkter(valgte.map((o) => o.id));
    await last();
  }

  useEffect(() => {
    void last();
    void hentInnstilling("standard_varighet_min").then((v) =>
      setGlobal(v ?? "180"),
    );
  }, [skolear.id]);

  const rode = useMemo(
    () => rodekart(skolear.start, skolear.slutt),
    [skolear.start, skolear.slutt],
  );

  const perDag = useMemo(() => {
    const kart = new Map<string, Okt[]>();
    for (const o of synligeOkter)
      kart.set(o.dato, [...(kart.get(o.dato) ?? []), o]);
    return kart;
  }, [synligeOkter]);

  const samtalePerDag = useMemo(() => {
    const kart = new Map<string, Samtaledag[]>();
    for (const d of synligeSamtaler) {
      if (d.dato === "") continue;
      kart.set(d.dato, [...(kart.get(d.dato) ?? []), d]);
    }
    return kart;
  }, [synligeSamtaler]);

  const maneder = useMemo(
    () => manederMellom(skolear.start, skolear.slutt),
    [skolear.start, skolear.slutt],
  );

  const idag = iso(new Date());

  // Øktene som ligger på de dagene du har valgt — det er dem bulk-slettinga
  // gjelder, og antallet står på knappen så du ser hva du treffer.
  const valgteOkter = useMemo(
    () => [...valgte].sort().flatMap((d) => perDag.get(d) ?? []),
    [valgte, perDag],
  );

  // Uke eller måned (DESIGN.md §10). Valget huskes, som kolonnevalgene.
  const [modus, setModus] = useState<"uke" | "maned">("maned");
  useEffect(() => {
    void hentInnstilling("kalender_modus").then((v) => {
      if (v === "uke" || v === "maned") setModus(v);
    });
  }, []);
  function byttModus(m: "uke" | "maned") {
    setModus(m);
    void settInnstilling("kalender_modus", m);
  }

  // Måneden som står framme. Starter på denne måneden, eller den nærmeste
  // i skoleåret når i dag ligger utenfor.
  const [visManed, setVisManed] = useState(() =>
    narmesteManed(idag.slice(0, 7), maneder),
  );
  const ix = maneder.indexOf(visManed);

  // Alle månedene står under hverandre i én liste (10.7). Rullingen bestemmer
  // hvilken måned som står framme; klikk i årsheatmapet, ‹ › og «I dag»
  // ruller dit.
  const rulleflate = useRef<HTMLDivElement>(null);
  const styrt = useRef(false);
  const slipp = useRef<ReturnType<typeof setTimeout> | null>(null);

  function rullTil(maned: string, glatt = true) {
    const flate = rulleflate.current;
    const mal = flate?.querySelector<HTMLElement>(`[data-maned="${maned}"]`);
    if (!flate || !mal) return;
    setVisManed(maned);
    // Mens den glir, passerer den månedene imellom. De skal ikke vises i
    // overskriften.
    styrt.current = true;
    if (slipp.current) clearTimeout(slipp.current);
    slipp.current = setTimeout(() => (styrt.current = false), glatt ? 700 : 50);
    flate.scrollTo({
      top: mal.offsetTop,
      behavior: glatt ? "smooth" : "auto",
    });
  }

  /** Måneden som står øverst i lista. */
  function lesManed() {
    const flate = rulleflate.current;
    if (!flate || styrt.current) return;
    let funnet = maneder[0];
    for (const el of flate.querySelectorAll<HTMLElement>("[data-maned]")) {
      if (el.offsetTop - flate.scrollTop <= 48) funnet = el.dataset.maned!;
      else break;
    }
    if (funnet && funnet !== visManedRef.current) setVisManed(funnet);
  }
  const visManedRef = useRef(visManed);
  visManedRef.current = visManed;

  // Står på måneden fra start, uten å gli dit — og blir stående på den når
  // cellehøyden er målt eller vinduet endrer størrelse. Før ble lista
  // stående på august mens overskriften sa oktober.
  useLayoutEffect(() => {
    if (modus === "maned") rullTil(visManedRef.current, false);
  }, [modus, cellehoyde]);

  // Hvor mye som skjer hver dag, til årsheatmapet.
  const mengde = useMemo(() => {
    const kart = new Map<string, number>();
    for (const o of synligeOkter) kart.set(o.dato, (kart.get(o.dato) ?? 0) + 1);
    for (const d of synligeSamtaler)
      if (d.dato) kart.set(d.dato, (kart.get(d.dato) ?? 0) + 1);
    return kart;
  }, [synligeOkter, synligeSamtaler]);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-clip">
      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-3">
        {bryter}
        <Bryter
          valg={[
            { id: "uke", navn: "Uke" },
            { id: "maned", navn: "Måned" },
          ]}
          verdi={modus}
          settVerdi={(v) => byttModus(v as "uke" | "maned")}
        />
        {modus === "maned" && (
          <h2 className="ml-2 text-[calc(26px*var(--tekst-skala))] font-light leading-none tracking-overskrift first-letter:uppercase">
            {manedsnavn(visManed)}
          </h2>
        )}
        <Fagbrytere
          fag={fag}
          samtaler={samtaledager.some((d) => d.dato !== "")}
          skjult={skjult}
          onVeksle={vekslFag}
        />
        {modus === "maned" && (
          <span className="flex items-center gap-1">
            <button
              onClick={() => ix > 0 && rullTil(maneder[ix - 1])}
              disabled={ix <= 0}
              title="Forrige måned"
              className="rounded-vanlig px-2 py-0.5 text-tittel leading-none text-blekk-dempet hover:bg-flate hover:text-blekk disabled:opacity-30"
            >
              ‹
            </button>
            <Knapp
              onClick={() => rullTil(narmesteManed(idag.slice(0, 7), maneder))}
            >
              I dag
            </Knapp>
            <button
              onClick={() =>
                ix < maneder.length - 1 && rullTil(maneder[ix + 1])
              }
              disabled={ix >= maneder.length - 1}
              title="Neste måned"
              className="rounded-vanlig px-2 py-0.5 text-tittel leading-none text-blekk-dempet hover:bg-flate hover:text-blekk disabled:opacity-30"
            >
              ›
            </button>
          </span>
        )}
      </div>

      {modus === "uke" ? (
        <Kalenderuke
          skolearId={skolear.id}
          forste={skolear.start}
          siste={skolear.slutt}
          okter={synligeOkter}
          fag={fag}
          fridager={fridager}
          rode={rode}
          samtaledager={synligeSamtaler}
          onApneOkt={onApneOkt}
          onEndret={() => void last()}
        />
      ) : (
        <div className="flex min-h-0 flex-1 gap-8">
          <div
            ref={rulleflate}
            onScroll={lesManed}
            className="relative min-h-0 min-w-0 flex-1 overflow-auto"
          >
            <div ref={rutenett} className="grid grid-cols-1">
              {maneder.map((m, i) => (
                <div key={m} data-maned={m} className={i > 0 ? "pt-7" : ""}>
                  {/* Navnet over hver måned; det øverst i verktøylinja følger rullingen. */}
                  {i > 0 && (
                    <h3 className="mb-2 text-[calc(20px*var(--tekst-skala))] font-light leading-none tracking-overskrift first-letter:uppercase">
                      {manedsnavn(m)}
                    </h3>
                  )}
                  <Maned
                    maned={m}
                    rutemal={rutemal}
                    spennFra={skolear.start}
                    spennTil={skolear.slutt}
                    perDag={perDag}
                    samtalePerDag={samtalePerDag}
                    fridager={fridager}
                    rode={rode}
                    idag={idag}
                    valgte={valgte}
                    onVelgDag={(dato) =>
                      setValgte((f) => {
                        const ny = new Set(f);
                        if (ny.has(dato)) ny.delete(dato);
                        else ny.add(dato);
                        return ny;
                      })
                    }
                    onApneOkt={onApneOkt}
                    onSlettOkt={(o) => void slettValgte([o])}
                  />
                </div>
              ))}
            </div>
            <p className="mt-2 pb-[40vh] text-liten text-blekk-dempet">
              Klikk på dagene du vil ha økter på, også i flere måneder, og velg
              fag nederst.
            </p>
          </div>

          <Arsheatmap
            maneder={maneder}
            visManed={visManed}
            mengde={mengde}
            fridager={fridager}
            rode={rode}
            spennFra={skolear.start}
            spennTil={skolear.slutt}
            onVelg={(m) => rullTil(m)}
          />
        </div>
      )}

      {modus === "maned" && valgte.size > 0 && (
        <Valgtlinje
          datoer={[...valgte].sort()}
          fag={fag}
          global={global}
          fridager={fridager}
          rode={rode}
          okter={valgteOkter}
          onSlett={() => void slettValgte(valgteOkter)}
          onLagret={async () => {
            setValgte(new Set());
            await last();
          }}
          onTom={() => setValgte(new Set())}
        />
      )}
    </div>
  );
}

/**
 * Skoleåret august–juni som heatmap, måned for måned (DESIGN.md §4, §10).
 * Fem trinn etter hvor mye som skjer en dag, bygget på aksenten. Fridager
 * og røde dager har kalendertonene sine. Et klikk hopper til måneden.
 */
function Arsheatmap({
  maneder,
  visManed,
  mengde,
  fridager,
  rode,
  spennFra,
  spennTil,
  onVelg,
}: {
  maneder: string[];
  visManed: string;
  mengde: Map<string, number>;
  fridager: Fridag[];
  rode: Map<string, string>;
  spennFra: string;
  spennTil: string;
  onVelg: (maned: string) => void;
}) {
  return (
    <aside className="w-60 shrink-0 overflow-y-auto">
      <h3 className="mb-2 border-b border-linje-medium pb-1 text-brod font-semibold">
        Skoleåret
      </h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {maneder.map((m) => (
          <button
            key={m}
            onClick={() => onVelg(m)}
            className={`rounded-stor p-1 text-left ${
              m === visManed ? "bg-valgt" : "hover:bg-flate"
            }`}
          >
            <span className="mb-1 block text-mikro text-blekk-dempet first-letter:uppercase">
              {new Date(`${m}-01T00:00:00`).toLocaleDateString("nb-NO", {
                month: "short",
              })}
            </span>
            <span className="grid grid-cols-5 gap-[2px]">
              {ukerIManed(m)
                .flat()
                .map((dato, i) => {
                  if (dato === null || dato < spennFra || dato > spennTil)
                    return <span key={i} className="aspect-square" />;
                  const b = blokkering(dato, fridager, rode);
                  const n = mengde.get(dato) ?? 0;
                  const bakgrunn =
                    b?.type === "helligdag"
                      ? "var(--color-helligdag-flate)"
                      : b && b.type !== "hendelse"
                        ? "var(--color-fri-flate)"
                        : `var(--varme-${Math.min(n, 4) + 1})`;
                  return (
                    <span
                      key={i}
                      title={`${dato}${b ? ` · ${b.navn}` : ""}${
                        n > 0 ? ` · ${n}` : ""
                      }`}
                      className="aspect-square rounded-[2px]"
                      style={{ background: bakgrunn }}
                    />
                  );
                })}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}

/** Måneden i skoleåret nærmest den gitte. */
function narmesteManed(maned: string, maneder: string[]): string {
  if (maneder.length === 0) return maned;
  if (maneder.includes(maned)) return maned;
  return maned < maneder[0] ? maneder[0] : maneder[maneder.length - 1];
}

function Maned({
  maned,
  rutemal,
  spennFra,
  spennTil,
  perDag,
  samtalePerDag,
  fridager,
  rode,
  idag,
  valgte,
  onVelgDag,
  onApneOkt,
  onSlettOkt,
}: {
  maned: string;
  rutemal: Rutemal;
  spennFra: string;
  spennTil: string;
  perDag: Map<string, Okt[]>;
  samtalePerDag: Map<string, Samtaledag[]>;
  fridager: Fridag[];
  rode: Map<string, string>;
  idag: string;
  valgte: Set<string>;
  onVelgDag: (dato: string) => void;
  onApneOkt: (id: string) => void;
  onSlettOkt: (okt: Okt) => void;
}) {
  const uker = ukerIManed(maned);
  const cellehoyde = rutemal.hoyde;

  return (
    <section>
      <div className="grid grid-cols-[1.6rem_repeat(5,1fr)] gap-px border-b border-linje-medium pb-1 text-mikro uppercase tracking-etikett text-blekk-svak">
        <span className="px-1" title="Ukenummer">
          uke
        </span>
        {["ma", "ti", "on", "to", "fr"].map((d) => (
          <span key={d} className="px-1">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-[1.6rem_repeat(5,1fr)] gap-px bg-linje-medium">
        {uker.map((uke, r) => (
          <Fragment key={r}>
            <div
              className="flex items-start justify-center bg-ark pt-1 text-mikro tabular-nums text-blekk-svak"
              style={{ height: cellehoyde }}
            >
              {uke.find((d) => d !== null)
                ? ukenummer(uke.find((d) => d !== null)!)
                : ""}
            </div>
            {uke.map((dato, i) =>
              dato === null ? (
                <div
                  key={i}
                  className="bg-ark"
                  style={{ height: cellehoyde }}
                />
              ) : (
                <Dag
                  key={dato}
                  dato={dato}
                  rutemal={rutemal}
                  utenfor={dato < spennFra || dato > spennTil}
                  okter={perDag.get(dato) ?? []}
                  samtaledager={samtalePerDag.get(dato) ?? []}
                  blokkert={blokkering(dato, fridager, rode)}
                  erIdag={dato === idag}
                  valgt={valgte.has(dato)}
                  onVelg={() => onVelgDag(dato)}
                  onApneOkt={onApneOkt}
                  onSlettOkt={onSlettOkt}
                />
              ),
            )}
          </Fragment>
        ))}
      </div>
    </section>
  );
}

function Dag({
  dato,
  rutemal,
  utenfor,
  okter,
  samtaledager,
  blokkert,
  erIdag,
  valgt,
  onVelg,
  onApneOkt,
  onSlettOkt,
}: {
  dato: string;
  rutemal: Rutemal;
  utenfor: boolean;
  okter: Okt[];
  samtaledager: Samtaledag[];
  blokkert: Blokkering | null;
  erIdag: boolean;
  valgt: boolean;
  onVelg: () => void;
  onApneOkt: (id: string) => void;
  onSlettOkt: (okt: Okt) => void;
}) {
  const dagnr = Number(dato.slice(8));
  // Ligger det økter på en blokkert dag, er det noe å rydde opp i.
  const konflikt = blokkert !== null && okter.length > 0;

  // Merkelappen for ferie eller helligdag og samtalelinja tar plass, så de
  // må trekkes fra før øktene får vite hvor mye plass de har igjen. Hver
  // brikke er så høy som tittelen den har.
  const merkelapp = blokkert !== null && !utenfor;
  const harSamtaler = samtaledager.length > 0 && !utenfor;
  const linjer = okter.map((o) => tittellinjer(o.tema, rutemal.bredde));
  const { synlige, skjulte } = kappOkter(
    okter,
    linjer.map((l) => okthoyde(l, rutemal.skala)),
    plassTilOkter(rutemal.hoyde, {
      merkelapp,
      samtaler: harSamtaler,
      skala: rutemal.skala,
    }),
  );
  const elever = samtaledager.reduce((n, d) => n + d.antall, 0);

  const bakgrunn = utenfor
    ? "bg-flate"
    : konflikt
      ? "bg-feil-flate"
      : blokkert
        ? blokkert.type === "helligdag"
          ? "bg-helligdag-flate shadow-[inset_0_0_0_1px_var(--color-helligdag-kant)]"
          : blokkert.type === "hendelse"
            ? "bg-hendelse-flate"
            : "bg-fri-flate"
        : "bg-ark";

  return (
    <div
      onClick={utenfor ? undefined : onVelg}
      style={{ height: rutemal.hoyde }}
      className={`flex flex-col gap-1 overflow-hidden px-1.5 pb-2 pt-1.5 ${bakgrunn} ${
        utenfor ? "" : "cursor-pointer hover:brightness-[0.98]"
      } ${valgt ? "outline outline-2 -outline-offset-2 outline-aksent" : ""}`}
    >
      <div className="flex h-5 shrink-0 items-center gap-1">
        {/* Dagens dato i et aksentfarget merke (ARBEIDSLISTE 15.1). */}
        <span
          className={`text-[calc(12.5px*var(--tekst-skala))] tabular-nums ${
            erIdag
              ? "inline-grid h-5 min-w-[22px] place-items-center rounded-[6px] bg-aksent px-1 font-semibold text-ark"
              : utenfor
                ? "text-blekk-svakest"
                : "text-blekk-dempet"
          }`}
        >
          {dagnr}
        </span>
        {konflikt && (
          <span
            title={`${okter.length} økt(er) ligger på ${blokkert!.navn}`}
            className="text-etikett font-bold text-feil"
          >
            !
          </span>
        )}
      </div>

      {merkelapp && (
        <p
          className={`shrink-0 truncate text-mikro ${
            konflikt ? "text-feil" : "text-blekk-svak"
          }`}
          title={blokkert.navn}
        >
          {blokkert.navn}
        </p>
      )}

      {/*
        Samtaledagen står over øktene: er det samtaler den dagen, er det dem
        dagen handler om. Den er ikke en økt (§3.6), så den har sitt eget
        uttrykk — én linje i aksentens tone, med antall elever.
      */}
      {harSamtaler && (
        <p
          className="shrink-0 truncate rounded-[5px] px-[7px] py-[4px] text-mikro leading-[1.2]"
          style={{
            background:
              "color-mix(in srgb, var(--color-aksent) 12%, var(--color-ark))",
            boxShadow:
              "inset 0 0 0 1px color-mix(in srgb, var(--color-aksent) 25%, var(--color-ark))",
          }}
          title={samtaledager
            .map(
              (d) =>
                `${d.fagKode ?? "Mentorsamtaler"} ${d.fra}–${d.til}` +
                (d.antall > 0 ? ` · ${d.antall} elever` : " · ikke trukket"),
            )
            .join("\n")}
        >
          <span className="font-semibold text-aksent">
            {samtaledager[0].fagKode ?? "Mentorsamtaler"}
          </span>
          {elever > 0 && <span className="text-blekk-dempet"> · {elever}</span>}
        </p>
      )}

      {/*
        Hver økt er en brikke i to linjer: fag og klokkeslett, så tittelen
        i inntil to linjer (ARBEIDSLISTE 15.1). Krysset for å slette ligger
        utenfor knappen som åpner økta, og vises først når musa er over
        brikka, så rutene holder seg rolige (§13).
      */}
      {synlige.map((o) => (
        <div
          key={o.id}
          className="group/okt relative shrink-0 rounded-[5px] hover:brightness-95"
          style={{ background: "var(--color-flate)" }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onApneOkt(o.id);
            }}
            title={[o.fagKode, o.klokkeslett, o.tema]
              .filter(Boolean)
              .join(" · ")}
            className="block w-full min-w-0 px-[7px] pb-[5px] pt-1 text-left"
          >
            <span className="flex min-w-0 items-baseline gap-1.5 text-mikro leading-[1.2]">
              <span className="flex min-w-0 items-center gap-1 truncate font-semibold text-blekk-dempet">
                <Fagfirkant farge={o.farge} klasse="self-center" />
                {o.fagKode}
              </span>
              {o.klokkeslett && (
                <span className="shrink-0 tabular-nums text-blekk-dempet">
                  {o.klokkeslett}
                </span>
              )}
            </span>
            {o.tema && (
              <span className="okt-tittel mt-px text-etikett leading-[1.3] text-blekk">
                {o.tema}
              </span>
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSlettOkt(o);
            }}
            title={`Slett ${o.fagKode} denne dagen`}
            className="absolute right-1 top-0.5 hidden px-0.5 text-mikro leading-none text-blekk-svak hover:text-feil group-hover/okt:block"
          >
            &times;
          </button>
        </div>
      ))}

      {/*
        Telleren åpner den første som ikke fikk plass, så det finnes en vei
        videre uten å gå om øktlista. Alle de skjulte ligger i tooltipen.
      */}
      {skjulte > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onApneOkt(okter[synlige.length].id);
          }}
          title={okter
            .slice(synlige.length)
            .map((o) =>
              [o.fagKode, o.klokkeslett, o.tema].filter(Boolean).join(" · "),
            )
            .join("\n")}
          className="w-full shrink-0 px-0.5 text-left text-mikro tabular-nums text-blekk-svak hover:text-blekk"
        >
          +{skjulte} til
        </button>
      )}
    </div>
  );
}

/**
 * Linja nederst når én eller flere dager er valgt. Ett klikk på et fag lager
 * økter på alle sammen, med arvet varighet.
 */
function Valgtlinje({
  datoer,
  fag,
  global,
  fridager,
  rode,
  okter,
  onSlett,
  onLagret,
  onTom,
}: {
  datoer: string[];
  fag: FagIAr[];
  global: string;
  fridager: Fridag[];
  rode: Map<string, string>;
  okter: Okt[];
  onSlett: () => void;
  onLagret: () => void;
  onTom: () => void;
}) {
  const [klokke, setKlokke] = useState("");
  const [jobber, setJobber] = useState(false);

  const blokkerte = datoer.filter(
    (d) => blokkering(d, fridager, rode) !== null,
  );

  async function leggTil(f: FagIAr) {
    setJobber(true);
    try {
      for (const dato of datoer) {
        await opprettOkt(
          f.id,
          f.fagkode,
          dato,
          klokke || null,
          Number(f.standardVarighetMin ?? global),
        );
      }
      onLagret();
    } finally {
      setJobber(false);
    }
  }

  return (
    <div className="sticky bottom-0 mt-4 flex flex-wrap items-center gap-2 border border-linje bg-flate px-3 py-2 text-brod shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
      <span className="font-medium tabular-nums">
        {datoer.length === 1
          ? langDato(datoer[0])
          : `${datoer.length} dager valgt`}
      </span>

      {blokkerte.length > 0 && (
        <span className="text-liten text-feil">
          {blokkerte.length === datoer.length
            ? "merket som fri"
            : `${blokkerte.length} av dem er merket som fri`}
        </span>
      )}

      <input
        value={klokke}
        onChange={(e) => setKlokke(e.target.value)}
        placeholder="09:15"
        className="w-20 rounded border border-linje px-2 py-1 tabular-nums outline-none focus:border-aksent"
      />

      <span className="text-blekk-dempet">Legg inn økt i:</span>
      {fag.map((f) => (
        <button
          key={f.id}
          disabled={jobber}
          onClick={() => leggTil(f)}
          className="flex items-center gap-1.5 rounded border border-linje bg-ark px-2 py-1 hover:bg-flate disabled:opacity-40"
        >
          <Fagfirkant farge={f.farge} />
          {f.kode}
        </button>
      ))}

      <div className="ml-auto flex items-center gap-3">
        {okter.length > 0 && (
          <button
            onClick={onSlett}
            className="text-liten text-blekk-svak hover:text-feil"
          >
            Slett {okter.length === 1 ? "økta" : `${okter.length} øktene`} her
          </button>
        )}
        <button
          onClick={onTom}
          className="text-liten text-blekk-dempet hover:text-blekk"
        >
          Nullstill valget
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ datoer

function manederMellom(fra: string, til: string): string[] {
  const maneder: string[] = [];
  const d = new Date(`${fra.slice(0, 7)}-01T00:00:00`);
  const slutt = new Date(`${til.slice(0, 7)}-01T00:00:00`);
  while (d <= slutt) {
    maneder.push(iso(d).slice(0, 7));
    d.setMonth(d.getMonth() + 1);
  }
  return maneder;
}

/**
 * Ukene i måneden som rader av fem celler, mandag til fredag. null er en
 * plass før den første eller etter den siste dagen i måneden.
 */
function ukerIManed(maned: string): (string | null)[][] {
  const forste = new Date(`${maned}-01T00:00:00`);
  const siste = new Date(forste.getFullYear(), forste.getMonth() + 1, 0);

  const uker: (string | null)[][] = [];
  let uke: (string | null)[] = [];

  // Fyll opp til den ukedagen måneden begynner på. Begynner den i helga,
  // fylles ingenting — første rad starter da på mandagen etter.
  const start = (forste.getDay() + 6) % 7; // mandag = 0
  if (start < 5) for (let i = 0; i < start; i++) uke.push(null);

  for (let dag = 1; dag <= siste.getDate(); dag++) {
    const d = new Date(forste.getFullYear(), forste.getMonth(), dag);
    const ukedag = (d.getDay() + 6) % 7;
    if (ukedag > 4) continue; // helg vises ikke

    if (uke.length === 5) {
      uker.push(uke);
      uke = [];
    }
    while (uke.length < ukedag) uke.push(null);
    uke.push(iso(d));
  }

  while (uke.length > 0 && uke.length < 5) uke.push(null);
  if (uke.length > 0) uker.push(uke);
  return uker;
}

function manedsnavn(maned: string): string {
  return new Date(`${maned}-01T00:00:00`).toLocaleDateString("nb-NO", {
    month: "long",
    year: "numeric",
  });
}

function langDato(dato: string): string {
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
