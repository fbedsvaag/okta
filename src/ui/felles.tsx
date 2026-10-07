import { fagfarge } from "./farger";
import { Glideflate } from "./Glideflate";
import { useInngang } from "./bevegelse";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Referansen er den norske klassejournalen: linjert, tett, uten pynt (§13).
 * Alt her er nedtonet med vilje — trafikklyset skal være det eneste stedet i
 * appen med mettet farge.
 */

/**
 * Felles høyde på alt som står på en verktøylinje.
 *
 * Knapper, søkefelt og nedtrekkslister sto før med hver sin padding, og da
 * flukter de ikke — det var en stor del av det som leste som hjemmesnekra.
 * Høyden er satt i `em` så den følger tekststørrelsen (§4.8).
 */
export const KONTROLL = "h-[2.2em] leading-none";

/**
 * Nedtrekksliste med samme form som knapper og felter.
 *
 * Fantes som en håndskrevet klasse i åtte filer før, med små forskjeller i
 * padding hvert sted.
 */
export function Velger({
  verdi,
  settVerdi,
  bredde = "",
  children,
}: {
  verdi: string;
  settVerdi: (v: string) => void;
  bredde?: string;
  children: ReactNode;
}) {
  return (
    <select
      value={verdi}
      onChange={(e) => settVerdi(e.target.value)}
      className={`${KONTROLL} ${bredde} rounded border border-linje bg-ark px-2 text-brod`}
    >
      {children}
    </select>
  );
}

export function Knapp({
  children,
  onClick,
  variant = "vanlig",
  disabled,
  type = "button",
  tittel,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "vanlig" | "primar" | "stille" | "farlig";
  disabled?: boolean;
  type?: "button" | "submit";
  tittel?: string;
}) {
  const stil = {
    // Kanten er `linje-sterk`, ikke `linje`. Den siste er en hårstrek laget
    // for tabellrader, og en knapp med den kanten har ingenting å stå på.
    vanlig:
      "border-linje-sterk bg-ark text-blekk hover:bg-flate active:bg-flate-svak",
    primar:
      "border-aksent bg-aksent text-ark hover:bg-aksent-mork active:bg-aksent-dyp",
    stille:
      "border-transparent text-blekk-dempet hover:bg-flate hover:text-blekk active:bg-flate-svak",
    farlig:
      "border-transparent text-feil hover:bg-feil-flate active:bg-feil-flate",
  }[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={tittel}
      /*
       * `inline-flex` med sentrering, ikke bare en høyde: med `leading-none`
       * og fast høyde satt teksten høyt i knappen, og det er det som leser
       * som hjemmesnekra mer enn noe annet.
       *
       * `rounded-vanlig` er appens egen radius. Tailwinds `rounded` ga
       * knappene andre hjørner enn alle andre flater.
       */
      className={`${KONTROLL} inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-vanlig border px-3 text-brod font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 ${stil}`}
    >
      {children}
    </button>
  );
}

/**
 * Tegnede symboler, ikke emoji.
 *
 * Emoji tegnes av systemet i sin egen stil og farge, og bryter med alt annet
 * på skjermen — DESIGN.md forbyr dem. Disse arver `currentColor` og
 * tekststørrelsen, så de hører til der de står.
 */
