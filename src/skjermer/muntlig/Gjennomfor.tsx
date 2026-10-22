import { useEffect, useRef, useState } from "react";
import { oppdater } from "../../db";
import { settMotte } from "../../data/samtale";
import {
  antallVurdert,
  hentTidligere,
  karakterforslag,
  kriterierMedTekst,
  oppdaterResultat,
  settMuntlig,
  trekkOppgave,
  type Rubrikkvalg,
  type Tidligere,
  type Vurderingsform,
} from "../../data/muntlig";
import { framdrift, type Utlagtdag } from "../../data/tidsplan";
import { varsleVurderinger } from "../../data/endringer";
import { taster } from "../../skala";
import { Bryter } from "../../ui/felles";
import { Elevfoto } from "../../ui/Elevfoto";
import { Markdownfelt } from "../../ui/Notattekst";
import { iFelt } from "../../data/oktkart";
import { tast as visTast } from "../../ui/taster";
import type { Muntligdata } from "./MuntligArk";

/**
 * Gjennomfør (28.3, 28.3b): eleven som er inne. Trukket oppgave med
 * spørsmålene, kriterier eller rubrikk, notat, karakter med 1–6 og
 * «Neste elev ⌘↵». Tidligere i faget viser bare det faglige.
 */
export function Gjennomfor({
  data,
  utlagt,
  elevId,
  onNeste,
  onApneElev,
  last,
}: {
  data: Muntligdata;
  utlagt: Utlagtdag[];
  elevId: string;
  onNeste: () => void;
  onApneElev: (elevId: string) => void;
  last: () => Promise<void>;
}) {
  const v = data.vurdering;
  const elev = data.elever.find((e) => e.elevId === elevId);
  const samtale = data.samtale.get(elevId);
  const res = data.resultater.get(elevId);
  const dag = utlagt.find((d) => d.rader.some((r) => r.elevId === elevId));
  const rad = dag?.rader.find((r) => r.elevId === elevId);
  const [form, setForm] = useState<Vurderingsform>(data.oppsett.form);
  const [valg, setValg] = useState<Rubrikkvalg>(res?.rubrikkvalg ?? {});
  const [stilte, setStilte] = useState<number[]>(res?.stilte ?? []);
  const [karakter, setKarakter] = useState(res?.skalaverdiId ?? null);
  const [fokus, setFokus] = useState(0);
  const [tidligere, setTidligere] = useState<Tidligere | null>(null);
  const [naa, setNaa] = useState(() => new Date());

  useEffect(() => {
    void hentTidligere(elevId, v.skolearFagId, v.id).then(setTidligere);
  }, [elevId, v.skolearFagId, v.id]);
  useEffect(() => {
    const t = window.setInterval(() => setNaa(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const tastekart = taster(data.verdier);
  const fraTast = new Map(
    data.verdier.map((x) => [tastekart.get(x.id) ?? "", x] as const),
  );

  async function settKarakter(id: string | null) {
    setKarakter(id);
    await oppdaterResultat(v.id, elevId, { skalaverdiId: id });
  }

  // 1–6 setter karakteren når du ikke skriver; ⌘↵ er neste elev overalt.
  const fersk = useRef({ settKarakter, fraTast, onNeste });
  fersk.current = { settKarakter, fraTast, onNeste };
  useEffect(() => {
    const tast = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        fersk.current.onNeste();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || iFelt(e.target)) return;
      const x = fersk.current.fraTast.get(e.key);
      if (x) {
        e.preventDefault();
        void fersk.current.settKarakter(x.id);
      }
    };
    window.addEventListener("keydown", tast);
    return () => window.removeEventListener("keydown", tast);
  }, []);

  if (!elev) return null;

  const kort = data.kort.find((k) => k.tittel === samtale?.tema);
  const sporsmal = (kort?.sporsmal ?? []).filter((s) => s.trim());
  const r = data.oppsett.rubrikk;
  const krit = kriterierMedTekst(r);
  const forslag = form === "rubrikk" ? karakterforslag(r, valg) : null;
  const forslagVerdi =
    forslag !== null
      ? data.verdier.find((x) => x.kode === String(forslag))
      : undefined;
  const p = rad && dag ? framdrift(rad, dag.dag.dato, naa) : null;
  const ferdig = !!karakter;
  const borte = samtale?.motte === false;

  async function lagreValg(ny: Rubrikkvalg) {
    setValg(ny);
    await oppdaterResultat(v.id, elevId, { rubrikkvalg: ny });
  }

  async function trekk() {
    if (!samtale) return;
    const trukket = [...data.samtale.values()]
      .map((s) => s.tema)
      .filter((t): t is string => !!t);
    const ny = trekkOppgave(
      data.kort.map((k) => k.tittel),
      trukket,
      data.oppsett.trekkFlere,
      samtale.tema,
    );
    if (!ny) return;
    await oppdater("samtale", samtale.id, { tema: ny });
    setStilte([]);
    await oppdaterResultat(v.id, elevId, { stilte: [] });
    varsleVurderinger();
    await last();
  }

  const sek =
    rad && p !== null ? Math.floor(p * data.oppsett.samtaleMin * 60) : 0;
  const tidTekst = rad
    ? `${rad.fra}–${rad.til}` +
      (p !== null
        ? ` · pågår · ${Math.floor(sek / 60)}:${String(sek % 60).padStart(2, "0")} av ${data.oppsett.samtaleMin}:00`
        : ferdig
          ? " · ferdig"
          : "")
    : "";

  return (
    <div>
      <div className="flex items-center gap-3.5">
        <button onClick={() => onApneElev(elevId)} title="Åpne elevkortet">
          <Elevfoto
            elevId={elevId}
            storrelse={52}
            navn={`${elev.fornavn} ${elev.etternavn}`}
          />
        </button>
        <div className="min-w-0">
          <div className="truncate text-[24px] font-light tracking-[-.01em]">
            {elev.fornavn} {elev.etternavn}
          </div>
          <div className="text-[13px] tabular-nums text-blekk-svak">
            {borte ? "Møtte ikke" : tidTekst}
          </div>
        </div>
        <span className="flex-1" />
        {samtale && (
          <button
            onClick={async () => {
              await settMotte(samtale.id, borte);
              varsleVurderinger();
              await last();
              if (!borte) onNeste();
            }}
            className="h-[30px] rounded-full border border-linje-sterk bg-ark px-3 text-[13px] hover:bg-flate"
          >
            {borte ? "Møtte likevel" : "Møtte ikke"}
          </button>
        )}
        <button
          onClick={onNeste}
          className="flex h-[30px] items-center gap-1.5 rounded-full bg-aksent px-3.5 text-[13px] font-medium text-ark hover:bg-aksent-mork"
        >
          Neste elev
          <span className="text-[11px] opacity-60">{visTast("⌘↵")}</span>
        </button>
      </div>
      <div className="mb-[18px] mt-3.5 h-1.5 overflow-hidden rounded-[3px] bg-flate">
        <span
          className="block h-full rounded-[3px] bg-aksent/70 transition-[width] duration-1000 ease-linear"
          style={{ width: `${ferdig ? 100 : Math.round((p ?? 0) * 100)}%` }}
        />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_260px] gap-[22px]">
        <div className="min-w-0">
          <Overskrift>Trukket oppgave</Overskrift>
          <div className="flex items-baseline gap-1.5 text-[15px] font-medium">
            {samtale?.tema
              ? `🎲 ${samtale.tema}`
              : "Ingen oppgave trukket ennå"}
            {data.kort.some((k) => k.tittel.trim()) && samtale && (
              <button
                onClick={() => void trekk()}
                className="ml-1.5 text-[13px] font-normal text-aksent hover:underline"
              >
                {samtale.tema ? "Trekk ny" : "Trekk oppgave"}
              </button>
            )}
          </div>
          {kort?.beskrivelse && (
            <p className="mx-0.5 mb-1 mt-1.5 text-liten text-blekk-dempet">
              {kort.beskrivelse}
            </p>
          )}
          {sporsmal.map((q, i) => {
            const pa = stilte.includes(i);
            return (
              <button
                key={i}
                onClick={async () => {
                  const ny = pa
                    ? stilte.filter((x) => x !== i)
                    : [...stilte, i];
                  setStilte(ny);
                  await oppdaterResultat(v.id, elevId, { stilte: ny });
                }}
                className={`flex w-full items-start gap-2.5 py-[5px] text-left text-[13.5px] leading-snug transition-colors duration-200 ${
                  pa ? "text-blekk-svak" : ""
                }`}
              >
                <span
                  className={`mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] text-ark ${
                    pa
                      ? "bg-aksent/50"
                      : "shadow-[inset_0_0_0_1.5px_var(--color-linje-sterk)]"
                  }`}
                >
                  {pa ? "✓" : ""}
                </span>
                {q}
              </button>
            );
          })}

          <div className="mt-[18px] flex items-center gap-2.5">
            <Overskrift ingenMarg>Kriterier</Overskrift>
            <span className="flex-1" />
            <Bryter
              storrelse="liten"
              verdi={form}
              settVerdi={(f) => {
                const ny = f === "rubrikk" ? "rubrikk" : "kriterier";
                setForm(ny);
                void settMuntlig(v.id, { form: ny });
              }}
              valg={[
                { id: "kriterier", navn: "Avkrysning" },
                { id: "rubrikk", navn: "Rubrikk" },
              ]}
            />
          </div>
          {krit.length === 0 && (
            <p className="mt-2 text-liten text-blekk-svak">
              Ingen kriterier ennå. De legges inn under Planlegg.
            </p>
          )}
          {form === "kriterier" &&
            krit.map((k) => {
              const pa = valg[k.id] === true;
              return (
                <button
                  key={k.id}
                  onClick={() => {
                    const ny = { ...valg };
                    if (pa) delete ny[k.id];
                    else ny[k.id] = true;
                    void lagreValg(ny);
                  }}
                  className="flex h-[34px] w-full items-center gap-2.5 border-b border-linje-svak text-left text-[13.5px]"
                >
                  <span
                    className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md text-[11px] text-ark ${
                      pa
                        ? "bg-aksent"
                        : "shadow-[inset_0_0_0_1.5px_var(--color-linje-sterk)]"
                    }`}
                  >
                    {pa ? "✓" : ""}
                  </span>
                  {k.tekst}
                </button>
              );
            })}
          {form === "rubrikk" && krit.length > 0 && (
            <div className="mt-2.5 rounded-xl p-1.5 shadow-[inset_0_0_0_1px_var(--color-linje-svak)]">
              <div
                className="grid gap-[5px]"
                style={{
                  gridTemplateColumns: `118px repeat(${r.nivaer.length}, minmax(0,1fr))`,
                }}
              >
                <span />
                {r.nivaer.map((n) => (
                  <span
                    key={n.id}
                    className="px-2 py-1 text-[11px] uppercase tracking-[.05em] text-blekk-svak"
                  >
                    {n.navn}
                  </span>
                ))}
              </div>
              {krit.map((k, i) => {
                const vurdert = r.nivaer.some((n) => n.id === valg[k.id]);
                return (
                  <div
                    key={k.id}
                    onClick={() => setFokus(i)}
                    className={`mt-0.5 grid gap-[5px] rounded-[9px] p-1 transition-colors duration-200 ${
                      fokus === i ? "bg-flate-svak" : ""
                    }`}
                    style={{
                      gridTemplateColumns: `118px repeat(${r.nivaer.length}, minmax(0,1fr))`,
                    }}
                  >
                    <span className="self-center px-1.5 py-1.5 text-[12.5px] font-medium leading-tight">
                      {k.tekst}
                    </span>
                    {r.nivaer.map((n) => {
                      const pa = valg[k.id] === n.id;
                      return (
                        <button
                          key={n.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            const ny = { ...valg };
                            if (pa) delete ny[k.id];
                            else ny[k.id] = n.id;
                            void lagreValg(ny);
                            // Videre til neste kriterium som ikke er vurdert.
                            if (!pa) {
                              const neste = krit.findIndex(
                                (x, j) =>
                                  j > i &&
                                  !r.nivaer.some((m) => m.id === ny[x.id]),
                              );
                              setFokus(neste >= 0 ? neste : i);
                            }
                          }}
                          className={`rounded-lg px-[9px] py-[7px] text-left text-[12px] leading-snug transition-[background-color,color,box-shadow,opacity] duration-200 ${
                            pa
                              ? "bg-aksent text-ark"
                              : `bg-ark text-blekk-dempet shadow-[inset_0_0_0_1px_var(--color-linje-svak)] hover:shadow-[inset_0_0_0_1.5px_var(--color-linje-sterk)] ${
                                  vurdert && fokus !== i ? "opacity-55" : ""
                                }`
                          }`}
                        >
                          {k.celler[n.id] || n.navn}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
              <div className="mt-2 flex items-center gap-2.5 px-1">
                <span className="text-liten text-blekk-svak">
                  {forslag !== null
                    ? "Alle kriteriene er vurdert."
                    : `${antallVurdert(r, valg)} av ${krit.length} vurdert`}
                </span>
                <span className="flex-1" />
                {forslag !== null && (
                  <button
                    onClick={() =>
                      forslagVerdi && void settKarakter(forslagVerdi.id)
                    }
                    disabled={!forslagVerdi}
                    title="Sett som karakter. Bare et forslag; du bestemmer."
                    className="rounded-full bg-flate px-2.5 py-0.5 text-liten hover:bg-valgt"
                  >
                    Rubrikken peker mot {forslag} · bruk
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="mt-[18px]">
            <Overskrift>Notat under samtalen</Overskrift>
            <Markdownfelt
              verdi={res?.kommentar ?? null}
              plassholder="Skriv mens eleven snakker …  # overskrift, - punkt, / for meny"
              minRader={6}
              onLagre={(t) => oppdaterResultat(v.id, elevId, { kommentar: t })}
            />
          </div>
        </div>

        <div>
          <Overskrift>Karakter</Overskrift>
          <div className="grid grid-cols-[repeat(3,46px)] gap-2">
            {data.verdier
              .filter((x) => x.teller_ikke === 0)
              .map((x) => {
                const pa = karakter === x.id;
                const t = tastekart.get(x.id);
                return (
                  <button
                    key={x.id}
                    onClick={() => void settKarakter(pa ? null : x.id)}
                    title={x.etikett ?? x.kode}
                    className={`relative grid h-[46px] w-[46px] place-items-center rounded-xl text-[17px] font-semibold transition-colors duration-200 ${
                      pa ? "bg-aksent text-ark" : "bg-flate hover:bg-valgt"
                    } ${x.kode.length > 2 ? "text-[12px]" : ""}`}
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
          <p className="mt-2 text-liten text-blekk-svak">
            Trykk {tastekart.size > 0 ? "tasten" : "på verdien"}. Du kan endre
            den senere.
          </p>

          <div className="mt-[22px]">
            <Overskrift>Tidligere i faget</Overskrift>
            <div className="text-liten leading-[1.7] text-blekk-dempet">
              {tidligere?.vurderinger.map((t, i) => (
                <div key={i}>
                  {t.tittel}
                  {t.dato ? ` ${kort2(t.dato)}` : ""} · <b>{t.kode}</b>
                </div>
              ))}
              {tidligere && tidligere.innsats.length > 0 && (
                <div>
                  Innsats siste {tidligere.innsats.length} økter ·{" "}
                  {tidligere.innsats.map((f, i) => (
                    <span
                      key={i}
                      style={{
                        color:
                          f === "gronn"
                            ? "#3f9d49"
                            : f === "gul"
                              ? "#d9a92f"
                              : f === "rod"
                                ? "#c04a3d"
                                : "#d5d8dd",
                      }}
                    >
                      ●
                    </span>
                  ))}
                </div>
              )}
              {tidligere &&
                tidligere.vurderinger.length === 0 &&
                tidligere.innsats.length === 0 && (
                  <span className="text-blekk-svak">Ingenting ført ennå.</span>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Overskrift({
  children,
  ingenMarg,
}: {
  children: React.ReactNode;
  ingenMarg?: boolean;
}) {
  return (
    <div
      className={`text-[11px] font-semibold uppercase tracking-[.06em] text-blekk-svak ${
        ingenMarg ? "" : "mb-2"
      }`}
    >
      {children}
    </div>
  );
}

function kort2(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return `${d.getDate()}.${d.getMonth() + 1}`;
}
