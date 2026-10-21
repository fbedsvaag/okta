import { useEffect, useMemo, useRef, useState } from "react";
import type { FagIAr } from "../data/fag";
import type { Skolear } from "../data/skolear";
import { hentFridager } from "../data/skolear";
import {
  endreOkt,
  hentOkter,
  hentOktVurderinger,
  type Okt,
  type OktVurdering,
} from "../data/okter";
import {
  hentPerioder,
  hentPeriodemal,
  settPeriodemal,
  type Periode,
} from "../data/perioder";
import { finnFag, type Kompetansemaal } from "../data/grep";
import { lytt } from "../data/endringer";
import { ukenummer, type Fridag } from "../data/kalender";
import {
  baklengs,
  grenser,
  lagStripe,
  nyFordeling,
  nyPeriode,
  oktertall,
  spennene,
  tildel,
  tilOkt,
  type Endring,
  type Plass,
  type Spenn,
} from "../data/aret";
import { visToast } from "../ui/Toast";
import { leggTilAngring } from "../ui/angre";
import { Vurderingsikon } from "../ui/Vurderingsikon";

/** Fargene en ny periode kan få (lerretet Arsplanlegger). */
const NYFARGER = [
  "#e0563b",
  "#f08a24",
  "#1aa37a",
  "#2b8fb8",
  "#6a4fa0",
  "#d43d8c",
  "#5b8c3a",
  "#a98b5d",
];

/** Et enkelt klikk på en tom del av året lager en periode på så mange økter. */
const STANDARD = 8;

const kort = (dato: string) =>
  new Date(`${dato}T12:00:00`)
    .toLocaleDateString("nb-NO", {
      weekday: "short",
      day: "numeric",
      month: "numeric",
    })
    .replace(".", "")
    .replace(/\.$/, "");

const iDag = () => new Date().toLocaleDateString("sv-SE");

type Utkast = { id: string | null; fra: number; til: number };

/**
 * Skoleåret i faget (ARBEIDSLISTE 20.6, lerretet Arsplanlegger): hele året
 * som én stripe av økter, periodene som felt på den, og under dem perioder
 * med økter til venstre og kompetansemålene til høyre.
 *
 * Perioden står på økta (SPEC §3.3): alt som dras her, setter perioden på
 * øktene i spennet. Se data/aret.ts.
 */
