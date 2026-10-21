/**
 * Merket foran en vurdering (DESIGN.md §6): 16 × 16, radius 4, i gull med
 * hvitt symbol — snakkeboble for muntlig, blyant for skriftlig. Egne
 * tegninger, ikke emoji.
 */
export function Vurderingsikon({
  type,
  klasse = "",
  utkast = false,
  noytral = false,
}: {
  type: "skriftlig" | "muntlig" | "praktisk" | null;
  klasse?: string;
  /** hentet fra i fjor og ikke bekreftet (§24): dempet */
  utkast?: boolean;
  /** grått i stedet for gull, der gullet ville stjele blikket (elevkortet) */
  noytral?: boolean;
}) {
  return (
    <span
      title={
        (type === "muntlig" ? "Muntlig vurdering" : "Skriftlig vurdering") +
        (utkast ? " (utkast)" : "")
      }
      className={`inline-grid h-4 w-4 shrink-0 place-items-center rounded-[4px] ${noytral ? "bg-flate shadow-[inset_0_0_0_1px_var(--color-linje)]" : "bg-vurdering"} ${
        utkast ? "opacity-40" : ""
      } ${klasse}`}
    >
      <svg
        aria-hidden
        viewBox="0 0 12 12"
        className="h-[11px] w-[11px]"
        fill="none"
        stroke={noytral ? "var(--color-blekk-dempet)" : "#fff"}
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {type === "muntlig" ? (
          <path d="M2 3.2c0-.7.5-1.2 1.2-1.2h5.6c.7 0 1.2.5 1.2 1.2v3.6c0 .7-.5 1.2-1.2 1.2H5.2L3 9.8V8h0c-.6 0-1-.5-1-1.1z" />
        ) : (
          <>
            <path d="M7.6 2.2l2.2 2.2-5.4 5.4H2.2V7.6z" />
            <path d="M6.6 3.2l2.2 2.2" />
          </>
        )}
      </svg>
    </span>
  );
}

/** «Muntlig», «Skriftlig», «Praktisk» — kolonnen viser bare typen. */
export function vurderingstype(
  type: "skriftlig" | "muntlig" | "praktisk" | null,
): string {
  return type === "muntlig"
    ? "Muntlig"
    : type === "praktisk"
      ? "Praktisk"
      : type === "skriftlig"
        ? "Skriftlig"
        : "Vurdering";
}

/**
 * Et vurderingsvalg i nedtrekksmenyen (17.2, «Lang liste» i Nedtrekk):
 * ikonet for formen foran, og fristen («4.11») til høyre.
 */
export function vurderingsvalg(v: {
  id: string;
  tittel: string;
  type: "skriftlig" | "muntlig" | "praktisk" | null;
  frist?: string | null;
}) {
  const f = v.frist ? new Date(`${v.frist}T12:00:00`) : null;
  return {
    verdi: v.id,
    tekst: v.tittel,
    ikon: <Vurderingsikon type={v.type} />,
    hint: f ? `${f.getDate()}.${f.getMonth() + 1}` : undefined,
  };
}

/** «Utkast» ved en vurdering hentet fra i fjor (§24). Nøytral, ikke farge. */
export function Utkastmerke({ klasse = "" }: { klasse?: string }) {
  return (
    <span
      className={`shrink-0 rounded-full border border-dashed border-linje-sterk px-1.5 text-etikett leading-[16px] text-blekk-dempet ${klasse}`}
    >
      Utkast
    </span>
  );
}
