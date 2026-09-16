import { useEffect, useMemo, useState } from "react";
import { confirm as bekreft } from "@tauri-apps/plugin-dialog";
import type { Skolear } from "../data/skolear";
import { hentInnstilling, settInnstilling } from "../data/skolear";
import type { FagIAr } from "../data/fag";
import { hentElever, type ElevRad } from "../data/elever";
import {
  delPaDager,
  endreSamtaledag,
  flyttInnenDagen,
  hentHistorikk,
  hentSamtaledager,
  hentSamtaler,
  kapasitet,
  lagreTrekning,
  leggUtDagen,
  merknad,
  opprettSamtaledag,
  slettSamtaledag,
  stokk,
  tildelTema,
  trekkOmRekkefolge,
  trekkOmTema,
  tilKlokke,
  tilMin,
  timerPaDagen,
  vektetRekkefolge,
  type Plassering,
  type Samtaledag,
} from "../data/samtale";
import { Felt, Knapp, Tomtilstand } from "../ui/felles";

/**
 * Samtaletrekkeren, SPEC §4.10.
 *
 * Én sammenhengende kolonne til venstre og resultatet til høyre. Ingen faner,
 * ingen steg, ingen veiviser — alt som styrer trekningen er synlig samtidig.
 */

export type Modus = "fag" | "mentor";

