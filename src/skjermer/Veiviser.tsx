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

/**
 * Førstegangsoppsett, SPEC §4.0. Tre steg, i denne rekkefølgen fordi hvert
 * steg avhenger av det forrige. Hvert steg lagrer med en gang, så veiviseren
 * kan avbrytes og gjenopptas.
 */
export function Veiviser({ onFerdig }: { onFerdig: () => void }) {
  const [steg, setSteg] = useState<1 | 2 | 3>(1);
  const [skolearId, setSkolearId] = useState<string | null>(null);
  const [fag, setFag] = useState<FagIAr[]>([]);

  return (
    <div className="mx-auto max-w-2xl px-8 py-12">
      <ol className="mb-8 flex gap-6 text-liten">
        {["Skoleår", "Fag", "Elever"].map((navn, i) => (
          <li
            key={navn}
            className={
              i + 1 === steg
                ? "font-semibold text-blekk"
                : i + 1 < steg
                  ? "text-blekk-svak"
                  : "text-blekk-svakest"
            }
          >
            {i + 1}. {navn}
          </li>
        ))}
      </ol>

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
        <StegElever skolearId={skolearId} fag={fag} onFerdig={onFerdig} />
      )}
    </div>
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
      <h1 className="text-overskrift font-light tracking-overskrift">Opprett skoleåret</h1>
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
      <h1 className="text-overskrift font-light tracking-overskrift">Hvilke fag har du i år?</h1>
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
  onFerdig,
}: {
  skolearId: string;
  fag: FagIAr[];
  onFerdig: () => void;
}) {
  const [meldinger, setMeldinger] = useState<string[]>([]);
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
      <h1 className="text-overskrift font-light tracking-overskrift">Legg inn klasselistene</h1>
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
