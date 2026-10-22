import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { confirm as bekreft } from "@tauri-apps/plugin-dialog";
import {
  hentOktvalg,
  hentSkalaverdier,
  hentVurderingElever,
  hentVurderingsskalaer,
  slettVurdering,
  type Oktvalg,
  type Vurdering,
  type VurderingElev,
} from "../../data/vurderinger";
import {
  hentMuntlig,
  hentMuntligResultater,
  oppdaterResultat,
  settMuntlig,
  type Leveranse,
  type Muntligoppsett,
  type Muntligresultat,
  type Rubrikkvalg,
} from "../../data/muntlig";
import {
  hentBorteIOkt,
  hentFraser,
  leggTilFrase,
  lesKolonne,
  leveranseFor,
  settFraser,
} from "../../data/foring";
import { lyttVurderinger } from "../../data/endringer";
import { iFelt } from "../../data/oktkart";
import { taster, type Skala, type Skalaverdi } from "../../skala";
import { Bryter, Fagfirkant } from "../../ui/felles";
import { Elevfoto } from "../../ui/Elevfoto";
import { tast as visTast } from "../../ui/taster";
import { kortDag } from "../../data/vurderingsoversikt";
import { Felter, Oktbrikke } from "../Vurderingsfelter";
import { SlikVurdererDu } from "../muntlig/Planlegg";
import { Rubrikkvelger } from "../muntlig/Rubrikkvelger";
import { kopierKarakterliste } from "../muntlig/eksport";

type Modus = "en" | "tabell" | "oppsett";

const LEVERANSE: [Leveranse, string][] = [
  ["levert", "Levert"],
  ["ikke", "Ikke levert"],
  ["borte", "Borte"],
];

/**
 * Føring av skriftlig prøve og innlevering (ARBEIDSLISTE 29.5, lerretet
 * Foring): samme oppbygning som muntlig. Elevlista til venstre. «Én og én»
 * har levert, rubrikk eller kriterier, kort kommentar med faste fraser og
 * karakter med tast. «Tabell» er rask føring med Tab og Enter, og tar imot
 * en kolonne limt inn fra Excel. «Oppsett» har vurderingens felter.
 */
