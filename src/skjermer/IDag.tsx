import { Sammenleggknapp, useApen } from "../ui/Sammenleggbar";
import { Utfold } from "../ui/Utfold";
import { useContext, useEffect, useRef, useState } from "react";
import type { Skolear } from "../data/skolear";
import type { FagIAr } from "../data/fag";
import { hentOkter, type Okt } from "../data/okter";
import { Bryter, Fagfirkant, Ikon } from "../ui/felles";
import { Tomside } from "../ui/Tomside";
import { Markdown } from "../ui/Notattekst";
import { vekslBoks } from "../ui/markdown";
import { endreOkt } from "../data/okter";
import { hentPerioder } from "../data/perioder";
import { useArk } from "../ui/Arkstabel";
import {
  Glipper,
  Gjoremalsliste,
  IDel,
  Timeregnskap,
  Vurderingsfrister,
  useOversikt,
} from "./Arsoversikt";
import { InnsatsOverTid } from "./InnsatsOverTid";
import { hentOktrader, type Oktrad } from "../data/oktrader";
import { folgOppIDag } from "../data/oktplan";
import { hentElever, type ElevRad } from "../data/elever";
import { lyttElever } from "../data/endringer";
import { useLagretInnstilling } from "../ui/useLagretInnstilling";
import { useGlid } from "../ui/useGlid";
import { IVerktoylinja } from "../ui/Verktoylinje";
import { Skarprikk } from "../ui/Skarprikk";
import { mandag } from "../data/kalender";
import { dagenssetning, hentSamtalerPaDato } from "../data/samtale";
import { Ukelinje } from "./Ukelinje";
import { lytt, lyttOktvisning } from "../data/endringer";
import { dagen, type Dagslinje } from "../data/dagen";
import { harModifikator } from "../ui/taster";

/**
 * I dag — startskjermen, SPEC §4.1, med årsoversikten under.
 *
 * MERK: §13 sier «ingen grafer på forsiden», og §10 legger et rikere dashbord
 * til senere. Årsoversikten er lagt inn etter uttrykkelig beslutning fra
 * eieren, som overstyrer begge. SPEC.md er ikke skrevet om — koden avviker
 * altså bevisst fra spec-en på dette punktet.
 */
