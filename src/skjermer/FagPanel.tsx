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
import { Felt } from "../ui/felles";
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
  onApneElev,
  onApneVurderinger,
}: {
  fag: FagIAr;
  skolearId: string;
  onLukk: () => void;
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
        <span className="text-tittel font-semibold">{fag.kode}</span>
        <span className="truncate text-brod text-blekk-dempet">{fag.navn}</span>
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
                arstimetall: v.trim() === "" || Number.isNaN(n) ? null : Math.round(n),
              });
              location.reload();
            }}
          />
          <Felt
            etikett="Fagkode (Udir)"
            verdi={fag.grepKode ?? ""}
            plassholder="MFL1001"
            settVerdi={async (v) => {
              await endreFag(fag.fagId, { grep_kode: v.trim() || null });
              location.reload();
            }}
          />
        </section>

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
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-linje-medium">
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
                    <td className="w-20 py-1.5 text-blekk-dempet">{v.type ?? ""}</td>
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
            location.reload();
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
    return <span className="text-liten text-blekk-svakest">ingen skåringer</span>;

  const deler = [
    { antall: elev.gronn, farge: TRAFIKKLYS.gronn },
    { antall: elev.gul, farge: TRAFIKKLYS.gul },
    { antall: elev.rod, farge: TRAFIKKLYS.rod },
  ];

  return (
    <span
      title={`${elev.gronn} grønne, ${elev.gul} gule, ${elev.rod} røde`}
      className="flex h-2 w-32 overflow-hidden rounded-full bg-flate"
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
  return diff > 0 ? `${diff} timer over` : `${Math.abs(diff)} timer igjen å planlegge`;
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
