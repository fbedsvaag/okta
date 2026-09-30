import { useEffect, useState } from "react";
import type { Skolear } from "../data/skolear";
import type { FagIAr } from "../data/fag";
import { hentOkter, type Okt } from "../data/okter";
import { Ikon, Knapp, Tomtilstand } from "../ui/felles";
import { useArk } from "../ui/Arkstabel";
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
        <h1 className="font-display text-overskrift first-letter:uppercase">
          {langDato(idag)}
        </h1>
        <p className="mt-1 text-brod text-blekk-dempet">
          Skoleåret {skolear.navn}
        </p>
      </div>

      {/* Rullefeltet er skjult — man ruller med styreflata. */}
      <div className="scrollbar-skjult min-h-0 flex-1 overflow-auto">
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
          onApneElev={(elevId) => ark.apneElev(elevId)}
          onApneVurdering={(id) => ark.apneVurdering(id)}
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