export function IDag({
  skolear,
  fag,
  onGaTil,
  onApneOkt,
}: {
  skolear: Skolear;
  fag: FagIAr[];
  onGaTil: (
    visning:
      "fag" | "elever" | "okter" | "vurderinger" | "samtaler" | "folgopp",
    /** tingen skjermen skal åpne — f.eks. eleven du klikket på */
    id?: string,
  ) => void;
  /** åpner økta som et ark over forsiden */
  onApneOkt: (id: string) => void;
}) {
  const [okter, setOkter] = useState<Okt[]>([]);
  const [samtaler, setSamtaler] = useState<
    Awaited<ReturnType<typeof hentSamtalerPaDato>>
  >([]);
  const [rader, setRader] = useState<Oktrad[]>([]);
  const [elever, setElever] = useState<Map<string, ElevRad>>(new Map());
  // Enkel eller Full (20.5), og Uka som timer eller kompakt. Huskes.
  const [oppsett, settOppsett] = useLagretInnstilling<"enkel" | "full">(
    "idag_oppsett",
    "enkel",
    (v) => (v === "full" ? "full" : "enkel"),
    String,
  );
  const [ukevisning, settUkevisning] = useLagretInnstilling<
    "timer" | "kompakt"
  >(
    "idag_uka",
    "timer",
    (v) => (v === "kompakt" ? "kompakt" : "timer"),
    String,
  );
  const rutenett = useRef<HTMLDivElement>(null);
  useGlid(rutenett, `${oppsett}-${ukevisning}`);

  const lastOkter = () => void hentOkter(skolear.id).then(setOkter);
  useEffect(lastOkter, [skolear.id]);
  // Endres en økt i et ark over forsiden, skal uka vise det med en gang.
  useEffect(() => lytt(lastOkter), [skolear.id]);
  useEffect(() => lyttOktvisning(lastOkter), [skolear.id]);
  useEffect(() => {
    const last = () => {
      void hentOktrader(skolear.id).then(setRader);
      void hentElever(skolear.id).then((e) =>
        setElever(new Map(e.map((x) => [x.id, x]))),
      );
    };
    last();
    const av = [lytt(last), lyttElever(last)];
    return () => av.forEach((f) => f());
  }, [skolear.id]);

  // En økt, en elev eller en vurdering åpnes som et ark over forsiden
  // (Arkstabel) — du blir her.
  const apne = onApneOkt;
  const ark = useArk();
  const data = useOversikt(skolear.id);

  useEffect(() => {
    void hentSamtalerPaDato(skolear.id, isoDato(new Date())).then(setSamtaler);
  }, [skolear.id]);

  const idag = isoDato(new Date());
  const full = oppsett === "full";
  const kompakt = ukevisning === "kompakt";
  // Raden under Uka: rett etter den, som rykker opp når Uka er kompakt.
  const nederst = kompakt ? 4 : 5;

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-clip">
      <IVerktoylinja>
        <span className="ml-auto">
          <Bryter
            storrelse="liten"
            verdi={oppsett}
            settVerdi={(v) => settOppsett(v as "enkel" | "full")}
            valg={[
              { id: "enkel", navn: "Enkel" },
              { id: "full", navn: "Full" },
            ]}
          />
        </span>
      </IVerktoylinja>

      {/* Datoen blir stående mens resten ruller. */}
      <div className="flex shrink-0 items-baseline gap-3 pb-3">
        <h1 className="text-[calc(32px*var(--tekst-skala))] font-light leading-tight tracking-overskrift first-letter:uppercase">
          {langDato(idag)}
        </h1>
        <span className="text-liten text-blekk-dempet">
          {full
            ? "Full: alt på én side"
            : "Enkel: neste økt, hvem du skal følge opp og gjøremålene"}
        </span>
      </div>

      {/* Rullefeltet er skjult — man ruller med styreflata. */}
      <div className="scrollbar-skjult min-h-0 flex-1 overflow-auto pb-6">
        {/*
          Samtaledagen står først: er det samtaler i dag, er det dem dagen
          handler om (§4.10).
        */}
        {samtaler.length > 0 && (
          <div className="idag-del mb-4">
            <h3 className="idag-del-tittel">Samtaler</h3>
            <p className="py-1 text-brod">
              {dagenssetning(
                samtaler,
                new Date().toTimeString().slice(0, 5),
                samtaler.every((s) => s.erMentor),
              )}
            </p>
            <button
              onClick={() => onGaTil("samtaler")}
              className="self-start text-liten text-blekk-dempet hover:text-blekk"
            >
              Åpne timeplanen <Ikon navn="pil" />
            </button>
          </div>
        )}

        {okter.length === 0 && (
          <Tomside
            tegning={fag.length === 0 ? "nyttar" : "idag"}
            tittel={
              fag.length === 0
                ? "Klar for første skoledag?"
                : "Ingen økter ennå"
            }
            tekst={
              fag.length === 0
                ? "Legg inn fagene dine, så kan du planlegge økter for hele året."
                : "Fagene er på plass. Legg inn øktene, så står dagens her hver morgen."
            }
            hoved={{
              tekst: fag.length === 0 ? "Legg til fag" : "Legg inn økter",
              onKlikk: () => onGaTil(fag.length === 0 ? "fag" : "okter"),
            }}
            hint="⌘K og skriv «hvordan» om du står fast."
          />
        )}

        {/*
          Rutenettet fra lerretet IDagOppsett: fire kolonner, faste rader,
          ingen hull. Enkel er de tre øverst; Full legger til Uka og raden
          under. Delene glir rolig når oppsettet endres.
        */}
        <div ref={rutenett} className="idag-rutenett">
          <Del
            id="okter"
            tittel="Dagens økter"
            kol="1 / span 2"
            rad="1 / span 2"
          >
            <Dagensokter
              okter={okter}
              idag={idag}
              onApne={apne}
              onSeUka={() => onGaTil("okter")}
            />
          </Del>
          <Del
            id="folgopp"
            tittel="Følg opp i dag"
            under="fra forrige økt"
            handling={
              <button
                onClick={() => onGaTil("folgopp")}
                className="text-liten font-normal text-aksent hover:underline"
              >
                Se alle ›
              </button>
            }
            kol="3 / span 2"
            rad="1"
          >
            <FolgOppIDag
              rader={rader}
              okter={okter}
              idag={idag}
              elever={elever}
              fag={fag}
              onApneElev={(id) => ark.apneElev(id)}
            />
          </Del>
          <Del id="gjoremal" tittel="Gjøremål" kol="3 / span 2" rad="2">
            <Gjoremalsliste skolearId={skolear.id} />
          </Del>

          {full && (
            <>
              <Del
                id="uka"
                tittel="Uka"
                kol="1 / span 4"
                rad={kompakt ? "3" : "3 / span 2"}
                handling={
                  <Bryter
                    storrelse="liten"
                    verdi={ukevisning}
                    settVerdi={(v) => settUkevisning(v as "timer" | "kompakt")}
                    valg={[
                      { id: "timer", navn: "Timer" },
                      { id: "kompakt", navn: "Kompakt" },
                    ]}
                  />
                }
              >
                {kompakt ? (
                  <Ukekompakt okter={okter} idag={idag} onApne={apne} />
                ) : (
                  <Ukelinje
                    okter={okter}
                    forste={skolear.start}
                    siste={skolear.slutt}
                    idag={idag}
                    onApneOkt={apne}
                  />
                )}
              </Del>
              <Del
                id="frister"
                tittel="Vurderingsfrister"
                kol="1"
                rad={String(nederst)}
              >
                <Vurderingsfrister
                  rader={data?.kommende ?? []}
                  onApne={(id) => ark.apneVurdering(id)}
                />
              </Del>
              <Del
                id="glipper"
                tittel="Elever som glipper"
                under="siste 10 økter"
                kol="2 / span 2"
                rad={String(nederst)}
              >
                <Glipper
                  elever={data?.glipp ?? []}
                  onApne={(id) => ark.apneElev(id)}
                />
              </Del>
              <Del
                id="innsats"
                tittel="Innsats over tid"
                kol="4"
                rad={String(nederst)}
              >
                <Innsatsdel rader={rader} fag={fag} />
              </Del>
            </>
          )}
        </div>

        {/*
          Det tegningen ikke har med, står under rutenettet i Full, så
          ingenting forsvinner: timeregnskapet og innsatsen uke for uke.
        */}
        {full && (
          <div className="mt-8 space-y-7">
            <Timeregnskap
              fag={data?.timer ?? []}
              mentor={data?.mentor ?? null}
            />
            <InnsatsOverTid
              skolearId={skolear.id}
              start={skolear.start}
              slutt={skolear.slutt}
              fag={fag}
              okter={okter}
              tittel="Innsats uke for uke"
            />
          </div>
        )}
      </div>
    </div>
  );
}

