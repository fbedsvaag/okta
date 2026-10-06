import type { ReactNode } from "react";

/**
 * Tastestripa (DESIGN.md §6): der en flate har egne taster, står de i en
 * tonet stripe nederst — små rammer rundt tastene, og hovedknappen helt til
 * høyre. Ikke som en egen tasteoversikt.
 */
export function Tastestripe({
  children,
  klasse = "",
}: {
  children: ReactNode;
  klasse?: string;
}) {
  return (
    <div
      className={`flex items-center justify-end gap-3.5 bg-stripe px-3 py-2 text-[calc(11px*var(--tekst-skala))] text-blekk-dempet ${klasse}`}
    >
      {children}
    </div>
  );
}

/** Én tast, eller flere, med hva de gjør. */
export function Tasthint({
  taster,
  children,
}: {
  taster: string[];
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {taster.map((t) => (
        <kbd
          key={t}
          className="inline-flex items-center rounded-[4px] border border-linje bg-ark px-1.5 font-sans leading-4 text-blekk"
        >
          {t}
        </kbd>
      ))}
      {children}
    </span>
  );
}
