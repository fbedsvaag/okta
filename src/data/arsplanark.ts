import { hentVurderingstimer } from "./dashbord";
import type { FagIAr } from "./fag";
import { finnFag, type Kompetansemaal } from "./grep";
import {
  hentOktVurderinger,
  hentOkter,
  innenforAret,
  type Okt,
  type OktVurdering,
} from "./okter";
import { hentAllePerioder, periodeFor, type Periode } from "./perioder";
import { hentInnstilling, type Skolear } from "./skolear";

/** Innstillingen med lærerens navn — standard faglærer i alle fag. */
export const LAERERNAVN = "laerer_navn";

/**
 * Årsplanarket, SPEC §4.9.
 *
 * Ett fag, ett år, på ett til tre ark. Øverst hvem, hvor og hva faget skal
 * dekke; under det øktene med dato, tema, lekse og vurdering.
 *
 * Arket bygges én gang her, som rene data, og alle formatene leser av det:
 * utskriften, markdown, CSV og Word. Da kan de fire aldri si forskjellige
 * ting om samme fag, og innholdet kan testes uten en nettleser.
 *
 * **Dette er arket elevene får.** Plan, øktlogg, skåringer og notater er
 * lærerens eget materiale og har ingen vei inn hit — typen under har ikke
 * felter for dem.
 */

export type Arkrad = {
  oktId: string;
  dato: string;
  /** ISO-ukenummer, slik skolens årshjul teller */
  uke: number;
  klokkeslett: string | null;
  varighetMin: number;
  tema: string | null;
  lekse: string | null;
  vurderinger: string[];
  /** datert utenfor skoleåret; vises, men teller ikke i regnskapet */
  utenfor: boolean;
};

export type Arkbolk = {
  /** null = øktene står uten periodeinndeling, eller er uplassert */
  navn: string | null;
  rader: Arkrad[];
  timer: number;
};

export type Ark = {
  fagKode: string;
  fagNavn: string;
  skolearNavn: string;
  laerer: string | null;
  rom: string | null;
  arknotat: string | null;
  /** fra Udir når faget har kode, ellers fritekst som én bolk */
  kompetansemal: Kompetansemaal[];
  kompetansemalFritekst: string | null;
  regnskap: {
    antallOkter: number;
    timer: number;
    arstimetall: number | null;
    /** timer satt av til samtaledager i faget (§4.2) */
    samtaletimer: number;
  };
  bolker: Arkbolk[];
  /** hvilke kolonner som har noe i seg — tomme kolonner tar bare plass */
  harLekse: boolean;
  harVurdering: boolean;
};

export function byggArk(inn: {
  skolear: Skolear;
  fag: FagIAr;
  okter: Okt[];
  vurderinger: Map<string, OktVurdering[]>;
  perioder: Periode[];
  medPerioder: boolean;
  laererNavn: string | null;
  kompetansemal: Kompetansemaal[];
  samtaletimer: number;
}): Ark {
  const { skolear, fag } = inn;
  const egne = inn.okter
    .filter((o) => o.skolearFagId === fag.id)
    .sort(
      (a, b) =>
        a.dato.localeCompare(b.dato) ||
        (a.klokkeslett ?? "").localeCompare(b.klokkeslett ?? ""),
    );
  const talte = innenforAret(egne, skolear.start, skolear.slutt);

  const rad = (o: Okt): Arkrad => ({
    oktId: o.id,
    dato: o.dato,
    uke: isoUke(o.dato),
    klokkeslett: o.klokkeslett,
    varighetMin: o.varighetMin,
    tema: tom(o.tema),
    lekse: tom(o.lekse),
    vurderinger: (inn.vurderinger.get(o.id) ?? []).map((v) => v.tittel),
    utenfor: o.dato < skolear.start || o.dato > skolear.slutt,
  });

  const rader = egne.map(rad);

  return {
    fagKode: fag.kode,
    fagNavn: fag.navn,
    skolearNavn: skolear.navn,
    laerer: tom(fag.laerer) ?? tom(inn.laererNavn),
    rom: tom(fag.rom),
    arknotat: tom(fag.arknotat),
    kompetansemal: inn.kompetansemal,
    // Fritekstfeltet er reserven for fag uten Udir-kode. Har faget mål fra
    // Udir, er det de som gjelder — to lister ville sagt to ting.
    kompetansemalFritekst:
      inn.kompetansemal.length > 0 ? null : tom(fag.kompetansemal),
    regnskap: {
      antallOkter: talte.length,
      timer: timer(talte),
      arstimetall: fag.arstimetall,
      samtaletimer: inn.samtaletimer,
    },
    bolker: inn.medPerioder
      ? grupper(
          egne,
          rader,
          inn.perioder.filter((p) => p.skolearFagId === fag.id),
        )
      : [{ navn: null, rader, timer: timer(talte) }],
    harLekse: rader.some((r) => r.lekse !== null),
    harVurdering: rader.some((r) => r.vurderinger.length > 0),
  };
}

