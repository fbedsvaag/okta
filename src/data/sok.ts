/**
 * Søket bak ⌘K, SPEC §4.4.
 *
 * Ett felt som finner både elever og økter. Hvert ord man skriver må passe
 * et sted i treffet — «mfl1 markeds» finner markedsanalyse-øktene i MFL1,
 * «tony 1stc» finner Tony i 1STC.
 *
 * Datoer kan skrives slik man skriver dem: 2026-10-12 (det vanlige, også i
 * filnavn), 12.10.2026, 12.10.26, 12.10 eller 12/10. Et helt år eller en
 * måned alene går også: 2026-10.
 *
 * Fag finnes på koden, navnet og aliaset. SAM3045 med aliaset «MFL1» finnes
 * på begge.
 */

export type Sokeelev = {
  id: string;
  fornavn: string;
  etternavn: string;
  klasse: string | null;
  fag: string[];
};

export type Sokeokt = {
  id: string;
  dato: string;
  klokkeslett: string | null;
  tema: string | null;
  fagKode: string;
  /** fagets navn og alias, så begge kan søkes på */
  fagNavn: string;
  alias: string | null;
};

export type Treff =
  { type: "elev"; elev: Sokeelev } | { type: "okt"; okt: Sokeokt };

/** Små bokstaver og ett mellomrom. Æøå beholdes — de er egne bokstaver. */
function norm(s: string): string {
  return s.toLocaleLowerCase("nb-NO").replace(/\s+/g, " ").trim();
}

/**
 * Tolker et ord som dato. Gir et ISO-prefiks («2026-10-12», «2026-10»), et
 * måned-dag-mønster uten år («-10-12»), eller null når ordet ikke er en dato.
 *
 * Datoer uten år gjelder alle år — «12.10» er 12. oktober, og skoleåret har
 * bare én av dem.
 */
export function tolkDato(ord: string): string | null {
  const to = (n: string) => n.padStart(2, "0");
  const ar = (a: string) => (a.length === 2 ? `20${a}` : a);

  let m = ord.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/);
  if (m)
    return m[3] ? `${m[1]}-${to(m[2])}-${to(m[3])}` : `${m[1]}-${to(m[2])}`;

  m = ord.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2}|\d{4})$/);
  if (m) return `${ar(m[3])}-${to(m[2])}-${to(m[1])}`;

  m = ord.match(/^(\d{1,2})[./](\d{1,2})\.?$/);
  if (m && Number(m[2]) <= 12 && Number(m[1]) <= 31)
    return `-${to(m[2])}-${to(m[1])}`;

  return null;
}

function passerDato(dato: string, monster: string): boolean {
  return monster.startsWith("-")
    ? dato.slice(4) === monster
    : dato.startsWith(monster);
}

function elevtekst(e: Sokeelev): string {
  return norm([e.fornavn, e.etternavn, e.klasse ?? "", ...e.fag].join(" "));
}

function okttekst(o: Sokeokt): string {
  return norm(
    [o.tema ?? "", o.fagKode, o.fagNavn, o.alias ?? "", o.dato].join(" "),
  );
}

/**
 * Treffene for en søketekst, elever først og så økter.
 *
 * Elevene sorteres slik at de som har et navn som *begynner* med det man
 * skrev kommer først. Øktene sorteres etter hvor nær i dag de ligger — det
 * er som regel den neste eller forrige man leter etter.
 */
export function sok(
  tekst: string,
  kilder: { elever: Sokeelev[]; okter: Sokeokt[]; idag: string },
  grense = { elever: 6, okter: 8 },
): Treff[] {
  const ord = norm(tekst).split(" ").filter(Boolean);
  if (ord.length === 0) return [];

  const datoer = ord.map(tolkDato);
  const harDato = datoer.some((d) => d !== null);

  // Et datoord kan bare passe en økt. Står det en dato i søket, er det
  // økter man leter etter, og elevene holdes utenfor.
  const elever = harDato
    ? []
    : kilder.elever
        .map((e) => ({ e, t: elevtekst(e) }))
        .filter(({ t }) => ord.every((o) => t.includes(o)))
        .sort((a, b) => {
          const start = (e: Sokeelev) =>
            norm(`${e.fornavn} ${e.etternavn}`).startsWith(ord[0]) ||
            norm(e.etternavn).startsWith(ord[0])
              ? 0
              : 1;
          return (
            start(a.e) - start(b.e) ||
            a.e.fornavn.localeCompare(b.e.fornavn, "nb") ||
            a.e.etternavn.localeCompare(b.e.etternavn, "nb")
          );
        })
        .slice(0, grense.elever)
        .map(({ e }): Treff => ({ type: "elev", elev: e }));

  const tekstord = ord.filter((_, i) => datoer[i] === null);
  const temaTreff = (o: Sokeokt) => {
    const t = norm(o.tema ?? "");
    return tekstord.length > 0 && tekstord.some((w) => t.includes(w)) ? 1 : 0;
  };

  const dager = (d: string) =>
    Math.abs(Date.parse(d) - Date.parse(kilder.idag)) / 86400000;

  const okter = kilder.okter
    .map((o) => ({ o, t: okttekst(o) }))
    .filter(({ o, t }) =>
      ord.every((w, i) =>
        datoer[i] ? passerDato(o.dato, datoer[i]!) : t.includes(w),
      ),
    )
    // Treff i temaet først. Ellers drukner «markeds» i alle øktene i
    // Markedsføring og ledelse, som alle har ordet i fagnavnet.
    .sort(
      (a, b) =>
        temaTreff(b.o) - temaTreff(a.o) || dager(a.o.dato) - dager(b.o.dato),
    )
    .slice(0, grense.okter)
    .map(({ o }): Treff => ({ type: "okt", okt: o }));

  return [...elever, ...okter];
}
