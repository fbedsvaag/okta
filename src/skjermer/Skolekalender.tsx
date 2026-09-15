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
import { hentFridager, hentInnstilling, type Skolear } from "../data/skolear";
import {
  hentOkter,
  opprettOkt,
  slettetekst,
  slettOkter,
  type Okt,
} from "../data/okter";
import type { FagIAr } from "../data/fag";

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
const FORHOLD = 1.1;
const HOYDE_MINST = 44;
const HOYDE_MEST = 110;

/** Datolinja øverst i ruta, og høyden på én økt- eller merkelapplinje. */
const DATOLINJE = 20;
const LINJE = 14;

/**
 * Hvor mange linjer det er plass til under datoen.
 *
 * Alltid minst én: en rute som ikke viser noe som helst er verre enn en som
 * viser «+3 til».
 */
export function linjerSomFarPlass(cellehoyde: number): number {
  return Math.max(1, Math.floor((cellehoyde - DATOLINJE) / LINJE));
}

/**
 * Kapper øktene til det ruta har plass til.
 *
 * Går det ikke opp, brukes den nederste linja til telleren — ellers ville
 * «+n til» selv skjøvet en økt ut uten å si fra om det.
 */
export function kappOkter<T>(
  okter: T[],
  plass: number,
): { synlige: T[]; skjulte: number } {
  if (plass <= 0) return { synlige: [], skjulte: okter.length };
  if (okter.length <= plass) return { synlige: okter, skjulte: 0 };
  const synlige = okter.slice(0, plass - 1);
  return { synlige, skjulte: okter.length - synlige.length };
}

/**
 * Måler hvor brede månedskortene faktisk ble, og regner ut cellehøyden.
 *
 * Bredden leses av rutenettets egne kolonnespor framfor å gjettes, så tallet
 * stemmer uansett hvor mange måneder som fikk plass ved siden av hverandre.
 */
