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
import {
  hentAllePerioder,
  hentOktmalForFag,
  hentPeriodemal,
  periodeFor,
  type Periode,
} from "./perioder";
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

// ------------------------------------------------------------------ feltvalg

export type Kolonne =
  | "uke"
  | "dato"
  | "tid"
  | "varighet"
  | "tema"
  | "sted"
  | "agenda"
  | "lekse"
  | "maal"
  | "vurdering";
export type Hodefelt =
  "laerer" | "rom" | "timeregnskap" | "arknotat" | "kompetansemal";
/** Hvordan arket ligger på papiret — gjelder utskrift og Word. */
export type Papirfelt = "liggende";
export type Arkfelt = Kolonne | Hodefelt | Papirfelt;

/**
 * Feltene som kan velges av og på, i den rekkefølgen de står på arket.
 *
 * Plan og øktlogg er ikke blant dem, med vilje: de er lærerens egne notater,
 * og arket er laget for å deles med elevene.
 */
export const ARKFELT: {
  id: Arkfelt;
  navn: string;
  gruppe: "hode" | "kolonne" | "papir";
  standard: boolean;
}[] = [
  { id: "laerer", navn: "Faglærer", gruppe: "hode", standard: true },
  { id: "rom", navn: "Rom", gruppe: "hode", standard: true },
  { id: "timeregnskap", navn: "Timeregnskap", gruppe: "hode", standard: true },
  {
    id: "arknotat",
    navn: "Tekst på årsplanen",
    gruppe: "hode",
    standard: true,
  },
  {
    id: "kompetansemal",
    navn: "Kompetansemål",
    gruppe: "hode",
    standard: true,
  },
  { id: "uke", navn: "Uke", gruppe: "kolonne", standard: true },
  { id: "dato", navn: "Dato", gruppe: "kolonne", standard: true },
  { id: "tid", navn: "Klokkeslett", gruppe: "kolonne", standard: false },
  { id: "varighet", navn: "Varighet", gruppe: "kolonne", standard: false },
  { id: "tema", navn: "Tema", gruppe: "kolonne", standard: true },
  { id: "sted", navn: "Rom", gruppe: "kolonne", standard: false },
  { id: "agenda", navn: "Agenda", gruppe: "kolonne", standard: false },
  { id: "lekse", navn: "Lekse", gruppe: "kolonne", standard: true },
  {
    id: "maal",
    navn: "Kompetansemål (økt og periode)",
    gruppe: "kolonne",
    standard: false,
  },
  { id: "vurdering", navn: "Vurdering", gruppe: "kolonne", standard: true },
  // Med mange kolonner blir arket for trangt stående.
  { id: "liggende", navn: "Liggende ark", gruppe: "papir", standard: false },
];

/** Innstillingen der valget huskes, som JSON-liste. */
export const FELTNOKKEL = "arsplan_felt";

export function standardFelt(): Set<Arkfelt> {
  return new Set(ARKFELT.filter((f) => f.standard).map((f) => f.id));
}

/** Leser valget fra innstillingen. Ukjente eller ødelagte verdier gir standard. */
export function lesFelt(json: string | null): Set<Arkfelt> {
  if (!json) return standardFelt();
  try {
    const kjente = new Set(ARKFELT.map((f) => f.id));
    const liste = (JSON.parse(json) as unknown[]).filter(
      (x): x is Arkfelt => typeof x === "string" && kjente.has(x as Arkfelt),
    );
    return new Set(liste);
  } catch {
    return standardFelt();
  }
}

export type Arkrad = {
  oktId: string;
  dato: string;
  /** ISO-ukenummer, slik skolens årshjul teller */
  uke: number;
  klokkeslett: string | null;
  varighetMin: number;
  tema: string | null;
  lekse: string | null;
  sted: string | null;
  agenda: string | null;
  vurderinger: string[];
  /** kompetansemålene økta selv er huket av for, som tekst */
  mal: string[];
  /** datert utenfor skoleåret; vises, men teller ikke i regnskapet */
  utenfor: boolean;
};

export type Arkbolk = {
  /** null = øktene står uten periodeinndeling, eller er uplassert */
  navn: string | null;
  rader: Arkrad[];
  timer: number;
  /**
   * Målene perioden dekker. Står under periodenavnet i stedet for på hver
   * rad — ellers ville samme mål gjentatt seg nedover hele perioden.
   */
  mal: string[];
};

