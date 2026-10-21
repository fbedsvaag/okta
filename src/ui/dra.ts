import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as Trykk,
} from "react";

/**
 * Dra og slipp, felles for hele appen (DESIGN.md §8). Mekanikken kommer fra
 * samtaletimeplanen, og alt som dras skal føles som den:
 *
 * - Kortet følger pekeren. De andre glir unna mens du drar, så du ser hvor
 *   det havner før du slipper.
 * - En nabo gjør plass så snart kortet dekker 30 % av den, ikke først ved
 *   midten (DEKK).
 * - Bevegelsen er 240 ms med myk slutt (DRATID), og kortet glir på plass
 *   ved slipp.
 * - Et trykk blir et drag først etter 4 px. Klikket etter et drag teller
 *   ikke (`draget`).
 *
 * Plassene er nummerert i grupper (dagene i timeplanen; én gruppe i en
 * vanlig liste). Posisjonene måles én gang når draget begynner, og
 * forskyvningene regnes fra dem, ikke fra en DOM som flytter seg.
 *
 * Elementene registreres med `reg(plass)`. Innholdet som skal gli på plass
 * etter slipp, merkes med `data-dra-innhold={nøkkel}`.
 */

export const DRATID = "240ms cubic-bezier(0.2, 0.8, 0.2, 1)";
/** Hvor mye av en nabo kortet må dekke før naboen gjør plass. */
export const DEKK = 0.3;
/** Så langt må pekeren flytte seg før et trykk blir et drag. */
const TERSKEL = 4;

export type Plass = { gruppe: number; nr: number };
/**
 * Hvor det dratte havner: foran eller etter plassen `nr` i `gruppe`. `bytt`:
 * gruppa er full, og de to bytter plass.
 */
export type Mal = { gruppe: number; nr: number; etter: boolean; bytt: boolean };

type Malt = { gruppe: number; nr: number; a: number; b: number };

/** Plassen det dratte får i gruppa si, når det slippes på `mal`. */
export function nyPlass(fra: Plass, mal: Mal): Plass {
  if (mal.bytt) return { gruppe: mal.gruppe, nr: mal.nr };
  const t = mal.etter ? mal.nr + 1 : mal.nr;
  if (mal.gruppe === fra.gruppe)
    return { gruppe: fra.gruppe, nr: t > fra.nr ? t - 1 : t };
  return { gruppe: mal.gruppe, nr: t };
}

/**
 * Hvor kortet havner, ut fra hvor kortet står, ikke pekeren. Mellom to
 * grupper avgjør midten av kortet. Rene tall, så regelen kan testes.
 */
export function finnMal(
  malt: Malt[],
  fra: Plass,
  d: number,
  full: (gruppe: number) => boolean = () => false,
): Mal | null {
  const egen = malt.find((m) => m.gruppe === fra.gruppe && m.nr === fra.nr);
  const andre = malt
    .filter((m) => !(m.gruppe === fra.gruppe && m.nr === fra.nr))
    .sort((x, y) => x.a - y.a);
  if (!egen || andre.length === 0) return null;
  const a = egen.a + d;
  const b = egen.b + d;
  const midt = (a + b) / 2;

  // Er gruppa kortet står over full, bytter de to plass (§4.10). Står
  // midten fortsatt på kortets egen plass, er det ingen å bytte med ennå.
  const over = andre.find((m) => midt >= m.a && midt < m.b);
  const hjemme = !over && midt >= egen.a && midt < egen.b;
  const under =
    over ??
    andre.reduce((best, m) =>
      Math.abs((m.a + m.b) / 2 - midt) < Math.abs((best.a + best.b) / 2 - midt)
        ? m
        : best,
    );
  if (!hjemme && under.gruppe !== fra.gruppe && full(under.gruppe))
    return { gruppe: under.gruppe, nr: under.nr, etter: false, bytt: true };

  // Hvor mange som står foran kortet nå.
  let foran = 0;
  for (const m of andre) {
    const lengde = m.b - m.a;
    const fraFor = m.a < egen.a;
    const erForan = fraFor
      ? !(a < m.b - lengde * DEKK)
      : b > m.a + lengde * DEKK;
    if (erForan) foran++;
    else break;
  }
  if (foran >= andre.length) {
    const siste = andre[andre.length - 1];
    return { gruppe: siste.gruppe, nr: siste.nr, etter: true, bytt: false };
  }
  const neste = andre[foran];
  const forrige = andre[foran - 1];
  if (
    forrige &&
    forrige.gruppe !== neste.gruppe &&
    midt < (forrige.b + neste.a) / 2
  )
    return { gruppe: forrige.gruppe, nr: forrige.nr, etter: true, bytt: false };
  return { gruppe: neste.gruppe, nr: neste.nr, etter: false, bytt: false };
}

