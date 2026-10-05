import { useEffect, useState } from "react";
import {
  foreslattSkolearnavn,
  foreslatteDatoer,
  hentInnstilling,
  opprettSkolear,
  settInnstilling,
} from "../data/skolear";
import { LAERERNAVN } from "../data/arsplanark";
import { hentFagIAr, leggFagIAr, type FagIAr } from "../data/fag";
import { FAGFARGER } from "../ui/farger";
import { Felt, Knapp, Fagfirkant, Ikon } from "../ui/felles";
import { LimInn } from "./LimInn";
import { Ordmerke } from "../ui/logo";

/**
 * Førstegangsoppsett, SPEC §4.0 og DESIGN.md §10.
 *
 * Eget vindu med stegene til venstre: Velkommen · Skoleåret · Fagene dine ·
 * Elevene · Ferdig. Større tekst enn resten av appen — dette er det første
 * en kollega ser. Hvert steg lagrer med en gang, så veiviseren kan
 * avbrytes og gjenopptas; «Fortsett senere» står alltid synlig. Stegene er
 * snarveier gjennom skjermer som finnes uansett (Fag, Elever, Innstillinger).
 */
const STEG = ["Velkommen", "Skoleåret", "Fagene dine", "Elevene", "Ferdig"];

export function Veiviser({ onFerdig }: { onFerdig: () => void }) {
  const [steg, setSteg] = useState(0);
  const [skolearId, setSkolearId] = useState<string | null>(null);
  const [fag, setFag] = useState<FagIAr[]>([]);
  const [meldinger, setMeldinger] = useState<string[]>([]);

  // Uten et skoleår finnes det ingen app å fortsette i senere — alt annet
  // henger under det.
  const kanFortsetteSenere = skolearId !== null;

  return (
    <div className="veiviser-tekst flex h-full bg-bord text-blekk">
      <nav className="flex w-60 shrink-0 flex-col px-6 py-10">
        <Ordmerke storrelse={24} />
        <ol className="mt-10 space-y-1">
          {STEG.map((navn, i) => (
            <li
              key={navn}
              aria-current={i === steg ? "step" : undefined}
              className={`flex items-center gap-2.5 rounded-stor px-2 py-1.5 text-brod ${
                i === steg
                  ? "bg-ark font-medium text-blekk shadow-[var(--shadow-lav)]"
                  : i < steg
                    ? "text-blekk-dempet"
                    : "text-blekk-svak"
              }`}
            >
              <span
                className={`grid h-5 w-5 place-items-center rounded-full text-mikro tabular-nums ${
                  i < steg
                    ? "bg-aksent text-ark"
                    : i === steg
                      ? "border border-aksent text-aksent"
                      : "border border-linje-sterk"
                }`}
              >
                {i < steg ? <Ikon navn="hake" /> : i + 1}
              </span>
              {navn}
            </li>
          ))}
        </ol>
        <span className="grow" />
        <button
          onClick={onFerdig}
          disabled={!kanFortsetteSenere}
          title={
            kanFortsetteSenere
              ? "Det du har lagt inn er lagret. Resten finner du under Fag og Elever."
              : "Opprett skoleåret først — alt annet henger under det."
          }
          className="text-left text-liten text-blekk-dempet hover:text-blekk disabled:opacity-40"
        >
          Fortsett senere
        </button>
      </nav>

      <main className="my-4 mr-4 min-w-0 flex-1 overflow-auto rounded-ark bg-ark px-12 py-12 shadow-[var(--shadow-panel)]">
        <div className="max-w-2xl">
          {steg === 0 && <StegVelkommen onSelv={() => setSteg(1)} />}

          {steg === 1 && (
            <StegSkolear
              onFerdig={(id) => {
                setSkolearId(id);
                setSteg(2);
              }}
            />
          )}

          {steg === 2 && skolearId && (
            <StegFag
              skolearId={skolearId}
              fag={fag}
              setFag={setFag}
              onFerdig={() => setSteg(3)}
            />
          )}

          {steg === 3 && skolearId && (
            <StegElever
              skolearId={skolearId}
              fag={fag}
              meldinger={meldinger}
              setMeldinger={setMeldinger}
              onFerdig={() => setSteg(4)}
            />
          )}

          {steg === 4 && (
            <StegFerdig fag={fag} meldinger={meldinger} onApne={onFerdig} />
          )}
        </div>
      </main>
    </div>
  );
}

/**
 * Første steg: oppsettfil fra en kollega, eller sett opp selv. Oppsettfila
 * (ARBEIDSLISTE 5.13) er ikke bygget ennå; plassen står klar.
 */
