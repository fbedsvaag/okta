import { useState } from "react";

/**
 * Et navn som kan skrives om der det står (perioder i Året, Økter og på
 * tavla, 21.10): klikk navnet, skriv, ↵ eller klikk utenfor lagrer, Esc
 * avbryter. Tomt navn lagres ikke.
 */
export function Redigerbartnavn({
  verdi,
  onLagre,
  klasse = "",
  tittel = "Klikk for å gi nytt navn",
}: {
  verdi: string;
  onLagre: (navn: string) => void | Promise<void>;
  klasse?: string;
  tittel?: string;
}) {
  const [skriver, setSkriver] = useState(false);
  if (skriver)
    return (
      <input
        autoFocus
        defaultValue={verdi}
        aria-label="Navn"
        onFocus={(e) => e.currentTarget.select()}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.currentTarget.value = verdi;
            e.currentTarget.blur();
          }
        }}
        onBlur={(e) => {
          setSkriver(false);
          const n = e.currentTarget.value.trim();
          if (n && n !== verdi) void onLagre(n);
        }}
        className={`min-w-0 rounded bg-ark px-1 outline-none ring-1 ring-aksent ${klasse}`}
      />
    );
  return (
    <span
      role="button"
      tabIndex={0}
      title={tittel}
      onClick={(e) => {
        e.stopPropagation();
        setSkriver(true);
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          setSkriver(true);
        }
      }}
      className={`cursor-text rounded hover:bg-flate ${klasse}`}
    >
      {verdi}
    </span>
  );
}
