import { useState } from "react";
import { type Klasse } from "../../data/elever";
import { Velger } from "../../ui/Velger";

/**
 * Klassen settes sjelden — som regel bare når noen bytter klasse midt i året.
 * Men den skal kunne endres der man ser eleven, ikke bare fra tabellen.
 */
export function Klassevelger({
  klasser,
  valgt,
  onVelg,
  onNy,
}: {
  klasser: Klasse[];
  valgt: string | null;
  onVelg: (klasseId: string | null) => void;
  onNy: (navn: string) => void;
}) {
  const [skriver, setSkriver] = useState(false);
  const valgtId = klasser.find((k) => k.navn === valgt)?.id ?? "";

  if (skriver) {
    return (
      <input
        autoFocus
        placeholder="1STC"
        onBlur={(e) => {
          const navn = e.target.value.trim();
          setSkriver(false);
          if (navn) onNy(navn);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setSkriver(false);
        }}
        className="w-24 rounded-vanlig border border-aksent px-1 py-0.5 text-brod outline-none"
      />
    );
  }

  return (
    <Velger
      verdi={valgtId}
      settVerdi={(v) => onVelg(v === "" ? null : v)}
      variant="stille"
      tittel="Klasse dette skoleåret"
      etikett="Klasse"
      valg={[
        { verdi: "", tekst: "Ingen klasse", dempet: true },
        ...klasser.map((k) => ({ verdi: k.id, tekst: k.navn })),
      ]}
      handling={{ tekst: "Ny klasse …", onKlikk: () => setSkriver(true) }}
    />
  );
}
/**
 * Navnet i overskriften, redigerbart der det står.
 *
 * `defaultValue` med `key` framfor en kontrollert verdi: feltet skal la seg
 * skrive i uten at hvert tastetrykk går gjennom databasen, og hentes friskt
 * når navnet faktisk er endret.
 *
 * Et tomt etternavn får en synlig advarsel. Det er slik halvferdige elever
 * har blitt liggende — de så ferdige ut.
 */
export function Navnefelt({
  verdi,
  plassholder,
  manglerTekst,
  onLagre,
}: {
  verdi: string;
  plassholder: string;
  /** vises når feltet er tomt — utelates der tomt er greit */
  manglerTekst?: string;
  onLagre: (v: string) => Promise<void>;
}) {
  const mangler = manglerTekst !== undefined && verdi.trim() === "";

  return (
    <span className="flex shrink-0 items-baseline gap-1.5">
      <input
        defaultValue={verdi}
        key={verdi}
        placeholder={plassholder}
        title={plassholder}
        onBlur={async (e) => {
          const ny = e.target.value.trim();
          if (ny !== verdi.trim()) await onLagre(ny);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.currentTarget.value = verdi;
            e.currentTarget.blur();
          }
        }}
        size={Math.max(plassholder.length, verdi.length + 1)}
        className={`rounded-vanlig border border-transparent px-1 py-0 text-[calc(30px*var(--tekst-skala))] font-light leading-tight tracking-overskrift outline-none hover:border-linje focus:border-aksent ${
          mangler ? "border-varsel" : ""
        }`}
      />
      {mangler && (
        <span className="whitespace-nowrap text-liten text-varsel">
          {manglerTekst}
        </span>
      )}
    </span>
  );
}