/**
 * Hvor langt plassen `p` skal gli for å gi plass. Er alle like store, glir
 * den til nabplassen, målt: står noe fast imellom (lunsjen i timeplanen),
 * legger den seg ikke oppå det. Er de ulike store (feltene i tidslinjen),
 * glir den så langt det dratte er stort, med mellomrommet.
 */
export function forskyvning(
  malt: Malt[],
  fra: Plass,
  mal: Mal | null,
  p: Plass,
): number {
  if (!mal || mal.bytt) return 0;
  const t = mal.etter ? mal.nr + 1 : mal.nr;
  const { gruppe, nr } = p;
  let ny = nr;
  if (mal.gruppe === fra.gruppe) {
    if (gruppe !== fra.gruppe) return 0;
    if (t > fra.nr && nr > fra.nr && nr < t) ny = nr - 1;
    else if (t <= fra.nr && nr >= t && nr < fra.nr) ny = nr + 1;
  } else if (gruppe === fra.gruppe && nr > fra.nr) ny = nr - 1;
  else if (gruppe === mal.gruppe && nr >= t) ny = nr + 1;
  if (ny === nr) return 0;

  const egen = malt.find((m) => m.gruppe === fra.gruppe && m.nr === fra.nr);
  const lengde = egen ? egen.b - egen.a : 0;
  const her = malt.find((m) => m.gruppe === gruppe && m.nr === nr);
  const like = malt.every((m) => Math.abs(m.b - m.a - lengde) < 1);
  if (!like && egen && her) {
    // Mellomrommet mellom to naboer i gruppa.
    const i = malt.filter((m) => m.gruppe === gruppe).sort((x, y) => x.a - y.a);
    const k = i.indexOf(her);
    const nabo = i[k + 1] ?? i[k - 1];
    const glipe = nabo
      ? Math.max(0, nabo.a > her.a ? nabo.a - her.b : her.a - nabo.b)
      : 0;
    return (ny > nr ? 1 : -1) * (lengde + glipe);
  }
  const plass = (n: number) =>
    malt.find((m) => m.gruppe === gruppe && m.nr === n)?.a;
  const fraA = plass(nr);
  const tilA = plass(ny);
  if (fraA === undefined) return ny > nr ? lengde : -lengde;
  // Etter gruppas siste plass finnes ingen å måle: én lengde videre.
  return (tilA ?? fraA + lengde) - fraA;
}

export type Dra = { fra: Plass; d: number; lengde: number; mal: Mal | null };

