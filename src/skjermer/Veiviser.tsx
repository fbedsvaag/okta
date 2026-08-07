import { useState } from "react";
import {
  foreslattSkolearnavn,
  foreslatteDatoer,
  opprettSkolear,
} from "../data/skolear";
import { hentFagIAr, leggFagIAr, type FagIAr } from "../data/fag";
import { FAGFARGER } from "../ui/farger";
import { Felt, Knapp, Fagstrek } from "../ui/felles";
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
      <ol className="mb-8 flex gap-6 text-[12px]">
        {["Skoleår", "Fag", "Elever"].map((navn, i) => (
          <li
            key={navn}
            className={
              i + 1 === steg
                ? "font-semibold text-neutral-900"
                : i + 1 < steg
                  ? "text-neutral-400"
                  : "text-neutral-300"
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

  const gyldig = navn.trim() !== "" && start !== "" && slutt !== "" && start < slutt;

  return (
    <section>
      <h1 className="text-[17px] font-semibold">Opprett skoleåret</h1>
      <p className="mt-1 text-[13px] text-neutral-500">
        Alt annet i appen henger under et skoleår. Datoene kan endres senere.
      </p>

      <div className="mt-6 space-y-4">
        <Felt etikett="Navn" verdi={navn} settVerdi={setNavn} autoFocus />
        <div className="flex gap-3">
          <Felt etikett="Første skoledag" verdi={start} settVerdi={setStart} type="date" />
          <Felt etikett="Siste skoledag" verdi={slutt} settVerdi={setSlutt} type="date" />
        </div>
      </div>

      <div className="mt-6">
        <Knapp
          variant="primar"
          disabled={!gyldig}
          onClick={async () => onFerdig(await opprettSkolear(navn.trim(), start, slutt))}
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
      <h1 className="text-[17px] font-semibold">Hvilke fag har du i år?</h1>
      <p className="mt-1 text-[13px] text-neutral-500">
        Kode og navn skriver du selv — <code>MFL1</code>, <code>ENG1</code>,{" "}
        <code>Norsk</code>, hva du nå enn underviser i.
      </p>

      {fag.length > 0 && (
        <ul className="mt-5 divide-y divide-neutral-100 border-y border-neutral-200">
          {fag.map((f) => (
            <li key={f.id} className="flex items-center gap-2 py-1.5 text-[13px]">
              <Fagstrek farge={f.farge} />
              <span className="w-20 font-medium">{f.kode}</span>
              <span className="text-neutral-500">{f.navn}</span>
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
      <h1 className="text-[17px] font-semibold">Legg inn klasselistene</h1>
      <p className="mt-1 text-[13px] text-neutral-500">
        Ett fag om gangen. Kjenner appen igjen et navn fra et fag du allerede
        har fylt, spør den om det er samme elev. Svarer du ja, blir eleven
        lagt til i dette faget også — koblet til den som finnes, i stedet for
        opprettet på nytt. Eleven havner i faget uansett.
      </p>

      {meldinger.length > 0 && (
        <ul className="mt-5 space-y-1 border-y border-neutral-200 py-2 text-[13px] text-neutral-600">
          {meldinger.map((m, i) => (
            <li key={i}>✓ {m}</li>
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

      <p className="mt-8 border-t border-neutral-200 pt-4 text-[12px] text-neutral-500">
        Til orientering: notatfeltene i appen er lærerens arbeidsmateriale.
        Opplysninger om helse, hjemmeforhold og andre særlige kategorier hører
        ikke hjemme der.
      </p>
    </section>
  );
}
