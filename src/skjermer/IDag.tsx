import { Sammenleggknapp, useApen } from "../ui/Sammenleggbar";
import { useEffect, useState } from "react";
import type { Skolear } from "../data/skolear";
import type { FagIAr } from "../data/fag";
import { hentOkter, type Okt } from "../data/okter";
import { Ikon, Knapp, Tomtilstand } from "../ui/felles";
import { useArk } from "../ui/Arkstabel";
import { Arsoversikt } from "./Arsoversikt";
import { dagenssetning, hentSamtalerPaDato } from "../data/samtale";
import { Ukelinje } from "./Ukelinje";
import { lytt, lyttOktvisning } from "../data/endringer";
import { dagen } from "../data/dagen";

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
  useEffect(() => lyttOktvisning(lastOkter), [skolear.id]);

  // En økt, en elev eller en vurdering åpnes som et ark over forsiden
  // (Arkstabel) — du blir her.
  const apne = onApneOkt;
  const ark = useArk();

  useEffect(() => {
    void hentSamtalerPaDato(skolear.id, isoDato(new Date())).then(setSamtaler);
  }, [skolear.id]);

  const idag = isoDato(new Date());

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-clip">
      {/* Datoen blir stående mens resten ruller. */}
      <div className="shrink-0 pb-2">
        <h1 className="text-overskrift font-light tracking-overskrift first-letter:uppercase">
          {langDato(idag)}
        </h1>
        <Dagsoppsummering okter={okter} idag={idag} onApne={apne} />
      </div>

      {/* Rullefeltet er skjult — man ruller med styreflata. */}
      <div className="scrollbar-skjult min-h-0 flex-1 overflow-auto">
        {/*
        Samtaledagen står først: er det samtaler i dag, er det dem dagen
        handler om. Setningen sier hva som venter — hvem du begynner med, hvor
        mange som står igjen, og når du er ferdig (§4.10).
      */}
        {samtaler.length > 0 && (
          <Bolk tittel="Samtaler" nokkel="forside-samtaler">
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

        {/*
          Uten økter er det ingenting å vise i uka — da peker forsiden dit
          man begynner. Dagens økter står i uka, så de har ingen egen bolk.
        */}
        {okter.length === 0 && (
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
        )}

        <Bolk tittel="Uka" nokkel="forside-uka">
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
          okter={okter}
          onApneElev={(elevId) => ark.apneElev(elevId)}
          onApneVurdering={(id) => ark.apneVurdering(id)}
        />
      </div>
    </div>
  );
}

/**
 * Én setning om dagen, og for hver økt det du skrev forrige gang i faget.
 * Én linje per økt, kappet — hele notatet står i verktøytipset, og et
 * klikk åpner økta det ble skrevet i.
 */
function Dagsoppsummering({
  okter,
  idag,
  onApne,
}: {
  okter: Okt[];
  idag: string;
  onApne: (id: string) => void;
}) {
  const d = dagen(okter, idag);
  const flere = d.linjer.length > 1;

  return (
    <div className="mt-1 text-brod text-blekk-dempet">
      <p>{d.setning}</p>
      {d.linjer.map(({ okt, forrige, notat }) => (
        <p key={okt.id} className="flex min-w-0 items-baseline gap-1.5">
          {flere && (
            <span className="shrink-0 font-medium text-blekk">
              {okt.fagKode}:
            </span>
          )}
          {!forrige ? (
            <span>Første økt i faget.</span>
          ) : notat ? (
            <button
              onClick={() => onApne(forrige.id)}
              title={notat}
              className="min-w-0 truncate text-left hover:text-blekk"
            >
              Notatet du skrev forrige gang:{" "}
              <span className="text-blekk">«{notat}»</span>
            </button>
          ) : (
            <span>Du skrev ikke noe notat forrige økt.</span>
          )}
        </p>
      ))}
    </div>
  );
}

/** En bolk på forsiden. Legges sammen med et klikk på overskriften. */
function Bolk({
  tittel,
  nokkel,
  children,
}: {
  tittel: string;
  /** husker om bolken er lagt sammen (ui/Sammenleggbar) */
  nokkel: string;
  children: React.ReactNode;
}) {
  const [apen, setApen] = useApen(nokkel);
  return (
    <section className="mt-6">
      <div
        className={`border-b border-linje-medium pb-1 ${apen ? "mb-1" : ""}`}
      >
        <Sammenleggknapp
          tittel={tittel}
          apen={apen}
          onBytt={() => setApen(!apen)}
        />
      </div>
      {apen && children}
    </section>
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
