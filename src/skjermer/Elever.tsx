import { useEffect, useMemo, useRef, useState } from "react";
import { Elevfoto } from "../ui/Elevfoto";
import { confirm as bekreft } from "@tauri-apps/plugin-dialog";
import { lyttElever } from "../data/endringer";
import {
  finnEllerOpprettKlasse,
  giKlasseNyttNavn,
  hentElever,
  hentKlasser,
  koblePaFag,
  opprettElev,
  slettKlasse,
  type ElevRad,
  type Klasse,
} from "../data/elever";
import type { FagIAr } from "../data/fag";
import { hentInnstilling, settInnstilling } from "../data/skolear";
import { delNavn } from "../import/parser";
import {
  Bryter,
  Fagfirkant,
  Felt,
  Knapp,
  Kontekstmeny,
  Menylinje,
  Menyvalg,
  Tomtilstand,
} from "../ui/felles";
import { hentForfalte } from "../data/elevnotat";
import { useArk } from "../ui/Arkstabel";
import { IVerktoylinja } from "../ui/Verktoylinje";
import { Hovermarkor } from "../ui/Hovermarkor";
import {
  fravaer,
  GRENSE,
  glipper,
  hentFravaersgrunnlag,
  hentOktrader,
  hoyesteFravaer,
  prosent,
  sisteRuter,
  timer,
  type Fagfravaer,
  type Oktrad,
  type Rute,
} from "../data/oktrader";

type Gruppering = "klasse" | "fag" | "alfabetisk";
const GRUPPERING = "elev_gruppering";

/**
 * Elever — alle elever i året, SPEC §4.3, som lerretet «Elever» (11.1).
 *
 * En rolig liste å lese, ikke et regneark: bilde, navn, klasse, fag,
 * innsatsen de siste ti øktene og fraværet mot 10 %-grensen. Gruppert på
 * klasse, fag eller alfabetisk. Klikk åpner elevkortet, og det er der eleven
 * endres — klasse, fag, mentor, kjønn, sletting.
 */
