import { useEffect, useState } from "react";
import {
  hentGlipp,
  hentInnsatslinjer,
  mandagFor,
  snittfarge,
  ukesfarge,
  type Innsatslinje,
  hentKommendeVurderinger,
  hentTimeregnskap,
  hentVurderingstimer,
  type Fagtimer,
  type Glipp,
  type Kommende,
} from "../data/dashbord";
import { Fagmerke, Kappet, Tomtilstand } from "../ui/felles";

/**
 * Årsoversikten på startskjermen.
 *
 * Fire paneler, og bare ett av dem er egentlig en graf. Timeregnskapet er en
 * måler, og de to nederste er lister — form følger jobben, ikke lysten til å
 * tegne noe. Alt bygger på skåringer som teller (§5.1): «ikke i økta» er
 * filtrert bort allerede i spørringslaget.
 */
export function Arsoversikt({
  skolearId,
  skolestart,
  onApneElev,
  onApneVurdering,
}: {
  skolearId: string;
  /** første skoledag — innsatslinjene begynner der */
  skolestart: string;
  onApneElev: (elevId: string) => void;
  onApneVurdering: (vurderingId: string) => void;
}) {
  // Alle fire hentes samlet og settes i én state. Før var det fire kall som
  // hver satte sin egen, og siden hvert panel er innholdsstyrt flyttet
  // oversikten på seg hver gang et av dem landet — fire ganger ved åpning.
  //
  // Avbruddsvakta hører med: bytter man skoleår mens kallene er ute, skal
  // ikke det gamle årets tall lande i det nye.
  const [data, setData] = useState<Oversikt | null>(null);

  useEffect(() => {
    let avbrutt = false;
    (async () => {
      const [uker, timer, glipp, kommende, vurdering] = await Promise.all([
        hentInnsatslinjer(skolearId),
        hentTimeregnskap(skolearId),
        hentGlipp(skolearId),
        hentKommendeVurderinger(skolearId),
        hentVurderingstimer(skolearId),
      ]);
      if (avbrutt) return;
      setData({
        uker,
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

  return (
    <div className="mt-8 grid gap-x-8 gap-y-7 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <Innsats linjer={data?.uker ?? []} skolestart={skolestart} />
      </div>
      <Timeregnskap fag={data?.timer ?? []} mentor={data?.mentor ?? null} />
      <div className="grid gap-y-7">
        <Vurderingsfrister
          rader={data?.kommende ?? []}
          onApne={onApneVurdering}
        />
        <Glipper elever={data?.glipp ?? []} onApne={onApneElev} />
      </div>
    </div>
  );
}

type Oversikt = {
  uker: Innsatslinje[];
  timer: Fagtimer[];
  /** mentorsamtalene, som ikke hører til noe fag (§4.10) */
  mentor: { timer: number; antall: number } | null;
  glipp: Glipp[];
  kommende: Kommende[];
};

function Panel({
  tittel,
  hjelp,
  handling,
  children,
}: {
  tittel: string;
  hjelp?: string;
  handling?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline gap-3 border-b border-linje pb-1">
        <h2 className="text-etikett uppercase tracking-etikett text-blekk-dempet">
          {tittel}
        </h2>
        {hjelp && <span className="text-liten text-blekk-svak">{hjelp}</span>}
        {handling && <span className="ml-auto">{handling}</span>}
      </div>
      {children}
    </section>
  );
}

// ------------------------------------------------------------------ innsats

const PRIKKFARGE = {
  gronn: "var(--color-lys-gronn)",
  gronngul: "var(--color-lys-gronngul)",
  gul: "var(--color-lys-gul)",
  oransje: "var(--color-lys-oransje)",
  rod: "var(--color-lys-rod)",
} as const;

/**
 * Innsats over tid: én tynn linje per fag, én prikk per uke.
 *
 * Prikkens farge er uka samlet i trafikklysets fem trinn — andelen grønt,
 * der gult teller halvt. Uker uten skåringer har ingen prikk, så hullene
 * synes. Samme språk som heatmapet på elevkortet: små prikker, ikke grafer.
 */
function Innsats({
  linjer,
  skolestart,
}: {
  linjer: Innsatslinje[];
  skolestart: string;
}) {
  // Ukene fra skolestart til i dag, felles for alle fagene.
  const forste = mandagFor(skolestart);
  const siste = mandagFor(isoIdag());
  const uker: string[] = [];
  for (let m = forste; m <= siste; m = pluss7(m)) uker.push(m);

  return (
    <Panel tittel="Innsats over tid" hjelp="én prikk per uke">
      {linjer.length === 0 ? (
        <p className="py-2 text-brod text-blekk-svak">
          Ingen skåringer ført ennå. Linjene fyller seg etter hvert som du
          skårer øktene.
        </p>
      ) : (
        <div className="space-y-2.5 pt-1">
          {linjer.map((l) => {
            const perUke = new Map(l.prikker.map((p) => [p.mandag, p]));
            return (
              <div key={l.skolearFagId} className="flex items-center gap-3">
                <span className="flex w-20 shrink-0 items-center gap-1.5 text-liten font-medium">
                  <span
                    aria-hidden
                    className="h-3 w-[3px] rounded-full"
                    style={{
                      background: l.farge ?? "var(--color-linje-sterk)",
                    }}
                  />
                  <span className="truncate">{l.kode}</span>
                </span>
                <div className="relative flex h-4 flex-1 items-center">
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-1/2 h-px bg-linje"
                  />
                  {uker.map((m) => {
                    const p = perUke.get(m);
                    const f = p ? ukesfarge(p) : null;
                    return (
                      <span
                        key={m}
                        className="group/prikk relative flex flex-1 justify-center"
                      >
                        {f && (
                          <>
                            <span
                              className="h-2.5 w-2.5 rounded-full ring-2 ring-ark"
                              style={{ background: PRIKKFARGE[f] }}
                            />
                            <span
                              role="tooltip"
                              className="pointer-events-none absolute bottom-full z-20 mb-1.5 hidden whitespace-nowrap rounded-liten border border-linje bg-ark px-2 py-1 text-liten shadow-[var(--shadow-panel)] group-hover/prikk:block"
                            >
                              <span className="font-medium tabular-nums">
                                Uke {isoUke(m)} · {norskDato(m)}
                              </span>
                              <span className="ml-2 tabular-nums text-blekk-dempet">
                                grønn {p!.gronn} · gul {p!.gul} · rød {p!.rod}
                              </span>
                            </span>
                          </>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div className="flex gap-3 pl-[5.75rem] text-mikro tabular-nums text-blekk-svakest">
            <span>uke {isoUke(forste)}</span>
            <span className="ml-auto">uke {isoUke(siste)}</span>
          </div>
        </div>
      )}
    </Panel>
  );
}

function pluss7(dato: string): string {
  const [a, m, d] = dato.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + 7)).toISOString().slice(0, 10);
}

function isoUke(dato: string): number {
  const [a, m, d] = dato.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const nyttar = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - nyttar) / 86400000 + 1) / 7);
}

// ------------------------------------------------------------- timeregnskap

function Timeregnskap({
  fag,
  mentor,
}: {
  fag: Fagtimer[];
  mentor: { timer: number; antall: number } | null;
}) {
  return (
    <Panel tittel="Timeregnskap" hjelp="planlagt mot årstimetall">
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
  const timer = fag.planlagtMin / 60;
  const mal = fag.arstimetall;
  const andel = mal && mal > 0 ? timer / mal : null;
  const over = andel !== null && andel > 1;

  return (
    <li>
      <div className="flex items-baseline gap-2 text-brod">
        <Fagmerke kode={fag.kode} farge={fag.farge} liten />
        <Kappet verdi={fag.navn} klasse="text-blekk-dempet" />
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
        <div className="h-[6px] flex-1 overflow-clip rounded-liten bg-flate">
          {andel !== null && (
            <div
              className="h-full rounded-liten"
              style={{
                width: `${Math.min(100, andel * 100)}%`,
                background: over
                  ? "var(--color-feil)"
                  : (fag.farge ?? "var(--color-aksent)"),
              }}
            />
          )}
        </div>
        <span className="w-28 shrink-0 text-right text-liten tabular-nums text-blekk-svak">
          {fag.antallOkter} økter · {fag.avholdte} holdt
        </span>
      </div>

      {mal === null && (
        <p className="mt-0.5 text-liten text-blekk-svak">
          Årstimetall ikke satt — legg det inn i Fag for å se differansen.
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

function Glipper({
  elever,
  onApne,
}: {
  elever: Glipp[];
  onApne: (id: string) => void;
}) {
  return (
    <Panel tittel="Elever som glipper" hjelp="lavest snitt først">
      {elever.length === 0 ? (
        <Tomtilstand tekst="Ingen elever er skåret ennå." />
      ) : (
        <ul className="divide-y divide-linje-svak">
          {elever.map((e) => (
            <li key={e.elevId}>
              <button
                onClick={() => onApne(e.elevId)}
                title={`Snitt ${Math.round(e.snitt * 100)} av 100 over ${e.antall} skåringer, sist ${norskDato(e.siste)}`}
                className="flex w-full items-center gap-2 py-1 text-left text-brod hover:text-aksent"
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: PRIKKFARGE[snittfarge(e.snitt)] }}
                />
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

// ------------------------------------------------------------- vurderinger

function Vurderingsfrister({
  rader,
  onApne,
}: {
  rader: Kommende[];
  onApne: (vurderingId: string) => void;
}) {
  const idag = isoIdag();

  return (
    <Panel tittel="Vurderingsfrister" hjelp="nærmeste først">
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