export function ForingArk({
  vurdering,
  onLukk,
  onEndret,
  onApneElev,
  onApneSamtaler,
}: {
  vurdering: Vurdering;
  onLukk: () => void;
  onEndret: () => void;
  onApneElev: (elevId: string) => void;
  onApneSamtaler?: (skolearFagId: string) => void;
}) {
  const v = vurdering;
  const [elever, setElever] = useState<VurderingElev[]>([]);
  const [res, setRes] = useState<Map<string, Muntligresultat>>(new Map());
  const [verdier, setVerdier] = useState<Skalaverdi[]>([]);
  const [oppsett, setOppsett] = useState<Muntligoppsett | null>(null);
  const [fraser, setFraserState] = useState<string[]>([]);
  const [borte, setBorte] = useState<Set<string>>(new Set());
  const [skalaer, setSkalaer] = useState<Skala[]>([]);
  const [okter, setOkter] = useState<Oktvalg[]>([]);
  const [modus, setModus] = useState<Modus>("en");
  const [valgt, setValgt] = useState(0);
  const [kopiert, setKopiert] = useState(false);

  const last = useCallback(async () => {
    const [e, r, vv, o, f, b] = await Promise.all([
      hentVurderingElever(v.id, v.skolearFagId),
      hentMuntligResultater(v.id),
      hentSkalaverdier(v.skalaId),
      hentMuntlig(v.id),
      hentFraser(v.id),
      hentBorteIOkt(v.id),
    ]);
    setElever(
      [...e].sort(
        (a, b) =>
          a.fornavn.localeCompare(b.fornavn, "nb") ||
          a.etternavn.localeCompare(b.etternavn, "nb"),
      ),
    );
    setRes(r);
    setVerdier(vv);
    setOppsett(o);
    setFraserState(f);
    setBorte(b);
  }, [v.id, v.skolearFagId, v.skalaId]);
  useEffect(() => {
    void last();
    void hentVurderingsskalaer().then(setSkalaer);
    void hentOktvalg(v.skolearFagId).then(setOkter);
  }, [last, v.skolearFagId]);
  useEffect(() => lyttVurderinger(() => void last()), [last]);

  const verdi = useMemo(
    () => new Map(verdier.map((x) => [x.id, x])),
    [verdier],
  );
  const tastekart = taster(verdier);
  const fraTast = new Map(
    verdier.map((x) => [tastekart.get(x.id) ?? "", x] as const),
  );
  const status = (id: string) =>
    leveranseFor(
      res.get(id)?.leveranse,
      borte.has(id),
      !!res.get(id)?.skalaverdiId,
    );
  const fort = elever.filter((e) => res.get(e.elevId)?.skalaverdiId).length;

  /** Skriver på resultatet og viser det med en gang. */
  async function skriv(
    elevId: string,
    felter: Parameters<typeof oppdaterResultat>[2],
  ) {
    setRes((m) => {
      const ny = new Map(m);
      const f = ny.get(elevId) ?? {
        elevId,
        skalaverdiId: null,
        kommentar: null,
        leveranse: null,
        rubrikkvalg: {},
        stilte: [],
      };
      ny.set(elevId, { ...f, ...felter } as Muntligresultat);
      return ny;
    });
    await oppdaterResultat(v.id, elevId, felter);
    if (felter.skalaverdiId !== undefined || felter.leveranse !== undefined)
      onEndret();
  }

  /** En karakter betyr at eleven leverte, hvis ikke annet er satt. */
  function settKarakter(elevId: string, id: string | null) {
    const satt = res.get(elevId)?.leveranse;
    void skriv(elevId, {
      skalaverdiId: id,
      ...(id && !satt ? { leveranse: "levert" as const } : {}),
    });
  }

  function neste() {
    const i = elever.findIndex(
      (e, j) =>
        j > valgt &&
        !res.get(e.elevId)?.skalaverdiId &&
        status(e.elevId) !== "borte" &&
        status(e.elevId) !== "ikke",
    );
    setValgt(i >= 0 ? i : Math.min(valgt + 1, elever.length - 1));
  }

  // Tastene i «Én og én»: 1–6 karakter, ↑↓ elev, ⌘↵ neste.
  const fersk = useRef({ settKarakter, neste, fraTast, elever, valgt, modus });
  fersk.current = { settKarakter, neste, fraTast, elever, valgt, modus };
  useEffect(() => {
    const tast = (e: KeyboardEvent) => {
      const f = fersk.current;
      if (f.modus !== "en") return;
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        f.neste();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || iFelt(e.target)) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setValgt((i) =>
          Math.max(
            0,
            Math.min(f.elever.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)),
          ),
        );
        return;
      }
      const x = f.fraTast.get(e.key);
      const elev = f.elever[f.valgt];
      if (x && elev) {
        e.preventDefault();
        f.settKarakter(elev.elevId, x.id);
      }
    };
    window.addEventListener("keydown", tast);
    return () => window.removeEventListener("keydown", tast);
  }, []);

  if (!oppsett) return null;
  const elev = elever[valgt];
  const dato = v.oktDato ?? v.frist;
  const harRubrikk =
    oppsett.form === "rubrikk" &&
    oppsett.rubrikk.kriterier.some((k) => k.tekst.trim());

  const rader = elever.map((e) => {
    const r = res.get(e.elevId);
    return {
      navn: `${e.fornavn} ${e.etternavn}`,
      oppgave: "",
      karakter: r?.skalaverdiId ? (verdi.get(r.skalaverdiId)?.kode ?? "") : "",
      notat: r?.kommentar ?? "",
    };
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-2.5 px-6 pb-3 pt-1">
        <Fagfirkant farge={v.farge} storrelse={10} />
        <span className="text-[calc(15px*var(--tekst-skala))] font-semibold">
          {v.tittel}
        </span>
        <span className="text-[calc(13px*var(--tekst-skala))] text-blekk-dempet">
          {[
            v.fagKode,
            dato ? kortDag(dato) : null,
            v.skalaNavn,
            harRubrikk ? "rubrikk" : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <Oktbrikke vurdering={v} onEndret={onEndret} />
        <span className="ml-2.5">
          <Bryter
            storrelse="liten"
            verdi={modus}
            settVerdi={(m) => setModus(m as Modus)}
            valg={[
              { id: "en", navn: "Én og én" },
              { id: "tabell", navn: "Tabell" },
              { id: "oppsett", navn: "Oppsett" },
            ]}
          />
        </span>
        <span className="flex-1" />
        <span className="rounded-full bg-flate px-2.5 py-0.5 text-liten tabular-nums">
          {fort} av {elever.length} ført
        </span>
        <button
          onClick={async () => {
            await kopierKarakterliste(v.tittel, rader, true);
            setKopiert(true);
            window.setTimeout(() => setKopiert(false), 1500);
          }}
          title="Karakter og kommentar per elev, som tabell"
          className="h-[30px] rounded-full border border-linje-sterk bg-ark px-3 text-[13px] hover:bg-flate"
        >
          {kopiert ? "Kopiert ✓" : "Kopier til Teams"}
        </button>
      </header>

      {modus === "oppsett" ? (
        <div className="min-h-0 flex-1 overflow-auto px-6 pb-6">
          <div className="max-w-3xl">
            <Felter
              vurdering={v}
              skalaer={skalaer}
              okter={okter}
              onEndret={onEndret}
              onApneSamtaler={onApneSamtaler}
            />
            <div className="mt-4">
              <SlikVurdererDu
                vurdering={v}
                oppsett={oppsett}
                key={`${oppsett.form}`}
              />
            </div>
            <button
              onClick={async () => {
                if (!(await bekreft(`Slette vurderingen «${v.tittel}»?`)))
                  return;
                await slettVurdering(v.id);
                onLukk();
                onEndret();
              }}
              className="mt-5 text-liten text-blekk-svak hover:text-feil"
            >
              Slett vurderingen
            </button>
          </div>
        </div>
      ) : modus === "tabell" ? (
        <div className="min-h-0 flex-1 overflow-auto px-6 pb-6">
          <Tabell
            elever={elever}
            res={res}
            verdier={verdier}
            status={status}
            onKarakter={settKarakter}
            onKommentar={(id, t) => void skriv(id, { kommentar: t || null })}
            onLeveranse={(id, l) => void skriv(id, { leveranse: l })}
          />
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)] gap-[26px] px-6">
          <div className="min-h-0 overflow-auto pb-5">
            <p className="mx-1.5 mb-2.5 mt-0.5 text-liten text-blekk-svak">
              Alfabetisk · ↑↓ bytter elev
            </p>
            {elevlisteRader(elever, res, verdi, status, valgt, setValgt)}
          </div>
          <div className="min-h-0 overflow-auto pb-5">
            {elev ? (
              <EnOgEn
                key={elev.elevId}
                elev={elev}
                res={res.get(elev.elevId)}
                status={status(elev.elevId)}
                borteIOkt={borte.has(elev.elevId)}
                oppsett={oppsett}
                verdier={verdier}
                tastekart={tastekart}
                fraser={fraser}
                onFraser={async (f) => {
                  setFraserState(f);
                  await settFraser(v.id, f);
                }}
                onForm={(f) => {
                  setOppsett({ ...oppsett, form: f });
                  void settMuntlig(v.id, { form: f });
                }}
                onKarakter={(id) => settKarakter(elev.elevId, id)}
                onKommentar={(t) =>
                  skriv(elev.elevId, { kommentar: t || null })
                }
                onLeveranse={(l) => void skriv(elev.elevId, { leveranse: l })}
                onValg={(ny) => void skriv(elev.elevId, { rubrikkvalg: ny })}
                onNeste={neste}
                onApneElev={() => onApneElev(elev.elevId)}
              />
            ) : (
              <p className="mt-10 text-center text-brod text-blekk-dempet">
                Ingen elever er koblet til {v.fagKode} ennå.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function elevlisteRader(
  elever: VurderingElev[],
  res: Map<string, Muntligresultat>,
  verdi: Map<string, Skalaverdi>,
  status: (id: string) => Leveranse | null,
  valgt: number,
  setValgt: (i: number) => void,
) {
  return elever.map((e, i) => {
    const r = res.get(e.elevId);
    const kar = r?.skalaverdiId ? verdi.get(r.skalaverdiId) : null;
    const s = status(e.elevId);
    return (
      <button
        key={e.elevId}
        onClick={() => setValgt(i)}
        className={`grid h-10 w-full grid-cols-[minmax(0,1fr)_auto_30px] items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[calc(13.5px*var(--tekst-skala))] transition-[background-color,box-shadow] duration-200 ${
          i === valgt
            ? "bg-ark shadow-[inset_0_0_0_1.5px_var(--color-aksent),0_4px_14px_rgba(74,61,125,.12)]"
            : "hover:bg-flate-svak"
        } ${s === "borte" ? "text-blekk-svakest" : ""}`}
      >
        <span className="truncate">
          {e.fornavn} {e.etternavn}
        </span>
        <span
          className={`text-liten ${s === "ikke" ? "text-feil" : "text-blekk-svak"}`}
        >
          {s === "ikke" ? "ikke levert" : s === "borte" ? "borte" : ""}
        </span>
        <span
          className={`inline-grid h-[26px] w-[26px] place-items-center rounded-[7px] text-[12.5px] font-semibold ${
            kar ? "bg-flate" : "shadow-[inset_0_0_0_1.5px_var(--color-linje)]"
          }`}
        >
          {kar?.kode ?? ""}
        </span>
      </button>
    );
  });
}

function EnOgEn({
  elev,
  res,
  status,
  borteIOkt,
  oppsett,
  verdier,
  tastekart,
  fraser,
  onFraser,
  onForm,
  onKarakter,
  onKommentar,
  onLeveranse,
  onValg,
  onNeste,
  onApneElev,
}: {
  elev: VurderingElev;
  res: Muntligresultat | undefined;
  status: Leveranse | null;
  borteIOkt: boolean;
  oppsett: Muntligoppsett;
  verdier: Skalaverdi[];
  tastekart: Map<string, string>;
  fraser: string[];
  onFraser: (f: string[]) => void;
  onForm: (f: Muntligoppsett["form"]) => void;
  onKarakter: (id: string | null) => void;
  onKommentar: (t: string) => Promise<void>;
  onLeveranse: (l: Leveranse) => void;
  onValg: (ny: Rubrikkvalg) => void;
  onNeste: () => void;
  onApneElev: () => void;
}) {
  const [kommentar, setKommentar] = useState(res?.kommentar ?? "");
  const [nyFrase, setNyFrase] = useState<string | null>(null);
  const venter = useRef<number | null>(null);
  const siste = useRef(kommentar);
  // Kommentaren lagres litt etter siste tastetrykk, og når eleven byttes.
  function endre(t: string) {
    setKommentar(t);
    siste.current = t;
    if (venter.current !== null) window.clearTimeout(venter.current);
    venter.current = window.setTimeout(() => {
      venter.current = null;
      void onKommentar(t);
    }, 600);
  }
  useEffect(
    () => () => {
      if (venter.current !== null) {
        window.clearTimeout(venter.current);
        void onKommentar(siste.current);
      }
    },
    [],
  );

  return (
    <div>
      <div className="flex items-center gap-3.5">
        <button onClick={onApneElev} title="Åpne elevkortet">
          <Elevfoto
            elevId={elev.elevId}
            storrelse={48}
            navn={`${elev.fornavn} ${elev.etternavn}`}
          />
        </button>
        <div className="min-w-0 truncate text-[24px] font-light tracking-[-.01em]">
          {elev.fornavn} {elev.etternavn}
        </div>
        <span className="flex-1" />
        <button
          onClick={onNeste}
          className="flex h-[30px] items-center gap-1.5 rounded-full bg-aksent px-3.5 text-[13px] font-medium text-ark hover:bg-aksent-mork"
        >
          Neste elev
          <span className="text-[11px] opacity-60">{visTast("⌘↵")}</span>
        </button>
      </div>

      <div className="mb-5 mt-[18px] flex flex-wrap items-center gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[.06em] text-blekk-svak">
          Levert
        </span>
        <span className="inline-flex gap-0.5 rounded-full bg-flate p-0.5">
          {LEVERANSE.map(([l, navn]) => (
            <button
              key={l}
              onClick={() => onLeveranse(l)}
              aria-pressed={status === l}
              className={`h-[26px] rounded-full px-3 text-[12.5px] transition-colors duration-200 ${
                status === l
                  ? l === "ikke"
                    ? "bg-ark font-medium text-feil shadow-[0_1px_3px_rgba(36,31,51,.16)]"
                    : "bg-ark font-medium shadow-[0_1px_3px_rgba(36,31,51,.16)]"
                  : "text-blekk-dempet hover:text-blekk"
              }`}
            >
              {navn}
            </button>
          ))}
        </span>
        <span className="text-liten text-blekk-svak">
          {borteIOkt && !res?.leveranse
            ? "Borte i økta, hentet fra fraværet."
            : "Borte hentes fra fraværet i økta."}
        </span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_150px] gap-6">
        <div className="min-w-0">
          {oppsett.rubrikk.kriterier.some((k) => k.tekst.trim()) && (
            <div className="mb-5">
              <Rubrikkvelger
                rubrikk={oppsett.rubrikk}
                form={oppsett.form}
                onForm={onForm}
                valg={res?.rubrikkvalg ?? {}}
                onValg={onValg}
                verdier={verdier}
                onBruk={(id) => onKarakter(id)}
              />
            </div>
          )}
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[.06em] text-blekk-svak">
            Kommentar til eleven
          </div>
          <textarea
            value={kommentar}
            rows={2}
            onChange={(e) => endre(e.target.value)}
            placeholder="Én eller to setninger. Eleven kan få den kopiert til Teams."
            className="w-full resize-none rounded-[10px] bg-flate-svak px-3 py-2.5 text-[13.5px] leading-normal outline-none shadow-[inset_0_0_0_1px_var(--color-linje-svak)] placeholder:text-blekk-svakest focus:bg-ark focus:shadow-[inset_0_0_0_1.5px_var(--color-aksent)]"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {fraser.map((f, i) => (
              <span
                key={i}
                className="group inline-flex items-center rounded-full bg-flate text-[12px]"
              >
                <button
                  onClick={() => endre(leggTilFrase(kommentar, f))}
                  className="py-1 pl-2.5 pr-1 hover:text-aksent"
                >
                  + {f}
                </button>
                <button
                  onClick={() => onFraser(fraser.filter((_, j) => j !== i))}
                  title="Fjern frasen"
                  className="pr-2 text-blekk-svakest opacity-0 hover:text-feil group-hover:opacity-100"
                >
                  ×
                </button>
              </span>
            ))}
            {nyFrase === null ? (
              <button
                onClick={() => setNyFrase("")}
                className="rounded-full px-2.5 py-1 text-[12px] text-aksent shadow-[inset_0_0_0_1px_var(--color-linje)] hover:bg-flate-svak"
              >
                + Ny frase
              </button>
            ) : (
              <input
                autoFocus
                value={nyFrase}
                onChange={(e) => setNyFrase(e.target.value)}
                onBlur={() => setNyFrase(null)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    setNyFrase(null);
                  }
                  if (e.key === "Enter" && nyFrase.trim()) {
                    onFraser([...fraser, nyFrase.trim()]);
                    setNyFrase(null);
                  }
                }}
                placeholder="Frasen ↵"
                className="w-56 rounded-full bg-ark px-2.5 py-1 text-[12px] outline-none shadow-[inset_0_0_0_1.5px_var(--color-aksent)]"
              />
            )}
          </div>
          <p className="mt-2 text-liten text-blekk-svak">
            Faste fraser lagres per vurdering. Klikk for å legge til.
          </p>
        </div>

        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[.06em] text-blekk-svak">
            Karakter
          </div>
          <div className="grid grid-cols-[repeat(3,42px)] gap-[7px]">
            {verdier
              .filter((x) => x.teller_ikke === 0)
              .map((x) => {
                const pa = res?.skalaverdiId === x.id;
                const t = tastekart.get(x.id);
                return (
                  <button
                    key={x.id}
                    onClick={() => onKarakter(pa ? null : x.id)}
                    title={x.etikett ?? x.kode}
                    className={`relative grid h-[42px] w-[42px] place-items-center rounded-xl font-semibold transition-colors duration-200 ${
                      pa ? "bg-aksent text-ark" : "bg-flate hover:bg-valgt"
                    } ${x.kode.length > 2 ? "text-[11px]" : "text-[16px]"}`}
                  >
                    {x.kode}
                    {t && (
                      <kbd
                        className={`absolute right-[5px] top-[3px] font-sans text-[9.5px] font-normal ${
                          pa ? "text-ark/70" : "text-blekk-svak"
                        }`}
                      >
                        {t}
                      </kbd>
                    )}
                  </button>
                );
              })}
          </div>
          <p className="mt-2 text-liten leading-snug text-blekk-svak">
            {tastekart.size > 0 ? "Trykk tasten." : "Klikk verdien."}
            {oppsett.form === "rubrikk"
              ? " Rubrikken gir et forslag når alle rader er valgt."
              : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Rask føring (29.5): skriv karakteren, Tab til kommentaren, Enter til
 * neste elev. Limer du inn en kolonne fra Excel i karakterfeltet, fylles
 * den nedover fra eleven du står på.
 */
function Tabell({
  elever,
  res,
  verdier,
  status,
  onKarakter,
  onKommentar,
  onLeveranse,
}: {
  elever: VurderingElev[];
  res: Map<string, Muntligresultat>;
  verdier: Skalaverdi[];
  status: (id: string) => Leveranse | null;
  onKarakter: (elevId: string, id: string | null) => void;
  onKommentar: (elevId: string, t: string) => void;
  onLeveranse: (elevId: string, l: Leveranse) => void;
}) {
  const verdi = new Map(verdier.map((x) => [x.id, x]));
  const fraKode = (k: string) =>
    verdier.find(
      (x) =>
        x.kode.toLocaleLowerCase("nb") === k.trim().toLocaleLowerCase("nb"),
    );
  const [ukjent, setUkjent] = useState<string | null>(null);
  const fokus = (rad: number, kol: "k" | "c") =>
    window.setTimeout(
      () =>
        document
          .querySelector<HTMLInputElement>(`[data-celle="${rad}-${kol}"]`)
          ?.focus(),
      0,
    );

  function settKode(elevId: string, kode: string) {
    if (!kode.trim()) {
      if (res.get(elevId)?.skalaverdiId) onKarakter(elevId, null);
      return true;
    }
    const x = fraKode(kode);
    if (!x) {
      setUkjent(kode);
      return false;
    }
    setUkjent(null);
    if (res.get(elevId)?.skalaverdiId !== x.id) onKarakter(elevId, x.id);
    return true;
  }

  return (
    <div>
      <p className="mb-2 text-liten text-blekk-svak">
        Rask føring: skriv karakteren, Tab til kommentar, Enter til neste elev.
        Lim gjerne inn en kolonne fra Excel.
        {ukjent && (
          <span className="ml-2 text-feil">
            «{ukjent}» finnes ikke på skalaen.
          </span>
        )}
      </p>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="text-left text-liten text-blekk-svak">
            <th className="py-1.5 pr-3 font-normal">Elev</th>
            <th className="w-[100px] py-1.5 pr-3 font-normal">Levert</th>
            <th className="w-[80px] py-1.5 pr-3 font-normal">Karakter</th>
            <th className="py-1.5 font-normal">Kommentar</th>
          </tr>
        </thead>
        <tbody>
          {elever.map((e, i) => {
            const r = res.get(e.elevId);
            const s = status(e.elevId);
            return (
              <tr key={e.elevId} className="border-t border-linje-svak">
                <td className="whitespace-nowrap py-1 pr-3">
                  {e.fornavn} {e.etternavn}
                </td>
                <td className="py-1 pr-3">
                  <button
                    onClick={() =>
                      onLeveranse(
                        e.elevId,
                        s === "levert"
                          ? "ikke"
                          : s === "ikke"
                            ? "borte"
                            : "levert",
                      )
                    }
                    title="Klikk for å bytte"
                    className={`text-liten ${s === "ikke" ? "text-feil" : s ? "text-blekk-dempet" : "text-blekk-svakest"}`}
                  >
                    {s === "levert"
                      ? "Levert"
                      : s === "ikke"
                        ? "Ikke levert"
                        : s === "borte"
                          ? "Borte"
                          : "–"}
                  </button>
                </td>
                <td className="py-1 pr-3">
                  <input
                    key={r?.skalaverdiId ?? "tom"}
                    data-celle={`${i}-k`}
                    defaultValue={
                      r?.skalaverdiId
                        ? (verdi.get(r.skalaverdiId)?.kode ?? "")
                        : ""
                    }
                    placeholder="·"
                    onPaste={(ev) => {
                      const kol = lesKolonne(ev.clipboardData.getData("text"));
                      if (kol.length < 2) return;
                      ev.preventDefault();
                      kol.forEach((k, j) => {
                        const el = elever[i + j];
                        if (el) settKode(el.elevId, k);
                      });
                    }}
                    onBlur={(ev) => settKode(e.elevId, ev.target.value)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter") {
                        ev.preventDefault();
                        if (settKode(e.elevId, ev.currentTarget.value))
                          fokus(i + 1, "k");
                      }
                    }}
                    className="w-14 rounded-md bg-transparent px-1.5 py-1 text-center font-semibold outline-none hover:bg-flate-svak focus:bg-ark focus:shadow-[inset_0_0_0_1.5px_var(--color-aksent)]"
                  />
                </td>
                <td className="py-1">
                  <input
                    data-celle={`${i}-c`}
                    defaultValue={r?.kommentar ?? ""}
                    placeholder="…"
                    onBlur={(ev) => {
                      if (ev.target.value !== (r?.kommentar ?? ""))
                        onKommentar(e.elevId, ev.target.value);
                    }}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter") {
                        ev.preventDefault();
                        fokus(i + 1, "k");
                      }
                    }}
                    className="w-full rounded-md bg-transparent px-1.5 py-1 outline-none placeholder:text-blekk-svakest hover:bg-flate-svak focus:bg-ark focus:shadow-[inset_0_0_0_1.5px_var(--color-aksent)]"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