export function useDra({
  akse = "y",
  full,
  nokkel,
  onSlipp,
}: {
  akse?: "x" | "y";
  /** om gruppa er full; da bytter kortet plass med det det slippes på */
  full?: (gruppe: number) => boolean;
  /** nøkkelen innholdet er merket med (`data-dra-innhold`), for glid ved slipp */
  nokkel: (p: Plass) => string | undefined;
  onSlipp: (fra: Plass, mal: Mal) => void;
}) {
  const [dra, setDra] = useState<Dra | null>(null);
  const el = useRef(new Map<string, HTMLElement>());
  const malt = useRef<Malt[]>([]);
  const draget = useRef(false);
  const sisteMal = useRef<Mal | null>(null);
  const slippet = useRef<{
    nokkel: string;
    pos: number;
    sone: HTMLElement | null;
    rullet: number;
  } | null>(null);
  // Det ferske, så lytterne under ikke ser en eldre render.
  const fersk = useRef({ full, nokkel, onSlipp });
  fersk.current = { full, nokkel, onSlipp };

  const y = akse === "y";
  const pos = (r: DOMRect) => (y ? [r.top, r.bottom] : [r.left, r.right]);

  function reg(p: Plass) {
    const k = `${p.gruppe}:${p.nr}`;
    return (e: HTMLElement | null) => {
      if (e) el.current.set(k, e);
      else el.current.delete(k);
    };
  }

  /**
   * `fraFelt`: draget kan starte i et tekstfelt (tittelen i øktlista,
   * 16.4). Trykket får da gi skrivemarkør som vanlig; først når pekeren har
   * flyttet seg 4 px, blir det et drag, og feltet mister fokus.
   */
  function begynn(e: Trykk, fra: Plass, fraFelt = false) {
    if (e.button !== 0) return;
    if (
      !fraFelt &&
      (e.target as HTMLElement).closest(
        "[data-ikke-dra], input, textarea, select, [contenteditable]",
      )
    )
      return;
    // Ikke la trykket gi fokus til en knapp i raden. Flyttes raden med
    // fokus, ruller WebKit for å holde den synlig, og vinduet hoppet ved
    // slipp. Klikket kommer likevel, så knappen virker som før uten drag.
    if (!fraFelt) e.preventDefault();
    const felt = fraFelt
      ? (e.target as HTMLElement).closest<HTMLElement>("input, textarea")
      : null;
    const startX = e.clientX;
    const startY = e.clientY;
    let peker = y ? startY : startX;
    let aktiv = false;
    let lengde = 0;
    // Rullesonen lista står i. Drar du mot kanten, ruller den, og rullingen
    // regnes inn: posisjonene ble målt før den begynte.
    const sone = y
      ? (e.currentTarget as HTMLElement).closest<HTMLElement>(
          ".overflow-auto, .overflow-y-auto",
        )
      : null;
    const startRull = sone?.scrollTop ?? 0;
    let ramme = 0;

    const oppdater = () => {
      const rullet = (sone?.scrollTop ?? 0) - startRull;
      const d = peker - (y ? startY : startX) + rullet;
      const mal = finnMal(malt.current, fra, d, fersk.current.full);
      sisteMal.current = mal;
      setDra({ fra, d, lengde, mal });
    };

    const rull = () => {
      ramme = 0;
      if (!aktiv || !sone) return;
      const r = sone.getBoundingClientRect();
      const kant = 48;
      const fart =
        peker < r.top + kant
          ? -Math.ceil((r.top + kant - peker) / 4)
          : peker > r.bottom - kant
            ? Math.ceil((peker - (r.bottom - kant)) / 4)
            : 0;
      if (fart === 0) return;
      sone.scrollTop += fart;
      oppdater();
      ramme = requestAnimationFrame(rull);
    };

    const flytt = (ev: PointerEvent) => {
      peker = y ? ev.clientY : ev.clientX;
      if (!aktiv) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < TERSKEL)
          return;
        aktiv = true;
        draget.current = true;
        if (fraFelt) {
          felt?.blur();
          (document.activeElement as HTMLElement | null)?.blur();
        }
        // Ingen tekstmarkering mens det dras.
        document.documentElement.dataset.drar = "";
        window.getSelection()?.removeAllRanges();
        malt.current = [...el.current].map(([k, e]) => {
          const [gruppe, nr] = k.split(":").map(Number);
          const [a, b] = pos(e.getBoundingClientRect());
          return { gruppe, nr, a, b };
        });
        const egen = malt.current.find(
          (m) => m.gruppe === fra.gruppe && m.nr === fra.nr,
        );
        lengde = egen ? egen.b - egen.a : 0;
      }
      oppdater();
      if (!ramme) ramme = requestAnimationFrame(rull);
    };

    const slipp = () => {
      window.removeEventListener("pointermove", flytt);
      window.removeEventListener("pointerup", slipp);
      window.removeEventListener("pointercancel", slipp);
      if (ramme) cancelAnimationFrame(ramme);
      // Utføres her, ikke i en state-oppdatering: React kan kjøre dem to
      // ganger, og da ville det blitt flyttet to ganger.
      const mal = sisteMal.current;
      sisteMal.current = null;
      delete document.documentElement.dataset.drar;
      if (aktiv) {
        const k = fersk.current.nokkel(fra);
        const innhold =
          k !== undefined
            ? document.querySelector<HTMLElement>(
                `[data-dra-innhold="${CSS.escape(k)}"]`,
              )
            : null;
        if (k !== undefined && innhold)
          slippet.current = {
            nokkel: k,
            pos: pos(innhold.getBoundingClientRect())[0],
            sone,
            rullet: sone?.scrollTop ?? 0,
          };
      }
      setDra(null);
      if (aktiv && mal) fersk.current.onSlipp(fra, mal);
      // Klikket som kommer etter slippet, er ikke et klikk.
      window.setTimeout(() => (draget.current = false), 0);
    };

    window.addEventListener("pointermove", flytt);
    window.addEventListener("pointerup", slipp);
    window.addEventListener("pointercancel", slipp);
  }

  // Kortet som nettopp ble sluppet, glir fra der det sto til plassen sin.
  useLayoutEffect(() => {
    const sl = slippet.current;
    if (!sl) return;
    slippet.current = null;
    // Når en rad flyttes, tar WebKit den ut før den settes inn igjen. Står
    // vinduet helt nederst, klemmes det da opp én rad og blir stående der.
    // Rulleposisjonen fra slippet settes tilbake før skjermen tegnes.
    if (sl.sone && sl.sone.scrollTop !== sl.rullet)
      sl.sone.scrollTop = sl.rullet;
    const e = document.querySelector<HTMLElement>(
      `[data-dra-innhold="${CSS.escape(sl.nokkel)}"]`,
    );
    if (!e) return;
    const d = sl.pos - pos(e.getBoundingClientRect())[0];
    if (Math.abs(d) < 1) return;
    const flytt = (v: number) =>
      y ? `translateY(${v}px)` : `translateX(${v}px)`;
    e.style.transition = "none";
    e.style.transform = flytt(d);
    e.getBoundingClientRect();
    e.style.transition = `transform ${DRATID}`;
    e.style.transform = "";
    const t = window.setTimeout(() => (e.style.transition = ""), 320);
    return () => window.clearTimeout(t);
  });

  const erDratt = (p: Plass) =>
    dra !== null && dra.fra.gruppe === p.gruppe && dra.fra.nr === p.nr;

  return {
    dra,
    reg,
    begynn,
    /** sant rett etter et drag, så klikket som følger ikke teller */
    draget,
    erDratt,
    /** toppen (eller venstre kant) plassen hadde da draget begynte */
    startPos: (p: Plass) =>
      malt.current.find((m) => m.gruppe === p.gruppe && m.nr === p.nr)?.a,
    /** hele plassen (a til b) da draget begynte */
    startRom: (p: Plass) =>
      malt.current.find((m) => m.gruppe === p.gruppe && m.nr === p.nr),
    byttesMed: (p: Plass) =>
      !!dra?.mal?.bytt && dra.mal.gruppe === p.gruppe && dra.mal.nr === p.nr,
    /** plassen det dratte havner på, mens det dras */
    malPlass: dra ? (dra.mal ? nyPlass(dra.fra, dra.mal) : dra.fra) : null,
    forskyvning: (p: Plass) =>
      dra ? forskyvning(malt.current, dra.fra, dra.mal, p) : 0,
    /** transform for innholdet på plassen: følger pekeren, eller glir unna */
    stil(p: Plass): CSSProperties | undefined {
      if (!dra) return undefined;
      const t = (v: number) =>
        y ? `translateY(${v}px)` : `translateX(${v}px)`;
      if (erDratt(p)) return { transform: t(dra.d), transition: "none" };
      return {
        transform: t(forskyvning(malt.current, dra.fra, dra.mal, p)),
        transition: `transform ${DRATID}`,
      };
    },
  };
}