export function Ikon({
  navn,
  klasse = "",
}: {
  navn:
    | "las"
    | "las-fylt"
    | "apen-las"
    | "kryss"
    | "hake"
    | "pil"
    | "markor"
    | "opp"
    | "ned"
    | "motte-ikke"
    | "notat"
    | "notat-fylt";
  klasse?: string;
}) {
  const felles = {
    "aria-hidden": true,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: `inline-block h-[1em] w-[1em] ${klasse}`,
  };

  switch (navn) {
    case "las":
      return (
        <svg {...felles}>
          <rect x="3.5" y="7" width="9" height="6.5" rx="1.2" />
          <path d="M5.5 7V4.8a2.5 2.5 0 0 1 5 0V7" />
        </svg>
      );
    case "las-fylt":
      return (
        <svg {...felles}>
          <rect
            x="3.5"
            y="7"
            width="9"
            height="6.5"
            rx="1.2"
            fill="currentColor"
          />
          <path d="M5.5 7V4.8a2.5 2.5 0 0 1 5 0V7" />
        </svg>
      );
    case "notat":
      // Et ark med linjer: notatet fra samtalen.
      return (
        <svg {...felles}>
          <path d="M4 2.5h6l2.5 2.5v8.5H4z" />
          <path d="M6 7.5h4.5M6 10h3" />
        </svg>
      );
    case "notat-fylt":
      return (
        <svg {...felles}>
          <path
            d="M4 2.5h6l2.5 2.5v8.5H4z"
            fill="currentColor"
            fillOpacity={0.18}
          />
          <path d="M6 7.5h4.5M6 10h3" />
        </svg>
      );
    case "motte-ikke":
      // Sirkel med skråstrek: samtalen ble ikke noe av.
      return (
        <svg {...felles}>
          <circle cx="8" cy="8" r="5.5" />
          <path d="M4.2 11.8l7.6-7.6" />
        </svg>
      );
    case "apen-las":
      return (
        <svg {...felles}>
          <rect x="3.5" y="7" width="9" height="6.5" rx="1.2" />
          <path d="M5.5 7V4.8a2.5 2.5 0 0 1 4.8-.9" />
        </svg>
      );
    case "kryss":
      return (
        <svg {...felles}>
          <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
        </svg>
      );
    case "hake":
      return (
        <svg {...felles}>
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
      );
    case "pil":
      return (
        <svg {...felles}>
          <path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5" />
        </svg>
      );
    case "opp":
      return (
        <svg {...felles}>
          <path d="M8 12.5v-9M4.5 7L8 3.5 11.5 7" />
        </svg>
      );
    case "ned":
      return (
        <svg {...felles}>
          <path d="M8 3.5v9M4.5 9L8 12.5 11.5 9" />
        </svg>
      );
    case "markor":
      return (
        <svg {...felles} fill="currentColor" stroke="none">
          <path d="M5.5 3.5l6 4.5-6 4.5z" />
        </svg>
      );
  }
}

export function Felt({
  etikett,
  verdi,
  settVerdi,
  plassholder,
  type = "text",
  bredde = "w-full",
  autoFocus,
  onEnter,
}: {
  etikett?: string;
  verdi: string;
  settVerdi: (v: string) => void;
  plassholder?: string;
  type?: "text" | "date";
  bredde?: string;
  autoFocus?: boolean;
  onEnter?: () => void;
}) {
  return (
    <label className={`block ${bredde}`}>
      {etikett && (
        <span className="mb-1 block text-etikett uppercase tracking-etikett text-blekk-dempet">
          {etikett}
        </span>
      )}
      <input
        type={type}
        value={verdi}
        autoFocus={autoFocus}
        placeholder={plassholder}
        onChange={(e) => settVerdi(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) {
            e.preventDefault();
            onEnter();
          }
        }}
        className={`${KONTROLL} w-full rounded border border-linje bg-ark px-2 text-brod tabular-nums outline-none focus:border-aksent`}
      />
    </label>
  );
}

export function Tomtilstand({
  tekst,
  handling,
}: {
  tekst: string;
  handling?: ReactNode;
}) {
  return (
    <div className="border border-dashed border-linje px-4 py-8 text-center text-brod text-blekk-dempet">
      <p>{tekst}</p>
      {handling && <div className="mt-3 flex justify-center">{handling}</div>}
    </div>
  );
}

/**
 * Faget som en liten firkant i fagfargen — samme form som rutene i
 * heatmapet og feltene i logoen (DESIGN.md §4). 8 px i lister, 10–12 px ved
 * titler. Aldri som strek i venstremarg, aldri som flate.
 *
 * Står firkanten ved en tittel med fag over eller under, skal den ligge i
 * egen kolonne på linje med tittelen — ikke skyves inn i tekstlinja.
 */
export function Fagfirkant({
  farge,
  storrelse = 8,
  klasse = "",
}: {
  farge: string | null;
  storrelse?: 8 | 10 | 12;
  klasse?: string;
}) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 rounded-[2px] ${klasse}`}
      style={{
        width: storrelse,
        height: storrelse,
        background: farge ? fagfarge(farge) : "var(--color-linje-sterk)",
      }}
    />
  );
}

/**
 * Fagkode som fargemerke, som i nedtrekkslistene i Airtable. Fargen er fagets
 * egen, tonet ned til bakgrunn og beholdt full styrke på teksten — da leses
 * koden fortsatt godt, og §13 holder: fargeflatene er svake, trafikklyset er
 * det eneste stedet med mettet farge.
 */
export function Fagmerke({
  kode,
  farge,
  liten,
}: {
  kode: string;
  farge: string | null;
  liten?: boolean;
}) {
  // Blir stående som hex, ikke token: linja under limer "1f" bakpå for å få
  // fargen med alfa, og `var(--color-…)1f` er ikke en gyldig verdi.
  const f = farge ?? "#6b6b6b";
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-stor font-medium ${
        liten ? "px-1 py-0 text-etikett" : "px-1.5 py-0.5 text-liten"
      }`}
      style={{ background: `${f}1f`, color: fagfarge(f) }}
    >
      {kode}
    </span>
  );
}

