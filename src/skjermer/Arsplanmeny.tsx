import { useEffect, useRef, useState } from "react";
import {
  ARKFELT,
  FELTNOKKEL,
  filnavn,
  lesFelt,
  standardFelt,
  type Ark,
  type Arkfelt,
} from "../data/arsplanark";
import { hentInnstilling, settInnstilling } from "../data/skolear";
import { somCsv, somMarkdownFlere } from "../data/arsplaneksport";
import { Knapp, Kontekstmeny, Menyvalg } from "../ui/felles";
import { filnavnAv, lagreFil } from "../data/filer";

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
  /** bygger arkene for det som er valgt i filteret, med de valgte feltene */
  hentArk: (felt: ReadonlySet<Arkfelt>) => Promise<Ark[]>;
  onSkrivUt: (ark: Ark[]) => Promise<void>;
}) {
  const knapp = useRef<HTMLDivElement>(null);
  const [meny, setMeny] = useState<{ x: number; y: number } | null>(null);
  const [melding, setMelding] = useState<string | null>(null);
  const [velgerFelt, setVelgerFelt] = useState(false);
  // Hvilke felt som skal med. Huskes i innstillingene, så valget står til
  // neste gang — også etter omstart.
  const [felt, setFelt] = useState<Set<Arkfelt>>(standardFelt);

  useEffect(() => {
    void hentInnstilling(FELTNOKKEL).then((v) => setFelt(lesFelt(v)));
  }, []);

  function byttFelt(id: Arkfelt, pa: boolean) {
    const ny = new Set(felt);
    if (pa) ny.add(id);
    else ny.delete(id);
    setFelt(ny);
    void settInnstilling(FELTNOKKEL, JSON.stringify([...ny]));
  }

  function apne() {
    const r = knapp.current?.getBoundingClientRect();
    if (r) setMeny({ x: r.left, y: r.bottom + 4 });
  }

  /** Kjører handlingen og sier fra etterpå — også når den feiler. */
  async function gjor(handling: (ark: Ark[]) => Promise<string | null>) {
    setMeny(null);
    try {
      const ark = await hentArk(felt);
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
    const sti = await lagreFil({
      filnavn: filnavn(ark, endelse),
      filternavn: navn,
      endelse,
      innhold,
    });
    if (!sti) return null; // avbrutt i dialogen
    return `Lagret ${filnavnAv(sti)}`;
  }

  const tekst = (s: string) => new TextEncoder().encode(s);

  return (
    <div ref={knapp} className="relative flex items-center gap-2">
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
          <div className="my-1 border-t border-linje-medium" />
          <Menyvalg onKlikk={() => setVelgerFelt(true)}>Velg felt …</Menyvalg>
        </Kontekstmeny>
      )}

      {velgerFelt && (
        <Feltvelger
          felt={felt}
          onBytt={byttFelt}
          onLukk={() => setVelgerFelt(false)}
        />
      )}
    </div>
  );
}

/**
 * Hvilke felt som skal med på årsplanen. Gjelder alle formatene — papir,
 * Word, markdown og CSV — så de sier det samme.
 *
 * Lukkes med Ferdig, Escape eller et trykk utenfor.
 */
function Feltvelger({
  felt,
  onBytt,
  onLukk,
}: {
  felt: ReadonlySet<Arkfelt>;
  onBytt: (id: Arkfelt, pa: boolean) => void;
  onLukk: () => void;
}) {
  const boks = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const utenfor = (e: MouseEvent) => {
      if (!boks.current?.contains(e.target as Node)) onLukk();
    };
    const tast = (e: KeyboardEvent) => e.key === "Escape" && onLukk();
    window.addEventListener("mousedown", utenfor);
    window.addEventListener("keydown", tast);
    return () => {
      window.removeEventListener("mousedown", utenfor);
      window.removeEventListener("keydown", tast);
    };
  }, [onLukk]);

  const gruppe = (g: "hode" | "kolonne" | "papir", tittel: string) => (
    <div>
      <p className="mb-1 text-etikett uppercase tracking-etikett text-blekk-dempet">
        {tittel}
      </p>
      {ARKFELT.filter((f) => f.gruppe === g).map((f) => (
        <label
          key={f.id}
          className="flex items-center gap-2 py-0.5 text-brod hover:bg-flate"
        >
          <input
            type="checkbox"
            checked={felt.has(f.id)}
            onChange={(e) => onBytt(f.id, e.target.checked)}
          />
          {f.navn}
        </label>
      ))}
    </div>
  );

  return (
    <div
      ref={boks}
      className="absolute right-0 top-full z-30 mt-1 w-64 rounded-vanlig border border-linje bg-ark p-3 shadow-[var(--shadow-ark)]"
    >
      <div className="space-y-3">
        {gruppe("hode", "Øverst på arket")}
        {gruppe("kolonne", "Kolonner")}
        {gruppe("papir", "Papir og Word")}
      </div>
      <p className="mt-2 text-liten text-blekk-svak">
        Kolonner uten innhold tas ikke med. Plan og øktlogg er dine egne notater
        og står aldri på arket.
      </p>
      <div className="mt-2 border-t border-linje-medium pt-2 text-right">
        <Knapp variant="stille" onClick={onLukk}>
          Ferdig
        </Knapp>
      </div>
    </div>
  );
}
