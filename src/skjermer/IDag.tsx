import { useEffect, useState } from "react";
import type { Skolear } from "../data/skolear";
import type { FagIAr } from "../data/fag";
import { hentOkter, type Okt } from "../data/okter";
import { Knapp, Tomtilstand } from "../ui/felles";
import { Arsoversikt } from "./Arsoversikt";
import { Ukelinje } from "./Ukelinje";

/**
 * I dag — startskjermen, SPEC §4.1, med årsoversikten under.
 *
 * MERK: §13 sier «ingen grafer på forsiden», og §10 legger et rikere dashbord
 * til senere. Årsoversikten er lagt inn etter uttrykkelig beslutning fra
 * eieren, som overstyrer begge. SPEC.md er ikke skrevet om — koden avviker
 * altså bevisst fra spec-en på dette punktet.
 */
export function IDag({
  skolear,
  fag,
  onGaTil,
  onApneOkt,
}: {
  skolear: Skolear;
  fag: FagIAr[];
  onGaTil: (visning: "fag" | "elever" | "okter" | "vurderinger") => void;
  onApneOkt: (id: string) => void;
}) {
  const [okter, setOkter] = useState<Okt[]>([]);

  useEffect(() => {
    void hentOkter(skolear.id).then(setOkter);
  }, [skolear.id]);

  const idag = isoDato(new Date());
  const { mandag, fredag } = ukesspenn(new Date());

  const dagens = okter.filter((o) => o.dato === idag);
  // Hele uka, ikke bare det som gjenstår. Tidslinja skal vise formen på uka,
  // og en mandag som forsvinner på onsdag ser ut som en feil.
  const uka = okter.filter((o) => o.dato >= mandag && o.dato <= fredag);
  const kommende = okter.filter((o) => o.dato > idag).slice(0, 3);

  return (
    <div className="flex h-full max-w-6xl flex-col">
      {/* Datoen blir stående mens resten ruller. */}
      <div className="shrink-0 pb-2">
        <h1 className="text-overskrift font-semibold first-letter:uppercase">
          {langDato(idag)}
        </h1>
        <p className="mt-1 text-brod text-blekk-dempet">
          Skoleåret {skolear.navn}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">

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
          <p className="py-2 text-brod text-blekk-dempet">
            Ingen økter i dag.
          </p>
        )}
      </Bolk>

      <Bolk tittel="Denne uka">
        <Ukelinje
          mandag={mandag}
          okter={uka}
          idag={idag}
          onApneOkt={onApneOkt}
        />
      </Bolk>

      {uka.length === 0 && kommende.length > 0 && (
        <Bolk tittel="Neste økter">
          {kommende.map((o) => (
            <div key={o.id}>
              <p className="mt-2 text-liten text-blekk-dempet first-letter:uppercase">
                {langDato(o.dato)}
              </p>
              <OktLinje okt={o} onApne={onApneOkt} />
            </div>
          ))}
        </Bolk>
      )}

      <Arsoversikt
        skolearId={skolear.id}
        onApneElev={() => onGaTil("elever")}
        onApneVurderinger={() => onGaTil("vurderinger")}
      />
      </div>
    </div>
  );
}

function Bolk({ tittel, children }: { tittel: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-1 border-b border-linje-medium pb-1 text-etikett uppercase tracking-etikett text-blekk-dempet">
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
      className="flex w-full items-center gap-3 border-b border-linje-svak py-1.5 text-left text-brod hover:bg-flate"
    >
      <span
        aria-hidden
        className="h-3.5 w-[3px] shrink-0 rounded-full"
        style={{ background: okt.farge ?? "var(--color-linje-sterk)" }}
      />
      <span className="w-12 shrink-0 font-medium">{okt.fagKode}</span>
      <span className="w-12 shrink-0 tabular-nums text-blekk-dempet">
        {okt.klokkeslett ?? "–"}
      </span>
      <span className="flex-1 truncate">
        {okt.tema ?? <span className="text-blekk-svak">—</span>}
      </span>
      <span className="shrink-0 tabular-nums text-blekk-dempet">
        {okt.skaret === 0
          ? ""
          : okt.skaret >= okt.elever
            ? "✓"
            : `${okt.skaret}/${okt.elever}`}
      </span>
    </button>
  );
}

/** Fredag i uka som inneholder datoen. Helg vises ikke. */
function ukesspenn(d: Date): { mandag: string; fredag: string } {
  const dag = (d.getDay() + 6) % 7; // mandag = 0
  const man = new Date(d);
  man.setDate(d.getDate() - dag);
  const fre = new Date(man);
  fre.setDate(man.getDate() + 4);
  return { mandag: isoDato(man), fredag: isoDato(fre) };
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
