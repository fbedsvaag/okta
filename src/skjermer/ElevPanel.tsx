import { useApen } from "../ui/Sammenleggbar";
import { Plassholder } from "../ui/Elevfoto";
import { Utfold } from "../ui/Utfold";
import { useEffect, useRef, useState } from "react";
import { Tidslinjedato, Tidslinjestrek } from "../ui/Tidslinje";
import { useArk } from "../ui/Arkstabel";
import { Elevbilde } from "../ui/Elevbilde";
import {
  hentElevbilde,
  settElevbilde,
  slettElevbilde,
} from "../data/elevbilde";
import { elevfilFor } from "../data/arkiv";
import { hentSkolear, type Skolear } from "../data/skolear";
import { Vurderingsikon } from "../ui/Vurderingsikon";
import { lyttElever, lyttKlassekart, lyttVurderinger } from "../data/endringer";
import {
  hentElevIKart,
  leggTilRegel,
  slettRegel,
  type ElevIKart,
} from "../data/klassekart";
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
  settKjonn,
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
  Fagfirkant,
  Fagmerke,
  Kontekstmeny,
  Menylinje,
  Menyskille,
  Menyvalg,
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
import {
  fravaer,
  fravaersmerke,
  GRENSE,
  hentFravaersgrunnlag,
  hentOktrader,
  prosent,
  timer,
  type Fagfravaer,
} from "../data/oktrader";
import { lytt } from "../data/endringer";
import { NOYTRAL, skalafarge } from "../ui/farger";
import { Markdownfelt, MarkdownSkriv } from "../ui/Notattekst";
import { hovedtast, harModifikator, tast as visTast } from "../ui/taster";
import { useSisteSvar } from "../ui/sisteSvar";
import { idag as dagensDato } from "../db";

