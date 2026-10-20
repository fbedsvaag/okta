import { useEffect, useMemo, useState } from "react";
import {
  lagSerie,
  mandag,
  ukenummer,
  ukedagsnavn,
  type Rytme,
  type Fridag,
  type Seriedag,
  type Ukedag,
} from "../data/kalender";
import {
  hentFridager,
  hentInnstilling,
  settInnstilling,
} from "../data/skolear";
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
 *
 * Rytmen (19.5): hver uke, annenhver, hver tredje, hver n-te, eller A-/B-uke.
 * Datoene står under skjemaet mens du velger.
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
  const [rytmevalg, setRytmevalg] = useState<RytmeValg>("1");
  const [nte, setNte] = useState("4");
  // Mandagen i en A-uke. Uten noe lagret: skoleårets første uke.
  const [aUke, setAUke] = useState(mandag(skolearStart));
  const aNokkel = `a_uke:${skolearId}`;

  useEffect(() => {
    void hentFridager(skolearId).then(setFridager);
    void hentInnstilling("standard_varighet_min").then((v) =>
      setGlobal(v ?? "180"),
    );
    void hentInnstilling(aNokkel).then((v) => v && setAUke(mandag(v)));
  }, [skolearId]);

  function byttAUke() {
    const d = new Date(`${aUke}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 7);
    const ny = d.toISOString().slice(0, 10);
    setAUke(ny);
    void settInnstilling(aNokkel, ny);
  }

  const rytme = tilRytme(rytmevalg, nte, aUke);
  const utkast = useMemo(
    () =>
      fra && til && fra < til && rytme
        ? lagSerie(ukedag, fra, til, fridager, rytme)
        : null,
    [ukedag, fra, til, fridager, rytme?.hver, rytme?.fra],
  );

  const valgtFag = fag.find((f) => f.id === fagId);
  const arvet = String(valgtFag?.standardVarighetMin ?? global);

  const antallValgt = useMemo(
    () => dager?.filter((d) => d.valgt).length ?? 0,
    [dager],
  );

  function forhandsvis() {
    if (utkast) setDager(utkast);
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
          {rytme && rytme.hver > 1 && ` ${rytmetekst(rytmevalg, nte)}`}
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

        <label className="block">
          <Etikett>Rytme</Etikett>
          <Velger
            verdi={rytmevalg}
            settVerdi={(v) => setRytmevalg(v as RytmeValg)}
            valg={RYTMER.map(([verdi, tekst]) => ({ verdi, tekst }))}
          />
        </label>
        {rytmevalg === "n" && (
          <Felt
            etikett="Hver"
            verdi={nte}
            settVerdi={(v) => setNte(v.replace(/\D/g, "").slice(0, 2))}
            plassholder="4"
            bredde="w-16"
          />
        )}

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
          disabled={!fagId || !utkast}
        >
          Forhåndsvis
        </Knapp>
        <Knapp variant="stille" onClick={onAvbryt}>
          Avbryt
        </Knapp>
      </div>

      {(rytmevalg === "A" || rytmevalg === "B") && (
        <p className="mt-2 text-liten text-blekk-dempet">
          A-uke er uke {abUker(aUke, fra)} …{" "}
          <button onClick={byttAUke} className="text-aksent hover:underline">
            Bytt A og B
          </button>
        </p>
      )}

      {utkast && <Datolinje dager={utkast} />}

      {fridager.length === 0 && (
        <p className="mt-2 text-liten text-blekk-dempet">
          Ingen ferier er lagt inn på skoleåret ennå. Legg dem inn under
          skoleåret, så slipper du å hake bort ferieukene her.
        </p>
      )}
    </div>
  );
}

type RytmeValg = "1" | "2" | "3" | "n" | "A" | "B";

const RYTMER: [RytmeValg, string][] = [
  ["1", "Hver uke"],
  ["2", "Annenhver uke"],
  ["3", "Hver tredje uke"],
  ["n", "Hver n-te uke …"],
  ["A", "A-uke"],
  ["B", "B-uke"],
];

function tilRytme(v: RytmeValg, nte: string, aUke: string): Rytme | null {
  if (v === "A") return { hver: 2, fra: aUke };
  if (v === "B") {
    const d = new Date(`${aUke}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 7);
    return { hver: 2, fra: d.toISOString().slice(0, 10) };
  }
  const n = v === "n" ? Number(nte) : Number(v);
  return n >= 1 ? { hver: n } : null;
}

function rytmetekst(v: RytmeValg, nte: string): string {
  if (v === "A") return "i A-uker";
  if (v === "B") return "i B-uker";
  if (v === "2") return "annenhver uke";
  if (v === "3") return "hver tredje uke";
  return `hver ${nte}. uke`;
}

/** De tre første A-ukene fra og med `fra`, som ukenummer. */
function abUker(aUke: string, fra: string): string {
  const d = new Date(`${aUke}T00:00:00Z`);
  const start = mandag(fra);
  while (d.toISOString().slice(0, 10) < start)
    d.setUTCDate(d.getUTCDate() + 14);
  while (d.toISOString().slice(0, 10) >= start)
    d.setUTCDate(d.getUTCDate() - 14);
  d.setUTCDate(d.getUTCDate() + 14);
  return [0, 1, 2]
    .map((i) => {
      const x = new Date(d);
      x.setUTCDate(x.getUTCDate() + 14 * i);
      return ukenummer(x.toISOString().slice(0, 10));
    })
    .join(", ");
}

/**
 * Datoene serien gir, mens du velger: de første og den siste, og hvor mange
 * som faller bort. Hele lista med avhaking kommer i forhåndsvisningen.
 */
function Datolinje({ dager }: { dager: Seriedag[] }) {
  const blir = dager.filter((d) => d.valgt);
  const bort = dager.length - blir.length;
  if (blir.length === 0)
    return (
      <p className="mt-2 text-liten text-blekk-dempet">
        Ingen datoer med dette valget.
      </p>
    );
  const kort = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString("nb-NO", {
      day: "numeric",
      month: "short",
    });
  const forste = blir.slice(0, 5).map((d) => kort(d.dato));
  return (
    <p className="mt-2 text-liten tabular-nums text-blekk-dempet">
      <span className="font-medium text-blekk">{blir.length} økter</span>:{" "}
      {forste.join(", ")}
      {blir.length > 5 &&
        `${blir.length > 6 ? " … " : ", "}${kort(blir[blir.length - 1].dato)}`}
      {bort > 0 && ` · ${bort} faller bort (helligdager, ferier)`}
    </p>
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
