import { useEffect, useMemo, useState } from "react";
import { confirm as bekreft } from "@tauri-apps/plugin-dialog";
import type { Skolear } from "../data/skolear";
import { hentInnstilling, settInnstilling } from "../data/skolear";
import type { FagIAr } from "../data/fag";
import { hentElever, type ElevRad } from "../data/elever";
import {
  endreSamtaledag,
  hentSamtaledager,
  kapasitet,
  opprettSamtaledag,
  slettSamtaledag,
  timerPaDagen,
  type Samtaledag,
} from "../data/samtale";
import { Felt, Tomtilstand } from "../ui/felles";

/**
 * Samtaletrekkeren, SPEC §4.10.
 *
 * Én sammenhengende kolonne til venstre og resultatet til høyre. Ingen faner,
 * ingen steg, ingen veiviser — alt som styrer trekningen er synlig samtidig.
 */

export type Modus = "fag" | "mentor";

/** Standardverdier for en ny dag (§4.10). */
const NY_DAG = { fra: "08:30", til: "15:00", lunsjFra: "11:45", lunsjMin: 30 };

/**
 * Temalista har ingen egen tabell — `samtale.tema` lagrer resultatet, ikke
 * oppsettet. Den ligger derfor i `innstilling`, per fag, som kolonnevalgene.
 */
const temanokkel = (fagId: string) => `samtale_temaer_${fagId}`;

