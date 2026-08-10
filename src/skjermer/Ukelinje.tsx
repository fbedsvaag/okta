import type { Okt } from "../data/okter";

/**
 * Uka lagt ut vannrett: én rad per ukedag, klokka fra venstre mot høyre.
 *
 * Hensikten er å se **formen** på uka, ikke å lese detaljer — hvor blokkene
 * ligger, og like viktig hvor de ikke ligger. En dag uten økter er en tom rad,
 * ikke en dag som mangler i lista. Det er hullene man planlegger etter.
 *
 * Mandag til fredag, som resten av appen (§4.2). Helg tar plass uten å
 * inneholde noe.
 */

/** Klokka vises alltid minst fra 08 til 16, og utvides om øktene krever det. */
const TIDLIGST = 8;
const SENEST = 16;

const DAGER = ["man", "tir", "ons", "tor", "fre"];

export function Ukelinje({
  mandag,
  okter,
  idag,
  onApneOkt,
}: {
  /** ISO-dato for mandagen i uka som vises */
  mandag: string;
  /** øktene i hele uka, ikke bare de som gjenstår */
  okter: Okt[];
  idag: string;
  onApneOkt: (id: string) => void;
}) {
  const datoer = Array.from({ length: 5 }, (_, i) => leggTil(mandag, i));
  const perDag = new Map(datoer.map((d) => [d, okter.filter((o) => o.dato === d)]));

  // Spennet regnes ut fra øktene, så aksen ikke er halvtom i en uke der alt
  // ligger midt på dagen.
  let fra = TIDLIGST;
  let til = SENEST;
  for (const o of okter) {
    if (!o.klokkeslett) continue;
    const start = timer(o.klokkeslett);
    fra = Math.min(fra, Math.floor(start));
    til = Math.max(til, Math.ceil(start + o.varighetMin / 60));
  }
  const spenn = til - fra;
  const timeliste = Array.from({ length: spenn + 1 }, (_, i) => fra + i);

  return (
    <div>
      {/* Timeaksen. Merkene sitter der linjene går, så de flukter. */}
      <div className="relative ml-16 h-4 border-b border-linje">
        {timeliste.map((t) => (
          <span
            key={t}
            className="absolute top-0 -translate-x-1/2 text-mikro tabular-nums text-blekk-svakest"
            style={{ left: `${((t - fra) / spenn) * 100}%` }}
          >
            {t}
          </span>
        ))}
      </div>

      {datoer.map((dato) => {
        const dagens = perDag.get(dato) ?? [];
        const baner = fordelPaBaner(dagens, fra);
        const erIdag = dato === idag;
        const passert = dato < idag;

        return (
          <div
            key={dato}
            className={`flex items-stretch border-b border-linje-svak ${
              erIdag ? "bg-valgt" : ""
            }`}
          >
            <div
              className={`flex w-16 shrink-0 items-center gap-1.5 py-1 text-liten tabular-nums ${
                passert ? "text-blekk-svakest" : "text-blekk-dempet"
              }`}
            >
              <span className={erIdag ? "font-medium text-blekk" : ""}>
                {DAGER[ukedag(dato)]}
              </span>
              <span>{Number(dato.slice(8))}.</span>
            </div>

            <div
              className="relative flex-1"
              style={{ minHeight: `${Math.max(1, baner.length) * 22 + 8}px` }}
            >
              {/* Timelinjer bak øktene, som linjene i en klassejournal. */}
              {timeliste.map((t) => (
                <span
                  key={t}
                  aria-hidden
                  className="absolute inset-y-0 w-px bg-linje-svak"
                  style={{ left: `${((t - fra) / spenn) * 100}%` }}
                />
              ))}

              {baner.map((bane, i) =>
                bane.map((o) => (
                  <Blokk
                    key={o.id}
                    okt={o}
                    fra={fra}
                    spenn={spenn}
                    topp={i * 22 + 4}
                    dempet={passert}
                    onApne={() => onApneOkt(o.id)}
                  />
                )),
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Blokk({
  okt,
  fra,
  spenn,
  topp,
  dempet,
  onApne,
}: {
  okt: Okt;
  fra: number;
  spenn: number;
  topp: number;
  dempet: boolean;
  onApne: () => void;
}) {
  // Uten klokkeslett vet vi ikke hvor på dagen den hører hjemme. Da legges
  // den først på aksen med stiplet kant, framfor å bli plassert et sted som
  // ser presist ut uten å være det.
  const utenTid = !okt.klokkeslett;
  const [start, slutt] = spennet(okt, fra);
  const lengde = slutt - start;

  return (
    <button
      onClick={onApne}
      title={`${okt.fagKode}${okt.tema ? ` — ${okt.tema}` : ""}${
        okt.klokkeslett ? ` · ${okt.klokkeslett}` : " · uten klokkeslett"
      }${okt.sted ? ` · ${okt.sted}` : ""}`}
      className={`absolute flex h-[18px] items-center gap-1 overflow-hidden rounded-liten border bg-ark px-1 text-left text-mikro hover:brightness-95 ${
        utenTid ? "border-dashed border-linje-sterk" : "border-linje"
      } ${dempet ? "opacity-55" : ""}`}
      style={{
        left: `${((start - fra) / spenn) * 100}%`,
        width: `calc(${(lengde / spenn) * 100}% - 2px)`,
        top: topp,
      }}
    >
      <span
        aria-hidden
        className="h-[11px] w-[3px] shrink-0 rounded-full"
        style={{ background: okt.farge ?? "var(--color-linje-sterk)" }}
      />
      <span className="truncate font-medium">{okt.fagKode}</span>
      {okt.tema && <span className="truncate text-blekk-dempet">{okt.tema}</span>}
    </button>
  );
}

/**
 * Hvor på aksen en økt ligger, i timer fra midnatt.
 *
 * Uten klokkeslett legges den først på aksen med én times bredde — samme
 * plassering som `Blokk` tegner den. De to må regne likt, ellers legges to
 * økter uten klokkeslett oppå hverandre.
 */
export function spennet(o: Okt, fra: number): [number, number] {
  if (!o.klokkeslett) return [fra, fra + 1];
  const start = timer(o.klokkeslett);
  return [start, start + o.varighetMin / 60];
}

/**
 * Deler øktene i baner slik at to som overlapper ikke havner oppå hverandre.
 *
 * Det skjer sjelden — men når det gjør det, er det som regel en feil man vil
 * se, ikke skjule.
 */
export function fordelPaBaner(okter: Okt[], fra: number): Okt[][] {
  const sortert = [...okter].sort(
    (a, b) => spennet(a, fra)[0] - spennet(b, fra)[0],
  );
  const baner: Okt[][] = [];

  for (const o of sortert) {
    const [start, slutt] = spennet(o, fra);
    const plass = baner.find((bane) =>
      bane.every((b) => {
        const [bs, bslutt] = spennet(b, fra);
        return start >= bslutt || slutt <= bs;
      }),
    );
    if (plass) plass.push(o);
    else baner.push([o]);
  }
  return baner;
}

function timer(klokkeslett: string): number {
  const [t, m] = klokkeslett.split(":").map(Number);
  return t + (m || 0) / 60;
}

function leggTil(dato: string, dager: number): string {
  const d = new Date(`${dato}T00:00:00`);
  d.setDate(d.getDate() + dager);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Mandag = 0. */
function ukedag(dato: string): number {
  return (new Date(`${dato}T00:00:00`).getDay() + 6) % 7;
}
