import { useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { filnavn, type Ark } from "../data/arsplanark";
import { somCsv, somMarkdownFlere } from "../data/arsplaneksport";
import { Knapp, Kontekstmeny, Menyvalg } from "../ui/felles";

/**
 * Årsplanen ut av appen: papir, utklippstavle eller fil.
 *
 * Én knapp i stedet for fem, fordi det er én handling — «gi meg årsplanen» —
 * med fem mottakere. Gjelder det faget som står i filteret, eller alle fag
 * når filteret står på «Alle fag».
 */
export function Arsplanmeny({
  hentArk,
  onSkrivUt,
}: {
  /** bygger arkene for det som er valgt i filteret akkurat nå */
  hentArk: () => Promise<Ark[]>;
  onSkrivUt: (ark: Ark[]) => Promise<void>;
}) {
  const knapp = useRef<HTMLDivElement>(null);
  const [meny, setMeny] = useState<{ x: number; y: number } | null>(null);
  const [melding, setMelding] = useState<string | null>(null);

  function apne() {
    const r = knapp.current?.getBoundingClientRect();
    if (r) setMeny({ x: r.left, y: r.bottom + 4 });
  }

  /** Kjører handlingen og sier fra etterpå — også når den feiler. */
  async function gjor(handling: (ark: Ark[]) => Promise<string | null>) {
    setMeny(null);
    try {
      const ark = await hentArk();
      if (ark.length === 0) {
        setMelding("Ingen økter å ta med");
        return;
      }
      setMelding(await handling(ark));
    } catch (e) {
      setMelding(`Det gikk ikke: ${String(e)}`);
    }
  }

  async function lagre(
    ark: Ark[],
    endelse: string,
    navn: string,
    innhold: Uint8Array,
  ): Promise<string | null> {
    const sti = await save({
      defaultPath: filnavn(ark, endelse),
      filters: [{ name: navn, extensions: [endelse] }],
    });
    if (!sti) return null; // avbrutt i dialogen
    await invoke("skriv_fil", { sti, innhold: Array.from(innhold) });
    return `Lagret ${sti.split("/").pop()}`;
  }

  const tekst = (s: string) => new TextEncoder().encode(s);

  return (
    <div ref={knapp} className="flex items-center gap-2">
      {melding && (
        <span className="text-liten text-blekk-dempet" role="status">
          {melding}
        </span>
      )}
      <Knapp onClick={apne}>Årsplan …</Knapp>

      {meny && (
        <Kontekstmeny x={meny.x} y={meny.y} onLukk={() => setMeny(null)}>
          <Menyvalg
            onKlikk={() =>
              void gjor(async (ark) => {
                await onSkrivUt(ark);
                return null;
              })
            }
          >
            Skriv ut / lagre som PDF
          </Menyvalg>
          <Menyvalg
            onKlikk={() =>
              void gjor(async (ark) => {
                await navigator.clipboard.writeText(somMarkdownFlere(ark));
                return "Kopiert som markdown";
              })
            }
          >
            Kopier som markdown
          </Menyvalg>
          <div className="my-1 border-t border-linje-medium" />
          <Menyvalg
            onKlikk={() =>
              void gjor(async (ark) => {
                // Word-biblioteket er stort, og trengs bare her.
                const [{ Packer }, { lagDocx }] = await Promise.all([
                  import("docx"),
                  import("../data/arsplandocx"),
                ]);
                const blob = await Packer.toBlob(lagDocx(ark));
                return lagre(
                  ark,
                  "docx",
                  "Word-dokument",
                  new Uint8Array(await blob.arrayBuffer()),
                );
              })
            }
          >
            Lagre som Word (.docx)
          </Menyvalg>
          <Menyvalg
            onKlikk={() =>
              void gjor((ark) =>
                lagre(ark, "md", "Markdown", tekst(somMarkdownFlere(ark))),
              )
            }
          >
            Lagre som markdown (.md)
          </Menyvalg>
          <Menyvalg
            onKlikk={() =>
              void gjor((ark) =>
                lagre(ark, "csv", "Regneark (CSV)", tekst(somCsv(ark))),
              )
            }
          >
            Lagre som regneark (.csv)
          </Menyvalg>
        </Kontekstmeny>
      )}
    </div>
  );
}
