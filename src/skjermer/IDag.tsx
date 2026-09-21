import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Skolear } from "../data/skolear";
import type { FagIAr } from "../data/fag";
import { hentOkter, type Okt } from "../data/okter";
import { Knapp, Tomtilstand } from "../ui/felles";
import { Arsoversikt } from "./Arsoversikt";
import { dagenssetning, hentSamtalerPaDato } from "../data/samtale";
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
  onGaTil: (
    visning: "fag" | "elever" | "okter" | "vurderinger" | "samtaler",
  ) => void;
  onApneOkt: (id: string) => void;
}) {
  const [okter, setOkter] = useState<Okt[]>([]);
  const [samtaler, setSamtaler] = useState<
    Awaited<ReturnType<typeof hentSamtalerPaDato>>
  >([]);

  useEffect(() => {
    void hentOkter(skolear.id).then(setOkter);
  }, [skolear.id]);

  useEffect(() => {
    void hentSamtalerPaDato(skolear.id, isoDato(new Date())).then(setSamtaler);
  }, [skolear.id]);

  const idag = isoDato(new Date());
  const { mandag, fredag } = ukesspenn(new Date());

  const dagens = okter.filter((o) => o.dato === idag);
  // Hele uka, ikke bare det som gjenstår. Tidslinja skal vise formen på uka,
  // og en mandag som forsvinner på onsdag ser ut som en feil.
  const uka = okter.filter((o) => o.dato >= mandag && o.dato <= fredag);
  const kommende = okter
    .filter((o) => o.dato > idag)
    .slice(0, KOMMENDE_ANTALL);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-clip">
      {/* Datoen blir stående mens resten ruller. */}
      <div className="shrink-0 pb-2">
        <h1 className="font-display text-overskrift first-letter:uppercase">
          {langDato(idag)}
        </h1>
        <p className="mt-1 text-brod text-blekk-dempet">
          Skoleåret {skolear.navn}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">

      {/*
        Samtaledagen står først: er det samtaler i dag, er det dem dagen
        handler om. Setningen sier hva som venter — hvem du begynner med, hvor
        mange som står igjen, og når du er ferdig (§4.10).
      */}
      {samtaler.length > 0 && (
        <Bolk tittel="Samtaler">
          <p className="py-1 text-brod">
            {dagenssetning(
              samtaler,
              new Date().toTimeString().slice(0, 5),
              samtaler.every((s) => s.erMentor),
            )}
          </p>
          <button
            onClick={() => onGaTil("samtaler")}
            className="text-liten text-blekk-dempet hover:text-blekk"
          >
            Åpne timeplanen →
          </button>
        </Bolk>
      )}

      <Bolk tittel="I dag">
        {dagens.length > 0 ? (
          dagens.map((o) => (
            <div key={o.id}>
              <OktLinje okt={o} onApne={onApneOkt} />
              <Forrigelogg okt={o} alle={okter} onApne={onApneOkt} />
            </div>
          ))
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

      {/*
        Bolken står alltid, også når den er tom. Før dukket den bare opp i
        uker uten økter, og et helt avsnitt som kommer og går flytter alt
        under seg. Plassen til tre økter er reservert av samme grunn: da er
        høyden den samme enten det ligger én eller tre foran deg.
      */}
      <Bolk tittel="Neste økter">
        <div style={{ minHeight: `${KOMMENDE_ANTALL * KOMMENDE_RADHOYDE}px` }}>
          {kommende.length === 0 ? (
            <p className="py-2 text-brod text-blekk-svak">
              Ingen flere økter er lagt inn i dette skoleåret.
            </p>
          ) : (
            kommende.map((o) => (
              <div key={o.id}>
                <p className="mt-2 text-liten text-blekk-dempet first-letter:uppercase">
                  {langDato(o.dato)}
                </p>
                <OktLinje okt={o} onApne={onApneOkt} />
              </div>
            ))
          )}
        </div>
      </Bolk>

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

/**
 * Øktloggen fra forrige gang du hadde faget.
 *
 * Skriver du «husk å dele ut oppgavearket» i loggen på torsdag, står det her
 * neste torsdag — den dagen du faktisk trenger det. Uten dette må man lete
 * seg bakover i øktlista for å finne igjen sin egen beskjed.
 *
 * Bare økter som er holdt teller, altså de som ligger før i tid. En logg
 * skrevet på en økt lenger fram er ikke en beskjed til i dag.
 *
 * Loggen er fritekst uten lengdegrense, så den vises kappet til to linjer.
 * Uten kappingen bestemmer teksten høyden på hele bolken, og alt under —
 * årsoversikten inkludert — flytter seg etter hvor mye du skrev sist.
 */
const LOGGLINJER = 2;

/**
 * «Neste økter» viser tre, og plassen til tre er reservert uansett hvor mange
 * som finnes. Radhøyden er datolinja pluss øktlinja — endres de to, må dette
 * tallet følge etter. Det er en reservasjon, ikke et tak: er teksten høyere
 * enn antatt, vokser boksen framfor å klippe.
 */
const KOMMENDE_ANTALL = 3;
const KOMMENDE_RADHOYDE = 55;

function Forrigelogg({
  okt,
  alle,
  onApne,
}: {
  okt: Okt;
  alle: Okt[];
  onApne: (id: string) => void;
}) {
  const [utvidet, setUtvidet] = useState(false);
  const [kanUtvides, setKanUtvides] = useState(false);
  const tekst = useRef<HTMLParagraphElement>(null);

  const forrige = alle
    .filter(
      (o) =>
        o.skolearFagId === okt.skolearFagId &&
        o.dato < okt.dato &&
        (o.logg ?? "").trim() !== "",
    )
    .sort((a, b) => b.dato.localeCompare(a.dato))[0];

  // Om teksten faktisk er lengre enn de to linjene kan bare måles, ikke
  // gjettes — en logg på to korte linjer skal ikke få en «vis mer» som
  // ikke viser noe. Målingen skjer på den kappede høyden, så den utløser
  // ingen ny layout.
  useLayoutEffect(() => {
    const el = tekst.current;
    if (!el || utvidet) return;
    setKanUtvides(el.scrollHeight > el.clientHeight + 1);
  }, [forrige?.id, forrige?.logg, utvidet]);

  if (!forrige) return null;

  return (
    <div
      className="mb-1 rounded-vanlig border-l-2 bg-flate-svak px-3 py-2 text-brod"
      style={{ borderColor: okt.farge ?? "var(--color-linje-sterk)" }}
    >
      <button
        onClick={() => onApne(forrige.id)}
        className="text-liten uppercase tracking-etikett text-blekk-svak hover:text-blekk-dempet"
      >
        Notat fra forrige økt
      </button>

      <p
        ref={tekst}
        className="whitespace-pre-wrap text-blekk-dempet"
        style={
          utvidet
            ? undefined
            : {
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: LOGGLINJER,
                overflow: "hidden",
              }
        }
      >
        {forrige.logg}
      </p>

      {(kanUtvides || utvidet) && (
        <button
          onClick={() => setUtvidet((v) => !v)}
          className="mt-0.5 text-liten text-blekk-svak hover:text-blekk"
        >
          {utvidet ? "Vis mindre" : "Vis mer"}
        </button>
      )}
    </div>
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