/** Henter det arket trenger for ett fag, og bygger det. */
export async function hentArk(
  skolear: Skolear,
  fag: FagIAr,
  medPerioder: boolean,
): Promise<Ark> {
  const [okter, vurderinger, perioder, laererNavn, grep, samtale] =
    await Promise.all([
      hentOkter(skolear.id),
      hentOktVurderinger(skolear.id),
      hentAllePerioder(skolear.id),
      hentInnstilling(LAERERNAVN),
      finnFag(fag.grepKode),
      hentVurderingstimer(skolear.id),
    ]);
  return byggArk({
    skolear,
    fag,
    okter,
    vurderinger,
    perioder,
    medPerioder,
    laererNavn,
    kompetansemal: grep?.kompetansemaal ?? [],
    samtaletimer: samtale.get(fag.id)?.timer ?? 0,
  });
}

/**
 * Øktene under perioden sin, i datorekkefølge.
 *
 * Rekkefølgen følger øktene, ikke `periode.rekkefolge`: faller to perioder
 * over hverandre i tid, er det datoene eleven forholder seg til. Økter uten
 * periode kommer sist framfor å bli usynlige (§4.2).
 */
function grupper(
  okter: Okt[],
  rader: Arkrad[],
  perioder: Periode[],
): Arkbolk[] {
  const rekkefolge: (string | null)[] = [];
  const kart = new Map<
    string | null,
    { navn: string | null; rader: Arkrad[] }
  >();

  okter.forEach((o, i) => {
    const p = periodeFor(o, perioder);
    const nokkel = p?.id ?? null;
    if (!kart.has(nokkel)) {
      kart.set(nokkel, { navn: p?.navn ?? null, rader: [] });
      rekkefolge.push(nokkel);
    }
    kart.get(nokkel)!.rader.push(rader[i]);
  });

  const ordnet: (string | null)[] = rekkefolge.filter((n) => n !== null);
  if (kart.has(null)) ordnet.push(null);

  return ordnet.map((n) => {
    const b = kart.get(n)!;
    const minutter = b.rader
      .filter((r) => !r.utenfor)
      .reduce((s, r) => s + r.varighetMin, 0);
    // Står alt uten periode, er det ingen inndeling å navngi.
    const navn = b.navn ?? (ordnet.length > 1 ? "Uten periode" : null);
    return { navn, rader: b.rader, timer: minutter / 60 };
  });
}

function timer(okter: { varighetMin: number }[]): number {
  return okter.reduce((s, o) => s + o.varighetMin, 0) / 60;
}

function tom(s: string | null | undefined): string | null {
  const t = s?.trim();
  return t ? t : null;
}

// ------------------------------------------------------------------ format

/** 1,5 — norsk desimalkomma, én desimal, ingen hale på hele tall. */
export function formatTimer(t: number): string {
  return (Math.round(t * 10) / 10).toLocaleString("nb-NO");
}

export function formatDato(dato: string): string {
  const [a, m, d] = dato.split("-");
  return `${d}.${m}.${a.slice(2)}`;
}

const UKEDAGER = ["søn", "man", "tir", "ons", "tor", "fre", "lør"];

function utc(dato: string): Date {
  const [a, m, d] = dato.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

export function ukedag(dato: string): string {
  return UKEDAGER[utc(dato).getUTCDay()];
}

/** ISO 8601-uke: uka tilhører året torsdagen ligger i. */
export function isoUke(dato: string): number {
  const d = utc(dato);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const nyttar = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - nyttar) / 86400000 + 1) / 7);
}

/** «42 økter · 126 av 140 timer», med samtaledagene som egen hale. */
export function regnskapstekst(r: Ark["regnskap"]): string {
  const okter = `${r.antallOkter} ${r.antallOkter === 1 ? "økt" : "økter"}`;
  const t = r.arstimetall
    ? `${formatTimer(r.timer)} av ${r.arstimetall} timer`
    : `${formatTimer(r.timer)} timer`;
  const samtale =
    r.samtaletimer > 0
      ? `, pluss ${formatTimer(r.samtaletimer)} til muntlig vurdering`
      : "";
  return `${okter} · ${t}${samtale}`;
}

/** Filnavn for ett fag, eller for hele året når flere fag er med. */
export function filnavn(ark: Ark[], endelse: string): string {
  const rens = (t: string) => t.replace(/[^\p{L}\p{N}]+/gu, "-");
  const ar = rens(ark[0]?.skolearNavn ?? "");
  return ark.length === 1
    ? `Årsplan ${rens(ark[0].fagKode)} ${ar}.${endelse}`
    : `Årsplan ${ar}.${endelse}`;
}
