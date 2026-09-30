import { invoke } from "@tauri-apps/api/core";
import { lagHendelse, lagSamtaleHendelse } from "./ical";
import { hentOkter } from "./okter";
import { hentSamtaledager, hentSamtaler } from "./samtale";
import { hentInnstilling, settInnstilling, type Skolear } from "./skolear";
import { lytt } from "./endringer";

/**
 * Publisering av timeplanen til brukerens kalenderserver, SPEC §8.1.
 *
 * Ett fag = én kalender på serveren. Da kan en elev abonnere på faget sitt
 * uten å få alle de andre med på kjøpet.
 *
 * Innholdet lages av `lagHendelse`, som er det ene stedet feltlista
 * håndheves. Denne fila bestemmer bare *hvilke* økter som skal skrives og
 * hvilke som skal fjernes — aldri hva som står i dem.
 */

const URL_BASE = "caldav_base";
const BRUKER = "caldav_bruker";
const PA = "caldav_pa";
const KALENDERE = "caldav_kalendere";
/**
 * Mentorsamtalene publiseres bare når dette er uttrykkelig slått på.
 *
 * Egen bryter, ikke en del av `caldav_pa`: et hakk man satte i august skal
 * ikke begynne å sende elevfornavn i november. Se §8.1.
 */
const MENTOR_PA = "caldav_mentor_pa";
const MENTOR_KALENDER = "caldav_mentor_kalender";
/** Nøkkelen mentorsamtalenes kontrollsummer ligger under. Ikke en fag-id. */
const MENTORNOKKEL = "__mentor";
const PUBLISERT = "caldav_publisert";

export type Oppsett = {
  base: string;
  bruker: string;
  pa: boolean;
  /** skolearFagId -> kalendernavn på serveren. Mangler = publiseres ikke. */
  kalendere: Record<string, string>;
  /** av som standard — se MENTOR_PA */
  mentorPa: boolean;
  mentorKalender: string;
};

export async function hentOppsett(): Promise<Oppsett> {
  const [base, bruker, pa, kal, mPa, mKal] = await Promise.all([
    hentInnstilling(URL_BASE),
    hentInnstilling(BRUKER),
    hentInnstilling(PA),
    hentInnstilling(KALENDERE),
    hentInnstilling(MENTOR_PA),
    hentInnstilling(MENTOR_KALENDER),
  ]);
  return {
    base: base ?? "",
    bruker: bruker ?? "",
    pa: pa === "1",
    kalendere: kal ? (JSON.parse(kal) as Record<string, string>) : {},
    mentorPa: mPa === "1",
    mentorKalender: mKal ?? "",
  };
}

export async function lagreOppsett(o: Partial<Oppsett>): Promise<void> {
  if (o.base !== undefined) await settInnstilling(URL_BASE, o.base.trim());
  if (o.bruker !== undefined) await settInnstilling(BRUKER, o.bruker.trim());
  if (o.pa !== undefined) await settInnstilling(PA, o.pa ? "1" : "0");
  if (o.kalendere !== undefined)
    await settInnstilling(KALENDERE, JSON.stringify(o.kalendere));
  if (o.mentorPa !== undefined)
    await settInnstilling(MENTOR_PA, o.mentorPa ? "1" : "0");
  if (o.mentorKalender !== undefined)
    await settInnstilling(MENTOR_KALENDER, o.mentorKalender.trim());
}

export async function lagrePassord(passord: string): Promise<void> {
  await invoke("caldav_lagre_passord", { passord });
}

export async function harPassord(): Promise<boolean> {
  return invoke<boolean>("caldav_har_passord");
}

export async function glemPassord(): Promise<void> {
  await invoke("caldav_glem_passord");
}

export async function test(url: string, bruker: string): Promise<string> {
  return invoke<string>("caldav_test", { url, bruker });
}

/** Det Rust-siden svarer med. */
type Svar = {
  skrevet: number;
  slettet: number;
  feil: string[];
  /** serveren svarte ikke i det hele tatt; resten ble ikke forsøkt */
  avbrutt: boolean;
};

export type Resultat = Svar & {
  /** hvor mange som sto uendret og derfor ikke ble sendt */
  uendret: number;
};

/**
 * Kontrollsum av hendelsen slik den ville blitt sendt.
 *
 * Fungerer bare fordi `lagHendelse` er deterministisk: DTSTAMP kommer fra
 * øktas egen endringstid, ikke fra klokka. Endres det, må dette endres med.
 */
async function summer(ics: string): Promise<string> {
  const bytes = new TextEncoder().encode(ics);
  const sum = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(sum)]
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Hva som lå ute sist, som {fagId: {øktId: kontrollsum}}.
 *
 * Eldre versjoner lagret bare id-ene i en liste. Møter vi den formen, tolkes
 * den som «kjenner ikke innholdet», og alt publiseres på nytt én gang.
 */
