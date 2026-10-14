import { useEffect, useMemo, useState } from "react";
import {
  lagSerie,
  ukedagsnavn,
  type Fridag,
  type Seriedag,
  type Ukedag,
} from "../data/kalender";
import { hentFridager, hentInnstilling } from "../data/skolear";
import { opprettOkt } from "../data/okter";
import type { FagIAr } from "../data/fag";
import { Felt, Knapp } from "../ui/felles";
import { Velger } from "../ui/Velger";

/**
 * Serieopprettelse av økter, SPEC §4.2.
 *
 * «MFL1 hver tirsdag i hele året» blir til datoer du kan se på før noe
 * skrives. Helger og røde dager faller bort av seg selv, ferier og
 * planleggingsdager faller bort fordi de ligger i skoleåret (§4.8).
 *
 * Ingenting fjernes i stillhet: du ser hva som ble hoppet over og hvorfor,
 * og kan hake det inn igjen.
 */
export function NySerie({
  skolearId,
  skolearStart,
  skolearSlutt,
  fag,
  startFagId,
  onLagret,
  onAvbryt,
}: {
  skolearId: string;
  skolearStart: string;
  skolearSlutt: string;
  fag: FagIAr[];
  startFagId?: string;
  onLagret: (antall: number) => void;
  onAvbryt: () => void;
}) {
  const [fagId, setFagId] = useState(startFagId ?? fag[0]?.id ?? "");
  const [ukedag, setUkedag] = useState<Ukedag>(2);
  const [klokke, setKlokke] = useState("");
  const [varighet, setVarighet] = useState("");
  const [fra, setFra] = useState(skolearStart);
  const [til, setTil] = useState(skolearSlutt);
  const [fridager, setFridager] = useState<Fridag[]>([]);
  const [global, setGlobal] = useState("180");
  const [dager, setDager] = useState<Seriedag[] | null>(null);
  const [jobber, setJobber] = useState(false);

  useEffect(() => {
    void hentFridager(skolearId).then(setFridager);
    void hentInnstilling("standard_varighet_min").then((v) =>
      setGlobal(v ?? "180"),
    );
  }, [skolearId]);

  const valgtFag = fag.find((f) => f.id === fagId);
  const arvet = String(valgtFag?.standardVarighetMin ?? global);

  const antallValgt = useMemo(
    () => dager?.filter((d) => d.valgt).length ?? 0,
    [dager],
  );

  function forhandsvis() {
    setDager(lagSerie(ukedag, fra, til, fridager));
  }

  async function lagre() {
    if (!valgtFag || !dager) return;
    setJobber(true);
    try {
      let antall = 0;
      for (const dag of dager) {
        if (!dag.valgt) continue;
        await opprettOkt(
          valgtFag.id,
          valgtFag.fagkode,
          dag.dato,
          klokke || null,
          Number(varighet || arvet),
        );
        antall++;
      }
      onLagret(antall);
    } finally {
      setJobber(false);
    }
  }

  if (dager) {
    const hoppet = dager.filter((d) => d.hoppet !== null);

    return (
      <div className="mb-4 border border-linje bg-flate p-3">
        <p className="text-brod">
          <strong>{antallValgt} økter</strong> i {valgtFag?.kode} på{" "}
          {ukedagsnavn(ukedag)}
          {hoppet.length > 0 && (
            <span className="text-blekk-dempet">
              {" "}
              · {hoppet.length} dager faller bort
            </span>
          )}
        </p>

        <div className="mt-2 max-h-64 overflow-y-auto border-y border-linje-medium bg-ark">
          {dager.map((dag, i) => (
            <label
              key={dag.dato}
              className={`flex items-center gap-3 border-b border-linje-svak px-2 py-1 text-brod ${
                dag.hoppet ? "text-blekk-svak" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={dag.valgt}
                onChange={(e) =>
                  setDager((d) =>
                    d!.map((x, j) =>
                      j === i ? { ...x, valgt: e.target.checked } : x,
                    ),
                  )
                }
              />
              <span className="w-32 tabular-nums">{langDato(dag.dato)}</span>
              {dag.forklaring && (
                <span className="text-liten">{dag.forklaring}</span>
              )}
            </label>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <Knapp
            variant="primar"
            onClick={lagre}
            disabled={jobber || antallValgt === 0}
          >
            {jobber ? "Oppretter …" : `Opprett ${antallValgt} økter`}
          </Knapp>
          <Knapp variant="stille" onClick={() => setDager(null)}>
            Tilbake
          </Knapp>
          <Knapp variant="stille" onClick={onAvbryt}>
            Avbryt
          </Knapp>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 border border-linje bg-flate p-3">
      <p className="mb-3 text-brod text-blekk-dempet">
        Legg inn en hel termin på én gang. Helger og røde dager hoppes over
        automatisk; ferier og planleggingsdager hentes fra skoleåret.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <Etikett>Fag</Etikett>
          <Velger
            verdi={fagId}
            settVerdi={setFagId}
            valg={fag.map((f) => ({
              verdi: f.id,
              tekst: f.kode,
              farge: f.farge,
              firkant: true,
            }))}
          />
        </label>

        <label className="block">
          <Etikett>Ukedag</Etikett>
          <Velger
            verdi={String(ukedag)}
            settVerdi={(v) => setUkedag(Number(v) as Ukedag)}
            valg={([1, 2, 3, 4, 5] as Ukedag[]).map((u) => ({
              verdi: String(u),
              tekst: ukedagsnavn(u),
            }))}
          />
        </label>

        <Felt
          etikett="Klokkeslett"
          verdi={klokke}
          settVerdi={setKlokke}
          plassholder="09:15"
          bredde="w-28"
        />
        <Felt
          etikett="Varighet"
          verdi={varighet}
          settVerdi={setVarighet}
          plassholder={`${arvet} (arvet)`}
          bredde="w-32"
        />
        <Felt
          etikett="Fra"
          verdi={fra}
          settVerdi={setFra}
          type="date"
          bredde="w-40"
        />
        <Felt
          etikett="Til"
          verdi={til}
          settVerdi={setTil}
          type="date"
          bredde="w-40"
        />

        <Knapp
          variant="primar"
          onClick={forhandsvis}
          disabled={!fagId || fra >= til}
        >
          Forhåndsvis
        </Knapp>
        <Knapp variant="stille" onClick={onAvbryt}>
          Avbryt
        </Knapp>
      </div>

      {fridager.length === 0 && (
        <p className="mt-2 text-liten text-blekk-dempet">
          Ingen ferier er lagt inn på skoleåret ennå. Legg dem inn under
          skoleåret, så slipper du å hake bort ferieukene her.
        </p>
      )}
    </div>
  );
}

function Etikett({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-etikett uppercase tracking-etikett text-blekk-dempet">
      {children}
    </span>
  );
}

function langDato(dato: string): string {
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}
