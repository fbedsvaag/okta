import { useEffect, useState } from "react";
import { finnFag, type Kompetansemaal } from "../data/grep";
import { hentPeriodemal, settPeriodemal } from "../data/perioder";

/**
 * Kompetansemålene for en periode eller en økt.
 *
 * To ting er med vilje mulige, og begge speiler hvordan undervisning faktisk
 * planlegges:
 *
 * - **Flere mål i én periode.** En periode på seks uker dekker sjelden ett.
 * - **Samme mål i flere perioder.** Et mål man kommer tilbake til i mars er
 *   ikke en dobbeltføring — det er repetisjon, og det skal synes begge steder.
 *
 * Målet som allerede er dekket et annet sted markeres, men blokkeres ikke.
 * En økt arver målene til perioden sin; de står huket av og låst, med
 * periodens navn ved siden av.
 */
export function Malvelger({
  grepKode,
  valgte,
  arvet,
  dekketAndreSteder,
  onBytt,
}: {
  grepKode: string | null;
  /** kodene som er huket av her */
  valgte: string[];
  /** kodene som kommer fra perioden, og hvilken */
  arvet?: { koder: string[]; fra: string };
  /** kodene som er dekket et annet sted i samme fag */
  dekketAndreSteder: Set<string>;
  onBytt: (kode: string, pa: boolean) => Promise<void>;
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
  const arvetSett = new Set(arvet?.koder ?? []);
  const dekket = maal.filter(
    (m) => valgtSett.has(m.kode) || arvetSett.has(m.kode),
  );

  async function bytt(kode: string) {
    setJobber(kode);
    try {
      await onBytt(kode, !valgtSett.has(kode));
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
          {dekket.length} av {maal.length}
        </span>
        <span className="text-blekk-svak">{apen ? "skjul" : "velg"}</span>
      </button>

      {/* Lukket står bare målene som er valgt, så man ser dem uten å åpne. */}
      {!apen && dekket.length > 0 && (
        <ul className="mt-1 space-y-0.5 border-l-2 border-linje-medium pl-3 text-liten text-blekk-dempet">
          {dekket.map((m) => (
            <li key={m.kode}>{m.tekst}</li>
          ))}
        </ul>
      )}

      {apen && (
        <ul className="mt-1 space-y-1 border-l-2 border-linje-medium pl-3">
          {maal.map((m) => {
            const fraPerioden = arvetSett.has(m.kode);
            const pa = valgtSett.has(m.kode) || fraPerioden;
            const annetsteds = !pa && dekketAndreSteder.has(m.kode);
            return (
              <li key={m.kode}>
                <label
                  className={`flex items-start gap-2 text-brod ${fraPerioden ? "" : "cursor-pointer"}`}
                >
                  <input
                    type="checkbox"
                    checked={pa}
                    disabled={fraPerioden || jobber === m.kode}
                    onChange={() => void bytt(m.kode)}
                    className="mt-1 shrink-0"
                  />
                  <span className={pa ? "" : "text-blekk-dempet"}>
                    {m.tekst}
                    {fraPerioden && (
                      <span className="ml-1.5 text-liten text-blekk-svak">
                        · fra perioden «{arvet!.fra}»
                      </span>
                    )}
                    {annetsteds && (
                      <span
                        title="Dekket et annet sted i faget. Det er lov — repetisjon er ikke en dobbeltføring."
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

/**
 * Målene for én periode, med det den trenger hentet selv. Står under
 * penslene i Økter når en periode er valgt, så målene kan velges der
 * perioden males — ikke bare i Perioder-visningen.
 */
export function Periodemal({
  skolearFagId,
  periodeId,
  grepKode,
}: {
  skolearFagId: string;
  periodeId: string;
  grepKode: string | null;
}) {
  const [kart, setKart] = useState<Map<string, string[]>>(new Map());
  const last = () => void hentPeriodemal(skolearFagId).then(setKart);
  useEffect(last, [skolearFagId]);

  const dekket = new Set(
    [...kart.entries()]
      .filter(([id]) => id !== periodeId)
      .flatMap(([, koder]) => koder),
  );

  return (
    <Malvelger
      key={periodeId}
      grepKode={grepKode}
      valgte={kart.get(periodeId) ?? []}
      dekketAndreSteder={dekket}
      onBytt={async (kode, pa) => {
        await settPeriodemal(periodeId, kode, pa);
        last();
      }}
    />
  );
}
