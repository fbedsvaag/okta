/**
 * Tidslinja: dato til venstre, en loddrett strek med en prikk per punkt, og
 * innholdet til høyre. Brukes av notatene på elevkortet og øktloggen i
 * fagkortet, så de ser like ut.
 */

/** Dag og måned, med år og ukedag under. */
export function Tidslinjedato({ dato }: { dato: string }) {
  const d = new Date(`${dato}T12:00:00`);
  const dag = d.toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
  const arOgUkedag = `${d.getFullYear()} · ${d.toLocaleDateString("nb-NO", {
    weekday: "short",
  })}`;
  return (
    <div className="w-[4.75rem] shrink-0 pt-px text-right">
      <div className="text-brod font-medium tabular-nums text-blekk">
        {dag.replace(/\.$/, "")}
      </div>
      <div className="text-mikro tabular-nums text-blekk-svak">
        {arOgUkedag.replace(/\.$/, "")}
      </div>
    </div>
  );
}

/**
 * Streken og prikken. `farge` fyller prikken; uten farge er den et tomt
 * omriss. Det nederste punktet avslutter streken ved prikken.
 */
export function Tidslinjestrek({
  sist,
  farge,
  tittel,
}: {
  sist: boolean;
  farge?: string | null;
  tittel?: string;
}) {
  return (
    <div className="relative w-3 shrink-0" aria-hidden={!tittel}>
      <span
        className={`absolute left-1/2 top-0 w-px -translate-x-1/2 bg-linje ${
          sist ? "h-2" : "h-full"
        }`}
      />
      <span
        title={tittel}
        className={`absolute left-1/2 top-[0.4rem] h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 ${
          farge ? "border-ark" : "border-linje-sterk bg-ark"
        }`}
        style={farge ? { background: farge } : undefined}
      />
    </div>
  );
}
