import { useEffect, useMemo, useState } from "react";
import {
  hentOkter,
  hentOktVurderinger,
  opprettOkt,
  type Okt,
  type OktVurdering,
} from "../data/okter";
import {
  hentFridager,
  hentInnstilling,
  settInnstilling,
} from "../data/skolear";
import {
  blokkering,
  rodekart,
  ukenummer,
  type Blokkering,
  type Fridag,
} from "../data/kalender";
import type { FagIAr } from "../data/fag";
import { Felt, Knapp, Kolonnevelger, Tomtilstand } from "../ui/felles";
import { invoke } from "@tauri-apps/api/core";
import { OktPanel } from "./OktPanel";
import { Arsplan } from "./Arsplan";
import { TRAFIKKLYS } from "../ui/farger";
import {
  hentAllePerioder,
  periodeFor,
  type Periode,
} from "../data/perioder";
import { ElevPanel } from "./ElevPanel";
import { useGlidende } from "../ui/bevegelse";
import type { Skolear } from "../data/skolear";
import { NySerie } from "./NySerie";

/**
 * Årsplan — økter, SPEC §4.2.
 *
 * Alle fag i én kronologisk liste, med fagfilter og søk i tema. Klikk på en
 * rad åpner det utvidede viewet til høyre — ikke en ny side.
 */
export type KolonneId =
  | "uke"
  | "tid"
  | "varighet"
  | "periode"
  | "vurdering"
  | "logg"
  | "innsats";

const STANDARDKOLONNER: KolonneId[] = [
  "uke",
  "tid",
  "varighet",
  "periode",
  "vurdering",
  "innsats",
];

