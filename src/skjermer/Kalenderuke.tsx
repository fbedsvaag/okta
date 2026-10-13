import { useEffect, useMemo, useState } from "react";
import { blokkering, type Fridag } from "../data/kalender";
import {
  endreOkt,
  hentOktVurderinger,
  dupliserOkt,
  type Okt,
  type OktVurdering,
} from "../data/okter";
import type { FagIAr } from "../data/fag";
import {
  fargelegg,
  hentAllePerioder,
  periodeFor,
  type Periode,
} from "../data/perioder";
import { timerPaDagen, type Samtaledag } from "../data/samtale";
import { Fagfirkant, Knapp } from "../ui/felles";
import { leggTil, mandagFor, Ukelinje, type Heldag } from "./Ukelinje";
import { Periodemerke } from "./Periodefiltre";

/**
 * Kalenderen, uke (DESIGN.md §10): timerutenett med en rad for det som
 * ligger over hele dagen, valgt økt i et panel til høyre, og timer per fag
 * den uka — med samtaletimer på egen linje.
 *
 * Et klikk på en økt velger den; «Åpne» legger den som et ark over.
 */
export function Kalenderuke({
  skolearId,
  forste,
  siste,
  okter,
  fag,
  fridager,
  rode,
  samtaledager,
  onApneOkt,
  onEndret,
}: {
  skolearId: string;
  forste: string;
  siste: string;
  okter: Okt[];
  fag: FagIAr[];
  fridager: Fridag[];
  rode: Map<string, string>;
  samtaledager: Samtaledag[];
  onApneOkt: (id: string) => void;
  onEndret: () => void;
}) {
  const idag = isoIDag();
  const [mandag, setMandag] = useState(mandagFor(idag));
  const [valgt, setValgt] = useState<string | null>(null);
  const [perioder, setPerioder] = useState<Periode[]>([]);
  const [vurderinger, setVurderinger] = useState<Map<string, OktVurdering[]>>(
    new Map(),
  );

  useEffect(() => {
    void hentAllePerioder(skolearId).then(setPerioder);
    void hentOktVurderinger(skolearId).then(setVurderinger);
  }, [skolearId, okter]);

  const heldag = useMemo(() => {
    return (dato: string): Heldag[] => {
      const ut: Heldag[] = [];
      const b = blokkering(dato, fridager, rode);
      if (b && b.type !== "helg") {
        ut.push({
          navn: b.navn,
          type:
            b.type === "helligdag"
              ? "helligdag"
              : b.type === "hendelse"
                ? "hendelse"
                : "fri",
        });
      }
      for (const d of samtaledager) {
        if (d.dato !== dato) continue;
        ut.push({
          navn: `${d.fagKode ?? "Mentorsamtaler"} ${d.fra}–${d.til}${
            d.antall > 0 ? ` · ${d.antall}` : ""
          }`,
          type: "samtale",
        });
      }
      return ut;
    };
  }, [fridager, rode, samtaledager]);

  const okt = valgt ? okter.find((o) => o.id === valgt) : undefined;

  // Timer per fag den uka, og samtaledagene som ikke ligger i en økt.
  const fredag = leggTil(mandag, 4);
  const iUka = okter.filter((o) => o.dato >= mandag && o.dato <= fredag);
  const perFag = fag
    .map((f) => ({
      f,
      minutter: iUka
        .filter((o) => o.skolearFagId === f.id)
        .reduce((s, o) => s + o.varighetMin, 0),
    }))
    .filter((x) => x.minutter > 0);
  const samtaletimer = samtaledager
    .filter((d) => d.dato >= mandag && d.dato <= fredag && d.oktId === null)
    .reduce((s, d) => s + timerPaDagen(d), 0);

  return (
    <div className="flex min-h-0 flex-1 gap-6">
      <div className="min-h-0 min-w-0 flex-1 overflow-auto">
        <Ukelinje
          okter={okter}
          forste={forste}
          siste={siste}
          idag={idag}
          time={44}
          heldag={heldag}
          valgt={valgt}
          onUke={setMandag}
          onApneOkt={setValgt}
        />
      </div>

      <aside className="w-64 shrink-0 space-y-6 overflow-y-auto">
        {okt ? (
          <Valgt
            okt={okt}
            fag={fag}
            periode={periodeFor(
              okt,
              perioder.filter((p) => p.skolearFagId === okt.skolearFagId),
            )}
            vurderinger={vurderinger.get(okt.id) ?? []}
            onApne={() => onApneOkt(okt.id)}
            onEndret={onEndret}
          />
        ) : (
          <p className="text-liten text-blekk-dempet">
            Klikk på en økt for å se den her.
          </p>
        )}

        <section>
          <h3 className="mb-1.5 border-b border-linje-medium pb-1 text-brod font-semibold">
            Timer denne uka
          </h3>
          {perFag.length === 0 && samtaletimer === 0 ? (
            <p className="text-liten text-blekk-dempet">Ingen økter.</p>
          ) : (
            <ul className="space-y-1 text-brod">
              {perFag.map(({ f, minutter }) => (
                <li key={f.id} className="flex items-center gap-2">
                  <Fagfirkant farge={f.farge} />
                  <span className="font-medium">{f.kode}</span>
                  <span className="ml-auto tabular-nums text-blekk-dempet">
                    {timerTekst(minutter / 60)}
                  </span>
                </li>
              ))}
              {samtaletimer > 0 && (
                <li className="flex items-center gap-2 text-blekk-dempet">
                  <span className="w-2" />
                  Samtaler
                  <span className="ml-auto tabular-nums">
                    {timerTekst(samtaletimer)}
                  </span>
                </li>
              )}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}

/** Den valgte økta: dato, tid, rom, periode og vurdering; Åpne, Flytt, Dupliser. */
function Valgt({
  okt,
  fag,
  periode,
  vurderinger,
  onApne,
  onEndret,
}: {
  okt: Okt;
  fag: FagIAr[];
  periode: Periode | null;
  vurderinger: OktVurdering[];
  onApne: () => void;
  onEndret: () => void;
}) {
  // Flytt og Dupliser spør etter en dato i panelet, uten dialogvindu.
  const [handling, setHandling] = useState<"flytt" | "dupliser" | null>(null);
  const [dato, setDato] = useState(okt.dato);
  useEffect(() => {
    setHandling(null);
    setDato(okt.dato);
  }, [okt.id, okt.dato]);

  const slutt = okt.klokkeslett
    ? leggTilMinutter(okt.klokkeslett, okt.varighetMin)
    : null;

  async function utfor() {
    if (!dato) return;
    if (handling === "flytt") {
      await endreOkt(okt.id, { dato });
    } else if (handling === "dupliser") {
      const f = fag.find((x) => x.id === okt.skolearFagId);
      if (!f) return;
      const ny = await dupliserOkt(okt, f.fagkode, dato);
      if (okt.periodeId) await fargelegg([ny], okt.periodeId);
    }
    setHandling(null);
    onEndret();
  }

  return (
    <section>
      <div className="grid grid-cols-[12px_minmax(0,1fr)] items-baseline gap-x-2">
        <Fagfirkant farge={okt.farge} storrelse={12} klasse="self-center" />
        <h3 className="truncate text-tittel font-medium">
          {okt.tema || okt.fagNavn}
        </h3>
        <span />
        <p className="text-liten text-blekk-dempet">
          {okt.fagKode} · {okt.fagNavn}
        </p>
      </div>

      <dl className="mt-3 grid grid-cols-[4.5rem_minmax(0,1fr)] gap-y-1 text-brod">
        <dt className="text-blekk-dempet">Dato</dt>
        <dd>{langDato(okt.dato)}</dd>
        <dt className="text-blekk-dempet">Tid</dt>
        <dd className="tabular-nums">
          {okt.klokkeslett ? `${okt.klokkeslett}–${slutt}` : "uten klokkeslett"}
        </dd>
        <dt className="text-blekk-dempet">Rom</dt>
        <dd>{okt.sted ?? "–"}</dd>
        <dt className="text-blekk-dempet">Periode</dt>
        <dd className="min-w-0">
          {periode ? (
            <Periodemerke navn={periode.navn} farge={periode.farge} />
          ) : (
            "–"
          )}
        </dd>
        <dt className="text-blekk-dempet">Vurdering</dt>
        <dd>
          {vurderinger.length > 0
            ? vurderinger.map((v) => v.tittel).join(", ")
            : "–"}
        </dd>
      </dl>

      <div className="mt-3 flex flex-wrap gap-2">
        <Knapp variant="primar" onClick={onApne}>
          Åpne
        </Knapp>
        <Knapp
          onClick={() => setHandling(handling === "flytt" ? null : "flytt")}
        >
          Flytt
        </Knapp>
        <Knapp
          onClick={() =>
            setHandling(handling === "dupliser" ? null : "dupliser")
          }
        >
          Dupliser
        </Knapp>
      </div>

      {handling && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="date"
            autoFocus
            value={dato}
            onChange={(e) => setDato(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void utfor();
              if (e.key === "Escape") setHandling(null);
            }}
            className="h-[2.2em] rounded-vanlig border border-linje bg-ark px-2 text-brod tabular-nums outline-none focus:border-aksent"
          />
          <Knapp variant="primar" onClick={() => void utfor()}>
            {handling === "flytt" ? "Flytt" : "Lag kopi"}
          </Knapp>
        </div>
      )}
    </section>
  );
}

function leggTilMinutter(kl: string, min: number): string {
  const [t, m] = kl.split(":").map(Number);
  const tot = t * 60 + m + min;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(tot / 60) % 24)}:${p(tot % 60)}`;
}

function timerTekst(t: number): string {
  return `${(Math.round(t * 10) / 10).toLocaleString("nb-NO")} t`;
}

function langDato(dato: string): string {
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
}

function isoIDag(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
