/**
 * Merket og ordmerket.
 *
 * Tre stående felt som avtar i bredde og styrke, på en avrundet plate.
 * Feltene er de samme du finner igjen som fargestreken i venstremarg og som
 * ruter i heatmapet — merket er appen i miniatyr.
 *
 * Tegnet i koden framfor å lastes som fil, av to grunner: det arver
 * tekstfargen der det trengs, og det finnes ingen forsinkelse mellom at
 * skallet tegnes og at merket dukker opp.
 *
 * Kildefilene ligger i `src/assets/logo.svg` (mørk, hovedvariant) og
 * `logo-lys.svg`. Endres formene her, må de endres der — og i
 * `scripts/lag-ikoner.mjs`, som tegner appikonet.
 */

const LYS = { plate: "#F4F2F9", felt: ["#241F33", "#534AB7", "#AFA9EC"] };
const MORK = { plate: "#241F33", felt: ["#EEEDFE", "#C9C2DD", "#9A90B8"] };

export function Merke({
  storrelse = 22,
  variant = "lys",
}: {
  storrelse?: number;
  /** «lys» har lys plate og mørke felt — den som hører hjemme på lyse flater. */
  variant?: "lys" | "mork";
}) {
  const f = variant === "mork" ? MORK : LYS;
  return (
    <svg
      viewBox="0 0 1024 1024"
      width={storrelse}
      height={storrelse}
      aria-hidden
      className="shrink-0"
    >
      <rect x="100" y="100" width="824" height="824" rx="185" fill={f.plate} />
      <rect x="308" y="342" width="180" height="340" rx="24" fill={f.felt[0]} />
      <rect x="512" y="342" width="90" height="340" rx="24" fill={f.felt[1]} />
      <rect x="626" y="342" width="90" height="340" rx="24" fill={f.felt[2]} />
    </svg>
  );
}

/**
 * Merke og ordmerke sammen.
 *
 * Luften mellom dem tilsvarer feltbredden i merket, så avstanden følger
 * størrelsen i stedet for å være et tall som må justeres.
 */
export function Ordmerke({ storrelse = 22 }: { storrelse?: number }) {
  return (
    <span
      className="flex items-center"
      style={{ gap: storrelse * 0.176 }}
      title="Økta"
    >
      <Merke storrelse={storrelse} />
      <span
        className="font-medium leading-none text-blekk"
        style={{ fontSize: storrelse * 0.77 }}
      >
        Økta
      </span>
    </span>
  );
}