/** En dag slik den vises i timeplanen. */
type Dagplan = {
  dag: Samtaledag;
  rader: {
    elevId: string;
    navn: string;
    tema: string | null;
    fra: string;
    til: string;
    motte: boolean;
  }[];
};

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
  const [historikk, setHistorikk] = useState<Map<string, Plassering[]>>(new Map());
  // Vektingen er av som standard. Ren tilfeldighet er normaltilstanden (§4.10).
  const [vekting, setVekting] = useState(false);
  const [trekning, setTrekning] = useState<Dagplan[] | null>(null);
  const [lagret, setLagret] = useState(true);
  // De to hovedlåsene overlever en ny generering — de er en arbeidsmåte man
  // har valgt. Elevlåsene nullstilles, siden en ny trekning er en ny start
  // for enkeltvalgene (§4.10).
  const [lastTema, setLastTema] = useState(false);
  const [lastRekkefolge, setLastRekkefolge] = useState(false);
  const [lasteElever, setLasteElever] = useState<Set<string>>(new Set());
  const [dragmelding, setDragmelding] = useState<string | null>(null);

  const minutter = Number(samtaletid) || 20;
  const pausen = Number(pause) || 0;

  async function last() {
    setElever(await hentElever(skolear.id));
    setHistorikk(await hentHistorikk(skolear.id));

    const alle = await hentSamtaledager(skolear.id);
    const mine = alle.filter((d) =>
      modus === "mentor" ? d.skolearFagId === null : d.skolearFagId === fagId,
    );
    setDager(mine);

    // Er det allerede trukket på disse dagene, vises det som står i basen.
    const lagrede: Dagplan[] = [];
    for (const dag of mine) {
      const samtaler = await hentSamtaler(dag.id);
      if (samtaler.length === 0) continue;
      lagrede.push({
        dag,
        rader: samtaler.map((s) => ({
          elevId: s.elevId,
          navn: `${s.fornavn} ${s.etternavn}`,
          tema: s.tema,
          fra: s.klokkeslett,
          til: tilKlokke(tilMin(s.klokkeslett) + s.varighetMin),
          motte: s.motte,
        })),
      });
    }
    setTrekning(lagrede.length > 0 ? lagrede : null);
    setLagret(true);

    // Én dag ligger klar med én gang, så datofeltet er fremme og ikke gjemt
    // bak en «legg til»-lenke.
    if (mine.length === 0) {
      await opprettSamtaledag(skolear.id, {
        skolearFagId: modus === "mentor" ? null : fagId,
        dato: "",
        ...NY_DAG,
      });
      setDager(
        (await hentSamtaledager(skolear.id)).filter((d) =>
          modus === "mentor" ? d.skolearFagId === null : d.skolearFagId === fagId,
        ),
      );
    }
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

  /** Legger ut dagene og bygger radene som vises. */
  function byggPlan(
    perDag: string[][],
    temakart: Map<string, string>,
  ): Dagplan[] {
    const navn = new Map(deltakere.map((d) => [d.id, d.navn]));
    const plan: Dagplan[] = [];

    dager.forEach((dag, i) => {
      const paDagen = perDag[i] ?? [];
      if (paDagen.length === 0) return;

      const slots = leggUtDagen(dag, paDagen.length, minutter, pausen).filter(
        (s) => s.type === "samtale",
      );
      plan.push({
        dag,
        rader: slots.map((s, j) => ({
          elevId: paDagen[j],
          navn: navn.get(paDagen[j]) ?? "",
          tema: temakart.get(paDagen[j]) ?? null,
          fra: tilKlokke(s.fra),
          til: tilKlokke(s.til),
          motte: true,
        })),
      });
    });
    return plan;
  }

  /**
   * Skriver trekningen.
   *
   * Innlimte elever finnes ikke i basen, og samtale.elev_id har fremmednøkkel
   * til elev — da vises trekningen uten å lagres, tydelig merket. Å gjøre
   * innlimingen ubrukelig ville vært verre.
   */
  async function skriv(plan: Dagplan[]) {
    setTrekning(plan);

    if (brukEgen) {
      setLagret(false);
      return;
    }

    for (const d of plan) {
      await lagreTrekning(
        d.dag.id,
        d.rader.map((r) => ({
          elevId: r.elevId,
          klokkeslett: r.fra,
          varighetMin: minutter,
          tema: r.tema,
        })),
      );
    }
    setLagret(true);
    setHistorikk(await hentHistorikk(skolear.id));
  }

  /**
   * Flytter en rad innen dagen.
   *
   * Klokkeslettene står der de står — det er elevene som flyttes mellom dem.
   */
  async function flytt(dagIdx: number, fra: number, til: number) {
    if (!trekning) return;

    const perDag = trekning.map((d) => d.rader.map((r) => r.elevId));
    perDag[dagIdx] = flyttInnenDagen(perDag[dagIdx], fra, til);

    const na = new Map<string, string>();
    for (const d of trekning) {
      for (const r of d.rader) if (r.tema) na.set(r.elevId, r.tema);
    }
    await skriv(byggPlan(perDag, na));
  }

  /** Helt ny trekning. Fordeler på nytt over dagene, og løser opp elevlåsene. */
  async function generer() {
    if (
      trekning &&
      !(await bekreft(
        "Generer ny trekning?\n\nDen som ligger nå blir erstattet, og låsene på enkeltelever løses opp.",
      ))
    )
      return;

    const ider = deltakere.map((d) => d.id);
    const ordnet = vekting ? vektetRekkefolge(ider, historikk) : stokk(ider);
    const rene = temaer.filter((t) => t.trim() !== "");

    setLasteElever(new Set());
    await skriv(byggPlan(delPaDager(ordnet, kapasiteter), tildelTema(ordnet, rene)));
  }

  /**
   * Trekker om innenfor den fordelingen som allerede er gjort.
   *
   * Låsene bestemmer hva som faktisk endres. Er begge på, skjer ingenting —
   * og da sier hjelpeteksten det, framfor at knappen ser ut til å virke.
   */
  async function trekkPaNytt() {
    if (!trekning) return generer();
    if (lastTema && lastRekkefolge) return;

    const perDag = trekning.map((d) => d.rader.map((r) => r.elevId));
    const na = new Map<string, string>();
    for (const d of trekning) {
      for (const r of d.rader) if (r.tema) na.set(r.elevId, r.tema);
    }

    const nyPerDag = lastRekkefolge
      ? perDag
      : trekkOmRekkefolge(perDag, lasteElever);

    const rene = temaer.filter((t) => t.trim() !== "");
    const nyttTema = lastTema
      ? na
      : trekkOmTema(perDag.flat(), na, lasteElever, rene);

    await skriv(byggPlan(nyPerDag, nyttTema));
  }

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

          {/*
            Historikken er synlig mens du trekker, ikke bare etterpå. Merknadene
            vises uansett om vektingen er på — de er opplysning, ikke konsekvens
            av en innstilling (§4.10).
          */}
          <Bolk tittel="Historikk">
            <Historikkoversikt deltakere={deltakere} historikk={historikk} />
            <label className="mt-2 flex select-none items-center gap-1.5 text-liten text-blekk-dempet">
              <input
                type="checkbox"
                checked={vekting}
                onChange={(e) => setVekting(e.target.checked)}
              />
              Vekt mot gjentakelse
            </label>
          </Bolk>
        </div>

        {/* Generer, og under den Trekk på nytt med de to låsene (§4.10). */}
        <div className="shrink-0 space-y-3 border-t border-linje-medium pt-3">
          <Knapp
            variant="primar"
            disabled={deltakere.length === 0 || dager.length === 0}
            onClick={() => void generer()}
          >
            Generer timeplan
          </Knapp>

          {trekning && (
            <div>
              <h2 className="mb-2 text-etikett uppercase tracking-etikett text-blekk-dempet">
                Trekk på nytt
              </h2>
              <div className="flex gap-1">
                <Lasknapp
                  last={lastTema}
                  onKlikk={() => setLastTema((v) => !v)}
                >
                  Tema
                </Lasknapp>
                <Lasknapp
                  last={lastRekkefolge}
                  onKlikk={() => setLastRekkefolge((v) => !v)}
                >
                  Rekkefølge
                </Lasknapp>
              </div>
              <p className="mt-1 min-h-4 text-liten text-blekk-svak">
                {lashint(lastTema, lastRekkefolge)}
              </p>
              <button
                onClick={() => void trekkPaNytt()}
                disabled={lastTema && lastRekkefolge}
                className="mt-1 w-full rounded border border-linje bg-ark px-3 py-1.5 text-brod hover:bg-flate disabled:opacity-40 disabled:hover:bg-ark"
              >
                Trekk på nytt
              </button>
              {lasteElever.size > 0 && (
                <p className="mt-1 text-liten text-blekk-svak">
                  {lasteElever.size} {lasteElever.size === 1 ? "elev" : "elever"} låst
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {deltakere.length > samletKapasitet && dager.length > 0 && (
          <div className="mb-4 border border-varsel bg-fri-flate px-3 py-2 text-brod text-varsel">
            Kapasiteten ({samletKapasitet} elever) er lavere enn antall elever (
            {deltakere.length}). Legg til flere dager, forleng øktene, eller
            reduser pausetiden.
          </div>
        )}

        {dragmelding && (
          <div className="mb-4 border border-linje bg-flate px-3 py-2 text-brod text-blekk-dempet">
            {dragmelding}
          </div>
        )}

        {!lagret && (
          <div className="mb-4 border border-linje bg-flate px-3 py-2 text-brod text-blekk-dempet">
            Trekningen er ikke lagret. Elevene i den innlimte lista finnes ikke
            i appen, så det er ingenting å henge samtalene på. Lim dem inn under
            Elever først, så lagres trekningen og teller i historikken.
          </div>
        )}

        {trekning === null ? (
          <Tomtilstand
            tekst={
              dager.length === 0
                ? "Legg til minst én samtaledag til venstre."
                : "Sett opp trekningen til venstre og trykk Generer timeplan."
            }
          />
        ) : (
          <Timeplan
            plan={trekning}
            historikk={historikk}
            laste={lasteElever}
            onFlytt={(dagIdx, fra, til) => void flytt(dagIdx, fra, til)}
            onFeilDrag={() => {
              setDragmelding(
                "Flytting mellom dager gjøres ikke ved å dra. Dagene har hver sin kapasitet, og et slikt drag ville stilt spørsmål om hvem som må ut. Endre dagene til venstre, eller generer på nytt.",
              );
              setTimeout(() => setDragmelding(null), 6000);
            }}
            onLas={(elevId) =>
              setLasteElever((f) => {
                const ny = new Set(f);
                if (ny.has(elevId)) ny.delete(elevId);
                else ny.add(elevId);
                return ny;
              })
            }
          />
        )}
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

/**
 * Timeplanen: én bolk per dag, én rad per samtale.
 *
 * Plassnummeret løper sammenhengende over alle dagene — dag 2 fortsetter der
 * dag 1 sluttet (§4.10).
 */
function Timeplan({
  plan,
  historikk,
  laste,
  onLas,
  onFlytt,
  onFeilDrag,
}: {
  plan: Dagplan[];
  historikk: Map<string, Plassering[]>;
  laste: ReadonlySet<string>;
  onLas: (elevId: string) => void;
  onFlytt: (dagIdx: number, fra: number, til: number) => void;
  onFeilDrag: () => void;
}) {
  let plass = 0;

  return (
    <div className="space-y-6">
      {plan.map((d, dagIdx) => (
        <section key={d.dag.id}>
          <div className="mb-1 flex items-baseline justify-between border-b border-linje pb-1">
            <h2 className="text-tittel font-semibold first-letter:uppercase">
              {langDato(d.dag.dato)}
            </h2>
            <span className="text-liten tabular-nums text-blekk-dempet">
              {d.dag.fra}–{d.dag.til} · {d.rader.length} elever
            </span>
          </div>

          {d.rader.map((r, radIdx) => {
            plass++;
            // Merknaden bygges på historikken FØR denne trekningen, så den
            // sier noe om hva som har skjedd — ikke om det som nettopp ble
            // trukket.
            const notis = merknad(historikk.get(r.elevId) ?? []);
            const erLast = laste.has(r.elevId);
            return (
              <div
                key={`${r.elevId}-${r.fra}`}
                draggable={!erLast}
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    "text/plain",
                    JSON.stringify({ dagIdx, radIdx }),
                  );
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const data = e.dataTransfer.getData("text/plain");
                  if (!data) return;
                  const kilde = JSON.parse(data) as {
                    dagIdx: number;
                    radIdx: number;
                  };
                  // Et drag som stille ruller tilbake ser ut som at musa
                  // glapp. Derfor sier vi fra om hvorfor (§4.10).
                  if (kilde.dagIdx !== dagIdx) return onFeilDrag();
                  onFlytt(dagIdx, kilde.radIdx, radIdx);
                }}
                className={`flex items-baseline gap-3 border-b border-linje-svak py-1.5 text-brod ${
                  r.motte ? "" : "text-blekk-svak line-through"
                } ${erLast ? "bg-flate-svak" : "cursor-grab"}`}
              >
                <span className="w-6 shrink-0 text-right tabular-nums text-blekk-svak">
                  {plass}
                </span>
                <span className="w-24 shrink-0 tabular-nums text-blekk-dempet">
                  {r.fra}–{r.til}
                </span>
                <span className="min-w-0 flex-1 truncate">{r.navn}</span>
                {r.tema && (
                  <span className="w-40 shrink-0 truncate text-blekk-dempet">
                    {r.tema}
                  </span>
                )}
                <span className="w-32 shrink-0 text-right text-liten text-blekk-svak">
                  {r.motte ? notis : "møtte ikke"}
                </span>
                <button
                  onClick={() => onLas(r.elevId)}
                  title={
                    erLast
                      ? "Lås opp — eleven trekkes om igjen"
                      : "Lås — eleven beholder plass og tema"
                  }
                  className={`w-5 shrink-0 text-liten ${
                    erLast ? "text-aksent" : "text-blekk-svakest hover:text-blekk"
                  }`}
                >
                  {erLast ? "🔒" : "🔓"}
                </button>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

/**
 * Hvem som hadde tidlig eller sent sist, samlet.
 *
 * Bare de som har noe å si står her — de fleste har ingenting, og det er
 * nettopp derfor de som har det er verdt å se på.
 */
function Historikkoversikt({
  deltakere,
  historikk,
}: {
  deltakere: { id: string; navn: string }[];
  historikk: Map<string, Plassering[]>;
}) {
  const grupper = new Map<string, string[]>();
  for (const d of deltakere) {
    const notis = merknad(historikk.get(d.id) ?? []);
    if (!notis) continue;
    grupper.set(notis, [...(grupper.get(notis) ?? []), d.navn.split(" ")[0]]);
  }

  if (grupper.size === 0) {
    return (
      <p className="text-liten text-blekk-svak">
        Ingenting å melde ennå. Etter et par trekninger står det her hvem som
        har hatt tidlig eller sent.
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {[...grupper].map(([notis, navn]) => (
        <li key={notis} className="text-liten">
          <span className="text-blekk-dempet">{notis}</span>{" "}
          <span className="text-blekk-svak">· {navn.join(", ")}</span>
        </li>
      ))}
    </ul>
  );
}

/** Ordlyden fra §4.10 — den sier hva «Trekk på nytt» faktisk gjør. */
function lashint(tema: boolean, rekkefolge: boolean): string {
  if (tema && rekkefolge) return "Begge er låst — ingenting endres.";
  if (tema) return "Temaer holdes — kun rekkefølge trekkes.";
  if (rekkefolge) return "Rekkefølge holdes — kun tema trekkes.";
  return "";
}

function Lasknapp({
  last,
  onKlikk,
  children,
}: {
  last: boolean;
  onKlikk: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onKlikk}
      aria-pressed={last}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-vanlig border px-2 py-1 text-liten ${
        last
          ? "border-aksent bg-valgt text-aksent"
          : "border-linje text-blekk-dempet hover:bg-flate"
      }`}
    >
      <span aria-hidden>{last ? "🔒" : "🔓"}</span>
      {children}
    </button>
  );
}

function langDato(dato: string): string {
  if (!dato) return "Dato ikke satt";
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