/** En del i rutenettet på I dag (20.5, 29.9): tittel, og innholdet som ruller. */
function Del({
  id,
  tittel,
  under,
  handling,
  kol,
  rad,
  children,
}: {
  id: string;
  tittel: string;
  under?: string;
  handling?: React.ReactNode;
  kol: string;
  rad: string;
  children: React.ReactNode;
}) {
  return (
    <section
      data-glid={id}
      className="idag-del"
      style={{ gridColumn: kol, gridRow: rad }}
    >
      <h3 className="idag-del-tittel">
        {tittel}
        {under && <small>{under}</small>}
        {handling && <span className="ml-auto">{handling}</span>}
      </h3>
      <div className="scrollbar-skjult min-h-0 flex-1 overflow-auto">
        <IDel.Provider value={true}>{children}</IDel.Provider>
      </div>
    </section>
  );
}

const fornavnOgBokstav = (e: ElevRad | undefined) =>
  e ? `${e.fornavn} ${e.etternavn.charAt(0)}.` : "";

/**
 * Følg opp i dag (20.5): for hvert fag du har i dag, Rød sist, Ikke sett
 * sist og Borte sist fra den siste avholdte økta. Bare fornavn og
 * forbokstav: I dag kan stå på skjermen i klasserommet.
 */
