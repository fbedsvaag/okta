import type { Oktrad } from "./oktrader";
import type { Fridag } from "./kalender";
import { blokkering, ukenummer } from "./kalender";
import { mandagFor } from "./dashbord";

/**
 * «Innsats over tid» på I dag (ARBEIDSLISTE 12.1, lerretet «InnsatsTid»).
 *
 * Én søyle per skoleuke og fag, 100 % stablet: grønn, gul, rød og ikke i
 * økta. Tallet til høyre er andelen grønn de siste fire ukene som har
 * økter; endringen er differansen mot de fire ukene før, i prosentpoeng.
 * «Ikke i økta» (teller_ikke) står i søylen, men holdes utenfor andelen
 * (CLAUDE.md regel 5).
 */

export type Ukesoyle = {
  mandag: string;
  uke: number;
  /** data: holdte økter; kommer: ikke ennå; ferie: ingen skoledager; tom: ingen økter */
  status: "data" | "kommer" | "ferie" | "tom";
  /** denne uka */
  na: boolean;
  g: number;
  y: number;
  r: number;
  o: number;
  /** antall økter med skåringer */
  okter: number;
};

export type Faginnsats = {
  uker: Ukesoyle[];
  /** andel grønn siste fire uker med økter, 0–1; null uten slike uker */
  siste: number | null;
  /** endring i prosentpoeng mot de fire ukene før; null uten grunnlag */
  endring: number | null;
};

/** Mandagene i skoleåret, fra uka det starter til uka det slutter. */
export function skoleuker(start: string, slutt: string): string[] {
  const ut: string[] = [];
  for (let m = mandagFor(start); m <= mandagFor(slutt); m = leggTil(m, 7))
    ut.push(m);
  return ut;
}

/** Uka har ingen skoledager: alle fem er ferie, fri eller røde dager. */
export function erFerieuke(
  mandag: string,
  fridager: Fridag[],
  rode: Map<string, string>,
): boolean {
  for (let i = 0; i < 5; i++) {
    const b = blokkering(leggTil(mandag, i), fridager, rode);
    if (!b || b.type === "hendelse") return false;
  }
  return true;
}

/** Andel grønn av grønn, gul og rød. «Ikke i økta» teller ikke. */
function andel(uker: Ukesoyle[]): number | null {
  let g = 0;
  let n = 0;
  for (const u of uker) {
    g += u.g;
    n += u.g + u.y + u.r;
  }
  return n > 0 ? g / n : null;
}

export function faginnsats(
  rader: Oktrad[],
  skolearFagId: string,
  mandager: string[],
  ferie: ReadonlySet<string>,
  idag: string,
): Faginnsats {
  const naMandag = mandagFor(idag);
  const perUke = new Map<
    string,
    { g: number; y: number; r: number; o: number; okter: Set<string> }
  >();
  for (const r of rader) {
    if (r.skolearFagId !== skolearFagId || r.dato > idag) continue;
    const m = mandagFor(r.dato);
    const u = perUke.get(m) ?? {
      g: 0,
      y: 0,
      r: 0,
      o: 0,
      okter: new Set<string>(),
    };
    u.okter.add(r.oktId);
    if (r.borte) u.o++;
    else if (r.farge === "gronn") u.g++;
    else if (r.farge === "gul") u.y++;
    else if (r.farge === "rod") u.r++;
    perUke.set(m, u);
  }

  const uker = mandager.map((m): Ukesoyle => {
    const d = perUke.get(m);
    // Ferie vises også framover i året; denne uka er «kommer» til noe er
    // skåret, også om den er en ferieuke.
    const status: Ukesoyle["status"] = d
      ? "data"
      : ferie.has(m) && m !== naMandag
        ? "ferie"
        : m >= naMandag
          ? "kommer"
          : "tom";
    return {
      mandag: m,
      uke: ukenummer(m),
      status,
      na: m === naMandag,
      g: d?.g ?? 0,
      y: d?.y ?? 0,
      r: d?.r ?? 0,
      o: d?.o ?? 0,
      okter: d?.okter.size ?? 0,
    };
  });

  const med = uker.filter((u) => u.status === "data" && u.g + u.y + u.r > 0);
  const siste = andel(med.slice(-4));
  const for4 = med.length > 4 ? andel(med.slice(-8, -4)) : null;
  return {
    uker,
    siste,
    endring:
      siste !== null && for4 !== null
        ? Math.round(siste * 100) - Math.round(for4 * 100)
        : null,
  };
}

/** «↓ 3 poeng mot fire uker før» */
export function endringstekst(endring: number): string {
  const pil = endring > 0 ? "↑ " : endring < 0 ? "↓ " : "";
  return `${pil}${Math.abs(endring)} poeng mot fire uker før`;
}

/**
 * Månedene under søylene: navn og hvor mange uker de spenner over. En uke
 * hører til måneden torsdagen ligger i, som ISO-ukene.
 */
export function maneder(
  mandager: string[],
): { navn: string; uker: number; mnd: string }[] {
  const ut: { navn: string; uker: number; mnd: string }[] = [];
  for (const m of mandager) {
    const mnd = leggTil(m, 3).slice(0, 7);
    const sist = ut[ut.length - 1];
    if (sist && sist.mnd === mnd) sist.uker++;
    else
      ut.push({
        mnd,
        uker: 1,
        navn: new Date(`${mnd}-01T00:00:00`)
          .toLocaleDateString("nb-NO", { month: "short" })
          .replace(".", ""),
      });
  }
  return ut;
}

function leggTil(dato: string, dager: number): string {
  const [a, m, d] = dato.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + dager)).toISOString().slice(0, 10);
}
