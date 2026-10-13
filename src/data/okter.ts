import { hent, oppdater, settInn, slett, settInnEllerOppdater } from "../db";
import { varsle, varsleElever } from "./endringer";
import type { Skalaverdi } from "../skala";

/**
 * Økter, SPEC §4.2.
 *
 * Økta er dato + fag. Tema, varighet, plan og logg er innhold, ikke identitet.
 * Ingenting sperrer for to økter i samme fag samme dag — klokkeslettet skiller
 * dem, og i praksis skjer det sjelden.
 */

export type Okt = {
  id: string;
  kode: string | null;
  skolearFagId: string;
  fagKode: string;
  fagNavn: string;
  farge: string | null;
  periodeId: string | null;
  dato: string;
  klokkeslett: string | null;
  varighetMin: number;
  tema: string | null;
  sted: string | null;
  /** kort beskrivelse for eleven; går ut i kalenderen */
  agenda: string | null;
  /** lekse til økta. Står på årsplanarket, går aldri ut i kalenderen. */
  lekse: string | null;
  /** fritekst-mål for fag uten Udir-kode (de med kode ligger i okt_kompetansemal) */
  kompetansemal?: string | null;
  /** lokal ISO. Brukes som DTSTAMP og til å se hva som faktisk er endret. */
  endret: string;
  plan: string | null;
  logg: string | null;
  /** antall skåringsrader som faktisk finnes */
  skaret: number;
  /** antall elever koblet til faget i år */
  elever: number;
  /** fordelingen av skåringene som teller, til stripa i lista */
  gronn: number;
  gul: number;
  rod: number;
};

export type OktElev = {
  elevId: string;
  fornavn: string;
  etternavn: string;
  kode: string | null;
  /** klassen eleven går i det året faget hører til */
  klasse: string | null;
  /** null = ingen skåringsrad. Vises som 0 hvis økta er avholdt. */
  skalaverdiId: string | null;
  notat: string | null;
  /**
   * Siste notat på eleven fra en tidligere økt i faget. Vises i grått på
   * raden når markøren står på en elev uten notat i denne økta (§4.4).
   */
  forrigeNotat: string | null;
};

/**
 * Øktene som ligger innenfor skoleårets spenn.
 *
 * En økt datert før skolestart eller etter skoleslutt blir stående — den
 * vises tonet ned i kalenderen, så du kan se den og rette den. Men den skal
 * ikke telle i timeregnskapet, for da måles planen mot et årstimetall den
 * ikke hører til.
 */
export function innenforAret<T extends { dato: string }>(
  okter: T[],
  start: string,
  slutt: string,
): T[] {
  return okter.filter((o) => o.dato >= start && o.dato <= slutt);
}