function useCellehoyde(): [React.RefObject<HTMLDivElement | null>, number] {
  const rutenett = useRef<HTMLDivElement>(null);
  const [hoyde, setHoyde] = useState(HOYDE_MINST);

  useLayoutEffect(() => {
    const el = rutenett.current;
    if (!el) return;

    const mal = () => {
      const spor = getComputedStyle(el)
        .gridTemplateColumns.split(" ")
        .map(parseFloat)
        .filter((n) => !Number.isNaN(n));
      const kortbredde = spor[0] ?? el.clientWidth;
      const dagbredde = (kortbredde - UKEKOLONNE - STREKER) / 5;
      if (dagbredde <= 0) return;
      setHoyde(
        Math.min(HOYDE_MEST, Math.max(HOYDE_MINST, Math.round(dagbredde * FORHOLD))),
      );
    };

    mal();
    const ro = new ResizeObserver(mal);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [rutenett, hoyde];
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
}: {
  skolear: Skolear;
  fag: FagIAr[];
  onApneOkt: (oktId: string) => void;
}) {
  const [okter, setOkter] = useState<Okt[]>([]);
  const [fridager, setFridager] = useState<Fridag[]>([]);
  const [global, setGlobal] = useState("180");
  // Flere dager kan være valgt samtidig. Å klikke seg gjennom tirsdagene og
  // legge inn alle på én gang er enklere enn et serieskjema, og du ser hele
  // tiden hvor de havner.
  const [valgte, setValgte] = useState<Set<string>>(new Set());
  const [rutenett, cellehoyde] = useCellehoyde();

  async function last() {
    setOkter(await hentOkter(skolear.id));
    setFridager(await hentFridager(skolear.id));
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
    void hentInnstilling("standard_varighet_min").then((v) => setGlobal(v ?? "180"));
  }, [skolear.id]);

  const rode = useMemo(
    () => rodekart(skolear.start, skolear.slutt),
    [skolear.start, skolear.slutt],
  );

  const perDag = useMemo(() => {
    const kart = new Map<string, Okt[]>();
    for (const o of okter) kart.set(o.dato, [...(kart.get(o.dato) ?? []), o]);
    return kart;
  }, [okter]);

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

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-clip">
      {/* Fagfargene og hjelpeteksten blir stående mens månedene ruller. */}
      <div className="mb-4 flex shrink-0 flex-wrap items-center gap-4 text-liten text-blekk-dempet">
        <span>{okter.length} økter i året</span>
        {fag.map((f) => (
          <span key={f.id} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: f.farge ?? "var(--color-linje-sterk)" }}
            />
            {f.kode}
          </span>
        ))}
        <span className="ml-auto">
          Klikk på dagene du vil ha økter på — så mange du vil — og velg fag
          nederst.
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
      <div
        ref={rutenett}
        className="grid gap-x-6 gap-y-7 [grid-template-columns:repeat(auto-fill,minmax(17rem,1fr))]"
      >
        {maneder.map((m) => (
          <Maned
            key={m}
            maned={m}
            cellehoyde={cellehoyde}
            spennFra={skolear.start}
            spennTil={skolear.slutt}
            perDag={perDag}
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
        ))}
      </div>

      </div>

      {valgte.size > 0 && (
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

function Maned({
  maned,
  cellehoyde,
  spennFra,
  spennTil,
  perDag,
  fridager,
  rode,
  idag,
  valgte,
  onVelgDag,
  onApneOkt,
  onSlettOkt,
}: {
  maned: string;
  cellehoyde: number;
  spennFra: string;
  spennTil: string;
  perDag: Map<string, Okt[]>;
  fridager: Fridag[];
  rode: Map<string, string>;
  idag: string;
  valgte: Set<string>;
  onVelgDag: (dato: string) => void;
  onApneOkt: (id: string) => void;
  onSlettOkt: (okt: Okt) => void;
}) {
  const uker = ukerIManed(maned);

  return (
    <section>
      <h3 className="mb-1 text-liten font-semibold first-letter:uppercase">
        {manedsnavn(maned)}
      </h3>
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
                <div key={i} className="bg-ark" style={{ height: cellehoyde }} />
              ) : (
                <Dag
                  key={dato}
                  dato={dato}
                  cellehoyde={cellehoyde}
                  utenfor={dato < spennFra || dato > spennTil}
                  okter={perDag.get(dato) ?? []}
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
  cellehoyde,
  utenfor,
  okter,
  blokkert,
  erIdag,
  valgt,
  onVelg,
  onApneOkt,
  onSlettOkt,
}: {
  dato: string;
  cellehoyde: number;
  utenfor: boolean;
  okter: Okt[];
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

  // Merkelappen for ferie eller helligdag legger beslag på en linje, så den
  // må trekkes fra før øktene får vite hvor mye plass de har igjen.
  const merkelapp = blokkert !== null && !utenfor;
  const { synlige, skjulte } = kappOkter(
    okter,
    linjerSomFarPlass(cellehoyde) - (merkelapp ? 1 : 0),
  );

  const bakgrunn = utenfor
    ? "bg-flate"
    : konflikt
      ? "bg-feil-flate"
      : blokkert
        ? blokkert.type === "helligdag"
          ? "bg-helligdag-flate"
          : blokkert.type === "hendelse"
            ? "bg-hendelse-flate"
            : "bg-fri-flate"
        : "bg-ark";

  return (
    <div
      onClick={utenfor ? undefined : onVelg}
      style={{ height: cellehoyde }}
      className={`overflow-hidden px-1 py-0.5 ${bakgrunn} ${
        utenfor ? "" : "cursor-pointer hover:brightness-[0.98]"
      } ${valgt ? "outline outline-2 -outline-offset-2 outline-aksent" : ""}`}
    >
      <div className="flex items-baseline gap-1">
        <span
          className={`text-etikett tabular-nums ${
            erIdag
              ? "rounded-sm bg-aksent px-1 font-medium text-white"
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
          className={`truncate text-mikro ${
            konflikt ? "text-feil" : "text-blekk-svak"
          }`}
          title={blokkert.navn}
        >
          {blokkert.navn}
        </p>
      )}

      {/*
        To knapper på rad, ikke én: krysset kan ikke ligge inni knappen som
        åpner økta. Krysset vises først når musa er over brikka, så rutene
        holder seg rolige når du bare ser på kalenderen (§13).
      */}
      {synlige.map((o) => (
        <div
          key={o.id}
          className="group/okt mt-0.5 flex w-full items-center gap-1 rounded-[2px] px-0.5 text-mikro hover:bg-flate"
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onApneOkt(o.id);
            }}
            title={`${o.fagKode} ${o.klokkeslett ?? ""} ${o.tema ?? ""}`}
            className="flex min-w-0 flex-1 items-center gap-1 text-left"
          >
            <span
              aria-hidden
              className="h-2.5 w-[3px] shrink-0 rounded-full"
              style={{ background: o.farge ?? "var(--color-linje-sterk)" }}
            />
            <span className="truncate">{o.fagKode}</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSlettOkt(o);
            }}
            title={`Slett ${o.fagKode} denne dagen`}
            className="hidden shrink-0 px-0.5 leading-none text-blekk-svak hover:text-red-700 group-hover/okt:block"
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
            .map(
              (o) =>
                `${o.fagKode}${o.klokkeslett ? ` ${o.klokkeslett}` : ""}${
                  o.tema ? ` — ${o.tema}` : ""
                }`,
            )
            .join("\n")}
          className="mt-0.5 w-full px-0.5 text-left text-mikro tabular-nums text-blekk-svak hover:text-blekk"
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

  const blokkerte = datoer.filter((d) => blokkering(d, fridager, rode) !== null);

  async function leggTil(f: FagIAr) {
    setJobber(true);
    try {
      for (const dato of datoer) {
        await opprettOkt(
          f.id,
          f.kode,
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
        {datoer.length === 1 ? langDato(datoer[0]) : `${datoer.length} dager valgt`}
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
          <span
            aria-hidden
            className="h-3 w-[3px] rounded-full"
            style={{ background: f.farge ?? "var(--color-linje-sterk)" }}
          />
          {f.kode}
        </button>
      ))}

      <div className="ml-auto flex items-center gap-3">
        {okter.length > 0 && (
          <button
            onClick={onSlett}
            className="text-liten text-blekk-svak hover:text-red-700"
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
