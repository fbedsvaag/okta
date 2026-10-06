import { useEffect, useMemo, useRef, useState } from "react";
import { confirm as bekreft } from "@tauri-apps/plugin-dialog";
import {
  DELER,
  RUTE,
  endreRom,
  hentKart,
  hentRom,
  opprettRom,
  plasserIRom,
  romMal,
  storrelse,
  type Del,
  type Deltype,
  type Rotasjon,
} from "../data/klassekart";
import { nyId } from "../db";
import { IVerktoylinja } from "../ui/Verktoylinje";

/**
 * Rediger rom (SPEC §4.11, lerretet «KlassekartRom»).
 *
 * Start fra en mal, eller dra inn pulter, kateter, tavle, dør og vinduer.
 * Delene fester seg til et rutenett på 20 px. Valgt del får en liten
 * verktøylinje — Roter, Dupliser, Slett — og tastene R, ⌘D, ⌫ og piltaster
 * (én rute). Plassene nummereres forfra og fra venstre mens du tegner.
 */
export function KlassekartRom({
  romId,
  skolearId,
  onFerdig,
}: {
  /** null = nytt rom */
  romId: string | null;
  skolearId: string;
  /** etter Lagre eller Avbryt; id-en til rommet når det ble lagret */
  onFerdig: (romId: string | null) => void;
}) {
  const [navn, setNavn] = useState("Nytt rom");
  const [deler, setDeler] = useState<Del[]>([]);
  const [valgt, setValgt] = useState<string | null>(null);
  const [brukesAv, setBrukesAv] = useState<string[]>([]);
  const [endret, setEndret] = useState(false);
  const [lastet, setLastet] = useState(romId === null);
  const flate = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void (async () => {
      const kart = await hentKart(skolearId);
      if (romId) {
        const rom = (await hentRom()).find((r) => r.id === romId);
        if (rom) {
          setNavn(rom.navn);
          setDeler(rom.deler);
        }
        setBrukesAv(
          kart.filter((k) => k.romId === romId).map((k) => k.kildeNavn),
        );
      } else {
        setDeler(medId(romMal("par")));
      }
      setLastet(true);
    })();
  }, [romId, skolearId]);

  function endre(f: (d: Del[]) => Del[]) {
    setDeler(f);
    setEndret(true);
  }

  const plasser = useMemo(() => plasserIRom(deler), [deler]);
  const nummer = useMemo(() => {
    const m = new Map<string, { nr: number; x: number; y: number }[]>();
    for (const p of plasser)
      m.set(p.delId, [...(m.get(p.delId) ?? []), { nr: p.nr, x: p.x, y: p.y }]);
    return m;
  }, [plasser]);

  // Flaten er minst så stor som vinduet, og vokser med det som er tegnet.
  const bredde = Math.max(
    1000,
    ...deler.map((d) => d.x + storrelse(d).b + RUTE * 4),
  );
  const hoyde = Math.max(
    640,
    ...deler.map((d) => d.y + storrelse(d).h + RUTE * 4),
  );

  // ------------------------------------------------------------- å dra

  // En del som flyttes på flaten: hvor på delen musa tok tak.
  const flytt = useRef<{ id: string; dx: number; dy: number } | null>(null);
  // En ny del som dras inn fra lista til venstre.
  const [ny, setNy] = useState<{
    type: Deltype;
    x: number;
    y: number;
    flyttet: boolean;
  } | null>(null);
  const nyRef = useRef(ny);
  nyRef.current = ny;

  function iFlaten(klientX: number, klientY: number) {
    const r = flate.current!.getBoundingClientRect();
    return {
      x: klientX - r.left,
      y: klientY - r.top,
      inni:
        klientX >= r.left &&
        klientX <= r.right &&
        klientY >= r.top &&
        klientY <= r.bottom,
    };
  }
  const fest = (v: number) => Math.max(0, Math.round(v / RUTE) * RUTE);

  function leggTil(type: Deltype, x: number, y: number) {
    const s = storrelse({ type, rot: 0 });
    const del: Del = {
      id: nyId(),
      type,
      x: fest(x - s.b / 2),
      y: fest(y - s.h / 2),
      rot: 0,
    };
    endre((d) => [...d, del]);
    setValgt(del.id);
  }

  useEffect(() => {
    if (!ny) return;
    const flytter = (e: PointerEvent) =>
      setNy((n) => n && { ...n, x: e.clientX, y: e.clientY, flyttet: true });
    const slipp = (e: PointerEvent) => {
      const n = nyRef.current;
      setNy(null);
      if (!n) return;
      const p = iFlaten(e.clientX, e.clientY);
      if (p.inni) leggTil(n.type, p.x, p.y);
      else if (!n.flyttet) {
        // Et klikk uten å dra: midt i det synlige utsnittet.
        const r = flate.current!.parentElement!;
        leggTil(
          n.type,
          r.scrollLeft + r.clientWidth / 2,
          r.scrollTop + r.clientHeight / 2,
        );
      }
    };
    window.addEventListener("pointermove", flytter);
    window.addEventListener("pointerup", slipp);
    return () => {
      window.removeEventListener("pointermove", flytter);
      window.removeEventListener("pointerup", slipp);
    };
  }, [ny !== null]);

  // ------------------------------------------------------------ handlinger

  function roter(id: string) {
    endre((ds) =>
      ds.map((d) => {
        if (d.id !== id) return d;
        const for_ = storrelse(d);
        const rot = ((d.rot + 90) % 360) as Rotasjon;
        const etter = storrelse({ ...d, rot });
        // Roter rundt midten, så delen blir stående der den sto.
        return {
          ...d,
          rot,
          x: fest(d.x + (for_.b - etter.b) / 2),
          y: fest(d.y + (for_.h - etter.h) / 2),
        };
      }),
    );
  }

  function dupliser(id: string) {
    const d = deler.find((x) => x.id === id);
    if (!d) return;
    const kopi = { ...d, id: nyId(), x: d.x + RUTE * 2, y: d.y + RUTE * 2 };
    endre((ds) => [...ds, kopi]);
    setValgt(kopi.id);
  }

  function slett(id: string) {
    endre((ds) => ds.filter((d) => d.id !== id));
    setValgt(null);
  }

  useEffect(() => {
    const tast = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.("input, textarea")) return;
      if (!valgt) return;
      const piler: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      if (piler[e.key]) {
        e.preventDefault();
        const [dx, dy] = piler[e.key];
        endre((ds) =>
          ds.map((d) =>
            d.id === valgt
              ? {
                  ...d,
                  x: Math.max(0, d.x + dx * RUTE),
                  y: Math.max(0, d.y + dy * RUTE),
                }
              : d,
          ),
        );
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        dupliser(valgt);
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        slett(valgt);
      } else if (e.key.toLowerCase() === "r" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        roter(valgt);
      } else if (e.key === "Escape") {
        e.stopPropagation();
        setValgt(null);
      }
    };
    window.addEventListener("keydown", tast);
    return () => window.removeEventListener("keydown", tast);
  });

  async function brukMal(mal: Parameters<typeof romMal>[0]) {
    if (
      deler.length > 0 &&
      endret &&
      !(await bekreft("Erstatte det du har tegnet med malen?"))
    )
      return;
    setDeler(medId(romMal(mal)));
    setEndret(true);
    setValgt(null);
  }

  async function lagre() {
    const n = navn.trim() || "Rom";
    if (romId) {
      await endreRom(romId, { navn: n, deler });
      onFerdig(romId);
    } else onFerdig(await opprettRom(n, deler));
  }

  async function avbryt() {
    if (endret && !(await bekreft("Forkaste endringene i rommet?"))) return;
    onFerdig(null);
  }

  const valgtDel = deler.find((d) => d.id === valgt);

  if (!lastet) return null;

  return (
    <div className="flex min-h-0 flex-1 gap-5">
      <IVerktoylinja>
        <input
          aria-label="Romnavn"
          value={navn}
          onChange={(e) => {
            setNavn(e.target.value);
            setEndret(true);
          }}
          className="w-40 rounded-md bg-transparent px-2 py-1 text-[calc(15px*var(--tekst-skala))] font-semibold shadow-[inset_0_0_0_1px_var(--color-linje)] outline-none focus:shadow-[inset_0_0_0_1.5px_var(--color-aksent)]"
        />
        <span className="truncate text-liten text-blekk-dempet">
          {plasser.length} plasser
          {brukesAv.length > 0 && ` · brukes av ${ogListe(brukesAv)}`}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          <button
            onClick={() => void avbryt()}
            className="flex h-8 items-center rounded-full px-3.5 text-brod text-blekk-dempet hover:bg-flate"
          >
            Avbryt
          </button>
          <button
            onClick={() => void lagre()}
            className="flex h-8 items-center rounded-full bg-aksent px-3.5 text-brod font-medium text-ark hover:bg-aksent-mork"
          >
            Lagre rom
          </button>
        </span>
      </IVerktoylinja>

      {/* Malene og delene, til venstre. */}
      <aside
        aria-label="Rommaler og møbler"
        className="flex w-[232px] shrink-0 flex-col gap-4 overflow-auto"
      >
        <div>
          <h2 className="px-1 pb-2 text-[calc(13px*var(--tekst-skala))] font-semibold">
            Start fra en mal
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {MALER.map((m) => (
              <button
                key={m.id}
                onClick={() => void brukMal(m.id)}
                className="flex flex-col gap-1.5 rounded-lg border-[1.5px] border-linje-medium bg-ark p-2 text-left hover:border-linje-sterk"
              >
                <Minimal mal={m.id} />
                <span className="text-[calc(12px*var(--tekst-skala))] font-medium">
                  {m.navn}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <h2 className="px-1 pb-1.5 text-[calc(13px*var(--tekst-skala))] font-semibold">
            Dra inn
          </h2>
          {(Object.keys(DELER) as Deltype[]).map((t) => (
            <button
              key={t}
              onPointerDown={(e) => {
                e.preventDefault();
                setNy({ type: t, x: e.clientX, y: e.clientY, flyttet: false });
              }}
              className="flex h-[34px] w-full cursor-grab items-center gap-2.5 rounded-[7px] px-2.5 text-left text-[calc(13px*var(--tekst-skala))] hover:bg-flate"
            >
              <span className="flex w-[26px] justify-center">
                <Delikon type={t} />
              </span>
              {DELER[t].navn}
            </button>
          ))}
        </div>
        <p className="mt-auto px-1 text-[calc(12px*var(--tekst-skala))] leading-[1.7] text-blekk-dempet">
          <Kbd>⌘D</Kbd> dupliser · <Kbd>⌫</Kbd> slett
          <br />
          <Kbd>R</Kbd> roter · piltaster flytter én rute
        </p>
      </aside>

      {/* Rommet. */}
      <div className="relative min-h-0 min-w-0 flex-1 overflow-auto rounded-xl bg-[#fbfafd] shadow-[inset_0_0_0_1px_var(--color-linje-medium)] dark:bg-flate-svak">
        <div
          ref={flate}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setValgt(null);
          }}
          className="relative"
          style={{
            width: bredde,
            height: hoyde,
            backgroundImage:
              "radial-gradient(var(--color-linje) 1px, transparent 1px)",
            backgroundSize: `${RUTE}px ${RUTE}px`,
          }}
        >
          {deler.map((d) => (
            <Romdel
              key={d.id}
              del={d}
              valgt={d.id === valgt}
              nummer={nummer.get(d.id) ?? []}
              onPointerDown={(e) => {
                e.stopPropagation();
                setValgt(d.id);
                const p = iFlaten(e.clientX, e.clientY);
                flytt.current = { id: d.id, dx: p.x - d.x, dy: p.y - d.y };
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                const f = flytt.current;
                if (!f || f.id !== d.id) return;
                const p = iFlaten(e.clientX, e.clientY);
                const x = fest(p.x - f.dx);
                const y = fest(p.y - f.dy);
                if (x !== d.x || y !== d.y)
                  endre((ds) =>
                    ds.map((z) => (z.id === d.id ? { ...z, x, y } : z)),
                  );
              }}
              onPointerUp={() => (flytt.current = null)}
            />
          ))}

          {valgtDel && (
            <div
              className="glass-matt absolute z-10 flex gap-1 rounded-full p-1"
              style={{
                left: valgtDel.x + storrelse(valgtDel).b / 2,
                top: Math.max(4, valgtDel.y - 44),
                transform: "translateX(-50%)",
              }}
            >
              <Verktoy onClick={() => roter(valgtDel.id)}>Roter</Verktoy>
              <Verktoy onClick={() => dupliser(valgtDel.id)}>Dupliser</Verktoy>
              <Verktoy farlig onClick={() => slett(valgtDel.id)}>
                Slett
              </Verktoy>
            </div>
          )}
        </div>
        <span className="pointer-events-none sticky bottom-3 float-right mr-4 text-[calc(12px*var(--tekst-skala))] text-blekk-svak">
          Rutenett 20 px · delene fester seg
        </span>
      </div>

      {ny && ny.flyttet && (
        <div
          className="pointer-events-none fixed z-50 opacity-70"
          style={{
            left: ny.x - DELER[ny.type].b / 2,
            top: ny.y - DELER[ny.type].h / 2,
          }}
        >
          <Romdel
            del={{ id: "", type: ny.type, x: 0, y: 0, rot: 0 }}
            valgt={false}
            nummer={[]}
          />
        </div>
      )}
    </div>
  );
}

