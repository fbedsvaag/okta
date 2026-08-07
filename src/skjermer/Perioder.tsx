import { useEffect, useMemo, useState } from "react";
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
import { hentOkter, type Okt } from "../data/okter";
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

  async function last() {
    if (!fagId) return;
    setPerioder(await hentPerioder(fagId));
    setOkter((await hentOkter(skolear.id)).filter((o) => o.skolearFagId === fagId));
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
    <div className="max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={fagId}
          onChange={(e) => setFagId(e.target.value)}
          className="rounded border border-neutral-300 bg-white px-2 py-1.5 text-[13px]"
        >
          {fag.map((f) => (
            <option key={f.id} value={f.id}>
              {f.kode} — {f.navn}
            </option>
          ))}
        </select>

        <span className="text-[13px] tabular-nums text-neutral-600">
          {okter.length} økter · {planlagt} timer planlagt
          {valgtFag?.arstimetall != null && (
            <>
              {" av "}
              {valgtFag.arstimetall}
              {" · "}
              <span
                className={
                  planlagt > valgtFag.arstimetall ? "text-[#b3261e]" : ""
                }
              >
                {avvik(planlagt, valgtFag.arstimetall)}
              </span>
            </>
          )}
        </span>

        <div className="ml-auto">
          <Knapp variant="primar" onClick={() => setLagerNy(true)}>
            + Ny periode
          </Knapp>
        </div>
      </div>

      {kolliderer.length > 0 && (
        <p className="mb-3 text-[12px] text-[#b3261e]">
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
        <>
          <Tidslinje bunker={bunker} skolear={skolear} />
          <div className="mt-6">
            {bunker.map((b) => (
              <Bunke
                key={b.periode?.id ?? "uplassert"}
                bunke={b}
                onEndret={last}
                onApneOkt={onApneOkt}
              />
            ))}
          </div>
        </>
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
      <div className="relative h-9 border-y border-neutral-200 bg-neutral-50">
        {med.map((b) => {
          const v = andel(b.periode!.start!);
          const h = andel(b.periode!.slutt!) - v;
          return (
            <div
              key={b.periode!.id}
              title={`${b.periode!.navn} · ${b.okter.length} økter · ${timer(b.minutter)} t`}
              className="absolute top-1 flex h-7 items-center overflow-hidden rounded-sm border border-[#c3d2e0] bg-[#e8eff6] px-1.5"
              style={{
                left: `${Math.max(0, v) * 100}%`,
                width: `${Math.max(0.02, h) * 100}%`,
              }}
            >
              <span className="truncate text-[11px] text-[#1d4e7c]">
                {b.periode!.navn}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between pt-0.5 text-[10px] tabular-nums text-neutral-400">
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
  onEndret,
  onApneOkt,
}: {
  bunke: Plassering;
  onEndret: () => void;
  onApneOkt: (id: string) => void;
}) {
  const p = bunke.periode;

  return (
    <section className="mb-5">
      <header className="flex flex-wrap items-baseline gap-2 border-b border-neutral-300 pb-1">
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
              className="rounded border border-transparent px-1 py-0.5 text-[14px] font-semibold hover:border-neutral-300 focus:border-[#1d4e7c] focus:outline-none"
            />
            <Spennfelt
              verdi={p.start}
              onLagre={async (v) => {
                await endrePeriode(p.id, { start: v });
                onEndret();
              }}
            />
            <span className="text-neutral-400">–</span>
            <Spennfelt
              verdi={p.slutt}
              onLagre={async (v) => {
                await endrePeriode(p.id, { slutt: v });
                onEndret();
              }}
            />
          </>
        ) : (
          <span className="text-[14px] font-semibold text-neutral-500">
            Uten periode
          </span>
        )}

        <span className="ml-auto text-[12px] tabular-nums text-neutral-500">
          {bunke.okter.length} økter · {timer(bunke.minutter)} t
          {p && bunke.faktiskFra && (bunke.faktiskFra !== p.start || bunke.faktiskTil !== p.slutt) && (
            <span className="ml-2 text-neutral-400">
              faktisk {bunke.faktiskFra} – {bunke.faktiskTil}
            </span>
          )}
        </span>

        {p && (
          <button
            onClick={async () => {
              if (
                !confirm(
                  `Slette perioden «${p.navn}»?\n\nØktene blir stående — de blir bare uplasserte.`,
                )
              )
                return;
              await slettPeriode(p.id);
              onEndret();
            }}
            className="text-[12px] text-neutral-400 hover:text-red-700"
          >
            Slett
          </button>
        )}
      </header>

      {bunke.okter.length === 0 ? (
        <p className="py-2 text-[13px] text-neutral-400">
          Ingen økter i dette spennet ennå.
        </p>
      ) : (
        <div>
          {bunke.okter.map((o) => (
            <button
              key={o.id}
              onClick={() => onApneOkt(o.id)}
              className="flex w-full items-center gap-3 border-b border-neutral-100 py-1 text-left text-[13px] hover:bg-neutral-50"
            >
              <span className="w-8 shrink-0 tabular-nums text-neutral-400">
                {ukenummer(o.dato)}
              </span>
              <span className="w-24 shrink-0 tabular-nums text-neutral-600">
                {kortDato(o.dato)}
              </span>
              <span className="w-16 shrink-0 text-right tabular-nums text-neutral-500">
                {o.varighetMin} min
              </span>
              <span className="flex-1 truncate">
                {o.tema ?? <span className="text-neutral-400">—</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
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
      className="rounded border border-transparent px-1 py-0.5 text-[12px] tabular-nums text-neutral-600 hover:border-neutral-300 focus:border-[#1d4e7c] focus:outline-none"
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
    <div className="mb-4 flex flex-wrap items-end gap-3 border border-neutral-300 bg-neutral-50 p-3">
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