export async function hentOkter(skolearId: string): Promise<Okt[]> {
  return hent<Okt>(
    `SELECT o.id,
            o.kode,
            o.skolear_fag_id AS skolearFagId,
            COALESCE(NULLIF(f.alias, ''), f.kode) AS fagKode,
            f.navn           AS fagNavn,
            f.farge          AS farge,
            o.periode_id     AS periodeId,
            o.dato,
            o.klokkeslett,
            o.varighet_min   AS varighetMin,
            o.tema, o.sted, o.agenda, o.lekse, o.plan, o.logg, o.endret,
            o.kompetansemal,
            -- Bare elever som står i faget nå teller — samme elever som lista
            -- viser. En elev som er tatt ut av faget, har skåringene sine i
            -- behold (de kommer tilbake om hen kobles på igjen), men de skal
            -- ikke farge stripa. Slettede elever teller heller ikke.
            (SELECT COUNT(*) FROM skaring s
               JOIN elev e ON e.id = s.elev_id AND e.slettet IS NULL
               JOIN elev_fag ef ON ef.elev_id = s.elev_id
                               AND ef.skolear_fag_id = o.skolear_fag_id
                               AND ef.slettet IS NULL
              WHERE s.okt_id = o.id AND s.slettet IS NULL) AS skaret,
            (SELECT COUNT(*) FROM skaring s
               JOIN elev e ON e.id = s.elev_id AND e.slettet IS NULL
               JOIN elev_fag ef ON ef.elev_id = s.elev_id
                               AND ef.skolear_fag_id = o.skolear_fag_id
                               AND ef.slettet IS NULL
               JOIN skalaverdi v ON v.id = s.skalaverdi_id
              WHERE s.okt_id = o.id AND s.slettet IS NULL
                AND v.teller_ikke = 0 AND v.farge = 'gronn') AS gronn,
            (SELECT COUNT(*) FROM skaring s
               JOIN elev e ON e.id = s.elev_id AND e.slettet IS NULL
               JOIN elev_fag ef ON ef.elev_id = s.elev_id
                               AND ef.skolear_fag_id = o.skolear_fag_id
                               AND ef.slettet IS NULL
               JOIN skalaverdi v ON v.id = s.skalaverdi_id
              WHERE s.okt_id = o.id AND s.slettet IS NULL
                AND v.teller_ikke = 0 AND v.farge = 'gul') AS gul,
            (SELECT COUNT(*) FROM skaring s
               JOIN elev e ON e.id = s.elev_id AND e.slettet IS NULL
               JOIN elev_fag ef ON ef.elev_id = s.elev_id
                               AND ef.skolear_fag_id = o.skolear_fag_id
                               AND ef.slettet IS NULL
               JOIN skalaverdi v ON v.id = s.skalaverdi_id
              WHERE s.okt_id = o.id AND s.slettet IS NULL
                AND v.teller_ikke = 0 AND v.farge = 'rod') AS rod,
            (SELECT COUNT(*) FROM elev_fag ef
               JOIN elev e ON e.id = ef.elev_id AND e.slettet IS NULL
              WHERE ef.skolear_fag_id = o.skolear_fag_id
                AND ef.slettet IS NULL) AS elever
       FROM okt o
       JOIN skolear_fag sf ON sf.id = o.skolear_fag_id AND sf.slettet IS NULL
       JOIN fag f ON f.id = sf.fag_id AND f.slettet IS NULL
      WHERE o.slettet IS NULL AND sf.skolear_id = $1
      ORDER BY o.dato, o.klokkeslett IS NULL, o.klokkeslett`,
    [skolearId],
  );
}

/**
 * Elevlista leses live fra faget, hver gang panelet åpnes. Legges en elev til
 * i MFL1 i november, dukker hen opp i alle MFL1-økter — også de som allerede
 * er skåret, der hen står med 0.
 */
export async function hentOktElever(
  oktId: string,
  skolearFagId: string,
): Promise<OktElev[]> {
  return hent<OktElev>(
    `SELECT e.id        AS elevId,
            e.fornavn, e.etternavn, e.kode,
            k.navn AS klasse,
            s.skalaverdi_id AS skalaverdiId,
            n.tekst AS notat,
            (SELECT fn.tekst
               FROM oktnotat fn
               JOIN okt fo ON fo.id = fn.okt_id AND fo.slettet IS NULL
               JOIN okt denne ON denne.id = $1
              WHERE fn.elev_id = e.id AND fn.slettet IS NULL
                AND fo.skolear_fag_id = $2 AND fo.id <> $1
                AND TRIM(fn.tekst) <> ''
                AND fo.dato || ' ' || COALESCE(fo.klokkeslett, '')
                  < denne.dato || ' ' || COALESCE(denne.klokkeslett, '')
              ORDER BY fo.dato DESC, fo.klokkeslett DESC
              LIMIT 1) AS forrigeNotat
       FROM elev_fag ef
       JOIN elev e ON e.id = ef.elev_id AND e.slettet IS NULL
       JOIN skolear_fag sf ON sf.id = ef.skolear_fag_id
       LEFT JOIN elev_klasse ek
              ON ek.elev_id = e.id AND ek.skolear_id = sf.skolear_id
             AND ek.slettet IS NULL
       LEFT JOIN klasse k ON k.id = ek.klasse_id AND k.slettet IS NULL
       LEFT JOIN skaring s
              ON s.elev_id = e.id AND s.okt_id = $1 AND s.slettet IS NULL
       LEFT JOIN oktnotat n
              ON n.elev_id = e.id AND n.okt_id = $1 AND n.slettet IS NULL
      WHERE ef.skolear_fag_id = $2 AND ef.slettet IS NULL
      ORDER BY e.fornavn COLLATE NOCASE, e.etternavn COLLATE NOCASE`,
    [oktId, skolearFagId],
  );
}

