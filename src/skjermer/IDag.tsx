import { useEffect, useState } from "react";
import type { Skolear } from "../data/skolear";
import type { FagIAr } from "../data/fag";
import { hentOkter, type Okt } from "../data/okter";
import { Knapp, Tomtilstand } from "../ui/felles";

/**
 * I dag — startskjermen, SPEC §4.1.
 *
 * Dagens økter først, så resten av uka. Ikke et dashboard: ingen kort med
 * store tall, ingen grafer (§13). Statistikk over skoleåret hører til §10.
 */
export function IDag({
  skolear,
  fag,
  onGaTil,
  onApneOkt,
}: {
  skolear: Skolear;
  fag: FagIAr[];
  onGaTil: (visning: "fag" | "elever" | "okter") => void;
  onApneOkt: (id: string) => void;
}) {
  const [okter, setOkter] = useState<Okt[]>([]);

  useEffect(() => {
    void hentOkter(skolear.id).then(setOkter);
  }, [skolear.id]);

  const idag = isoDato(new Date());
  const { fredag } = ukesspenn(new Date());

  const dagens = okter.filter((o) => o.dato === idag);
  // Resten av uka er dagene etter i dag, ikke hele uka. En økt på mandag er
  // avholdt når det er fredag, og hører ikke hjemme under den overskriften.
  const uka = okter.filter((o) => o.dato > idag && o.dato <= fredag);
  const kommende = okter.filter((o) => o.dato > idag).slice(0, 3);

  return (
    <div className="max-w-2xl">
      <h1 className="text-[17px] font-semibold first-letter:uppercase">
        {langDato(idag)}
      </h1>
      <p className="mt-1 text-[13px] text-neutral-500">
        Skoleåret {skolear.navn}
      </p>

      <Bolk tittel="I dag">
        {dagens.length > 0 ? (
          dagens.map((o) => <OktLinje key={o.id} okt={o} onApne={onApneOkt} />)
        ) : okter.length === 0 ? (
          <Tomtilstand
            tekst={
              fag.length === 0
                ? "Ingen fag i skoleåret ennå."
                : "Ingen økter er lagt inn ennå."
            }
            handling={
              <Knapp
                variant="primar"
                onClick={() => onGaTil(fag.length === 0 ? "fag" : "okter")}
              >
                {fag.length === 0 ? "Legg inn fagene dine" : "Legg inn økter"}
              </Knapp>
            }
          />
        ) : (
          <p className="py-2 text-[13px] text-neutral-500">
            Ingen økter i dag.
          </p>
        )}
      </Bolk>

      {uka.length > 0 && (
        <Bolk tittel="Resten av uka">
          {grupperPaDag(uka).map(([dato, gruppe]) => (
            <div key={dato}>
              <p className="mt-2 text-[12px] text-neutral-500 first-letter:uppercase">
                {langDato(dato)}
              </p>
              {gruppe.map((o) => (
                <OktLinje key={o.id} okt={o} onApne={onApneOkt} />
              ))}
            </div>
          ))}
        </Bolk>
      )}

      {dagens.length === 0 && uka.length === 0 && kommende.length > 0 && (
        <Bolk tittel="Neste økter">
          {kommende.map((o) => (
            <div key={o.id}>
              <p className="mt-2 text-[12px] text-neutral-500 first-letter:uppercase">
                {langDato(o.dato)}
              </p>
              <OktLinje okt={o} onApne={onApneOkt} />
            </div>
          ))}
        </Bolk>
      )}
    </div>
  );
}

function Bolk({ tittel, children }: { tittel: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-1 border-b border-neutral-200 pb-1 text-[11px] uppercase tracking-wide text-neutral-500">
        {tittel}
      </h2>
      {children}
    </section>
  );
}

function OktLinje({ okt, onApne }: { okt: Okt; onApne: (id: string) => void }) {
  return (
    <button
      onClick={() => onApne(okt.id)}
      className="flex w-full items-center gap-3 border-b border-neutral-100 py-1.5 text-left text-[13px] hover:bg-neutral-50"
    >
      <span
        aria-hidden
        className="h-3.5 w-[3px] shrink-0 rounded-full"
        style={{ background: okt.farge ?? "var(--color-na-fagstrek)" }}
      />
      <span className="w-12 shrink-0 font-medium">{okt.fagKode}</span>
      <span className="w-12 shrink-0 tabular-nums text-neutral-500">
        {okt.klokkeslett ?? "–"}
      </span>
      <span className="flex-1 truncate">
        {okt.tema ?? <span className="text-neutral-400">—</span>}
      </span>
      <span className="shrink-0 tabular-nums text-neutral-500">
        {okt.skaret === 0
          ? ""
          : okt.skaret >= okt.elever
            ? "✓"
            : `${okt.skaret}/${okt.elever}`}
      </span>
    </button>
  );
}

function grupperPaDag(okter: Okt[]): [string, Okt[]][] {
  const kart = new Map<string, Okt[]>();
  for (const o of okter) kart.set(o.dato, [...(kart.get(o.dato) ?? []), o]);
  return [...kart.entries()].sort(([a], [b]) => a.localeCompare(b));
}

/** Fredag i uka som inneholder datoen. Helg vises ikke. */
function ukesspenn(d: Date): { fredag: string } {
  const dag = (d.getDay() + 6) % 7; // mandag = 0
  const mandag = new Date(d);
  mandag.setDate(d.getDate() - dag);
  const fredag = new Date(mandag);
  fredag.setDate(mandag.getDate() + 4);
  return { fredag: isoDato(fredag) };
}

function isoDato(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function langDato(dato: string): string {
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
