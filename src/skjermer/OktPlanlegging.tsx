import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { confirm as bekreft } from "@tauri-apps/plugin-dialog";
import {
  endreOkt,
  hentForrigeOkt,
  hentOktElever,
  slettOkt,
  teamstekst,
  type Okt,
  type OktElev,
} from "../data/okter";
import {
  fargelegg,
  hentOktmal,
  hentPerioder,
  settOktmal,
  type Oktmal,
  type Periode,
} from "../data/perioder";
import { finnFag, type Kompetansemaal } from "../data/grep";
import {
  hentVurderingsvalg,
  knyttOkt,
  losOkt,
  type Vurderingsvalg,
} from "../data/vurderinger";
import { hentOktrader, type Oktrad } from "../data/oktrader";
import { hentApneOppfolginger } from "../data/elevnotat";
import {
  folgOpp,
  iPerioden,
  lesPlan,
  plansum,
  skrivPlan,
  type Oppfolging,
  type Planpunkt,
} from "../data/oktplan";
import { kortDag } from "../data/fagside";
import { lyttVurderinger } from "../data/endringer";
import { useArk } from "../ui/Arkstabel";
import { Markdown } from "../ui/Notattekst";
import { Tastestripe, Tasthint } from "../ui/Tastestripe";
import { tast } from "../ui/taster";

/**
 * Økta i planlegging (ARBEIDSLISTE 11.5, lerretet «OktPlan»).
 *
 * Venstre: fakta (dato, tid, rom, periode, vurdering), lekse og agenda til
 * elevene, planen som en sjekkliste med minutter mot øktas lengde, og
 * kompetansemålene i økta. Høyre: fra forrige økt, hvem som bør følges opp,
 * og hvor i perioden økta ligger. Alt lagres når feltet forlates.
 */
export function OktPlanlegging({
  okt,
  skolearId,
  fagOkter,
  periode,
  onEndret,
  onLukk,
  onVisIOkter,
}: {
  okt: Okt;
  skolearId: string;
  fagOkter: Okt[];
  periode: Periode | null;
  onEndret: () => void;
  onLukk: () => void;
  onVisIOkter: () => void;
}) {
  async function lagre(felt: Parameters<typeof endreOkt>[1]) {
    await endreOkt(okt.id, felt);
    onEndret();
  }

  return (
    <>
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto px-[26px] pb-6 pt-[18px]">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-7">
            <Fakta okt={okt} periode={periode} onLagre={lagre} />
            <div className="flex flex-col gap-3.5">
              <Tekstfelt
                etikett="Lekse"
                hint="står på årsplanen ved denne økta"
                verdi={okt.lekse}
                plassholder="Hva elevene skal ha gjort"
                onLagre={(v) => lagre({ lekse: v })}
              />
              <div>
                <Tekstfelt
                  etikett="Agenda til elevene"
                  hint="går ut i kalenderen elevene abonnerer på"
                  verdi={okt.agenda}
                  plassholder="Repetisjon · Case i grupper · Exit-lapp"
                  onLagre={(v) => lagre({ agenda: v })}
                />
                <Kopier okt={okt} />
              </div>
            </div>
          </div>

          <Plan okt={okt} onLagre={(plan) => lagre({ plan })} />
          <Mal okt={okt} periode={periode} />

          <div className="mt-6 flex gap-4">
            <button
              onClick={onVisIOkter}
              className="text-liten text-blekk-dempet hover:text-blekk"
            >
              Vis i <i>Økter</i> →
            </button>
            <button
              onClick={async () => {
                if (
                  !(await bekreft(
                    `Slette økta ${okt.fagKode} ${kortDag(okt.dato)}?`,
                  ))
                )
                  return;
                await slettOkt(okt.id);
                onEndret();
                onLukk();
              }}
              className="text-liten text-blekk-svak hover:text-feil"
            >
              Slett økta
            </button>
          </div>
        </div>

        <aside className="flex w-[300px] shrink-0 flex-col gap-[22px] overflow-auto border-l border-linje-medium bg-flate-svak/70 px-[22px] py-[18px]">
          <Forrige okt={okt} />
          <FolgOpp okt={okt} skolearId={skolearId} />
          <Perioden okt={okt} periode={periode} fagOkter={fagOkter} />
        </aside>
      </div>

      <Tastestripe klasse="shrink-0 justify-start gap-4 px-[22px]">
        <Tasthint taster={[tast("⌘"), "←", "→"]}>forrige / neste økt</Tasthint>
        <Tasthint taster={["⇥"]}>neste felt</Tasthint>
        <span className="ml-auto">
          <Tasthint taster={["esc"]}>lukk, alt er lagret</Tasthint>
        </span>
      </Tastestripe>
    </>
  );
}