const MALER: { id: Parameters<typeof romMal>[0]; navn: string }[] = [
  { id: "par", navn: "Par i rader" },
  { id: "hestesko", navn: "Hestesko" },
  { id: "grupper4", navn: "Grupper á 4" },
  { id: "enkelt", navn: "Enkeltpulter" },
];

function medId(deler: Omit<Del, "id">[]): Del[] {
  return deler.map((d) => ({ ...d, id: nyId() }));
}

/** «MFL2», «MFL2 og ENG1», «MFL2, ENG1 og 2STA» */
function ogListe(navn: string[]): string {
  return navn.length <= 1
    ? (navn[0] ?? "")
    : `${navn.slice(0, -1).join(", ")} og ${navn[navn.length - 1]}`;
}

/** Én del i rommet, slik den står. */
export function Romdel({
  del,
  valgt,
  nummer,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  del: Del;
  valgt: boolean;
  /** plassnumrene på delen, med midtpunkt i rommet */
  nummer: { nr: number; x: number; y: number }[];
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
}) {
  const { b, h } = storrelse(del);
  const erPult = DELER[del.type].plasser.length > 0;
  const ring = valgt
    ? "inset 0 0 0 2px var(--color-aksent), 0 0 0 4px var(--color-valgt)"
    : undefined;
  const felles = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    "aria-label": DELER[del.type].navn,
  };
  const plass = { left: del.x, top: del.y, width: b, height: h };

  if (erPult)
    return (
      <div
        {...felles}
        className={`absolute cursor-grab touch-none rounded-[7px] active:cursor-grabbing ${valgt ? "bg-ark" : "bg-flate"}`}
        style={{
          ...plass,
          boxShadow: ring ?? "inset 0 0 0 1.5px var(--color-linje)",
        }}
      >
        {nummer.map((n) => (
          <span
            key={n.nr}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-[11px] tabular-nums text-blekk-svak"
            style={{ left: n.x - del.x, top: n.y - del.y }}
          >
            {n.nr}
          </span>
        ))}
      </div>
    );

  if (del.type === "tavle")
    return (
      <div
        {...felles}
        className="absolute flex cursor-grab touch-none items-center justify-center rounded-[4px] bg-blekk-svak text-[10px] tracking-[0.06em] text-ark"
        style={{ ...plass, boxShadow: ring }}
      >
        TAVLE
      </div>
    );

  if (del.type === "kateter")
    return (
      <div
        {...felles}
        className="absolute flex cursor-grab touch-none items-center justify-center rounded-[7px] bg-ark text-[12px] text-blekk-svak"
        style={{
          ...plass,
          boxShadow: ring ?? "inset 0 0 0 1.5px var(--color-linje)",
        }}
      >
        Kateter
      </div>
    );

  if (del.type === "vindu")
    return (
      <div
        {...felles}
        className="absolute cursor-grab touch-none"
        style={{ ...plass, boxShadow: ring }}
        title="Vinduer"
      >
        <span
          className="absolute inset-x-0 top-1/2 -translate-y-1/2"
          style={
            del.rot % 180 === 0
              ? {
                  height: 4,
                  background:
                    "repeating-linear-gradient(90deg, var(--color-linje-sterk) 0 12px, transparent 12px 18px)",
                }
              : {
                  left: "50%",
                  top: 0,
                  bottom: 0,
                  width: 4,
                  transform: "translateX(-50%)",
                  background:
                    "repeating-linear-gradient(180deg, var(--color-linje-sterk) 0 12px, transparent 12px 18px)",
                }
          }
        />
      </div>
    );

  // Døra: en kvartsirkel som viser hvilken vei den slår.
  return (
    <div
      {...felles}
      className="absolute cursor-grab touch-none"
      style={{ ...plass, boxShadow: ring }}
      title="Dør"
    >
      <span
        className="absolute inset-0"
        style={{
          borderLeft: "2px solid var(--color-linje-sterk)",
          borderTop: "2px solid var(--color-linje-sterk)",
          borderTopLeftRadius: "100%",
          transform: `rotate(${del.rot}deg)`,
        }}
      />
    </div>
  );
}

