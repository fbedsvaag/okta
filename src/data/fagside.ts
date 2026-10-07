import type { Okt } from "./okter";
import type { Periode } from "./perioder";

/**
 * Det fagsiden regner ut (ARBEIDSLISTE 11.2, lerretet «Fagside»). Rene
 * funksjoner, så de kan testes uten base; dataene hentes av skjermen.
 */

/** Timene som er holdt: økter fra skolestart til og med i dag. */
export function holdteMinutter(okter: Okt[], idag: string): number {
  return okter
    .filter((o) => o.dato <= idag)
    .reduce((s, o) => s + o.varighetMin, 0);
}

/**
 * Hvor langt faget har kommet mot årstimetallet, sammenliknet med hvor
 * langt det burde ha kommet om timene var jevnt fordelt over skoleåret.
 * Positivt = foran, negativt = bak, i hele timer.
 */
export function tempo(
  holdtMin: number,
  arstimetall: number,
  start: string,
  slutt: string,
  idag: string,
): number {
  const dag = (d: string) => Date.parse(`${d}T00:00:00Z`) / 86_400_000;
  const lengde = Math.max(1, dag(slutt) - dag(start));
  const gatt = Math.min(1, Math.max(0, (dag(idag) - dag(start)) / lengde));
  return Math.round(holdtMin / 60 - arstimetall * gatt);
}

/** «I rute — 2 timer foran årsplanen» og liknende. */
export function tempotekst(timer: number): { tekst: string; bak: boolean } {
  if (timer >= -1)
    return {
      tekst: timer <= 1 ? "I rute" : `I rute — ${timer} timer foran årsplanen`,
      bak: false,
    };
  return { tekst: `Bak — ${-timer} timer bak årsplanen`, bak: true };
}

export type Periodestolpe = {
  id: string;
  navn: string;
  farge: string | null;
  /** planlagte minutter i perioden — bredden på stolpen */
  planlagt: number;
  /** andel av dem som er holdt, 0–1 */
  holdt: number;
};

/**
 * Én stolpe per periode, i rekkefølge, med bredde etter planlagte timer og
 * fyll etter det som er holdt. Økter uten periode får en egen til slutt.
 */
export function periodestolper(
  okter: Okt[],
  perioder: Periode[],
  idag: string,
): Periodestolpe[] {
  const ut: Periodestolpe[] = [];
  const legg = (
    id: string,
    navn: string,
    farge: string | null,
    liste: Okt[],
  ) => {
    const planlagt = liste.reduce((s, o) => s + o.varighetMin, 0);
    if (planlagt === 0) return;
    ut.push({
      id,
      navn,
      farge,
      planlagt,
      holdt: holdteMinutter(liste, idag) / planlagt,
    });
  };
  for (const p of [...perioder].sort((a, b) => a.rekkefolge - b.rekkefolge))
    legg(
      p.id,
      p.navn,
      p.farge,
      okter.filter((o) => o.periodeId === p.id),
    );
  const kjente = new Set(perioder.map((p) => p.id));
  legg(
    "",
    "Uten periode",
    null,
    okter.filter((o) => !o.periodeId || !kjente.has(o.periodeId)),
  );
  return ut;
}

const UKEDAG = ["søn", "man", "tir", "ons", "tor", "fre", "lør"];

function ukedag(dato: string): number {
  return new Date(`${dato}T00:00:00Z`).getUTCDay();
}

/**
 * De faste tidene faget har, lest av øktene fra i dag og framover:
 * «man 08:30 og tor 12:30». Et tidspunkt må gå igjen minst to ganger for å
 * regnes som fast. Mandag først.
 */
export function fasteTider(
  okter: Pick<Okt, "dato" | "klokkeslett">[],
  idag: string,
): string {
  const telling = new Map<string, number>();
  for (const o of okter) {
    if (o.dato < idag || !o.klokkeslett) continue;
    const n = `${ukedag(o.dato)}|${o.klokkeslett}`;
    telling.set(n, (telling.get(n) ?? 0) + 1);
  }
  const faste = [...telling.entries()]
    .filter(([, n]) => n >= 2)
    .map(([k]) => k.split("|"))
    .sort(
      ([a, x], [b, y]) => ((+a + 6) % 7) - ((+b + 6) % 7) || x.localeCompare(y),
    )
    .map(([d, t]) => `${UKEDAG[+d]} ${t}`);
  if (faste.length <= 1) return faste.join("");
  return `${faste.slice(0, -1).join(", ")} og ${faste[faste.length - 1]}`;
}

/** «2STA og 2STB», «1STC, 2STA og 3STB». */
export function oppramsing(deler: string[]): string {
  if (deler.length <= 1) return deler.join("");
  return `${deler.slice(0, -1).join(", ")} og ${deler[deler.length - 1]}`;
}

export type Maldekning = {
  /** én per økt som dekker målet, i datorekkefølge: holdt eller ikke */
  okter: boolean[];
  status: "dekket" | "pabegynt" | "ikke";
};

/**
 * Hvilke økter som dekker hvert kompetansemål: øktene i perioder som har
 * målet, og økter som har det selv. «Dekket» når alle er holdt, «Påbegynt»
 * når noen er det, ellers «Ikke ennå».
 */
export function maldekning(
  koder: string[],
  okter: Okt[],
  periodemal: ReadonlyMap<string, string[]>,
  oktmal: ReadonlyMap<string, string[]>,
  idag: string,
): Map<string, Maldekning> {
  const sortert = [...okter].sort((a, b) => a.dato.localeCompare(b.dato));
  const ut = new Map<string, Maldekning>();
  for (const kode of koder) {
    const holdt = sortert
      .filter(
        (o) =>
          (o.periodeId && periodemal.get(o.periodeId)?.includes(kode)) ||
          oktmal.get(o.id)?.includes(kode),
      )
      .map((o) => o.dato <= idag);
    const n = holdt.filter(Boolean).length;
    ut.set(kode, {
      okter: holdt,
      status:
        holdt.length > 0 && n === holdt.length
          ? "dekket"
          : n > 0
            ? "pabegynt"
            : "ikke",
    });
  }
  return ut;
}

/** «man 5.10» */
export function kortDag(dato: string): string {
  const [, m, d] = dato.split("-").map(Number);
  return `${UKEDAG[ukedag(dato)]} ${d}.${m}`;
}