function StegVelkommen({ onSelv }: { onSelv: () => void }) {
  return (
    <section>
      <h1 className="text-[calc(30px*var(--tekst-skala))] font-light leading-tight tracking-overskrift">
        Velkommen til Økta
      </h1>
      <p className="mt-2 text-brod text-blekk-dempet">
        Her planlegger du skoleåret, skårer elevene underveis og ser hvordan det
        går med dem over tid. Alt ligger på denne maskinen.
      </p>

      <div className="mt-8 grid gap-3">
        <div className="rounded-stor border border-linje p-4 opacity-60">
          <p className="text-brod font-medium">
            Bruk en oppsettfil fra en kollega{" "}
            <span className="font-normal text-blekk-dempet">· anbefalt</span>
          </p>
          <p className="mt-1 text-liten text-blekk-dempet">
            Skoleåret, fagene og skoleruta som kollegaen har satt opp. Kommer
            snart.
          </p>
        </div>
        <button
          onClick={onSelv}
          className="rounded-stor border border-aksent p-4 text-left hover:bg-flate"
        >
          <p className="text-brod font-medium">Sett opp selv</p>
          <p className="mt-1 text-liten text-blekk-dempet">
            Skoleåret, fagene dine og elevene — tre korte steg.
          </p>
        </button>
      </div>
    </section>
  );
}

