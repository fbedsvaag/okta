import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FagIAr } from "../data/fag";
import type { Skolear } from "../data/skolear";
import { hentInnstilling, settInnstilling } from "../data/skolear";
import { lyttElever, lyttKlassekart } from "../data/endringer";
import {
  hentKlassen,
  panel as regnPanel,
  parNokkel,
  startplass,
  steg,
  STANDARDKREFTER,
  type Klassen as KlassenData,
  type Krefter,
  type Punkt,
} from "../data/relasjoner";
import { Elevfoto } from "../ui/Elevfoto";
import { useArk } from "../ui/Arkstabel";
import { useLagretInnstilling } from "../ui/useLagretInnstilling";
import { IVerktoylinja } from "../ui/Verktoylinje";

const LILLA = "#7d6bb0";
const BLA = "#4f7ac0";
const GRONNBLA = "#2f9a8a";

type Kamera = { k: number; tx: number; ty: number };
const STANDARDKAMERA: Kamera = { k: 1, tx: 0, ty: 0 };

const les = <T,>(v: string | null, std: T): T => {
  try {
    return v ? { ...std, ...JSON.parse(v) } : std;
  } catch {
    return std;
  }
};

const rolig = () =>
  document.documentElement.dataset.bevegelse === "av" ||
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Klassen — relasjonskart i faget (ARBEIDSLISTE 26.9–26.10, lerretet
 * KlasseRelasjoner). Elever som ofte har vært sammen, havner nær
 * hverandre: en enkel kraftsimulering (frastøtning, fjær langs båndene,
 * svak tyngde mot midten) med høy demping, som stopper helt i ro. Bare for
 * læreren: ingenting her går ut av appen.
 */