export function Aret({ skolear, fag }: { skolear: Skolear; fag: FagIAr }) {
  const [okter, setOkter] = useState<Okt[]>([]);
  const [fridager, setFridager] = useState<Fridag[]>([]);
  const [perioder, setPerioder] = useState<Periode[]>([]);
  const [koblinger, setKoblinger] = useState<Map<string, string[]>>(new Map());
  const [vurderinger, setVurderinger] = useState<Map<string, OktVurdering[]>>(
    new Map(),
  );
  const [maal, setMaal] = useState<Kompetansemaal[] | null>(null);
  const [valgt, setValgt] = useState<string | null>(null);
  const [apne, setApne] = useState<Set<string>>(new Set());
  const [utkast, setUtkast] = useState<Utkast | null>(null);
  const [ny, setNy] = useState<{ fra: number; til: number } | null>(null);
  const [nyNavn, setNyNavn] = useState("");
  const [nyFarge, setNyFarge] = useState(NYFARGER[0]);
  const [skjema, setSkjema] = useState(false);
  const [spokelse, setSpokelse] = useState<{
    x: number;
    y: number;
    p: Periode;
  } | null>(null);
  const stripeRef = useRef<HTMLDivElement>(null);

  async function last() {
    const [o, f, p, k, v] = await Promise.all([
      hentOkter(skolear.id),
      hentFridager(skolear.id),
      hentPerioder(fag.id),
      hentPeriodemal(fag.id),
      hentOktVurderinger(skolear.id),
    ]);
    setOkter(
      o.filter(
        (x) =>
          x.skolearFagId === fag.id &&
          x.dato >= skolear.start &&
          x.dato <= skolear.slutt,
      ),
    );
    setFridager(f);
    setPerioder(p);
    setKoblinger(k);
    setVurderinger(v);
  }

  useEffect(() => {
    void last();
    void finnFag(fag.grepKode).then((g) => setMaal(g?.kompetansemaal ?? []));
    return lytt(() => void last());
  }, [fag.id, skolear.id]);

  // Esc og klikk utenfor tar bort valget, og avbryter en ny periode.
  useEffect(() => {
    const tast = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if ((e.target as HTMLElement).closest?.("input")) return;
      setValgt(null);
      setNy(null);
      setSkjema(false);
    };
    window.addEventListener("keydown", tast);
    return () => window.removeEventListener("keydown", tast);
  }, []);

  const stripe = useMemo(() => lagStripe(okter, fridager), [okter, fridager]);
  const N = stripe.length;
  const lagret = useMemo(() => spennene(stripe), [stripe]);

  // Mens noe dras, vises stripa slik den blir.
  const vist = useMemo(() => {
    if (!utkast?.id) return lagret;
    const e = nyFordeling(stripe, utkast.id, utkast.fra, utkast.til);
    const ny = new Map(e.map((x) => [x.oktId, x.til]));
    return spennene(
      stripe.map((p) =>
        p.slag === "okt" && ny.has(p.okt.id)
          ? { ...p, okt: { ...p.okt, periodeId: ny.get(p.okt.id)! } }
          : p,
      ),
    );
  }, [lagret, utkast, stripe]);

  const perId = useMemo(
    () => new Map(perioder.map((p) => [p.id, p])),
    [perioder],
  );
  const plasserte = perioder
    .filter((p) => vist.has(p.id))
    .sort((a, b) => vist.get(a.id)!.fra - vist.get(b.id)!.fra);
  const ute = perioder.filter((p) => !vist.has(p.id));
  const totalt = oktertall(stripe, 0, N - 1);
  const medPeriode = [...lagret.values()].reduce((s, x) => s + x.antall, 0);

  const spennTekst = (fra: number, til: number) => {
    const a = tilOkt(stripe, fra, 1);
    const b = tilOkt(stripe, til, -1);
    return `${kort(stripe[a].dato)} → ${kort(stripe[b].dato)}`;
  };

  // ------------------------------------------------------------- lagring

  async function bruk(endringer: Endring[], tekst: string) {
    if (endringer.length === 0) return;
    const stripeNa = stripe;
    // Vises med en gang; lagringen går etterpå.
    const ny = new Map(endringer.map((e) => [e.oktId, e.til]));
    setOkter((l) =>
      l.map((o) => (ny.has(o.id) ? { ...o, periodeId: ny.get(o.id)! } : o)),
    );
    await tildel(endringer, stripeNa);
    const angring = {
      tekst,
      angre: async () => {
        const naa = lagStripe(
          (await hentOkter(skolear.id)).filter(
            (o) => o.skolearFagId === fag.id,
          ),
          fridager,
        );
        await tildel(baklengs(endringer), naa);
      },
    };
    leggTilAngring(angring);
    visToast(tekst, { angring });
  }

  // ---------------------------------------------------------------- dra

  function plassVed(x: number): number {
    const r = stripeRef.current!.getBoundingClientRect();
    return Math.floor(((x - r.left) / r.width) * N);
  }

  function dra(e: React.PointerEvent, id: string, modus: "flytt" | "v" | "h") {
    e.preventDefault();
    e.stopPropagation();
    const s0 = lagret.get(id);
    if (!s0) return;
    const bredde = stripeRef.current!.getBoundingClientRect().width / N;
    const x0 = e.clientX;
    const lengde = s0.til - s0.fra;
    const g = grenser(lagret, id, s0.fra, N);
    // Naboene: en ende kan skyve grensen, men naboen beholder én økt.
    const naboer = [...lagret.entries()].filter(([k]) => k !== id);
    const forrige = naboer
      .filter(([, s]) => s.til < s0.fra)
      .sort((a, b) => b[1].til - a[1].til)[0]?.[1];
    const neste = naboer
      .filter(([, s]) => s.fra > s0.til)
      .sort((a, b) => a[1].fra - b[1].fra)[0]?.[1];
    let flyttet = false;
    let siste: Utkast = { id, fra: s0.fra, til: s0.til };

    const flytt = (ev: PointerEvent) => {
      const d = Math.round((ev.clientX - x0) / bredde);
      if (d !== 0) flyttet = true;
      let fra = s0.fra;
      let til = s0.til;
      if (modus === "flytt") {
        fra = Math.max(g.min, Math.min(g.maks - lengde, s0.fra + d));
        fra = tilOkt(stripe, fra, d >= 0 ? 1 : -1);
        til = Math.min(g.maks, fra + lengde);
        til = tilOkt(stripe, til, -1);
        if (til < fra) til = fra;
      } else if (modus === "h") {
        const maks = neste ? tilOkt(stripe, neste.til - 1, -1) : N - 1;
        til = Math.max(
          s0.fra,
          Math.min(
            neste && neste.antall < 2 ? neste.fra - 1 : maks,
            s0.til + d,
          ),
        );
        til = tilOkt(stripe, til, -1);
      } else {
        const min = forrige ? tilOkt(stripe, forrige.fra + 1, 1) : 0;
        fra = Math.min(
          s0.til,
          Math.max(
            forrige && forrige.antall < 2 ? forrige.til + 1 : min,
            s0.fra + d,
          ),
        );
        fra = tilOkt(stripe, fra, 1);
      }
      siste = { id, fra, til };
      setUtkast(siste);
    };
    const slipp = () => {
      window.removeEventListener("pointermove", flytt);
      window.removeEventListener("pointerup", slipp);
      setUtkast(null);
      if (!flyttet) {
        setValgt((v) => (v === id ? null : id));
        return;
      }
      setValgt(id);
      const p = perId.get(id);
      void bruk(
        nyFordeling(stripe, id, siste.fra, siste.til),
        `«${p?.navn}»: ${spennTekst(siste.fra, siste.til)} · ${oktertall(stripe, siste.fra, siste.til)} økter`,
      );
    };
    setUtkast(siste);
    window.addEventListener("pointermove", flytt);
    window.addEventListener("pointerup", slipp);
  }

  /** Dra over en tom del av året: en ny periode. */
  function stripeNed(e: React.PointerEvent) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest(".aret-bar, .aret-skjema, .aret-vm"))
      return;
    if (skjema) {
      setNy(null);
      setSkjema(false);
      return;
    }
    const a0 = plassVed(e.clientX);
    if (a0 < 0 || a0 >= N) return;
    const g = grenser(lagret, null, a0, N);
    if (a0 < g.min || a0 > g.maks) return;
    e.preventDefault();
    const a = tilOkt(stripe, a0, 1);
    setValgt(null);
    setNy({ fra: a, til: a });
    let sist = { fra: a, til: a };
    const flytt = (ev: PointerEvent) => {
      const b = Math.max(g.min, Math.min(g.maks, plassVed(ev.clientX)));
      sist = {
        fra: tilOkt(stripe, Math.min(a, b), 1),
        til: tilOkt(stripe, Math.max(a, b), -1),
      };
      setNy(sist);
    };
    const slipp = () => {
      window.removeEventListener("pointermove", flytt);
      window.removeEventListener("pointerup", slipp);
      if (sist.til - sist.fra < 1) sist = medOkter(sist.fra, g.maks, STANDARD);
      setNy(sist);
      setNyNavn("");
      setSkjema(true);
    };
    window.addEventListener("pointermove", flytt);
    window.addEventListener("pointerup", slipp);
  }

  /** Fra `fra`: så mange økter som er plass til før `maks`. */
  function medOkter(fra: number, maks: number, antall: number) {
    let til = fra;
    let n = 0;
    for (let i = fra; i <= maks && n < antall; i++)
      if (stripe[i].slag === "okt") {
        n++;
        til = i;
      }
    return { fra, til };
  }

  async function lagNy() {
    const navn = nyNavn.trim();
    if (!navn || !ny) return;
    setSkjema(false);
    const id = await nyPeriode(fag.id, navn, nyFarge);
    const spenn = ny;
    setNy(null);
    setValgt(id);
    setApne((a) => new Set(a).add(id));
    const naa = lagStripe(
      (await hentOkter(skolear.id)).filter((o) => o.skolearFagId === fag.id),
      fridager,
    );
    await bruk(
      nyFordeling(naa, id, spenn.fra, spenn.til),
      `«${navn}» laget: ${spennTekst(spenn.fra, spenn.til)}`,
    );
    await last();
  }

  /** Dra en periode som ikke er lagt inn, fra lista og inn på året. */
  function draFraLista(e: React.PointerEvent, p: Periode) {
    e.preventDefault();
    e.stopPropagation();
    setSpokelse({ x: e.clientX, y: e.clientY, p });
    const flytt = (ev: PointerEvent) =>
      setSpokelse({ x: ev.clientX, y: ev.clientY, p });
    const slipp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", flytt);
      window.removeEventListener("pointerup", slipp);
      setSpokelse(null);
      const r = stripeRef.current!.getBoundingClientRect();
      if (ev.clientY < r.top - 20 || ev.clientY > r.bottom + 20) return;
      const a0 = plassVed(ev.clientX);
      if (a0 < 0 || a0 >= N) return;
      const g = grenser(lagret, null, a0, N);
      if (a0 < g.min || a0 > g.maks) {
        visToast("Slipp perioden på en ledig del av året");
        return;
      }
      const s = medOkter(tilOkt(stripe, a0, 1), g.maks, STANDARD);
      setValgt(p.id);
      void bruk(
        nyFordeling(stripe, p.id, s.fra, s.til),
        `«${p.navn}» lagt inn: ${spennTekst(s.fra, s.til)}`,
      );
    };
    window.addEventListener("pointermove", flytt);
    window.addEventListener("pointerup", slipp);
  }

  // -------------------------------------------------------------- tegning

  const v = valgt ? perId.get(valgt) : undefined;
  const vSpenn = v ? lagret.get(v.id) : undefined;
  const idagPlass = stripe.findIndex((p) => p.dato >= iDag());
  const vurderingsplasser = stripe.flatMap((p, i) =>
    p.slag === "okt"
      ? (vurderinger.get(p.okt.id) ?? []).map((vu) => ({ i, vu }))
      : [],
  );
  const dekning = (kode: string) =>
    plasserte.filter((p) => (koblinger.get(p.id) ?? []).includes(kode));
  const dekket = (maal ?? []).filter((m) => dekning(m.kode).length > 0).length;

  if (okter.length === 0)
    return (
      <p className="py-10 text-brod text-blekk-dempet">
        {fag.kode} har ingen økter i skoleåret ennå. Lag dem i Økter (+ Serie),
        så kan året planlegges her.
      </p>
    );

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-3.5"
      onClick={() => setValgt(null)}
    >
      <div className="flex shrink-0 items-end gap-5">
        <div>
          <h1 className="text-[calc(30px*var(--tekst-skala))] font-light tracking-overskrift">
            Skoleåret i {fag.kode}
          </h1>
          <p className="mt-0.5 text-liten text-blekk-dempet">
            {v
              ? "Dra perioden sidelengs eller i endene. Den hopper til øktene dine. Esc eller klikk utenfor for å se hele året."
              : "Dra periodene inn på året, eller dra over en tom del av året for å lage en ny. Klikk en periode for å knytte mål."}
          </p>
        </div>
        <span className="grow" />
        <div className="w-80">
          <div className="flex justify-between text-[calc(12.5px*var(--tekst-skala))]">
            <span>
              <b className="font-semibold tabular-nums">{medPeriode}</b> av{" "}
              {totalt} økter har periode
            </span>
            <span className={medPeriode >= totalt ? "text-god" : "text-varsel"}>
              {medPeriode >= totalt
                ? "Alle økter har periode"
                : `${totalt - medPeriode} uten periode`}
            </span>
          </div>
          <div className="mt-1.5 flex h-1.5 gap-0.5 overflow-hidden rounded-[3px] bg-stripe">
            {plasserte.map((p) => (
              <span
                key={p.id}
                className="aret-glid"
                style={{
                  width: `${((lagret.get(p.id)?.antall ?? 0) / totalt) * 100}%`,
                  background: p.farge ?? "var(--color-blekk-svak)",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Stripa: hele året, økt for økt. */}
      <div
        ref={stripeRef}
        className="aret-stripe"
        style={{ "--w": `calc(100% / ${N})` } as React.CSSProperties}
        onPointerDown={stripeNed}
        onClick={(e) => e.stopPropagation()}
      >
        {stripe.map((p, i) => {
          const forrige = stripe[i - 1];
          const nyMnd =
            !forrige || forrige.dato.slice(5, 7) !== p.dato.slice(5, 7);
          const nyUke =
            !!forrige && ukenummer(p.dato) !== ukenummer(forrige.dato);
          return (
            <div
              key={i}
              className={`aret-plass ${p.slag === "ferie" ? "ferie" : ""} ${
                nyMnd ? "mnd" : nyUke ? "uke" : ""
              }`}
              style={{ left: `calc(${i} * var(--w))` }}
              title={`${kort(p.dato)}${p.slag === "ferie" ? ` · ${p.navn}` : ""}`}
            />
          );
        })}
        {stripe.map((p, i) => {
          const forrige = stripe[i - 1];
          if (forrige && forrige.dato.slice(5, 7) === p.dato.slice(5, 7))
            return null;
          return (
            <span
              key={`m${i}`}
              className="aret-mnd"
              style={{ left: `calc(${i} * var(--w) + 4px)` }}
            >
              {new Date(`${p.dato}T12:00:00`)
                .toLocaleDateString("nb-NO", {
                  month: "short",
                })
                .replace(".", "")}
            </span>
          );
        })}
        {idagPlass > 0 && (
          <>
            <span
              className="aret-na"
              style={{ left: `calc(${idagPlass} * var(--w))` }}
            />
            <span
              className="aret-na-tekst"
              style={{ left: `calc(${idagPlass} * var(--w) + 5px)` }}
            >
              I dag
            </span>
          </>
        )}
        {vurderingsplasser.map(({ i, vu }) => (
          <span
            key={`${vu.id}-${i}`}
            className="aret-vm"
            style={{ left: `calc(${i} * var(--w) + var(--w) / 2)` }}
          >
            <Vurderingsikon type={vu.type} />
            <span className="aret-vm-tips">
              {vu.tittel} · {kort(stripe[i].dato)}
            </span>
          </span>
        ))}

        {ny && (
          <div
            className="aret-nybar"
            style={{
              left: `calc(${ny.fra} * var(--w) + 1px)`,
              width: `calc(${ny.til - ny.fra + 1} * var(--w) - 2px)`,
              borderColor: nyFarge,
              background: `color-mix(in srgb, ${nyFarge} 14%, transparent)`,
            }}
          >
            <span className="truncate tabular-nums">
              {spennTekst(ny.fra, ny.til)} · {oktertall(stripe, ny.fra, ny.til)}{" "}
              økter
            </span>
          </div>
        )}
        {skjema && ny && (
          <div
            className="aret-skjema glass-meny"
            style={{
              left: `min(calc(${ny.fra} * var(--w)), calc(100% - 330px))`,
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="text-etikett tabular-nums text-blekk-dempet">
              Ny periode · {spennTekst(ny.fra, ny.til)} ·{" "}
              {oktertall(stripe, ny.fra, ny.til)} økter
            </div>
            <input
              autoFocus
              value={nyNavn}
              onChange={(e) => setNyNavn(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void lagNy();
                }
                if (e.key === "Escape") {
                  e.stopPropagation();
                  setNy(null);
                  setSkjema(false);
                }
              }}
              placeholder="Navn på perioden"
              className="aret-nyinp"
            />
            <div className="mt-2.5 flex gap-1.5">
              {NYFARGER.map((c) => (
                <button
                  key={c}
                  aria-label={`Farge ${c}`}
                  aria-pressed={nyFarge === c}
                  onClick={() => setNyFarge(c)}
                  className="aret-nysw"
                  style={{ background: c }}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-etikett text-blekk-svak">
                ↵ lag · esc avbryt
              </span>
              <span className="grow" />
              <button
                onClick={() => {
                  setNy(null);
                  setSkjema(false);
                }}
                className="h-7 rounded-full border border-linje px-3 text-liten"
              >
                Avbryt
              </button>
              <button
                onClick={() => void lagNy()}
                disabled={!nyNavn.trim()}
                className="h-7 rounded-full bg-aksent px-3 text-liten font-medium text-ark disabled:opacity-45"
              >
                Lag periode
              </button>
            </div>
          </div>
        )}

        {plasserte.map((p) => {
          const s = vist.get(p.id)!;
          const drar = utkast?.id === p.id;
          return (
            <div
              key={p.id}
              className={`aret-bar ${drar ? "drar" : ""} ${valgt === p.id ? "valgt" : ""} ${
                v && v.id !== p.id ? "dempet" : ""
              }`}
              style={{
                left: `calc(${s.fra} * var(--w) + 1px)`,
                width: `calc(${s.til - s.fra + 1} * var(--w) - 2px)`,
                background: p.farge ?? "var(--color-blekk-dempet)",
              }}
              onPointerDown={(e) => dra(e, p.id, "flytt")}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="aret-bar-inn">
                {p.navn}
                <small className="tabular-nums">
                  {s.antall} økter · {kort(stripe[s.fra].dato)}
                </small>
              </div>
              <span
                className="aret-hk v"
                onPointerDown={(e) => dra(e, p.id, "v")}
              />
              <span
                className="aret-hk h"
                onPointerDown={(e) => dra(e, p.id, "h")}
              />
              {drar && (
                <div className="aret-boble tabular-nums">
                  {spennTekst(s.fra, s.til)} · {s.antall} økter
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[430px_minmax(0,1fr)] gap-6">
        {/* Perioder og økter */}
        <div
          className="flex min-h-0 flex-col gap-2 overflow-auto pb-16 pl-0.5 pr-1 pt-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-baseline gap-2">
            <b className="text-[calc(14px*var(--tekst-skala))] font-semibold">
              Perioder og økter
            </b>
            <span className="text-etikett text-blekk-svak">
              ▸ viser øktene · skriv tema rett inn, ↵ går til neste
            </span>
          </div>
          {[...plasserte, ...ute].map((p) => (
            <Periodekort
              key={p.id}
              p={p}
              spenn={lagret.get(p.id) ?? null}
              stripe={stripe}
              valgt={valgt === p.id}
              apen={apne.has(p.id)}
              mal={(koblinger.get(p.id) ?? [])
                .map((k) => (maal ?? []).findIndex((m) => m.kode === k) + 1)
                .filter((n) => n > 0)
                .sort((a, b) => a - b)}
              vurderinger={vurderinger}
              spennTekst={spennTekst}
              onVelg={() => setValgt(valgt === p.id ? null : p.id)}
              onFold={() =>
                setApne((a) => {
                  const n = new Set(a);
                  if (n.has(p.id)) n.delete(p.id);
                  else n.add(p.id);
                  return n;
                })
              }
              onDra={(e) => draFraLista(e, p)}
              onTema={(id, tema) => {
                setOkter((l) =>
                  l.map((o) => (o.id === id ? { ...o, tema } : o)),
                );
                void endreOkt(id, { tema });
              }}
            />
          ))}
          {v && vSpenn && (
            <button
              onClick={() => {
                const e = nyFordeling(stripe, v.id, vSpenn.fra, vSpenn.til);
                if (e.length === 0)
                  visToast(`Alle øktene i spennet har perioden «${v.navn}»`);
                else
                  void bruk(e, `${e.length} økter fikk perioden «${v.navn}»`);
              }}
              className="mt-1.5 self-start rounded-full border border-linje bg-ark px-3.5 py-1.5 text-liten hover:bg-flate"
            >
              Gi {oktertall(stripe, vSpenn.fra, vSpenn.til)} økter perioden «
              {v.navn}»
            </button>
          )}
        </div>

        {/* Kompetansemål */}
        <div
          className="flex min-h-0 flex-col overflow-auto pb-10"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-1.5 flex h-[26px] items-center gap-2">
            <b className="text-[calc(14px*var(--tekst-skala))] font-semibold">
              Kompetansemål
            </b>
            {v ? (
              <>
                <span className="text-etikett text-blekk-svak">
                  klikk for å knytte til
                </span>
                <button
                  onClick={() => setValgt(null)}
                  className="inline-flex h-6 items-center gap-1.5 rounded-full pl-2.5 pr-1.5 text-etikett text-white"
                  style={{ background: v.farge ?? "var(--color-blekk-dempet)" }}
                >
                  {v.navn}
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-white/25">
                    ✕
                  </span>
                </button>
              </>
            ) : (
              <span className="text-etikett text-blekk-svak">
                hvor godt hvert mål er dekket gjennom året
              </span>
            )}
            <span className="grow" />
            {maal && maal.length > 0 && (
              <span className="text-etikett text-blekk-dempet">
                {dekket} av {maal.length} dekket
              </span>
            )}
          </div>
          {maal === null ? null : maal.length === 0 ? (
            <p className="text-liten text-blekk-dempet">
              {fag.kode} har ingen fagkode fra Udir. Legg den inn under Rediger
              fag, så står kompetansemålene her.
            </p>
          ) : (
            maal.map((m, i) => {
              const koblet =
                !!v && (koblinger.get(v.id) ?? []).includes(m.kode);
              const dek = dekning(m.kode);
              return (
                <button
                  key={m.kode}
                  onClick={async () => {
                    if (!v) return;
                    setKoblinger((k) => {
                      const n = new Map(k);
                      const l = n.get(v.id) ?? [];
                      n.set(
                        v.id,
                        koblet ? l.filter((x) => x !== m.kode) : [...l, m.kode],
                      );
                      return n;
                    });
                    await settPeriodemal(v.id, m.kode, !koblet);
                  }}
                  className={`aret-mal ${koblet ? "koblet" : ""} ${v ? "" : "cursor-default"}`}
                  style={
                    {
                      "--pc": v?.farge ?? "var(--color-aksent)",
                    } as React.CSSProperties
                  }
                >
                  {v ? (
                    <span className="aret-bx">
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        aria-hidden
                      >
                        <path
                          d="M1.5 5.2l2.2 2.2L8.5 2.6"
                          stroke="#fff"
                          strokeWidth="1.8"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  ) : (
                    <span className="text-center text-etikett tabular-nums text-blekk-svak">
                      {i + 1}
                    </span>
                  )}
                  <span
                    className={`min-w-0 truncate text-left ${dek.length ? "" : "text-blekk-dempet"}`}
                    title={m.tekst}
                  >
                    {m.tekst}
                  </span>
                  <span className="flex items-center justify-end gap-2">
                    {dek.length === 0 ? (
                      <span className="text-etikett font-medium text-feil">
                        Ikke dekket
                      </span>
                    ) : (
                      <>
                        <span className="flex gap-[3px]">
                          {dek.map((p) => (
                            <i
                              key={p.id}
                              className="h-2 w-2 rounded-full"
                              title={p.navn}
                              style={{ background: p.farge ?? undefined }}
                            />
                          ))}
                        </span>
                        <span className="text-etikett font-medium text-god">
                          ✓ Dekket
                        </span>
                      </>
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {spokelse && (
        <div
          className="aret-spokelse"
          style={{
            left: spokelse.x,
            top: spokelse.y,
            background: spokelse.p.farge ?? "var(--color-blekk-dempet)",
          }}
        >
          {spokelse.p.navn}
        </div>
      )}
    </div>
  );
}

/** Én periode i lista, med øktene foldet ut under. */
function Periodekort({
  p,
  spenn,
  stripe,
  valgt,
  apen,
  mal,
  vurderinger,
  spennTekst,
  onVelg,
  onFold,
  onDra,
  onTema,
}: {
  p: Periode;
  spenn: Spenn | null;
  stripe: Plass[];
  valgt: boolean;
  apen: boolean;
  mal: number[];
  vurderinger: Map<string, OktVurdering[]>;
  spennTekst: (fra: number, til: number) => string;
  onVelg: () => void;
  onFold: () => void;
  onDra: (e: React.PointerEvent) => void;
  onTema: (oktId: string, tema: string | null) => void;
}) {
  const plasser = spenn ? stripe.slice(spenn.fra, spenn.til + 1) : [];
  const vurd = plasser.flatMap((x) =>
    x.slag === "okt"
      ? (vurderinger.get(x.okt.id) ?? []).map((v) => ({ v, dato: x.dato }))
      : [],
  );
  const liste = useRef<HTMLDivElement>(null);
  const flyttFokus = (fra: HTMLInputElement, retning: 1 | -1) => {
    const felt = [
      ...(liste.current?.querySelectorAll<HTMLInputElement>("input") ?? []),
    ];
    felt[felt.indexOf(fra) + retning]?.focus();
  };

  return (
    <div>
      <div
        onClick={onVelg}
        className={`aret-pk ${valgt ? "valgt" : ""} ${spenn ? "" : "ute"}`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (spenn) onFold();
          }}
          className={`aret-pil ${apen && spenn ? "ned" : ""}`}
          title="Vis øktene"
          disabled={!spenn}
        >
          ▶
        </button>
        {!spenn && (
          <span
            className="cursor-grab touch-none text-[13px] tracking-[-1px] text-blekk-svakest"
            onPointerDown={onDra}
            title="Dra inn på året"
          >
            ⋮⋮
          </span>
        )}
        <span
          className="h-3 w-3 shrink-0 rounded-[4px]"
          style={{ background: p.farge ?? "var(--color-linje-sterk)" }}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[calc(13.5px*var(--tekst-skala))] font-medium">
            {p.navn}
          </span>
          <span className="block text-etikett tabular-nums text-blekk-svak">
            {spenn
              ? `${spennTekst(spenn.fra, spenn.til)} · ${spenn.antall} økter`
              : "ikke lagt inn · dra den inn på året"}
          </span>
          {vurd.map(({ v, dato }) => (
            <span
              key={`${v.id}-${dato}`}
              className="mt-0.5 flex min-w-0 items-center gap-1.5 text-etikett text-blekk-svak"
            >
              <span className="shrink-0">Vurdering:</span>
              <span className="truncate text-blekk-dempet">{v.tittel}</span>
              <span className="shrink-0 tabular-nums">{kort(dato)}</span>
            </span>
          ))}
        </span>
        <span className="flex gap-[3px]">
          {mal.map((n) => (
            <span
              key={n}
              className="rounded-[5px] bg-flate px-[5px] py-px text-[10.5px] tabular-nums text-blekk-dempet"
            >
              {n}
            </span>
          ))}
        </span>
      </div>
      {apen && spenn && (
        <div
          ref={liste}
          className="aret-okl"
          style={
            { "--pc": p.farge ?? "var(--color-aksent)" } as React.CSSProperties
          }
        >
          {plasser.map((x, i) =>
            x.slag === "ferie" ? (
              plasser[i - 1]?.slag === "ferie" &&
              (plasser[i - 1] as { navn: string }).navn === x.navn ? null : (
                <div key={`f${i}`} className="aret-ferie">
                  {x.navn}
                </div>
              )
            ) : x.okt.periodeId !== p.id ? null : (
              <div key={x.okt.id} className="aret-or">
                <span className="text-etikett tabular-nums text-blekk-svak">
                  {kort(x.dato)}
                </span>
                <span className="grid place-items-center">
                  {(vurderinger.get(x.okt.id) ?? [])[0] && (
                    <Vurderingsikon
                      type={(vurderinger.get(x.okt.id) ?? [])[0].type}
                    />
                  )}
                </span>
                <input
                  defaultValue={x.okt.tema ?? ""}
                  key={x.okt.tema ?? ""}
                  placeholder={
                    (vurderinger.get(x.okt.id) ?? [])[0]?.tittel ??
                    "Skriv tema …"
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "ArrowDown") {
                      e.preventDefault();
                      flyttFokus(e.currentTarget, 1);
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      flyttFokus(e.currentTarget, -1);
                    } else if (e.key === "Escape") e.currentTarget.blur();
                  }}
                  onBlur={(e) => {
                    const t = e.target.value.trim() || null;
                    if (t !== x.okt.tema) onTema(x.okt.id, t);
                  }}
                />
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