export type Ark = {
  /** det faget kalles — aliaset, ellers koden */
  fagKode: string;
  /** den offisielle koden, når aliaset er noe annet; ellers null */
  offisiellKode: string | null;
  fagNavn: string;
  skolearNavn: string;
  laerer: string | null;
  rom: string | null;
  arknotat: string | null;
  /** fra Udir når faget har kode, ellers fritekst som én bolk */
  kompetansemal: Kompetansemaal[];
  kompetansemalFritekst: string | null;
  /** null når timeregnskapet er valgt bort */
  regnskap: {
    antallOkter: number;
    timer: number;
    arstimetall: number | null;
    /** timer satt av til samtaledager i faget (§4.2) */
    samtaletimer: number;
  } | null;
  bolker: Arkbolk[];
  /**
   * Kolonnene arket har: de som er valgt, i fast rekkefølge — og av de
   * valgfrie bare dem som har noe i seg. Tomme kolonner tar bare plass.
   */
  kolonner: Kolonne[];
  /** liggende A4 på papir og i Word */
  liggende: boolean;
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
  /** kompetansemålkodene per økt og per periode (okt_/periode_kompetansemal) */
  oktmal?: Map<string, string[]>;
  periodemal?: Map<string, string[]>;
  /** feltene som skal med. Utelatt = standardvalget */
  felt?: ReadonlySet<Arkfelt>;
}): Ark {
  const felt = inn.felt ?? standardFelt();
  const med = (f: Arkfelt) => felt.has(f);
  // Koden slås opp i Udirs liste; en kode som ikke finnes der, står som den er.
  const tekstFor = (kode: string) =>
    inn.kompetansemal.find((m) => m.kode === kode)?.tekst ?? kode;
  const perioderIFaget = inn.perioder.filter(
    (p) => p.skolearFagId === inn.fag.id,
  );
  const periodensMal = (id: string | undefined) =>
    id ? (inn.periodemal?.get(id) ?? []).map(tekstFor) : [];
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
    sted: tom(o.sted),
    agenda: tom(o.agenda),
    vurderinger: (inn.vurderinger.get(o.id) ?? []).map((v) => v.tittel),
    mal: med("maal")
      ? [
          ...(inn.oktmal?.get(o.id) ?? []).map(tekstFor),
          // Fritekst for fag uten Udir-kode, ett mål per linje.
          ...(o.kompetansemal ?? "")
            .split(/\n+/)
            .map((l) => l.trim())
            .filter(Boolean),
          // Uten periodeinndeling på arket er det ingen overskrift å sette
          // periodens mål under — da står de på raden.
          ...(inn.medPerioder
            ? []
            : periodensMal(periodeFor(o, perioderIFaget)?.id)),
        ]
      : [],
    utenfor: o.dato < skolear.start || o.dato > skolear.slutt,
  });

  const rader = egne.map(rad);

  return {
    fagKode: fag.kode,
    offisiellKode: fag.fagkode !== fag.kode ? fag.fagkode : null,
    fagNavn: fag.navn,
    skolearNavn: skolear.navn,
    laerer: med("laerer") ? (tom(fag.laerer) ?? tom(inn.laererNavn)) : null,
    rom: med("rom") ? tom(fag.rom) : null,
    arknotat: med("arknotat") ? tom(fag.arknotat) : null,
    kompetansemal: med("kompetansemal") ? inn.kompetansemal : [],
    // Fritekstfeltet er reserven for fag uten Udir-kode. Har faget mål fra
    // Udir, er det de som gjelder — to lister ville sagt to ting.
    kompetansemalFritekst:
      !med("kompetansemal") || inn.kompetansemal.length > 0
        ? null
        : tom(fag.kompetansemal),
    regnskap: med("timeregnskap")
      ? {
          antallOkter: talte.length,
          timer: timer(talte),
          arstimetall: fag.arstimetall,
          samtaletimer: inn.samtaletimer,
        }
      : null,
    bolker: inn.medPerioder
      ? grupper(egne, rader, perioderIFaget, (id) =>
          med("maal") ? periodensMal(id) : [],
        )
      : [{ navn: null, rader, timer: timer(talte), mal: [] }],
    kolonner: ARKFELT.filter((f) => f.gruppe === "kolonne" && med(f.id))
      .map((f) => f.id as Kolonne)
      .filter((k) => {
        const harInnhold: Partial<Record<Kolonne, (r: Arkrad) => boolean>> = {
          tid: (r) => r.klokkeslett !== null,
          sted: (r) => r.sted !== null,
          agenda: (r) => r.agenda !== null,
          lekse: (r) => r.lekse !== null,
          vurdering: (r) => r.vurderinger.length > 0,
          maal: (r) => r.mal.length > 0,
        };
        const sjekk = harInnhold[k];
        return !sjekk || rader.some(sjekk);
      }),
    liggende: med("liggende"),
  };
}

/** Henter det arket trenger for ett fag, og bygger det. */
export async function hentArk(
  skolear: Skolear,
  fag: FagIAr,
  medPerioder: boolean,
  felt?: ReadonlySet<Arkfelt>,
): Promise<Ark> {
  const [
    okter,
    vurderinger,
    perioder,
    laererNavn,
    grep,
    samtale,
    oktmal,
    periodemal,
  ] = await Promise.all([
    hentOkter(skolear.id),
    hentOktVurderinger(skolear.id),
    hentAllePerioder(skolear.id),
    hentInnstilling(LAERERNAVN),
    finnFag(fag.grepKode),
    hentVurderingstimer(skolear.id),
    hentOktmalForFag(fag.id),
    hentPeriodemal(fag.id),
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
    oktmal,
    periodemal,
    felt,
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
  malFor: (periodeId: string | undefined) => string[],
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
    return {
      navn,
      rader: b.rader,
      timer: minutter / 60,
      mal: malFor(n ?? undefined),
    };
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
export function regnskapstekst(r: NonNullable<Ark["regnskap"]>): string {
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
