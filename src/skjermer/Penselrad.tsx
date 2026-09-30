import { useEffect, useState } from "react";
import { opprettPeriode, type Periode } from "../data/perioder";

/** Viskelæret: fargelegger med «ingen periode». */
export const VISK = "visk";
export type Pensel = string | typeof VISK | null;

/**
 * Periodiseringen som fargelegging, SPEC §4.2.
 *
 * Fagets perioder står som pensler over øktlista. Velg én, og klikk eller
 * dra over radene for å fargelegge dem. Viskelæret tar perioden bort. En ny
 * periode lages rett her og blir valgt med en gang — ett navn, Enter, og så
 * er det bare å male.
 *
 * Er det allerede krysset av for rader, farges de med én gang penselen
 * velges, i stedet for at penselen blir liggende.
 */
export function Penselrad({
  skolearFagId,
  perioder,
  antall,
  pensel,
  harMerket,
  onVelg,
  onMalMerkede,
  onNy,
}: {
  skolearFagId: string;
  /** fagets perioder, i rekkefølge */
  perioder: Periode[];
  /** hvor mange økter hver periode har, til tallet på penselen */
  antall: Map<string, number>;
  pensel: Pensel;
  harMerket: boolean;
  onVelg: (p: Pensel) => void;
  onMalMerkede: (p: Exclude<Pensel, null>) => void;
  /** en periode er laget; last på nytt og velg den som pensel */
  onNy: (id: string) => void;
}) {
  const [lager, setLager] = useState(false);
  const [navn, setNavn] = useState("");

  // Escape legger fra seg penselen.
  useEffect(() => {
    if (!pensel) return;
    const tast = (e: KeyboardEvent) => e.key === "Escape" && onVelg(null);
    window.addEventListener("keydown", tast);
    return () => window.removeEventListener("keydown", tast);
  }, [pensel, onVelg]);

  function velg(p: Exclude<Pensel, null>) {
    if (harMerket) return onMalMerkede(p);
    onVelg(pensel === p ? null : p);
  }

  async function lag() {
    const n = navn.trim();
    if (!n) return setLager(false);
    const id = await opprettPeriode(
      skolearFagId,
      n,
      null,
      null,
      perioder.length + 1,
    );
    setNavn("");
    setLager(false);
    onNy(id);
  }

  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-etikett uppercase tracking-etikett text-blekk-dempet">
        Periode
      </span>
      {perioder.map((p) => {
        const aktiv = pensel === p.id;
        return (
          <button
            key={p.id}
            onClick={() => velg(p.id)}
            title={
              harMerket
                ? `Fargelegg de avkryssede med ${p.navn}`
                : aktiv
                  ? "Legg fra deg penselen (Esc)"
                  : `Fargelegg med ${p.navn}`
            }
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-liten ${
              aktiv
                ? "border-blekk bg-ark font-medium text-blekk"
                : "border-linje text-blekk-dempet hover:border-linje-sterk hover:text-blekk"
            }`}
            style={aktiv ? { boxShadow: `inset 0 -3px 0 ${p.farge}` } : {}}
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: p.farge ?? "var(--color-linje-sterk)" }}
            />
            {p.navn}
            <span className="tabular-nums text-blekk-svak">
              {antall.get(p.id) ?? 0}
            </span>
          </button>
        );
      })}

      {perioder.length > 0 && (
        <button
          onClick={() => velg(VISK)}
          title={
            harMerket
              ? "Ta perioden bort fra de avkryssede"
              : "Viskelær: klikk eller dra over øktene for å ta perioden bort"
          }
          className={`rounded-full border px-2.5 py-0.5 text-liten ${
            pensel === VISK
              ? "border-blekk bg-ark font-medium text-blekk"
              : "border-dashed border-linje text-blekk-svak hover:text-blekk"
          }`}
        >
          Ingen periode
        </button>
      )}

      {lager ? (
        <input
          autoFocus
          value={navn}
          onChange={(e) => setNavn(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void lag();
            if (e.key === "Escape") {
              setNavn("");
              setLager(false);
            }
          }}
          onBlur={() => void lag()}
          placeholder="Navn på perioden"
          className="w-44 rounded-full border border-aksent bg-ark px-2.5 py-0.5 text-liten outline-none"
        />
      ) : (
        <button
          onClick={() => setLager(true)}
          className="rounded-full px-2 py-0.5 text-liten text-blekk-dempet hover:text-blekk"
        >
          + Ny periode
        </button>
      )}

      {pensel && (
        <span className="ml-1 text-liten text-blekk-svak">
          Klikk eller dra over øktene · Esc for å avslutte
        </span>
      )}
    </div>
  );
}
