import { useApen } from "../ui/Sammenleggbar";
import { useEffect, useState } from "react";
import { Tidslinjedato } from "../ui/Tidslinje";
import { useArk } from "../ui/Arkstabel";
import { Elevbilde } from "../ui/Elevbilde";
import { hentElevbilde, slettElevbilde } from "../data/elevbilde";
import { lyttVurderinger } from "../data/endringer";
import { confirm as bekreft } from "@tauri-apps/plugin-dialog";
import {
  hentElevAr,
  hentElevFag,
  hentElevGrunnlag,
  hentElevVurderinger,
  hentHeatmap,
  type ElevAr,
  type ElevGrunnlag,
  type ElevVurdering,
  type FagRad,
  type HeatmapRute,
} from "../data/elevportal";
import {
  endreElev,
  finnEllerOpprettKlasse,
  frakobleFag,
  frakobletekst,
  hentKlasser,
  koblePaFag,
  settKlasse,
  settMentor,
  slettElevHelt,
  tellForElev,
  tellSkaringerIFag,
  type Klasse,
} from "../data/elever";
import { hentFagIAr, type FagIAr } from "../data/fag";
import {
  Bryter,
  Fagfiltre,
  Fagmerke,
  Ikon,
  Ikonknapp,
  Kappet,
  Knapp,
} from "../ui/felles";
import {
  erForfalt,
  hentElevnotater,
  opprettElevnotat,
  settLukket,
  slettElevnotat,
  type Elevnotat,
  endreElevnotat,
  flettTidslinje,
  hentOktnotater,
  type Notatfilter,
  type Oktnotat,
} from "../data/elevnotat";
import { settSkaringsnotat } from "../data/okter";
import { lyttElever } from "../data/endringer";
import { NOYTRAL, skalafarge } from "../ui/farger";
import { Markdownfelt, MarkdownSkriv } from "../ui/Notattekst";

/**
 * Elevportalen, SPEC §4.5.
 *
 * Ett spørsmål: hvordan har det gått med denne eleven i år? Heatmapet per
 * fag øverst, vurderingene under, notater nederst.
 */
