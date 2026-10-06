/**
 * Merket foran en vurdering (DESIGN.md §6): 16 × 16, radius 4, i gull med
 * hvitt symbol — snakkeboble for muntlig, blyant for skriftlig. Egne
 * tegninger, ikke emoji.
 */
export function Vurderingsikon({
  type,
  klasse = "",
}: {
  type: "skriftlig" | "muntlig" | "praktisk" | null;
  klasse?: string;
}) {
  return (
    <span
      title={type === "muntlig" ? "Muntlig vurdering" : "Skriftlig vurdering"}
      className={`inline-grid h-4 w-4 shrink-0 place-items-center rounded-[4px] bg-vurdering ${klasse}`}
    >
      <svg
        aria-hidden
        viewBox="0 0 12 12"
        className="h-[11px] w-[11px]"
        fill="none"
        stroke="#fff"
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