function FolgOppIDag({
  rader,
  okter,
  idag,
  elever,
  fag,
  onApneElev,
}: {
  rader: Oktrad[];
  okter: Okt[];
  idag: string;
  elever: Map<string, ElevRad>;
  fag: FagIAr[];
  onApneElev: (id: string) => void;
}) {
  const dagens = okter.filter((o) => o.dato === idag);
  if (dagens.length === 0)
    return <p className="text-liten text-blekk-svak">Ingen økter i dag.</p>;
  const liste = folgOppIDag(rader, dagens);
  if (liste.length === 0)
    return (
      <p className="text-liten text-blekk-svak">
        Ingen å følge opp fra forrige gang.
      </p>
    );
  const kode = (id: string) => fag.find((f) => f.id === id)?.kode ?? "";
  const linje = (
    slag: "r" | "t" | "o",
    navn: string,
    ider: { id: string; tillegg?: string }[],
    fagId: string,
  ) =>
    ider.length > 0 && (
      <div key={`${fagId}-${slag}`} className="idag-fg">
        <Skarprikk slag={slag} storrelse={11} />
        <b className="font-medium">{navn}</b>
        <span className="min-w-0 truncate text-blekk-dempet">
          {ider.map((x, i) => (
            <span key={x.id}>
              {i > 0 && " · "}
              <button
                onClick={() => onApneElev(x.id)}
                className="hover:text-aksent hover:underline"
              >
                {fornavnOgBokstav(elever.get(x.id))}
              </button>
              {x.tillegg}
            </span>
          ))}
        </span>
        <span className="text-etikett text-blekk-svak">{kode(fagId)}</span>
      </div>
    );
  return (
    <div>
      {liste.map((f) => [
        linje(
          "r",
          "Rød sist",
          f.rod.map((r) => ({
            id: r.elevId,
            tillegg: r.toPaRad ? " (to på rad)" : undefined,
          })),
          f.skolearFagId,
        ),
        linje(
          "t",
          "Ikke sett sist",
          f.ikkeSett.map((id) => ({ id })),
          f.skolearFagId,
        ),
        linje(
          "o",
          "Borte sist",
          f.borte.map((id) => ({ id })),
          f.skolearFagId,
        ),
      ])}
    </div>
  );
}

/**
 * Innsats over tid som liten del (20.5): per fag, andelen grønn, gul, rød
 * og grått (til stede, ikke sett) av dem som var til stede, hele året.
 */
function Innsatsdel({ rader, fag }: { rader: Oktrad[]; fag: FagIAr[] }) {
  const perFag = fag
    .map((f) => {
      const her = rader.filter((r) => r.skolearFagId === f.id && !r.borte);
      const n = her.length;
      const del = (p: (r: Oktrad) => boolean) =>
        n ? her.filter(p).length / n : 0;
      return {
        f,
        n,
        g: del((r) => r.farge === "gronn"),
        y: del((r) => r.farge === "gul"),
        r: del((r) => r.farge === "rod"),
        t: del((r) => r.ikkeSett === 1),
      };
    })
    .filter((x) => x.n > 0);
  if (perFag.length === 0)
    return <p className="text-liten text-blekk-svak">Ingen skåringer ennå.</p>;
  const pst = (x: number) => `${Math.round(x * 100)} %`;
  return (
    <div className="space-y-1.5">
      {perFag.map((x) => (
        <div
          key={x.f.id}
          className="grid grid-cols-[minmax(0,auto)_1fr] items-center gap-x-2 text-etikett"
          title={`${pst(x.g)} grønn · ${pst(x.y)} gul · ${pst(x.r)} rød · ${pst(x.t)} ikke sett, av dem som var til stede`}
        >
          <span className="flex items-center gap-1 font-medium text-blekk-dempet">
            <Fagfirkant farge={x.f.farge} />
            {x.f.kode}
          </span>
          <span className="text-right tabular-nums">
            {pst(x.g)}
            <span className="ml-1 text-blekk-svak">· {pst(x.t)}</span>
          </span>
          <span className="col-span-2 flex h-2 gap-px overflow-hidden rounded">
            <span style={{ flex: x.g, background: "var(--color-lys-gronn)" }} />
            <span style={{ flex: x.y, background: "var(--color-lys-gul)" }} />
            <span style={{ flex: x.r, background: "var(--color-lys-rod)" }} />
            <span style={{ flex: x.t, background: "var(--color-lys-borte)" }} />
          </span>
        </div>
      ))}
      <p className="pt-0.5 text-[10.5px] text-blekk-svak">
        andel av dem som var til stede · grått = ikke sett
      </p>
    </div>
  );
}