/**
 * Elevkortet, SPEC §4.5 og DESIGN.md §10 (lerretet «ElevArk»).
 *
 * Ett spørsmål: hvordan har det gått med denne eleven i år? Øverst hvem
 * eleven er — bilde, navn, år, klasse og fag. Så innsatsen gjennom året,
 * én linje per fag. Til venstre vurderingene og notatene, til høyre det som
 * er åpent for eleven og fraværet. Navn, klasse, fag og mentor endres i
 * «Rediger» (⌘E); resten av handlingene står bak «⋯».
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
   * eleven fra fagkortet, gjelder «Ta ut av» det faget.
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
  const [bilde, setBilde] = useState<string | null>(null);
  // Bildet tømmes med en gang man blar, og et tregt svar for forrige elev
  // får ikke skrive over (#5): et ansikt skal aldri stå ved feil navn.
  const bildevakt = useSisteSvar();
  useEffect(() => {
    setBilde(null);
    const gjeldende = bildevakt();
    void hentElevbilde(elevId).then((b) => {
      if (gjeldende()) setBilde(b);
    });
  }, [elevId]);
  const [elev, setElev] = useState<ElevGrunnlag | null>(null);
  const [ar, setAr] = useState<ElevAr[]>([]);
  const [skolearene, setSkolearene] = useState<Skolear[]>([]);
  // I år | Alle år (§4.5): inneværende år når kortet åpnes.
  const [alleAr, setAlleAr] = useState(false);
  const [data, setData] = useState<
    {
      skolearId: string;
      fagRader: FagRad[];
      tommeFag: {
        skolearFagId: string;
        fagKode: string;
        farge: string | null;
      }[];
      vurderinger: ElevVurdering[];
    }[]
  >([]);
  const [klasser, setKlasser] = useState<Klasse[]>([]);
  // Alle fagene i året, ikke bare elevens — man må kunne koble til et nytt.
  const [arsFag, setArsFag] = useState<FagIAr[]>([]);
  const [apne, setApne] = useState<Elevnotat[]>([]);
  const [rediger, setRediger] = useState(false);
  const [meny, setMeny] = useState<{ x: number; y: number } | null>(null);
  const [nyttNotat, setNyttNotat] = useState(0);
  const [melding, setMelding] = useState<string | null>(null);
  const bildefelt = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let avbrutt = false;
    (async () => {
      const [g, a, s] = await Promise.all([
        hentElevGrunnlag(elevId),
        hentElevAr(elevId),
        hentSkolear(),
      ]);
      if (avbrutt) return;
      setElev(g);
      setAr(a);
      setSkolearene(s);
    })();
    return () => {
      avbrutt = true;
    };
  }, [elevId]);

  // Årene som vises: inneværende, eller alle eleven har vært i.
  const arene = alleAr
    ? [...ar].sort((a, b) => b.navn.localeCompare(a.navn))
    : ar.filter((a) => a.skolearId === aktivtSkolearId);
  const arIder = arene.map((a) => a.skolearId).join();

  const fagvakt = useSisteSvar();
  async function lastFag() {
    const gjeldende = fagvakt();
    const ider = arIder ? arIder.split(",") : [aktivtSkolearId];
    const ut = await Promise.all(
      ider.map(async (skolearId) => {
        const [h, f, v] = await Promise.all([
          hentHeatmap(elevId, skolearId),
          hentElevFag(elevId, skolearId),
          hentElevVurderinger(elevId, skolearId),
        ]);
        return {
          skolearId,
          fagRader: h,
          tommeFag: f.filter(
            (x) => !h.some((r) => r.skolearFagId === x.skolearFagId),
          ),
          vurderinger: v,
        };
      }),
    );
    const notater = await hentElevnotater(elevId);
    if (!gjeldende()) return;
    setData(ut);
    setApne(notater.filter((n) => n.skalFolgesOpp && n.lukket === null));
  }

  useEffect(() => {
    void lastFag();
    void hentKlasser(aktivtSkolearId).then(setKlasser);
    void hentFagIAr(aktivtSkolearId).then(setArsFag);
  }, [elevId, arIder, aktivtSkolearId]);
  // Et resultat ført i vurderingsarket over kortet, eller et notat lukket,
  // skal stå her når det andre lukkes.
  useEffect(() => lyttVurderinger(() => void lastFag()), [elevId, arIder]);
  useEffect(() => lyttElever(() => void lastFag()), [elevId, arIder]);

  // Esc lukker, ⌘E bytter til redigering, ⌥↑/⌥↓ blar, N og M gir et nytt
  // notat, ⇧⌘E eksporterer. Lytteren legges på én gang og leser de nyeste
  // verdiene fra en ref, som fagRef i App (#13).
  const siste = useRef({ onLukk, eksporter, bla });
  siste.current = { onLukk, eksporter, bla };
  useEffect(() => {
    const tast = (e: KeyboardEvent) => {
      const { onLukk, eksporter, bla } = siste.current;
      const iFelt = (e.target as HTMLElement).closest?.(
        "input, textarea, select, [contenteditable]",
      );
      if (e.key === "Escape" && !iFelt) onLukk();
      if (hovedtast(e) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        if (e.shiftKey) void eksporter();
        else setRediger((r) => !r);
      }
      if (bla && e.altKey && e.key === "ArrowUp") {
        e.preventDefault();
        bla.forrige();
      }
      if (bla && e.altKey && e.key === "ArrowDown") {
        e.preventDefault();
        bla.neste();
      }
      if (!iFelt && !harModifikator(e) && !e.altKey) {
        if (e.key === "n" || e.key === "m") {
          e.preventDefault();
          setNyttNotat((n) => n + 1);
        }
      }
    };
    window.addEventListener("keydown", tast);
    return () => window.removeEventListener("keydown", tast);
  }, []);

  if (!elev) return null;

  const detteAret = ar.find((a) => a.skolearId === aktivtSkolearId);
  const iAr = data.find((d) => d.skolearId === aktivtSkolearId);
  const fagIAr = [
    ...new Map(
      [...(iAr?.fagRader ?? []), ...(iAr?.tommeFag ?? [])].map((f) => [
        f.skolearFagId,
        { id: f.skolearFagId, kode: f.fagKode, farge: f.farge },
      ]),
    ).values(),
  ].sort((a, b) => a.kode.localeCompare(b.kode, "nb-NO"));
  const elevensFagIder = new Set(fagIAr.map((f) => f.id));
  const kontekstfag = arsFag.find((f) => f.id === startFag);

  async function eksporter() {
    const s = skolearene.find((x) => x.id === aktivtSkolearId);
    if (!s || !elev) return;
    const md = await elevfilFor(s, elev.fornavn, elev.etternavn);
    if (!md) return setMelding("Fant ikke eleven i arkivet for året.");
    await navigator.clipboard.writeText(md);
    setMelding("Elevens data er kopiert som markdown.");
  }

  async function slett() {
    if (!elev) return;
    const n = await tellForElev(elevId);
    const hva = [
      n.skaringer && `${n.skaringer} skåringer`,
      n.vurderinger && `${n.vurderinger} vurderingsresultater`,
      n.notater && `${n.notater} notater`,
    ].filter(Boolean);
    const ok = await bekreft(
      `Slette ${elev.fornavn} ${elev.etternavn}?\n\n` +
        (hva.length > 0
          ? `Dette fjerner ${hva.join(", ")}, i alle skoleår, ikke bare dette.\n\n`
          : "Eleven har ingen skåringer eller vurderinger registrert.\n\n") +
        "Sikkerhetskopien fra i dag er veien tilbake.",
    );
    if (!ok) return;
    await slettElevHelt(elevId);
    onLukk();
  }

  return (
    <section
      aria-label={`Elevkort: ${elev.fornavn} ${elev.etternavn}`}
      className={`flex h-full min-h-0 flex-col ${
        bla?.retning ? `flikk-${bla.retning}` : ""
      }`}
    >
      <header className="flex shrink-0 items-center gap-2.5 border-b border-linje-medium px-[22px] py-3 text-[calc(13px*var(--tekst-skala))] text-blekk-dempet">
        <span className="rounded-full bg-flate px-2 py-0.5 text-etikett">
          esc
        </span>
        {bla && bla.av > 1 && (
          <span className="flex items-center gap-1">
            <Ikonknapp
              onClick={bla.forrige}
              tittel={`Forrige elev (${visTast("⌥↑")})`}
            >
              <Ikon navn="opp" />
            </Ikonknapp>
            <span className="tabular-nums text-liten text-blekk-svak">
              {bla.nr} av {bla.av}
            </span>
            <Ikonknapp
              onClick={bla.neste}
              tittel={`Neste elev (${visTast("⌥↓")})`}
            >
              <Ikon navn="ned" />
            </Ikonknapp>
          </span>
        )}
        {melding && (
          <span className="truncate text-aksent">
            <Ikon navn="hake" /> {melding}
          </span>
        )}
        <span className="flex-1" />
        <button
          onClick={() => setRediger((r) => !r)}
          className={`flex h-[30px] items-center gap-[7px] rounded-full border px-[13px] text-[calc(13px*var(--tekst-skala))] ${
            rediger
              ? "border-aksent bg-aksent font-medium text-ark"
              : "border-linje bg-ark text-blekk hover:bg-flate"
          }`}
        >
          {rediger ? "Ferdig" : "Rediger"}
          <span className="text-etikett opacity-60">{visTast("⌘E")}</span>
        </button>
        <button
          aria-label="Mer"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setMeny(meny ? null : { x: r.right - 280, y: r.bottom + 6 });
          }}
          className={`grid h-[30px] w-[30px] place-items-center rounded-full text-blekk-dempet hover:bg-flate ${
            meny ? "bg-flate" : ""
          }`}
        >
          ⋯
        </button>
      </header>

      {meny && (
        <Kontekstmeny x={meny.x} y={meny.y} onLukk={() => setMeny(null)}>
          <Menyvalg onKlikk={() => setNyttNotat((n) => n + 1)}>
            <Menylinje tast="N">Nytt notat</Menylinje>
          </Menyvalg>
          <Menyvalg onKlikk={() => setNyttNotat((n) => n + 1)}>
            <Menylinje tast="M">Ny møtelogg</Menylinje>
          </Menyvalg>
          <Menyvalg onKlikk={() => setRediger(true)}>
            <Menylinje>Legg til i fag…</Menylinje>
          </Menyvalg>
          <Menyskille />
          <Menyvalg onKlikk={() => bildefelt.current?.click()}>
            <Menylinje>{bilde ? "Bytt bilde…" : "Legg til bilde…"}</Menylinje>
          </Menyvalg>
          {bilde && (
            <Menyvalg
              onKlikk={async () => {
                if (
                  !(await bekreft(
                    `Fjerne bildet av ${elev.fornavn}? Det slettes fra basen.`,
                  ))
                )
                  return;
                await slettElevbilde(elevId);
                setBilde(null);
              }}
            >
              <Menylinje>Fjern bildet</Menylinje>
            </Menyvalg>
          )}
          {detteAret?.klasse && (
            <Menyvalg
              onKlikk={async () => {
                const ok = await settMentor(
                  elevId,
                  aktivtSkolearId,
                  !detteAret.mentor,
                );
                if (ok) setAr(await hentElevAr(elevId));
              }}
            >
              <Menylinje>
                {detteAret.mentor ? "Ikke lenger mentorelev" : "Mentorelev"}
              </Menylinje>
            </Menyvalg>
          )}
          <Menyvalg onKlikk={() => setRediger(true)}>
            <Menylinje under={`Nå ${detteAret?.klasse ?? "uten klasse"}`}>
              Bytt klasse…
            </Menylinje>
          </Menyvalg>
          <Menyskille />
          <Menyvalg onKlikk={() => void eksporter()}>
            <Menylinje tast={visTast("⇧⌘E")} under="Innsyn, som markdown">
              Eksporter elevens data
            </Menylinje>
          </Menyvalg>
          <Menyskille />
          {kontekstfag && elevensFagIder.has(kontekstfag.id) && (
            <Menyvalg
              farlig
              onKlikk={async () => {
                const n = await tellSkaringerIFag(elevId, kontekstfag.id);
                if (
                  !(await bekreft(
                    n > 0
                      ? frakobletekst(elev.fornavn, kontekstfag.kode, n)
                      : `Ta ${elev.fornavn} ut av ${kontekstfag.kode}?`,
                  ))
                )
                  return;
                await frakobleFag(elevId, kontekstfag.id);
                await lastFag();
              }}
            >
              <Menylinje>Ta ut av {kontekstfag.kode}</Menylinje>
            </Menyvalg>
          )}
          <Menyvalg farlig onKlikk={() => void slett()}>
            <Menylinje>Slett eleven…</Menylinje>
          </Menyvalg>
        </Kontekstmeny>
      )}

      {/* «Legg til bilde…»: et bilde fra disk, i gråtoner som de fra InSchool. */}
      <input
        ref={bildefelt}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const fil = e.target.files?.[0];
          e.target.value = "";
          if (!fil) return;
          const url = await somGratone(fil);
          await settElevbilde(elevId, url, "Lagt til for hånd");
          setBilde(url);
        }}
      />

      <div className="min-h-0 flex-1 overflow-auto px-[30px] pb-[30px] pt-[22px]">
        {/* Identitet */}
        <div className="flex items-start gap-5">
          {bilde ? (
            <Elevbilde src={bilde} storrelse={76} hjorne={38} alt="" />
          ) : (
            <Plassholder storrelse={76} kjonn={elev.kjonn} />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              {rediger ? (
                <span className="flex flex-wrap items-baseline gap-2">
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
                </span>
              ) : (
                <h1 className="text-[calc(32px*var(--tekst-skala))] font-light leading-[1.15] tracking-overskrift">
                  {elev.fornavn} {elev.etternavn}
                </h1>
              )}
              {detteAret?.mentor && (
                <span className="inline-flex h-6 items-center rounded-full bg-flate px-[9px] text-etikett font-medium text-aksent">
                  Mentorelev
                </span>
              )}
            </div>

            {/* År, klasse og fag — inneværende år først, fjorårene i grått. */}
            <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[calc(13.5px*var(--tekst-skala))] text-blekk">
              <b className="font-semibold">
                {skolearene.find((s) => s.id === aktivtSkolearId)?.navn}
              </b>
              {detteAret?.klasse && <> · {detteAret.klasse}</>}
              {fagIAr.map((f) => (
                <span key={f.id} className="inline-flex items-center gap-1">
                  · <Fagfirkant farge={f.farge} /> {f.kode}
                </span>
              ))}
            </p>
            {ar
              .filter((a) => a.skolearId !== aktivtSkolearId)
              .map((a) => (
                <p
                  key={a.skolearId}
                  className="mt-0.5 text-[calc(12.5px*var(--tekst-skala))] text-blekk-svak"
                >
                  {a.navn}
                  {a.klasse && ` · ${a.klasse}`}
                </p>
              ))}

            {/*
              Kjønn (SPEC §4.11) står alltid (10.5): også når det er tomt,
              ellers fikk elever fra før migrasjon 024 aldri valget.
              Gjettet vises stiplet, så det kan bekreftes med ett klikk.
            */}
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <span className="text-[calc(12.5px*var(--tekst-skala))] text-blekk-dempet">
                Kjønn
              </span>
              <Bryter
                storrelse="liten"
                usikker={elev.kjonnKilde === "gjettet"}
                verdi={elev.kjonn ?? "ingen"}
                settVerdi={async (v) => {
                  await settKjonn(elevId, v === "j" || v === "g" ? v : null);
                  setElev(await hentElevGrunnlag(elevId));
                }}
                valg={[
                  { id: "j", navn: "Jente" },
                  { id: "g", navn: "Gutt" },
                  { id: "ingen", navn: "Ikke satt" },
                ]}
              />
              <span
                className={`text-[calc(12px*var(--tekst-skala))] ${
                  elev.kjonnKilde === "gjettet"
                    ? "text-varsel"
                    : "text-blekk-svak"
                }`}
              >
                {elev.kjonnKilde === "gjettet"
                  ? "Gjettet fra fornavnet ved import. Klikk for å bekrefte."
                  : elev.kjonn
                    ? "Brukes bare til klassekartet"
                    : "Ikke satt: velg for at klassekartet kan blande"}
              </span>
            </div>

            {rediger && (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-stor bg-flate-svak px-3 py-2.5 text-liten">
                <span className="flex items-center gap-2">
                  <span className="text-blekk-dempet">Klasse</span>
                  <Klassevelger
                    klasser={klasser}
                    valgt={detteAret?.klasse ?? null}
                    onVelg={async (klasseId) => {
                      await settKlasse(elevId, aktivtSkolearId, klasseId);
                      setAr(await hentElevAr(elevId));
                    }}
                    onNy={async (navn) => {
                      const id = await finnEllerOpprettKlasse(
                        aktivtSkolearId,
                        navn,
                      );
                      await settKlasse(elevId, aktivtSkolearId, id);
                      setKlasser(await hentKlasser(aktivtSkolearId));
                      setAr(await hentElevAr(elevId));
                    }}
                  />
                </span>
                {/*
                  Mentormerket henger på klassen (§3.2). Uten klasse er det
                  ingen rad å merke, og da er boksen av.
                */}
                <label
                  className={`flex select-none items-center gap-1.5 ${
                    detteAret?.klasse ? "" : "text-blekk-svakest"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={detteAret?.mentor ?? false}
                    disabled={!detteAret?.klasse}
                    onChange={async (e) => {
                      const ok = await settMentor(
                        elevId,
                        aktivtSkolearId,
                        e.target.checked,
                      );
                      if (ok) setAr(await hentElevAr(elevId));
                    }}
                  />
                  Mentorelev
                </label>
                {/*
                  Frakobling rører aldri skåringene — de blir liggende, og
                  kobler du til igjen kommer de tilbake.
                */}
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-blekk-dempet">Fag</span>
                  {arsFag.map((f) => {
                    const har = elevensFagIder.has(f.id);
                    return (
                      <label
                        key={f.id}
                        title={
                          har ? `Koble fra ${f.kode}` : `Koble til ${f.kode}`
                        }
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
                {elev.kode && (
                  <span className="font-mono text-etikett text-blekk-svak">
                    {elev.kode}
                  </span>
                )}
              </div>
            )}
          </div>
          {ar.length > 1 && (
            <Bryter
              storrelse="liten"
              verdi={alleAr ? "alle" : "iar"}
              settVerdi={(v) => setAlleAr(v === "alle")}
              valg={[
                { id: "iar", navn: "I år" },
                { id: "alle", navn: "Alle år" },
              ]}
            />
          )}
        </div>

        {/* Innsats gjennom året, i full bredde. */}
        <section className="mt-[26px]">
          <div className="flex flex-wrap items-center gap-3 border-b border-linje-medium pb-2">
            <h2 className="text-[calc(13px*var(--tekst-skala))] font-semibold">
              Innsats gjennom året
            </h2>
            <span className="flex-1" />
            <Tegnforklaring />
          </div>
          {data.map((d) => {
            const s = skolearene.find((x) => x.id === d.skolearId);
            if (!s) return null;
            return (
              <div key={d.skolearId}>
                {alleAr && (
                  <p className="pt-3 text-etikett font-semibold text-blekk-dempet">
                    {s.navn}
                  </p>
                )}
                {d.fagRader.length === 0 && d.tommeFag.length === 0 ? (
                  <Stille>Eleven har ingen fag dette skoleåret.</Stille>
                ) : (
                  d.fagRader.map((rad) => (
                    <Innsatslinje
                      key={rad.skolearFagId}
                      rad={rad}
                      skolear={s}
                      onApneOkt={onApneOkt}
                    />
                  ))
                )}
              </div>
            );
          })}
        </section>

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_250px]">
          <div className="min-w-0">
            <div className="flex items-center gap-3 border-b border-linje-medium pb-2">
              <h2 className="text-[calc(13px*var(--tekst-skala))] font-semibold">
                Vurderinger
              </h2>
            </div>
            {data.every((d) => d.vurderinger.length === 0) && (
              <Stille>Ingen vurderinger i fagene hens ennå.</Stille>
            )}
            {data.flatMap((d) =>
              [...new Set(d.vurderinger.map((v) => v.skolearFagId))].map(
                (fagId) => {
                  const vs = d.vurderinger.filter(
                    (v) => v.skolearFagId === fagId,
                  );
                  const f =
                    d.fagRader.find((r) => r.skolearFagId === fagId) ??
                    d.tommeFag.find((r) => r.skolearFagId === fagId);
                  return (
                    <div
                      key={`${d.skolearId}-${fagId}`}
                      className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-3.5 pb-1.5 pt-3.5"
                    >
                      <span className="flex h-5 items-center gap-[7px] text-[calc(13.5px*var(--tekst-skala))] font-semibold">
                        <Fagfirkant farge={f?.farge ?? null} />
                        {vs[0].fagKode}
                      </span>
                      <div className="mt-2">
                        {vs.map((v) => (
                          <Vurderingsrad
                            key={v.vurderingId}
                            v={v}
                            onApne={() => ark.apneVurdering(v.vurderingId)}
                            onSamtaler={() =>
                              ark.gaTil("samtaler", v.skolearFagId)
                            }
                          />
                        ))}
                      </div>
                    </div>
                  );
                },
              ),
            )}

            <div className="mt-4">
              <Motelogg
                elevId={elev.id}
                skolearId={aktivtSkolearId}
                nyttNotat={nyttNotat}
              />
            </div>
          </div>

          <aside className="flex flex-col gap-[22px]">
            {apne.length > 0 && (
              <div className="rounded-xl bg-flate px-3.5 py-3.5">
                <h2 className="mb-2 text-[calc(13px*var(--tekst-skala))] font-semibold">
                  Åpent for {elev.fornavn}
                </h2>
                {apne.map((n) => (
                  <label
                    key={n.id}
                    className="flex items-baseline gap-2 py-[3px] text-liten"
                  >
                    <input
                      type="checkbox"
                      onChange={async () => {
                        await settLukket(n.id, true);
                        await lastFag();
                      }}
                      className="translate-y-0.5 accent-[var(--color-aksent)]"
                    />
                    <span>
                      {forsteLinje(n.tekst)}{" "}
                      {n.frist && (
                        <span
                          className={`text-etikett ${
                            n.frist <= idagIso()
                              ? "text-feil"
                              : "text-blekk-dempet"
                          }`}
                        >
                          {n.frist === idagIso() ? "i dag" : kortDato(n.frist)}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            )}
            <Klassekartboks elevId={elevId} skolearId={aktivtSkolearId} />
            <Fravaersboks
              elevId={elevId}
              skolearId={aktivtSkolearId}
              fag={fagIAr}
            />
          </aside>
        </div>
      </div>

      <footer className="shrink-0 whitespace-nowrap border-t border-linje-medium px-[30px] py-[9px] text-right text-[calc(11.5px*var(--tekst-skala))] text-blekk-svak">
        Kjønn og bilde vises bare her og går aldri ut av appen.
      </footer>
    </section>
  );
}

/**
 * Hvor eleven sitter (lerretet «ElevArk»): kartet og rommet, hvem eleven
 * sitter ved, låsen — og «Kan ikke sitte med», som kan endres her.
 */
function Klassekartboks({
  elevId,
  skolearId,
}: {
  elevId: string;
  skolearId: string;
}) {
  const [kart, setKart] = useState<ElevIKart[]>([]);
  const [legger, setLegger] = useState<string | null>(null);
  const last = () => void hentElevIKart(elevId, skolearId).then(setKart);
  useEffect(last, [elevId, skolearId]);
  useEffect(() => lyttKlassekart(last), [elevId, skolearId]);
  if (kart.length === 0) return null;
  const kort = (e: { fornavn: string; etternavn: string }) =>
    `${e.fornavn} ${e.etternavn.charAt(0)}.`;
  return (
    <div>
      <h2 className="mb-2 text-[calc(13px*var(--tekst-skala))] font-semibold">
        Klassekart
      </h2>
      {kart.map((k) => (
        <div key={k.kartId} className="mb-3 last:mb-0">
          <p className="text-liten leading-[1.6] text-blekk">
            {k.kildeNavn}
            {k.romNavn && ` · ${k.romNavn}`}
            {k.plass === null ? (
              <>
                <br />
                <span className="text-blekk-dempet">
                  Kartet er ikke brukt ennå
                </span>
              </>
            ) : (
              <>
                {k.sitterVed.length > 0 && (
                  <>
                    <br />
                    <span className="text-blekk-dempet">Sitter ved</span>{" "}
                    {k.sitterVed.map(kort).join(", ")}
                  </>
                )}
                {k.last && (
                  <>
                    <br />
                    <span className="text-blekk-dempet">Låst til</span>{" "}
                    {k.rad === 1 ? "første rad" : `rad ${k.rad}`}
                  </>
                )}
              </>
            )}
          </p>
          <p className="mt-2 text-etikett text-blekk-dempet">
            Kan ikke sitte med:
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {k.regler.map((r) => (
              <span
                key={r.id}
                className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-flate px-2.5 text-[calc(12.5px*var(--tekst-skala))]"
              >
                {kort(r.andre)}
                <button
                  aria-label={`Fjern ${r.andre.fornavn}`}
                  onClick={() => void slettRegel(r.id)}
                  className="text-blekk-svak hover:text-feil"
                >
                  ×
                </button>
              </span>
            ))}
            {legger === k.kartId ? (
              <select
                autoFocus
                defaultValue=""
                onBlur={() => setLegger(null)}
                onChange={async (e) => {
                  if (e.target.value)
                    await leggTilRegel(
                      k.kildeType,
                      k.kildeId,
                      elevId,
                      e.target.value,
                    );
                  setLegger(null);
                }}
                className="h-[26px] rounded-full border border-linje bg-ark px-2 text-[calc(12.5px*var(--tekst-skala))]"
              >
                <option value="">Velg elev</option>
                {k.medelever
                  .filter((m) => !k.regler.some((r) => r.andre.id === m.id))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fornavn} {m.etternavn}
                    </option>
                  ))}
              </select>
            ) : (
              <button
                onClick={() => setLegger(k.kartId)}
                className="inline-flex h-[26px] items-center rounded-full px-2.5 text-[calc(12.5px*var(--tekst-skala))] text-blekk-dempet shadow-[inset_0_0_0_1px_var(--color-linje)] hover:text-blekk"
              >
                + Legg til
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Tegnforklaringen over innsatsen. */
function Tegnforklaring() {
  const rute = (bg: string, kant = false) => (
    <span
      className="h-2 w-2 rounded-[2px]"
      style={{
        background: bg,
        boxShadow: kant ? "inset 0 0 0 1px var(--color-linje)" : undefined,
      }}
    />
  );
  return (
    <span className="flex flex-wrap gap-2.5 text-[calc(11.5px*var(--tekst-skala))] text-blekk-dempet">
      <span className="inline-flex items-center gap-[5px]">
        {rute(skalafarge("gronn"))}Grønn
      </span>
      <span className="inline-flex items-center gap-[5px]">
        {rute(skalafarge("gul"))}Gul
      </span>
      <span className="inline-flex items-center gap-[5px]">
        {rute(skalafarge("rod"))}Rød
      </span>
      <span className="inline-flex items-center gap-[5px]">
        {rute(NOYTRAL)}Ikke i økta
      </span>
      <span className="inline-flex items-center gap-[5px]">
        {rute("transparent", true)}Kommer
      </span>
    </span>
  );
}

/**
 * Én linje per fag (DESIGN.md §10): hele skoleåret, aug–jun, uke for uke i
 * felles kolonner (19 px per uke), så fagene står under hverandre. Én rute
 * per økt (8 px), opptil to i en uke. Kommende økter er tomme ruter med
 * tynn kant; en økt som er holdt uten at eleven er skåret, er et hull.
 * Inneværende måned er uthevet.
 */
function Innsatslinje({
  rad,
  skolear,
  onApneOkt,
}: {
  rad: FagRad;
  skolear: Skolear;
  onApneOkt: (oktId: string) => void;
}) {
  const idag = idagIso();
  const maneder = manederIAret(skolear.start, skolear.slutt);
  const perUke = new Map<string, HeatmapRute[]>();
  for (const r of rad.ruter) {
    const m = mandag(r.dato);
    perUke.set(m, [...(perUke.get(m) ?? []), r]);
  }
  return (
    <div className="grid grid-cols-[64px_minmax(0,1fr)] items-start gap-x-3.5 pb-1 pt-3">
      <span className="flex h-[9px] items-center gap-[7px] text-[calc(13.5px*var(--tekst-skala))] font-semibold">
        <Fagfirkant farge={rad.farge} />
        {rad.fagKode}
      </span>
      <div className="flex gap-[5px] overflow-x-auto">
        {maneder.map((m) => {
          const naa = idag.slice(0, 7) === m.maned;
          return (
            <span key={m.maned} className="flex flex-col gap-1">
              <span className="flex gap-[1.5px]">
                {m.uker.map((u) => (
                  <span key={u} className="flex w-[17.5px] gap-[1.5px]">
                    {(perUke.get(u) ?? []).slice(0, 2).map((r) => (
                      <Innsatsrute
                        key={r.oktId}
                        rute={r}
                        idag={idag}
                        onKlikk={() => onApneOkt(r.oktId)}
                      />
                    ))}
                  </span>
                ))}
              </span>
              <span
                className={`text-[calc(10px*var(--tekst-skala))] ${
                  naa ? "font-semibold text-aksent" : "text-blekk-svak"
                }`}
              >
                {m.navn}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Innsatsrute({
  rute,
  idag,
  onKlikk,
}: {
  rute: HeatmapRute;
  idag: string;
  onKlikk: () => void;
}) {
  const kommer = rute.avholdt === 0 && rute.dato >= idag;
  const avholdt = rute.avholdt > 0;
  const ikkeIOkta =
    rute.tellerIkke === 1 || (avholdt && rute.verdiKode === null);
  const tittel = [
    kortDato(rute.dato),
    rute.tema,
    kommer
      ? "kommer"
      : !avholdt
        ? "ikke holdt"
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
      className="h-2 w-2 rounded-[2px]"
      style={{
        background: kommer
          ? "transparent"
          : !avholdt
            ? "transparent"
            : ikkeIOkta
              ? NOYTRAL
              : rute.verdiFarge
                ? skalafarge(rute.verdiFarge)
                : NOYTRAL,
        boxShadow: kommer ? "inset 0 0 0 1px var(--color-linje)" : undefined,
      }}
    />
  );
}

/**
 * En vurdering på elevkortet: ikon, tittel og kommentar, dato og resultat.
 * En kommende muntlig vurdering har gyllen strek og en vei til Samtaler.
 */
function Vurderingsrad({
  v,
  onApne,
  onSamtaler,
}: {
  v: ElevVurdering;
  onApne: () => void;
  onSamtaler: () => void;
}) {
  const type = (v.type as "muntlig" | "skriftlig" | "praktisk" | null) ?? null;
  const kommende = !v.resultat && !!v.frist && v.frist >= idagIso();
  const gull = kommende && type === "muntlig";
  return (
    <div
      className={`grid grid-cols-[16px_minmax(0,1fr)_56px_minmax(0,120px)] items-center gap-x-2.5 border-b border-linje-svak py-2.5 ${
        gull ? "-mx-2.5 rounded-md bg-vurdering-flate px-2.5" : ""
      }`}
      style={
        gull ? { boxShadow: "inset 3px 0 0 var(--color-vurdering)" } : undefined
      }
    >
      <Vurderingsikon type={type} />
      <button onClick={onApne} className="min-w-0 text-left">
        <span
          className={`block truncate hover:underline ${gull ? "font-semibold" : "font-medium"}`}
        >
          {v.tittel}
        </span>
        {v.kommentar && (
          <span className="block truncate text-etikett text-blekk-dempet">
            {v.kommentar}
          </span>
        )}
      </button>
      <span
        className={`text-etikett tabular-nums ${gull ? "text-vurdering-tekst" : "text-blekk-dempet"}`}
      >
        {v.frist ? kortDato(v.frist) : ""}
      </span>
      {gull ? (
        <button
          onClick={onSamtaler}
          className="whitespace-nowrap text-right text-[calc(12.5px*var(--tekst-skala))] font-medium text-vurdering-tekst hover:underline"
        >
          Åpne i <i>Samtaler</i> →
        </button>
      ) : (
        <span className="text-right font-semibold tabular-nums">
          {v.resultat ?? (
            <span className="font-normal text-blekk-svakest">
              {v.levert === 1 ? "levert" : "–"}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

/** Månedene i skoleåret, med mandagene som hører til hver. */
function manederIAret(
  start: string,
  slutt: string,
): { maned: string; navn: string; uker: string[] }[] {
  const ut: { maned: string; navn: string; uker: string[] }[] = [];
  let m = mandag(start);
  while (m <= slutt) {
    const maned = m.slice(0, 7);
    let siste = ut[ut.length - 1];
    if (!siste || siste.maned !== maned) {
      siste = {
        maned,
        navn: new Date(`${m}T00:00:00`)
          .toLocaleDateString("nb-NO", { month: "short" })
          .replace(/\.$/, ""),
        uker: [],
      };
      ut.push(siste);
    }
    siste.uker.push(m);
    const d = new Date(`${m}T00:00:00`);
    d.setDate(d.getDate() + 7);
    m = iso(d);
  }
  return ut;
}

function mandag(dato: string): string {
  const d = new Date(`${dato}T00:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
}

function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function idagIso(): string {
  return iso(new Date());
}

/** «24.9» */
function kortDato(dato: string): string {
  const d = new Date(`${dato}T00:00:00`);
  return `${d.getDate()}.${d.getMonth() + 1}`;
}

/** Første linje av et notat, uten listetegn. */
function forsteLinje(tekst: string): string {
  return (
    tekst
      .split("\n")
      .map((l) => l.replace(/^\s*([-*+]|\d+\.)\s+(\[[ xX]\]\s+)?/, "").trim())
      .find(Boolean) ?? ""
  );
}

/** Et bilde fra disk, i gråtoner og beskåret til et kvadrat, som JPEG. */
async function somGratone(fil: File): Promise<string> {
  const url = URL.createObjectURL(fil);
  try {
    const bilde = new Image();
    bilde.src = url;
    await bilde.decode();
    const side = Math.min(bilde.width, bilde.height, 480);
    const lerret = document.createElement("canvas");
    lerret.width = lerret.height = side;
    const g = lerret.getContext("2d")!;
    const kilde = Math.min(bilde.width, bilde.height);
    g.filter = "grayscale(1)";
    g.drawImage(
      bilde,
      (bilde.width - kilde) / 2,
      Math.max(0, (bilde.height - kilde) * 0.3),
      kilde,
      kilde,
      0,
      0,
      side,
      side,
    );
    return lerret.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
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
            className="flex items-baseline gap-1.5 text-brod font-semibold text-blekk hover:text-blekk-dempet"
          >
            <span
              aria-hidden
              className={`inline-block transition-transform duration-150 ${apen ? "rotate-90" : ""}`}
            >
              ›
            </span>
            {tittel}
            {!apen && sammenlagt.etikett && (
              <span className="font-normal text-blekk-svak">
                {sammenlagt.etikett}
              </span>
            )}
          </button>
        ) : (
          <h3 className="text-brod font-semibold text-blekk">{tittel}</h3>
        )}
        {handling && <span className="ml-auto">{handling}</span>}
      </div>
      <Utfold apen={apen}>{children}</Utfold>
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
  nyttNotat = 0,
}: {
  elevId: string;
  skolearId: string;
  /** øker når N, M eller ⋯-menyen ber om et nytt notat */
  nyttNotat?: number;
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
  const idag = dagensDato();
  const ark = useArk();

  const vakt = useSisteSvar();
  async function last() {
    const gjeldende = vakt();
    const [n, o] = await Promise.all([
      hentElevnotater(elevId),
      hentOktnotater(elevId),
    ]);
    if (!gjeldende()) return;
    setNotater(n);
    setOktnotater(o);
  }

  useEffect(() => {
    void last();
  }, [elevId]);
  // Et notat skrevet i en økt over kortet, skal stå her når økta lukkes.
  useEffect(() => lyttElever(() => void last()), [elevId]);

  useEffect(() => {
    if (nyttNotat === 0) return;
    settApen(true);
    setSkriver(true);
  }, [nyttNotat]);

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
          Ingen notater ennå. Her samles det du vil huske om eleven over tid:
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
 * Et notat fra skåringen i en økt. Merket er fagfirkanten (DESIGN.md §10);
 * skåringen står som en liten prikk ved kilden, så tidslinja fortsatt viser
 * hvordan timen gikk. Fag og tema åpner økta.
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

      <Tidslinjestrek sist={sist} fag={notat.fagFarge} />

      <div className="min-w-0 flex-1 pb-4">
        <div className="flex items-baseline gap-2 text-liten">
          <button
            onClick={onApneOkt}
            className="flex min-w-0 items-baseline gap-2 text-left hover:text-aksent"
          >
            <span className="shrink-0 rounded-liten bg-flate px-1.5 text-blekk-dempet">
              Økt
            </span>
            {notat.farge && (
              <span
                title={notat.verdi ?? undefined}
                className="h-2 w-2 shrink-0 self-center rounded-full"
                style={{ background: skalafarge(notat.farge) }}
              />
            )}
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

  return (
    <div className="flex gap-3">
      {/* Datoen er det man leter etter i en logg, så den står for seg. */}
      <Tidslinjedato dato={notat.dato} />

      {/*
        Møteloggen har lilla prikk (DESIGN.md §10). Et forfalt
        oppfølgingspunkt er rødt, så det synes når man skumleser.
      */}
      <Tidslinjestrek
        sist={sist}
        farge={forfalt ? "var(--color-feil)" : "var(--color-aksent)"}
      />

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
  const [dato, setDato] = useState(dagensDato());
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
        className={`rounded-vanlig border border-transparent px-1 py-0 text-[calc(30px*var(--tekst-skala))] font-light leading-tight tracking-overskrift outline-none hover:border-linje focus:border-aksent ${
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

/**
 * «Fravær i år» (ARBEIDSLISTE 11.7, lerretet «ElevArk»): én rad per fag med
 * prosent av fagets timer, en stolpe mot 10 %-grensen, «9 av 24 økter ·
 * 15,8 t» og merket (Halvveis, Nær grensen, Over grensen). Fraværet er
 * «ikke i økta» i avholdte økter, i timer mot fagets årstimetall.
 */
function Fravaersboks({
  elevId,
  skolearId,
  fag,
}: {
  elevId: string;
  skolearId: string;
  fag: { id: string; kode: string; farge: string | null }[];
}) {
  const [liste, setListe] = useState<Fagfravaer[] | null>(null);
  useEffect(() => {
    let avbrutt = false;
    const last = () =>
      void Promise.all([
        hentOktrader(skolearId),
        hentFravaersgrunnlag(skolearId),
      ]).then(([rader, grunnlag]) => {
        if (!avbrutt) setListe(fravaer(rader, elevId, grunnlag));
      });
    last();
    const slutt = lytt(last);
    return () => {
      avbrutt = true;
      slutt();
    };
  }, [elevId, skolearId]);

  const rader = (liste ?? [])
    .map((f) => ({ f, fag: fag.find((x) => x.id === f.skolearFagId) }))
    .filter((x) => x.fag)
    .sort((a, b) => (b.f.andel ?? 0) - (a.f.andel ?? 0));

  return (
    <div>
      <h2 className="mb-1 text-[calc(13px*var(--tekst-skala))] font-semibold">
        Fravær i år
      </h2>
      <p className="mb-1 text-[calc(12px*var(--tekst-skala))] text-blekk-svak">
        mot 10 %-grensen per fag
      </p>
      {liste !== null && rader.length === 0 && (
        <p className="text-liten text-blekk-svak">Ingen økter er holdt ennå.</p>
      )}
      {rader.map(({ f, fag: x }) => {
        const avGrensen = f.andel === null ? 0 : f.andel / GRENSE;
        const merke = fravaersmerke(f.andel);
        const farge =
          avGrensen > 1
            ? "var(--color-lys-rod)"
            : avGrensen >= 0.5
              ? "var(--color-lys-gul)"
              : "var(--color-blekk-svak)";
        return (
          <div key={f.skolearFagId} className="py-1.5">
            <div className="flex items-center gap-[7px] text-[calc(13px*var(--tekst-skala))]">
              <Fagfirkant farge={x!.farge} />
              <b className="font-semibold">{x!.kode}</b>
              <span className="flex-1" />
              <b
                className={`font-semibold tabular-nums ${avGrensen > 1 ? "text-feil" : ""}`}
              >
                {f.andel === null ? "–" : prosent(f.andel)}
              </b>
            </div>
            <div className="relative mb-1 mt-1.5 h-1.5 rounded-[3px] bg-flate">
              <span
                className="absolute inset-y-0 left-0 rounded-[3px]"
                style={{
                  width: `${Math.min(100, avGrensen * 100)}%`,
                  background: farge,
                }}
              />
            </div>
            <div className="flex text-[calc(12px*var(--tekst-skala))] text-blekk-dempet">
              <span className="tabular-nums">
                {f.borte} av {f.okter} økter · {timer(f.borteMin)}
              </span>
              <span className="flex-1" />
              {merke && (
                <span
                  className={merke.niva === "rod" ? "text-feil" : "text-varsel"}
                >
                  {merke.tekst}
                </span>
              )}
            </div>
          </div>
        );
      })}
      {rader.length > 0 && (
        <p className="mt-1.5 text-[calc(11.5px*var(--tekst-skala))] leading-[1.45] text-blekk-svak">
          Udokumentert fravær over 10 % av timene i faget kan gi IV. InSchool er
          fasit; her regnes «ikke i økta».
        </p>
      )}
    </div>
  );
}