// ------------------------------------------------------------------- fakta

function Fakta({
  okt,
  periode,
  onLagre,
}: {
  okt: Okt;
  periode: Periode | null;
  onLagre: (felt: Parameters<typeof endreOkt>[1]) => Promise<void>;
}) {
  const [perioder, setPerioder] = useState<Periode[]>([]);
  useEffect(() => {
    void hentPerioder(okt.skolearFagId).then(setPerioder);
  }, [okt.skolearFagId]);
  const slutt = okt.klokkeslett
    ? sluttKlokke(okt.klokkeslett, okt.varighetMin)
    : "";

  return (
    <div>
      <Rad etikett="Dato">
        <input
          type="date"
          defaultValue={okt.dato}
          key={okt.dato}
          onBlur={(e) =>
            e.target.value &&
            e.target.value !== okt.dato &&
            void onLagre({ dato: e.target.value })
          }
          className={stille}
        />
      </Rad>
      <Rad etikett="Tid">
        <span className="flex items-center gap-1 tabular-nums">
          <input
            type="time"
            defaultValue={okt.klokkeslett ?? ""}
            key={`s${okt.klokkeslett}`}
            onBlur={(e) =>
              void onLagre({ klokkeslett: e.target.value || null })
            }
            className={`${stille} w-[58px]`}
          />
          –
          <input
            type="time"
            defaultValue={slutt}
            key={`e${slutt}`}
            disabled={!okt.klokkeslett}
            onBlur={(e) => {
              if (!okt.klokkeslett || !e.target.value) return;
              const min = tilMin(e.target.value) - tilMin(okt.klokkeslett);
              if (min > 0 && min !== okt.varighetMin)
                void onLagre({ varighet_min: min });
            }}
            className={`${stille} w-[58px]`}
          />
          <span className="text-blekk-svak">· {timer(okt.varighetMin)}</span>
        </span>
      </Rad>
      <Rad etikett="Rom">
        <input
          defaultValue={okt.sted ?? ""}
          key={okt.sted ?? ""}
          placeholder="–"
          onBlur={(e) => void onLagre({ sted: e.target.value.trim() || null })}
          className={stille}
        />
      </Rad>
      <Rad etikett="Periode">
        <span className="relative inline-flex h-6 items-center gap-1.5 rounded-xl bg-[color-mix(in_srgb,var(--color-aksent)_7%,var(--color-ark))] pl-2 pr-1.5 text-[calc(12.5px*var(--tekst-skala))]">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: periode?.farge ?? "var(--color-linje-sterk)" }}
          />
          {periode?.navn ?? "Ingen"} ▾
          <select
            aria-label="Periode"
            value={okt.periodeId ?? ""}
            onChange={async (e) => {
              await fargelegg([okt.id], e.target.value || null);
              void onLagre({});
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            <option value="">Ingen periode</option>
            {perioder.map((p) => (
              <option key={p.id} value={p.id}>
                {p.navn}
              </option>
            ))}
          </select>
        </span>
      </Rad>
      <Rad etikett="Vurdering">
        <Vurdering okt={okt} onEndret={() => void onLagre({})} />
      </Rad>
    </div>
  );
}

