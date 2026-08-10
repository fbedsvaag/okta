import { useEffect, useMemo, useState } from "react";
import { confirm as bekreft } from "@tauri-apps/plugin-dialog";
import {
  endrePeriode,
  fordel,
  hentPerioder,
  opprettPeriode,
  overlapp,
  slettPeriode,
  type Periode,
  type Plassering,
} from "../data/perioder";
import { endreOkt, hentOkter, opprettOkt, type Okt } from "../data/okter";
import { hentPeriodemal } from "../data/perioder";
import { Malvelger } from "./Malvelger";
import { ukenummer } from "../data/kalender";
import type { FagIAr } from "../data/fag";
import type { Skolear } from "../data/skolear";
import { Felt, Knapp, Tomtilstand } from "../ui/felles";

/**
 * Periodevisning, SPEC §4.2.
 *
 * Ett fag om gangen — perioder på tvers av fag gir ingen mening. Øktene
 * faller i en periode fordi datoen ligger i spennet; flytter du en grense,
 * flytter øktene seg med.
 *
 * Periodisering er frivillig. Har du ingen perioder, virker øktene like godt.
 */
export function Perioder({
  skolear,
  fag,
  onApneOkt,
}: {
  skolear: Skolear;
  fag: FagIAr[];
  onApneOkt: (oktId: string) => void;
}) {
  const [fagId, setFagId] = useState(fag[0]?.id ?? "");
  const [perioder, setPerioder] = useState<Periode[]>([]);
  const [okter, setOkter] = useState<Okt[]>([]);
  const [lagerNy, setLagerNy] = useState(false);

  const valgtFag = fag.find((f) => f.id === fagId);

  // Kompetansemålene per periode, og alle som er dekket i faget samlet.
  const [periodemal, setPeriodemal] = useState<Map<string, string[]>>(new Map());
  const [lagerOkt, setLagerOkt] = useState(false);

  async function lastMal(skolearFagId: string | null) {
    setPeriodemal(skolearFagId ? await hentPeriodemal(skolearFagId) : new Map());
  }

  async function last() {
    if (!fagId) return;
    setPerioder(await hentPerioder(fagId));
    setOkter((await hentOkter(skolear.id)).filter((o) => o.skolearFagId === fagId));
    await lastMal(fagId);
  }

  useEffect(() => {
    void last();
  }, [fagId, skolear.id]);

  const bunker = useMemo(() => fordel(okter, perioder), [okter, perioder]);
  const kolliderer = useMemo(() => overlapp(perioder), [perioder]);

  const totalMin = okter.reduce((s, o) => s + o.varighetMin, 0);
  const planlagt = Math.round((totalMin / 60) * 10) / 10;

  if (fag.length === 0) {
    return <Tomtilstand tekst="Legg inn fagene dine først." />;
  }

  return (
    <div className="flex min-h-0 flex-1 max-w-4xl flex-col overflow-hidden">
      {/*
        Fagvelger, timeregnskap og knappene blir stående mens du ruller
        gjennom periodene — det er dem du styrer skjermen med.
      */}
      <div className="shrink-0">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <select
            value={fagId}
            onChange={(e) => setFagId(e.target.value)}
            className="rounded border border-linje bg-ark px-2 py-1.5 text-brod"
          >
            {fag.map((f) => (
              <option key={f.id} value={f.id}>
                {f.kode} — {f.navn}
              </option>
            ))}
          </select>

          <span className="text-brod tabular-nums text-blekk-dempet">
            {okter.length} økter · {planlagt} timer planlagt
            {valgtFag?.arstimetall != null && (
              <>
                {" av "}
                {valgtFag.arstimetall}
                {" · "}
                <span
                  className={planlagt > valgtFag.arstimetall ? "text-feil" : ""}
                >
                  {avvik(planlagt, valgtFag.arstimetall)}
                </span>
              </>
            )}
          </span>

          <div className="ml-auto flex items-center gap-2">
            {perioder.length > 0 && (
              <Knapp onClick={() => setLagerOkt((v) => !v)}>
                {lagerOkt ? "Avbryt" : "+ Ny økt"}
              </Knapp>
            )}
            <Knapp variant="primar" onClick={() => setLagerNy(true)}>
              + Ny periode
            </Knapp>
          </div>
        </div>

        {kolliderer.length > 0 && (
          <p className="mb-3 text-liten text-feil">
            ! {kolliderer.map(([a, b]) => `${a.navn} og ${b.navn}`).join(", ")}{" "}
            overlapper i tid. Øktene i overlappet havner i den første av dem.
          </p>
        )}

        {lagerNy && (
          <NyPeriode
            skolear={skolear}
            antall={perioder.length}
            fagId={fagId}
            onLagret={async () => {
              setLagerNy(false);
              await last();
            }}
            onAvbryt={() => setLagerNy(false)}
          />
        )}

        {lagerOkt && valgtFag && (
          <NyOktIPeriode
            perioder={perioder}
            fagKode={valgtFag.kode}
            skolearFagId={fagId}
            standardVarighet={Number(valgtFag.standardVarighetMin ?? 180)}
            sisteDato={okter[okter.length - 1]?.dato}
            onLagret={() => {
              setLagerOkt(false);
              void last();
            }}
          />
        )}
      </div>

      {perioder.length === 0 && !lagerNy ? (
        <Tomtilstand
          tekst={
            "Ingen perioder i " +
            (valgtFag?.kode ?? "faget") +
            " ennå. Periodisering er frivillig — øktene virker uten. " +
            "Men med perioder ser du om et tema har fått for få timer."
          }
          handling={
            <Knapp variant="primar" onClick={() => setLagerNy(true)}>
              Lag den første
            </Knapp>
          }
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <Tidslinje bunker={bunker} skolear={skolear} />


          {bunker.map((b) => (
            <Bunke
              key={b.periode?.id ?? "uplassert"}
              bunke={b}
              grepKode={valgtFag?.grepKode ?? null}
              mal={periodemal.get(b.periode?.id ?? "") ?? []}
              dekket={new Set([...periodemal.values()].flat())}
              onMalEndret={() => void lastMal(fagId)}
              onEndret={last}
              onApneOkt={onApneOkt}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function avvik(planlagt: number, arstimetall: number): string {
  const diff = Math.round((planlagt - arstimetall) * 10) / 10;
  if (diff === 0) return "i balanse";
  return diff > 0 ? `${diff} timer over` : `${Math.abs(diff)} timer igjen`;
}

/**
 * Året som en vannrett strek. Bredden på hvert felt er periodens andel av
 * skoleåret, så du ser med én gang om noe er kort eller langt.
 */
function Tidslinje({
  bunker,
  skolear,
}: {
  bunker: Plassering[];
  skolear: Skolear;
}) {
  const fra = new Date(`${skolear.start}T00:00:00`).getTime();
  const til = new Date(`${skolear.slutt}T00:00:00`).getTime();
  const spenn = Math.max(1, til - fra);
  const andel = (dato: string) =>
    (new Date(`${dato}T00:00:00`).getTime() - fra) / spenn;

  const med = bunker.filter((b) => b.periode?.start && b.periode?.slutt);

  return (
    <div>
      <div className="relative h-9 border-y border-linje-medium bg-flate">
        {med.map((b) => {
          const v = andel(b.periode!.start!);
          const h = andel(b.periode!.slutt!) - v;
          return (
            <div
              key={b.periode!.id}
              title={`${b.periode!.navn} · ${b.okter.length} økter · ${timer(b.minutter)} t`}
              className="absolute top-1 flex h-7 items-center overflow-hidden rounded-sm border border-linje-sterk bg-flate-svak px-1.5"
              style={{
                left: `${Math.max(0, v) * 100}%`,
                width: `${Math.max(0.02, h) * 100}%`,
              }}
            >
              <span className="truncate text-etikett text-aksent">
                {b.periode!.navn}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between pt-0.5 text-mikro tabular-nums text-blekk-svak">
        <span>{skolear.start}</span>
        <span>{skolear.slutt}</span>
      </div>
    </div>
  );
}

function timer(minutter: number): number {
  return Math.round((minutter / 60) * 10) / 10;
}

function Bunke({
  bunke,
  grepKode,
  mal,
  dekket,
  onMalEndret,
  onEndret,
  onApneOkt,
}: {
  bunke: Plassering;
  grepKode: string | null;
  /** kompetansemålkodene for denne perioden */
  mal: string[];
  /** alle koder dekket i faget, til å markere overlapp */
  dekket: Set<string>;
  onMalEndret: () => void;
  onEndret: () => void;
  onApneOkt: (id: string) => void;
}) {
  const p = bunke.periode;

  return (
    <section className="mb-5">
      <header className="flex flex-wrap items-baseline gap-2 border-b border-linje pb-1">
        {p ? (
          <>
            <input
              defaultValue={p.navn}
              key={p.navn}
              onBlur={async (e) => {
                const navn = e.target.value.trim();
                if (navn && navn !== p.navn) {
                  await endrePeriode(p.id, { navn });
                  onEndret();
                }
              }}
              className="rounded border border-transparent px-1 py-0.5 text-medium font-semibold hover:border-linje focus:border-aksent focus:outline-none"
            />
            <Spennfelt
              verdi={p.start}
              onLagre={async (v) => {
                await endrePeriode(p.id, { start: v });
                onEndret();
              }}
            />
            <span className="text-blekk-svak">–</span>
            <Spennfelt
              verdi={p.slutt}
              onLagre={async (v) => {
                await endrePeriode(p.id, { slutt: v });
                onEndret();
              }}
            />
          </>
        ) : (
          <span className="text-medium font-semibold text-blekk-dempet">
            Uten periode
          </span>
        )}

        <span className="ml-auto text-liten tabular-nums text-blekk-dempet">
          {bunke.okter.length} økter · {timer(bunke.minutter)} t
        </span>


        {p && (
          <button
            onClick={async () => {
              if (
                !await bekreft(
                  `Slette perioden «${p.navn}»?\n\nØktene blir stående — de blir bare uplasserte.`,
                )
              )
                return;
              await slettPeriode(p.id);
              onEndret();
            }}
            className="text-liten text-blekk-svak hover:text-red-700"
          >
            Slett
          </button>
        )}
      </header>

      {p && (
        <Malvelger
          grepKode={grepKode}
          periodeId={p.id}
          valgte={mal}
          dekketAndreSteder={dekket}
          onEndret={onMalEndret}
        />
      )}

      {bunke.okter.length === 0 ? (
        <p className="py-4 text-center text-brod text-blekk-svak">
          Ingen økter her ennå. Dra dem hit.
        </p>
      ) : (
        <div>
          {bunke.okter.map((o) => (
            <button
              key={o.id}
              onClick={() => onApneOkt(o.id)}
              className="flex w-full items-center gap-3 border-b border-linje-svak py-1 text-left text-brod hover:bg-flate"
            >
              <span className="w-8 shrink-0 tabular-nums text-blekk-svak">
                {ukenummer(o.dato)}
              </span>
              <span className="w-24 shrink-0 tabular-nums text-blekk-dempet">
                {kortDato(o.dato)}
              </span>
              <span className="w-16 shrink-0 text-right tabular-nums text-blekk-dempet">
                {o.varighetMin} min
              </span>
              <span className="flex-1 truncate">
                {o.tema ?? <span className="text-blekk-svak">—</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Ny økt rett i en periode.
 *
 * Faget er gitt av skjermen, og perioden av bolken du står i — så det eneste
 * som må fylles ut er dato, tid og varighet. Perioden settes uttrykkelig på
 * økta, ikke utledet av datoen, siden du nettopp har sagt hvor den hører
 * hjemme.
 */
function NyOktIPeriode({
  perioder,
  fagKode,
  skolearFagId,
  standardVarighet,
  sisteDato,
  onLagret,
}: {
  perioder: Periode[];
  fagKode: string;
  skolearFagId: string;
  standardVarighet: number;
  sisteDato?: string;
  onLagret: () => void;
}) {
  const [periodeId, setPeriodeId] = useState(perioder[0]?.id ?? "");
  // Dagen etter siste økt i faget — det er nesten alltid der neste hører
  // hjemme når man punsjer inn en termin.
  const [dato, setDato] = useState(
    sisteDato ? nesteDag(sisteDato) : new Date().toISOString().slice(0, 10),
  );
  const [klokke, setKlokke] = useState("");
  const [varighet, setVarighet] = useState(String(standardVarighet));

  async function lagre() {
    if (!dato) return;
    const id = await opprettOkt(
      skolearFagId,
      fagKode,
      dato,
      klokke || null,
      Number(varighet) || standardVarighet,
    );
    // Tom periode betyr «la datoen bestemme» — perioden utledes da av
    // spennet, slik den gjør for økter som aldri er plassert (§3.3).
    if (periodeId) await endreOkt(id, { periode_id: periodeId });
    onLagret();
  }

  return (
    <div className="mb-3 flex flex-wrap items-end gap-3 border border-linje bg-flate p-2">
      <label className="block">
        <span className="mb-1 block text-etikett uppercase tracking-etikett text-blekk-dempet">
          Periode
        </span>
        <select
          value={periodeId}
          onChange={(e) => setPeriodeId(e.target.value)}
          className="rounded border border-linje bg-ark px-2 py-1.5 text-brod"
        >
          {perioder.map((p) => (
            <option key={p.id} value={p.id}>
              {p.navn}
            </option>
          ))}
          <option value="">La datoen bestemme</option>
        </select>
      </label>
      <Felt etikett="Dato" type="date" verdi={dato} settVerdi={setDato} bredde="w-40" />
      <Felt
        etikett="Klokkeslett"
        verdi={klokke}
        settVerdi={setKlokke}
        plassholder="09:15"
        bredde="w-24"
      />
      <Felt
        etikett="Varighet"
        verdi={varighet}
        settVerdi={setVarighet}
        bredde="w-24"
        onEnter={lagre}
      />
      <Knapp variant="primar" onClick={lagre}>
        Legg til økt
      </Knapp>
    </div>
  );
}

function nesteDag(dato: string): string {
  const d = new Date(`${dato}T00:00:00`);
  d.setDate(d.getDate() + 1);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function Spennfelt({
  verdi,
  onLagre,
}: {
  verdi: string | null;
  onLagre: (v: string | null) => void;
}) {
  return (
    <input
      type="date"
      defaultValue={verdi ?? ""}
      key={verdi ?? ""}
      onBlur={(e) => {
        if (e.target.value !== (verdi ?? "")) onLagre(e.target.value || null);
      }}
      className="rounded border border-transparent px-1 py-0.5 text-liten tabular-nums text-blekk-dempet hover:border-linje focus:border-aksent focus:outline-none"
    />
  );
}

function NyPeriode({
  skolear,
  antall,
  fagId,
  onLagret,
  onAvbryt,
}: {
  skolear: Skolear;
  antall: number;
  fagId: string;
  onLagret: () => void;
  onAvbryt: () => void;
}) {
  const [navn, setNavn] = useState("");
  const [start, setStart] = useState(skolear.start);
  const [slutt, setSlutt] = useState("");

  async function lagre() {
    if (navn.trim() === "") return;
    await opprettPeriode(fagId, navn.trim(), start || null, slutt || null, antall);
    onLagret();
  }

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 border border-linje bg-flate p-3">
      <Felt
        etikett="Navn"
        verdi={navn}
        settVerdi={setNavn}
        plassholder="Markedsanalyse"
        bredde="w-64"
        autoFocus
        onEnter={lagre}
      />
      <Felt etikett="Fra" verdi={start} settVerdi={setStart} type="date" bredde="w-40" />
      <Felt etikett="Til" verdi={slutt} settVerdi={setSlutt} type="date" bredde="w-40" />
      <Knapp variant="primar" onClick={lagre} disabled={navn.trim() === ""}>
        Opprett
      </Knapp>
      <Knapp variant="stille" onClick={onAvbryt}>
        Avbryt
      </Knapp>
      </div>
  );
}

function kortDato(dato: string): string {
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}
