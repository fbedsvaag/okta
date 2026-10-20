import { Sammenleggknapp, useApen } from "../ui/Sammenleggbar";
import { Elevfoto } from "../ui/Elevfoto";
import { Utfold } from "../ui/Utfold";
import { useEffect, useState } from "react";
import { Tidslinjedato, Tidslinjestrek } from "../ui/Tidslinje";
import { Markdownfelt } from "../ui/Notattekst";
import { useArk } from "../ui/Arkstabel";
import { endreOkt } from "../data/okter";
import { ukesfarge } from "../data/dashbord";
import {
  hentArForFag,
  hentFagslogg,
  type Fagslogg as FagsloggRad,
} from "../data/fagportal";
import {
  lytt,
  lyttElever,
  lyttOktvisning,
  lyttVurderinger,
} from "../data/endringer";
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
import {
  frakobleFag,
  hentElever,
  koblePaFag,
  opprettElev,
  tellSkaringerIFag,
  type ElevRad,
} from "../data/elever";
import { Felt, Kappet, KONTROLL } from "../ui/felles";
import { finnFag, type GrepFag } from "../data/grep";
import { hentDekkedeMal } from "../data/perioder";
import type { FagIAr } from "../data/fag";
import { TRAFIKKLYS } from "../ui/farger";
import { Fargevelger } from "../ui/Fargevelger";
import { hentInnstilling } from "../data/skolear";
import { LAERERNAVN } from "../data/arsplanark";
import { Velger } from "../ui/Velger";

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
  onApneVurdering,
  onApneVurderinger,
  onLimInn,
}: {
  fag: FagIAr;
  skolearId: string;
  onLukk: () => void;
  /** ber skjermen laste fagene på nytt, uten å laste hele appen */
  onEndret: () => void;
  /** eleven, og klasselista kortet kan bla gjennom */
  onApneElev: (elevId: string, liste: string[]) => void;
  onApneVurdering: (vurderingId: string) => void;
  onApneVurderinger: () => void;
  /** lim inn en ny klasseliste for faget */
  onLimInn: () => void;
}) {
  const [tall, setTall] = useState<FagNokkeltall | null>(null);
  const [elever, setElever] = useState<FagElev[]>([]);
  const [vurderinger, setVurderinger] = useState<FagVurdering[]>([]);
  const [laererNavn, setLaererNavn] = useState<string | null>(null);
  // Telles opp når en elev endres et annet sted, så elevlista hentes på nytt.
  const [elevversjon, setElevversjon] = useState(0);

  useEffect(() => lyttElever(() => setElevversjon((v) => v + 1)), []);
  useEffect(() => lyttVurderinger(() => setElevversjon((v) => v + 1)), []);

  useEffect(() => {
    void hentInnstilling(LAERERNAVN).then(setLaererNavn);
  }, []);

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
  }, [fag.id, skolearId, elevversjon]);

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
        {/* Klikk på firkanten bytter fargen på faget (17.3). */}
        <Fargevelger
          farge={fag.farge}
          onVelg={async (farge) => {
            await endreFag(fag.fagId, { farge });
            onEndret();
          }}
        />
        <span className="text-tittel font-medium">{fag.kode}</span>
        <Kappet verdi={fag.navn} klasse="text-brod text-blekk-dempet" />
        <button
          onClick={onLukk}
          className="ml-auto shrink-0 text-liten text-blekk-svak hover:text-blekk"
        >
          Lukk (Esc)
        </button>
      </header>

      <div className="overflow-y-auto px-5 py-4">
        <Bolk tittel="Om faget" nokkel="fagkort-om">
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
            <Tekstfelt
              etikett="Alias"
              verdi={fag.alias}
              plassholder="Det du kaller faget, f.eks. MFL1"
              lagre={async (v) => {
                await endreFag(fag.fagId, { alias: v });
                onEndret();
              }}
            />
            <Tekstfelt
              etikett="Standard rom"
              verdi={fag.rom}
              plassholder="R204"
              lagre={async (v) => {
                await endreFagIAr(fag.id, { rom: v });
                onEndret();
              }}
            />
            <Tekstfelt
              etikett="Faglærer"
              verdi={fag.laerer}
              plassholder={laererNavn ?? "Navnet ditt"}
              lagre={async (v) => {
                await endreFagIAr(fag.id, { laerer: v });
                onEndret();
              }}
            />
            {/* Standard pause (17.5): legges inn i planen i nye økter. */}
            <div className="col-span-2 grid grid-cols-2 gap-3">
              <Felt
                etikett="Pause etter, minutter"
                verdi={
                  fag.pauseEtterMin === null ? "" : String(fag.pauseEtterMin)
                }
                plassholder="f.eks. 45"
                settVerdi={async (v) => {
                  const n = Math.round(Number(v.trim()));
                  await endreFagIAr(fag.id, {
                    pause_etter_min: v.trim() === "" || !(n > 0) ? null : n,
                  });
                  onEndret();
                }}
              />
              <Felt
                etikett="Pause, minutter"
                verdi={fag.pauseMin === null ? "" : String(fag.pauseMin)}
                plassholder="ingen"
                settVerdi={async (v) => {
                  const n = Math.round(Number(v.trim()));
                  await endreFagIAr(fag.id, {
                    pause_min: v.trim() === "" || !(n > 0) ? null : n,
                  });
                  onEndret();
                }}
              />
            </div>
          </section>

          <OmFaget grepKode={fag.grepKode} />
          <Kompetansemaal grepKode={fag.grepKode} skolearFagId={fag.id} />

          {/*
          Det som står øverst på årsplanarket (§4.9). Kompetansemålene
          hentes fra Udir når faget har kode; fritekstfeltet er for fag
          uten, og vises bare da — to lister ville sagt to ting.
        */}
          <section className="mb-6 max-w-md space-y-3">
            {!fag.grepKode && (
              <Tekstfelt
                etikett="Kompetansemål på årsplanen"
                verdi={fag.kompetansemal}
                plassholder="Ett mål per linje"
                rader={4}
                lagre={async (v) => {
                  await endreFagIAr(fag.id, { kompetansemal: v });
                  onEndret();
                }}
              />
            )}
            <Tekstfelt
              etikett="Tekst på årsplanen"
              verdi={fag.arknotat}
              plassholder="Vurderingsordning, lærebok, beskjeder til elevene"
              rader={3}
              lagre={async (v) => {
                await endreFagIAr(fag.id, { arknotat: v });
                onEndret();
              }}
            />
          </section>
        </Bolk>

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

        <Klasseliste
          fag={fag}
          skolearId={skolearId}
          elever={elever}
          onApneElev={onApneElev}
          onLimInn={onLimInn}
        />

        <Bolk
          tittel="Vurderinger"
          nokkel="fagkort-vurderinger"
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
                    <td className="py-1.5">
                      <button
                        onClick={() => onApneVurdering(v.id)}
                        className="text-left hover:text-aksent hover:underline"
                      >
                        {v.tittel}
                      </button>
                    </td>
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

        <Fagslogg fag={fag} skolearId={skolearId} />

        <button
          onClick={async () => {
            const n = await tellForFag(fag.fagId);
            const ok = await bekreft(
              `Slette ${fag.kode} fra fagbanken?\n\n` +
                `Dette gjelder alle ${n.ar} skoleår faget er brukt i, og ` +
                `fjerner ${n.okter} økter, ${n.skaringer} skåringer, ` +
                `${n.perioder} perioder og ${n.vurderinger} vurderinger.\n\n` +
                "Elevene blir stående. De lever på tvers av fag.\n\n" +
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
 * Klasselista i faget, rett til å rette i.
 *
 * «Ta ut» kobler eleven fra faget — den sletter ingenting. Eleven blir
 * stående under Elever, eventuelt uten fag, og slettes der om det er
 * meningen. Skåringene blir liggende og kommer tilbake om eleven kobles
 * på igjen.
 *
 * Feltet nederst finner elever som ikke er i faget, på navn eller klasse.
 * Finnes ingen, kan eleven opprettes rett her.
 */
function Klasseliste({
  fag,
  skolearId,
  elever,
  onApneElev,
  onLimInn,
}: {
  fag: FagIAr;
  skolearId: string;
  elever: FagElev[];
  onApneElev: (elevId: string, liste: string[]) => void;
  onLimInn: () => void;
}) {
  const [alle, setAlle] = useState<ElevRad[]>([]);
  const [sok, setSok] = useState("");
  const [markert, setMarkert] = useState(0);

  useEffect(() => {
    const last = () => void hentElever(skolearId).then(setAlle);
    last();
    return lyttElever(last);
  }, [skolearId]);

  const iFaget = new Set(elever.map((e) => e.elevId));
  const ord = sok.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const treff =
    ord.length === 0
      ? []
      : alle
          .filter((e) => !iFaget.has(e.id))
          .filter((e) => {
            const tekst =
              `${e.fornavn} ${e.etternavn} ${e.klasseNavn ?? ""}`.toLowerCase();
            return ord.every((o) => tekst.includes(o));
          })
          .slice(0, 6);
  // Ny elev krever fornavn og etternavn, og at ingen allerede heter det.
  const kanOpprette = ord.length >= 2 && treff.length === 0;

  async function leggTil(elevId: string) {
    await koblePaFag(elevId, fag.id);
    setSok("");
    setMarkert(0);
  }

  async function opprett() {
    const deler = sok.trim().split(/\s+/);
    const etternavn = deler.pop()!;
    const id = await opprettElev(deler.join(" "), etternavn);
    await leggTil(id);
  }

  async function taUt(e: FagElev) {
    const n = await tellSkaringerIFag(e.elevId, fag.id);
    const ok = await bekreft(
      `Ta ${e.fornavn} ${e.etternavn} ut av ${fag.kode}?\n\n` +
        "Eleven slettes ikke. Hen blir stående under Elever (uten fag, " +
        "om dette var det eneste) og kan slettes der." +
        (n > 0
          ? `\n\n${n} skåringer blir liggende og kommer tilbake om eleven ` +
            "legges i faget igjen."
          : ""),
    );
    if (ok) await frakobleFag(e.elevId, fag.id);
  }

  return (
    <Bolk
      tittel={`Elever · ${elever.length}`}
      nokkel="fagkort-elever"
      handling={
        <button
          onClick={onLimInn}
          className="text-liten text-blekk-dempet hover:text-aksent"
        >
          Lim inn ny liste …
        </button>
      }
    >
      {elever.length === 0 ? (
        <Stille>Ingen elever i {fag.kode} ennå. Legg dem til under.</Stille>
      ) : (
        <table className="w-full text-brod">
          <tbody>
            {elever.map((e) => (
              <tr key={e.elevId} className="group border-b border-linje-svak">
                <td className="py-1.5">
                  <button
                    onClick={() =>
                      onApneElev(
                        e.elevId,
                        elever.map((x) => x.elevId),
                      )
                    }
                    className="flex items-center gap-2 text-left hover:text-aksent"
                  >
                    <Elevfoto elevId={e.elevId} storrelse={20} />
                    <span className="hover:underline">
                      {e.fornavn} {e.etternavn}
                    </span>
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
                <td className="w-16 py-1.5 text-right">
                  <button
                    onClick={() => void taUt(e)}
                    className="text-liten text-blekk-svak opacity-0 hover:text-feil focus:opacity-100 group-hover:opacity-100"
                  >
                    Ta ut
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="relative mt-2 max-w-md">
        <input
          value={sok}
          onChange={(e) => {
            setSok(e.target.value);
            setMarkert(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setMarkert((i) => Math.min(i + 1, treff.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setMarkert((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (treff[markert]) void leggTil(treff[markert].id);
              else if (kanOpprette) void opprett();
            } else if (e.key === "Escape" && sok) {
              e.stopPropagation();
              setSok("");
            }
          }}
          placeholder="+ Legg til elev: skriv navn eller klasse"
          className={`${KONTROLL} w-full rounded border border-linje bg-ark px-2 text-brod outline-none focus:border-aksent`}
        />
        {(treff.length > 0 || kanOpprette) && (
          <ul className="absolute inset-x-0 top-full z-10 mt-1 overflow-clip rounded-vanlig border border-linje bg-ark shadow-[var(--shadow-ark)]">
            {treff.map((e, i) => (
              <li key={e.id}>
                <button
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => void leggTil(e.id)}
                  className={`flex w-full items-baseline gap-2 px-2 py-1 text-left text-brod ${
                    i === markert ? "bg-valgt" : "hover:bg-flate"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {e.fornavn} {e.etternavn}
                  </span>
                  <span className="shrink-0 text-liten text-blekk-svak">
                    {[e.klasseNavn, ...e.fagKoder]
                      .filter(Boolean)
                      .join(" · ") || "uten fag"}
                  </span>
                </button>
              </li>
            ))}
            {kanOpprette && (
              <li>
                <button
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => void opprett()}
                  className="w-full bg-valgt px-2 py-1 text-left text-brod"
                >
                  Ny elev «{sok.trim()}»: Enter oppretter og legger i {fag.kode}
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    </Bolk>
  );
}

/**
 * Innsatsfordelingen som én stripe. Ikke et diagram — en tett strek som lar
 * deg se hvem som skiller seg ut når du scroller nedover.
 */
/**
 * Tekstfelt som lagrer når du går ut av det, ikke for hvert tastetrykk.
 * Tomt felt lagres som null.
 */
function Tekstfelt({
  etikett,
  verdi,
  plassholder,
  rader,
  lagre,
}: {
  etikett: string;
  verdi: string | null;
  plassholder?: string;
  /** flere linjer når satt */
  rader?: number;
  lagre: (v: string | null) => Promise<void>;
}) {
  const felles = {
    defaultValue: verdi ?? "",
    placeholder: plassholder,
    onBlur: (e: { target: { value: string } }) => {
      const ny = e.target.value.trim() || null;
      if (ny !== verdi) void lagre(ny);
    },
    className:
      "w-full rounded border border-linje bg-ark px-2 py-1 text-brod outline-none focus:border-aksent",
  };
  return (
    <label className="block">
      <span className="mb-1 block text-etikett uppercase tracking-etikett text-blekk-dempet">
        {etikett}
      </span>
      {/* Ny nøkkel når verdien endres utenfra, så feltet viser den. */}
      {rader ? (
        <textarea key={verdi ?? ""} rows={rader} {...felles} />
      ) : (
        <input
          key={verdi ?? ""}
          {...felles}
          className={`${KONTROLL} ${felles.className}`}
        />
      )}
    </label>
  );
}

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
        <span className="text-brod font-semibold text-blekk">Om faget</span>
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
        <span className="text-brod font-semibold text-blekk">
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

/** Prikkens farge: klassens skåringer i økta, i trafikklysets fem trinn. */
const LOGGFARGE = {
  gronn: "var(--color-lys-gronn)",
  gronngul: "var(--color-lys-gronngul)",
  gul: "var(--color-lys-gul)",
  oransje: "var(--color-lys-oransje)",
  rod: "var(--color-lys-rod)",
} as const;

/** Hvor mange logger som står før «Vis alle». */
const LOGG_SYNLIGE = 8;

/**
 * Øktloggen i faget som tidslinje, som notatene på elevkortet: dato, tema
 * og loggen, nyeste først. Prikken har fargen til hvordan klassen ble skåret
 * den timen. Tema åpner økta; loggen kan rettes rett her. Har du hatt faget
 * flere år, kan du bla mellom dem.
 */
function Fagslogg({ fag, skolearId }: { fag: FagIAr; skolearId: string }) {
  const [ar, setAr] = useState(skolearId);
  const [arene, setArene] = useState<{ skolearId: string; navn: string }[]>([]);
  const [logg, setLogg] = useState<FagsloggRad[]>([]);
  const [alle, setAlle] = useState(false);
  const ark = useArk();

  useEffect(() => {
    void hentArForFag(fag.fagId).then(setArene);
  }, [fag.fagId]);

  useEffect(() => {
    const last = () => void hentFagslogg(fag.fagId, ar).then(setLogg);
    last();
    setAlle(false);
    // Skrives loggen i en økt over kortet, skal den stå her etterpå.
    const av = [lytt(last), lyttOktvisning(last)];
    return () => av.forEach((f) => f());
  }, [fag.fagId, ar]);

  const synlige = alle ? logg : logg.slice(0, LOGG_SYNLIGE);

  return (
    <Bolk
      tittel={logg.length > 0 ? `Øktlogg · ${logg.length}` : "Øktlogg"}
      nokkel="fagkort-oktlogg"
      handling={
        arene.length > 1 ? (
          <Velger
            verdi={ar}
            settVerdi={setAr}
            variant="liten"
            etikett="Skoleår"
            valg={arene.map((a) => ({ verdi: a.skolearId, tekst: a.navn }))}
          />
        ) : undefined
      }
    >
      {logg.length === 0 ? (
        <Stille>
          Ingen øktlogg i {fag.kode}
          {ar !== skolearId
            ? ` ${arene.find((a) => a.skolearId === ar)?.navn ?? ""}`
            : ""}{" "}
          ennå. Den skrives nederst i hver økt.
        </Stille>
      ) : (
        <div>
          {synlige.map((l, i) => {
            const f = ukesfarge(l);
            return (
              <div key={l.oktId} className="flex gap-3">
                <Tidslinjedato dato={l.dato} />
                <Tidslinjestrek
                  sist={i === synlige.length - 1}
                  farge={f ? LOGGFARGE[f] : null}
                  tittel={
                    f
                      ? `${l.gronn} grønne, ${l.gul} gule, ${l.rod} røde`
                      : "Ikke skåret"
                  }
                />
                <div className="min-w-0 flex-1 pb-4">
                  <button
                    onClick={() => ark.apneOkt(l.oktId)}
                    className="flex max-w-full items-baseline gap-2 text-left text-liten hover:text-aksent"
                  >
                    <Kappet
                      verdi={l.tema ?? "Uten tema"}
                      klasse={l.tema ? "text-blekk-dempet" : "text-blekk-svak"}
                    />
                    {l.klokkeslett && (
                      <span className="shrink-0 tabular-nums text-blekk-svak">
                        {l.klokkeslett}
                      </span>
                    )}
                  </button>
                  <div className="-mx-2">
                    <Markdownfelt
                      key={l.oktId}
                      verdi={l.logg}
                      onLagre={async (v) => {
                        await endreOkt(l.oktId, { logg: v });
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
          {logg.length > LOGG_SYNLIGE && (
            <button
              onClick={() => setAlle((v) => !v)}
              className="text-liten text-blekk-svak hover:text-blekk"
            >
              {alle ? "Vis færre" : `Vis alle ${logg.length}`}
            </button>
          )}
        </div>
      )}
    </Bolk>
  );
}

/** En bolk i fagkortet. Med nøkkel kan den legges sammen, og valget huskes. */
function Bolk({
  tittel,
  nokkel,
  handling,
  children,
}: {
  tittel: string;
  nokkel?: string;
  handling?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [apen, setApen] = useApen(nokkel);
  return (
    <section className="mb-6">
      <div
        className={`flex items-baseline justify-between border-b border-linje-medium pb-1 ${apen ? "mb-2" : ""}`}
      >
        {nokkel ? (
          <Sammenleggknapp
            tittel={tittel}
            apen={apen}
            onBytt={() => setApen(!apen)}
          />
        ) : (
          <h3 className="text-brod font-semibold text-blekk">{tittel}</h3>
        )}
        {apen && handling}
      </div>
      <Utfold apen={apen}>{children}</Utfold>
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
