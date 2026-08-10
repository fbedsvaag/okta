import { useEffect, useState } from "react";
import { finnFag, type Kompetansemaal } from "../data/grep";
import { settPeriodemal } from "../data/perioder";

/**
 * Kompetansemålene for en periode.
 *
 * To ting er med vilje mulige, og begge speiler hvordan undervisning faktisk
 * planlegges:
 *
 * - **Flere mål i én periode.** En periode på seks uker dekker sjelden ett.
 * - **Samme mål i flere perioder.** Et mål man kommer tilbake til i mars er
 *   ikke en dobbeltføring — det er repetisjon, og det skal synes begge steder.
 *
 * Målet som allerede er dekket et annet sted markeres, men blokkeres ikke.
 */
export function Malvelger({
  grepKode,
  periodeId,
  valgte,
  dekketAndreSteder,
  onEndret,
}: {
  grepKode: string | null;
  periodeId: string;
  /** kodene som er huket av for denne perioden */
  valgte: string[];
  /** kodene som er dekket av en annen periode i samme fag */
  dekketAndreSteder: Set<string>;
  onEndret: () => void;
}) {
  const [maal, setMaal] = useState<Kompetansemaal[]>([]);
  const [apen, setApen] = useState(false);
  const [jobber, setJobber] = useState<string | null>(null);

  useEffect(() => {
    if (!grepKode) return;
    void finnFag(grepKode).then((f) => setMaal(f?.kompetansemaal ?? []));
  }, [grepKode]);

  if (!grepKode) return null;

  const valgtSett = new Set(valgte);

  async function bytt(kode: string) {
    setJobber(kode);
    try {
      await settPeriodemal(periodeId, kode, !valgtSett.has(kode));
      onEndret();
    } finally {
      setJobber(null);
    }
  }

  return (
    <div className="mt-1">
      <button
        onClick={() => setApen((v) => !v)}
        className="flex items-baseline gap-2 text-liten text-blekk-dempet hover:text-blekk"
      >
        <span>Kompetansemål</span>
        <span className="tabular-nums">
          {valgte.length} av {maal.length}
        </span>
        <span className="text-blekk-svak">{apen ? "skjul" : "velg"}</span>
      </button>

      {apen && (
        <ul className="mt-1 space-y-1 border-l-2 border-linje-medium pl-3">
          {maal.map((m) => {
            const pa = valgtSett.has(m.kode);
            const annetsteds = !pa && dekketAndreSteder.has(m.kode);
            return (
              <li key={m.kode}>
                <label className="flex cursor-pointer items-start gap-2 text-brod">
                  <input
                    type="checkbox"
                    checked={pa}
                    disabled={jobber === m.kode}
                    onChange={() => void bytt(m.kode)}
                    className="mt-1 shrink-0"
                  />
                  <span className={pa ? "" : "text-blekk-dempet"}>
                    {m.tekst}
                    {annetsteds && (
                      <span
                        title="Dekket i en annen periode. Det er lov — repetisjon er ikke en dobbeltføring."
                        className="ml-1.5 text-liten text-blekk-svak"
                      >
                        · dekket ellers
                      </span>
                    )}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
