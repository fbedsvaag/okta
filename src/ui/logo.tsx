/**
 * Merket og ordmerket: Bolk med glass (valgt 05.10.2026).
 *
 * Tre stående felt som avtar i bredde og styrke, på en avrundet plate —
 * samme form som fagfirkanten og rutene i heatmapet. Merket er appen i
 * miniatyr. Glasset er tre ting: en lys innerkant på plata, en lys kant på
 * feltene, og en svak skygge under det brede feltet.
 *
 * Tegnet i koden framfor å lastes som fil, av to grunner: det arver
 * tekstfargen der det trengs, og det finnes ingen forsinkelse mellom at
 * skallet tegnes og at merket dukker opp.
 *
 * Kildefilene ligger i `src/assets/`: `logo-glass.svg` (mørk, hovedvariant
 * og appikon), `logo-glass-lys.svg` (felt i aksenten) og
 * `logo-glass-tonet.svg` (hvitt på mørkt, for macOS sitt tonede utseende).
 * Endres formene her, må de endres der — og i `scripts/lag-ikoner.mjs`,
 * som tegner appikonet.
 */

type Farger = {
  plate: string;
  /** kanten rundt plata; null = ingen */
  platekant: string | null;
  /** innerkanten: farge, gjennomsiktighet og bredde */
  innerkant: [string, number, number];
  skygge: [string, number];
  felt: [string, string, string];
  /** gjennomsiktigheten på den hvite kanten rundt hvert felt */
  feltkant: [number, number, number];
};

const LYS: Farger = {
  plate: "#F7F6FB",
  platekant: "#D9D4E8",
  innerkant: ["#FFFFFF", 1, 12],
  skygge: ["#241F33", 0.12],
  felt: ["#4A3D7D", "#9584C8", "#C4B8E3"],
  feltkant: [0.45, 0.5, 0.6],
};
const MORK: Farger = {
  plate: "#241F33",
  platekant: null,
  innerkant: ["#FFFFFF", 0.16, 8],
  skygge: ["#000000", 0.3],
  felt: ["#EEEDFE", "#C9C2DD", "#9A90B8"],
  feltkant: [0.6, 0.4, 0.3],
};

const FELT = [
  { x: 290, w: 200, rx: 44 },
  { x: 516, w: 100, rx: 40 },
  { x: 642, w: 100, rx: 40 },
];

export function Merke({
  storrelse = 22,
  variant = "mork",
}: {
  storrelse?: number;
  /**
   * «mork» er hovedvarianten (og appikonet). «lys» har lys plate og felt i
   * aksenten — til lyse flater der den mørke blir for tung.
   */
  variant?: "lys" | "mork";
}) {
  const f = variant === "mork" ? MORK : LYS;
  // Under 32 px blir glasskantene bare grums; da tegnes plate og felt.
  const glass = storrelse >= 32;
  return (
    <svg
      viewBox="0 0 1024 1024"
      width={storrelse}
      height={storrelse}
      aria-hidden
      className="shrink-0"
    >
      <rect
        x="40"
        y="40"
        width="944"
        height="944"
        rx="215"
        fill={f.plate}
        stroke={f.platekant ?? undefined}
        strokeWidth={f.platekant ? 4 : undefined}
      />
      {glass && (
        <>
          <rect
            x="48"
            y="48"
            width="928"
            height="928"
            rx="208"
            fill="none"
            stroke={f.innerkant[0]}
            strokeOpacity={f.innerkant[1]}
            strokeWidth={f.innerkant[2]}
          />
          <rect
            x="302"
            y="346"
            width="200"
            height="364"
            rx="44"
            fill={f.skygge[0]}
            fillOpacity={f.skygge[1]}
          />
        </>
      )}
      {FELT.map((felt, i) => (
        <rect
          key={i}
          x={felt.x}
          y="330"
          width={felt.w}
          height="364"
          rx={felt.rx}
          fill={f.felt[i]}
          stroke={glass ? "#FFFFFF" : undefined}
          strokeOpacity={glass ? f.feltkant[i] : undefined}
          strokeWidth={glass ? 6 : undefined}
        />
      ))}
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