/** Uka i én rad (20.5, Kompakt): fem dager med øktene som små brikker. */
function Ukekompakt({
  okter,
  idag,
  onApne,
}: {
  okter: Okt[];
  idag: string;
  onApne: (id: string) => void;
}) {
  const man = new Date(`${mandag(idag)}T12:00:00`);
  const dager = [0, 1, 2, 3, 4].map((i) => {
    const d = new Date(man);
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString("sv-SE");
  });
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {dager.map((dato) => {
        const dagens = okter
          .filter((o) => o.dato === dato)
          .sort((a, b) =>
            (a.klokkeslett ?? "").localeCompare(b.klokkeslett ?? ""),
          );
        return (
          <div
            key={dato}
            className="min-h-[76px] rounded-lg bg-flate-svak px-[7px] py-1.5 shadow-[inset_0_0_0_1px_var(--color-linje-svak)]"
          >
            <div
              className={`text-etikett first-letter:uppercase ${dato === idag ? "font-semibold text-aksent" : "text-blekk-dempet"}`}
            >
              {new Date(`${dato}T12:00:00`).toLocaleDateString("nb-NO", {
                weekday: "short",
                day: "numeric",
              })}
            </div>
            {dagens.map((o) => (
              <button
                key={o.id}
                onClick={() => onApne(o.id)}
                title={o.tema ?? undefined}
                className="mt-1 flex w-full items-center gap-1 rounded-[5px] bg-ark px-[5px] py-[3px] text-left text-[10.5px] hover:bg-flate"
              >
                <Fagfirkant farge={o.farge} />
                <b className="font-semibold text-blekk-dempet">{o.fagKode}</b>
                <span className="tabular-nums text-blekk-svak">
                  {o.klokkeslett}
                </span>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Dagens økter (DESIGN.md §10): tida i egen kolonne, fagfirkanten på linje
 * med tittelen, og fag, rom og periode på linja under. Notatet fra forrige
 * økt i faget står under hver økt og kan legges sammen — valget huskes for
 * alle øktene samlet. Boksene i notatet kan krysses av rett her.
 *
 * Ingen oppsummeringssetning over: den gjentok bare det lista sier.
 */
function Dagensokter({
  okter,
  idag,
  onApne,
  onSeUka,
}: {
  okter: Okt[];
  idag: string;
  onApne: (id: string) => void;
  onSeUka: () => void;
}) {
  const d = dagen(okter, idag);
  const [perioder, setPerioder] = useState<Map<string, string>>(new Map());
  const [na, setNa] = useState(() => new Date());

  // Periodenavnene til dagens økter. Få fag, få kall.
  const fagIDag = [...new Set(d.linjer.map((l) => l.okt.skolearFagId))].join();
  useEffect(() => {
    let avbrutt = false;
    void Promise.all(fagIDag.split(",").filter(Boolean).map(hentPerioder)).then(
      (lister) => {
        if (!avbrutt)
          setPerioder(new Map(lister.flat().map((p) => [p.id, p.navn])));
      },
    );
    return () => {
      avbrutt = true;
    };
  }, [fagIDag]);

  // «om 1 t 50 min» skal stemme uten at man laster forsiden på nytt.
  // ↵ åpner økta som pågår, eller den neste i dag (ARBEIDSLISTE 7.5).
  // Bare når ingenting annet har fokus — ikke i et felt eller et åpent kort.
  useEffect(() => {
    const tast = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || harModifikator(e) || e.altKey) return;
      if (document.activeElement && document.activeElement !== document.body)
        return;
      const naMin = new Date().getHours() * 60 + new Date().getMinutes();
      const neste = d.linjer
        .map((l) => okter.find((o) => o.id === l.okt.id)!)
        .find((o) => {
          if (!o.klokkeslett) return true;
          const [t, m] = o.klokkeslett.split(":").map(Number);
          return t * 60 + m + o.varighetMin > naMin;
        });
      if (!neste) return;
      e.preventDefault();
      onApne(neste.id);
    };
    window.addEventListener("keydown", tast);
    return () => window.removeEventListener("keydown", tast);
  });

  useEffect(() => {
    const t = window.setInterval(() => setNa(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <Bolk tittel="Dagens økter" nokkel="forside-dagens">
      {d.linjer.length === 0 ? (
        <IngenIDag
          okter={okter}
          idag={idag}
          onApne={onApne}
          onSeUka={onSeUka}
        />
      ) : (
        <ul className="divide-y divide-linje-medium">
          {d.linjer.map((l) => {
            const okt = okter.find((o) => o.id === l.okt.id)!;
            return (
              <Dagensokt
                key={okt.id}
                okt={okt}
                linje={l}
                periode={
                  okt.periodeId ? perioder.get(okt.periodeId) : undefined
                }
                na={na}
                onApne={onApne}
              />
            );
          })}
        </ul>
      )}
    </Bolk>
  );
}

function Dagensokt({
  okt,
  linje,
  periode,
  na,
  onApne,
}: {
  okt: Okt;
  linje: Dagslinje;
  periode?: string;
  na: Date;
  onApne: (id: string) => void;
}) {
  const slutt = okt.klokkeslett
    ? leggTilMinutter(okt.klokkeslett, okt.varighetMin)
    : null;
  const nar = narTekst(okt.klokkeslett, slutt, na);
  // Fagkoden, ikke fagnavnet (ARBEIDSLISTE 9.4): «MFL2 · Rom 214 · Markedsmiks».
  // Et rom som bare er et nummer, får «Rom» foran.
  const rom = okt.sted && /^\d/.test(okt.sted) ? `Rom ${okt.sted}` : okt.sted;
  const under = [okt.fagKode, rom, periode].filter(Boolean);

  return (
    <li className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-4 py-4">
      <div className="tabular-nums">
        <p className="text-[calc(22px*var(--tekst-skala))] leading-tight">
          {okt.klokkeslett ?? "–"}
        </p>
        {slutt && <p className="text-liten text-blekk-dempet">til {slutt}</p>}
      </div>

      <div className="min-w-0">
        {/*
          Firkanten i egen kolonne, på linje med tittelen, så både tittelen
          og linja under starter på samme sted (DESIGN.md §6).
        */}
        <div className="grid grid-cols-[12px_minmax(0,1fr)_auto] items-baseline gap-x-2.5">
          <Fagfirkant farge={okt.farge} storrelse={12} klasse="self-center" />
          <button
            onClick={() => onApne(okt.id)}
            className="min-w-0 truncate text-left text-tittel font-medium hover:text-aksent"
          >
            {okt.tema || okt.fagNavn}
          </button>
          <span className="flex items-center gap-3">
            {nar && (
              <span className="text-liten tabular-nums text-blekk-dempet">
                {nar}
              </span>
            )}
            <button
              onClick={() => onApne(okt.id)}
              title="Åpne økta (↵)"
              className="flex items-center gap-1.5 rounded-vanlig px-1 py-0.5 text-etikett text-blekk-dempet hover:text-blekk"
            >
              <kbd className="rounded border border-linje bg-ark px-1.5 font-sans leading-4">
                ↵
              </kbd>
              åpne økta
            </button>
          </span>
          <span />
          <p className="col-span-2 truncate text-liten text-blekk-dempet">
            <span className="font-medium text-blekk">{under[0]}</span>
            {under.length > 1 && ` · ${under.slice(1).join(" · ")}`}
          </p>
        </div>

        <div className="ml-[22px] mt-3 max-w-2xl">
          <ForrigeNotat linje={linje} onApne={onApne} />
        </div>
      </div>
    </li>
  );
}

/** Notatet fra forrige økt i faget, som en boks som kan legges sammen. */
function ForrigeNotat({
  linje,
  onApne,
}: {
  linje: Dagslinje;
  onApne: (id: string) => void;
}) {
  const [apen, setApen] = useApen("forside-forrige-notat");
  const { forrige } = linje;
  const [logg, setLogg] = useState(forrige?.logg ?? null);
  useEffect(() => setLogg(forrige?.logg ?? null), [forrige?.logg]);

  if (!forrige) {
    return <p className="text-liten text-blekk-svak">Første økt i faget.</p>;
  }
  const nar = kortDato(forrige.dato);

  if (!logg?.trim()) {
    return (
      <p className="text-liten text-blekk-svak">
        Ingen notat fra forrige økt ({nar}).
      </p>
    );
  }

  return (
    <div className="rounded-stor border border-linje-medium bg-flate-svak px-3 py-2">
      <Sammenleggknapp
        tittel={`Notat fra forrige økt (${nar})`}
        apen={apen}
        onBytt={() => setApen(!apen)}
        etter={apen ? undefined : (linje.notat ?? undefined)}
      />
      {apen && (
        <div className="mt-1.5 pl-3.5">
          <Markdown
            tekst={logg}
            onVekslBoks={(nr) => {
              const ny = vekslBoks(logg, nr);
              setLogg(ny);
              void endreOkt(forrige.id, { logg: ny });
            }}
          />
          <button
            onClick={() => onApne(forrige.id)}
            className="mt-1.5 text-liten text-aksent underline-offset-2 hover:underline"
          >
            Åpne økta {nar.split(" ")[1]}
          </button>
        </div>
      )}
    </div>
  );
}

function leggTilMinutter(kl: string, min: number): string {
  const [t, m] = kl.split(":").map(Number);
  const tot = t * 60 + m + min;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(tot / 60) % 24)}:${p(tot % 60)}`;
}

/** «om 1 t 50 min», «pågår», eller ingenting når økta er over. */
function narTekst(
  fra: string | null,
  til: string | null,
  na: Date,
): string | null {
  if (!fra) return null;
  const naMin = na.getHours() * 60 + na.getMinutes();
  const [ft, fm] = fra.split(":").map(Number);
  const start = ft * 60 + fm;
  if (naMin < start) {
    const igjen = start - naMin;
    const t = Math.floor(igjen / 60);
    const m = igjen % 60;
    return `om ${t > 0 ? `${t} t ` : ""}${m > 0 || t === 0 ? `${m} min` : ""}`.trim();
  }
  if (til) {
    const [tt, tm] = til.split(":").map(Number);
    if (naMin < tt * 60 + tm) return "pågår";
  }
  return null;
}

/** «tor 1.10» */
function kortDato(dato: string): string {
  const d = new Date(`${dato}T00:00:00`);
  const dag = d
    .toLocaleDateString("nb-NO", { weekday: "short" })
    .replace(".", "");
  return `${dag} ${d.getDate()}.${d.getMonth() + 1}`;
}

/** En bolk på forsiden. Legges sammen med et klikk på overskriften. */
function Bolk({
  tittel,
  nokkel,
  children,
}: {
  tittel: string;
  /** husker om bolken er lagt sammen (ui/Sammenleggbar) */
  nokkel: string;
  children: React.ReactNode;
}) {
  const [apen, setApen] = useApen(nokkel);
  if (useContext(IDel)) return <>{children}</>;
  return (
    <section>
      <div
        className={`border-b border-linje-medium pb-1 ${apen ? "mb-1" : ""}`}
      >
        <Sammenleggknapp
          tittel={tittel}
          apen={apen}
          onBytt={() => setApen(!apen)}
        />
      </div>
      <Utfold apen={apen}>{children}</Utfold>
    </section>
  );
}

function isoDato(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function langDato(dato: string): string {
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Tom dag (29.8): når den neste økta er, med en knapp dit. */
function IngenIDag({
  okter,
  idag,
  onApne,
  onSeUka,
}: {
  okter: Okt[];
  idag: string;
  onApne: (id: string) => void;
  onSeUka: () => void;
}) {
  const neste = [...okter]
    .filter((o) => o.dato > idag)
    .sort(
      (a, b) =>
        a.dato.localeCompare(b.dato) ||
        (a.klokkeslett ?? "").localeCompare(b.klokkeslett ?? ""),
    )[0];
  const nar = neste
    ? new Date(`${neste.dato}T12:00:00`).toLocaleDateString("nb-NO", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : null;
  return (
    <Tomside
      tegning="idag"
      tittel="Ingen økter i dag"
      tekst={
        neste
          ? `Neste økt er ${nar}${neste.klokkeslett ? ` kl. ${neste.klokkeslett}` : ""}, ${neste.fagKode}${neste.tema ? `: ${neste.tema}` : ""}.`
          : "Det er ingen flere økter lagt inn dette skoleåret."
      }
      hoved={
        neste
          ? { tekst: "Åpne neste økt", onKlikk: () => onApne(neste.id) }
          : undefined
      }
      sekundar={{ tekst: "Se uka", onKlikk: onSeUka }}
    />
  );
}
