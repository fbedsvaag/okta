import { useState } from "react";
import { type Klasse } from "../../data/elever";

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
    <select
      value={valgtId}
      onChange={(e) => {
        if (e.target.value === "__ny") return setSkriver(true);
        onVelg(e.target.value === "" ? null : e.target.value);
      }}
      title="Klasse dette skoleåret"
      className="rounded-vanlig border border-transparent bg-transparent px-1 py-0.5 text-brod text-blekk-dempet hover:border-linje focus:border-aksent focus:outline-none"
    >
      <option value="">Ingen klasse</option>
      {klasser.map((k) => (
        <option key={k.id} value={k.id}>
          {k.navn}
        </option>
      ))}
      <option value="__ny">Ny klasse …</option>
    </select>
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