function lesForrige(rå: string | null): Record<string, Record<string, string>> {
  if (!rå) return {};
  const data = JSON.parse(rå) as Record<string, unknown>;
  const ut: Record<string, Record<string, string>> = {};
  for (const [fagId, verdi] of Object.entries(data)) {
    ut[fagId] = Array.isArray(verdi)
      ? Object.fromEntries((verdi as string[]).map((id) => [id, ""]))
      : (verdi as Record<string, string>);
  }
  return ut;
}

/**
 * Skriver de endrede øktene til serveren, ett fag om gangen.
 *
 * Vi spør aldri serveren om hva den har — publiseringen er enveis (§8.1). I
 * stedet husker vi kontrollsummen av det vi sendte sist. Er summen den
 * samme, står økta allerede riktig ute og hoppes over; er den borte fra
 * basen, slettes den. Tabellen ligger i `innstilling`, så den følger
 * databasen til en annen maskin.
 *
 * Endrer du én økt, går det derfor én PUT — ikke hele årsplanen.
 */
export async function publiser(skolear: Skolear): Promise<Resultat> {
  const o = await hentOppsett();
  if (!o.base || !o.bruker) {
    throw new Error("Adresse og brukernavn må være satt.");
  }

  const okter = await hentOkter(skolear.id);

  const forrige = lesForrige(await hentInnstilling(PUBLISERT));
  const na: Record<string, Record<string, string>> = {};
  const samlet: Resultat = {
    skrevet: 0,
    slettet: 0,
    feil: [],
    uendret: 0,
    avbrutt: false,
  };

  for (const [fagId, kalender] of Object.entries(o.kalendere)) {
    if (!kalender.trim()) continue;

    const egne = okter.filter((x) => x.skolearFagId === fagId);
    const var_ = forrige[fagId] ?? {};
    const summer_na: Record<string, string> = {};
    const hendelser: { uid: string; ics: string }[] = [];

    for (const okt of egne) {
      const ics = lagHendelse(okt);
      const sum = await summer(ics);
      summer_na[okt.id] = sum;
      // Uendret siden sist? Da har serveren den alt.
      if (var_[okt.id] === sum) samlet.uendret++;
      else hendelser.push({ uid: okt.id, ics });
    }

    const fjern = Object.keys(var_).filter((id) => !(id in summer_na));

    if (hendelser.length > 0 || fjern.length > 0) {
      const r = await invoke<Svar>("caldav_publiser", {
        url: `${o.base.replace(/\/$/, "")}/${kalender.trim()}`,
        bruker: o.bruker,
        hendelser,
        fjern,
      });
      samlet.skrevet += r.skrevet;
      samlet.slettet += r.slettet;
      samlet.feil.push(...r.feil);
      if (r.avbrutt) samlet.avbrutt = true;
      // Feilet noe, skal det prøves på nytt neste gang. Da må vi la være å
      // huske kontrollsummen for dem.
      for (const f of r.feil) {
        const id = f.split(":")[0];
        delete summer_na[id];
      }

      // Ble publiseringen avbrutt, vet vi ikke hvilke av de forsøkte som
      // rakk fram. Da glemmer vi kontrollsummen for alle sammen, ikke bare
      // den som feilet — ellers bokføres økter som publisert uten å ha vært
      // i nærheten av serveren, og de blir aldri sendt.
      //
      // Noen få blir da skrevet på nytt neste gang. En PUT er idempotent,
      // så det koster ingenting utover et kall.
      if (r.avbrutt) {
        for (const h of hendelser) delete summer_na[h.uid];
        na[fagId] = summer_na;
        break;
      }
    }

    na[fagId] = summer_na;
  }

  if (o.mentorPa) {
    Object.assign(na, await mentorKart(skolear, o, forrige, samlet));
  }

  await settInnstilling(PUBLISERT, JSON.stringify(na));
  return samlet;
}

/**
 * Mentorsamtalene, som egne hendelser.
 *
 * Én per samtale, og det eneste som går ut er fornavn og klokkeslett — se
 * `lagSamtaleHendelse`, der feltgrensen håndheves. Fagsamtaler publiseres
 * ikke slik: de hører til en vurdering, og oppgavefordelingen er ikke noe som
 * skal ligge i en kalender.
 */
async function mentorKart(
  skolear: Skolear,
  o: Oppsett,
  forrige: Record<string, Record<string, string>>,
  samlet: Resultat,
): Promise<Record<string, Record<string, string>>> {
  if (!o.mentorKalender.trim()) return {};

  const var_ = forrige[MENTORNOKKEL] ?? {};
  const { summer: summer_na, hendelser } = await mentorHendelser(skolear, var_);
  const fjern = Object.keys(var_).filter((id) => !(id in summer_na));
  samlet.uendret += Object.keys(summer_na).length - hendelser.length;

  if (hendelser.length > 0 || fjern.length > 0) {
    const r = await invoke<Svar>("caldav_publiser", {
      url: `${o.base.replace(/\/$/, "")}/${o.mentorKalender.trim()}`,
      bruker: o.bruker,
      hendelser,
      fjern,
    });
    samlet.skrevet += r.skrevet;
    samlet.slettet += r.slettet;
    samlet.feil.push(...r.feil);
    if (r.avbrutt) samlet.avbrutt = true;
    for (const f of r.feil) delete summer_na[f.split(":")[0]];
    if (r.avbrutt) for (const h of hendelser) delete summer_na[h.uid];
  }

  return { [MENTORNOKKEL]: summer_na };
}