/** Skåringsskalaen som gjelder for faget. Trafikklyset hvis ingenting er satt. */
export async function hentSkaringsskala(
  skolearFagId: string,
): Promise<Skalaverdi[]> {
  return hent<Skalaverdi>(
    `SELECT v.*
       FROM skolear_fag sf
       JOIN skalaverdi v ON v.skala_id = COALESCE(
              sf.skaringsskala_id, '5ca1a000-0000-4000-8000-000000000001')
      WHERE sf.id = $1
      ORDER BY v.rang`,
    [skolearFagId],
  );
}

/**
 * Lesbar id: YYMM-fagkode-#, der # er ett høyere enn det høyeste nummeret
 * som er brukt i faget den måneden. Slettede økter er med: før ble antallet
 * talt, og etter en sletting fikk neste økt samme kode som en som fantes.
 */
async function lagOktkode(
  skolearFagId: string,
  fagKode: string,
  dato: string,
): Promise<string> {
  const [ar, maned] = dato.split("-");
  const prefiks = `${ar.slice(2)}${maned}-${fagKode}-`;
  const koder = await hent<{ kode: string | null }>(
    `SELECT kode FROM okt
      WHERE skolear_fag_id = $1 AND dato LIKE $2`,
    [skolearFagId, `${ar}-${maned}-%`],
  );
  const hoyeste = koder.reduce((maks, k) => {
    const n = k.kode?.startsWith(prefiks)
      ? Number(k.kode.slice(prefiks.length))
      : 0;
    return Number.isFinite(n) && n > maks ? n : maks;
  }, 0);
  return `${prefiks}${hoyeste + 1}`;
}

export async function opprettOkt(
  skolearFagId: string,
  fagKode: string,
  dato: string,
  klokkeslett: string | null,
  varighetMin: number,
): Promise<string> {
  // Fagets standard rom følger med inn i økta, så det ikke må skrives på
  // hver av dem. Endres det på én økt, gjelder det bare den.
  const [fag] = await hent<{ rom: string | null }>(
    "SELECT rom FROM skolear_fag WHERE id = $1",
    [skolearFagId],
  );
  // En økt som legges midt i en farget periode, får periodens farge med én
  // gang. Faller den utenfor alle, står den uten til den farges.
  const [periode] = await hent<{ id: string }>(
    `SELECT id FROM periode
      WHERE skolear_fag_id = $1 AND slettet IS NULL
        AND start IS NOT NULL AND slutt IS NOT NULL
        AND $2 BETWEEN start AND slutt
      ORDER BY start, rekkefolge LIMIT 1`,
    [skolearFagId, dato],
  );
  const id = await settInn("okt", {
    skolear_fag_id: skolearFagId,
    periode_id: periode?.id ?? null,
    dato,
    klokkeslett,
    varighet_min: varighetMin,
    sted: fag?.rom ?? null,
    kode: await lagOktkode(skolearFagId, fagKode, dato),
  });

  // En vurdering som allerede har frist denne dagen, uten økt, hører til
  // økta som nå legges inn — så sant den er dagens eneste i faget.
  const samme = await hent<{ n: number }>(
    `SELECT COUNT(*) AS n FROM okt
      WHERE skolear_fag_id = $1 AND dato = $2 AND slettet IS NULL`,
    [skolearFagId, dato],
  );
  if (samme[0]?.n === 1) {
    const uten = await hent<{ id: string }>(
      `SELECT v.id FROM vurdering v
        WHERE v.skolear_fag_id = $1 AND v.frist = $2 AND v.slettet IS NULL
          AND NOT EXISTS (SELECT 1 FROM vurdering_okt vo
                           WHERE vo.vurdering_id = v.id AND vo.slettet IS NULL)`,
      [skolearFagId, dato],
    );
    for (const v of uten) {
      await settInn("vurdering_okt", { vurdering_id: v.id, okt_id: id });
    }
  }

  varsle();
  return id;
}

