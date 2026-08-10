import { invoke } from "@tauri-apps/api/core";
import { hent } from "../db";
import { hentInnstilling, type Skolear } from "./skolear";

/**
 * Arkivet, SPEC §8.
 *
 * Hele basen skrevet ut som lesbare tekstfiler. Poenget er levetid:
 * `.sqlite`-filene krever denne appen for å leses, mens en mappe med
 * markdown kan åpnes om ti år av hva som helst — og av Obsidian med én gang,
 * uten videre behandling.
 *
 * Derfor er alt markdown, også tabellene. CSV-ene ligger ved siden av for
 * den dagen noe skal regnes på i et regneark.
 *
 * Filene lages her og skrives av Rust. Ingenting hentes per elev i en løkke —
 * med tretti elever og hundre økter blir det fort tusen spørringer.
 */

export type Fil = { sti: string; innhold: string };

// ------------------------------------------------------------------ rader

type ElevRad = {
  elevId: string;
  fornavn: string;
  etternavn: string;
  kode: string | null;
  klasse: string | null;
  notat: string | null;
};

type SkaringRad = {
  elevId: string;
  dato: string;
  fagKode: string;
  tema: string | null;
  verdi: string;
  farge: string | null;
  tellerIkke: number;
  notat: string | null;
};

type ResultatRad = {
  elevId: string;
  fagKode: string;
  tittel: string;
  frist: string | null;
  verdi: string | null;
  levert: number;
  kommentar: string | null;
};

type OktRad = {
  skolearFagId: string;
  fagKode: string;
  dato: string;
  klokkeslett: string | null;
  varighetMin: number;
  tema: string | null;
  sted: string | null;
  agenda: string | null;
  periode: string | null;
};

type OppfolgingRad = {
  fornavn: string;
  etternavn: string;
  status: string;
  tekst: string | null;
  frist: string | null;
  lukket: string | null;
};

type FagRad = {
  kode: string;
  navn: string;
  arstimetall: number | null;
  okter: number;
  minutter: number;
  elever: number;
};

type SkalaRad = {
  skala: string;
  bruksomrade: string;
  verdi: string;
  etikett: string | null;
  rang: number;
  farge: string | null;
  tellerIkke: number;
};

// --------------------------------------------------------------- innsamling

