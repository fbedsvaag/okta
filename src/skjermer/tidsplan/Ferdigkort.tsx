/**
 * Alle samtalene er holdt (ARBEIDSLISTE 31.4): et kort, rolig bilde etter
 * siste elev i en muntlig vurdering eller en mentorrunde, før resultatene
 * eller oppsummeringen. Tallene står som én linje, ikke som store tall
 * (SPEC §13). Ingen utropstegn, ingen konfetti.
 */
export function Ferdigkort({
  tittel,
  linje,
  hoved,
  onHoved,
  onTilbake,
}: {
  tittel: string;
  /** «14 holdt · 1 møtte ikke · snitt 4,2» */
  linje: string;
  hoved: string;
  onHoved: () => void;
  onTilbake: () => void;
}) {
  return (
    <div className="ferdig-inn flex flex-col items-center gap-2.5 px-5 py-16 text-center">
      <svg
        aria-hidden
        width="132"
        height="92"
        viewBox="0 0 132 92"
        fill="none"
        stroke="var(--color-linje-sterk)"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Tidsplanen, alle prikkene fylt, og en hake over. */}
        <rect x="18" y="30" width="96" height="54" rx="10" />
        <path d="M18 46h96" />
        {[38, 54, 70, 86].map((x) => (
          <circle
            key={x}
            cx={x}
            cy="64"
            r="4"
            fill="var(--color-aksent)"
            stroke="none"
            opacity={0.55}
          />
        ))}
        <circle cx="66" cy="18" r="13" fill="var(--color-ark)" />
        <path
          d="M60 18l4.5 4.5 8-9"
          stroke="var(--color-aksent)"
          strokeWidth={2}
        />
        <path d="M38 10l-4-4M94 10l4-4M30 22h-5M102 22h5" />
      </svg>
      <h3 className="mt-1.5 text-[calc(22px*var(--tekst-skala))] font-light tracking-[-.01em]">
        {tittel}
      </h3>
      <p className="text-[calc(13.5px*var(--tekst-skala))] tabular-nums text-blekk-dempet">
        {linje}
      </p>
      <div className="mt-2 flex gap-2">
        <button
          autoFocus
          onClick={onHoved}
          className="h-[30px] rounded-full bg-aksent px-3.5 text-[13px] font-medium text-ark hover:bg-aksent-mork"
        >
          {hoved} ↵
        </button>
        <button
          onClick={onTilbake}
          className="h-[30px] rounded-full border border-linje-sterk bg-ark px-3.5 text-[13px] hover:bg-flate"
        >
          Tilbake til tidsplanen
        </button>
      </div>
    </div>
  );
}

/**
 * Linja under tittelen: hvor mange som ble holdt, hvor mange som ikke
 * møtte, og snittet når karakterene er tall. Verdier som ikke teller, er
 * ikke med i snittet (§5.1).
 */
export function ferdiglinje(n: {
  holdt: number;
  motteIkke: number;
  karakterer?: { kode: string; teller_ikke: number }[];
  medForesatt?: number;
}): string {
  const deler = [`${n.holdt} ${n.holdt === 1 ? "samtale" : "samtaler"} holdt`];
  if (n.medForesatt) deler.push(`${n.medForesatt} med foresatt`);
  if (n.motteIkke) deler.push(`${n.motteIkke} møtte ikke`);
  const tall = (n.karakterer ?? [])
    .filter((k) => k.teller_ikke === 0 && /^\d+$/.test(k.kode))
    .map((k) => Number(k.kode));
  if (tall.length)
    deler.push(
      `snitt ${(tall.reduce((a, b) => a + b, 0) / tall.length).toLocaleString("nb-NO", { maximumFractionDigits: 1 })}`,
    );
  return deler.join(" · ");
}