/**
 * Økta rett før i samme fag, med loggen. Til «Notat fra forrige økt» i
 * øktkortet. Samme regel som `forrigeOkt` i dagen.ts: den rett før, ikke
 * den siste som har et notat.
 */
export async function hentForrigeOkt(
  okt: Pick<Okt, "id" | "skolearFagId" | "dato" | "klokkeslett">,
): Promise<{ id: string; dato: string; logg: string | null } | null> {
  const [rad] = await hent<{ id: string; dato: string; logg: string | null }>(
    `SELECT id, dato, logg FROM okt
      WHERE skolear_fag_id = $1 AND slettet IS NULL AND id <> $2
        AND dato || ' ' || COALESCE(klokkeslett, '') < $3
      ORDER BY dato DESC, klokkeslett DESC
      LIMIT 1`,
    [okt.skolearFagId, okt.id, `${okt.dato} ${okt.klokkeslett ?? ""}`],
  );
  return rad ?? null;
}

export async function endreOkt(
  id: string,
  felter: {
    dato?: string;
    klokkeslett?: string | null;
    varighet_min?: number;
    tema?: string | null;
    sted?: string | null;
    agenda?: string | null;
    lekse?: string | null;
    kompetansemal?: string | null;
    plan?: string | null;
    logg?: string | null;
    periode_id?: string | null;
  },
): Promise<void> {
  // Datoen før flyttingen, så vurderingsfristen kan følge med (under).
  const [for_] =
    felter.dato !== undefined
      ? await hent<{ dato: string }>("SELECT dato FROM okt WHERE id = $1", [id])
      : [];

  await oppdater("okt", id, felter);

  // En vurdering med frist på økta flytter med når koblingen er enkel: økta
  // er vurderingens eneste, og fristen sto på den gamle datoen. Samme regel
  // som settFrist, bare andre veien. En vurdering over flere økter, eller
  // med en frist en annen dag, beholder fristen sin.
  if (for_ && felter.dato && felter.dato !== for_.dato) {
    const flytt = await hent<{ id: string }>(
      `SELECT v.id FROM vurdering v
         JOIN vurdering_okt vo ON vo.vurdering_id = v.id AND vo.slettet IS NULL
        WHERE vo.okt_id = $1 AND v.slettet IS NULL AND v.frist = $2
          AND (SELECT COUNT(*) FROM vurdering_okt x
                 JOIN okt o ON o.id = x.okt_id AND o.slettet IS NULL
                WHERE x.vurdering_id = v.id AND x.slettet IS NULL) = 1`,
      [id, for_.dato],
    );
    for (const v of flytt)
      await oppdater("vurdering", v.id, { frist: felter.dato });
  }

  // Samtaledager som ligger i økta, følger den når den flyttes eller endrer
  // lengde. Samtalene som alt er trukket, står på sine klokkeslett — de må
  // trekkes på nytt om rammen er endret.
  if (
    felter.dato !== undefined ||
    felter.klokkeslett !== undefined ||
    felter.varighet_min !== undefined
  ) {
    const [o] = await hent<{
      dato: string;
      klokkeslett: string | null;
      varighetMin: number;
    }>(
      "SELECT dato, klokkeslett, varighet_min AS varighetMin FROM okt WHERE id = $1",
      [id],
    );
    const dager = await hent<{ id: string }>(
      "SELECT id FROM samtaledag WHERE okt_id = $1 AND slettet IS NULL",
      [id],
    );
    for (const d of dager) {
      const ramme: Record<string, unknown> = { dato: o.dato };
      if (o.klokkeslett) {
        const [t, m] = o.klokkeslett.split(":").map(Number);
        const slutt = t * 60 + m + o.varighetMin;
        ramme.fra = o.klokkeslett;
        ramme.til = `${String(Math.floor(slutt / 60)).padStart(2, "0")}:${String(slutt % 60).padStart(2, "0")}`;
      }
      await oppdater("samtaledag", d.id, ramme);
    }
  }
  varsle();
}