function Vurdering({ okt, onEndret }: { okt: Okt; onEndret: () => void }) {
  const [valg, setValg] = useState<Vurderingsvalg[]>([]);
  const ark = useArk();
  const last = () => void hentVurderingsvalg(okt.skolearFagId).then(setValg);
  useEffect(last, [okt.skolearFagId, okt.id]);
  useEffect(() => lyttVurderinger(last), [okt.skolearFagId, okt.id]);
  const her = valg.filter((v) => v.oktIder.includes(okt.id));
  const andre = valg.filter((v) => !v.oktIder.includes(okt.id));

  async function koble(id: string, pa: boolean) {
    if (pa) await knyttOkt(id, okt.id);
    else await losOkt(id, okt.id);
    last();
    onEndret();
  }

  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-1.5">
      {her.length === 0 && <span className="text-blekk-svak">Ingen</span>}
      {her.map((v) => (
        <span key={v.id} className="inline-flex items-center gap-1">
          <button
            onClick={() => ark.apneVurdering(v.id)}
            className="truncate hover:underline"
          >
            {v.tittel}
          </button>
          <button
            onClick={() => void koble(v.id, false)}
            title="Løs fra økta"
            className="text-blekk-svak hover:text-blekk"
          >
            ×
          </button>
        </span>
      ))}
      {andre.length > 0 && (
        <span className="relative text-aksent">
          · + Knytt til vurdering
          <select
            aria-label="Knytt til vurdering"
            value=""
            onChange={(e) => e.target.value && void koble(e.target.value, true)}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            <option value="">Knytt til …</option>
            {andre.map((v) => (
              <option key={v.id} value={v.id}>
                {v.tittel}
              </option>
            ))}
          </select>
        </span>
      )}
    </span>
  );
}

function Kopier({ okt }: { okt: Okt }) {
  const [kopiert, setKopiert] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(teamstekst(okt));
        setKopiert(true);
        setTimeout(() => setKopiert(false), 1500);
      }}
      className="mt-1 text-[calc(12px*var(--tekst-skala))] text-blekk-svak hover:text-blekk"
    >
      {kopiert ? "Kopiert" : "Kopier til Teams"}
    </button>
  );
}

// -------------------------------------------------------------------- plan

/**
 * Planen som sjekkliste (11.5): avkrysning, tekst og minutter per punkt,
 * summen mot øktas lengde, og dra for å flytte. Lagres som markdown i
 * `okt.plan`, så den samme lista vises med avkrysning i skåringen.
 */