export function Klassen({ skolear, fag }: { skolear: Skolear; fag: FagIAr }) {
  const ark = useArk();
  const [data, setData] = useState<KlassenData | null>(null);
  const [vis, setVis] = useLagretInnstilling(
    "klassen_vis",
    { g: true, p: true, o: true },
    (v) => les(v, { g: true, p: true, o: true }),
    JSON.stringify,
  );
  const [krefter, setKrefter] = useLagretInnstilling<Krefter>(
    `klassen_krefter_${fag.id}`,
    STANDARDKREFTER,
    (v) => les(v, STANDARDKREFTER),
    JSON.stringify,
  );
  const [stort, setStort] = useLagretInnstilling(
    "klassen_stort",
    false,
    (v) => v === "1",
    (v) => (v ? "1" : "0"),
  );
  const [kamera, setKamera] = useState<Kamera>(STANDARDKAMERA);
  const [valgt, setValgt] = useState<string | null>(null);
  const [drar, setDrar] = useState<number | null>(null);
  const [hov, setHov] = useState<number | null>(null);
  const [kApen, setKApen] = useState(false);
  const [, setTikk] = useState(0);
  const pos = useRef<Punkt[]>([]);
  const alfa = useRef(0);
  const fast = useRef(-1);
  const raf = useRef(0);
  const flate = useRef<HTMLDivElement>(null);
  const [str, setStr] = useState({ b: 800, h: 600 });

  // Data, og plasseringen og kameraet fra sist.
  useEffect(() => {
    let avbrutt = false;
    const last = async () => {
      const k = await hentKlassen(skolear.id, fag.id);
      if (avbrutt) return;
      const lagret = les<Record<string, [number, number]>>(
        await hentInnstilling(`klassen_pos_${fag.id}`),
        {},
      );
      const ny = startplass(k.elever.length, fjaerFor(k), krefter);
      k.elever.forEach((e, i) => {
        const f = pos.current.length ? undefined : lagret[e.id];
        if (f) {
          ny[i].x = f[0];
          ny[i].y = f[1];
        }
      });
      // Behold der elevene står når data lastes på nytt.
      const gammel = new Map(
        (data?.elever ?? []).map((e, i) => [e.id, pos.current[i]]),
      );
      k.elever.forEach((e, i) => {
        const g = gammel.get(e.id);
        if (g) ny[i] = { ...g };
      });
      pos.current = ny;
      setData(k);
      setKamera(
        les(await hentInnstilling(`klassen_kamera_${fag.id}`), STANDARDKAMERA),
      );
    };
    void last();
    const a = lyttKlassekart(() => void last());
    const b = lyttElever(() => void last());
    return () => {
      avbrutt = true;
      a();
      b();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skolear.id, fag.id]);

  // Størrelsen på flaten.
  useLayoutEffect(() => {
    const el = flate.current;
    if (!el) return;
    const o = new ResizeObserver(() =>
      setStr({ b: el.clientWidth, h: el.clientHeight }),
    );
    o.observe(el);
    return () => o.disconnect();
  }, [data !== null, stort]);

  // Kameraet huskes per fag, litt etter at det sluttet å bevege seg.
  useEffect(() => {
    const t = window.setTimeout(
      () =>
        void settInnstilling(
          `klassen_kamera_${fag.id}`,
          JSON.stringify(kamera),
        ),
      600,
    );
    return () => window.clearTimeout(t);
  }, [kamera, fag.id]);

  const fjaer = useMemo(() => (data ? fjaerFor(data) : []), [data]);

  /** Varmer opp simuleringen; den går til den er i ro, og stopper. */
  // Det ferske, så en løkke som går, bruker kreftene som gjelder nå.
  const fersk = useRef({ fjaer, krefter });
  fersk.current = { fjaer, krefter };

  function varm(a = 0.3) {
    if (rolig()) {
      // Uten bevegelse: regn ferdig med en gang, og vis resultatet.
      if (fast.current >= 0) return;
      let al = Math.max(alfa.current, a);
      for (let i = 0; i < 500 && al > 0.004; i++)
        al = steg(pos.current, fersk.current.fjaer, fersk.current.krefter, al);
      alfa.current = 0;
      setTikk((t) => t + 1);
      lagrePos();
      return;
    }
    alfa.current = Math.max(alfa.current, a);
    if (raf.current) return;
    const tikk = () => {
      alfa.current = steg(
        pos.current,
        fersk.current.fjaer,
        fersk.current.krefter,
        alfa.current,
        fast.current,
      );
      setTikk((t) => t + 1);
      if (alfa.current < 0.004 && fast.current < 0) {
        raf.current = 0;
        lagrePos();
        return;
      }
      raf.current = requestAnimationFrame(tikk);
    };
    raf.current = requestAnimationFrame(tikk);
  }
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  useEffect(() => {
    // En endring i kreftene skal synes: kartet varmes godt opp.
    if (data) varm(0.9);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [krefter]);

  function lagrePos() {
    if (!data) return;
    const ut: Record<string, [number, number]> = {};
    data.elever.forEach((e, i) => {
      const p = pos.current[i];
      if (p) ut[e.id] = [Math.round(p.x), Math.round(p.y)];
    });
    void settInnstilling(`klassen_pos_${fag.id}`, JSON.stringify(ut));
  }

  // Rulling og klyp: ⌘ eller klyp zoomer rundt pekeren, ellers flytt.
  useEffect(() => {
    const el = flate.current;
    if (!el) return;
    const hjul = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        setKamera((c) => {
          const k = Math.min(
            4,
            Math.max(0.35, c.k * Math.exp(-e.deltaY * 0.01)),
          );
          const px = e.clientX - r.left - r.width / 2;
          const py = e.clientY - r.top - r.height / 2;
          const wx = (px - c.tx) / c.k;
          const wy = (py - c.ty) / c.k;
          return { k, tx: px - wx * k, ty: py - wy * k };
        });
      } else
        setKamera((c) => ({ ...c, tx: c.tx - e.deltaX, ty: c.ty - e.deltaY }));
    };
    el.addEventListener("wheel", hjul, { passive: false });
    return () => el.removeEventListener("wheel", hjul);
  }, [data !== null, stort]);

  if (!data) return null;
  if (data.elever.length === 0)
    return (
      <p className="py-10 text-center text-brod text-blekk-dempet">
        {fag.kode} har ingen elever ennå.
      </p>
    );

  const indeks = new Map(data.elever.map((e, i) => [e.id, i]));
  const kort = (id: string) => {
    const e = data.elever[indeks.get(id) ?? -1];
    return e
      ? `${e.fornavn} ${e.etternavn ? `${e.etternavn[0]}.` : ""}`.trim()
      : "?";
  };
  const sx = (p: Punkt) => str.b / 2 + kamera.tx + p.x * kamera.k;
  const sy = (p: Punkt) => str.h / 2 + kamera.ty + p.y * kamera.k;
  const tilVerden = (cx: number, cy: number) => {
    const r = flate.current!.getBoundingClientRect();
    return {
      x: (cx - r.left - str.b / 2 - kamera.tx) / kamera.k,
      y: (cy - r.top - str.h / 2 - kamera.ty) / kamera.k,
    };
  };

  // Fokus: eleven som dras eller er valgt; de uten relasjon tones ned.
  const fokus = drar !== null ? data.elever[drar]?.id : (valgt ?? null);
  const relatert = new Set<string>();
  if (fokus) {
    relatert.add(fokus);
    for (const b of data.band)
      if (b.a === fokus) relatert.add(b.b);
      else if (b.b === fokus) relatert.add(b.a);
    for (const o of data.onsker)
      if (o.elevId === fokus) relatert.add(o.onskerElevId);
      else if (o.onskerElevId === fokus) relatert.add(o.elevId);
  }
  const dempet = (id: string) => !!fokus && !relatert.has(id);
  const kantDempet = (a: string, b: string) =>
    !!fokus && a !== fokus && b !== fokus;
  const onskeSett = new Set(
    data.onsker.map((o) => `${o.elevId}>${o.onskerElevId}`),
  );
  const gjensidig = (a: string, b: string) =>
    onskeSett.has(`${a}>${b}`) && onskeSett.has(`${b}>${a}`);

  function begynnDra(e: React.PointerEvent, i: number) {
    e.preventDefault();
    e.stopPropagation();
    const x0 = e.clientX;
    const y0 = e.clientY;
    let flyttet = false;
    const flytt = (ev: PointerEvent) => {
      if (!flyttet && Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 4)
        return;
      if (!flyttet) {
        flyttet = true;
        setDrar(i);
        fast.current = i;
      }
      const w = tilVerden(ev.clientX, ev.clientY);
      pos.current[i].x = w.x;
      pos.current[i].y = w.y;
      if (rolig()) setTikk((t) => t + 1);
      else varm(0.3);
    };
    const slipp = () => {
      window.removeEventListener("pointermove", flytt);
      window.removeEventListener("pointerup", slipp);
      fast.current = -1;
      setDrar(null);
      if (!flyttet) {
        const id = data!.elever[i].id;
        setValgt((v) => (v === id ? null : id));
      } else if (rolig()) lagrePos();
      else varm(0.3);
    };
    window.addEventListener("pointermove", flytt);
    window.addEventListener("pointerup", slipp);
  }

  function begynnPanorer(e: React.PointerEvent) {
    if (e.button !== 0) return;
    const x0 = e.clientX;
    const y0 = e.clientY;
    const c0 = kamera;
    let flyttet = false;
    const flytt = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) > 3)
        flyttet = true;
      setKamera({
        ...c0,
        tx: c0.tx + ev.clientX - x0,
        ty: c0.ty + ev.clientY - y0,
      });
    };
    const slipp = () => {
      window.removeEventListener("pointermove", flytt);
      window.removeEventListener("pointerup", slipp);
      if (!flyttet) setValgt(null);
    };
    window.addEventListener("pointermove", flytt);
    window.addEventListener("pointerup", slipp);
  }

  function midtstill() {
    const p = pos.current;
    if (p.length === 0) return;
    const xs = p.map((q) => q.x);
    const ys = p.map((q) => q.y);
    const [x1, x2, y1, y2] = [
      Math.min(...xs),
      Math.max(...xs),
      Math.min(...ys),
      Math.max(...ys),
    ];
    const k = Math.min(
      4,
      Math.max(
        0.35,
        Math.min(
          (str.b - 120) / (x2 - x1 || 1),
          (str.h - 100) / (y2 - y1 || 1),
        ),
      ),
    );
    setKamera({ k, tx: -((x1 + x2) / 2) * k, ty: -((y1 + y2) / 2) * k });
  }

  const p = pos.current;
  const panel = regnPanel(data);
  const vEl = valgt ? data.elever[indeks.get(valgt) ?? -1] : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <IVerktoylinja>
        <span className="ml-auto text-liten text-blekk-dempet">
          {data.elever.length} elever · bare for deg
        </span>
      </IVerktoylinja>
      <div
        className="grid min-h-0 flex-1 gap-6"
        style={{
          gridTemplateColumns: stort
            ? "minmax(0,1fr) 0px"
            : "minmax(0,1fr) 300px",
          transition: "grid-template-columns 360ms cubic-bezier(.22,1,.36,1)",
        }}
      >
        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-etikett text-blekk-dempet">Vis</span>
            <Filter
              pa={vis.g}
              onBytt={() => setVis({ ...vis, g: !vis.g })}
              strek={
                <line
                  x1="0"
                  y1="4"
                  x2="22"
                  y2="4"
                  stroke={LILLA}
                  strokeWidth="3"
                  strokeOpacity=".6"
                  strokeLinecap="round"
                />
              }
            >
              Grupper
            </Filter>
            <Filter
              pa={vis.p}
              onBytt={() => setVis({ ...vis, p: !vis.p })}
              strek={
                <line
                  x1="0"
                  y1="4"
                  x2="22"
                  y2="4"
                  stroke={BLA}
                  strokeWidth="2.5"
                  strokeDasharray="4 3"
                  strokeLinecap="round"
                />
              }
            >
              Sidemann
            </Filter>
            <Filter
              pa={vis.o}
              onBytt={() => setVis({ ...vis, o: !vis.o })}
              strek={
                <>
                  <line
                    x1="0"
                    y1="4"
                    x2="17"
                    y2="4"
                    stroke={GRONNBLA}
                    strokeWidth="1.8"
                  />
                  <path d="M16 1l5 3-5 3z" fill={GRONNBLA} />
                </>
              }
            >
              Ønsker
            </Filter>
            <span className="flex-1" />
            <span className="relative">
              <button
                onClick={() => setKApen((v) => !v)}
                className="flex h-[30px] items-center gap-1.5 rounded-full border border-linje-sterk bg-ark px-3 text-[13px] hover:bg-flate"
              >
                Krefter <span className="text-[11px] text-blekk-svak">⌄</span>
              </button>
              {kApen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setKApen(false)}
                  />
                  <div className="absolute right-0 top-[38px] z-40 w-[280px] rounded-2xl bg-ark p-3.5 shadow-[0_18px_50px_rgba(36,31,51,.22),0_0_0_1px_rgba(36,31,51,.08)]">
                    <div className="mb-2.5 flex items-center">
                      <b className="text-[13px] font-semibold">Krefter</b>
                      <button
                        onClick={() => setKrefter(STANDARDKREFTER)}
                        className="ml-auto text-[12.5px] text-aksent hover:underline"
                      >
                        Tilbakestill
                      </button>
                    </div>
                    {(
                      [
                        [
                          "spredning",
                          "Spredning",
                          "hvor mye de skyver fra hverandre",
                          2000,
                          30000,
                          500,
                        ],
                        [
                          "stivhet",
                          "Stivhet",
                          "hvor hardt båndene drar",
                          1,
                          30,
                          1,
                        ],
                        [
                          "lengde",
                          "Båndlengde",
                          "avstand der et bånd er i ro",
                          80,
                          400,
                          10,
                        ],
                        ["midt", "Trekk mot midten", "", 0, 4, 0.1],
                      ] as const
                    ).map(([k, n, h, min, max, st]) => (
                      <label
                        key={k}
                        className="mb-2.5 flex flex-col gap-1 text-[12.5px]"
                      >
                        <span className="flex justify-between">
                          {n}
                          <small className="text-etikett text-blekk-svak">
                            {h}
                          </small>
                        </span>
                        <input
                          type="range"
                          min={min}
                          max={max}
                          step={st}
                          value={krefter[k]}
                          onChange={(e) =>
                            setKrefter({
                              ...krefter,
                              [k]: Number(e.target.value),
                            })
                          }
                          className="w-full accent-[var(--color-aksent)]"
                        />
                      </label>
                    ))}
                    <button
                      onClick={() =>
                        setKrefter({
                          spredning: Math.min(30000, krefter.spredning * 1.6),
                          stivhet: Math.max(1, krefter.stivhet * 0.6),
                          lengde: Math.min(400, krefter.lengde * 1.2),
                          midt: Math.max(0, krefter.midt * 0.4),
                        })
                      }
                      className="mt-1.5 h-[30px] w-full rounded-full border border-linje-sterk bg-ark text-[13px] hover:bg-flate"
                    >
                      Løs opp klumpen
                    </button>
                    <p className="mt-2 text-etikett text-blekk-svak">
                      Virker med en gang, og huskes for faget.
                    </p>
                  </div>
                </>
              )}
            </span>
            <button
              onClick={midtstill}
              title="Vis hele klassen"
              aria-label="Midtstill"
              className="grid h-[30px] w-[30px] place-items-center rounded-full border border-linje-sterk bg-ark text-[15px] hover:bg-flate"
            >
              ⌖
            </button>
            <button
              onClick={() => setStort(!stort)}
              title={
                stort ? "Vis panelet" : "Skjul panelet og gjør kartet stort"
              }
              className="flex h-[30px] items-center rounded-full border border-linje-sterk bg-ark px-3 text-[13px] hover:bg-flate"
            >
              {stort ? "Vis panelet" : "Stort kart"}
            </button>
          </div>

          <div
            ref={flate}
            onPointerDown={begynnPanorer}
            className="relative mt-2 min-h-0 flex-1 cursor-grab overflow-hidden rounded-[14px] bg-ark shadow-[inset_0_0_0_1px_var(--color-linje-svak)] active:cursor-grabbing"
          >
            <svg width={str.b} height={str.h} className="absolute inset-0">
              <defs>
                <marker
                  id="klassen-pil"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M0 0L10 5L0 10z" fill={GRONNBLA} />
                </marker>
              </defs>
              {data.band.map((b) => {
                const i = indeks.get(b.a)!;
                const j = indeks.get(b.b)!;
                const d = kantDempet(b.a, b.b);
                return (
                  <g key={parNokkel(b.a, b.b)}>
                    {vis.g && b.grupper > 0 && (
                      <line
                        x1={sx(p[i])}
                        y1={sy(p[i])}
                        x2={sx(p[j])}
                        y2={sy(p[j])}
                        stroke={LILLA}
                        strokeWidth={0.8 + Math.min(b.grupper, 5) * 0.9}
                        strokeOpacity={
                          d ? 0.05 : 0.22 + Math.min(b.grupper, 5) * 0.06
                        }
                        strokeLinecap="round"
                        style={{ transition: "stroke-opacity 220ms" }}
                      />
                    )}
                    {vis.p && b.sidemann > 0 && (
                      <line
                        x1={sx(p[i])}
                        y1={sy(p[i])}
                        x2={sx(p[j])}
                        y2={sy(p[j])}
                        stroke={BLA}
                        strokeWidth={0.8 + Math.min(b.sidemann, 5) * 0.8}
                        strokeOpacity={
                          d ? 0.05 : 0.3 + Math.min(b.sidemann, 5) * 0.06
                        }
                        strokeDasharray="5 4"
                        strokeLinecap="round"
                        style={{ transition: "stroke-opacity 220ms" }}
                      />
                    )}
                  </g>
                );
              })}
              {vis.o &&
                data.onsker.map((o) => {
                  const i = indeks.get(o.elevId)!;
                  const j = indeks.get(o.onskerElevId)!;
                  const begge = gjensidig(o.elevId, o.onskerElevId);
                  // Gjensidig: én tykk strek, tegnet én gang.
                  if (begge && o.elevId > o.onskerElevId) return null;
                  const ax = sx(p[i]);
                  const ay = sy(p[i]);
                  const bx = sx(p[j]);
                  const by = sy(p[j]);
                  const dd = Math.hypot(bx - ax, by - ay) || 1;
                  const q = 12 / dd;
                  const d = kantDempet(o.elevId, o.onskerElevId);
                  return (
                    <line
                      key={o.id}
                      x1={ax + (bx - ax) * q}
                      y1={ay + (by - ay) * q}
                      x2={bx - (bx - ax) * q}
                      y2={by - (by - ay) * q}
                      stroke={GRONNBLA}
                      strokeWidth={begge ? 4 : 1.8}
                      strokeOpacity={d ? 0.1 : 0.85}
                      markerEnd={begge ? undefined : "url(#klassen-pil)"}
                      strokeLinecap="round"
                      style={{ transition: "stroke-opacity 220ms" }}
                    />
                  );
                })}
            </svg>
            {data.elever.map((e, i) => {
              const x = sx(p[i]);
              const y = sy(p[i]);
              const pa = valgt === e.id || drar === i;
              const h = hov === i && drar === null;
              return (
                <div
                  key={e.id}
                  className="absolute"
                  style={{
                    left: x,
                    top: y,
                    opacity: dempet(e.id) ? 0.25 : 1,
                    transition: "opacity 220ms",
                    zIndex: h || pa ? 5 : 1,
                  }}
                >
                  <span
                    onPointerDown={(ev) => begynnDra(ev, i)}
                    onPointerEnter={() => setHov(i)}
                    onPointerLeave={() => setHov(null)}
                    className="absolute block cursor-pointer rounded-full"
                    style={{
                      width: pa ? 18 : 14,
                      height: pa ? 18 : 14,
                      left: pa ? -9 : -7,
                      top: pa ? -9 : -7,
                      background: pa
                        ? "var(--color-aksent)"
                        : "var(--color-ark)",
                      boxShadow: `inset 0 0 0 2px var(--color-aksent)`,
                    }}
                  />
                  {/* Hover: sirkelen blir elevbildet (26.9c). */}
                  <span
                    aria-hidden
                    className="klassen-foto pointer-events-none absolute -left-[22px] -top-[22px] block rounded-full"
                    style={{
                      opacity: h ? 1 : 0,
                      transform: h || rolig() ? "scale(1)" : "scale(.6)",
                      boxShadow:
                        "0 0 0 2.5px #fff, 0 4px 14px rgba(36,31,51,.22)",
                    }}
                  >
                    <Elevfoto elevId={e.id} storrelse={44} />
                  </span>
                  <span
                    className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap text-[12.5px] text-blekk"
                    style={{
                      top: h ? 26 : 10,
                      fontWeight: pa ? 600 : 500,
                      // En lys glorie, så navnet leses over strekene.
                      textShadow:
                        "0 0 2px var(--color-ark), 0 0 3px var(--color-ark), 0 0 5px var(--color-ark), 0 0 8px var(--color-ark)",
                      transition: "top 200ms cubic-bezier(.22,1,.36,1)",
                    }}
                  >
                    {e.fornavn}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-etikett leading-normal text-blekk-svak">
            Elever som ofte har vært sammen, havner nær hverandre. Dra i en
            elev, så følger båndene med. Klyp eller ⌘ og rull for å zoome, dra i
            bakgrunnen for å flytte.
          </p>
        </div>

        <div
          className="flex min-h-0 flex-col gap-5 overflow-auto pb-4"
          style={{
            opacity: stort ? 0 : 1,
            transition: "opacity 260ms",
            pointerEvents: stort ? "none" : undefined,
          }}
        >
          {vEl && (
            <div className="rounded-xl bg-flate-svak p-3.5 text-[13px]">
              <div className="flex items-center gap-2.5">
                <Elevfoto elevId={vEl.id} storrelse={30} />
                <b className="text-[14px] font-semibold">
                  {vEl.fornavn} {vEl.etternavn}
                </b>
              </div>
              {(() => {
                const mine = data.band.filter(
                  (b) => b.a === vEl.id || b.b === vEl.id,
                );
                const g = mine.filter((b) => b.grupper > 0).length;
                const s = mine.filter((b) => b.sidemann > 0).length;
                const vil = data.onsker.filter((o) => o.elevId === vEl.id);
                const av = data.onsker.filter((o) => o.onskerElevId === vEl.id);
                return (
                  <div className="mt-2 flex flex-col gap-0.5 text-blekk-dempet">
                    <span>
                      I gruppe med {g} · sidemann med {s}
                    </span>
                    {vil.length > 0 && (
                      <span>
                        Vil sitte med:{" "}
                        {vil.map((o) => kort(o.onskerElevId)).join(", ")}
                      </span>
                    )}
                    {av.length > 0 && (
                      <span>
                        Nevnt av: {av.map((o) => kort(o.elevId)).join(", ")}
                      </span>
                    )}
                  </div>
                );
              })()}
              <button
                onClick={() => ark.apneElev(vEl.id)}
                className="mt-2.5 h-[28px] rounded-full border border-linje-sterk bg-ark px-3 text-[12.5px] hover:bg-flate"
              >
                Åpne elevkort
              </button>
            </div>
          )}
          <Liste tittel="Gjensidige ønsker" tom="Ingen ennå.">
            {panel.gjensidige.map(([a, b]) => (
              <Navnelinje key={a + b} onKlikk={() => setValgt(a)}>
                {kort(a)} og {kort(b)}
              </Navnelinje>
            ))}
          </Liste>
          <Liste tittel="Ønsker som ikke er oppfylt ennå" tom="Ingen.">
            {panel.ikkeOppfylt.map(([a, b]) => (
              <Navnelinje key={a + b} onKlikk={() => setValgt(a)}>
                {kort(a)} {gjensidig(a, b) ? "og" : "→"} {kort(b)}
              </Navnelinje>
            ))}
          </Liste>
          <Liste tittel="Har vært sammen med færrest" tom="">
            {panel.ferrest.map((f) => (
              <Navnelinje key={f.id} onKlikk={() => setValgt(f.id)}>
                {kort(f.id)}{" "}
                <span className="text-blekk-svak">
                  {f.antall} {f.antall === 1 ? "elev" : "elever"}
                </span>
              </Navnelinje>
            ))}
          </Liste>
          <Liste
            tittel={`Ikke nevnt i noen samtale ennå (${panel.ikkeNevnt.length})`}
            tom="Alle er nevnt."
          >
            <p className="text-[12.5px] leading-normal text-blekk-dempet">
              {panel.ikkeNevnt.map(kort).join(", ")}
            </p>
            <p className="mt-1 text-etikett leading-normal text-blekk-svak">
              Betyr bare at ingenting er skrevet ned fra en samtale, ikke at
              eleven er alene.
            </p>
          </Liste>
          <p className="text-etikett leading-normal text-blekk-svak">
            Panelet regner på all historikk, uansett hva kartet viser. Bare for
            deg: kommer aldri med i eksport, utskrift eller Teams.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Fjærene: alle bånd og ønsker, uansett filter, så elevene står stille. */
function fjaerFor(k: KlassenData) {
  const i = new Map(k.elever.map((e, n) => [e.id, n]));
  const ut = new Map<string, { a: number; b: number; vekt: number }>();
  for (const b of k.band)
    ut.set(parNokkel(b.a, b.b), {
      a: i.get(b.a)!,
      b: i.get(b.b)!,
      vekt: b.grupper + b.sidemann,
    });
  for (const o of k.onsker) {
    const n = parNokkel(o.elevId, o.onskerElevId);
    const f = ut.get(n) ?? {
      a: i.get(o.elevId)!,
      b: i.get(o.onskerElevId)!,
      vekt: 0,
    };
    f.vekt += 1;
    ut.set(n, f);
  }
  return [...ut.values()].filter((f) => f.a !== undefined && f.b !== undefined);
}

function Filter({
  pa,
  onBytt,
  strek,
  children,
}: {
  pa: boolean;
  onBytt: () => void;
  strek: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onBytt}
      aria-pressed={pa}
      className={`flex h-[30px] items-center gap-1.5 rounded-full px-2.5 text-[13px] ${
        pa
          ? "text-blekk shadow-[inset_0_0_0_1.5px_var(--color-linje-sterk)]"
          : "text-blekk-dempet shadow-[inset_0_0_0_1px_var(--color-linje)]"
      }`}
    >
      <span
        className={`grid h-4 w-4 place-items-center rounded-[5px] ${
          pa
            ? "bg-aksent"
            : "shadow-[inset_0_0_0_1.5px_var(--color-linje-sterk)]"
        }`}
      >
        {pa && (
          <svg width="9" height="9" viewBox="0 0 10 10">
            <path
              d="M1.5 5.2l2.2 2.2L8.5 2.6"
              stroke="#fff"
              strokeWidth="1.8"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <svg width="22" height="8" style={{ opacity: pa ? 1 : 0.35 }}>
        {strek}
      </svg>
      {children}
    </button>
  );
}

function Liste({
  tittel,
  tom,
  children,
}: {
  tittel: string;
  tom: string;
  children: React.ReactNode;
}) {
  const har = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div>
      <h3 className="mb-1.5 text-[calc(13px*var(--tekst-skala))] font-semibold">
        {tittel}
      </h3>
      {har ? children : <p className="text-etikett text-blekk-svak">{tom}</p>}
    </div>
  );
}

function Navnelinje({
  onKlikk,
  children,
}: {
  onKlikk: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onKlikk}
      className="block w-full py-0.5 text-left text-[13px] hover:text-aksent"
    >
      {children}
    </button>
  );
}