/** Siste steg: hva som er lagt inn, og veien inn i appen. */
function StegFerdig({
  fag,
  meldinger,
  onApne,
}: {
  fag: FagIAr[];
  meldinger: string[];
  onApne: () => void;
}) {
  return (
    <section>
      <h1 className="text-[calc(30px*var(--tekst-skala))] font-light leading-tight tracking-overskrift">
        Ferdig
      </h1>
      <p className="mt-2 text-brod text-blekk-dempet">
        Alt er lagret. Økter legger du inn under Økter, én og én eller mange på
        en gang.
      </p>
      <ul className="mt-6 space-y-1.5 text-brod">
        <li className="flex items-center gap-2">
          <Ikon navn="hake" /> Skoleåret er opprettet
        </li>
        <li className="flex items-center gap-2">
          <Ikon navn="hake" />
          {fag.length === 1 ? "Ett fag" : `${fag.length} fag`}:{" "}
          {fag.map((f) => f.kode).join(", ")}
        </li>
        {meldinger.map((m, i) => (
          <li key={i} className="flex items-center gap-2">
            <Ikon navn="hake" /> {m}
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <Knapp variant="primar" onClick={onApne}>
          Åpne Økta
        </Knapp>
      </div>
    </section>
  );
}

function StegSkolear({ onFerdig }: { onFerdig: (id: string) => void }) {
  const [navn, setNavn] = useState(foreslattSkolearnavn());
  const foreslatt = foreslatteDatoer(navn);
  const [start, setStart] = useState(foreslatt.start);
  const [slutt, setSlutt] = useState(foreslatt.slutt);
  // Navnet ditt blir faglærer på årsplanen i alle fag. Står det der fra et
  // tidligere år, er det allerede fylt ut.
  const [laerer, setLaerer] = useState("");
  useEffect(() => {
    void hentInnstilling(LAERERNAVN).then((v) => v && setLaerer(v));
  }, []);

  const gyldig =
    navn.trim() !== "" && start !== "" && slutt !== "" && start < slutt;

  return (
    <section>
      <h1 className="text-[calc(30px*var(--tekst-skala))] font-light leading-tight tracking-overskrift">
        Opprett skoleåret
      </h1>
      <p className="mt-1 text-brod text-blekk-dempet">
        Alt annet i appen henger under et skoleår. Datoene kan endres senere.
      </p>

      <div className="mt-6 space-y-4">
        <Felt
          etikett="Ditt navn"
          verdi={laerer}
          settVerdi={setLaerer}
          plassholder="Står som faglærer på årsplanen"
          autoFocus
        />
        <Felt etikett="Skoleår" verdi={navn} settVerdi={setNavn} />
        <div className="flex gap-3">
          <Felt
            etikett="Første skoledag"
            verdi={start}
            settVerdi={setStart}
            type="date"
          />
          <Felt
            etikett="Siste skoledag"
            verdi={slutt}
            settVerdi={setSlutt}
            type="date"
          />
        </div>
      </div>

      <div className="mt-6">
        <Knapp
          variant="primar"
          disabled={!gyldig}
          onClick={async () => {
            if (laerer.trim()) await settInnstilling(LAERERNAVN, laerer.trim());
            onFerdig(await opprettSkolear(navn.trim(), start, slutt));
          }}
        >
          Videre
        </Knapp>
      </div>
    </section>
  );
}

function StegFag({
  skolearId,
  fag,
  setFag,
  onFerdig,
}: {
  skolearId: string;
  fag: FagIAr[];
  setFag: (f: FagIAr[]) => void;
  onFerdig: () => void;
}) {
  const [kode, setKode] = useState("");
  const [navn, setNavn] = useState("");

  async function leggTil() {
    if (kode.trim() === "") return;
    const farge = FAGFARGER[fag.length % FAGFARGER.length];
    await leggFagIAr(skolearId, kode.trim(), navn.trim() || kode.trim(), farge);
    setFag(await hentFagIAr(skolearId));
    setKode("");
    setNavn("");
  }

  return (
    <section>
      <h1 className="text-[calc(30px*var(--tekst-skala))] font-light leading-tight tracking-overskrift">
        Hvilke fag har du i år?
      </h1>
      <p className="mt-1 text-brod text-blekk-dempet">
        Kode og navn skriver du selv — <code>MFL1</code>, <code>ENG1</code>,{" "}
        <code>Norsk</code>, hva du nå enn underviser i.
      </p>

      {fag.length > 0 && (
        <ul className="mt-5 divide-y divide-linje-svak border-y border-linje-medium">
          {fag.map((f) => (
            <li key={f.id} className="flex items-center gap-2 py-1.5 text-brod">
              <Fagfirkant farge={f.farge} />
              <span className="w-20 font-medium">{f.kode}</span>
              <span className="text-blekk-dempet">{f.navn}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-end gap-3">
        <Felt
          etikett="Kode"
          verdi={kode}
          settVerdi={setKode}
          plassholder="MFL1"
          bredde="w-32"
          onEnter={leggTil}
        />
        <Felt
          etikett="Navn"
          verdi={navn}
          settVerdi={setNavn}
          plassholder="Markedsføring og ledelse 1"
          onEnter={leggTil}
        />
        <Knapp onClick={leggTil}>Legg til</Knapp>
      </div>

      <div className="mt-6">
        <Knapp variant="primar" disabled={fag.length === 0} onClick={onFerdig}>
          Videre
        </Knapp>
      </div>
    </section>
  );
}

function StegElever({
  skolearId,
  fag,
  meldinger,
  setMeldinger,
  onFerdig,
}: {
  skolearId: string;
  fag: FagIAr[];
  meldinger: string[];
  setMeldinger: (f: (tidligere: string[]) => string[]) => void;
  onFerdig: () => void;
}) {
  const [limerInn, setLimerInn] = useState(false);

  if (limerInn) {
    return (
      <LimInn
        skolearId={skolearId}
        fag={fag}
        onFerdig={(m) => {
          setMeldinger((tidligere) => [...tidligere, m]);
          setLimerInn(false);
        }}
        onAvbryt={() => setLimerInn(false)}
      />
    );
  }

  return (
    <section>
      <h1 className="text-[calc(30px*var(--tekst-skala))] font-light leading-tight tracking-overskrift">
        Legg inn klasselistene
      </h1>
      <p className="mt-1 text-brod text-blekk-dempet">
        Ett fag om gangen. Kjenner appen igjen et navn fra et fag du allerede
        har fylt, spør den om det er samme elev. Svarer du ja, blir eleven lagt
        til i dette faget også — koblet til den som finnes, i stedet for
        opprettet på nytt. Eleven havner i faget uansett.
      </p>

      {meldinger.length > 0 && (
        <ul className="mt-5 space-y-1 border-y border-linje-medium py-2 text-brod text-blekk-dempet">
          {meldinger.map((m, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <Ikon navn="hake" />
              {m}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex gap-2">
        <Knapp variant="primar" onClick={() => setLimerInn(true)}>
          Lim inn en liste
        </Knapp>
        <Knapp variant="stille" onClick={onFerdig}>
          {meldinger.length > 0 ? "Ferdig" : "Hopp over — jeg gjør det senere"}
        </Knapp>
      </div>

      <p className="mt-8 border-t border-linje-medium pt-4 text-liten text-blekk-dempet">
        Til orientering: notatfeltene i appen er lærerens arbeidsmateriale.
        Opplysninger om helse, hjemmeforhold og andre særlige kategorier hører
        ikke hjemme der.
      </p>
    </section>
  );
}
