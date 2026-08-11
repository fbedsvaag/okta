import { useEffect, useState } from "react";
import {
  hentGlipp,
  hentInnsatsPerUke,
  hentKommendeVurderinger,
  hentTimeregnskap,
  type Fagtimer,
  type Glipp,
  type Kommende,
  type Uketall,
} from "../data/dashbord";
import { Fagmerke, Tomtilstand } from "../ui/felles";

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
  onApneElev,
  onApneVurderinger,
}: {
  skolearId: string;
  onApneElev: (elevId: string) => void;
  onApneVurderinger: () => void;
}) {
  const [uker, setUker] = useState<Uketall[]>([]);
  const [timer, setTimer] = useState<Fagtimer[]>([]);
  const [glipp, setGlipp] = useState<Glipp[]>([]);
  const [kommende, setKommende] = useState<Kommende[]>([]);

  useEffect(() => {
    void hentInnsatsPerUke(skolearId).then(setUker);
    void hentTimeregnskap(skolearId).then(setTimer);
    void hentGlipp(skolearId).then(setGlipp);
    void hentKommendeVurderinger(skolearId).then(setKommende);
  }, [skolearId]);

  return (
    <div className="mt-8 grid gap-x-8 gap-y-7 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <Innsats uker={uker} />
      </div>
      <Timeregnskap fag={timer} />
      <div className="grid gap-y-7">
        <Vurderingsfrister rader={kommende} onApne={onApneVurderinger} />
        <Glipper elever={glipp} onApne={onApneElev} />
      </div>
    </div>
  );
}

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

const SERIER = [
  { n: "gronn" as const, navn: "Grønn", farge: "var(--color-lys-gronn)" },
  { n: "gul" as const, navn: "Gul", farge: "var(--color-lys-gul)" },
  { n: "rod" as const, navn: "Rød", farge: "var(--color-lys-rod)" },
];

/**
 * Skåringene per uke som stablede stolper.
 *
 * Høyden er antall, ikke andel — en uke med to skåringer og en med tretti
 * sier ikke det samme, og en andelsgraf ville skjult forskjellen.
 *
 * Gulfargen har 2,12:1 mot hvit flate, altså under 3:1. Den er ikke endret,
 * for det er trafikklysets gul og må være den samme som i heatmapet. I stedet
 * har grafen synlige totaler og en tabellvisning, som er den kompensasjonen
 * kontrastkravet ber om.
 */
function Innsats({ uker }: { uker: Uketall[] }) {
  const [tabell, setTabell] = useState(false);

  const sum = uker.reduce(
    (a, u) => ({
      gronn: a.gronn + u.gronn,
      gul: a.gul + u.gul,
      rod: a.rod + u.rod,
    }),
    { gronn: 0, gul: 0, rod: 0 },
  );
  const total = sum.gronn + sum.gul + sum.rod;
  const hoyest = Math.max(1, ...uker.map((u) => u.gronn + u.gul + u.rod));

  return (
    <Panel
      tittel="Innsats over tid"
      hjelp={total > 0 ? `${total} skåringer som teller` : undefined}
      handling={
        uker.length > 0 && (
          <button
            onClick={() => setTabell((v) => !v)}
            className="text-liten text-blekk-dempet hover:text-blekk"
          >
            {tabell ? "Vis graf" : "Vis tabell"}
          </button>
        )
      }
    >
      {uker.length === 0 ? (
        <Tomtilstand tekst="Ingen skåringer ført ennå. Grafen fyller seg selv etter hvert som du skårer øktene." />
      ) : tabell ? (
        <Innsatstabell uker={uker} />
      ) : (
        <>
          <div className="flex items-end gap-[3px] border-b border-linje pt-4">
            {uker.map((u) => (
              <Stolpe key={u.uke} uke={u} hoyest={hoyest} />
            ))}
          </div>
          <div className="mt-1.5 flex items-center gap-4">
            {SERIER.map((s) => (
              <span key={s.n} className="flex items-center gap-1.5 text-liten text-blekk-dempet">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-liten"
                  style={{ background: s.farge }}
                />
                {s.navn}
                <span className="tabular-nums text-blekk-svak">{sum[s.n]}</span>
              </span>
            ))}
            <span className="ml-auto text-liten text-blekk-svak">
              uke {uker[0]?.uke.slice(5)}–{uker[uker.length - 1]?.uke.slice(5)}
            </span>
          </div>
        </>
      )}
    </Panel>
  );
}

/**
 * Én uke. Segmentene skilles med 2 px av flata under, slik at to like farger
 * ved siden av hverandre ikke smelter sammen.
 */
