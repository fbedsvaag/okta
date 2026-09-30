import { useEffect, useState } from "react";
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
  Knapp,
} from "../ui/felles";
import {
  erForfalt,
  hentElevnotater,
  opprettElevnotat,
  settLukket,
  slettElevnotat,
  sorterNotater,
  type Elevnotat,
  endreElevnotat,
} from "../data/elevnotat";
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
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-2 border-b border-linje-medium px-5 py-3">
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

        <Bolk tittel="Innsats per økt">
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

        <Bolk tittel="Vurderinger">
          {vurderinger.length === 0 ? (
            <Stille>Ingen vurderinger i fagene hens ennå.</Stille>
          ) : synligeVurderinger.length === 0 ? (
            <Stille>Ingen vurderinger i dette faget.</Stille>
          ) : (
            <table className="w-full text-brod">
              <tbody>
                {synligeVurderinger.map((v, i) => (
                  <tr key={i} className="border-b border-linje-svak align-top">
                    <td className="w-16 py-1.5">
                      <Fagmerke kode={v.fagKode} farge={null} liten />
                    </td>
                    <td className="py-1.5">
                      {v.tittel}
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
  children,
}: {
  tittel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h3 className="mb-2 border-b border-linje-medium pb-1 text-etikett uppercase tracking-etikett text-blekk-dempet">
        {tittel}
      </h3>
      {children}
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
  const [skriver, setSkriver] = useState(false);
  const idag = new Date().toISOString().slice(0, 10);

  async function last() {
    setNotater(sorterNotater(await hentElevnotater(elevId)));
  }

  useEffect(() => {
    void last();
  }, [elevId]);

  return (
    <Bolk tittel="Notater og møtelogg">
      {notater.length === 0 && !skriver && (
        <Stille>
          Ingen notater ennå. Her samles det du vil huske om eleven over tid —
          samtaler, observasjoner, avtaler.
        </Stille>
      )}

      {notater.map((n) => (
        <Notatrad key={n.id} notat={n} idag={idag} onEndret={last} />
      ))}

      {skriver ? (
        <NyttNotat
          elevId={elevId}
          skolearId={skolearId}
          onLagret={async () => {
            setSkriver(false);
            await last();
          }}
          onAvbryt={() => setSkriver(false)}
        />
      ) : (
        <button
          onClick={() => setSkriver(true)}
          className="mt-2 text-brod text-blekk-dempet hover:text-blekk"
        >
          + Nytt notat
        </button>
      )}

      <p className="mt-2 text-etikett text-blekk-svak">
        Dette er arbeidsmateriale. Helse, hjemmeforhold og andre særlige
        kategorier hører ikke hjemme her.
      </p>
    </Bolk>
  );
}

function Notatrad({
  notat,
  idag,
  onEndret,
}: {
  notat: Elevnotat;
  idag: string;
  onEndret: () => void;
}) {
  const apent = notat.skalFolgesOpp && notat.lukket === null;
  const forfalt = erForfalt(notat, idag);

  return (
    <div
      className={`border-b border-linje-svak py-2 ${
        apent ? "border-l-2 pl-2" : ""
      }`}
      style={apent ? { borderLeftColor: "var(--color-aksent)" } : undefined}
    >
      <div className="flex items-baseline gap-2 text-liten">
        <span className="tabular-nums text-blekk-dempet">{notat.dato}</span>
        {/*
          Herkomsten leses av notatets egne felter, ikke av at samtalen
          fortsatt finnes: en ny trekning erstatter samtaleradene, og notatet
          skal stå like fullt.
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
          <span className={forfalt ? "text-feil" : "text-blekk-dempet"}>
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
              if (!(await bekreft(`Slette notatet fra ${notat.dato}?`))) return;
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
        Formatert markdown; klikk for å skrive. Avkrysningsbokser kan krysses
        av rett i visningen. Et notat kan ikke tømmes — da slettes det.
      */}
      <div className="-mx-2 mt-0.5">
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