export function Okter({
  skolear,
  fag,
  startValgt = null,
  onApnePerioder,
}: {
  skolear: Skolear;
  fag: FagIAr[];
  onApnePerioder: () => void;
  /** Økt som skal stå åpen med en gang, f.eks. klikket fra forsiden. */
  startValgt?: string | null;
}) {
  const [okter, setOkter] = useState<Okt[]>([]);
  const [valgt, setValgt] = useState<string | null>(startValgt);
  const [filterFag, setFilterFag] = useState("");
  const [sok, setSok] = useState("");
  const [lagerNy, setLagerNy] = useState(false);
  const [lagerSerie, setLagerSerie] = useState(false);
  const [valgtElev, setValgtElev] = useState<string | null>(null);
  const [perioder, setPerioder] = useState<Periode[]>([]);
  // Kolonnevalget ligger i innstilling, ikke i nettleseren, så det følger
  // databasen hvis du flytter den til en annen maskin.
  const [kolonner, setKolonner] = useState<Set<KolonneId>>(
    new Set(STANDARDKOLONNER),
  );
  const [fridager, setFridager] = useState<Fridag[]>([]);
  const [vurderinger, setVurderinger] = useState<Map<string, OktVurdering[]>>(
    new Map(),
  );

  const skolearId = skolear.id;
  const skolearStart = skolear.start;
  const skolearSlutt = skolear.slutt;

  async function last() {
    setOkter(await hentOkter(skolearId));
    setFridager(await hentFridager(skolearId));
    setVurderinger(await hentOktVurderinger(skolearId));
    setPerioder(await hentAllePerioder(skolearId));
  }

  useEffect(() => {
    void last();
    void hentInnstilling("okt_kolonner").then((v) => {
      if (v) setKolonner(new Set(JSON.parse(v) as KolonneId[]));
    });
  }, [skolearId]);

  function byttKolonne(id: KolonneId, pa: boolean) {
    setKolonner((f) => {
      const ny = new Set(f);
      if (pa) ny.add(id);
      else ny.delete(id);
      void settInnstilling("okt_kolonner", JSON.stringify([...ny]));
      return ny;
    });
  }

  // Navigerer du hit med en økt i sikte — fra forsiden, kalenderen eller et
  // heatmap — skal den åpne seg, også når panelet allerede står åpent på en
  // annen økt. Historikkpilene bruker samme vei.
  useEffect(() => {
    if (startValgt) setValgt(startValgt);
  }, [startValgt]);

  // Ligger en økt på en ferie eller en rød dag, skal det synes. Datoen kan
  // ha blitt blokkert etter at økta ble lagt inn.
  const rode = useMemo(
    () => rodekart(skolearStart, skolearSlutt),
    [skolearStart, skolearSlutt],
  );
  const blokkert = useMemo(() => {
    const kart = new Map<string, Blokkering>();
    for (const o of okter) {
      const b = blokkering(o.dato, fridager, rode);
      if (b) kart.set(o.id, b);
    }
    return kart;
  }, [okter, fridager, rode]);

  const synlige = useMemo(() => {
    const s = sok.trim().toLocaleLowerCase("nb-NO");
    return okter.filter((o) => {
      if (filterFag && o.skolearFagId !== filterFag) return false;
      if (s && !(o.tema ?? "").toLocaleLowerCase("nb-NO").includes(s)) return false;
      return true;
    });
  }, [okter, filterFag, sok]);

  // Perioden utledes av datoen, så den finnes uten at noe er lagret på økta.
  const periodePerOkt = useMemo(() => {
    const kart = new Map<string, Periode>();
    for (const o of okter) {
      const egne = perioder.filter((p) => p.skolearFagId === o.skolearFagId);
      const p = periodeFor(o, egne);
      if (p) kart.set(o.id, p);
    }
    return kart;
  }, [okter, perioder]);

  const { vist: apen, apen: glir } = useGlidende(
    okter.find((o) => o.id === valgt) ?? null,
  );

  return (
    <>
      <Arsplan
        skolear={skolear}
        fag={fag}
        okter={synlige}
        vurderinger={vurderinger}
      />

    <div className="ikkeutskrift flex h-full gap-0 overflow-hidden">
      <div className={`liste-bredde min-w-0 overflow-y-auto ${glir ? "hidden w-full pr-4 lg:block lg:w-1/3" : "w-full"}`}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Felt
            verdi={sok}
            settVerdi={setSok}
            plassholder="Søk i tema"
            bredde={apen ? "w-full" : "w-56"}
          />
          <select
            value={filterFag}
            onChange={(e) => setFilterFag(e.target.value)}
            className="rounded border border-neutral-300 bg-white px-2 py-1.5 text-[13px]"
          >
            <option value="">Alle fag</option>
            {fag.map((f) => (
              <option key={f.id} value={f.id}>
                {f.kode}
              </option>
            ))}
          </select>
          <div className="ml-auto flex items-center gap-2">
            <Kolonnevelger valgbare={VALGBARE} vis={kolonner} onEndre={(id, pa) => byttKolonne(id as KolonneId, pa)} />
            <Knapp onClick={() => void invoke("skriv_ut")}>Skriv ut / PDF</Knapp>
            <Knapp onClick={() => setLagerSerie(true)}>+ Serie</Knapp>
            <Knapp variant="primar" onClick={() => setLagerNy(true)}>
              + Ny økt
            </Knapp>
          </div>
        </div>

        {lagerNy && (
          <NyOkt
            fag={fag}
            startFagId={filterFag || fag[0]?.id}
            sisteDato={okter.length > 0 ? okter[okter.length - 1].dato : undefined}
            onLagret={async (id) => {
              setLagerNy(false);
              await last();
              setValgt(id);
            }}
            onAvbryt={() => setLagerNy(false)}
          />
        )}

        {lagerSerie && (
          <NySerie
            skolearId={skolearId}
            skolearStart={skolearStart}
            skolearSlutt={skolearSlutt}
            fag={fag}
            startFagId={filterFag || fag[0]?.id}
            onLagret={async () => {
              setLagerSerie(false);
              await last();
            }}
            onAvbryt={() => setLagerSerie(false)}
          />
        )}

        {okter.length === 0 && !lagerNy && !lagerSerie ? (
          <Tomtilstand
            tekst={
              fag.length === 0
                ? "Legg inn fagene dine først, så kan du planlegge øktene."
                : "Ingen økter i dette skoleåret ennå — opprett den første."
            }
            handling={
              fag.length > 0 ? (
                <div className="flex gap-2">
                  <Knapp variant="primar" onClick={() => setLagerSerie(true)}>
                    Legg inn en serie
                  </Knapp>
                  <Knapp onClick={() => setLagerNy(true)}>Én økt</Knapp>
                </div>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
          <Liste
            okter={synlige}
            valgt={valgt}
            vis={apen ? new Set<KolonneId>() : kolonner}
            blokkert={blokkert}
            vurderinger={vurderinger}
            perioder={periodePerOkt}
            onApnePerioder={onApnePerioder}
            onVelg={setValgt}
          />
          </div>
        )}

        {okter.length > 0 && (
          <p className="mt-3 text-[12px] text-neutral-500">
            {synlige.length} av {okter.length} økter ·{" "}
            {timer(synlige.reduce((sum, o) => sum + o.varighetMin, 0))}
            {blokkert.size > 0 && (
              <span className="ml-2 text-feil">
                ! {blokkert.size}{" "}
                {blokkert.size === 1 ? "økt ligger" : "økter ligger"} på en fridag
              </span>
            )}
          </p>
        )}
      </div>

      {apen && (
        <div className={`panel min-w-0 w-full lg:w-2/3 ${glir ? "" : "panel-ute"}`}>
          {valgtElev ? (
            <ElevPanel
              key={valgtElev}
              elevId={valgtElev}
              aktivtSkolearId={skolearId}
              onLukk={() => setValgtElev(null)}
              onApneOkt={(id) => {
                setValgtElev(null);
                setValgt(id);
              }}
            />
          ) : (
            <OktPanel
              okt={apen}
              onLukk={() => setValgt(null)}
              onEndret={last}
              onApneElev={setValgtElev}
            />
          )}
        </div>
      )}
    </div>
    </>
  );
}

/**
 * Kolonnene du kan slå av og på. Fag, dato, tema og skåret er alltid med —
 * uten dem er ikke raden en økt lenger.
 */
const VALGBARE: { id: KolonneId; navn: string }[] = [
  { id: "uke", navn: "Uke" },
  { id: "tid", navn: "Tid" },
  { id: "varighet", navn: "Varighet" },
  { id: "periode", navn: "Periode" },
  { id: "vurdering", navn: "Vurdering" },
  { id: "logg", navn: "Øktlogg" },
  { id: "innsats", navn: "Innsats" },
];

function Liste({
  okter,
  valgt,
  vis,
  blokkert,
  vurderinger,
  perioder,
  onApnePerioder,
  onVelg,
}: {
  okter: Okt[];
  valgt: string | null;
  vis: Set<KolonneId>;
  blokkert: Map<string, Blokkering>;
  vurderinger: Map<string, OktVurdering[]>;
  perioder: Map<string, Periode>;
  onApnePerioder: () => void;
  onVelg: (id: string) => void;
}) {
  let forrigeManed = "";

  return (
    <div className="min-w-[52rem]">
      <div className="flex items-center gap-3 border-b border-neutral-300 px-2 py-1 text-[11px] uppercase tracking-wide text-neutral-500">
        {vis.has("uke") && (
          <span className="w-7 shrink-0" title="Ukenummer">
            Uke
          </span>
        )}
        <span className="w-[3px] shrink-0" />
        <span className="w-12 shrink-0">Fag</span>
        <span className="w-24 shrink-0">Dato</span>
        {vis.has("tid") && <span className="w-12 shrink-0">Tid</span>}
        {vis.has("varighet") && (
          <span className="w-16 shrink-0 text-right">Varighet</span>
        )}
        <span className="flex-1">Tema</span>
        {vis.has("periode") && <span className="w-36 shrink-0">Periode</span>}
        {vis.has("vurdering") && <span className="w-40 shrink-0">Vurdering</span>}
        {vis.has("logg") && <span className="w-40 shrink-0">Øktlogg</span>}
        {vis.has("innsats") && <span className="w-24 shrink-0">Innsats</span>}
        <span className="w-14 shrink-0 text-right">Skåret</span>
      </div>

      {okter.map((o) => {
        const maned = o.dato.slice(0, 7);
        const nyManed = maned !== forrigeManed;
        forrigeManed = maned;

        return (
          <div key={o.id}>
            {nyManed && (
              <div className="border-b border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] uppercase tracking-wide text-neutral-500">
                {manedsnavn(o.dato)}
              </div>
            )}
            <button
              onClick={() => onVelg(o.id)}
              className={`flex w-full items-center gap-3 border-b border-neutral-100 px-2 py-1.5 text-left text-[13px] ${
                valgt === o.id ? "bg-na-blaa-flate" : "hover:bg-neutral-50"
              }`}
            >
              {vis.has("uke") && (
                <span className="w-7 shrink-0 tabular-nums text-neutral-400">
                  {ukenummer(o.dato)}
                </span>
              )}
              <span
                aria-hidden
                className="h-3.5 w-[3px] shrink-0 rounded-full"
                style={{ background: o.farge ?? "var(--color-na-fagstrek)" }}
              />
              <span className="w-12 shrink-0 font-medium">{o.fagKode}</span>
              <span
                className={`w-24 shrink-0 tabular-nums ${
                  blokkert.has(o.id)
                    ? "font-medium text-feil"
                    : "text-neutral-600"
                }`}
                title={blokkert.get(o.id)?.navn}
              >
                {kortDato(o.dato)}
                {blokkert.has(o.id) && " !"}
              </span>
              {vis.has("tid") && (
                <span className="w-12 shrink-0 tabular-nums text-neutral-500">
                  {o.klokkeslett ?? "–"}
                </span>
              )}
              {vis.has("varighet") && (
                <span className="w-16 shrink-0 text-right tabular-nums text-neutral-500">
                  {o.varighetMin} min
                </span>
              )}
              <span className="flex-1 truncate">
                {o.tema ?? <span className="text-neutral-400">—</span>}
              </span>
              {vis.has("periode") && (
                <span className="w-36 shrink-0 truncate">
                  {perioder.has(o.id) ? (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        onApnePerioder();
                      }}
                      title="Åpne periodevisningen"
                      className="rounded-sm bg-neutral-100 px-1.5 py-0.5 text-[12px] text-neutral-600 hover:bg-neutral-200"
                    >
                      {perioder.get(o.id)!.navn}
                    </span>
                  ) : (
                    <span className="text-neutral-300">—</span>
                  )}
                </span>
              )}
              {vis.has("vurdering") && (
                <span className="w-40 shrink-0 truncate text-neutral-600">
                  {(vurderinger.get(o.id) ?? []).map((v) => v.tittel).join(", ")}
                </span>
              )}
              {vis.has("logg") && (
                <span
                  className="w-40 shrink-0 truncate text-[12px] italic text-neutral-500"
                  title={o.logg ?? undefined}
                >
                  {o.logg ?? ""}
                </span>
              )}
              {vis.has("innsats") && (
                <span className="w-24 shrink-0">
                  <Innsats okt={o} />
                </span>
              )}
              <Status okt={o} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Skåringene i økta som én tett stripe — grønt, gult, rødt i forhold.
 * Ikke et diagram, bare noe å skumme nedover.
 */
function Innsats({ okt }: { okt: Okt }) {
  const talt = okt.gronn + okt.gul + okt.rod;
  if (talt === 0) return <span className="text-[12px] text-neutral-300">—</span>;

  const deler = [
    { antall: okt.gronn, farge: TRAFIKKLYS.gronn },
    { antall: okt.gul, farge: TRAFIKKLYS.gul },
    { antall: okt.rod, farge: TRAFIKKLYS.rod },
  ];

  return (
    <span
      title={`${okt.gronn} grønne, ${okt.gul} gule, ${okt.rod} røde`}
      className="flex h-2 w-20 overflow-hidden rounded-full bg-neutral-100"
    >
      {deler.map((d, i) => (
        <span
          key={i}
          style={{ width: `${(d.antall / talt) * 100}%`, background: d.farge }}
        />
      ))}
    </span>
  );
}

function Status({ okt }: { okt: Okt }) {
  if (okt.skaret === 0)
    return <span className="w-14 shrink-0 text-right text-neutral-300">·</span>;
  if (okt.skaret >= okt.elever)
    return <span className="w-14 shrink-0 text-right text-na-ok">✓</span>;
  return (
    <span className="w-14 shrink-0 text-right tabular-nums text-neutral-500">
      {okt.skaret}/{okt.elever}
    </span>
  );
}

function NyOkt({
  fag,
  startFagId,
  sisteDato,
  onLagret,
  onAvbryt,
}: {
  fag: FagIAr[];
  startFagId?: string;
  sisteDato?: string;
  onLagret: (id: string) => void;
  onAvbryt: () => void;
}) {
  const [fagId, setFagId] = useState(startFagId ?? fag[0]?.id ?? "");
  const [dato, setDato] = useState(sisteDato ?? iDag());
  const [klokke, setKlokke] = useState("");
  const [varighet, setVarighet] = useState("");
  const [global, setGlobal] = useState("180");

  useEffect(() => {
    void hentInnstilling("standard_varighet_min").then((v) => setGlobal(v ?? "180"));
  }, []);

  const valgtFag = fag.find((f) => f.id === fagId);
  const arvet = String(valgtFag?.standardVarighetMin ?? global);

  async function lagre() {
    if (!valgtFag || !dato) return;
    const id = await opprettOkt(
      valgtFag.id,
      valgtFag.kode,
      dato,
      klokke || null,
      Number(varighet || arvet),
    );
    onLagret(id);
  }

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 border border-neutral-300 bg-neutral-50 p-3">
      <label className="block">
        <span className="mb-1 block text-[11px] uppercase tracking-wide text-neutral-500">
          Fag
        </span>
        <select
          value={fagId}
          onChange={(e) => setFagId(e.target.value)}
          className="rounded border border-neutral-300 bg-white px-2 py-1.5 text-[13px]"
        >
          {fag.map((f) => (
            <option key={f.id} value={f.id}>
              {f.kode}
            </option>
          ))}
        </select>
      </label>

      <Felt etikett="Dato" verdi={dato} settVerdi={setDato} type="date" bredde="w-40" />
      <Felt
        etikett="Klokkeslett"
        verdi={klokke}
        settVerdi={setKlokke}
        plassholder="09:15"
        bredde="w-28"
        onEnter={lagre}
      />
      <Felt
        etikett="Varighet"
        verdi={varighet}
        settVerdi={setVarighet}
        plassholder={`${arvet} (arvet)`}
        bredde="w-32"
        onEnter={lagre}
      />

      <Knapp variant="primar" onClick={lagre} disabled={!fagId || !dato}>
        Opprett
      </Knapp>
      <Knapp variant="stille" onClick={onAvbryt}>
        Avbryt
      </Knapp>
    </div>
  );
}

function iDag(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function kortDato(dato: string): string {
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function manedsnavn(dato: string): string {
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    month: "long",
    year: "numeric",
  });
}

function timer(minutter: number): string {
  return `${Math.round((minutter / 60) * 10) / 10} timer`;
}
