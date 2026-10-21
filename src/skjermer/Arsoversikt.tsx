import { Sammenleggknapp, useApen } from "../ui/Sammenleggbar";
import { Skarprikk } from "../ui/Skarprikk";
import { Elevfoto } from "../ui/Elevfoto";
import { Utfold } from "../ui/Utfold";
import { createContext, useContext, useEffect, useState } from "react";
import {
  hentGlipp,
  snittfarge,
  hentKommendeVurderinger,
  hentTimeregnskap,
  holdtNa,
  hentVurderingstimer,
  type Fagtimer,
  type Glipp,
  type Kommende,
} from "../data/dashbord";
import { Fagmerke, Kappet, Tomtilstand } from "../ui/felles";
import {
  angreGjoremal,
  angreLoggpost,
  fullforGjoremal,
  hentGjoremal,
  hentLogg,
  type Loggpost,
  nyttGjoremal,
  type Gjoremal,
} from "../data/gjoremal";
import { hentElever, type ElevRad } from "../data/elever";
import { lytt, lyttElever, lyttOktvisning } from "../data/endringer";
import { useArk } from "../ui/Arkstabel";
import { useMinutt } from "./Oktlive";

/**
 * Årsoversikten på startskjermen.
 *
 * Bare ett av panelene er egentlig en graf. Timeregnskapet er en måler, og
 * resten er lister — form følger jobben, ikke lysten til å tegne noe. Alt
 * bygger på skåringer som teller (§5.1): «ikke i økta» er filtrert bort
 * allerede i spørringslaget.
 *
 * Oppsettet er forsidens (DESIGN.md §10): `children` — dagens økter og uka —
 * står i hovedkolonnen med innsats og timeregnskap under, og gjøremål,
 * vurderingsfrister og elever som glipper i en kolonne til høyre. På smal
 * skjerm legger høyrekolonnen seg under.
 */
/**
 * Tallene til flisene på I dag (20.5): timeregnskap, elever som glipper og
 * vurderingsfrister, hentet samlet. Før var det fire kall som hver satte sin
 * egen state, og oversikten flyttet på seg fire ganger ved åpning.
 *
 * Avbruddsvakta hører med: bytter man skoleår mens kallene er ute, skal
 * ikke det gamle årets tall lande i det nye.
 */
export function useOversikt(skolearId: string): Oversikt | null {
  const [data, setData] = useState<Oversikt | null>(null);
  useEffect(() => {
    let avbrutt = false;
    (async () => {
      const [timer, glipp, kommende, vurdering] = await Promise.all([
        hentTimeregnskap(skolearId),
        hentGlipp(skolearId),
        hentKommendeVurderinger(skolearId),
        hentVurderingstimer(skolearId),
      ]);
      if (avbrutt) return;
      setData({
        timer,
        glipp,
        kommende,
        mentor: vurdering.get(null) ?? null,
      });
    })();
    return () => {
      avbrutt = true;
    };
  }, [skolearId]);
  return data;
}

/** Inne i en flis på I dag: panelet viser bare innholdet (flisen har tittelen). */
export const IFlis = createContext(false);

export type Oversikt = {
  timer: Fagtimer[];
  /** mentorsamtalene, som ikke hører til noe fag (§4.10) */
  mentor: { timer: number; antall: number } | null;
  glipp: Glipp[];
  kommende: Kommende[];
};

/**
 * Et panel i årsoversikten. Legges sammen med et klikk på overskriften;
 * hjelpeteksten (f.eks. «4 åpne») står også når det er lagt sammen.
 */
