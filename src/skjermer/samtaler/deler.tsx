import type {} from "../../data/skolear";
import type {} from "../../data/fag";
import { type Samtaledag } from "../../data/samtale";
import { TEMATEKST, temafarge } from "../../ui/farger";

export type Modus = "fag" | "mentor";

/** Datatypen når et navn dras ut av en gruppe (ikke hele raden). */
export const ELEVDRAG = "application/x-okta-elev";
export type Visning = "timeplan" | "fordeling" | "alfabetisk";

/** En dag slik den vises i timeplanen. */
export type Dagplan = {
  dag: Samtaledag;
  /** Utledes av hullet mellom to samtaler — lagres ikke som egen rad. */
  lunsj: { fra: string; til: string } | null;
  rader: {
    /** raden i basen, når trekningen er lagret */
    samtaleId: string | null;
    /** eleven — eller gruppa, som én enhet (se `enhetId`) */
    elevId: string;
    /** navnene, kommaseparert når det er en gruppe */
    navn: string;
    /** elevene på plassen: én, eller flere i en gruppesamtale */
    medlemmer: { id: string; navn: string }[];
    tema: string | null;
    fra: string;
    til: string;
    motte: boolean;
  }[];
};

/** Standardverdier for en ny dag (§4.10). */
export const NY_DAG = {
  fra: "08:30",
  til: "15:00",
  lunsjFra: "11:45",
  lunsjMin: 30,
};

/** Oppgavenummeret som liten rute i temafargen (DESIGN.md §10). */
export function Temarute({ nr }: { nr: number }) {
  return (
    <span
      className="grid h-6 w-6 shrink-0 place-items-center rounded-[5px] text-liten font-medium tabular-nums"
      style={{ background: temafarge(nr), color: TEMATEKST }}
    >
      {nr}
    </span>
  );
}
export function langDato(dato: string): string {
  if (!dato) return "Dato ikke satt";
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
export function kortDato(dato: string): string {
  if (!dato) return "–";
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
  });
}