function Verktoy({
  onClick,
  farlig,
  children,
}: {
  onClick: () => void;
  farlig?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      className={`h-[26px] rounded-full px-2.5 text-[12px] hover:bg-flate ${farlig ? "text-feil" : "text-blekk"}`}
    >
      {children}
    </button>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-[18px] items-center rounded border border-linje bg-ark px-[5px] text-[11px] text-blekk">
      {children}
    </span>
  );
}

function Delikon({ type }: { type: Deltype }) {
  const fyll = "var(--color-linje-sterk)";
  if (type === "dor")
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <path
          d="M3 15V3h1M3 3a12 12 0 0112 12"
          fill="none"
          stroke="var(--color-blekk-svak)"
          strokeWidth="1.5"
        />
      </svg>
    );
  const m: Record<Exclude<Deltype, "dor">, React.CSSProperties> = {
    enkelt: { width: 14, height: 10, borderRadius: 2, background: fyll },
    dobbel: { width: 24, height: 10, borderRadius: 2, background: fyll },
    gruppe4: { width: 18, height: 18, borderRadius: 3, background: fyll },
    gruppe6: { width: 24, height: 16, borderRadius: 3, background: fyll },
    kateter: {
      width: 22,
      height: 12,
      borderRadius: 2,
      boxShadow: "inset 0 0 0 1.5px var(--color-blekk-svak)",
    },
    tavle: {
      width: 24,
      height: 5,
      borderRadius: 2,
      background: "var(--color-blekk-svak)",
    },
    vindu: {
      width: 24,
      height: 4,
      background:
        "repeating-linear-gradient(90deg, var(--color-blekk-svak) 0 6px, transparent 6px 9px)",
    },
  };
  return <span style={m[type]} />;
}