/**
 * En kopi av økta på en annen dato: tid, lengde, tema, rom, agenda, lekse,
 * plan og kompetansemål (både de avkryssede fra Udir og fritekstfeltet).
 * Skåringer, logg og vurderinger følger ikke med: de hører til økta som
 * ble holdt. Perioden settes av den som kaller (fargelegg), som før.
 */
export async function dupliserOkt(
  okt: Pick<
    Okt,
    | "id"
    | "skolearFagId"
    | "klokkeslett"
    | "varighetMin"
    | "tema"
    | "sted"
    | "agenda"
    | "lekse"
    | "plan"
  > & { kompetansemal?: string | null },
  fagKode: string,
  dato: string,
): Promise<string> {
  const ny = await opprettOkt(
    okt.skolearFagId,
    fagKode,
    dato,
    okt.klokkeslett,
    okt.varighetMin,
  );
  await endreOkt(ny, {
    tema: okt.tema,
    sted: okt.sted,
    agenda: okt.agenda,
    lekse: okt.lekse,
    plan: okt.plan,
    kompetansemal: okt.kompetansemal ?? null,
  });
  const mal = await hent<{ kode: string }>(
    "SELECT kode FROM okt_kompetansemal WHERE okt_id = $1 AND slettet IS NULL",
    [okt.id],
  );
  for (const m of mal)
    await settInn("okt_kompetansemal", { okt_id: ny, kode: m.kode });
  varsle();
  return ny;
}

export async function slettOkt(id: string): Promise<void> {
  await slett("okt", id);
  varsle();
}

/**
 * Sletter flere økter under ett.
 *
 * Varselet går én gang til slutt, ikke per økt, så ingen lytter laster på
 * nytt midt i en batch.
 */
export async function slettOkter(ider: string[]): Promise<void> {
  if (ider.length === 0) return;
  for (const id of ider) await slett("okt", id);
  varsle();
}

/**
 * Spørsmålet som stilles før økter slettes.
 *
 * Skåringene er det som gjør slettingen alvorlig: en økt kan legges inn
 * igjen, men det elevene fikk registrert er borte fra heatmapet. Derfor
 * står antallet i spørsmålet, ikke bare antall økter.
 */
export function slettetekst(
  valgte: { fagKode: string; dato: string; skaret: number }[],
): string {
  const skaret = valgte.reduce((n, o) => n + o.skaret, 0);
  const hva =
    valgte.length === 1
      ? `Slette økta ${valgte[0].fagKode} ${langDato(valgte[0].dato)}?`
      : `Slette ${valgte.length} økter?`;
  const advarsel =
    skaret > 0
      ? `\n\n${skaret} skåring${skaret === 1 ? "" : "er"} er ført på ` +
        `${valgte.length === 1 ? "den" : "dem"} og forsvinner fra heatmapet.`
      : "";
  return hva + advarsel;
}

/**
 * Økta som tekst å lime inn i Teams.
 *
 * Bare det som er skrevet for eleven blir med: fagkode, når, tema, agenda
 * og lekse.
 * `plan` og `logg` er lærerens egne notater og skal aldri ut — samme
 * feltgrense som kalenderpubliseringen i §8.1, og av samme grunn.
 *
 * Tomme felter utelates helt framfor å stå igjen som tomme linjer.
 */
export function teamstekst(okt: {
  fagKode: string;
  dato: string;
  klokkeslett: string | null;
  tema: string | null;
  agenda: string | null;
  lekse?: string | null;
}): string {
  const nar = okt.klokkeslett
    ? `${langDato(okt.dato)}, ${okt.klokkeslett}`
    : langDato(okt.dato);

  const lekse = okt.lekse?.trim();
  return [
    `${okt.fagKode}: ${nar}`,
    okt.tema?.trim(),
    okt.agenda?.trim(),
    lekse && `Lekse: ${lekse}`,
  ]
    .filter((d) => d && d !== "")
    .join("\n\n");
}