async function samle(skolearId: string) {
  const elever = await hent<ElevRad>(
    `SELECT e.id AS elevId, e.fornavn, e.etternavn, e.kode, e.notat,
            k.navn AS klasse
       FROM elev e
       JOIN elev_fag ef    ON ef.elev_id = e.id AND ef.slettet IS NULL
       JOIN skolear_fag sf ON sf.id = ef.skolear_fag_id
                          AND sf.slettet IS NULL AND sf.skolear_id = $1
       LEFT JOIN elev_klasse ek ON ek.elev_id = e.id
                          AND ek.skolear_id = $1 AND ek.slettet IS NULL
       LEFT JOIN klasse k ON k.id = ek.klasse_id AND k.slettet IS NULL
      WHERE e.slettet IS NULL
      GROUP BY e.id
      ORDER BY e.fornavn COLLATE NOCASE, e.etternavn COLLATE NOCASE`,
    [skolearId],
  );

  const fagPerElev = await hent<{ elevId: string; fagKode: string }>(
    `SELECT ef.elev_id AS elevId, f.kode AS fagKode
       FROM elev_fag ef
       JOIN skolear_fag sf ON sf.id = ef.skolear_fag_id
                          AND sf.slettet IS NULL AND sf.skolear_id = $1
       JOIN fag f ON f.id = sf.fag_id
      WHERE ef.slettet IS NULL
      ORDER BY f.kode`,
    [skolearId],
  );

  // Her tas ALT med, også «ikke i økta» — arkivet skal være en gjengivelse
  // av basen, ikke en sammenstilling. Flagget følger med så leseren ser
  // hvilke rader som ikke teller.
  const skaringer = await hent<SkaringRad>(
    `SELECT s.elev_id AS elevId, o.dato, f.kode AS fagKode, o.tema,
            sv.kode AS verdi, sv.farge, sv.teller_ikke AS tellerIkke,
            s.notat
       FROM skaring s
       JOIN okt o          ON o.id = s.okt_id AND o.slettet IS NULL
       JOIN skolear_fag sf ON sf.id = o.skolear_fag_id
                          AND sf.slettet IS NULL AND sf.skolear_id = $1
       JOIN fag f          ON f.id = sf.fag_id
       JOIN skalaverdi sv  ON sv.id = s.skalaverdi_id
      WHERE s.slettet IS NULL
      ORDER BY o.dato, o.klokkeslett`,
    [skolearId],
  );

  const resultater = await hent<ResultatRad>(
    `SELECT vr.elev_id AS elevId, f.kode AS fagKode, v.tittel, v.frist,
            sv.kode AS verdi, vr.levert, vr.kommentar
       FROM vurderingsresultat vr
       JOIN vurdering v    ON v.id = vr.vurdering_id AND v.slettet IS NULL
       JOIN skolear_fag sf ON sf.id = v.skolear_fag_id
                          AND sf.slettet IS NULL AND sf.skolear_id = $1
       JOIN fag f          ON f.id = sf.fag_id
       LEFT JOIN skalaverdi sv ON sv.id = vr.skalaverdi_id
      WHERE vr.slettet IS NULL
      ORDER BY v.frist, v.tittel`,
    [skolearId],
  );

  const okter = await hent<OktRad>(
    `SELECT sf.id AS skolearFagId, f.kode AS fagKode, o.dato, o.klokkeslett,
            o.varighet_min AS varighetMin, o.tema, o.sted, o.agenda,
            p.navn AS periode
       FROM okt o
       JOIN skolear_fag sf ON sf.id = o.skolear_fag_id
                          AND sf.slettet IS NULL AND sf.skolear_id = $1
       JOIN fag f          ON f.id = sf.fag_id
       LEFT JOIN periode p ON p.id = o.periode_id AND p.slettet IS NULL
      WHERE o.slettet IS NULL
      ORDER BY f.kode, o.dato, o.klokkeslett`,
    [skolearId],
  );

  const oppfolging = await hent<OppfolgingRad>(
    `SELECT e.fornavn, e.etternavn, op.status, op.tekst, op.frist, op.lukket
       FROM oppfolging op
       JOIN elev e ON e.id = op.elev_id AND e.slettet IS NULL
      WHERE op.slettet IS NULL
      ORDER BY op.lukket IS NOT NULL, op.frist`,
  );

  const fag = await hent<FagRad>(
    `SELECT f.kode, f.navn, sf.arstimetall,
            COUNT(o.id)                        AS okter,
            COALESCE(SUM(o.varighet_min), 0)   AS minutter,
            (SELECT COUNT(*) FROM elev_fag ef
              WHERE ef.skolear_fag_id = sf.id AND ef.slettet IS NULL) AS elever
       FROM skolear_fag sf
       JOIN fag f ON f.id = sf.fag_id
       LEFT JOIN okt o ON o.skolear_fag_id = sf.id AND o.slettet IS NULL
      WHERE sf.slettet IS NULL AND sf.skolear_id = $1
      GROUP BY sf.id
      ORDER BY f.kode`,
    [skolearId],
  );

  const skalaer = await hent<SkalaRad>(
    `SELECT sk.navn AS skala, sk.bruksomrade, sv.kode AS verdi, sv.etikett,
            sv.rang, sv.farge, sv.teller_ikke AS tellerIkke
       FROM skalaverdi sv
       JOIN skala sk ON sk.id = sv.skala_id AND sk.slettet IS NULL
      ORDER BY sk.navn, sv.rang`,
  );

  return {
    elever, fagPerElev, skaringer, resultater, okter, oppfolging, skalaer, fag,
  };
}

// ----------------------------------------------------------------- bygging

export async function byggArkiv(skolear: Skolear): Promise<Fil[]> {
  const d = await samle(skolear.id);
  const filer: Fil[] = [];

  // Hvert skoleår får sin egen mappe, så flere år kan ligge side om side i
  // samme valgte mappe. MERK at navnet ofte er «2026/27» — skråstreken ville
  // laget en undermappe, så det må gjennom slugg.
  const ar = slugg(skolear.navn);
  const legg = (sti: string, innhold: string) =>
    filer.push({ sti: `${ar}/${sti}`, innhold });

  const fagFor = new Map<string, string[]>();
  for (const r of d.fagPerElev) {
    fagFor.set(r.elevId, [...(fagFor.get(r.elevId) ?? []), r.fagKode]);
  }

  legg("README.md", lesMeg(skolear, d.fag, d.skalaer, d.elever.length));

  for (const e of d.elever) {
    legg(
      `elever/${slugg(`${e.fornavn} ${e.etternavn}`)}.md`,
      elevfil(
        e,
        fagFor.get(e.elevId) ?? [],
        d.skaringer.filter((s) => s.elevId === e.elevId),
        d.resultater.filter((r) => r.elevId === e.elevId),
        skolear,
      ),
    );
  }

  const fagKoder = [...new Set(d.okter.map((o) => o.fagKode))];
  for (const kode of fagKoder) {
    const egne = d.okter.filter((o) => o.fagKode === kode);
    const s = slugg(kode);
    legg(`fag/${s}.md`, fagfil(kode, egne, skolear));
    legg(
      `fag/${s}-skaring.csv`,
      csv(
        ["elev", "dato", "tema", "verdi", "teller", "notat"],
        d.skaringer
          .filter((x) => x.fagKode === kode)
          .map((x) => {
            const e = d.elever.find((y) => y.elevId === x.elevId);
            return [
              e ? `${e.fornavn} ${e.etternavn}` : x.elevId,
              x.dato,
              x.tema ?? "",
              x.verdi,
              x.tellerIkke ? "nei" : "ja",
              x.notat ?? "",
            ];
          }),
      ),
    );
    legg(
      `fag/${s}-vurderinger.csv`,
      csv(
        ["elev", "vurdering", "frist", "resultat", "levert", "kommentar"],
        d.resultater
          .filter((x) => x.fagKode === kode)
          .map((x) => {
            const e = d.elever.find((y) => y.elevId === x.elevId);
            return [
              e ? `${e.fornavn} ${e.etternavn}` : x.elevId,
              x.tittel,
              x.frist ?? "",
              x.verdi ?? "",
              x.levert ? "ja" : "nei",
              x.kommentar ?? "",
            ];
          }),
      ),
    );
  }

  legg("oppfolging.md", oppfolgingsfil(d.oppfolging));
  return filer;
}