function Stolpe({ uke, hoyest }: { uke: Uketall; hoyest: number }) {
  const total = uke.gronn + uke.gul + uke.rod;
  const deler = SERIER.filter((s) => uke[s.n] > 0);

  return (
    <div className="group/uke relative flex min-w-0 flex-1 flex-col items-center">
      <span className="mb-1 text-mikro tabular-nums text-blekk-svak">{total}</span>

      <div
        className="flex w-full flex-col-reverse justify-start gap-[2px]"
        style={{ height: `${Math.round((total / hoyest) * 96) + 4}px` }}
      >
        {deler.map((s, i) => (
          <div
            key={s.n}
            className={i === deler.length - 1 ? "rounded-t-[4px]" : ""}
            style={{
              background: s.farge,
              flexGrow: uke[s.n],
              minHeight: "3px",
            }}
          />
        ))}
      </div>

      <span className="mt-1 text-mikro tabular-nums text-blekk-svakest">
        {uke.uke.slice(5)}
      </span>

      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full z-20 mb-1 hidden whitespace-nowrap rounded-liten border border-linje bg-ark px-2 py-1 text-liten shadow-[var(--shadow-panel)] group-hover/uke:block"
      >
        <span className="font-medium tabular-nums">{norskDato(uke.forste)}</span>
        {SERIER.map((s) => (
          <span key={s.n} className="ml-2 tabular-nums text-blekk-dempet">
            {s.navn.toLowerCase()} {uke[s.n]}
          </span>
        ))}
      </span>
    </div>
  );
}

function Innsatstabell({ uker }: { uker: Uketall[] }) {
  return (
    <div className="max-h-64 overflow-y-auto">
      <table className="w-full text-brod">
        <thead>
          <tr className="border-b border-linje text-left text-etikett uppercase tracking-etikett text-blekk-dempet">
            <th className="py-1 font-normal">Uke</th>
            <th className="py-1 font-normal">Fra</th>
            <th className="py-1 text-right font-normal">Grønn</th>
            <th className="py-1 text-right font-normal">Gul</th>
            <th className="py-1 text-right font-normal">Rød</th>
            <th className="py-1 text-right font-normal">Sum</th>
          </tr>
        </thead>
        <tbody>
          {uker.map((u) => (
            <tr key={u.uke} className="border-b border-linje-svak">
              <td className="py-1 tabular-nums">{u.uke.slice(5)}</td>
              <td className="py-1 tabular-nums text-blekk-dempet">
                {norskDato(u.forste)}
              </td>
              <td className="py-1 text-right tabular-nums">{u.gronn}</td>
              <td className="py-1 text-right tabular-nums">{u.gul}</td>
              <td className="py-1 text-right tabular-nums">{u.rod}</td>
              <td className="py-1 text-right tabular-nums font-medium">
                {u.gronn + u.gul + u.rod}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------- timeregnskap

function Timeregnskap({ fag }: { fag: Fagtimer[] }) {
  return (
    <Panel tittel="Timeregnskap" hjelp="planlagt mot årstimetall">
      {fag.length === 0 ? (
        <Tomtilstand tekst="Ingen fag i skoleåret ennå." />
      ) : (
        <ul className="space-y-2.5">
          {fag.map((f) => (
            <Fagmaler key={f.skolearFagId} fag={f} />
          ))}
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
        <span className="truncate text-blekk-dempet">{fag.navn}</span>
        <span className="ml-auto shrink-0 tabular-nums">
          {rundt(timer)}
          {mal ? <span className="text-blekk-svak"> av {mal}</span> : null} t
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
  const idag = new Date();

  return (
    <Panel tittel="Elever som glipper" hjelp="færrest skåringer først">
      {elever.length === 0 ? (
        <Tomtilstand tekst="Ingen elever koblet til fag ennå." />
      ) : (
        <ul className="divide-y divide-linje-svak">
          {elever.map((e) => {
            const dager = e.siste ? dagerSiden(e.siste, idag) : null;
            return (
              <li key={e.elevId}>
                <button
                  onClick={() => onApne(e.elevId)}
                  className="flex w-full items-baseline gap-2 py-1 text-left text-brod hover:text-aksent"
                >
                  <span className="truncate">
                    {e.fornavn} {e.etternavn}
                  </span>
                  {e.klasse && (
                    <span className="shrink-0 text-liten text-blekk-svak">
                      {e.klasse}
                    </span>
                  )}
                  <span className="ml-auto shrink-0 tabular-nums text-blekk-dempet">
                    {e.antall}
                  </span>
                  <span
                    className={`w-16 shrink-0 text-right text-liten tabular-nums ${
                      dager === null || dager > 14 ? "text-varsel" : "text-blekk-svak"
                    }`}
                  >
                    {dager === null ? "aldri" : `${dager} d`}
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

// ------------------------------------------------------------- vurderinger

function Vurderingsfrister({
  rader,
  onApne,
}: {
  rader: Kommende[];
  onApne: () => void;
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
                  onClick={onApne}
                  className="flex w-full items-baseline gap-2 py-1 text-left text-brod hover:text-aksent"
                >
                  <Fagmerke kode={v.kode} farge={v.farge} liten />
                  <span className="truncate">{v.tittel}</span>
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

function dagerSiden(dato: string, na: Date): number {
  const d = new Date(`${dato}T00:00:00`);
  return Math.max(0, Math.round((na.getTime() - d.getTime()) / 86400000));
}

function norskDato(dato: string): string {
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
  });
}
