import { invoke } from "@tauri-apps/api/core";
import { hent } from "../db";
import { skalategn } from "../ui/farger";
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

/** Et notat i møteloggen (§4.7), med oppfølgingen om det har en. */
type NotatRad = {
  elevId: string;
  fornavn: string;
  etternavn: string;
  dato: string;
  fagKode: string | null;
  tekst: string;
  skalFolgesOpp: number;
  frist: string | null;
  lukket: string | null;
  fraSamtale: number;
};

/** Et notat skrevet på eleven i en økt (§4.4), skåret eller ikke. */
type OktnotatRad = {
  elevId: string;
  dato: string;
  fagKode: string;
  tema: string | null;
  tekst: string;
};

type FagRad = {
  kode: string;
  navn: string;
  arstimetall: number | null;
  okter: number;
  minutter: number;
  elever: number;
  /** første øktdato — sorteringen i README går eldste fag først */
  forste: string | null;
};

type SkalaverdiRad = {
  skala: string;
  kode: string;
  etikett: string | null;
  farge: string | null;
  rang: number;
  tellerIkke: number;
};

// --------------------------------------------------------------- innsamling

async function samle(skolearId: string) {
  const elever = await hent<ElevRad>(
    // Elevene i året: i et fag, i en klasse (mentorelever har ofte ikke
    // noe fag hos deg), eller med et notat fra året.
    `SELECT e.id AS elevId, e.fornavn, e.etternavn, e.kode,
            k.navn AS klasse
       FROM elev e
       LEFT JOIN elev_klasse ek ON ek.elev_id = e.id
                          AND ek.skolear_id = $1 AND ek.slettet IS NULL
       LEFT JOIN klasse k ON k.id = ek.klasse_id AND k.slettet IS NULL
      WHERE e.slettet IS NULL
        AND (ek.id IS NOT NULL
             OR EXISTS (SELECT 1 FROM elev_fag ef
                          JOIN skolear_fag sf ON sf.id = ef.skolear_fag_id
                                             AND sf.slettet IS NULL
                                             AND sf.skolear_id = $1
                         WHERE ef.elev_id = e.id AND ef.slettet IS NULL)
             OR EXISTS (SELECT 1 FROM elevnotat n
                         WHERE n.elev_id = e.id AND n.slettet IS NULL
                           AND n.skolear_id = $1))
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
            n.tekst AS notat
       FROM skaring s
       -- Skåringer fra slettede elever skal heller ikke ut i arkivet.
       JOIN elev e         ON e.id = s.elev_id AND e.slettet IS NULL
       JOIN okt o          ON o.id = s.okt_id AND o.slettet IS NULL
       JOIN skolear_fag sf ON sf.id = o.skolear_fag_id
                          AND sf.slettet IS NULL AND sf.skolear_id = $1
       JOIN fag f          ON f.id = sf.fag_id
       JOIN skalaverdi sv  ON sv.id = s.skalaverdi_id
       -- Notatet bor i oktnotat (migrasjon 022), ikke på skåringsraden.
       LEFT JOIN oktnotat n ON n.okt_id = s.okt_id AND n.elev_id = s.elev_id
                           AND n.slettet IS NULL
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

  // Møteloggen for året, med samtalenotatene (de bor i elevnotat, §4.10).
  const notater = await hent<NotatRad>(
    `SELECT n.elev_id AS elevId, e.fornavn, e.etternavn, n.dato,
            COALESCE(NULLIF(f.alias, ''), f.kode) AS fagKode,
            n.tekst, n.skal_folges_opp AS skalFolgesOpp, n.frist, n.lukket,
            (n.samtale_id IS NOT NULL) AS fraSamtale
       FROM elevnotat n
       JOIN elev e ON e.id = n.elev_id AND e.slettet IS NULL
       LEFT JOIN skolear_fag sf ON sf.id = n.skolear_fag_id
       LEFT JOIN fag f ON f.id = sf.fag_id
      WHERE n.slettet IS NULL AND n.skolear_id = $1
      ORDER BY n.dato, n.opprettet`,
    [skolearId],
  );

  // Gjøremålene uten elev (migrasjon 023), åpne og ferdige.
  const gjoremal = await hent<{
    tekst: string;
    frist: string | null;
    ferdig: string | null;
    dato: string;
  }>(
    `SELECT tekst, frist, ferdig, substr(opprettet, 1, 10) AS dato
       FROM gjoremal
      WHERE slettet IS NULL AND skolear_id = $1
      ORDER BY ferdig IS NOT NULL, frist IS NULL, frist, opprettet`,
    [skolearId],
  );

  // Notatene fra øktene, også på elever som ikke ble skåret.
  const oktnotater = await hent<OktnotatRad>(
    `SELECT n.elev_id AS elevId, o.dato, f.kode AS fagKode, o.tema, n.tekst
       FROM oktnotat n
       JOIN elev e         ON e.id = n.elev_id AND e.slettet IS NULL
       JOIN okt o          ON o.id = n.okt_id AND o.slettet IS NULL
       JOIN skolear_fag sf ON sf.id = o.skolear_fag_id
                          AND sf.slettet IS NULL AND sf.skolear_id = $1
       JOIN fag f          ON f.id = sf.fag_id
      WHERE n.slettet IS NULL
      ORDER BY o.dato, o.klokkeslett`,
    [skolearId],
  );

  const fag = await hent<FagRad>(
    `SELECT f.kode, f.navn, sf.arstimetall,
            MIN(o.dato)                        AS forste,
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

  // Bare skalaene fagene i år faktisk skårer med. Skåringsskalaen ligger på
  // faget (§5.1), så en base kan ha flere enn den ene som er i bruk.
  const skaringsskala = await hent<SkalaverdiRad>(
    `SELECT DISTINCT sk.navn AS skala, sv.kode, sv.etikett, sv.farge, sv.rang,
            sv.teller_ikke AS tellerIkke
       FROM skolear_fag sf
       JOIN skala sk ON sk.id = COALESCE(sf.skaringsskala_id,
                                         '5ca1a000-0000-4000-8000-000000000001')
                    AND sk.slettet IS NULL
       JOIN skalaverdi sv ON sv.skala_id = sk.id
      WHERE sf.slettet IS NULL AND sf.skolear_id = $1
      ORDER BY sk.navn, sv.rang DESC`,
    [skolearId],
  );

  const vurderingsskala = await hent<SkalaverdiRad>(
    `SELECT DISTINCT sk.navn AS skala, sv.kode, sv.etikett, sv.farge, sv.rang,
            sv.teller_ikke AS tellerIkke
       FROM vurdering v
       JOIN skolear_fag sf ON sf.id = v.skolear_fag_id
                          AND sf.slettet IS NULL AND sf.skolear_id = $1
       JOIN skala sk ON sk.id = v.skala_id AND sk.slettet IS NULL
       JOIN skalaverdi sv ON sv.skala_id = sk.id
      WHERE v.slettet IS NULL
      ORDER BY sk.navn, sv.rang`,
    [skolearId],
  );

  return {
    elever,
    fagPerElev,
    skaringer,
    resultater,
    okter,
    notater,
    oktnotater,
    gjoremal,
    fag,
    skaringsskala,
    vurderingsskala,
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

  // Eldste fag først: sortert på første økt, og fag uten økter nederst.
  const fagSortert = [...d.fag].sort((a, b) =>
    (a.forste ?? "9999").localeCompare(b.forste ?? "9999"),
  );
  legg(
    "README.md",
    lesMeg(
      skolear,
      fagSortert,
      d.skaringsskala,
      d.vurderingsskala,
      d.elever.length,
    ),
  );

  for (const e of d.elever) {
    legg(
      `elever/${slugg(`${e.fornavn} ${e.etternavn}`)}.md`,
      elevfil(
        e,
        fagFor.get(e.elevId) ?? [],
        d.skaringer.filter((s) => s.elevId === e.elevId),
        d.resultater.filter((r) => r.elevId === e.elevId),
        d.notater.filter((n) => n.elevId === e.elevId),
        d.oktnotater.filter((n) => n.elevId === e.elevId),
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

  legg("oppfolging.md", oppfolgingsfil(d.notater, d.gjoremal));
  return filer;
}

/**
 * Fargen som emoji, så en skåring er lesbar på et blikk i Obsidian.
 *
 * Kodeteksten står ved siden av — uten den kan man ikke søke etter «rød» i
 * arkivet, og en skjermleser leser bare «rød sirkel».
 */
/**
 * Én skåring i en tabellcelle.
 *
 * Tegnet alene, aldri med ord ved siden av: en kolonne som blander emoji og
 * tekst mister justeringen, og nøkkelen i README forklarer hva tegnene betyr.
 * Finnes det ikke noe tegn for fargen, står ordet der i stedet.
 */
export function verdimerke(verdi: string, farge: string | null): string {
  return skalategn(farge, "sirkel") ?? verdi;
}

// ------------------------------------------------------------------ filene

function lesMeg(
  skolear: Skolear,
  fag: FagRad[],
  skaringsskala: SkalaverdiRad[],
  vurderingsskala: SkalaverdiRad[],
  antallElever: number,
): string {
  const arTag = slugg(skolear.navn);
  const koder = fag.map((f) => f.kode);

  const ut: string[] = [
    "---",
    `skolear: ${skolear.navn}`,
    "type: arkiv",
    `elever: ${antallElever}`,
    `fag: [${koder.join(", ")}]`,
    `start: ${skolear.start}`,
    `slutt: ${skolear.slutt}`,
    `eksportert: ${idag()}`,
    `tags: [elevtracking, skolear/${arTag}]`,
    "---",
    "",
    `# Skoleåret ${skolear.navn}`,
    "",
    `${antallElever} ${antallElever === 1 ? "elev" : "elever"} fordelt på ` +
      `${fag.length} fag, fra ${langDato(skolear.start)} til ` +
      `${langDato(skolear.slutt)}.`,
    "",
  ];

  // --- Fag ---
  if (fag.length > 0) {
    ut.push("## Fag", "");
    ut.push("| Fag | Navn | Elever | Økter | Timer |");
    ut.push("| --- | --- | ---: | ---: | --- |");
    for (const f of fag) {
      const timer = rund(f.minutter / 60);
      const kolonne = f.arstimetall
        ? `${timer} av ${f.arstimetall}`
        : `${timer}`;
      ut.push(
        `| [[${slugg(f.kode)}\\|${f.kode}]] | ${tab(f.navn)} | ${f.elever} ` +
          `| ${f.okter} | ${kolonne} |`,
      );
    }
    ut.push("");

    // Bare når summen faktisk er høyere — ellers ville setningen vært usann.
    const sum = fag.reduce((n, f) => n + f.elever, 0);
    if (sum > antallElever) {
      ut.push(
        `Elevtallene summerer til mer enn ${antallElever} fordi flere elever ` +
          "går i to eller flere fag.",
        "",
      );
    }
  }

  // --- Skåring ---
  if (skaringsskala.length > 0) {
    ut.push("## Hva skåringen betyr", "");
    ut.push("Fargen er **innsats i den enkelte økta**, ikke en karakter.", "");
    for (const v of skaringsskala) {
      const tegn = skalategn(v.farge, "sirkel");
      const hode = tegn ? `${tegn} **${v.kode}**` : `**${v.kode}**`;
      const bit = v.etikett ? [punktum(v.etikett)] : [];
      if (v.tellerIkke) bit.push("Teller ikke med noe sted.");
      ut.push(bit.length > 0 ? `- ${hode} — ${bit.join(" ")}` : `- ${hode}`);
    }
    ut.push(
      "",
      "I sammenhengende striper brukes kvadrater i stedet: 🟩 🟨 🟥 ⬜",
      "",
    );
  }

  // --- Vurderingsskalaer ---
  const vurdering = grupper(vurderingsskala);
  if (vurdering.size > 0) {
    ut.push("## Brukte vurderingsskalaer", "");
    for (const [navn, verdier] of vurdering) {
      ut.push(`- **${navn}** — ${trinn(verdier.map((v) => v.kode))}`);
    }
    ut.push("");
  }

  ut.push(
    "## Mappene",
    "",
    "- `elever/` — én fil per elev: skåringer, vurderinger, notater og møtelogg",
    "- `fag/` — årsplanen per fag, med skåringer og vurderinger som CSV",
    "- `oppfolging.md` — oppfølgingspunkter",
    "",
    "---",
    "",
    `Skrevet ut av Økta ${langDato(idag())}. Filene overskrives ved ` +
      "hver eksport — rediger dem ikke. De kan leses uten appen.",
  );

  return ut.join("\n") + "\n";
}

/** Setninger i punktlister avsluttes, så to av dem ikke løper sammen. */
function punktum(s: string): string {
  return /[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`;
}

function grupper(verdier: SkalaverdiRad[]): Map<string, SkalaverdiRad[]> {
  const kart = new Map<string, SkalaverdiRad[]>();
  for (const v of verdier) kart.set(v.skala, [...(kart.get(v.skala) ?? []), v]);
  return kart;
}

/**
 * Trinnene i en skala som én linje.
 *
 * Er de sammenhengende tall, skrives «1 til 6» framfor å ramse dem opp — en
 * liste med seks tall sier ikke mer enn spennet gjør.
 */
function trinn(koder: string[]): string {
  const tall = koder.map(Number);
  const sammenhengende =
    koder.length > 2 &&
    tall.every((n) => Number.isInteger(n)) &&
    tall.every((n, i) => i === 0 || n === tall[i - 1] + 1);
  return sammenhengende
    ? `${koder[0]} til ${koder[koder.length - 1]}`
    : koder.join(" · ");
}

function rund(n: number): string {
  return (Math.round(n * 10) / 10).toLocaleString("nb-NO");
}

/** 2026-08-17 -> «17. august 2026». Regel 5: datoer i prosa skrives ut. */
function langDato(dato: string): string {
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function elevfil(
  e: ElevRad,
  fag: string[],
  skaringer: SkaringRad[],
  resultater: ResultatRad[],
  notater: NotatRad[],
  oktnotater: OktnotatRad[],
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

  ut.push("## Skåringer", "");
  if (skaringer.length === 0) {
    ut.push("*Ingen skåringer registrert.*", "");
  } else {
    ut.push("| Dato | Fag | Tema | Verdi | Notat |");
    ut.push("| --- | --- | --- | --- | --- |");
    for (const s of skaringer) {
      ut.push(
        `| ${s.dato} | ${s.fagKode} | ${tab(s.tema)} ` +
          `| ${verdimerke(s.verdi, s.farge)} | ${tab(s.notat)} |`,
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

  // Møteloggen og øktnotatene i én tidslinje, eldste først — som resten av
  // fila. Notatene er markdown og står som de ble skrevet.
  ut.push("## Notater og møtelogg", "");
  const linje = [
    ...notater.map((n) => ({ dato: n.dato, n, o: null })),
    ...oktnotater.map((o) => ({ dato: o.dato, n: null, o })),
  ].sort((a, b) => a.dato.localeCompare(b.dato));
  if (linje.length === 0) {
    ut.push("*Ingen notater.*", "");
  } else {
    for (const { n, o } of linje) {
      if (n) {
        const merker = [
          n.fraSamtale ? (n.fagKode ? "fagsamtale" : "mentorsamtale") : null,
          n.fagKode,
          n.skalFolgesOpp
            ? n.lukket
              ? `fulgt opp ${n.lukket.slice(0, 10)}`
              : n.frist
                ? `følges opp, frist ${n.frist}`
                : "følges opp"
            : null,
        ].filter(Boolean);
        ut.push(
          `### ${n.dato}${merker.length > 0 ? ` · ${merker.join(" · ")}` : ""}`,
          "",
          n.tekst.trim(),
          "",
        );
      } else if (o) {
        ut.push(
          `### ${o.dato} · økt · ${o.fagKode}${o.tema ? ` · ${o.tema}` : ""}`,
          "",
          o.tekst.trim(),
          "",
        );
      }
    }
  }

  return ut.join("\n");
}

function fagfil(kode: string, okter: OktRad[], skolear: Skolear): string {
  const timer =
    Math.round((okter.reduce((s, o) => s + o.varighetMin, 0) / 60) * 10) / 10;
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

/**
 * Notatene som er merket «skal følges opp» (§4.7), åpne først. Hele
 * teksten står i elevens fil; her står første linje.
 */
function oppfolgingsfil(
  notater: NotatRad[],
  gjoremal: {
    tekst: string;
    frist: string | null;
    ferdig: string | null;
    dato: string;
  }[] = [],
): string {
  const rader = notater
    .filter((n) => n.skalFolgesOpp)
    .sort(
      (a, b) =>
        Number(a.lukket !== null) - Number(b.lukket !== null) ||
        (a.frist ?? "9999").localeCompare(b.frist ?? "9999"),
    );
  const ut = ["# Oppfølging", ""];
  if (gjoremal.length > 0) {
    ut.push("## Gjøremål", "");
    for (const g of gjoremal) {
      ut.push(
        `- [${g.ferdig ? "x" : " "}] ${g.tekst.replace(/\n+/g, " ")}` +
          (g.frist ? ` — frist ${g.frist}` : "") +
          (g.ferdig ? ` — ferdig ${g.ferdig}` : ""),
      );
    }
    ut.push("", "## Elever", "");
  }
  if (rader.length === 0) {
    ut.push("*Ingen oppfølgingspunkter.*");
    return ut.join("\n") + "\n";
  }
  ut.push("| Elev | Dato | Frist | Status | Notat |");
  ut.push("| --- | --- | --- | --- | --- |");
  for (const r of rader) {
    const forste =
      r.tekst
        .split("\n")
        .map((l) => l.trim())
        .find(Boolean) ?? "";
    ut.push(
      `| ${r.fornavn} ${r.etternavn} | ${r.dato} | ${r.frist ?? ""} ` +
        `| ${r.lukket ? `fulgt opp ${r.lukket.slice(0, 10)}` : "åpen"} | ${tab(forste)} |`,
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

/**
 * Skriver arkivet ved siden av databasekopiene, uansett innstillinger.
 *
 * Dette er forsikringen. En `.sqlite`-fil krever denne appen for å leses;
 * markdown krever ingenting. Ligger de to sammen i `backup/`, er det ikke
 * mulig å ha den ene uten den andre — og en bruker som aldri har valgt en
 * eksportmappe, har den likevel.
 *
 * Bare én utgave, som overskrives. De daterte kopiene er historikken.
 */
export async function skrivArkivTilBackup(
  skolear: Skolear,
): Promise<{ skrevet: number; feil: string[] }> {
  const mappe = await invoke<string>("arkivmappe");
  const filer = await byggArkiv(skolear);
  return invoke<{ skrevet: number; feil: string[] }>("skriv_arkiv", {
    mappe,
    filer,
  });
}

/**
 * Elevens fil fra arkivet, som markdown — til «Eksporter elevens data» på
 * elevkortet (innsyn, §6). Bygges med samme kode som arkivet, så de to
 * aldri sier noe forskjellig. Bildet er ikke med; det går aldri ut.
 */
export async function elevfilFor(
  skolear: Skolear,
  fornavn: string,
  etternavn: string,
): Promise<string | null> {
  const filer = await byggArkiv(skolear);
  const navn = `elever/${slugg(`${fornavn} ${etternavn}`)}.md`;
  return filer.find((f) => f.sti.endsWith(navn))?.innhold ?? null;
}