/**
 * Fargen som emoji, så en skåring er lesbar på et blikk i Obsidian.
 *
 * Kodeteksten står ved siden av — uten den kan man ikke søke etter «rød» i
 * arkivet, og en skjermleser leser bare «rød sirkel».
 */
export function verdimerke(verdi: string, farge: string | null, tellerIkke: number): string {
  const merke =
    farge === "gronn" ? "🟢" : farge === "gul" ? "🟡" : farge === "rod" ? "🔴" : "⚪";
  return tellerIkke ? `${merke} ${verdi} *(teller ikke)*` : `${merke} ${verdi}`;
}

// ------------------------------------------------------------------ filene

function lesMeg(
  skolear: Skolear,
  fag: FagRad[],
  skalaer: SkalaRad[],
  antallElever: number,
): string {
  const ut: string[] = [
    `# ${skolear.navn}`,
    "",
    `Arkiv fra Elevtracking · ${skolear.start} til ${skolear.slutt}`,
    `· ${antallElever} elever · skrevet ${idag()}`,
    "",
    "## Fag dette skoleåret",
    "",
  ];

  if (fag.length === 0) {
    ut.push("*Ingen fag lagt inn.*", "");
  } else {
    ut.push("| Fag | Navn | Elever | Økter | Timer | Årstimer |");
    ut.push("| --- | --- | --- | --- | --- | --- |");
    for (const f of fag) {
      const timer = Math.round((f.minutter / 60) * 10) / 10;
      ut.push(
        `| [[${slugg(f.kode)}\|${f.kode}]] | ${tab(f.navn)} | ${f.elever} ` +
          `| ${f.okter} | ${timer} | ${f.arstimetall ?? "—"} |`,
      );
    }
    ut.push("");
  }

  ut.push(
    "Dette er en tekstversjon av databasen, skrevet ut av appen. Den kan leses",
    "i Obsidian, en teksteditor eller hva som helst annet — også om appen ikke",
    "finnes lenger. Filene her overskrives ved hver eksport; rediger dem ikke.",
    "",
    "## Hva fargene betyr",
    "",
    "Skåringen er **innsats i den enkelte økta**, ikke en karakter. Verdier",
    "merket «teller ikke» er fravær av grunnlag og skal aldri inngå i snitt",
    "eller sammenstilling.",
    "",
  );

  let forrige = "";
  for (const s of skalaer) {
    if (s.skala !== forrige) {
      ut.push("", `### ${s.skala}`, `*${s.bruksomrade}*`, "");
      ut.push("| Verdi | Betydning | Farge | Teller |");
      ut.push("| --- | --- | --- | --- |");
      forrige = s.skala;
    }
    ut.push(
      `| ${s.verdi} | ${s.etikett ?? ""} | ${s.farge ?? ""} | ${s.tellerIkke ? "nei" : "ja"} |`,
    );
  }

  ut.push("", "## Mappene", "");
  ut.push("- `elever/` — én fil per elev, kronologisk");
  ut.push("- `fag/` — årsplanen per fag, med skåringer og vurderinger som CSV");
  ut.push("- `oppfolging.md` — oppfølgingspunkter");
  return ut.join("\n") + "\n";
}

