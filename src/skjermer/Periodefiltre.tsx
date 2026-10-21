import { useState } from "react";
import { endrePeriode, opprettPeriode, type Periode } from "../data/perioder";

/** «Uten periode» som filter. */
export const UTEN = "uten";
export type Periodefilter = string | typeof UTEN | null;

/** Antall økter og minutter per periode, og for øktene uten. */
export type Periodetall = Map<string, { antall: number; minutter: number }>;

/**
 * Fagets perioder som filtre over øktlista (DESIGN.md §10, §4.2 i
 * forslaget til ny spec). Perioden er en merkelapp på økta: klikk på en
 * periode viser bare den, klikk igjen viser alle. Hver merkelapp har
 * periodens prikk, en svak tone, og antall økter og timer.
 *
 * Perioden settes ikke her — merk øktene og trykk P (se Okter). En ny
 * periode lages rett her, og dobbeltklikk gir nytt navn.
 */
export function Periodefiltre({
  skolearFagId,
  perioder,
  tall,
  filter,
  onFilter,
  onEndret,
}: {
  skolearFagId: string;
  /** fagets perioder, i rekkefølge */
  perioder: Periode[];
  tall: Periodetall;
  filter: Periodefilter;
  onFilter: (f: Periodefilter) => void;
  /** en periode er laget eller har fått nytt navn */
  onEndret: () => void;
}) {
  const [lager, setLager] = useState(false);
  const [navn, setNavn] = useState("");
  // Perioden som får nytt navn akkurat nå.
  const [omdoper, setOmdoper] = useState<string | null>(null);

  async function giNavn(p: Periode, nytt: string) {
    setOmdoper(null);
    const n = nytt.trim();
    if (!n || n === p.navn) return;
    await endrePeriode(p.id, { navn: n });
    onEndret();
  }

  async function lag() {
    const n = navn.trim();
    if (!n) return setLager(false);
    await opprettPeriode(skolearFagId, n, null, null, perioder.length + 1);
    setNavn("");
    setLager(false);
    onEndret();
  }

  const uten = tall.get(UTEN);

  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5">
      {perioder.map((p) =>
        omdoper === p.id ? (
          <input
            key={p.id}
            autoFocus
            defaultValue={p.navn}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key === "Enter") void giNavn(p, e.currentTarget.value);
              if (e.key === "Escape") {
                // Feltet mister fokus når det lukkes, og blur lagrer.
                // Tilbake til det gamle navnet først, så Esc avbryter.
                e.currentTarget.value = p.navn;
                setOmdoper(null);
              }
            }}
            onBlur={(e) => void giNavn(p, e.currentTarget.value)}
            className="w-44 rounded-stor border border-aksent bg-ark px-2.5 py-0.5 text-liten outline-none"
          />
        ) : (
          <Merkelapp
            key={p.id}
            navn={p.navn}
            farge={p.farge}
            tall={tall.get(p.id)}
            aktiv={filter === p.id}
            tittel="Vis bare denne perioden · dobbeltklikk for nytt navn"
            onKlikk={() => onFilter(filter === p.id ? null : p.id)}
            onDobbeltklikk={() => {
              // De to klikkene har slått filteret av og på igjen.
              onFilter(null);
              setOmdoper(p.id);
            }}
          />
        ),
      )}

      {perioder.length > 0 && uten && uten.antall > 0 && (
        <Merkelapp
          navn="Uten periode"
          farge={null}
          tall={uten}
          aktiv={filter === UTEN}
          tittel="Vis bare øktene som ikke har periode"
          onKlikk={() => onFilter(filter === UTEN ? null : UTEN)}
        />
      )}

      {lager ? (
        <input
          autoFocus
          value={navn}
          onChange={(e) => setNavn(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void lag();
            if (e.key === "Escape") {
              setNavn("");
              setLager(false);
            }
          }}
          onBlur={() => void lag()}
          placeholder="Navn på perioden"
          className="w-44 rounded-stor border border-aksent bg-ark px-2.5 py-0.5 text-liten outline-none"
        />
      ) : (
        <button
          onClick={() => setLager(true)}
          className="rounded-stor px-2 py-0.5 text-liten text-blekk-dempet hover:text-blekk"
        >
          + Ny periode
        </button>
      )}
    </div>
  );
}

/**
 * Perioden som merkelapp: nøytral, med prikk i periodefargen (20.2). Brukes både som filter her og på raden i øktlista.
 */
export function Periodemerke({
  navn,
  farge,
  klasse = "",
}: {
  navn: string;
  farge: string | null;
  klasse?: string;
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-stor px-1.5 py-0.5 text-liten ${klasse}`}
      style={{ background: "var(--color-flate)" }}
      title={navn}
    >
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: farge ?? "var(--color-linje-sterk)" }}
      />
      <span className="truncate">{navn}</span>
    </span>
  );
}

function Merkelapp({
  navn,
  farge,
  tall,
  aktiv,
  tittel,
  onKlikk,
  onDobbeltklikk,
}: {
  navn: string;
  farge: string | null;
  tall?: { antall: number; minutter: number };
  aktiv: boolean;
  tittel: string;
  onKlikk: () => void;
  onDobbeltklikk?: () => void;
}) {
  return (
    <button
      onClick={onKlikk}
      onDoubleClick={onDobbeltklikk}
      title={tittel}
      aria-pressed={aktiv}
      className={`inline-flex items-center gap-1.5 rounded-stor border px-2 py-0.5 text-liten ${
        aktiv
          ? "border-aksent font-medium text-blekk"
          : "border-transparent text-blekk-dempet hover:text-blekk"
      }`}
      style={{ background: "var(--color-flate)" }}
    >
      <span
        aria-hidden
        className="h-2 w-2 rounded-full"
        style={{ background: farge ?? "var(--color-linje-sterk)" }}
      />
      {navn}
      <span className="tabular-nums text-blekk-svak">
        {tall?.antall ?? 0} · {timerKort(tall?.minutter ?? 0)}
      </span>
    </button>
  );
}

function timerKort(minutter: number): string {
  return `${(Math.round((minutter / 60) * 10) / 10).toLocaleString("nb-NO")} t`;
}