/** Små forhåndsvisninger av malene, som på lerretet. */
function Minimal({ mal }: { mal: Parameters<typeof romMal>[0] }) {
  const monster: Record<typeof mal, { kol: number; celler: boolean[] }> = {
    par: { kol: 6, celler: rep([1, 1, 0], 6) },
    hestesko: {
      kol: 5,
      celler: [1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1].map(Boolean),
    },
    grupper4: {
      kol: 5,
      celler: [1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1].map(
        Boolean,
      ),
    },
    enkelt: { kol: 5, celler: Array(15).fill(true) },
  };
  const m = monster[mal];
  return (
    <span
      className="grid h-[54px] content-center justify-center gap-[3px]"
      style={{
        gridTemplateColumns: `repeat(${m.kol}, ${mal === "enkelt" ? 8 : 10}px)`,
        gridAutoRows: 7,
        columnGap: mal === "enkelt" ? 6 : 3,
      }}
    >
      {m.celler.map((c, i) => (
        <span
          key={i}
          className="rounded-[2px] bg-linje-sterk"
          style={{ visibility: c ? "visible" : "hidden" }}
        />
      ))}
    </span>
  );
}

function rep(m: number[], n: number): boolean[] {
  return Array.from({ length: n }, () => m)
    .flat()
    .map(Boolean);
}