function elevfil(
  e: ElevRad,
  fag: string[],
  skaringer: SkaringRad[],
  resultater: ResultatRad[],
  skolear: Skolear,
): string {
  const ut: string[] = [
    "---",
    `navn: "${e.fornavn} ${e.etternavn}"`,
    `klasse: "${e.klasse ?? ""}"`,
    `fag: [${fag.map((f) => `"${f}"`).join(", ")}]`,
    `skolear: "${skolear.navn}"`,
    e.kode ? `kode: "${e.kode}"` : "",
    "---",
    "",
    `# ${e.fornavn} ${e.etternavn}`,
    "",
  ].filter((l) => l !== "");

  if (e.notat) ut.push(e.notat, "");

  ut.push("## Skåringer", "");
  if (skaringer.length === 0) {
    ut.push("*Ingen skåringer registrert.*", "");
  } else {
    ut.push("| Dato | Fag | Tema | Verdi | Notat |");
    ut.push("| --- | --- | --- | --- | --- |");
    for (const s of skaringer) {
      ut.push(
        `| ${s.dato} | ${s.fagKode} | ${tab(s.tema)} ` +
          `| ${verdimerke(s.verdi, s.farge, s.tellerIkke)} | ${tab(s.notat)} |`,
      );
    }
    ut.push("");
  }

  ut.push("## Vurderinger", "");
  if (resultater.length === 0) {
    ut.push("*Ingen vurderingsresultater.*", "");
  } else {
    ut.push("| Frist | Fag | Oppgave | Resultat | Levert | Kommentar |");
    ut.push("| --- | --- | --- | --- | --- | --- |");
    for (const r of resultater) {
      ut.push(
        `| ${r.frist ?? ""} | ${r.fagKode} | ${tab(r.tittel)} | ${r.verdi ?? ""} ` +
          `| ${r.levert ? "ja" : "nei"} | ${tab(r.kommentar)} |`,
      );
    }
    ut.push("");
  }

  return ut.join("\n");
}

function fagfil(kode: string, okter: OktRad[], skolear: Skolear): string {
  const timer = Math.round((okter.reduce((s, o) => s + o.varighetMin, 0) / 60) * 10) / 10;
  const ut: string[] = [
    "---",
    `fag: "${kode}"`,
    `skolear: "${skolear.navn}"`,
    `okter: ${okter.length}`,
    `timer: ${timer}`,
    "---",
    "",
    `# ${kode} — årsplan ${skolear.navn}`,
    "",
    `${okter.length} økter · ${timer} timer`,
    "",
  ];

  let forrige: string | null = " ";
  for (const o of okter) {
    const p = o.periode ?? "Uten periode";
    if (p !== forrige) {
      ut.push("", `## ${p}`, "");
      ut.push("| Dato | Dag | Tid | Varighet | Tema | Sted | Agenda |");
      ut.push("| --- | --- | --- | --- | --- | --- | --- |");
      forrige = p;
    }
    ut.push(
      `| ${o.dato} | ${ukedag(o.dato)} | ${o.klokkeslett ?? ""} | ${o.varighetMin} min ` +
        `| ${tab(o.tema)} | ${tab(o.sted)} | ${tab(o.agenda)} |`,
    );
  }

  return ut.join("\n") + "\n";
}

function oppfolgingsfil(rader: OppfolgingRad[]): string {
  const ut = ["# Oppfølging", ""];
  if (rader.length === 0) {
    ut.push("*Ingen oppfølgingspunkter.*");
    return ut.join("\n") + "\n";
  }
  ut.push("| Elev | Status | Frist | Lukket | Tekst |");
  ut.push("| --- | --- | --- | --- | --- |");
  for (const r of rader) {
    ut.push(
      `| ${r.fornavn} ${r.etternavn} | ${r.status} | ${r.frist ?? ""} ` +
        `| ${r.lukket ? r.lukket.slice(0, 10) : "åpen"} | ${tab(r.tekst)} |`,
    );
  }
  return ut.join("\n") + "\n";
}

// ---------------------------------------------------------------- småting

/** Rørtegn og linjeskift ville brutt en markdown-tabellrad. */
export function tab(s: string | null): string {
  return (s ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

export function csv(hode: string[], rader: string[][]): string {
  const felt = (s: string) =>
    /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  return [hode, ...rader].map((r) => r.map(felt).join(",")).join("\n") + "\n";
}

/**
 * Filnavn av et elevnavn. Æ, ø og å skrives om framfor å prosentkodes —
 * `anna-reistad.md` skal kunne skrives inn for hånd.
 */
export function slugg(navn: string): string {
  return navn
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function idag(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function ukedag(dato: string): string {
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    weekday: "short",
  });
}

// ------------------------------------------------------------- skriving

/**
 * Skriver arkivet til mappa brukeren har valgt.
 *
 * `eksportmappe` er nøkkelen SPEC §4.8 setter av til dette. Er den ikke
 * satt, gjør vi ingenting — arkivet skal ikke finne på et sted selv.
 */
export async function skrivArkiv(
  skolear: Skolear,
): Promise<{ skrevet: number; feil: string[] } | null> {
  const mappe = await hentInnstilling("eksportmappe");
  if (!mappe) return null;

  const filer = await byggArkiv(skolear);
  return invoke<{ skrevet: number; feil: string[] }>("skriv_arkiv", {
    mappe,
    filer,
  });
}
