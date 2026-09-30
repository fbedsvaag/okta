import { regnskapstekst, type Ark } from "../data/arsplanark";
import {
  bolktekst,
  celleverdi,
  kolonnebredde,
  kolonner,
  KOLONNENAVN,
  tittel,
  undertittel,
} from "../data/arsplaneksport";

/**
 * Utskriftsvisning av årsplanen, SPEC §4.9.
 *
 * Egen visning, ikke utskrift av skjermbildet. Ett fag per side, lesbar i
 * svart-hvitt. Cmd+P gir «Lagre som PDF» i macOS-dialogen.
 *
 * Innholdet kommer ferdig bygget fra `byggArk` — det samme som markdown,
 * CSV og Word lages av. Her står bare hvordan det ser ut på papir.
 *
 * Arket flyter over så mange sider som trengs. Det er `@media print` i
 * index.css som slipper vindushøyden; uten det klipper nettleseren alt som
 * ikke fikk plass på første side.
 */
export function Arsplan({ ark }: { ark: Ark[] }) {
  return (
    <div className="kunutskrift arsplanark">
      {ark.map((a) => (
        <Side key={`${a.fagKode}-${a.skolearNavn}`} ark={a} />
      ))}
    </div>
  );
}

function Side({ ark }: { ark: Ark }) {
  const kol = kolonner(ark);
  const harMal = ark.kompetansemal.length > 0 || ark.kompetansemalFritekst;

  return (
    <section className="fagside">
      <header className="mb-3 border-b-2 border-aksent pb-1.5">
        <h1 className="font-display text-[17pt] leading-tight">
          {tittel(ark)}
        </h1>
        <p className="mt-0.5 text-[9.5pt] text-blekk-dempet">
          {undertittel(ark)}
        </p>
        {ark.regnskap && (
          <p className="text-[9.5pt] text-blekk-dempet">
            {regnskapstekst(ark.regnskap)}
          </p>
        )}
      </header>

      {ark.arknotat && (
        <p className="mb-3 whitespace-pre-line text-[10pt]">{ark.arknotat}</p>
      )}

      {harMal && (
        <div className="mb-4">
          <h2 className="mb-1 font-display text-[12pt] text-aksent">
            Kompetansemål
          </h2>
          {ark.kompetansemal.length > 0 ? (
            <ul className="list-disc space-y-0.5 pl-4 text-[9pt] leading-snug">
              {ark.kompetansemal.map((m) => (
                <li key={m.kode}>{m.tekst}</li>
              ))}
            </ul>
          ) : (
            <p className="whitespace-pre-line text-[9pt] leading-snug">
              {ark.kompetansemalFritekst}
            </p>
          )}
        </div>
      )}

      <h2 className="mb-1 font-display text-[12pt] text-aksent">Økter</h2>

      {ark.bolker.map((b, i) => (
        <div key={b.navn ?? i} className="mb-3">
          {b.navn && (
            <h3 className="mt-2 flex items-baseline gap-2 text-[10.5pt] font-semibold">
              {b.navn}
              <span className="ml-auto text-[9pt] font-normal text-blekk-dempet">
                {bolktekst(b)}
              </span>
            </h3>
          )}

          <table className="mt-0.5 w-full table-fixed border-collapse text-[9.5pt]">
            <thead>
              <tr className="border-b border-blekk text-left text-[8.5pt] text-blekk-dempet">
                {kol.map((k) => (
                  <th
                    key={k}
                    className="py-1 pr-2 font-semibold"
                    style={{ width: `${kolonnebredde(kol, k)}%` }}
                  >
                    {KOLONNENAVN[k]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rader.map((r) => (
                <tr
                  key={r.oktId}
                  className={`border-b border-linje align-top ${r.utenfor ? "text-blekk-svak" : ""}`}
                >
                  {kol.map((k) => (
                    <td key={k} className="py-[3px] pr-2 tabular-nums">
                      {k === "dato" ? (
                        <span className="whitespace-nowrap">
                          {celleverdi(r, k)}
                        </span>
                      ) : (
                        celleverdi(r, k)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <p className="mt-3 text-[8pt] text-blekk-dempet">
        Med forbehold om endringer.
      </p>
    </section>
  );
}
