import { useState, type ReactNode } from "react";

/**
 * Referansen er den norske klassejournalen: linjert, tett, uten pynt (§13).
 * Alt her er nedtonet med vilje — trafikklyset skal være det eneste stedet i
 * appen med mettet farge.
 */

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
      className={`rounded px-3 py-1.5 text-brod transition-colors disabled:opacity-40 disabled:hover:bg-inherit ${stil}`}
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
        className="w-full rounded border border-linje bg-ark px-2 py-1.5 text-brod tabular-nums outline-none focus:border-aksent focus:ring-1 focus:ring-aksent"
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