function Plan({
  okt,
  onLagre,
}: {
  okt: Okt;
  onLagre: (plan: string | null) => Promise<void>;
}) {
  const start = useMemo(() => lesPlan(okt.plan), [okt.plan]);
  const [punkter, setPunkter] = useState<Planpunkt[]>(start.punkter);
  const [dras, setDras] = useState<number | null>(null);
  const nyttFelt = useRef<HTMLInputElement>(null);
  const [fokusNy, setFokusNy] = useState(false);
  useEffect(() => setPunkter(start.punkter), [start]);
  useEffect(() => {
    if (fokusNy) {
      nyttFelt.current?.focus();
      setFokusNy(false);
    }
  }, [fokusNy, punkter.length]);

  function lagre(ny: Planpunkt[]) {
    setPunkter(ny);
    void onLagre(
      skrivPlan(
        ny.filter((p) => p.tekst.trim()),
        start.rest,
      ),
    );
  }
  const endre = (i: number, d: Partial<Planpunkt>) =>
    punkter.map((p, j) => (j === i ? { ...p, ...d } : p));

  return (
    <section className="mt-6">
      <div className="mb-1.5 flex items-baseline gap-2 border-b border-linje-medium pb-1.5">
        <h2 className="text-[calc(13px*var(--tekst-skala))] font-semibold">
          Plan
        </h2>
        <span className="text-[calc(12px*var(--tekst-skala))] text-blekk-svak">
          bare for deg · {plansum(punkter, okt.varighetMin)}
        </span>
        <button
          onClick={() => {
            setPunkter([...punkter, { gjort: false, tekst: "", min: null }]);
            setFokusNy(true);
          }}
          className="ml-auto text-[calc(12.5px*var(--tekst-skala))] text-aksent hover:underline"
        >
          + Nytt punkt
        </button>
      </div>
      {punkter.length === 0 && (
        <p className="py-2 text-[calc(13px*var(--tekst-skala))] text-blekk-svak">
          Ingen plan ennå. Legg til punktene du skal gjennom, med minutter.
        </p>
      )}
      {punkter.map((p, i) => (
        <div
          key={i}
          draggable
          onDragStart={() => setDras(i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dras === null || dras === i) return;
            const ny = [...punkter];
            const [flyttet] = ny.splice(dras, 1);
            ny.splice(i, 0, flyttet);
            setDras(null);
            lagre(ny);
          }}
          onDragEnd={() => setDras(null)}
          className={`group flex h-[29px] items-center gap-2.5 text-[calc(13.5px*var(--tekst-skala))] ${dras === i ? "opacity-40" : ""}`}
        >
          <span
            aria-hidden
            title="Dra for å flytte"
            className="cursor-grab select-none text-[11px] leading-none tracking-[-2px] text-blekk-svakest"
          >
            ⋮⋮
          </span>
          <input
            type="checkbox"
            checked={p.gjort}
            onChange={(e) => lagre(endre(i, { gjort: e.target.checked }))}
          />
          <input
            ref={i === punkter.length - 1 ? nyttFelt : undefined}
            defaultValue={p.tekst}
            key={`${i}-${p.tekst}`}
            placeholder="Hva skal skje"
            onBlur={(e) =>
              e.target.value !== p.tekst &&
              lagre(endre(i, { tekst: e.target.value }))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className={`min-w-0 flex-1 bg-transparent outline-none ${p.gjort ? "text-blekk-svak line-through" : ""}`}
          />
          <span className="flex shrink-0 items-center gap-1 text-[calc(12px*var(--tekst-skala))] text-blekk-svak">
            <input
              inputMode="numeric"
              defaultValue={p.min ?? ""}
              key={`m${i}-${p.min}`}
              placeholder="–"
              onBlur={(e) => {
                const n = parseInt(e.target.value, 10);
                const min = Number.isFinite(n) && n > 0 ? n : null;
                if (min !== p.min) lagre(endre(i, { min }));
              }}
              className="w-8 bg-transparent text-right tabular-nums outline-none"
            />
            min
          </span>
        </div>
      ))}
    </section>
  );
}

// ----------------------------------------------------------- kompetansemål

/**
 * Kompetansemålene i økta (11.5): fagets mål med avkrysning, periodens mål
 * merket med en prikk, og valgte mål i full farge. Fag uten Udir-kode får
 * et fritekstfelt.
 */
function Mal({ okt, periode }: { okt: Okt; periode: Periode | null }) {
  // Prikken for periodens mål har periodens farge.
  const farge = periode?.farge ?? "var(--color-aksent)";
  const [mal, setMal] = useState<Oktmal | null>(null);
  const [liste, setListe] = useState<Kompetansemaal[]>([]);
  const [laereplan, setLaereplan] = useState<string | null>(null);
  const last = () => void hentOktmal(okt.id).then(setMal);
  useEffect(last, [okt.id, okt.periodeId]);
  useEffect(() => {
    if (!mal?.grepKode) return;
    void finnFag(mal.grepKode).then((f) => {
      setListe(f?.kompetansemaal ?? []);
      setLaereplan(f?.laereplan ?? null);
    });
  }, [mal?.grepKode]);

  if (!mal) return null;

  if (!mal.grepKode)
    return (
      <section className="mt-6">
        <Tekstfelt
          etikett="Kompetansemål i økta"
          hint="faget har ingen Udir-kode"
          verdi={mal.fritekst}
          plassholder="Skriv målet her"
          onLagre={async (v) => {
            await endreOkt(okt.id, { kompetansemal: v });
            last();
          }}
        />
      </section>
    );

  const valgt = new Set(mal.egne);
  const periodens = new Set(mal.fraPeriode);
  const udir = laereplan ? `udir.no/lk20/${laereplan.toLowerCase()}` : null;

  return (
    <section className="mt-6">
      <div className="mb-1 flex items-baseline gap-2 border-b border-linje-medium pb-1.5">
        <h2 className="text-[calc(13px*var(--tekst-skala))] font-semibold">
          Kompetansemål i økta
        </h2>
        <span className="text-[calc(12px*var(--tekst-skala))] text-blekk-svak">
          {valgt.size} valgt
          {periodens.size > 0 && (
            <>
              {" · "}
              <span style={{ color: farge }}>●</span> = periodens mål
            </>
          )}
        </span>
        {udir && (
          <button
            onClick={() =>
              void import("@tauri-apps/plugin-opener").then((o) =>
                o.openUrl(`https://www.${udir}`),
              )
            }
            className="ml-auto text-[calc(12.5px*var(--tekst-skala))] text-aksent hover:underline"
          >
            {udir} →
          </button>
        )}
      </div>
      {liste.map((k, i) => {
        const pa = valgt.has(k.kode);
        const fraPeriode = periodens.has(k.kode);
        return (
          <label
            key={k.kode}
            className="grid h-7 cursor-pointer grid-cols-[18px_10px_22px_minmax(0,1fr)] items-center gap-x-2 text-[calc(13px*var(--tekst-skala))]"
          >
            <input
              type="checkbox"
              checked={pa}
              onChange={async (e) => {
                await settOktmal(okt.id, k.kode, e.target.checked);
                last();
              }}
            />
            <span className="text-[9px]" style={{ color: farge }}>
              {fraPeriode ? "●" : ""}
            </span>
            <span className="tabular-nums text-blekk-svak">{i + 1}</span>
            <span
              title={k.tekst}
              className={`truncate ${pa || fraPeriode ? "text-blekk" : "text-blekk-svak"}`}
            >
              {k.tekst}
            </span>
          </label>
        );
      })}
    </section>
  );
}