/** Hendelsene for mentorsamtalene, og hvilke av dem som er endret. */
async function mentorHendelser(
  skolear: Skolear,
  publisert: Record<string, string>,
): Promise<{
  summer: Record<string, string>;
  hendelser: { uid: string; ics: string }[];
}> {
  const dager = await hentSamtaledager(skolear.id);
  const kontroll: Record<string, string> = {};
  const hendelser: { uid: string; ics: string }[] = [];

  for (const dag of dager.filter((d) => d.skolearFagId === null && d.dato)) {
    for (const samtale of await hentSamtaler(dag.id)) {
      if (!samtale.motte) continue;
      const ics = lagSamtaleHendelse({
        id: samtale.id,
        fornavn: samtale.fornavn,
        dato: dag.dato,
        klokkeslett: samtale.klokkeslett,
        varighetMin: samtale.varighetMin,
      });
      const sum = await summer(ics);
      kontroll[samtale.id] = sum;
      if (publisert[samtale.id] !== sum)
        hendelser.push({ uid: samtale.id, ics });
    }
  }
  return { summer: kontroll, hendelser };
}

/**
 * Hvor mye som ikke er sendt ut ennå.
 *
 * Skjermen bruker den til å vise om trekningen er publisert, endret siden
 * sist, eller aldri sendt. Den rører ikke nettet — den sammenlikner bare mot
 * kontrollsummene som allerede ligger lagret.
 */
export async function mentorStatus(skolear: Skolear): Promise<{
  pa: boolean;
  kalender: string;
  publiserte: number;
  uendret: number;
  endrede: number;
  fjernes: number;
}> {
  const o = await hentOppsett();
  const var_ = lesForrige(await hentInnstilling(PUBLISERT))[MENTORNOKKEL] ?? {};
  const { summer, hendelser } = await mentorHendelser(skolear, var_);

  return {
    pa: o.mentorPa,
    kalender: o.mentorKalender,
    publiserte: Object.keys(var_).length,
    uendret: Object.keys(summer).length - hendelser.length,
    endrede: hendelser.length,
    fjernes: Object.keys(var_).filter((id) => !(id in summer)).length,
  };
}

/**
 * Publiserer bare mentorsamtalene, uten å røre fagkalenderne.
 *
 * Knappen i samtaleskjermen bruker denne: en trekning er en bevisst handling,
 * og da skal den sendes når du sier fra — ikke som en bivirkning av at du dro
 * en rad.
 */
export async function publiserMentor(skolear: Skolear): Promise<Resultat> {
  const o = await hentOppsett();
  if (!o.base || !o.bruker) {
    throw new Error("Adresse og brukernavn må være satt.");
  }
  if (!o.mentorKalender.trim()) {
    throw new Error("Ingen kalender er satt for mentorsamtaler.");
  }

  const forrige = lesForrige(await hentInnstilling(PUBLISERT));
  const samlet: Resultat = {
    skrevet: 0,
    slettet: 0,
    feil: [],
    uendret: 0,
    avbrutt: false,
  };

  const kart = await mentorKart(skolear, o, forrige, samlet);
  await settInnstilling(PUBLISERT, JSON.stringify({ ...forrige, ...kart }));
  return samlet;
}

// ------------------------------------------------------------ automatikk

const VENT_MS = 6000;

let timer: ReturnType<typeof setTimeout> | null = null;
let jobber = false;
let igjen = false;

/**
 * Publiserer kort tid etter siste endring.
 *
 * Ventetiden er der fordi en redigeringsøkt gir mange små lagringer — felt
 * lagrer når de forlates — og hver av dem skal ikke bli en tur til serveren.
 * Timeren nullstilles ved hver ny endring, så publiseringen skjer når du har
 * stoppet, ikke mens du holder på.
 *
 * Kjører det alt en publisering, settes en ny i kø i stedet for å starte
 * parallelt. To samtidige ville skrevet hver sin kontrollsumtabell, og den
 * siste ville vunnet — med endringer på avveie som resultat.
 */
export function startAuto(skolear: Skolear): () => void {
  const kjor = async () => {
    if (jobber) {
      igjen = true;
      return;
    }
    jobber = true;
    try {
      const o = await hentOppsett();
      if (o.pa && o.base && o.bruker) await publiser(skolear);
    } catch (e) {
      // Nettet kan være nede, eller serveren utilgjengelig. Det skal ikke
      // stoppe arbeidet i appen — neste endring prøver på nytt.
      console.error("automatisk publisering:", e);
    } finally {
      jobber = false;
      if (igjen) {
        igjen = false;
        void kjor();
      }
    }
  };

  const av = lytt(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void kjor(), VENT_MS);
  });

  // Ett forsøk ved oppstart, som sikkerhetsnett hvis noe ble endret mens
  // serveren var utilgjengelig.
  void kjor();

  return () => {
    av();
    if (timer) clearTimeout(timer);
  };
}
