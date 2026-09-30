import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Skolear } from "../data/skolear";
import type { FagIAr } from "../data/fag";
import { hentOkter, type Okt } from "../data/okter";
import { Ikon, Kappet, Knapp, Tomtilstand } from "../ui/felles";
import { Arsoversikt } from "./Arsoversikt";
import { dagenssetning, hentSamtalerPaDato } from "../data/samtale";
import { Ukelinje } from "./Ukelinje";
import { lytt } from "../data/endringer";

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
    /** tingen skjermen skal åpne — f.eks. eleven du klikket på */
    id?: string,
  ) => void;
  /** åpner økta som et ark over forsiden */
  onApneOkt: (id: string) => void;
}) {
  const [okter, setOkter] = useState<Okt[]>([]);
  const [samtaler, setSamtaler] = useState<
    Awaited<ReturnType<typeof hentSamtalerPaDato>>
  >([]);

  const lastOkter = () => void hentOkter(skolear.id).then(setOkter);
  useEffect(lastOkter, [skolear.id]);
  // Endres en økt i et ark over forsiden, skal uka vise det med en gang.
  useEffect(() => lytt(lastOkter), [skolear.id]);

  // En økt åpnes som et ark over forsiden (Arkstabel) — du blir her.
  const apne = onApneOkt;

  useEffect(() => {
    void hentSamtalerPaDato(skolear.id, isoDato(new Date())).then(setSamtaler);
  }, [skolear.id]);

  const idag = isoDato(new Date());

  const dagens = okter.filter((o) => o.dato === idag);

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
              Åpne timeplanen <Ikon navn="pil" />
            </button>
          </Bolk>
        )}

        <Bolk tittel="I dag">
          {dagens.length > 0 ? (
            dagens.map((o) => (
              <div key={o.id}>
                <OktLinje okt={o} onApne={apne} />
                <Forrigelogg okt={o} alle={okter} onApne={apne} />
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

        <Bolk tittel="Uka">
          <Ukelinje
            okter={okter}
            forste={skolear.start}
            siste={skolear.slutt}
            idag={idag}
            onApneOkt={apne}
          />
        </Bolk>

        <Arsoversikt
          skolearId={skolear.id}
          skolestart={skolear.start}
          onApneElev={(elevId) => onGaTil("elever", elevId)}
          onApneVurderinger={() => onGaTil("vurderinger")}
        />
      </div>
    </div>
  );
}

function Bolk({
  tittel,
  children,
}: {
  tittel: string;
  children: React.ReactNode;
}) {
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
      <Kappet verdi={okt.fagKode} klasse="w-20 shrink-0 font-medium" />
      <span className="w-12 shrink-0 tabular-nums text-blekk-dempet">
        {okt.klokkeslett ?? "–"}
      </span>
      <Kappet verdi={okt.tema} klasse="flex-1" />
      <span className="shrink-0 tabular-nums text-blekk-dempet">
        {okt.skaret === 0 ? (
          ""
        ) : okt.skaret >= okt.elever ? (
          <Ikon navn="hake" />
        ) : (
          `${okt.skaret}/${okt.elever}`
        )}
      </span>
    </button>
  );
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
