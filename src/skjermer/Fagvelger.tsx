import { useEffect, useState } from "react";
import { sokFag, type GrepFag } from "../data/grep";
import { Felt, Kappet, Knapp } from "../ui/felles";

/**
 * Søk opp et fag i Udirs fagliste.
 *
 * Velger du et fag herfra, fylles kode og navn inn — men de er dine å endre
 * etterpå. Du kaller faget MFL1; Udir kaller det «Markedsføring og ledelse 1»
 * med kode SAM3045. Begge deler er riktige, og appen holder dem fra
 * hverandre: `kode` og `navn` er visningsnavnet ditt, `grep_kode` er
 * nøkkelen til kompetansemålene.
 *
 * Fag uten treff i Grep — lokale valgfag, noe skolen setter opp selv — skal
 * kunne opprettes uten å gå veien om dette (§10).
 */
export function Fagvelger({
  onVelg,
  onLukk,
}: {
  onVelg: (fag: GrepFag) => void;
  onLukk: () => void;
}) {
  const [sok, setSok] = useState("");
  const [treff, setTreff] = useState<GrepFag[]>([]);
  const [leter, setLeter] = useState(false);
  const [tomt, setTomt] = useState(false);

  useEffect(() => {
    let avbrutt = false;
    if (sok.trim().length < 2) {
      setTreff([]);
      setTomt(false);
      return;
    }
    setLeter(true);
    // Liten pause, så fila ikke leses på nytt for hver bokstav.
    const t = setTimeout(async () => {
      const r = await sokFag(sok);
      if (avbrutt) return;
      setTreff(r);
      setTomt(r.length === 0);
      setLeter(false);
    }, 180);
    return () => {
      avbrutt = true;
      clearTimeout(t);
    };
  }, [sok]);

  return (
    <div className="mb-4 rounded-vanlig border border-linje bg-ark p-3">
      <div className="flex items-end gap-2">
        <Felt
          etikett="Søk i Udirs fagliste"
          verdi={sok}
          settVerdi={setSok}
          plassholder="markedsføring, SAM3045, kroppsøving …"
          autoFocus
        />
        <Knapp variant="stille" onClick={onLukk}>
          Lukk
        </Knapp>
      </div>

      {leter && <p className="mt-2 text-liten text-blekk-svak">Søker …</p>}

      {tomt && !leter && (
        <p className="mt-2 text-brod text-blekk-dempet">
          Ingen treff. Fag uten treff i Udirs liste kan opprettes for hånd:
          skriv kode og navn i feltene under.
        </p>
      )}

      {treff.length > 0 && (
        <ul className="mt-2 max-h-72 overflow-y-auto divide-y divide-linje-svak">
          {treff.map((f) => (
            <li key={f.opplaeringsfag}>
              <button
                onClick={() => onVelg(f)}
                className="flex w-full items-baseline gap-2 py-1.5 text-left text-brod hover:bg-flate"
              >
                <span className="w-24 shrink-0 font-mono text-liten tabular-nums text-blekk-dempet">
                  {f.fagkode ?? f.opplaeringsfag}
                </span>
                <Kappet verdi={f.navn} klasse="flex-1" />
                <span className="shrink-0 text-liten tabular-nums text-blekk-svak">
                  {f.kompetansemaal.length} mål
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