function Panel({
  tittel,
  nokkel,
  hjelp,
  handling,
  children,
}: {
  tittel: string;
  /** husker om panelet er lagt sammen (ui/Sammenleggbar) */
  nokkel: string;
  hjelp?: string;
  handling?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [apen, setApen] = useApen(nokkel);
  const iFlis = useContext(IFlis);
  if (iFlis) return <>{children}</>;
  return (
    <section>
      <div
        className={`flex items-baseline gap-3 border-b border-linje pb-1 ${apen ? "mb-2" : ""}`}
      >
        <Sammenleggknapp
          tittel={tittel}
          apen={apen}
          onBytt={() => setApen(!apen)}
          etter={hjelp}
        />
        {handling && apen && <span className="ml-auto">{handling}</span>}
      </div>
      <Utfold apen={apen}>{children}</Utfold>
    </section>
  );
}

/** Formen til snittprikken: nærmeste av de tre trafikklysene (20.1). */
const SNITTSLAG = {
  gronn: "g",
  gronngul: "g",
  gul: "y",
  oransje: "r",
  rod: "r",
} as const;

/** Snittfargen til «Elever som glipper», i trafikklysets fem trinn. */
const PRIKKFARGE = {
  gronn: "var(--color-lys-gronn)",
  gronngul: "var(--color-lys-gronngul)",
  gul: "var(--color-lys-gul)",
  oransje: "var(--color-lys-oransje)",
  rod: "var(--color-lys-rod)",
} as const;

// ------------------------------------------------------------- timeregnskap

export function Timeregnskap({
  fag,
  mentor,
}: {
  fag: Fagtimer[];
  mentor: { timer: number; antall: number } | null;
}) {
  return (
    <Panel
      tittel="Timeregnskap"
      nokkel="forside-timeregnskap"
      hjelp="planlagt mot årstimetall"
    >
      {fag.length === 0 && !mentor ? (
        <Tomtilstand tekst="Ingen fag i skoleåret ennå." />
      ) : (
        <ul className="space-y-2.5">
          {fag.map((f) => (
            <Fagmaler key={f.skolearFagId} fag={f} />
          ))}

          {/*
            Mentorsamtalene står på egen linje uten måler: de hører ikke til
            noe fag, og det finnes ikke noe årstimetall å måle dem mot. Linja
            forteller bare hvor mye tid som er gått med.
          */}
          {mentor && mentor.timer > 0 && (
            <li className="border-t border-linje-svak pt-2">
              <div className="flex items-baseline gap-2 text-brod">
                <span className="text-blekk-dempet">Mentorsamtaler</span>
                <span className="ml-auto shrink-0 tabular-nums">
                  {rundt(mentor.timer)} t
                </span>
              </div>
              <p className="text-liten tabular-nums text-blekk-svak">
                {mentor.antall} {mentor.antall === 1 ? "samtale" : "samtaler"}
              </p>
            </li>
          )}
        </ul>
      )}
    </Panel>
  );
}

function Fagmaler({ fag }: { fag: Fagtimer }) {
  const ark = useArk();
  // Hvor langt man er kommet i det planlagte, minutt for minutt: også en
  // økt som pågår, teller med det som har gått av den.
  const na = useMinutt();
  const holdt = holdtNa(fag, na.getHours() * 60 + na.getMinutes()) / 60;
  const timer = fag.planlagtMin / 60;
  const mal = fag.arstimetall;
  const andel = mal && mal > 0 ? timer / mal : null;
  const holdtAndel = mal && mal > 0 ? Math.min(holdt, timer) / mal : null;
  const over = andel !== null && andel > 1;
  // Nøytral stolpe; faget vises som firkant (20.2).
  const farge = "var(--color-blekk-dempet)";

  return (
    <li>
      <div className="flex items-baseline gap-2 text-brod">
        <button
          onClick={() => ark.apneFag(fag.skolearFagId)}
          className="flex min-w-0 items-baseline gap-2 text-left hover:text-aksent"
        >
          <Fagmerke kode={fag.kode} farge={fag.farge} liten />
          <Kappet verdi={fag.navn} klasse="text-blekk-dempet" />
        </button>
        <span className="ml-auto shrink-0 tabular-nums">
          {rundt(timer)}
          {mal ? <span className="text-blekk-svak"> av {mal}</span> : null} t
          {fag.vurderingTimer > 0 && (
            <span className="text-blekk-svak">
              {", hvorav "}
              {rundt(fag.vurderingTimer)} til vurdering
            </span>
          )}
        </span>
      </div>

      <div className="mt-1 flex items-center gap-2">
        {/*
          Det planlagte i en lys tone av fagfargen, det som er holdt til nå
          i full farge, og en strek der man står.
        */}
        <div
          className="relative h-[6px] flex-1 rounded-liten bg-flate"
          title={`${rundt(holdt)} t holdt av ${rundt(timer)} t planlagt`}
        >
          {andel !== null && (
            <div
              className="absolute inset-y-0 left-0 rounded-liten"
              style={{
                width: `${Math.min(100, andel * 100)}%`,
                background: over
                  ? "color-mix(in srgb, var(--color-feil) 35%, var(--color-flate))"
                  : `color-mix(in srgb, ${farge} 32%, var(--color-flate))`,
              }}
            />
          )}
          {holdtAndel !== null && holdtAndel > 0 && (
            <>
              <div
                className="absolute inset-y-0 left-0 rounded-liten"
                style={{
                  width: `${Math.min(100, holdtAndel * 100)}%`,
                  background: farge,
                }}
              />
              <div
                aria-hidden
                className="absolute -inset-y-[3px] w-0.5 -translate-x-1/2 rounded-full bg-blekk"
                style={{ left: `${Math.min(100, holdtAndel * 100)}%` }}
              />
            </>
          )}
        </div>
        <span className="w-28 shrink-0 text-right text-liten tabular-nums text-blekk-svak">
          {fag.antallOkter} økter · {fag.avholdte} holdt
        </span>
      </div>

      {mal === null && (
        <p className="mt-0.5 text-liten text-blekk-svak">
          Årstimetall ikke satt. Legg det inn i Fag for å se differansen.
        </p>
      )}
      {over && (
        <p className="mt-0.5 text-liten text-feil">
          {rundt(timer - mal!)} timer over årstimetallet.
        </p>
      )}
    </li>
  );
}

// ------------------------------------------------------------------ glipper

export function Glipper({
  elever,
  onApne,
}: {
  elever: Glipp[];
  onApne: (id: string) => void;
}) {
  return (
    <Panel
      tittel="Elever som glipper"
      nokkel="forside-glipper"
      hjelp="to røde av de fem siste · lavest snitt først"
    >
      {elever.length === 0 ? (
        <Tomtilstand tekst="Ingen elever glipper nå." />
      ) : (
        <ul className="divide-y divide-linje-svak">
          {elever.map((e) => (
            <li key={e.elevId}>
              <button
                onClick={() => onApne(e.elevId)}
                title={`Snitt ${Math.round(e.snitt * 100)} av 100 over ${e.antall} skåringer, sist ${norskDato(e.siste)}`}
                className="flex w-full items-center gap-2 py-1 text-left text-brod hover:text-aksent"
              >
                <Skarprikk
                  slag={SNITTSLAG[snittfarge(e.snitt)]}
                  farge={PRIKKFARGE[snittfarge(e.snitt)]}
                  storrelse={10}
                />
                <Elevfoto elevId={e.elevId} storrelse={20} />
                <Kappet verdi={`${e.fornavn} ${e.etternavn}`} />
                {e.klasse && (
                  <span className="shrink-0 text-liten text-blekk-svak">
                    {e.klasse}
                  </span>
                )}
                <span className="ml-auto shrink-0 text-liten tabular-nums text-blekk-dempet">
                  {e.antall} skåringer
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- gjøremål

/** Hvor mange som står før «Vis alle». */
const GJOREMAL_SYNLIGE = 6;

/**
 * Alt som venter: oppfølgingspunkter og åpne avkrysningsbokser fra notater
 * og øktlogger (`data/gjoremal.ts`). Krysses av rett her, og et klikk på
 * teksten åpner eleven eller økta det står i.
 */
export function Gjoremalsliste({ skolearId }: { skolearId: string }) {
  const [liste, setListe] = useState<Gjoremal[]>([]);
  const [alle, setAlle] = useState(false);
  // Loggen (ARBEIDSLISTE 9.5): det som er gjort siste 14 dager, og det du
  // krysset av nettopp — det står øverst med «Angre».
  const [logg, setLogg] = useState<Loggpost[]>([]);
  const [nylig, setNylig] = useState<{ g: Gjoremal; klokke: string }[]>([]);
  const ark = useArk();

  useEffect(() => {
    const last = () => {
      void hentGjoremal(skolearId).then(setListe);
      void hentLogg(skolearId).then(setLogg);
    };
    last();
    const av = [lyttElever(last), lytt(last), lyttOktvisning(last)];
    return () => av.forEach((f) => f());
  }, [skolearId]);

  const idag = isoIdag();
  const synlige = alle ? liste : liste.slice(0, GJOREMAL_SYNLIGE);

  return (
    <Panel
      tittel="Gjøremål"
      nokkel="forside-gjoremal"
      hjelp={liste.length > 0 ? `${liste.length} åpne` : undefined}
    >
      <NyttGjoremal skolearId={skolearId} />
      {liste.length === 0 ? (
        <p className="py-1 text-brod text-blekk-svak">
          Ingenting venter. Skriv et gjøremål over, huk av «skal følges opp» på
          et notat, eller skriv «- [ ]» i et notat eller en øktlogg, så havner
          det her.
        </p>
      ) : (
        <ul className="divide-y divide-linje-svak">
          {synlige.map((g) => {
            const nokkel =
              g.slag === "oktboks"
                ? `${g.oktId}:${g.linje}`
                : g.slag === "eget"
                  ? g.id
                  : `${g.notatId}:${g.slag === "elevboks" ? g.linje : "o"}`;
            const hvem =
              g.slag === "oktboks"
                ? g.fagKode
                : g.slag === "eget"
                  ? null
                  : g.navn;
            const frist =
              g.slag === "oppfolging" || g.slag === "eget" ? g.frist : null;
            return (
              <li key={nokkel} className="flex items-baseline gap-2 py-1">
                <input
                  type="checkbox"
                  title="Ferdig"
                  onChange={async () => {
                    setListe((l) => l.filter((x) => x !== g));
                    setNylig((n) => [
                      { g, klokke: new Date().toTimeString().slice(0, 5) },
                      ...n,
                    ]);
                    await fullforGjoremal(g);
                  }}
                  className="shrink-0 self-center"
                />
                <button
                  onClick={() =>
                    g.slag === "oktboks"
                      ? ark.apneOkt(g.oktId, "skaring")
                      : g.slag === "eget"
                        ? undefined
                        : ark.apneElev(g.elevId)
                  }
                  className={`flex min-w-0 flex-1 items-baseline gap-2 text-left text-brod ${
                    g.slag === "eget" ? "cursor-default" : "hover:text-aksent"
                  }`}
                >
                  {g.slag !== "oktboks" && g.slag !== "eget" && (
                    <Elevfoto
                      elevId={g.elevId}
                      storrelse={18}
                      klasse="self-center"
                    />
                  )}
                  <Kappet verdi={g.tekst || "(uten tekst)"} />
                  {hvem && (
                    <span className="ml-auto shrink-0 text-liten text-blekk-svak">
                      {hvem}
                    </span>
                  )}
                </button>
                {frist && (
                  <span
                    className={`w-14 shrink-0 text-right text-liten tabular-nums ${
                      frist < idag ? "text-feil" : "text-blekk-dempet"
                    }`}
                  >
                    {norskDato(frist)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {liste.length > GJOREMAL_SYNLIGE && (
        <button
          onClick={() => setAlle((v) => !v)}
          className="mt-1 text-liten text-blekk-svak hover:text-blekk"
        >
          {alle ? "Vis færre" : `Vis alle ${liste.length}`}
        </button>
      )}
      <Logg
        logg={logg}
        nylig={nylig}
        onAngre={async (n) => {
          setNylig((l) => l.filter((x) => x !== n));
          await angreGjoremal(n.g);
        }}
        onAngreLogg={(p) => void angreLoggpost(p)}
      />
    </Panel>
  );
}

/**
 * Feltet øverst i gjøremålene. Skriv og trykk Enter. Elev og frist er
 * valgfrie: med elev blir det et oppfølgingsnotat på eleven, uten et eget
 * gjøremål (`nyttGjoremal`).
 */
function NyttGjoremal({ skolearId }: { skolearId: string }) {
  const [tekst, setTekst] = useState("");
  const [elevTekst, setElevTekst] = useState("");
  const [frist, setFrist] = useState("");
  const [elever, setElever] = useState<ElevRad[]>([]);
  const listeId = `gjoremal-elever-${skolearId}`;

  useEffect(() => {
    const last = () => void hentElever(skolearId).then(setElever);
    last();
    return lyttElever(last);
  }, [skolearId]);

  const navn = (e: ElevRad) =>
    `${e.fornavn} ${e.etternavn}${e.klasseNavn ? ` (${e.klasseNavn})` : ""}`;
  const valgtElev = elever.find((e) => navn(e) === elevTekst.trim());
  const ukjentElev = elevTekst.trim() !== "" && !valgtElev;

  async function lagre() {
    if (!tekst.trim() || ukjentElev) return;
    await nyttGjoremal(skolearId, {
      tekst,
      elevId: valgtElev?.id ?? null,
      frist: frist || null,
    });
    setTekst("");
    setElevTekst("");
    setFrist("");
  }

  const enter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void lagre();
    }
  };

  return (
    <div className="mb-1 flex items-center gap-2 border-b border-linje-svak pb-1.5">
      <span
        aria-hidden
        className="w-[13px] shrink-0 text-center text-blekk-svak"
      >
        +
      </span>
      <input
        value={tekst}
        onChange={(e) => setTekst(e.target.value)}
        onKeyDown={enter}
        placeholder="Nytt gjøremål, Enter lagrer"
        className="min-w-0 flex-1 bg-transparent py-0.5 text-brod outline-none placeholder:text-blekk-svak"
      />
      {/* Elev og frist kommer fram når det skrives, så linja er rolig ellers. */}
      {tekst.trim() !== "" && (
        <>
          <input
            value={elevTekst}
            onChange={(e) => setElevTekst(e.target.value)}
            onKeyDown={enter}
            list={listeId}
            placeholder="elev (valgfri)"
            title={ukjentElev ? "Velg en elev fra lista" : undefined}
            className={`w-36 rounded border bg-ark px-1.5 py-0.5 text-liten outline-none focus:border-aksent ${
              ukjentElev ? "border-feil" : "border-linje"
            }`}
          />
          <datalist id={listeId}>
            {elever.map((e) => (
              <option key={e.id} value={navn(e)} />
            ))}
          </datalist>
          <input
            type="date"
            value={frist}
            onChange={(e) => setFrist(e.target.value)}
            onKeyDown={enter}
            title="Frist (valgfri)"
            className="rounded border border-linje bg-ark px-1 py-0.5 text-liten tabular-nums outline-none focus:border-aksent"
          />
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------- vurderinger

export function Vurderingsfrister({
  rader,
  onApne,
}: {
  rader: Kommende[];
  onApne: (vurderingId: string) => void;
}) {
  const idag = isoIdag();

  return (
    <Panel
      tittel="Vurderingsfrister"
      nokkel="forside-frister"
      hjelp="nærmeste først"
    >
      {rader.length === 0 ? (
        <Tomtilstand tekst="Ingen vurderinger med frist." />
      ) : (
        <ul className="divide-y divide-linje-svak">
          {rader.map((v) => {
            const passert = v.frist < idag;
            const ferdig = v.elever > 0 && v.fort >= v.elever;
            return (
              <li key={v.vurderingId}>
                <button
                  onClick={() => onApne(v.vurderingId)}
                  className="flex w-full items-baseline gap-2 py-1 text-left text-brod hover:text-aksent"
                >
                  <Fagmerke kode={v.kode} farge={v.farge} liten />
                  <Kappet verdi={v.tittel} />
                  <span className="ml-auto shrink-0 text-liten tabular-nums text-blekk-svak">
                    {v.fort}/{v.elever}
                  </span>
                  <span
                    className={`w-20 shrink-0 text-right text-liten tabular-nums ${
                      passert && !ferdig ? "text-feil" : "text-blekk-dempet"
                    }`}
                  >
                    {norskDato(v.frist)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- småting

function rundt(n: number): string {
  return (Math.round(n * 10) / 10).toLocaleString("nb-NO");
}

function isoIdag(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function norskDato(dato: string): string {
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
  });
}

/**
 * Loggen under Gjøremål (ARBEIDSLISTE 9.5, SPEC §4.1): det som er gjort de
 * siste 14 dagene, gruppert per dag, med gjennomstreket tekst, hvem eller
 * fag og klokkeslett. Det du krysset av nettopp står øverst med «Angre».
 * Sammenleggbar, og lagt sammen som standard.
 */
function Logg({
  logg,
  nylig,
  onAngre,
  onAngreLogg,
}: {
  logg: Loggpost[];
  nylig: { g: Gjoremal; klokke: string }[];
  onAngre: (n: { g: Gjoremal; klokke: string }) => void;
  onAngreLogg: (p: Loggpost) => void;
}) {
  const [apen, setApen] = useApen("forside-logg", false);
  // Det som står i «nettopp», skal ikke stå en gang til lenger ned.
  const nyligNokler = new Set(
    nylig.map(({ g }) =>
      g.slag === "oppfolging" ? g.notatId : g.slag === "eget" ? g.id : "",
    ),
  );
  const resten = logg.filter(
    (p) => !nyligNokler.has(p.slag === "oppfolging" ? p.notatId : p.id),
  );
  const perDag = new Map<string, Loggpost[]>();
  for (const p of resten)
    perDag.set(p.dato, [...(perDag.get(p.dato) ?? []), p]);
  const antall = resten.length + nylig.length;

  return (
    <section className="mt-3 border-t border-linje-svak pt-2">
      <Sammenleggknapp
        tittel="Logg"
        apen={apen}
        onBytt={() => setApen(!apen)}
        etter={`${antall} fullført siste 14 dager`}
      />
      <Utfold apen={apen}>
        <div className="pt-1.5">
          {nylig.length > 0 && (
            <Logggruppe tittel="Nettopp">
              {nylig.map((n, i) => (
                <Loggrad
                  key={i}
                  tekst={n.g.tekst}
                  hvem={
                    n.g.slag === "oktboks"
                      ? n.g.fagKode
                      : n.g.slag === "eget"
                        ? null
                        : n.g.navn
                  }
                  klokke={n.klokke}
                  onAngre={() => onAngre(n)}
                />
              ))}
            </Logggruppe>
          )}
          {[...perDag].map(([dato, poster]) => (
            <Logggruppe key={dato} tittel={dagnavn(dato)}>
              {poster.map((p) => (
                <Loggrad
                  key={p.slag === "oppfolging" ? p.notatId : p.id}
                  tekst={p.tekst}
                  hvem={
                    p.slag === "oppfolging"
                      ? [p.navn, p.fagKode].filter(Boolean).join(" · ")
                      : null
                  }
                  klokke={p.klokke}
                  onAngre={() => onAngreLogg(p)}
                  angreStille
                />
              ))}
            </Logggruppe>
          ))}
          {antall === 0 && (
            <p className="py-1 text-liten text-blekk-svak">
              Ingenting fullført de siste 14 dagene. Eldre står i arkivet og på
              elevkortet.
            </p>
          )}
        </div>
      </Utfold>
    </section>
  );
}

function Logggruppe({
  tittel,
  children,
}: {
  tittel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1.5">
      <p className="pb-0.5 pt-1 text-etikett text-blekk-dempet first-letter:uppercase">
        {tittel}
      </p>
      <ul>{children}</ul>
    </div>
  );
}

function Loggrad({
  tekst,
  hvem,
  klokke,
  onAngre,
  angreStille = false,
}: {
  tekst: string;
  hvem: string | null;
  klokke: string | null;
  onAngre: () => void;
  /** i loggen står «Angre» bare når musa er over raden */
  angreStille?: boolean;
}) {
  return (
    <li className="group flex items-baseline gap-2 py-0.5 text-liten">
      <span className="min-w-0 flex-1 truncate text-blekk-svak line-through">
        {tekst || "(uten tekst)"}
      </span>
      {hvem && (
        <span className="shrink-0 truncate text-blekk-svak">{hvem}</span>
      )}
      {klokke && (
        <span className="w-10 shrink-0 text-right tabular-nums text-blekk-svak">
          {klokke}
        </span>
      )}
      <button
        onClick={onAngre}
        className={`shrink-0 text-aksent hover:underline ${
          angreStille ? "opacity-0 group-hover:opacity-100" : ""
        }`}
      >
        Angre
      </button>
    </li>
  );
}

/** «I dag», «I går», ellers «tor 1.10». */
function dagnavn(dato: string): string {
  const d = new Date(`${dato}T00:00:00`);
  const idag = new Date();
  idag.setHours(0, 0, 0, 0);
  const dager = Math.round((idag.getTime() - d.getTime()) / 86_400_000);
  if (dager === 0) return "I dag";
  if (dager === 1) return "I går";
  return `${d.toLocaleDateString("nb-NO", { weekday: "short" }).replace(/\.$/, "")} ${d.getDate()}.${d.getMonth() + 1}`;
}