/**
 * Av/på for kolonner i en tabell. Valget hører til brukeren, ikke til dataene,
 * men lagres i `innstilling` slik at det følger databasen til en annen maskin.
 */
export function Kolonnevelger({
  valgbare,
  vis,
  onEndre,
}: {
  valgbare: readonly { id: string; navn: string }[];
  vis: ReadonlySet<string>;
  onEndre: (id: string, pa: boolean) => void;
}) {
  const [apen, setApen] = useState(false);

  return (
    <div className="relative">
      <Knapp variant="stille" onClick={() => setApen((v) => !v)}>
        Kolonner
      </Knapp>
      {apen && (
        <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded border border-linje bg-ark p-2 shadow-lg">
          {valgbare.map((k) => (
            <label
              key={k.id}
              className="flex items-center gap-2 py-0.5 text-brod hover:bg-flate"
            >
              <input
                type="checkbox"
                checked={vis.has(k.id)}
                onChange={(e) => onEndre(k.id, e.target.checked)}
              />
              {k.navn}
            </label>
          ))}
          <button
            onClick={() => setApen(false)}
            className="mt-1 w-full border-t border-linje-medium pt-1 text-liten text-blekk-dempet"
          >
            Lukk
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Fagfilter som knapperad i stedet for rullegardin.
 *
 * En enkeltlærer har tre–fire fag. Da er en nedtrekksliste to klikk og et
 * søk etter noe man allerede vet navnet på, mens knappene viser alle valgene
 * samtidig — og fargen gjør at man kjenner igjen faget uten å lese koden.
 *
 * Tom streng betyr «alle fag», og er alltid første knapp.
 */
export function Fagfiltre({
  fag,
  valgt,
  settValgt,
  alleTekst = "Alle fag",
}: {
  fag: { id: string; kode: string; farge: string | null }[];
  valgt: string;
  settValgt: (id: string) => void;
  alleTekst?: string;
}) {
  if (fag.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Fagknapp aktiv={valgt === ""} farge={null} onClick={() => settValgt("")}>
        {alleTekst}
      </Fagknapp>
      {fag.map((f) => (
        <Fagknapp
          key={f.id}
          aktiv={valgt === f.id}
          farge={f.farge}
          // Et nytt klikk på det valgte faget slår filteret av igjen, så man
          // slipper å sikte på «Alle fag» for å komme tilbake.
          onClick={() => settValgt(valgt === f.id ? "" : f.id)}
        >
          {f.kode}
        </Fagknapp>
      ))}
    </div>
  );
}

/**
 * Fagfilter med flere valg, og AND/OR mellom dem.
 *
 * Deler knappene med `Fagfiltre` over. Bryteren vises først når to fag er
 * valgt — med ett fag betyr «alle» og «minst ett» det samme, og et valg som
 * ikke gjør noe er verre enn ingen.
 */
export function Fagflervalg({
  fag,
  valgte,
  settValgte,
  modus,
  settModus,
  utenFag,
  settUtenFag,
  antallUtenFag,
}: {
  fag: { id: string; kode: string; farge: string | null }[];
  valgte: ReadonlySet<string>;
  settValgte: (v: Set<string>) => void;
  modus: "alle" | "minstEtt";
  settModus: (m: "alle" | "minstEtt") => void;
  /** «Uten fag»: elevene som ikke er koblet til noe fag. Valgfritt. */
  utenFag?: boolean;
  settUtenFag?: (pa: boolean) => void;
  antallUtenFag?: number;
}) {
  if (fag.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Fagknapp
        aktiv={valgte.size === 0 && !utenFag}
        farge={null}
        onClick={() => {
          settValgte(new Set());
          settUtenFag?.(false);
        }}
      >
        Alle fag
      </Fagknapp>
      {fag.map((f) => (
        <Fagknapp
          key={f.id}
          aktiv={valgte.has(f.id)}
          farge={f.farge}
          onClick={() => {
            const ny = new Set(valgte);
            if (ny.has(f.id)) ny.delete(f.id);
            else ny.add(f.id);
            settValgte(ny);
          }}
        >
          {f.kode}
        </Fagknapp>
      ))}

      {settUtenFag && (
        <Fagknapp
          aktiv={!!utenFag}
          farge={null}
          onClick={() => settUtenFag(!utenFag)}
        >
          Uten fag
          {antallUtenFag !== undefined && (
            <span className="ml-1 tabular-nums text-blekk-svak">
              {antallUtenFag}
            </span>
          )}
        </Fagknapp>
      )}

      {valgte.size > 1 && (
        <Bryter
          storrelse="liten"
          verdi={modus}
          settVerdi={(v) => settModus(v as typeof modus)}
          valg={[
            {
              id: "alle",
              navn: "har alle",
              tittel: "Eleven må ha samtlige valgte fag",
            },
            {
              id: "minstEtt",
              navn: "minst ett",
              tittel: "Eleven må ha minst ett av de valgte fagene",
            },
          ]}
        />
      )}
    </div>
  );
}

/**
 * Tekst som kuttes når plassen tar slutt — og som alltid kan leses likevel.
 *
 * `truncate` alene gjør teksten uleselig: «Norrøn litteratur og sagatra…» og
 * så er resten borte for godt. Her følger hele verdien med som `title`, så
 * den ligger ett sekunds peking unna. Poenget med komponenten er at de to
 * tingene ikke kan skilles ad ved et uhell.
 */
export function Kappet({
  verdi,
  tom = "—",
  klasse = "",
}: {
  verdi: string | null | undefined;
  tom?: string;
  klasse?: string;
}) {
  if (verdi == null || verdi === "")
    return <span className={`truncate text-blekk-svak ${klasse}`}>{tom}</span>;
  return (
    <span title={verdi} className={`truncate ${klasse}`}>
      {verdi}
    </span>
  );
}

/**
 * Segmentbryter — et valg mellom to eller flere likestilte alternativer.
 *
 * Fantes åtte steder håndskrevet, med seks ulike paddinger og fire ulike
 * hjørneradier for nøyaktig samme kontroll. Det er den slags sprik som leser
 * som hjemmesnekra, selv når hvert enkelt sted ser greit ut for seg.
 */
export function Bryter({
  valg,
  verdi,
  settVerdi,
  storrelse = "vanlig",
  fyll = false,
  usikker = false,
}: {
  valg: { id: string; navn: ReactNode; tittel?: string }[];
  /** valget er gjettet og ikke bekreftet: tommelen er gjennomsiktig med kant */
  usikker?: boolean;
  verdi: string;
  settVerdi: (id: string) => void;
  storrelse?: "vanlig" | "liten";
  /** full bredde, med like brede valg */
  fyll?: boolean;
}) {
  const tekst = storrelse === "liten" ? "text-liten" : "text-brod";
  // Den hvite tommelen glir under teksten (DESIGN.md §8).
  const beholder = useRef<HTMLSpanElement>(null);
  const knapper = useRef(new Map<string, HTMLButtonElement>());
  const [mal, setMal] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setMal(knapper.current.get(verdi) ?? null);
  }, [verdi, valg.length]);

  return (
    <span
      ref={beholder}
      className={`${fyll ? "flex w-full" : "inline-flex"} relative items-center gap-0.5 rounded-vanlig bg-flate p-0.5`}
    >
      <Glideflate
        beholder={beholder}
        mal={mal}
        klasse={
          usikker
            ? "rounded-liten bg-ark/60 shadow-[inset_0_0_0_1px_var(--color-linje-sterk)]"
            : "rounded-liten bg-ark shadow-lav"
        }
      />
      {valg.map((v) => (
        <button
          key={v.id}
          ref={(el) => {
            if (el) knapper.current.set(v.id, el);
            else knapper.current.delete(v.id);
          }}
          onClick={() => settVerdi(v.id)}
          aria-pressed={verdi === v.id}
          title={v.tittel}
          className={`${fyll ? "flex-1" : ""} relative z-[1] rounded-liten px-2.5 py-1 ${tekst} whitespace-nowrap transition-colors ${
            verdi === v.id
              ? "font-medium text-blekk"
              : "text-blekk-dempet hover:text-blekk"
          }`}
        >
          {v.navn}
        </button>
      ))}
    </span>
  );
}

/**
 * Kvadratisk ikonknapp — kryss, pluss, pil. Fantes i tre ulike størrelser og
 * former. Treffflaten er 24px selv om symbolet er mindre.
 */
export function Ikonknapp({
  onClick,
  tittel,
  disabled,
  children,
}: {
  onClick?: () => void;
  tittel: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={tittel}
      aria-label={tittel}
      disabled={disabled}
      className="grid h-6 w-6 shrink-0 place-items-center rounded-liten text-blekk-svak transition-colors hover:bg-flate hover:text-blekk disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Fagknapp({
  aktiv,
  farge,
  onClick,
  children,
}: {
  aktiv: boolean;
  farge: string | null;
  onClick: () => void;
  children: React.ReactNode;
}) {
  // Som i Fagmerke: hex med alfa limt bakpå, fordi var(--color-…)1f ikke er
  // en gyldig fargeverdi.
  const f = farge ?? "var(--color-blekk-dempet)";
  const stil = aktiv
    ? farge
      ? { background: `${farge}1f`, color: farge, borderColor: farge }
      : {
          background: "var(--color-valgt)",
          color: "var(--color-blekk)",
          borderColor: "var(--color-linje-sterk)",
        }
    : { color: f };

  return (
    <button
      onClick={onClick}
      aria-pressed={aktiv}
      style={stil}
      className={`whitespace-nowrap rounded-liten border px-2 py-1 text-liten font-medium ${
        aktiv ? "" : "border-linje hover:bg-flate"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Kontekstmeny ved musepekeren.
 *
 * Lukkes av Escape, et klikk hvor som helst, og av rulling — en meny som blir
 * hengende igjen mens innholdet under flytter seg, peker på feil rad.
 *
 * Posisjonen justeres etter måling, så menyen ikke havner utenfor vinduet når
 * du høyreklikker nederst eller helt til høyre.
 */
export function Kontekstmeny({
  x,
  y,
  onLukk,
  children,
}: {
  x: number;
  y: number;
  onLukk: () => void;
  children: ReactNode;
}) {
  const meny = useRef<HTMLDivElement>(null);
  const [plass, setPlass] = useState({ venstre: x, topp: y });
  const inne = useInngang();

  useLayoutEffect(() => {
    const el = meny.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPlass({
      venstre: Math.min(x, window.innerWidth - width - 8),
      topp: Math.min(y, window.innerHeight - height - 8),
    });
  }, [x, y]);

  useEffect(() => {
    const lukk = () => onLukk();
    // Et trykk utenfor lukker — på mousedown, ikke click. Lyttet vi på
    // click, kunne klikket som åpnet menyen nå fram hit og lukke den i samme
    // øyeblikk. I WebKit (appens motor) skjedde nettopp det med Årsplan-
    // knappen: menyen åpnet og lukket seg før den ble tegnet.
    const utenfor = (e: MouseEvent) => {
      if (!meny.current?.contains(e.target as Node)) onLukk();
    };
    const tast = (e: KeyboardEvent) => e.key === "Escape" && onLukk();
    window.addEventListener("mousedown", utenfor);
    // capture på rulling: den bobler ikke fra en rullesone lenger inne.
    window.addEventListener("scroll", lukk, true);
    window.addEventListener("keydown", tast);
    return () => {
      window.removeEventListener("mousedown", utenfor);
      window.removeEventListener("scroll", lukk, true);
      window.removeEventListener("keydown", tast);
    };
  }, [onLukk]);

  return (
    <div
      ref={meny}
      role="menu"
      // Et valg i menyen lukker den, etter at valget selv har gjort sitt.
      onClick={onLukk}
      style={{ left: plass.venstre, top: plass.topp }}
      data-inngang="meny"
      data-inne={inne}
      className="glass-sok fixed z-50 min-w-40 rounded-[10px] p-1"
    >
      {children}
    </div>
  );
}

export function Menyvalg({
  onKlikk,
  farlig,
  children,
}: {
  onKlikk: () => void;
  /** rødt, for det som ikke kan angres med ett klikk */
  farlig?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      role="menuitem"
      onClick={onKlikk}
      className={`block w-full rounded-stor px-3 py-1 text-left text-brod hover:bg-[var(--glass-valgt)] ${
        farlig ? "text-feil" : ""
      }`}
    >
      {children}
    </button>
  );
}

/** En linje i ⋯-menyen: navnet, en forklaring under og tasten til høyre. */
export function Menylinje({
  tast,
  under,
  children,
}: {
  tast?: string;
  under?: string;
  children: ReactNode;
}) {
  return (
    <span className="flex w-64 items-center gap-2.5">
      <span className="min-w-0 flex-1">
        <span className="block">{children}</span>
        {under && (
          <span className="block text-etikett text-blekk-dempet">{under}</span>
        )}
      </span>
      {tast && <span className="text-etikett text-blekk-svak">{tast}</span>}
    </span>
  );
}

export function Menyskille() {
  return <div className="mx-2 my-1 h-px bg-linje-medium" />;
}
