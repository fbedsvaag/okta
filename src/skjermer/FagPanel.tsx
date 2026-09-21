import { useEffect, useState } from "react";
import { confirm as bekreft } from "@tauri-apps/plugin-dialog";
import {
  hentFagElever,
  hentFagVurderinger,
  hentNokkeltall,
  type FagElev,
  type FagNokkeltall,
  type FagVurdering,
} from "../data/fagportal";
import { endreFag, endreFagIAr, slettFagHelt, tellForFag } from "../data/fag";
import { Felt, Kappet } from "../ui/felles";
import { finnFag, type GrepFag } from "../data/grep";
import { hentDekkedeMal } from "../data/perioder";
import type { FagIAr } from "../data/fag";
import { TRAFIKKLYS } from "../ui/farger";

/**
 * Fagportalen — faget sett ovenfra.
 *
 * Progressbaren står her, per fag, der tallet betyr noe. Forsiden kan vise
 * dem samlet senere; §13 advarer mot å gjøre startskjermen til et dashboard.
 */
export function FagPanel({
  fag,
  skolearId,
  onLukk,
  onEndret,
  onApneElev,
  onApneVurderinger,
}: {
  fag: FagIAr;
  skolearId: string;
  onLukk: () => void;
  /** ber skjermen laste fagene på nytt, uten å laste hele appen */
  onEndret: () => void;
  onApneElev: (elevId: string) => void;
  onApneVurderinger: () => void;
}) {
  const [tall, setTall] = useState<FagNokkeltall | null>(null);
  const [elever, setElever] = useState<FagElev[]>([]);
  const [vurderinger, setVurderinger] = useState<FagVurdering[]>([]);

  useEffect(() => {
    let avbrutt = false;
    (async () => {
      const [t, e, v] = await Promise.all([
        hentNokkeltall(fag.id),
        hentFagElever(fag.id, skolearId),
        hentFagVurderinger(fag.id),
      ]);
      if (avbrutt) return;
      setTall(t);
      setElever(e);
      setVurderinger(v);
    })();
    return () => {
      avbrutt = true;
    };
  }, [fag.id, skolearId]);

  useEffect(() => {
    const paEsc = (e: KeyboardEvent) => e.key === "Escape" && onLukk();
    window.addEventListener("keydown", paEsc);
    return () => window.removeEventListener("keydown", paEsc);
  }, [onLukk]);

  if (!tall) return null;

  const timer = Math.round((tall.minutter / 60) * 10) / 10;
  const andel = tall.okter === 0 ? 0 : tall.avholdte / tall.okter;

  return (
    <aside className="flex h-full flex-col border-l border-linje bg-ark">
      <header className="flex items-baseline gap-3 border-b border-linje-medium px-5 py-3">
        <span
          aria-hidden
          className="h-3.5 w-[3px] rounded-full"
          style={{ background: fag.farge ?? "var(--color-linje-sterk)" }}
        />
        <span className="font-display text-tittel">{fag.kode}</span>
        <Kappet verdi={fag.navn} klasse="text-brod text-blekk-dempet" />
        <button
          onClick={onLukk}
          className="ml-auto shrink-0 text-liten text-blekk-svak hover:text-blekk"
        >
          Lukk (Esc)
        </button>
      </header>

      <div className="overflow-y-auto px-5 py-4">
        {/*
          Rammene for faget dette året: hva som er avtalt, og hvilken kode
          det har i læreplanverket. Årstimetallet er det timeregnskapet
          måles mot; Udir-koden er nøkkelen til kompetansemålene (§10).
        */}
        <section className="mb-6 grid max-w-md grid-cols-2 gap-3">
          <Felt
            etikett="Årstimer"
            verdi={fag.arstimetall === null ? "" : String(fag.arstimetall)}
            plassholder="ikke satt"
            settVerdi={async (v) => {
              const n = Number(v.trim());
              await endreFagIAr(fag.id, {
                arstimetall:
                  v.trim() === "" || Number.isNaN(n) ? null : Math.round(n),
              });
              onEndret();
            }}
          />
          <Felt
            etikett="Fagkode (Udir)"
            verdi={fag.grepKode ?? ""}
            plassholder="MFL1001"
            settVerdi={async (v) => {
              await endreFag(fag.fagId, { grep_kode: v.trim() || null });
              onEndret();
            }}
          />
        </section>

        <OmFaget grepKode={fag.grepKode} />
        <Kompetansemaal grepKode={fag.grepKode} skolearFagId={fag.id} />

        <section className="mb-6">
          <div className="flex items-baseline justify-between text-brod">
            <span>
              <strong className="tabular-nums">{tall.avholdte}</strong> av{" "}
              <span className="tabular-nums">{tall.okter}</span> økter avholdt
            </span>
            <span className="tabular-nums text-blekk-dempet">
              {Math.round(andel * 100)} %
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-clip rounded-full bg-linje-medium">
            <div
              className="h-full rounded-full"
              style={{
                width: `${andel * 100}%`,
                background: fag.farge ?? "var(--color-aksent)",
              }}
            />
          </div>
          <p className="mt-1.5 text-liten tabular-nums text-blekk-dempet">
            {tall.elever} elever · {timer} timer planlagt
            {fag.arstimetall !== null && (
              <>
                {" "}
                av {fag.arstimetall} · {avvik(timer, fag.arstimetall)}
              </>
            )}
            {tall.okter > tall.avholdte &&
              ` · ${tall.okter - tall.avholdte} økter igjen`}
          </p>
        </section>

        <Bolk
          tittel="Vurderinger"
          handling={
            <button
              onClick={onApneVurderinger}
              className="text-liten text-blekk-dempet hover:text-aksent"
            >
              Åpne Vurderinger
            </button>
          }
        >
          {vurderinger.length === 0 ? (
            <Stille>Ingen vurderinger planlagt i {fag.kode}.</Stille>
          ) : (
            <table className="w-full text-brod">
              <tbody>
                {vurderinger.map((v) => (
                  <tr key={v.id} className="border-b border-linje-svak">
                    <td className="py-1.5">{v.tittel}</td>
                    <td className="w-20 py-1.5 text-blekk-dempet">
                      {v.type ?? ""}
                    </td>
                    <td className="w-28 py-1.5 tabular-nums text-blekk-dempet">
                      {v.frist ? kort(v.frist) : "ingen frist"}
                    </td>
                    <td className="w-14 py-1.5 text-right tabular-nums text-blekk-dempet">
                      {v.fort === 0 ? "·" : `${v.fort}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Bolk>

        <Bolk tittel="Elever">
          {elever.length === 0 ? (
            <Stille>Ingen elever koblet til {fag.kode} ennå.</Stille>
          ) : (
            <table className="w-full text-brod">
              <tbody>
                {elever.map((e) => (
                  <tr key={e.elevId} className="border-b border-linje-svak">
                    <td className="py-1.5">
                      <button
                        onClick={() => onApneElev(e.elevId)}
                        className="text-left hover:text-aksent hover:underline"
                      >
                        {e.fornavn} {e.etternavn}
                      </button>
                    </td>
                    <td className="w-16 py-1.5 tabular-nums text-blekk-dempet">
                      {e.klasse ?? ""}
                    </td>
                    <td className="w-40 py-1.5">
                      <Fordeling elev={e} />
                    </td>
                    <td className="w-14 py-1.5 text-right tabular-nums text-blekk-dempet">
                      {e.talt || "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Bolk>

        <button
          onClick={async () => {
            const n = await tellForFag(fag.fagId);
            const ok = await bekreft(
              `Slette ${fag.kode} fra fagbanken?\n\n` +
                `Dette gjelder alle ${n.ar} skoleår faget er brukt i, og ` +
                `fjerner ${n.okter} økter, ${n.skaringer} skåringer, ` +
                `${n.perioder} perioder og ${n.vurderinger} vurderinger.\n\n` +
                "Elevene blir stående — de lever på tvers av fag.\n\n" +
                "Vil du bare ta faget ut av dette året, bruk Fjern i " +
                "redigeringsmodus i stedet. Da blir øktene liggende.",
            );
            if (!ok) return;
            await slettFagHelt(fag.fagId);
            onLukk();
            onEndret();
          }}
          className="mt-2 text-liten text-blekk-svak hover:text-feil"
        >
          Slett faget fra fagbanken
        </button>
      </div>
    </aside>
  );
}

/**
 * Innsatsfordelingen som én stripe. Ikke et diagram — en tett strek som lar
 * deg se hvem som skiller seg ut når du scroller nedover.
 */
function Fordeling({ elev }: { elev: FagElev }) {
  if (elev.talt === 0)
    return (
      <span className="text-liten text-blekk-svakest">ingen skåringer</span>
    );

  const deler = [
    { antall: elev.gronn, farge: TRAFIKKLYS.gronn },
    { antall: elev.gul, farge: TRAFIKKLYS.gul },
    { antall: elev.rod, farge: TRAFIKKLYS.rod },
  ];

  return (
    <span
      title={`${elev.gronn} grønne, ${elev.gul} gule, ${elev.rod} røde`}
      className="flex h-2 w-32 overflow-clip rounded-full bg-flate"
    >
      {deler.map((d, i) => (
        <span
          key={i}
          style={{
            width: `${(d.antall / elev.talt) * 100}%`,
            background: d.farge,
          }}
        />
      ))}
    </span>
  );
}

function avvik(timer: number, arstimetall: number): string {
  const diff = Math.round((timer - arstimetall) * 10) / 10;
  if (diff === 0) return "i balanse";
  return diff > 0
    ? `${diff} timer over`
    : `${Math.abs(diff)} timer igjen å planlegge`;
}

/**
 * Det Udir sier om faget: relevans, kjerneelementer, tverrfaglige temaer og
 * grunnleggende ferdigheter.
 *
 * Sammenklappet, som kompetansemålene. Dette er tekst man leser én gang i
 * august og sjelden igjen — men når man leter etter den, skal den være her
 * og ikke i en nettleserfane.
 */
function OmFaget({ grepKode }: { grepKode: string | null }) {
  const [apen, setApen] = useState(false);
  const [grep, setGrep] = useState<GrepFag | null>(null);

  useEffect(() => {
    if (!grepKode) return;
    void finnFag(grepKode).then(setGrep);
  }, [grepKode]);

  if (!grep) return null;
  const harNoe =
    grep.beskrivelse ||
    grep.kjerneelementer.length > 0 ||
    grep.tverrfaglige.length > 0 ||
    grep.ferdigheter.length > 0;
  if (!harNoe) return null;

  return (
    <section className="mb-6">
      <button
        onClick={() => setApen((v) => !v)}
        className="flex w-full items-baseline gap-2 border-b border-linje-medium pb-1 text-left"
      >
        <span className="text-etikett uppercase tracking-etikett text-blekk-dempet">
          Om faget
        </span>
        <span className="ml-auto text-liten text-blekk-svak">
          {apen ? "Skjul" : "Vis"}
        </span>
      </button>

      {apen && (
        <div className="mt-2 space-y-3 text-brod">
          {grep.beskrivelse && (
            <p className="text-blekk-dempet">{grep.beskrivelse}</p>
          )}

          {grep.kjerneelementer.length > 0 && (
            <div>
              <p className="text-liten font-medium">Kjerneelementer</p>
              <ul className="list-disc pl-4 text-blekk-dempet">
                {grep.kjerneelementer.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ul>
            </div>
          )}

          {grep.tverrfaglige.map((x) => (
            <div key={x.tittel}>
              <p className="text-liten font-medium">{x.tittel}</p>
              {x.beskrivelse && (
                <p className="text-blekk-dempet">{x.beskrivelse}</p>
              )}
            </div>
          ))}

          {grep.ferdigheter.length > 0 && (
            <div>
              <p className="mb-1 text-liten font-medium">
                Grunnleggende ferdigheter
              </p>
              <div className="space-y-1.5">
                {grep.ferdigheter.map((x) => (
                  <div key={x.tittel}>
                    <p className="text-liten text-blekk-dempet">{x.tittel}</p>
                    {x.beskrivelse && (
                      <p className="text-blekk-dempet">{x.beskrivelse}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Kompetansemålene fra Udir, sammenklappet.
 *
 * Ligger lukket fordi et fag har mellom seks og tretti mål, og de er lange.
 * Åpnet er det en liste å lese gjennom når du planlegger — ikke noe som skal
 * dytte resten av kortet ned resten av tiden.
 */
function Kompetansemaal({
  grepKode,
  skolearFagId,
}: {
  grepKode: string | null;
  skolearFagId: string;
}) {
  const [apen, setApen] = useState(false);
  const [grep, setGrep] = useState<GrepFag | null>(null);
  const [dekket, setDekket] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!grepKode) return;
    void finnFag(grepKode).then(setGrep);
  }, [grepKode]);

  useEffect(() => {
    void hentDekkedeMal(skolearFagId).then(setDekket);
  }, [skolearFagId]);

  if (!grepKode) {
    return (
      <p className="mb-6 text-liten text-blekk-svak">
        Ingen fagkode fra Udir. Legg den inn over for å få kompetansemålene hit.
      </p>
    );
  }

  if (!grep) {
    return (
      <p className="mb-6 text-liten text-blekk-svak">
        Fant ikke {grepKode} i faglista.
      </p>
    );
  }

  const antallDekket = grep.kompetansemaal.filter((m) =>
    dekket.has(m.kode),
  ).length;
  const mangler = grep.kompetansemaal.length - antallDekket;

  return (
    <section className="mb-6">
      <button
        onClick={() => setApen((v) => !v)}
        className="flex w-full items-baseline gap-2 border-b border-linje-medium pb-1 text-left"
      >
        <span className="text-etikett uppercase tracking-etikett text-blekk-dempet">
          Kompetansemål
        </span>
        <span className="tabular-nums text-liten text-blekk-svak">
          {antallDekket} av {grep.kompetansemaal.length} planlagt
        </span>
        <span className="ml-auto text-liten text-blekk-svak">
          {apen ? "Skjul" : "Vis"}
        </span>
      </button>

      {/*
        Hvor mye av faget som er plassert i en periode. Sier ikke noe om hva
        som er undervist — bare hva som er planlagt inn et sted, og dermed
        hva som ennå ikke har fått plass i året.
      */}
      <div className="mt-1.5 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-clip rounded-full bg-linje-medium">
          <div
            className="h-full rounded-full bg-aksent"
            style={{
              width: `${grep.kompetansemaal.length === 0 ? 0 : (antallDekket / grep.kompetansemaal.length) * 100}%`,
            }}
          />
        </div>
        <span className="shrink-0 text-liten tabular-nums text-blekk-dempet">
          {mangler === 0 ? "alle dekket" : `${mangler} mangler`}
        </span>
      </div>

      {apen && (
        <>
          <p className="mt-2 text-liten text-blekk-svak">
            {grep.navn} · {grep.laereplan}
          </p>
          <ul className="mt-1 space-y-1.5">
            {grep.kompetansemaal.map((m) => (
              <li key={m.kode} className="flex gap-2 text-brod">
                <span
                  aria-hidden
                  title={
                    dekket.has(m.kode)
                      ? "Plassert i en periode"
                      : "Ikke plassert"
                  }
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    dekket.has(m.kode) ? "bg-aksent" : "bg-linje-sterk"
                  }`}
                />
                <span className={dekket.has(m.kode) ? "" : "text-blekk-dempet"}>
                  {m.tekst}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Bolk({
  tittel,
  handling,
  children,
}: {
  tittel: string;
  handling?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-baseline justify-between border-b border-linje-medium pb-1">
        <h3 className="text-etikett uppercase tracking-etikett text-blekk-dempet">
          {tittel}
        </h3>
        {handling}
      </div>
      {children}
    </section>
  );
}

function Stille({ children }: { children: React.ReactNode }) {
  return <p className="py-1 text-brod text-blekk-svak">{children}</p>;
}

function kort(dato: string): string {
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}
