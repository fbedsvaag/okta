import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

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
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "vanlig" | "primar" | "stille";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const stil = {
    vanlig:
      "border border-linje bg-ark text-blekk hover:bg-flate",
    primar:
      "border border-aksent bg-aksent text-white hover:bg-aksent-mork",
    stille:
      "border border-transparent text-blekk-dempet hover:text-blekk hover:bg-flate",
  }[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${KONTROLL} rounded px-3 text-brod transition-colors disabled:opacity-40 disabled:hover:bg-inherit ${stil}`}
    >
      {children}
    </button>
  );
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

export function Fagstrek({ farge }: { farge: string | null }) {
  return (
    <span
      aria-hidden
      className="inline-block h-3.5 w-[3px] shrink-0 rounded-full align-middle"
      style={{ background: farge ?? "var(--color-linje-sterk)" }}
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
      className={`inline-block whitespace-nowrap rounded-sm font-medium ${
        liten ? "px-1 py-0 text-etikett" : "px-1.5 py-0.5 text-liten"
      }`}
      style={{ background: `${f}1f`, color: f }}
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
}: {
  fag: { id: string; kode: string; farge: string | null }[];
  valgte: ReadonlySet<string>;
  settValgte: (v: Set<string>) => void;
  modus: "alle" | "minstEtt";
  settModus: (m: "alle" | "minstEtt") => void;
}) {
  if (fag.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Fagknapp
        aktiv={valgte.size === 0}
        farge={null}
        onClick={() => settValgte(new Set())}
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

      {valgte.size > 1 && (
        <span className="ml-1 flex items-center gap-1 text-liten text-blekk-dempet">
          <button
            onClick={() => settModus("alle")}
            aria-pressed={modus === "alle"}
            title="Eleven må ha samtlige valgte fag"
            className={`rounded-liten px-1.5 py-0.5 ${
              modus === "alle"
                ? "bg-valgt font-medium text-aksent"
                : "hover:bg-flate"
            }`}
          >
            har alle
          </button>
          <button
            onClick={() => settModus("minstEtt")}
            aria-pressed={modus === "minstEtt"}
            title="Eleven må ha minst ett av de valgte fagene"
            className={`rounded-liten px-1.5 py-0.5 ${
              modus === "minstEtt"
                ? "bg-valgt font-medium text-aksent"
                : "hover:bg-flate"
            }`}
          >
            minst ett
          </button>
        </span>
      )}
    </div>
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
    const tast = (e: KeyboardEvent) => e.key === "Escape" && onLukk();
    // capture på rulling: den bobler ikke fra en rullesone lenger inne.
    window.addEventListener("click", lukk);
    window.addEventListener("scroll", lukk, true);
    window.addEventListener("keydown", tast);
    return () => {
      window.removeEventListener("click", lukk);
      window.removeEventListener("scroll", lukk, true);
      window.removeEventListener("keydown", tast);
    };
  }, [onLukk]);

  return (
    <div
      ref={meny}
      role="menu"
      style={{ left: plass.venstre, top: plass.topp }}
      className="fixed z-50 min-w-40 rounded-vanlig border border-linje bg-ark py-1 shadow-[var(--shadow-ark)]"
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
      className={`block w-full px-3 py-1 text-left text-brod hover:bg-flate ${
        farlig ? "text-feil" : ""
      }`}
    >
      {children}
    </button>
  );
}