function langDato(dato: string): string {
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/**
 * Setter skåring. Én rad per elev per økt — skåres på nytt, oppdateres raden.
 *
 * UNIQUE(elev_id, okt_id) gjelder også soft-slettede rader, så en rad som er
 * fjernet med ⌫ gjenbrukes i stedet for at vi setter inn en ny (§12).
 */
export async function settSkaring(
  elevId: string,
  oktId: string,
  skalaverdiId: string,
): Promise<void> {
  await settInnEllerOppdater("skaring", ["elev_id", "okt_id"], {
    elev_id: elevId,
    okt_id: oktId,
    skalaverdi_id: skalaverdiId,
  });
}

export async function fjernSkaring(
  elevId: string,
  oktId: string,
): Promise<void> {
  const finnes = await hent<{ id: string }>(
    "SELECT id FROM skaring WHERE elev_id = $1 AND okt_id = $2 AND slettet IS NULL",
    [elevId, oktId],
  );
  if (finnes[0]) await slett("skaring", finnes[0].id);
}

/**
 * Notatet på en elev i en økt. Bor i `oktnotat`, ikke på skåringsraden —
 * så det lagres også når eleven ikke er skåret (migrasjon 022). Tom tekst
 * fjerner notatet. Raden gjenbrukes (UNIQUE, §12).
 */
export async function settSkaringsnotat(
  elevId: string,
  oktId: string,
  notat: string,
): Promise<void> {
  const tekst = notat.trim();
  if (!tekst) {
    const [finnes] = await hent<{ id: string }>(
      "SELECT id FROM oktnotat WHERE elev_id = $1 AND okt_id = $2 AND slettet IS NULL",
      [elevId, oktId],
    );
    if (finnes) await slett("oktnotat", finnes.id);
  } else {
    await settInnEllerOppdater("oktnotat", ["elev_id", "okt_id"], {
      elev_id: elevId,
      okt_id: oktId,
      tekst,
    });
  }
  // Notatet står også i elevens tidslinje; kortet under skal vise det.
  varsleElever();
}

export type OktVurdering = {
  id: string;
  tittel: string;
  frist: string | null;
  oktId: string;
  skolearFagId: string;
  /** muntlig | skriftlig | praktisk; null når typen ikke er satt */
  type: "skriftlig" | "muntlig" | "praktisk" | null;
};

/**
 * Vurderingene knyttet til øktene i året, til kolonnen i §4.2 og
 * årsplanarket. En vurdering over to økter står på begge.
 *
 * Bare koblingstabellen teller. Den skrives av seg selv når fristen faller
 * på en dag med én økt i faget, når en økt legges på en fristdag, og når
 * samtaletrekkeren legges over økter — så det vanlige tilfellet koster ingen
 * klikk.
 */
export async function hentOktVurderinger(
  skolearId: string,
): Promise<Map<string, OktVurdering[]>> {
  const alle = await hent<OktVurdering>(
    `SELECT v.id, v.tittel, v.frist, vo.okt_id AS oktId,
            v.skolear_fag_id AS skolearFagId, v.type
       FROM vurdering_okt vo
       JOIN vurdering v ON v.id = vo.vurdering_id AND v.slettet IS NULL
       JOIN skolear_fag sf ON sf.id = v.skolear_fag_id AND sf.slettet IS NULL
       JOIN okt o ON o.id = vo.okt_id AND o.slettet IS NULL
      WHERE vo.slettet IS NULL AND sf.skolear_id = $1
      ORDER BY v.tittel`,
    [skolearId],
  );

  const kart = new Map<string, OktVurdering[]>();
  for (const v of alle) {
    kart.set(v.oktId, [...(kart.get(v.oktId) ?? []), v]);
  }
  return kart;
}