// ------------------------------------------------------------------- høyre

function Forrige({ okt }: { okt: Okt }) {
  const [forrige, setForrige] =
    useState<Awaited<ReturnType<typeof hentForrigeOkt>>>(null);
  const ark = useArk();
  useEffect(() => {
    void hentForrigeOkt(okt).then(setForrige);
  }, [okt.id, okt.dato, okt.klokkeslett]);
  if (!forrige) return null;
  return (
    <div>
      <button
        onClick={() => ark.apneOkt(forrige.id)}
        className="mb-1.5 block text-left text-[calc(13px*var(--tekst-skala))] font-semibold hover:underline"
      >
        Fra forrige økt
        <span className="font-normal text-blekk-svak">
          {" "}
          · {kortDag(forrige.dato)}
        </span>
      </button>
      {forrige.logg?.trim() ? (
        <div className="text-[calc(13.5px*var(--tekst-skala))]">
          <Markdown tekst={forrige.logg} />
        </div>
      ) : (
        <p className="text-liten text-blekk-svak">
          Du skrev ikke noe notat forrige økt.
        </p>
      )}
    </div>
  );
}

/**
 * «Følg opp i økta»: rød to ganger på rad, borte sist, eller et åpent
 * oppfølgingspunkt. Bare fornavn, og aldri hva punktet gjelder — økta kan
 * stå på skjerm i klasserommet (§4.7).
 */