export function Samtaler({
  skolear,
  fag,
  startFagId,
}: {
  skolear: Skolear;
  fag: FagIAr[];
  /** Faget man kom fra, f.eks. fra en muntlig vurdering. */
  startFagId?: string;
}) {
  const [modus, setModus] = useState<Modus>(startFagId ? "fag" : "fag");
  const [fagId, setFagId] = useState(startFagId ?? fag[0]?.id ?? "");
  const [samtaletid, setSamtaletid] = useState("20");
  const [pause, setPause] = useState("5");
  const [temaer, setTemaer] = useState<string[]>([]);
  const [dager, setDager] = useState<Samtaledag[]>([]);
  const [elever, setElever] = useState<ElevRad[]>([]);
  const [egenListe, setEgenListe] = useState("");
  const [brukEgen, setBrukEgen] = useState(false);

  const minutter = Number(samtaletid) || 20;
  const pausen = Number(pause) || 0;

  async function last() {
    setElever(await hentElever(skolear.id));
    const alle = await hentSamtaledager(skolear.id);
    setDager(
      alle.filter((d) =>
        modus === "mentor" ? d.skolearFagId === null : d.skolearFagId === fagId,
      ),
    );
  }

  useEffect(() => {
    void last();
  }, [skolear.id, modus, fagId]);

  useEffect(() => {
    if (modus !== "fag" || !fagId) return;
    void hentInnstilling(temanokkel(fagId)).then((v) =>
      setTemaer(v ? (JSON.parse(v) as string[]) : []),
    );
  }, [modus, fagId]);

  function lagreTemaer(nye: string[]) {
    setTemaer(nye);
    if (modus === "fag" && fagId) {
      void settInnstilling(temanokkel(fagId), JSON.stringify(nye));
    }
  }

  /** Elevene trekningen gjelder — fra appen, eller fra lista du limte inn. */
  const deltakere = useMemo(() => {
    if (brukEgen) {
      return egenListe
        .split("\n")
        .map((n) => n.trim())
        .filter((n) => n !== "")
        .map((navn, i) => ({ id: `limt-${i}`, navn }));
    }
    const passer =
      modus === "mentor"
        ? (e: ElevRad) => e.mentor
        : (e: ElevRad) => e.fagIder.includes(fagId);
    return elever
      .filter(passer)
      .map((e) => ({ id: e.id, navn: `${e.fornavn} ${e.etternavn}` }));
  }, [brukEgen, egenListe, elever, modus, fagId]);

  const kapasiteter = dager.map((d) => kapasitet(d, minutter, pausen));
  const samletKapasitet = kapasiteter.reduce((a, b) => a + b, 0);
  const timer = dager.reduce((sum, d) => sum + timerPaDagen(d), 0);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 gap-6 overflow-clip">
      {/*
        Oppsettskolonnen. Én sammenhengende kolonne med sin egen rullesone —
        ingen faner, ingen steg. Alt som styrer trekningen er synlig samtidig.
      */}
      <div className="flex w-80 shrink-0 flex-col overflow-clip">
        <div className="min-h-0 flex-1 space-y-5 overflow-auto pr-1">
          <Bolk tittel="Modus">
            <div className="flex gap-1">
              <Modusknapp
                aktiv={modus === "fag"}
                onClick={() => setModus("fag")}
              >
                Fagsamtale
              </Modusknapp>
              <Modusknapp
                aktiv={modus === "mentor"}
                onClick={() => setModus("mentor")}
              >
                Mentorsamtale
              </Modusknapp>
            </div>
            {modus === "fag" && (
              <select
                value={fagId}
                onChange={(e) => setFagId(e.target.value)}
                className="mt-2 w-full rounded border border-linje bg-ark px-2 py-1.5 text-brod"
              >
                {fag.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.kode} — {f.navn}
                  </option>
                ))}
              </select>
            )}
            {modus === "mentor" && (
              <p className="mt-2 text-liten text-blekk-dempet">
                Mentorsamtalen hører ikke til noe fag. Elevene er
                mentorelevene dine i år.
              </p>
            )}
          </Bolk>

          <Bolk tittel="Grunninnstillinger">
            <div className="flex gap-2">
              <Felt
                etikett="Minutter per samtale"
                verdi={samtaletid}
                settVerdi={setSamtaletid}
                bredde="w-1/2"
              />
              <Felt
                etikett="Pause (min)"
                verdi={pause}
                settVerdi={setPause}
                bredde="w-1/2"
              />
            </div>
            <p className="mt-1 text-liten text-blekk-dempet">
              {deltakere.length} elever · plass til {samletKapasitet}
            </p>
          </Bolk>

          <Bolk tittel="Elever">
            {!brukEgen ? (
              <>
                <p className="text-brod text-blekk-dempet">
                  {deltakere.length > 0
                    ? `${deltakere.length} elever hentet fra ${
                        modus === "mentor" ? "mentorgruppa" : "faget"
                      }.`
                    : modus === "mentor"
                      ? "Ingen mentorelever i år ennå."
                      : "Ingen elever er koblet til dette faget."}
                </p>
                <button
                  onClick={() => setBrukEgen(true)}
                  className="mt-1 text-liten text-blekk-svak hover:text-blekk"
                >
                  Lim inn en egen liste
                </button>
              </>
            ) : (
              <>
                <textarea
                  value={egenListe}
                  onChange={(e) => setEgenListe(e.target.value)}
                  rows={6}
                  placeholder={"Tony Soprano\nCarmela Soprano"}
                  className="w-full rounded border border-linje px-2 py-1.5 font-mono text-liten outline-none focus:border-aksent"
                />
                <button
                  onClick={() => {
                    setBrukEgen(false);
                    setEgenListe("");
                  }}
                  className="mt-1 text-liten text-blekk-svak hover:text-blekk"
                >
                  Bruk elevene fra appen i stedet
                </button>
              </>
            )}
          </Bolk>

          {/* Mentorsamtalen har ikke oppgavenummer (§4.10). */}
          {modus === "fag" && (
            <Bolk tittel="Oppgavenummer og tema">
              {temaer.length === 0 && (
                <p className="text-liten text-blekk-svak">
                  Ingen temaer ennå. Uten temaer trekkes bare rekkefølgen.
                </p>
              )}
              {temaer.map((t, i) => (
                <div key={i} className="mb-1 flex items-center gap-2">
                  <span className="w-6 shrink-0 text-right text-liten tabular-nums text-blekk-svak">
                    {i + 1}
                  </span>
                  <input
                    value={t}
                    onChange={(e) =>
                      lagreTemaer(temaer.map((x, j) => (j === i ? e.target.value : x)))
                    }
                    placeholder={`Oppgave ${i + 1}`}
                    className="min-w-0 flex-1 rounded border border-linje bg-ark px-2 py-1 text-brod outline-none focus:border-aksent"
                  />
                  <button
                    onClick={() => lagreTemaer(temaer.filter((_, j) => j !== i))}
                    className="shrink-0 px-1 text-blekk-svakest hover:text-feil"
                    title="Fjern"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() => lagreTemaer([...temaer, ""])}
                className="mt-1 text-liten text-blekk-dempet hover:text-blekk"
              >
                + Legg til tema
              </button>
            </Bolk>
          )}

          <Bolk tittel="Samtaledager">
            {dager.map((dag, i) => (
              <Dagkort
                key={dag.id}
                dag={dag}
                nr={i + 1}
                kapasitet={kapasiteter[i]}
                onEndre={async (felter) => {
                  await endreSamtaledag(dag.id, felter);
                  await last();
                }}
                onSlett={async () => {
                  if (
                    !(await bekreft(
                      `Slette dag ${i + 1}?\n\nSamtalene som er trukket på den forsvinner.`,
                    ))
                  )
                    return;
                  await slettSamtaledag(dag.id);
                  await last();
                }}
              />
            ))}
            <button
              onClick={async () => {
                await opprettSamtaledag(skolear.id, {
                  skolearFagId: modus === "mentor" ? null : fagId,
                  dato: "",
                  ...NY_DAG,
                });
                await last();
              }}
              className="mt-1 text-liten text-blekk-dempet hover:text-blekk"
            >
              + Legg til dag
            </button>
            {dager.length > 0 && (
              <p className="mt-2 text-liten text-blekk-svak">
                {timer} timer satt av til vurdering
              </p>
            )}
          </Bolk>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <Tomtilstand
          tekst={
            dager.length === 0
              ? "Legg til minst én samtaledag til venstre."
              : "Sett opp trekningen til venstre. Generering kommer i neste del."
          }
        />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ deler

function Bolk({ tittel, children }: { tittel: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 border-b border-linje-medium pb-1 text-etikett uppercase tracking-etikett text-blekk-dempet">
        {tittel}
      </h2>
      {children}
    </section>
  );
}

function Modusknapp({
  aktiv,
  onClick,
  children,
}: {
  aktiv: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={aktiv}
      className={`flex-1 rounded-vanlig border px-2 py-1.5 text-brod ${
        aktiv
          ? "border-aksent bg-valgt font-medium text-aksent"
          : "border-linje text-blekk-dempet hover:bg-flate"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Ett kort per dag, med sin egen kapasitet.
 *
 * Kapasiteten oppdateres mens du skriver — den regnes ut fra dagen slik den
 * står akkurat nå, ikke fra noe som må lagres først.
 */
function Dagkort({
  dag,
  nr,
  kapasitet: plass,
  onEndre,
  onSlett,
}: {
  dag: Samtaledag;
  nr: number;
  kapasitet: number;
  onEndre: (felter: Record<string, unknown>) => Promise<void>;
  onSlett: () => void;
}) {
  const harLunsj = dag.lunsjFra !== null;

  return (
    <div className="mb-2 rounded-vanlig border border-linje bg-flate-svak p-2">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-liten font-medium">Dag {nr}</span>
        <span className="flex items-baseline gap-2">
          <span className="text-liten tabular-nums text-blekk-dempet">
            {plass > 0 ? `Maks ${plass} elever` : "–"}
          </span>
          <button
            onClick={onSlett}
            className="text-blekk-svakest hover:text-feil"
            title="Fjern dagen"
          >
            ✕
          </button>
        </span>
      </div>

      <input
        type="date"
        defaultValue={dag.dato}
        key={`d${dag.dato}`}
        onBlur={(e) => void onEndre({ dato: e.target.value })}
        className={feltstil + " mb-1.5 w-full"}
      />

      <div className="flex gap-1.5">
        <input
          type="time"
          defaultValue={dag.fra}
          key={`f${dag.fra}`}
          onBlur={(e) => void onEndre({ fra: e.target.value })}
          className={feltstil + " w-1/2"}
        />
        <input
          type="time"
          defaultValue={dag.til}
          key={`t${dag.til}`}
          onBlur={(e) => void onEndre({ til: e.target.value })}
          className={feltstil + " w-1/2"}
        />
      </div>

      <label className="mt-1.5 flex select-none items-center gap-1.5 text-liten text-blekk-dempet">
        <input
          type="checkbox"
          checked={harLunsj}
          onChange={(e) =>
            void onEndre(
              e.target.checked
                ? { lunsj_fra: "11:45", lunsj_min: 30 }
                : { lunsj_fra: null, lunsj_min: null },
            )
          }
        />
        Lunsjpause
      </label>

      {harLunsj && (
        <div className="mt-1.5 flex gap-1.5">
          <input
            type="time"
            defaultValue={dag.lunsjFra ?? "11:45"}
            key={`lf${dag.lunsjFra}`}
            onBlur={(e) => void onEndre({ lunsj_fra: e.target.value })}
            className={feltstil + " w-1/2"}
          />
          <input
            type="number"
            min={5}
            max={120}
            defaultValue={dag.lunsjMin ?? 30}
            key={`lm${dag.lunsjMin}`}
            onBlur={(e) => void onEndre({ lunsj_min: Number(e.target.value) || 30 })}
            className={feltstil + " w-1/2"}
          />
        </div>
      )}
    </div>
  );
}

const feltstil =
  "rounded border border-linje bg-ark px-2 py-1 text-brod tabular-nums outline-none focus:border-aksent";