export function Elever({
  skolearId,
  fag,
  startElev = null,
  onLimInn,
}: {
  skolearId: string;
  /** Elev som skal stå åpen med en gang, f.eks. klikket fra forsiden. */
  startElev?: string | null;
  fag: FagIAr[];
  onLimInn: () => void;
}) {
  const ark = useArk();
  const [elever, setElever] = useState<ElevRad[]>([]);
  const [klasser, setKlasser] = useState<Klasse[]>([]);
  const [rader, setRader] = useState<Oktrad[]>([]);
  const [grunnlag, setGrunnlag] = useState<Map<string, number | null>>(
    new Map(),
  );
  const [fane, setFane] = useState<"elever" | "klasser">("elever");
  const [sok, setSok] = useState("");
  const [gruppering, setGruppering] = useState<Gruppering>("klasse");
  // Ett fag om gangen, «uten» = elever uten fag (§4.3).
  const [filterFag, setFilterFag] = useState<string>("");
  const [baraMentor, setBaraMentor] = useState(false);
  // Elever med et åpent, forfalt oppfølgingspunkt (§4.7). Merket sier bare
  // at noe venter — aldri hva. Lista vises i klasserommet og i møter.
  const [forfalte, setForfalte] = useState<Set<string>>(new Set());
  const [meny, setMeny] = useState<{ x: number; y: number } | null>(null);
  const [nyApen, setNyApen] = useState(false);
  const liste = useRef<HTMLDivElement>(null);

  // Kommer man hit med en elev i sikte, legger kortet seg over lista.
  useEffect(() => {
    if (startElev) ark.apneElev(startElev);
  }, [startElev]);

  async function last() {
    const [e, k, f, r, g] = await Promise.all([
      hentElever(skolearId),
      hentKlasser(skolearId),
      hentForfalte(skolearId),
      hentOktrader(skolearId),
      hentFravaersgrunnlag(skolearId),
    ]);
    setElever(e);
    setKlasser(k);
    setForfalte(f);
    setRader(r);
    setGrunnlag(g);
  }

  useEffect(() => {
    void last();
    void hentInnstilling(GRUPPERING).then((v) => {
      if (v === "klasse" || v === "fag" || v === "alfabetisk") setGruppering(v);
    });
  }, [skolearId]);

  // Endres en elev fra kortet over lista, skal lista vise det.
  useEffect(() => lyttElever(() => void last()), [skolearId]);

  function grupper(g: Gruppering) {
    setGruppering(g);
    void settInnstilling(GRUPPERING, g);
  }

  const fagEtterId = useMemo(() => new Map(fag.map((f) => [f.id, f])), [fag]);

  // Innsats, fravær og glipp per elev, regnet én gang per lasting.
  const tall = useMemo(() => {
    const iFaget =
      filterFag && filterFag !== "uten" ? new Set([filterFag]) : null;
    return new Map(
      elever.map((e) => {
        const ruter = sisteRuter(rader, e.id, iFaget);
        const alle = fravaer(rader, e.id, grunnlag);
        const fr = iFaget
          ? (alle.find((x) => x.skolearFagId === filterFag) ?? null)
          : hoyesteFravaer(alle);
        return [e.id, { ruter, fravaer: fr, glipper: glipper(ruter) }];
      }),
    );
  }, [elever, rader, grunnlag, filterFag]);

  const synlige = useMemo(() => {
    const s = sok.trim().toLocaleLowerCase("nb-NO");
    return elever
      .filter((e) => {
        if (
          filterFag === "uten"
            ? e.fagIder.length > 0
            : filterFag && !e.fagIder.includes(filterFag)
        )
          return false;
        if (baraMentor && !e.mentor) return false;
        if (
          s &&
          !`${e.fornavn} ${e.etternavn}`.toLocaleLowerCase("nb-NO").includes(s)
        )
          return false;
        return true;
      })
      .sort(
        (a, b) =>
          a.fornavn.localeCompare(b.fornavn, "nb-NO") ||
          a.etternavn.localeCompare(b.etternavn, "nb-NO"),
      );
  }, [elever, sok, filterFag, baraMentor]);

  // Gruppene i rekkefølge. Med fag står en elev under hvert fag hen har.
  const grupperte = useMemo(() => {
    if (gruppering === "alfabetisk")
      return [{ navn: null as string | null, elever: synlige }];
    const kart = new Map<string, ElevRad[]>();
    const legg = (n: string, e: ElevRad) => {
      const l = kart.get(n);
      if (l) l.push(e);
      else kart.set(n, [e]);
    };
    for (const e of synlige) {
      if (gruppering === "klasse") legg(e.klasseNavn ?? "", e);
      else if (e.fagIder.length === 0) legg("", e);
      else
        for (const id of e.fagIder)
          if (!filterFag || filterFag === id)
            legg(fagEtterId.get(id)?.kode ?? "", e);
    }
    return [...kart.entries()]
      .sort(([a], [b]) =>
        a === "" ? 1 : b === "" ? -1 : a.localeCompare(b, "nb-NO"),
      )
      .map(([navn, elever]) => ({
        navn: navn || (gruppering === "klasse" ? "Uten klasse" : "Uten fag"),
        elever,
      }));
  }, [synlige, gruppering, fagEtterId, filterFag]);

  const trengerOppfolging = synlige.filter(
    (e) => tall.get(e.id)?.glipper || forfalte.has(e.id),
  ).length;
  const utenFag = elever.filter((e) => e.fagIder.length === 0).length;

  // Kortet blar gjennom lista slik den står — gruppert og filtrert.
  function apneElev(id: string) {
    const rekke = [
      ...new Set(grupperte.flatMap((g) => g.elever.map((e) => e.id))),
    ];
    ark.apneElev(id, {
      liste: rekke,
      startFag: filterFag && filterFag !== "uten" ? filterFag : undefined,
    });
  }

  if (fane === "klasser") {
    return (
      <Klasser
        skolearId={skolearId}
        klasser={klasser}
        onEndret={last}
        onTilbake={() => setFane("elever")}
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-clip">
      <IVerktoylinja>
        <label className="ml-1 flex h-[30px] w-56 shrink-0 items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--color-blekk)_5%,transparent)] px-3 text-liten text-blekk-dempet focus-within:bg-ark/80">
          <IkonSok />
          <input
            value={sok}
            onChange={(e) => setSok(e.target.value)}
            placeholder="Søk etter navn"
            className="uten-fokusring min-w-0 flex-1 bg-transparent text-blekk outline-none placeholder:text-blekk-svak"
          />
        </label>
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          <button
            aria-label="Mer"
            title="Klasser"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setMeny(meny ? null : { x: r.right - 220, y: r.bottom + 6 });
            }}
            className="grid h-8 w-8 place-items-center rounded-full text-blekk-dempet hover:bg-[var(--glass-valgt)]"
          >
            ⋯
          </button>
          <button
            onClick={onLimInn}
            className="flex h-8 items-center rounded-full px-3 text-liten text-blekk-dempet hover:text-blekk"
          >
            Lim inn liste
          </button>
          <span className="relative">
            <button
              onClick={() => setNyApen((a) => !a)}
              className="flex h-8 items-center rounded-full bg-aksent px-3.5 text-liten font-medium text-ark hover:bg-aksent-mork"
            >
              Ny elev
            </button>
            {nyApen && (
              <NyElev
                arvFag={filterFag && filterFag !== "uten" ? filterFag : null}
                onLukk={() => setNyApen(false)}
                onLaget={async (id) => {
                  setNyApen(false);
                  await last();
                  ark.apneElev(id);
                }}
              />
            )}
          </span>
        </span>
      </IVerktoylinja>

      {meny && (
        <Kontekstmeny x={meny.x} y={meny.y} onLukk={() => setMeny(null)}>
          <Menyvalg onKlikk={() => setFane("klasser")}>
            <Menylinje under="Gi nytt navn, opprett eller slett">
              Klasser ({klasser.length})
            </Menylinje>
          </Menyvalg>
        </Kontekstmeny>
      )}

      {elever.length === 0 ? (
        <Tomtilstand
          tekst="Ingen elever i dette skoleåret ennå."
          handling={
            <Knapp variant="primar" onClick={onLimInn}>
              Lim inn en klasseliste
            </Knapp>
          }
        />
      ) : (
        <>
          {/* Gruppering og filtre blir stående mens lista ruller. */}
          <div className="flex shrink-0 flex-wrap items-center gap-2.5 px-2 pt-1">
            <Bryter
              storrelse="liten"
              verdi={gruppering}
              settVerdi={(v) => grupper(v as Gruppering)}
              valg={[
                { id: "klasse", navn: "Klasse" },
                { id: "fag", navn: "Fag" },
                { id: "alfabetisk", navn: "Alfabetisk" },
              ]}
            />
            <span className="mx-1 h-5 w-px bg-linje-medium" />
            <Pille pa={filterFag === ""} mork onKlikk={() => setFilterFag("")}>
              Alle fag
            </Pille>
            {fag.map((f) => (
              <Pille
                key={f.id}
                pa={filterFag === f.id}
                onKlikk={() => setFilterFag(filterFag === f.id ? "" : f.id)}
              >
                <Fagfirkant farge={f.farge} />
                {f.kode}
              </Pille>
            ))}
            {utenFag > 0 && (
              <Pille
                pa={filterFag === "uten"}
                onKlikk={() => setFilterFag(filterFag === "uten" ? "" : "uten")}
              >
                Uten fag <span className="text-blekk-svak">{utenFag}</span>
              </Pille>
            )}
            <Pille
              omriss
              pa={baraMentor}
              onKlikk={() => setBaraMentor((m) => !m)}
            >
              Mentorelever
            </Pille>
            <span className="grow" />
            <span className="text-[calc(12.5px*var(--tekst-skala))] tabular-nums text-blekk-dempet">
              {synlige.length} {synlige.length === 1 ? "elev" : "elever"}
              {trengerOppfolging > 0 && (
                <>
                  {" · "}
                  <span className="text-feil">
                    {trengerOppfolging} trenger oppfølging
                  </span>
                </>
              )}
            </span>
          </div>

          <div
            className={`${RUTENETT} mt-4 shrink-0 border-b border-linje-medium px-2.5 pb-2 text-[calc(11.5px*var(--tekst-skala))] text-blekk-dempet`}
          >
            <span />
            <span>Navn</span>
            <span>Klasse</span>
            <span>Fag</span>
            <span>Innsats, siste 10</span>
            <span title="Prosent av timene i faget. Grensen er 10 %.">
              Fravær · 10 %
            </span>
            <span />
          </div>

          <div className="min-h-0 flex-1 overflow-auto pb-6">
            <div ref={liste} className="relative">
              {/* Hover glir fra rad til rad (10.3). */}
              <Hovermarkor
                beholder={liste}
                klasse="hovermarkor-rad rounded-[10px]"
              />
              {synlige.length === 0 && (
                <p className="px-2.5 py-6 text-brod text-blekk-svak">
                  Ingen elever passer med filteret.
                </p>
              )}
              {grupperte.map((g) => (
                <div key={g.navn ?? "alle"}>
                  {g.navn !== null && (
                    <div className="flex h-[38px] items-baseline gap-2 px-2.5 pt-3 text-[calc(13px*var(--tekst-skala))]">
                      <b className="font-semibold">{g.navn}</b>
                      <span className="text-blekk-svak">
                        {g.elever.length}{" "}
                        {g.elever.length === 1 ? "elev" : "elever"}
                      </span>
                    </div>
                  )}
                  {g.elever.map((e) => (
                    <Elevlinje
                      key={e.id}
                      elev={e}
                      fag={fagEtterId}
                      ruter={tall.get(e.id)?.ruter ?? []}
                      fravaer={tall.get(e.id)?.fravaer ?? null}
                      glipper={tall.get(e.id)?.glipper ?? false}
                      forfalt={forfalte.has(e.id)}
                      onApne={() => apneElev(e.id)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Kolonnene i lista, felles for hode og rader (lerretet «Elever»). */
const RUTENETT =
  "grid grid-cols-[30px_minmax(0,1.6fr)_54px_minmax(0,1.3fr)_150px_96px_40px] items-center gap-x-4";

function Pille({
  pa,
  mork = false,
  omriss = false,
  onKlikk,
  children,
}: {
  pa: boolean;
  /** «Alle fag»: mørk når den er valgt */
  mork?: boolean;
  /** Mentorelever: omriss når den ikke er valgt */
  omriss?: boolean;
  onKlikk: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onKlikk}
      aria-pressed={pa}
      className={`inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 text-[calc(12px*var(--tekst-skala))] ${
        pa
          ? mork
            ? "bg-blekk text-ark"
            : "bg-valgt font-medium text-blekk shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-aksent)_35%,transparent)]"
          : omriss
            ? "text-blekk shadow-[inset_0_0_0_1px_var(--color-linje-sterk)] hover:bg-flate-svak"
            : "bg-[color-mix(in_srgb,var(--color-aksent)_6%,var(--color-ark))] text-blekk hover:bg-flate"
      }`}
    >
      {children}
    </button>
  );
}

const RUTEFARGE: Record<Rute, string> = {
  g: "var(--color-lys-gronn)",
  y: "var(--color-lys-gul)",
  r: "var(--color-lys-rod)",
  o: "var(--color-lys-borte)",
  n: "var(--color-linje-sterk)",
};
const RUTENAVN: Record<Rute, string> = {
  g: "grønn",
  y: "gul",
  r: "rød",
  o: "ikke i økta",
  n: "skåret",
};

function Elevlinje({
  elev,
  fag,
  ruter,
  fravaer,
  glipper,
  forfalt,
  onApne,
}: {
  elev: ElevRad;
  fag: Map<string, FagIAr>;
  ruter: Rute[];
  fravaer: Fagfravaer | null;
  glipper: boolean;
  forfalt: boolean;
  onApne: () => void;
}) {
  const navn = `${elev.fornavn} ${elev.etternavn}`;
  return (
    <div
      role="button"
      tabIndex={0}
      data-hover
      onClick={onApne}
      onKeyDown={(e) => e.key === "Enter" && onApne()}
      className={`${RUTENETT} relative z-[1] h-[46px] cursor-default border-b border-linje-svak px-2.5 text-[calc(14px*var(--tekst-skala))]`}
    >
      <Elevfoto elevId={elev.id} storrelse={30} navn={navn} />
      <span className="flex min-w-0 items-center gap-2" title={navn}>
        <span className="truncate">
          <span className="font-medium">{elev.fornavn}</span>{" "}
          <span className="text-blekk-dempet">{elev.etternavn}</span>
        </span>
        {elev.mentor && (
          <span
            title="Mentorelev"
            className="inline-flex h-[18px] shrink-0 items-center rounded-[9px] bg-[color-mix(in_srgb,var(--color-aksent)_8%,var(--color-ark))] px-1.5 text-[10.5px] font-semibold tracking-[0.02em] text-aksent"
          >
            M
          </span>
        )}
      </span>
      <span className="text-[calc(13px*var(--tekst-skala))] tabular-nums text-blekk-dempet">
        {elev.klasseNavn ?? ""}
      </span>
      <span className="flex min-w-0 gap-2.5 overflow-hidden text-[calc(12.5px*var(--tekst-skala))] text-blekk-dempet">
        {elev.fagIder.map((id) => {
          const f = fag.get(id);
          return f ? (
            <span
              key={id}
              className="inline-flex shrink-0 items-center gap-[5px]"
            >
              <Fagfirkant farge={f.farge} />
              {f.kode}
            </span>
          ) : null;
        })}
      </span>
      <span className="flex gap-[2px]">
        {ruter.length === 0 ? (
          <span className="text-blekk-svakest">—</span>
        ) : (
          ruter.map((r, i) => (
            <span
              key={i}
              title={RUTENAVN[r]}
              className="h-[11px] w-[11px] rounded-[2px]"
              style={{ background: RUTEFARGE[r] }}
            />
          ))
        )}
      </span>
      <Fravaersstolpe fravaer={fravaer} />
      <span className="flex justify-end">
        {glipper ? (
          <span
            title="Glipper: mange røde siste økter"
            className="h-2 w-2 rounded-full bg-lys-rod"
          />
        ) : forfalt ? (
          <span
            title="Et oppfølgingspunkt venter"
            className="h-2 w-2 rounded-full shadow-[inset_0_0_0_1.5px_var(--color-lys-rod)]"
          />
        ) : null}
      </span>
    </div>
  );
}

/**
 * Fraværet i prosent av fagets timer, med en liten stolpe mot 10 %
 * (11.1, 11.7): grå under 7,5 %, gul fra 7,5 %, rød over 10 %.
 */
function Fravaersstolpe({ fravaer }: { fravaer: Fagfravaer | null }) {
  if (!fravaer || fravaer.andel === null || fravaer.borteMin === 0)
    return <span className="pl-[42px] text-blekk-svakest">—</span>;
  const p = fravaer.andel;
  const farge =
    p > GRENSE
      ? "var(--color-lys-rod)"
      : p >= 0.075
        ? "var(--color-lys-gul)"
        : "var(--color-blekk-svak)";
  const tillatt = (fravaer.grunnlagMin ?? 0) * GRENSE;
  return (
    <span
      className="flex items-center gap-2"
      title={`${timer(fravaer.borteMin)} av ${timer(tillatt)} tillatt (10 % av ${timer(fravaer.grunnlagMin ?? 0)}). InSchool er fasit.`}
    >
      <span className="relative h-[5px] w-[34px] rounded-[3px] bg-flate">
        <span
          className="absolute inset-y-0 left-0 rounded-[3px]"
          style={{
            width: `${Math.min(100, (p / GRENSE) * 100)}%`,
            background: farge,
          }}
        />
      </span>
      <span
        className={`text-[calc(12.5px*var(--tekst-skala))] tabular-nums ${p > GRENSE ? "font-semibold" : ""}`}
        style={{ color: farge }}
      >
        {prosent(p)}
      </span>
    </span>
  );
}

/**
 * Ny elev fra verktøylinja: ett felt, «Fornavn Etternavn», Enter. Faget i
 * filteret arves (§4.3). Eleven åpnes i kortet etterpå, der klasse og
 * resten settes.
 */
function NyElev({
  arvFag,
  onLukk,
  onLaget,
}: {
  arvFag: string | null;
  onLukk: () => void;
  onLaget: (id: string) => void;
}) {
  const [navn, setNavn] = useState("");
  const [feil, setFeil] = useState<string | null>(null);
  const boks = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ute = (e: MouseEvent) => {
      if (!boks.current?.contains(e.target as Node)) onLukk();
    };
    window.addEventListener("mousedown", ute);
    return () => window.removeEventListener("mousedown", ute);
  }, [onLukk]);

  async function lag() {
    const { fornavn, etternavn } = delNavn(navn.trim());
    if (!fornavn || !etternavn) {
      setFeil("Skriv fornavn og etternavn.");
      return;
    }
    try {
      const id = await opprettElev(fornavn, etternavn);
      if (arvFag) await koblePaFag(id, arvFag);
      onLaget(id);
    } catch (e) {
      setFeil(`Kunne ikke opprette eleven: ${String(e)}`);
    }
  }

  return (
    <div
      ref={boks}
      className="glass-meny absolute right-0 top-10 z-50 w-72 rounded-[14px] p-3"
    >
      <input
        autoFocus
        value={navn}
        onChange={(e) => {
          setNavn(e.target.value);
          setFeil(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") void lag();
          if (e.key === "Escape") onLukk();
        }}
        placeholder="Fornavn Etternavn"
        className="w-full rounded-vanlig border border-linje bg-ark px-2 py-1.5 text-brod outline-none focus:border-aksent"
      />
      <p
        className={`mt-1.5 text-etikett ${feil ? "text-feil" : "text-blekk-dempet"}`}
      >
        {feil ?? "Enter lagrer og åpner eleven. Klasse og fag settes i kortet."}
      </p>
    </div>
  );
}

function IkonSok() {
  return (
    <svg
      aria-hidden
      width="13"
      height="13"
      viewBox="0 0 16 16"
      className="shrink-0"
    >
      <circle
        cx="7"
        cy="7"
        r="4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function Klasser({
  skolearId,
  klasser,
  onEndret,
  onTilbake,
}: {
  skolearId: string;
  klasser: Klasse[];
  onEndret: () => void;
  onTilbake: () => void;
}) {
  const [nyttNavn, setNyttNavn] = useState("");

  return (
    <div className="max-w-lg">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-tittel font-medium">Klasser</h2>
        <Knapp variant="stille" onClick={onTilbake}>
          Tilbake til elevene
        </Knapp>
      </div>

      {klasser.length === 0 ? (
        <Tomtilstand tekst="Ingen klasser ennå. De opprettes når du limer inn en liste." />
      ) : (
        <table className="w-full text-brod">
          <tbody>
            {klasser.map((k) => (
              <tr key={k.id} className="border-b border-linje-svak">
                <td className="py-1.5">
                  <input
                    defaultValue={k.navn}
                    onBlur={async (e) => {
                      const navn = e.target.value.trim();
                      if (navn && navn !== k.navn) {
                        await giKlasseNyttNavn(k.id, navn);
                        onEndret();
                      }
                    }}
                    className="rounded-vanlig border border-transparent px-1 py-0.5 hover:border-linje focus:border-aksent focus:outline-none"
                  />
                </td>
                <td className="w-24 py-1.5 text-right tabular-nums text-blekk-dempet">
                  {k.antall} elever
                </td>
                <td className="w-20 py-1.5 text-right">
                  <button
                    onClick={async () => {
                      const svar = await bekreft(
                        k.antall > 0
                          ? `${k.navn} har ${k.antall} elever. De blir stående uten klasse — ingen elever slettes. Slette klassen?`
                          : `Slette ${k.navn}?`,
                      );
                      if (!svar) return;
                      await slettKlasse(k.id);
                      onEndret();
                    }}
                    className="text-liten text-blekk-svak hover:text-feil"
                  >
                    Slett
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-4 flex items-end gap-2">
        <Felt
          etikett="Ny klasse"
          verdi={nyttNavn}
          settVerdi={setNyttNavn}
          plassholder="1STC"
          bredde="w-40"
          onEnter={async () => {
            if (!nyttNavn.trim()) return;
            await finnEllerOpprettKlasse(skolearId, nyttNavn.trim());
            setNyttNavn("");
            onEndret();
          }}
        />
        <Knapp
          onClick={async () => {
            if (!nyttNavn.trim()) return;
            await finnEllerOpprettKlasse(skolearId, nyttNavn.trim());
            setNyttNavn("");
            onEndret();
          }}
        >
          Opprett
        </Knapp>
      </div>
    </div>
  );
}