export function ElevPanel({
  elevId,
  aktivtSkolearId,
  onLukk,
  onApneOkt,
  bla,
  startFag = "",
}: {
  elevId: string;
  aktivtSkolearId: string;
  /**
   * Faget man kom fra. Har du filtrert på SAM3045 i Elever, eller åpnet
   * eleven fra fagkortet, er kortet allerede filtrert på det faget.
   */
  startFag?: string;
  onLukk: () => void;
  onApneOkt: (oktId: string) => void;
  /**
   * Bla mellom elevene i samme fag. Utelates der det ikke gir mening — i
   * Elever-tabellen er lista allerede synlig ved siden av.
   */
  bla?: {
    nr: number;
    av: number;
    retning: "opp" | "ned" | null;
    forrige: () => void;
    neste: () => void;
  };
}) {
  const ark = useArk();
  // Bildet fra InSchool-utskriften, når det er lest inn (import/inschool).
  const [bilde, setBilde] = useState<string | null>(null);
  useEffect(() => {
    void hentElevbilde(elevId).then(setBilde);
  }, [elevId]);
  const [elev, setElev] = useState<ElevGrunnlag | null>(null);
  const [ar, setAr] = useState<ElevAr[]>([]);
  const [valgtAr, setValgtAr] = useState(aktivtSkolearId);
  const [fagRader, setFagRader] = useState<FagRad[]>([]);
  const [tommeFag, setTommeFag] = useState<
    {
      skolearFagId: string;
      fagKode: string;
      fagNavn: string;
      farge: string | null;
    }[]
  >([]);
  const [vurderinger, setVurderinger] = useState<ElevVurdering[]>([]);
  // Fagfilter for hele kortet — heatmap og vurderinger. Tom streng = alle fag.
  const [vurderingsfag, setVurderingsfag] = useState(startFag);

  const elevensFag = [
    ...new Map(
      [...fagRader, ...tommeFag].map((f) => [
        f.skolearFagId,
        { id: f.skolearFagId, kode: f.fagKode, farge: f.farge },
      ]),
    ).values(),
  ].sort((a, b) => a.kode.localeCompare(b.kode, "nb-NO"));

  const elevensFagIder = new Set(elevensFag.map((f) => f.id));
  const passer = (id: string) => !vurderingsfag || id === vurderingsfag;
  const synligeVurderinger = vurderinger.filter((v) => passer(v.skolearFagId));
  const synligeFagRader = fagRader.filter((r) => passer(r.skolearFagId));
  const synligeTommeFag = tommeFag.filter((f) => passer(f.skolearFagId));
  const [klasser, setKlasser] = useState<Klasse[]>([]);
  // Alle fagene i året, ikke bare elevens — man må kunne koble til et nytt.
  const [arsFag, setArsFag] = useState<FagIAr[]>([]);

  useEffect(() => {
    let avbrutt = false;
    (async () => {
      const [g, a] = await Promise.all([
        hentElevGrunnlag(elevId),
        hentElevAr(elevId),
      ]);
      if (avbrutt) return;
      setElev(g);
      setAr(a);
    })();
    return () => {
      avbrutt = true;
    };
  }, [elevId]);

  // Et resultat ført i vurderingsarket over kortet, skal stå her når arket
  // lukkes.
  useEffect(() => lyttVurderinger(() => void lastFag()), [elevId, valgtAr]);

  async function lastFag() {
    const [h, f, v] = await Promise.all([
      hentHeatmap(elevId, valgtAr),
      hentElevFag(elevId, valgtAr),
      hentElevVurderinger(elevId, valgtAr),
    ]);
    setFagRader(h);
    setTommeFag(
      f.filter((x) => !h.some((r) => r.skolearFagId === x.skolearFagId)),
    );
    setVurderinger(v);
  }

  useEffect(() => {
    let avbrutt = false;
    (async () => {
      const [h, f, v] = await Promise.all([
        hentHeatmap(elevId, valgtAr),
        hentElevFag(elevId, valgtAr),
        hentElevVurderinger(elevId, valgtAr),
      ]);
      if (avbrutt) return;
      setFagRader(h);
      setTommeFag(
        f.filter((x) => !h.some((r) => r.skolearFagId === x.skolearFagId)),
      );
      setVurderinger(v);
      setKlasser(await hentKlasser(valgtAr));
      setArsFag(await hentFagIAr(valgtAr));
    })();
    return () => {
      avbrutt = true;
    };
  }, [elevId, valgtAr]);

  useEffect(() => {
    const lukkPaEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onLukk();
      if (bla && e.altKey && e.key === "ArrowUp") {
        e.preventDefault();
        bla.forrige();
      }
      if (bla && e.altKey && e.key === "ArrowDown") {
        e.preventDefault();
        bla.neste();
      }
    };
    window.addEventListener("keydown", lukkPaEsc);
    return () => window.removeEventListener("keydown", lukkPaEsc);
  }, [onLukk, bla]);

  if (!elev) return null;

  const detteAret = ar.find((a) => a.skolearId === valgtAr);

  return (
    <aside
      className={`flex h-full flex-col border-l border-linje bg-ark ${
        bla?.retning ? `flikk-${bla.retning}` : ""
      }`}
    >
      <header className="flex items-start gap-4 border-b border-linje-medium px-5 py-3">
        {bilde && (
          <span className="group relative">
            <Elevbilde src={bilde} storrelse={60} alt="" />
            <button
              onClick={async () => {
                if (
                  !(await bekreft(
                    `Fjerne bildet av ${elev.fornavn}? Det slettes fra basen.`,
                  ))
                )
                  return;
                await slettElevbilde(elevId);
                setBilde(null);
              }}
              className="absolute inset-x-0 bottom-0 bg-teppe/70 py-0.5 text-mikro text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
            >
              Fjern
            </button>
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-2">
          {/*
          Navnet redigeres der det står. Samme mønster som resten av appen:
          skriv, og feltet lagrer når det forlates. Enter bekrefter, Escape
          angrer.
        */}
          <Navnefelt
            verdi={elev.fornavn}
            plassholder="Fornavn"
            onLagre={async (v) => {
              await endreElev(elevId, { fornavn: v });
              setElev(await hentElevGrunnlag(elevId));
            }}
          />
          <Navnefelt
            verdi={elev.etternavn}
            plassholder="Etternavn"
            manglerTekst="Mangler etternavn"
            onLagre={async (v) => {
              await endreElev(elevId, { etternavn: v });
              setElev(await hentElevGrunnlag(elevId));
            }}
          />
          <span className="font-mono text-etikett text-blekk-svak">
            {elev.kode}
          </span>
          <Klassevelger
            klasser={klasser}
            valgt={detteAret?.klasse ?? null}
            onVelg={async (klasseId) => {
              await settKlasse(elevId, valgtAr, klasseId);
              setAr(await hentElevAr(elevId));
            }}
            onNy={async (navn) => {
              const id = await finnEllerOpprettKlasse(valgtAr, navn);
              await settKlasse(elevId, valgtAr, id);
              setKlasser(await hentKlasser(valgtAr));
              setAr(await hentElevAr(elevId));
            }}
          />

          {/*
          Mentormerket hører hjemme her: det er når man står og ser på eleven
          man vet at hen er mentoreleven sin. Uten klasse finnes ingen rad å
          merke (§3.2), og da er boksen av.
        */}
          <label
            title={
              detteAret?.klasse
                ? "Min mentorelev dette året"
                : "Sett klasse først — mentormerket henger på klassen"
            }
            className={`flex shrink-0 select-none items-center gap-1.5 text-liten ${
              detteAret?.klasse ? "text-blekk-dempet" : "text-blekk-svakest"
            }`}
          >
            <input
              type="checkbox"
              checked={detteAret?.mentor ?? false}
              disabled={!detteAret?.klasse}
              onChange={async (e) => {
                const ok = await settMentor(elevId, valgtAr, e.target.checked);
                if (ok) setAr(await hentElevAr(elevId));
              }}
            />
            Mentorelev
          </label>

          {/*
          Fagene eleven har i året. Frakobling rører aldri skåringene — de
          blir liggende, og kobler du til igjen kommer de tilbake i heatmapet.
          Derfor er dette trygt å rette i, og spørsmålet stilles bare når det
          faktisk finnes skåringer å forsvinne ut av lista med.
        */}
          {arsFag.length > 0 && (
            <span className="flex flex-wrap items-center gap-1.5">
              {arsFag.map((f) => {
                const har = elevensFagIder.has(f.id);
                return (
                  <label
                    key={f.id}
                    title={har ? `Koble fra ${f.kode}` : `Koble til ${f.kode}`}
                    className="flex cursor-pointer select-none items-center gap-1"
                  >
                    <input
                      type="checkbox"
                      checked={har}
                      onChange={async (e) => {
                        if (e.target.checked) {
                          if (
                            !(await bekreft(
                              `Legge ${elev.fornavn} ${elev.etternavn} til i ${f.kode}? Hen kommer med i fagets elevliste og i øktene.`,
                            ))
                          ) {
                            e.target.checked = false;
                            return;
                          }
                          await koblePaFag(elevId, f.id);
                        } else {
                          const n = await tellSkaringerIFag(elevId, f.id);
                          if (
                            n > 0 &&
                            !(await bekreft(
                              frakobletekst(elev.fornavn, f.kode, n),
                            ))
                          ) {
                            e.target.checked = true;
                            return;
                          }
                          await frakobleFag(elevId, f.id);
                        }
                        await lastFag();
                      }}
                    />
                    <Fagmerke kode={f.kode} farge={f.farge} liten />
                  </label>
                );
              })}
            </span>
          )}
          {bla && bla.av > 1 && (
            <span className="ml-auto flex shrink-0 items-center gap-1">
              <Ikonknapp onClick={bla.forrige} tittel="Forrige elev (⌥↑)">
                <Ikon navn="opp" />
              </Ikonknapp>
              <span className="tabular-nums text-liten text-blekk-svak">
                {bla.nr} av {bla.av}
              </span>
              <Ikonknapp onClick={bla.neste} tittel="Neste elev (⌥↓)">
                <Ikon navn="ned" />
              </Ikonknapp>
            </span>
          )}
          <button
            onClick={onLukk}
            className={`shrink-0 text-liten text-blekk-svak hover:text-blekk ${
              bla && bla.av > 1 ? "ml-3" : "ml-auto"
            }`}
          >
            Lukk (Esc)
          </button>
        </div>
      </header>

      <div className="overflow-y-auto px-5 py-4">
        {ar.length > 1 && (
          <div className="mb-4">
            <Bryter
              storrelse="liten"
              verdi={valgtAr}
              settVerdi={setValgtAr}
              valg={ar.map((a) => ({
                id: a.skolearId,
                navn: `${a.navn}${a.klasse ? ` · ${a.klasse}` : ""}`,
              }))}
            />
          </div>
        )}

        {/*
          Fagfilteret gjelder hele kortet — både heatmapet og vurderingene.
          Har eleven bare ett fag, er det ingenting å velge mellom.
        */}
        {elevensFag.length > 1 && (
          <div className="mb-4">
            <Fagfiltre
              fag={elevensFag}
              valgt={vurderingsfag}
              settValgt={setVurderingsfag}
            />
          </div>
        )}

        <Bolk tittel="Innsats per økt" nokkel="elevkort-innsats">
          {synligeFagRader.length === 0 && synligeTommeFag.length === 0 ? (
            <Stille>
              {fagRader.length === 0 && tommeFag.length === 0
                ? "Eleven har ingen fag dette skoleåret."
                : "Ingen økter i dette faget."}
            </Stille>
          ) : (
            <>
              {synligeFagRader.map((rad) => (
                <Heatmap
                  key={rad.skolearFagId}
                  rad={rad}
                  onApneOkt={onApneOkt}
                />
              ))}
              {synligeTommeFag.map((f) => (
                <div
                  key={f.skolearFagId}
                  className="flex items-center gap-2 py-1.5"
                >
                  <span className="w-16 shrink-0">
                    <Fagmerke kode={f.fagKode} farge={f.farge} />
                  </span>
                  <Stille>Ingen økter lagt inn ennå</Stille>
                </div>
              ))}
            </>
          )}
        </Bolk>

        <Bolk tittel="Vurderinger" nokkel="elevkort-vurderinger">
          {vurderinger.length === 0 ? (
            <Stille>Ingen vurderinger i fagene hens ennå.</Stille>
          ) : synligeVurderinger.length === 0 ? (
            <Stille>Ingen vurderinger i dette faget.</Stille>
          ) : (
            <table className="w-full text-brod">
              <tbody>
                {synligeVurderinger.map((v) => (
                  <tr
                    key={v.vurderingId}
                    className="border-b border-linje-svak align-top"
                  >
                    <td className="w-16 py-1.5">
                      <Fagmerke kode={v.fagKode} farge={null} liten />
                    </td>
                    <td className="py-1.5">
                      <button
                        onClick={() => ark.apneVurdering(v.vurderingId)}
                        className="text-left hover:text-aksent hover:underline"
                      >
                        {v.tittel}
                      </button>
                      {v.kommentar && (
                        <p className="text-liten italic text-blekk-dempet">
                          {v.kommentar}
                        </p>
                      )}
                    </td>
                    <td className="w-20 py-1.5 tabular-nums text-blekk-dempet">
                      {v.frist ?? ""}
                    </td>
                    <td className="whitespace-nowrap py-1.5 text-right">
                      {v.resultat ? (
                        <span className="inline-block whitespace-nowrap rounded-liten border border-linje px-1.5 py-0.5 tabular-nums">
                          {v.resultat}
                        </span>
                      ) : (
                        <span className="text-blekk-svakest">
                          {v.levert === 1 ? "levert" : "–"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Bolk>

        <Motelogg elevId={elev.id} skolearId={aktivtSkolearId} />

        <button
          onClick={async () => {
            const n = await tellForElev(elevId);
            const hva = [
              n.skaringer && `${n.skaringer} skåringer`,
              n.vurderinger && `${n.vurderinger} vurderingsresultater`,
              n.notater && `${n.notater} notater`,
            ].filter(Boolean);
            const ok = await bekreft(
              `Slette ${elev.fornavn} ${elev.etternavn}?\n\n` +
                (hva.length > 0
                  ? `Dette fjerner ${hva.join(", ")} — i alle skoleår, ikke bare dette.\n\n`
                  : "Eleven har ingen skåringer eller vurderinger registrert.\n\n") +
                "Sikkerhetskopien fra i dag er veien tilbake.",
            );
            if (!ok) return;
            await slettElevHelt(elevId);
            onLukk();
          }}
          className="mt-2 text-liten text-blekk-svak hover:text-feil"
        >
          Slett eleven
        </button>
      </div>
    </aside>
  );
}

/**
 * Klassen settes sjelden — som regel bare når noen bytter klasse midt i året.
 * Men den skal kunne endres der man ser eleven, ikke bare fra tabellen.
 */
function Klassevelger({
  klasser,
  valgt,
  onVelg,
  onNy,
}: {
  klasser: Klasse[];
  valgt: string | null;
  onVelg: (klasseId: string | null) => void;
  onNy: (navn: string) => void;
}) {
  const [skriver, setSkriver] = useState(false);
  const valgtId = klasser.find((k) => k.navn === valgt)?.id ?? "";

  if (skriver) {
    return (
      <input
        autoFocus
        placeholder="1STC"
        onBlur={(e) => {
          const navn = e.target.value.trim();
          setSkriver(false);
          if (navn) onNy(navn);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setSkriver(false);
        }}
        className="w-24 rounded-vanlig border border-aksent px-1 py-0.5 text-brod outline-none"
      />
    );
  }

  return (
    <select
      value={valgtId}
      onChange={(e) => {
        if (e.target.value === "__ny") return setSkriver(true);
        onVelg(e.target.value === "" ? null : e.target.value);
      }}
      title="Klasse dette skoleåret"
      className="rounded-vanlig border border-transparent bg-transparent px-1 py-0.5 text-brod text-blekk-dempet hover:border-linje focus:border-aksent focus:outline-none"
    >
      <option value="">Ingen klasse</option>
      {klasser.map((k) => (
        <option key={k.id} value={k.id}>
          {k.navn}
        </option>
      ))}
      <option value="__ny">Ny klasse …</option>
    </select>
  );
}

function Heatmap({
  rad,
  onApneOkt,
}: {
  rad: FagRad;
  onApneOkt: (oktId: string) => void;
}) {
  const talt = tell(rad.ruter);

  return (
    <div className="py-2">
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0">
          <Fagmerke kode={rad.fagKode} farge={rad.farge} />
        </span>
        <div className="flex flex-wrap gap-[3px]">
          {rad.ruter.map((rute, i) => (
            <Rute
              key={rute.oktId + i}
              rute={rute}
              onKlikk={() => onApneOkt(rute.oktId)}
            />
          ))}
        </div>
      </div>
      <p className="ml-[4.5rem] mt-1 text-liten tabular-nums text-blekk-dempet">
        {rad.ruter.length} økter · {talt.gronn} grønne, {talt.gul} gule,{" "}
        {talt.rod} røde
        {talt.ikke > 0 && `, ${talt.ikke} ikke i økta`}
        {talt.uavholdt > 0 && ` · ${talt.uavholdt} ikke avholdt`}
      </p>
    </div>
  );
}

/**
 * Form i tillegg til farge (§13). "Ikke i økta" er tomt omriss og skal aldri
 * kunne forveksles med rødt. Økter som ikke er avholdt tegnes som et hull.
 */
function Rute({ rute, onKlikk }: { rute: HeatmapRute; onKlikk: () => void }) {
  const avholdt = rute.avholdt > 0;
  const ikkeIOkta =
    rute.tellerIkke === 1 || (avholdt && rute.verdiKode === null);
  const farge = rute.verdiFarge ? skalafarge(rute.verdiFarge) : null;

  const tittel = [
    rute.dato,
    rute.tema,
    !avholdt
      ? "ikke avholdt"
      : ikkeIOkta
        ? "ikke i økta"
        : (rute.verdiKode ?? ""),
    rute.notat,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      onClick={onKlikk}
      title={tittel}
      className="h-3.5 w-3.5 rounded-[2px] border"
      style={
        !avholdt
          ? {
              borderColor: "var(--color-linje-medium)",
              borderStyle: "dotted",
              background: "transparent",
            }
          : ikkeIOkta
            ? {
                borderColor: NOYTRAL,
                borderStyle: "dashed",
                background: "transparent",
              }
            : {
                borderColor: farge ?? NOYTRAL,
                background: farge ?? "transparent",
              }
      }
    />
  );
}

function tell(ruter: HeatmapRute[]) {
  const t = { gronn: 0, gul: 0, rod: 0, ikke: 0, uavholdt: 0 };
  for (const r of ruter) {
    if (r.avholdt === 0) t.uavholdt++;
    else if (r.tellerIkke === 1 || r.verdiKode === null) t.ikke++;
    else if (r.verdiFarge === "gronn") t.gronn++;
    else if (r.verdiFarge === "gul") t.gul++;
    else if (r.verdiFarge === "rod") t.rod++;
  }
  return t;
}

function Bolk({
  tittel,
  handling,
  sammenlagt: styrt,
  nokkel,
  children,
}: {
  /** gjør bolken sammenleggbar på egen hånd; valget huskes (ui/Sammenleggbar) */
  nokkel?: string;
  tittel: string;
  /** en knapp til høyre i overskriftslinja, f.eks. «+ Nytt notat» */
  handling?: React.ReactNode;
  /**
   * Gjør bolken sammenleggbar: overskriften blir en knapp. `apen` styres
   * utenfra, så valget kan huskes; `etikett` står etter tittelen når den er
   * lagt sammen, f.eks. antallet.
   */
  sammenlagt?: { apen: boolean; bytt: () => void; etikett?: string };
  children: React.ReactNode;
}) {
  const [egenApen, setEgenApen] = useApen(nokkel);
  // Styrt utenfra (notatene, der «+ Nytt notat» også åpner), eller av seg selv.
  const sammenlagt =
    styrt ??
    (nokkel
      ? { apen: egenApen, bytt: () => setEgenApen(!egenApen) }
      : undefined);
  const apen = sammenlagt?.apen ?? true;
  return (
    <section className="mb-6">
      <div
        className={`flex items-baseline border-b border-linje-medium pb-1 ${apen ? "mb-2" : ""}`}
      >
        {sammenlagt ? (
          <button
            onClick={sammenlagt.bytt}
            aria-expanded={apen}
            className="flex items-baseline gap-1.5 text-etikett uppercase tracking-etikett text-blekk-dempet hover:text-blekk"
          >
            <span
              aria-hidden
              className={`inline-block transition-transform duration-150 ${apen ? "rotate-90" : ""}`}
            >
              ›
            </span>
            {tittel}
            {!apen && sammenlagt.etikett && (
              <span className="normal-case tracking-normal text-blekk-svak">
                {sammenlagt.etikett}
              </span>
            )}
          </button>
        ) : (
          <h3 className="text-etikett uppercase tracking-etikett text-blekk-dempet">
            {tittel}
          </h3>
        )}
        {handling && <span className="ml-auto">{handling}</span>}
      </div>
      {apen && children}
    </section>
  );
}

function Stille({ children }: { children: React.ReactNode }) {
  return <p className="py-1 text-brod text-blekk-svak">{children}</p>;
}

/**
 * Notater og møtelogg, SPEC §4.7.
 *
 * Kronologisk liste, nyeste først, med åpne oppfølgingspunkter fast øverst.
 * Dette er en annen type notat enn skåringsnotatet i §4.4: det henger på én
 * bestemt økt og leses i heatmapet. Møteloggen er en bevisst hendelse — en
 * samtale, en observasjon, en avtale.
 */

function Motelogg({
  elevId,
  skolearId,
}: {
  elevId: string;
  skolearId: string;
}) {
  const [notater, setNotater] = useState<Elevnotat[]>([]);
  // Notatene fra skåringen i øktene (§4.4). De bor på skåringsraden, men
  // hører hjemme i elevens tidslinje sammen med møteloggen.
  const [oktnotater, setOktnotater] = useState<Oktnotat[]>([]);
  const [filter, setFilter] = useState<Notatfilter>("alle");
  const [skriver, setSkriver] = useState(false);
  // Lagt sammen eller åpen huskes, for alle elever: det er en vane, ikke en
  // egenskap ved eleven.
  const [apen, settApen] = useApen("elevkort-notater");
  const idag = new Date().toISOString().slice(0, 10);
  const ark = useArk();

  async function last() {
    const [n, o] = await Promise.all([
      hentElevnotater(elevId),
      hentOktnotater(elevId),
    ]);
    setNotater(n);
    setOktnotater(o);
  }

  useEffect(() => {
    void last();
  }, [elevId]);
  // Et notat skrevet i en økt over kortet, skal stå her når økta lukkes.
  useEffect(() => lyttElever(() => void last()), [elevId]);

  const punkter = flettTidslinje(notater, oktnotater, filter);

  return (
    <Bolk
      tittel="Notater og møtelogg"
      sammenlagt={{
        apen,
        bytt: () => settApen(!apen),
        etikett:
          notater.length + oktnotater.length > 0
            ? `· ${notater.length + oktnotater.length}`
            : undefined,
      }}
      handling={
        !skriver && (
          <button
            onClick={() => {
              settApen(true);
              setSkriver(true);
            }}
            className="text-liten text-blekk-dempet hover:text-blekk"
          >
            + Nytt notat
          </button>
        )
      }
    >
      {/* Det nye notatet skrives øverst, der det havner — nyeste først. */}
      {skriver && (
        <NyttNotat
          elevId={elevId}
          skolearId={skolearId}
          onLagret={async () => {
            setSkriver(false);
            await last();
          }}
          onAvbryt={() => setSkriver(false)}
        />
      )}

      {/*
        Filteret står bare når det er noe å skille: møteloggen og notatene
        fra øktene.
      */}
      {notater.length > 0 && oktnotater.length > 0 && (
        <div className="mb-3">
          <Bryter
            storrelse="liten"
            verdi={filter}
            settVerdi={(v) => setFilter(v as Notatfilter)}
            valg={[
              { id: "alle", navn: "Alle" },
              { id: "motelogg", navn: `Møtelogg · ${notater.length}` },
              { id: "okt", navn: `Fra øktene · ${oktnotater.length}` },
            ]}
          />
        </div>
      )}

      {notater.length === 0 && oktnotater.length === 0 && !skriver && (
        <Stille>
          Ingen notater ennå. Her samles det du vil huske om eleven over tid —
          samtaler, observasjoner, avtaler.
        </Stille>
      )}

      {/* Tidslinja: dato til venstre, en linje med et punkt per notat. */}
      <div className={skriver ? "mt-4" : ""}>
        {punkter.map((p, i) =>
          p.slag === "notat" ? (
            <Notatrad
              key={p.notat.id}
              notat={p.notat}
              idag={idag}
              sist={i === punkter.length - 1}
              onEndret={last}
            />
          ) : (
            <Oktnotatrad
              key={p.notat.id}
              elevId={elevId}
              notat={p.notat}
              sist={i === punkter.length - 1}
              onApneOkt={() => ark.apneOkt(p.notat.oktId)}
              onEndret={last}
            />
          ),
        )}
      </div>

      <p className="mt-2 text-etikett text-blekk-svak">
        Dette er arbeidsmateriale. Helse, hjemmeforhold og andre særlige
        kategorier hører ikke hjemme her.
      </p>
    </Bolk>
  );
}

/**
 * Et notat fra skåringen i en økt. Prikken har skåringens farge, så
 * tidslinja også viser hvordan timen gikk. Fag og tema åpner økta.
 */
function Oktnotatrad({
  elevId,
  notat,
  sist,
  onApneOkt,
  onEndret,
}: {
  elevId: string;
  notat: Oktnotat;
  sist: boolean;
  onApneOkt: () => void;
  onEndret: () => void;
}) {
  return (
    <div className="flex gap-3">
      <Tidslinjedato dato={notat.dato} />

      <div className="relative w-3 shrink-0" aria-hidden>
        <span
          className={`absolute left-1/2 top-0 w-px -translate-x-1/2 bg-linje ${
            sist ? "h-2" : "h-full"
          }`}
        />
        <span
          className="absolute left-1/2 top-[0.4rem] h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-ark"
          style={{ background: skalafarge(notat.farge) }}
          title={notat.verdi ?? "Ikke skåret"}
        />
      </div>

      <div className="min-w-0 flex-1 pb-4">
        <div className="flex items-baseline gap-2 text-liten">
          <button
            onClick={onApneOkt}
            className="flex min-w-0 items-baseline gap-2 text-left hover:text-aksent"
          >
            <span className="shrink-0 rounded-liten bg-flate px-1.5 text-blekk-dempet">
              Økt
            </span>
            <span className="shrink-0 text-blekk-svak">{notat.fagKode}</span>
            {notat.tema && (
              <Kappet verdi={notat.tema} klasse="text-blekk-svak" />
            )}
          </button>
        </div>
        <div className="-mx-2">
          <Markdownfelt
            verdi={notat.tekst}
            onLagre={async (v) => {
              await settSkaringsnotat(elevId, notat.oktId, v ?? "");
              onEndret();
            }}
          />
        </div>
      </div>
    </div>
  );
}

function Notatrad({
  notat,
  idag,
  sist,
  onEndret,
}: {
  notat: Elevnotat;
  idag: string;
  /** nederste punkt: linja stopper ved prikken */
  sist: boolean;
  onEndret: () => void;
}) {
  const apent = notat.skalFolgesOpp && notat.lukket === null;
  const forfalt = erForfalt(notat, idag);
  const d = new Date(`${notat.dato}T12:00:00`);
  const dag = d.toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
  const arOgUkedag = `${d.getFullYear()} · ${d.toLocaleDateString("nb-NO", {
    weekday: "short",
  })}`;
  const prikk = forfalt
    ? "border-feil bg-feil"
    : apent
      ? "border-aksent bg-aksent"
      : "border-linje-sterk bg-ark";

  return (
    <div className="flex gap-3">
      {/* Datoen er det man leter etter i en logg, så den står for seg. */}
      <div className="w-[4.75rem] shrink-0 pt-px text-right">
        <div className="text-brod font-medium tabular-nums text-blekk">
          {dag.replace(/\.$/, "")}
        </div>
        <div className="text-mikro tabular-nums text-blekk-svak">
          {arOgUkedag.replace(/\.$/, "")}
        </div>
      </div>

      <div className="relative w-3 shrink-0" aria-hidden>
        <span
          className={`absolute left-1/2 top-0 w-px -translate-x-1/2 bg-linje ${
            sist ? "h-2" : "h-full"
          }`}
        />
        <span
          className={`absolute left-1/2 top-[0.4rem] h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 ${prikk}`}
        />
      </div>

      <div className="min-w-0 flex-1 pb-4">
        <div className="flex items-baseline gap-2 text-liten">
          {/*
            Herkomsten leses av notatets egne felter, ikke av at samtalen
            fortsatt finnes: en ny trekning erstatter samtaleradene, og
            notatet skal stå like fullt.
          */}
          {notat.samtaleId && (
            <span className="rounded-liten bg-flate px-1.5 text-blekk-dempet">
              {notat.skolearFagId ? "Fagsamtale" : "Mentorsamtale"}
            </span>
          )}
          {notat.fagKode && (
            <span className="text-blekk-svak">{notat.fagKode}</span>
          )}
          {apent && (
            <span className={forfalt ? "text-feil" : "text-aksent"}>
              {notat.frist
                ? `${forfalt ? "forfalt" : "frist"} ${notat.frist}`
                : "følges opp"}
            </span>
          )}
          <span className="ml-auto flex items-center gap-2">
            {notat.skalFolgesOpp && (
              <button
                onClick={async () => {
                  await settLukket(notat.id, notat.lukket === null);
                  onEndret();
                }}
                className="text-blekk-svak hover:text-blekk"
              >
                {notat.lukket === null ? "Lukk" : "Åpne igjen"}
              </button>
            )}
            <button
              onClick={async () => {
                if (!(await bekreft(`Slette notatet fra ${notat.dato}?`)))
                  return;
                await slettElevnotat(notat.id);
                onEndret();
              }}
              className="text-blekk-svakest hover:text-feil"
            >
              Slett
            </button>
          </span>
        </div>
        {/*
          Formatert markdown; klikk for å skrive. Avkrysningsbokser kan
          krysses av rett i visningen. Et notat kan ikke tømmes — da slettes
          det.
        */}
        <div className="-mx-2">
          <Markdownfelt
            verdi={notat.tekst}
            onLagre={async (v) => {
              if (!v) return;
              await endreElevnotat(notat.id, { tekst: v });
              onEndret();
            }}
          />
        </div>
      </div>
    </div>
  );
}

function NyttNotat({
  elevId,
  skolearId,
  onLagret,
  onAvbryt,
}: {
  elevId: string;
  skolearId: string;
  onLagret: () => void;
  onAvbryt: () => void;
}) {
  const [dato, setDato] = useState(new Date().toISOString().slice(0, 10));
  const [tekst, setTekst] = useState("");
  const [folgesOpp, setFolgesOpp] = useState(false);
  const [frist, setFrist] = useState("");

  return (
    <div className="mt-2 rounded-vanlig border border-linje bg-flate-svak p-2">
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={dato}
          onChange={(e) => setDato(e.target.value)}
          className="rounded border border-linje bg-ark px-2 py-1 text-brod tabular-nums"
        />
        <label className="flex select-none items-center gap-1.5 text-liten text-blekk-dempet">
          <input
            type="checkbox"
            checked={folgesOpp}
            onChange={(e) => setFolgesOpp(e.target.checked)}
          />
          Skal følges opp
        </label>
        {/* Fristen er valgfri også når boksen er huket av: mye oppfølging har
            ingen dato, den er bare der til den er gjort (§4.7). */}
        {folgesOpp && (
          <input
            type="date"
            value={frist}
            onChange={(e) => setFrist(e.target.value)}
            title="Frist er valgfri"
            className="rounded border border-linje bg-ark px-2 py-1 text-brod tabular-nums"
          />
        )}
      </div>

      <div className="mt-2">
        <MarkdownSkriv
          autoFocus
          verdi={tekst}
          onEndre={setTekst}
          plassholder="Hva skjedde, og hva ble avtalt? «- » gir en punktliste, «- [ ] » en avkrysningsboks."
        />
      </div>

      <div className="mt-2 flex gap-2">
        <Knapp
          variant="primar"
          disabled={tekst.trim() === ""}
          onClick={async () => {
            await opprettElevnotat(elevId, skolearId, {
              dato,
              tekst: tekst.trim(),
              skalFolgesOpp: folgesOpp,
              frist: folgesOpp && frist !== "" ? frist : null,
            });
            onLagret();
          }}
        >
          Lagre
        </Knapp>
        <Knapp variant="stille" onClick={onAvbryt}>
          Avbryt
        </Knapp>
      </div>
    </div>
  );
}

/**
 * Navnet i overskriften, redigerbart der det står.
 *
 * `defaultValue` med `key` framfor en kontrollert verdi: feltet skal la seg
 * skrive i uten at hvert tastetrykk går gjennom databasen, og hentes friskt
 * når navnet faktisk er endret.
 *
 * Et tomt etternavn får en synlig advarsel. Det er slik halvferdige elever
 * har blitt liggende — de så ferdige ut.
 */
function Navnefelt({
  verdi,
  plassholder,
  manglerTekst,
  onLagre,
}: {
  verdi: string;
  plassholder: string;
  /** vises når feltet er tomt — utelates der tomt er greit */
  manglerTekst?: string;
  onLagre: (v: string) => Promise<void>;
}) {
  const mangler = manglerTekst !== undefined && verdi.trim() === "";

  return (
    <span className="flex shrink-0 items-baseline gap-1.5">
      <input
        defaultValue={verdi}
        key={verdi}
        placeholder={plassholder}
        title={plassholder}
        onBlur={async (e) => {
          const ny = e.target.value.trim();
          if (ny !== verdi.trim()) await onLagre(ny);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.currentTarget.value = verdi;
            e.currentTarget.blur();
          }
        }}
        size={Math.max(plassholder.length, verdi.length + 1)}
        className={`rounded-vanlig border border-transparent px-1 py-0.5 font-display text-tittel outline-none hover:border-linje focus:border-aksent ${
          mangler ? "border-varsel" : ""
        }`}
      />
      {mangler && (
        <span className="whitespace-nowrap text-liten text-varsel">
          {manglerTekst}
        </span>
      )}
    </span>
  );
}
