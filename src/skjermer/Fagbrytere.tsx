import type { FagIAr } from "../data/fag";
import { fagfarge } from "../ui/farger";
import { lesJson } from "../data/json";
import { useLagretInnstilling } from "../ui/useLagretInnstilling";

/** Nøkkelen samtaledagene skjules under, ved siden av fagenes id-er. */
export const SAMTALER = "samtaler";

/**
 * Fagene øverst til høyre i kalenderen, hvert i sin tone med hake
 * (ARBEIDSLISTE 15.1). Et klikk skjuler faget; brikka blir hvit med tom
 * boks. Et klikk til viser det igjen.
 */
export function Fagbrytere({
  fag,
  samtaler,
  skjult,
  onVeksle,
  klasse = "ml-auto",
}: {
  klasse?: string;
  fag: FagIAr[];
  /** om det finnes samtaledager i året; da får de sin egen brikke */
  samtaler: boolean;
  skjult: Set<string>;
  onVeksle: (id: string) => void;
}) {
  const valg = [
    ...fag.map((f) => ({
      id: f.id,
      navn: f.kode,
      farge: f.farge ? fagfarge(f.farge) : "var(--color-blekk-dempet)",
    })),
    ...(samtaler
      ? [{ id: SAMTALER, navn: "Mentorsamtaler", farge: "var(--color-aksent)" }]
      : []),
  ];
  if (valg.length < 2) return null;
  return (
    <span className={`flex flex-wrap items-center gap-1.5 ${klasse}`}>
      {valg.map((v) => {
        const av = skjult.has(v.id);
        return (
          <button
            key={v.id}
            onClick={() => onVeksle(v.id)}
            title={`${av ? "Vis" : "Skjul"} ${v.navn}`}
            aria-pressed={!av}
            className={`fagbryter ${av ? "av" : ""}`}
            style={{ "--fc": v.farge } as React.CSSProperties}
          >
            <span className="fagbryter-boks">
              {!av && (
                <svg width="8" height="8" viewBox="0 0 10 10" aria-hidden>
                  <path
                    d="M1.8 5.2l2.2 2.2L8.4 2.8"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
            {v.navn}
          </button>
        );
      })}
    </span>
  );
}

/**
 * Fagene som er skjult, huskes per visning (17.1): kalenderen og øktlista
 * har hver sin nøkkel.
 */
export function useSkjulteFag(
  nokkel: string,
): [Set<string>, (id: string) => void] {
  const [skjult, settSkjult] = useLagretInnstilling<Set<string>>(
    nokkel,
    new Set(),
    (v) => new Set(lesJson<string[]>(v, [])),
    (v) => JSON.stringify([...v]),
  );
  function veksle(id: string) {
    const ny = new Set(skjult);
    if (ny.has(id)) ny.delete(id);
    else ny.add(id);
    settSkjult(ny);
  }
  return [skjult, veksle];
}
