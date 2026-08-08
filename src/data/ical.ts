import type { Okt } from "./okter";

/**
 * iCalendar-strøm av øktene, til abonnement i en vanlig kalender.
 *
 * **Hva som går ut herfra:** fagkode, tittel, dato, klokkeslett, varighet,
 * sted og agenda. Altså timeplanen — feltlista i SPEC §8.1.
 *
 * Agenda er skrevet for eleven og leses av alle som abonnerer. `plan` og
 * `logg` er lærerens egne notater og går aldri ut.
 *
 * **Hva som aldri går ut:** elevnavn, skåringer, skåringsnotater,
 * vurderingsresultater og klasselister. Heller ikke `okt.plan` eller
 * `okt.logg` — det er lærerens egne arbeidsnotater, og de hører ikke hjemme
 * i en kalender som kan bli synkronisert videre.
 *
 * Legger du til felter her, tenk gjennom hvor de ender opp. En abonnert
 * kalender lagres ofte i iCloud, og da forlater innholdet maskinen.
 */

const PRODID = "-//elevtracking//NONSGML arsplan//NO";

export function lagIcal(
  okter: Okt[],
  kalendernavn: string,
  na: Date = new Date(),
): string {
  const linjer: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(kalendernavn)}`,
    // Hint til klienten om hvor ofte den bør hente. Den bestemmer selv.
    "X-PUBLISHED-TTL:PT15M",
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
  ];

  // Samme hendelse som CalDAV-ressursen bruker. Den skal aldri finnes i to
  // utgaver — da får strømmen og publiseringen ulikt innhold uten at noen
  // oppdager det.
  for (const o of okter) {
    linjer.push(...vevent(o, na));
  }

  linjer.push("END:VCALENDAR");

  // RFC 5545 vil ha CRLF, og linjer over 75 oktetter brettes.
  return linjer.flatMap(brett).join("\r\n") + "\r\n";
}

/**
 * Én økt som en frittstående VCALENDAR.
 *
 * CalDAV lagrer én hendelse per ressurs, ikke hele kalenderen i én fil, så
 * publiseringen trenger denne formen. Innholdet er nøyaktig det samme som i
 * `lagIcal` — samme felter, samme begrensning.
 */
export function lagHendelse(o: Okt, na: Date = new Date()): string {
  const linjer = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    ...vevent(o, na),
    "END:VCALENDAR",
  ];
  return linjer.flatMap(brett).join("\r\n") + "\r\n";
}

/** Selve hendelsen. Delt mellom strømmen og CalDAV-ressursen. */
function vevent(o: Okt, na: Date): string[] {
  const ut = [
    "BEGIN:VEVENT",
    // Øktas egen UUID (§9). Den endrer seg aldri, så en økt som flyttes
    // blir oppdatert i kalenderen i stedet for lagt inn på nytt.
    `UID:${o.id}@elevtracking`,
    // Øktas egen endringstid, ikke klokka nå. Da er utdataen den samme så
    // lenge økta er uendret, og publiseringen kan se hva som faktisk er nytt.
    `DTSTAMP:${utc(o.endret ? new Date(o.endret) : na)}`,
    ...tidspunkt(o),
    `SUMMARY:${esc(sammendrag(o))}`,
  ];
  if (o.sted) ut.push(`LOCATION:${esc(o.sted)}`);
  // Agenda er teksten læreren skriver for eleven. Periodenavnet sto her før,
  // men det er agendaen som skal være kommentaren.
  if (o.agenda) ut.push(`DESCRIPTION:${esc(o.agenda)}`);
  ut.push("END:VEVENT");
  return ut;
}

/** Tittelen på kalenderhendelsen: «FAG: Tittel». */
function sammendrag(o: Okt): string {
  return o.tema ? `${o.fagKode}: ${o.tema}` : o.fagKode;
}

/**
 * Start og slutt.
 *
 * Uten klokkeslett blir økta en heldagshendelse — det er riktigere enn å
 * finne på et tidspunkt. Med klokkeslett regnes alt om til UTC, slik at
 * sommertid håndteres av systemet framfor av en VTIMEZONE vi vedlikeholder
 * selv.
 */
function tidspunkt(o: Okt): string[] {
  if (!o.klokkeslett) {
    // DTEND er eksklusiv for datoverdier: en heldagshendelse 17. august
    // slutter 18. august. Lik start og slutt er ugyldig, og strenge
    // tjenere — Sabre, som Nextcloud bygger på — avviser det.
    const neste = new Date(`${o.dato}T00:00:00`);
    neste.setDate(neste.getDate() + 1);
    return [
      `DTSTART;VALUE=DATE:${o.dato.replace(/-/g, "")}`,
      `DTEND;VALUE=DATE:${iso(neste).replace(/-/g, "")}`,
    ];
  }
  const start = new Date(`${o.dato}T${o.klokkeslett}:00`);
  const slutt = new Date(start.getTime() + o.varighetMin * 60_000);
  return [`DTSTART:${utc(start)}`, `DTEND:${utc(slutt)}`];
}

/** Lokal dato som YYYY-MM-DD, uten å gå via UTC. */
function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 2026-08-15T09:15:00 lokal tid -> 20260815T071500Z */
function utc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** RFC 5545 §3.3.11: omvendt skråstrek, semikolon, komma og linjeskift. */
function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Linjebretting, RFC 5545 §3.1: maks 75 oktetter per linje, fortsettelse
 * innledes med ett mellomrom. Grensen gjelder oktetter, ikke tegn, så æ, ø
 * og å teller dobbelt i UTF-8 — derfor måles det på bytes.
 */
function brett(linje: string): string[] {
  const bytes = new TextEncoder().encode(linje);
  if (bytes.length <= 75) return [linje];

  const ut: string[] = [];
  let start = 0;
  // Første linje tåler 75, de neste 74 fordi mellomrommet spiser én.
  let plass = 75;

  while (start < bytes.length) {
    let slutt = Math.min(start + plass, bytes.length);
    // Ikke del et flerbytetegn på midten.
    while (slutt > start && slutt < bytes.length && (bytes[slutt] & 0xc0) === 0x80) {
      slutt--;
    }
    const bit = new TextDecoder().decode(bytes.slice(start, slutt));
    ut.push(ut.length === 0 ? bit : ` ${bit}`);
    start = slutt;
    plass = 74;
  }
  return ut;
}