function FolgOpp({ okt, skolearId }: { okt: Okt; skolearId: string }) {
  const [liste, setListe] = useState<Oppfolging[]>([]);
  const [elever, setElever] = useState<Map<string, OktElev>>(new Map());
  const ark = useArk();
  useEffect(() => {
    let avbrutt = false;
    void Promise.all([
      hentOktrader(skolearId),
      hentApneOppfolginger(skolearId),
      hentOktElever(okt.id, okt.skolearFagId),
    ]).then(([rader, apne, e]: [Oktrad[], { elevId: string }[], OktElev[]]) => {
      if (avbrutt) return;
      setListe(
        folgOpp(rader, okt, new Set(apne.map((a) => a.elevId))).slice(0, 6),
      );
      setElever(new Map(e.map((x) => [x.elevId, x])));
    });
    return () => {
      avbrutt = true;
    };
  }, [okt.id, okt.dato, okt.skolearFagId, skolearId]);

  return (
    <div>
      <h3 className="mb-1.5 text-[calc(13px*var(--tekst-skala))] font-semibold">
        Følg opp i økta
      </h3>
      {liste.length === 0 ? (
        <p className="text-liten text-blekk-svak">
          Ingen å følge opp fra forrige gang.
        </p>
      ) : (
        liste.map((o) => {
          const e = elever.get(o.elevId);
          if (!e) return null;
          return (
            <button
              key={o.elevId}
              onClick={() => ark.apneElev(o.elevId)}
              className="flex w-full items-center gap-2 py-[3px] text-left text-[calc(13px*var(--tekst-skala))] hover:underline"
            >
              <span
                className="h-[7px] w-[7px] shrink-0 rounded-full"
                style={{
                  background:
                    o.grunn === "rod"
                      ? "var(--color-lys-rod)"
                      : o.grunn === "borte"
                        ? "var(--color-lys-borte)"
                        : "var(--color-aksent)",
                }}
              />
              <span className="truncate">
                {e.fornavn}:{" "}
                {o.grunn === "rod"
                  ? "rød to ganger på rad"
                  : o.grunn === "borte"
                    ? "borte sist"
                    : "åpent oppfølgingspunkt"}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}

function Perioden({
  okt,
  periode,
  fagOkter,
}: {
  okt: Okt;
  periode: Periode | null;
  fagOkter: Okt[];
}) {
  const p = iPerioden(okt, fagOkter);
  if (!periode || !p) return null;
  const idag = new Date().toISOString().slice(0, 10);
  const farge = periode.farge ?? "var(--color-aksent)";
  return (
    <div>
      <h3 className="mb-1.5 text-[calc(13px*var(--tekst-skala))] font-semibold">
        Perioden
      </h3>
      <p className="text-[calc(13px*var(--tekst-skala))]">
        {periode.navn} · økt {p.nr} av {p.av}
      </p>
      <div className="mt-2 flex gap-[3px]">
        {p.okter.map((o) => (
          <span
            key={o.id}
            title={`${kortDag(o.dato)}${o.tema ? ` · ${o.tema}` : ""}`}
            className="h-1.5 flex-1 rounded-[2px]"
            style={{
              background:
                o.id === okt.id
                  ? "var(--color-aksent)"
                  : o.dato < idag
                    ? farge
                    : `color-mix(in srgb, ${farge} 18%, transparent)`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------- deler

function Rad({ etikett, children }: { etikett: string; children: ReactNode }) {
  return (
    <div className="grid min-h-[33px] grid-cols-[90px_minmax(0,1fr)] items-center border-b border-linje-svak text-[calc(13.5px*var(--tekst-skala))]">
      <span className="text-[calc(12.5px*var(--tekst-skala))] text-blekk-dempet">
        {etikett}
      </span>
      {children}
    </div>
  );
}

function Tekstfelt({
  etikett,
  hint,
  verdi,
  plassholder,
  onLagre,
}: {
  etikett: string;
  hint?: string;
  verdi: string | null;
  plassholder: string;
  onLagre: (v: string | null) => void | Promise<void>;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[calc(12.5px*var(--tekst-skala))] text-blekk-dempet">
        {etikett}
        {hint && <span className="text-blekk-svak"> · {hint}</span>}
      </span>
      <input
        defaultValue={verdi ?? ""}
        key={verdi ?? ""}
        placeholder={plassholder}
        onBlur={(e) => {
          const v = e.target.value.trim() || null;
          if (v !== verdi) void onLagre(v);
        }}
        className="w-full rounded-[8px] border border-linje bg-ark px-2.5 py-1.5 text-[calc(13.5px*var(--tekst-skala))] outline-none placeholder:text-blekk-svak focus:border-aksent"
      />
    </label>
  );
}

const stille =
  "min-w-0 bg-transparent py-1 outline-none focus:text-aksent disabled:text-blekk-svak";

function tilMin(kl: string): number {
  const [t, m] = kl.split(":").map(Number);
  return t * 60 + m;
}

function sluttKlokke(kl: string, min: number): string {
  const tot = tilMin(kl) + min;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(tot / 60) % 24)}:${p(tot % 60)}`;
}

function timer(min: number): string {
  return min % 60 === 0
    ? `${min / 60} t`
    : `${String(Math.round((min / 60) * 10) / 10).replace(".", ",")} t`;
}
