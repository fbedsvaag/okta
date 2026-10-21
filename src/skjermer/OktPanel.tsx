import { useEffect, useRef, useState } from "react";
import { Elevfoto } from "../ui/Elevfoto";
import { Bryter, Fagfirkant } from "../ui/felles";
import {
  borteSist,
  lesPlan,
  narTekst,
  standardModus,
  type Oktmodus,
} from "../data/oktplan";
import { kortDag } from "../data/fagside";
import { OktPlanlegging } from "./OktPlanlegging";
import { Tastestripe, Tasthint } from "../ui/Tastestripe";
import { Markdown, Markdownfelt } from "../ui/Notattekst";
import { useArk } from "../ui/Arkstabel";
import { hentKart } from "../data/klassekart";
import { visFraKateteret } from "./KlassekartKart";
import { hentPerioder, type Periode } from "../data/perioder";
import {
  endreOkt,
  hentForrigeOkt,
  fjernSkaring,
  hentOktElever,
  hentSkaringsskala,
  settSkaring,
  settSkaringsnotat,
  type Okt,
  type OktElev,
} from "../data/okter";
import { taster, type Skalaverdi } from "../skala";
import { fagfarge, skalafarge } from "../ui/farger";
import { hovedtast, harModifikator, tast as visTast } from "../ui/taster";
import { Kladdfelt } from "./Okttekst";
import { Liveplan, Nalinje, useMinutt, visesLive } from "./Oktlive";
import { usePlanvisning } from "./Oktplan";
import { hentOktrader } from "../data/oktrader";
import { visToast } from "../ui/Toast";
import { Skarprikk, slagFraVerdi } from "../ui/Skarprikk";

/**
 * Økta som ark, SPEC §4.4 og DESIGN.md §10 (lerretet «OktArk»).
 *
 * Et ark over skjermen du kom fra, ikke full skjerm. Topp med fag, tittel og
 * «Pågår · n min igjen»; elevlista med skåringen til venstre; fra forrige
 * økt, planen og øktloggen til høyre; tastene i en stripe nederst. Esc
 * lukker og alt er lagret, ⌘↵ = Ferdig. Øktas øvrige felter står bak
 * «Detaljer».
 *
 * Her skårer du. Tastene utledes av skalaen (§5), ikke hardkodet.
 */
export function OktPanel({
  okt,
  skolearId,
  fagOkter,
  startModus,
  onLukk,
  onEndret,
  onApneElev,
  onVisIOkter,
  onForrige,
  onNeste,
}: {
  okt: Okt;
  skolearId: string;
  /** øktene i faget, i rekkefølge — til perioden og blaingen */
  fagOkter: Okt[];
  /** fra I dag: skåring. Ellers etter tidspunktet (11.3). */
  startModus?: Oktmodus;
  onLukk: () => void;
  onEndret: () => void;
  onApneElev: (elevId: string) => void;
  onVisIOkter: () => void;
  /** ⌘← / ⌘→: forrige og neste økt i faget */
  onForrige?: () => void;
  onNeste?: () => void;
}) {
  // Eleven som nettopp fikk en verdi: prikken hans «popper» (DESIGN.md §8).
  const [sistSatt, setSistSatt] = useState<string | null>(null);
  // Klassekartet til faget, til lenken i toppen: se om alle sitter riktig.
  const [kartId, setKartId] = useState<string | null>(null);
  useEffect(() => {
    void hentKart(skolearId).then((k) =>
      setKartId(
        k.find((x) => x.kildeType === "fag" && x.kildeId === okt.skolearFagId)
          ?.id ?? null,
      ),
    );
  }, [skolearId, okt.skolearFagId]);
  // To moduser i samme ark (11.3): skåring og logg, eller planlegging.
  const [modus, setModus] = useState<Oktmodus>(
    () => startModus ?? standardModus(okt, new Date()),
  );
  const [periode, setPeriode] = useState<Periode | null>(null);
  useEffect(() => {
    if (!okt.periodeId) return setPeriode(null);
    void hentPerioder(okt.skolearFagId).then((p) =>
      setPeriode(p.find((x) => x.id === okt.periodeId) ?? null),
    );
  }, [okt.periodeId, okt.skolearFagId]);
  // Klokka, én gang i minuttet (15.6): «Pågår · n min igjen», stripa og
  // avkrysningen i planen.
  const na = useMinutt();
  const pagar = minIgjen(okt, na);
  const visning = usePlanvisning();
  // Full, den dagen økta er: planen som loddrett tidslinje (OktLiveVertikal).
  const loddrett =
    visning === "full" &&
    visesLive(okt, na) &&
    lesPlan(okt.plan).punkter.length > 0;

  // ⌘↵ = Ferdig, også fra et felt i arket. ⌘← / ⌘→ blar til forrige og
  // neste økt i faget, men ikke i et felt — der flytter de markøren.
  useEffect(() => {
    const tast = (e: KeyboardEvent) => {
      if (e.key === "Enter" && hovedtast(e)) {
        e.preventDefault();
        ferdigRef.current();
        return;
      }
      if (!hovedtast(e) || e.shiftKey || e.altKey) return;
      if ((e.target as HTMLElement).closest?.("input, textarea, select"))
        return;
      if (e.key === "ArrowLeft" && onForrige) {
        e.preventDefault();
        onForrige();
      }
      if (e.key === "ArrowRight" && onNeste) {
        e.preventDefault();
        onNeste();
      }
    };
    window.addEventListener("keydown", tast);
    return () => window.removeEventListener("keydown", tast);
  }, [onLukk, onForrige, onNeste]);
  const ark = useArk();
  const ferdigRef = useRef(() => {});
  const [elever, setElever] = useState<OktElev[]>([]);
  const [verdier, setVerdier] = useState<Skalaverdi[]>([]);
  const [markert, setMarkert] = useState(0);
  const [notatFor, setNotatFor] = useState<string | null>(null);
  const liste = useRef<HTMLDivElement>(null);
  const markertRad = useRef<HTMLDivElement>(null);

  /**
   * Ruller den markerte raden inn i synsfeltet.
   *
   * `block: "nearest"` gjør at det bare skjer når raden faktisk er utenfor —
   * står den midt på skjermen, rører ingenting seg. Det er forskjellen på en
   * rolig liste og en som hopper ved hvert tastetrykk.
   *
   * Myk rulling med mindre systemet ber om mindre bevegelse. Skåringen kan gå
   * fort, og en animasjon som ikke rekker å bli ferdig før neste tastetrykk
   * skal avbrytes, ikke stables opp.
   */
  useEffect(() => {
    const rad = markertRad.current;
    if (!rad) return;
    const rolig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rad.scrollIntoView({
      block: "nearest",
      behavior: rolig ? "auto" : "smooth",
    });
  }, [markert]);

  useEffect(() => {
    let avbrutt = false;
    (async () => {
      const [e, v] = await Promise.all([
        hentOktElever(okt.id, okt.skolearFagId),
        hentSkaringsskala(okt.skolearFagId),
      ]);
      if (avbrutt) return;
      setElever(e);
      setVerdier(v);
      setMarkert(0);
      liste.current?.focus();
    })();
    return () => {
      avbrutt = true;
    };
  }, [okt.id, okt.skolearFagId]);

  const tastekart = taster(verdier);
  /**
   * Plottet har fast rekkefølge (DESIGN.md §9): verdiene stigende, og
   * «ingenting her» (rang 0) til slutt — rød · gul · grønn · ikke i økta.
   * Formen bærer ikke betydningen lenger, så plassen må gjøre det.
   */
  const plott = [...verdier].sort(
    (a, b) =>
      (a.rang === 0 ? 1 : 0) - (b.rang === 0 ? 1 : 0) || a.rang - b.rang,
  );
  /** tast -> skalaverdi, slik at 0–3 slår opp riktig verdi for denne skalaen */
  const fraTast = new Map(
    verdier.map((v) => [tastekart.get(v.id) ?? "", v] as const),
  );

  /** Økta er avholdt så snart minst én elev er skåret (§3.3). */
  const avholdt = elever.some((e) => e.skalaverdiId !== null);
  const nullverdi = verdier.find((v) => v.rang === 0) ?? null;
  const antallSkaret = elever.filter((e) => e.skalaverdiId !== null).length;

  // Alle · Til stede · Borte · Ikke sett over lista (16.1, 19.4). Huskes
  // ikke mellom økter. «Borte» er verdien som ikke teller («ikke i økta»,
  // teller_ikke). «Ikke sett» er til stede, men ikke skåret.
  const [filter, setFilter] = useState<Filter>("alle");
  useEffect(() => {
    setFilter(startfilter ?? "alle");
    startfilter = null;
  }, [okt.id]);
  const borteverdi = verdier.find((v) => v.teller_ikke === 1) ?? null;
  const erBorte = (e: OktElev) =>
    borteverdi !== null && e.skalaverdiId === borteverdi.id;
  const antallBorte = elever.filter(erBorte).length;
  const antallIkkeSett = elever.length - antallSkaret;

  /**
   * Ferdig (19.4): er noen ikke skåret i en avholdt økt, sier en rolig
   * linje fra at de regnes som til stede, med vei tilbake til dem. Ingen
   * dialog som stopper.
   */
  function ferdig() {
    if (antallSkaret > 0 && antallIkkeSett > 0)
      visToast(
        `${antallIkkeSett} ${antallIkkeSett === 1 ? "elev er" : "elever er"} ikke skåret · regnes som til stede`,
        {
          handling: {
            tekst: "Vis",
            onKlikk: () => {
              startfilter = "ikkesett";
              ark.apneOkt(okt.id, "skaring");
            },
          },
        },
      );
    onLukk();
  }
  ferdigRef.current = ferdig;
  /** Indeksene i `elever` som vises med filteret. */
  const synlige = elever
    .map((_, i) => i)
    .filter((i) =>
      filter === "alle"
        ? true
        : filter === "borte"
          ? erBorte(elever[i])
          : filter === "ikkesett"
            ? elever[i].skalaverdiId === null
            : !erBorte(elever[i]),
    );
  const nesteSynlige = (fra: number, retning: 1 | -1) => {
    const pos = synlige.indexOf(fra);
    if (pos < 0) return synlige[0] ?? fra;
    return synlige[Math.max(0, Math.min(synlige.length - 1, pos + retning))];
  };
  // Står markøren på en elev som er filtrert bort, flyttes den til første
  // som vises.
  useEffect(() => {
    if (synlige.length && !synlige.includes(markert)) setMarkert(synlige[0]);
  }, [filter, synlige.join(",")]);

  async function skaar(indeks: number, verdi: Skalaverdi) {
    const elev = elever[indeks];
    if (!elev) return;

    setElever((f) =>
      f.map((e, i) => (i === indeks ? { ...e, skalaverdiId: verdi.id } : e)),
    );
    setSistSatt(elev.elevId);
    setMarkert(nesteSynlige(indeks, 1));

    await settSkaring(elev.elevId, okt.id, verdi.id);
    onEndret();
  }

  async function fjern(indeks: number) {
    const elev = elever[indeks];
    if (!elev) return;

    // Ingen bekreftelse her, med vilje. ⌫ ligger midt i skåringsflyten, og
    // et spørsmål per tastetrykk ville ødelagt hele poenget. Handlingen er
    // ett tastetrykk å gjenta, og raden viser med en gang hva som skjedde.
    setElever((f) =>
      f.map((e, i) => (i === indeks ? { ...e, skalaverdiId: null } : e)),
    );
    await fjernSkaring(elev.elevId, okt.id);
    onEndret();
  }

  function tastetrykk(e: React.KeyboardEvent) {
    if (notatFor !== null) return;
    // ⌘-snarveiene (⌘K søk, ⌘[ tilbake) hører til appen, ikke lista.
    if (harModifikator(e)) return;

    if (e.key === "Escape") {
      onLukk();
      return;
    }
    if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      setMarkert((i) => nesteSynlige(i, 1));
      return;
    }
    if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
      e.preventDefault();
      setMarkert((i) => nesteSynlige(i, -1));
      return;
    }
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      void fjern(markert);
      return;
    }
    // B: bare de som var borte (B igjen: alle). A: alle (16.1).
    if (e.key.toLowerCase() === "b") {
      e.preventDefault();
      setFilter((f) => (f === "borte" ? "alle" : "borte"));
      return;
    }
    if (e.key.toLowerCase() === "a") {
      e.preventDefault();
      setFilter("alle");
      return;
    }
    if (e.key.toLowerCase() === "n") {
      e.preventDefault();
      setNotatFor(elever[markert]?.elevId ?? null);
      return;
    }

    const verdi = fraTast.get(e.key);
    if (verdi) {
      e.preventDefault();
      void skaar(markert, verdi);
    }
  }

  return (
    <section
      aria-label={`Økt: ${okt.tema || okt.fagNavn}`}
      className="flex h-full min-h-0 flex-col"
    >
      <header className="shrink-0 border-b border-linje-medium px-[26px] pb-[18px] pt-[26px]">
        <div className="flex min-w-0 items-center gap-3">
          <Fagfirkant farge={okt.farge} storrelse={12} />
          <span
            className="shrink-0 text-[calc(15px*var(--tekst-skala))] font-semibold"
            style={{ color: okt.farge ? fagfarge(okt.farge) : undefined }}
          >
            {okt.fagKode}
          </span>
          <h1 className="min-w-0 truncate text-[calc(28px*var(--tekst-skala))] font-light leading-tight tracking-overskrift">
            {okt.tema || okt.fagNavn}
          </h1>
          <span className="flex-1" />
          {pagar !== null ? (
            // Uten pulserende prikk: skåringen animeres aldri (§13).
            <span className="inline-flex shrink-0 items-center rounded-full bg-flate px-2.5 py-1 text-[calc(12.5px*var(--tekst-skala))] font-medium tabular-nums text-aksent">
              Pågår · {pagar} min igjen
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-flate px-2.5 py-1 text-[calc(12.5px*var(--tekst-skala))] text-aksent">
              {narTekst(okt, na)}
            </span>
          )}
          <span className="shrink-0 rounded-full bg-flate px-2 py-0.5 text-etikett text-blekk-dempet">
            esc
          </span>
          <button
            onClick={ferdig}
            className="flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-aksent px-3 text-[calc(13px*var(--tekst-skala))] font-medium text-ark hover:bg-aksent-mork"
          >
            Ferdig{" "}
            <span className="text-[10.5px] opacity-70">{visTast("⌘↵")}</span>
          </button>
        </div>
        <div className="mt-2 flex items-center gap-3 pl-[24px]">
          <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 text-[calc(13px*var(--tekst-skala))] text-blekk-dempet">
            <span className="first-letter:uppercase">{langDato(okt.dato)}</span>
            {okt.klokkeslett && (
              <>
                ·
                <span className="tabular-nums">
                  {okt.klokkeslett}–
                  {sluttKlokke(okt.klokkeslett, okt.varighetMin)}
                </span>
              </>
            )}
            {okt.sted && (
              <>
                ·{" "}
                <span>
                  {/^\d/.test(okt.sted) ? `Rom ${okt.sted}` : okt.sted}
                </span>
              </>
            )}
            {periode && (
              <>
                ·
                <span className="inline-flex items-center gap-[5px]">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background: periode.farge ?? "var(--color-linje-sterk)",
                    }}
                  />
                  {periode.navn}
                </span>
              </>
            )}
            {kartId && (
              <>
                ·
                <button
                  onClick={() => {
                    visFraKateteret(kartId, okt.dato);
                    ark.gaTil("klassekart", kartId);
                  }}
                  title="Se kartet fra kateteret"
                  className="text-blekk-dempet underline-offset-2 hover:text-blekk hover:underline"
                >
                  Klassekart →
                </button>
              </>
            )}
          </p>
          <Bryter
            storrelse="liten"
            verdi={modus}
            settVerdi={(v) => setModus(v as Oktmodus)}
            valg={[
              { id: "skaring", navn: "Skåring og logg" },
              { id: "plan", navn: "Planlegging" },
            ]}
          />
        </div>
      </header>

      {modus === "plan" ? (
        <OktPlanlegging
          okt={okt}
          skolearId={skolearId}
          fagOkter={fagOkter}
          periode={periode}
          onEndret={onEndret}
          onLukk={onLukk}
          onVisIOkter={onVisIOkter}
        />
      ) : (
        <>
          {/* Live tidslinje under arkhodet, den dagen økta er (15.6). */}
          {/* Enkel: én linje om hva som skjer nå (15.10). Full viser det i
              planen til høyre, som loddrett tidslinje. */}
          {visning === "enkel" && visesLive(okt, na) && (
            <Nalinje okt={okt} na={na} />
          )}
          <div className="flex min-h-0 flex-1">
            <div
              ref={liste}
              tabIndex={0}
              onKeyDown={tastetrykk}
              aria-label="Elevliste: skår med talltastene"
              className="uten-fokusring min-w-0 flex-1 overflow-auto px-[22px] pt-3 outline-none"
            >
              <div className="flex items-center gap-3 border-b border-linje pb-2.5">
                <span className="text-[calc(13px*var(--tekst-skala))] font-semibold">
                  Elever
                </span>
                {/* Alle · Til stede · Borte (16.1), tastene A og B. */}
                {borteverdi && elever.length > 0 && (
                  <Bryter
                    storrelse="liten"
                    verdi={filter}
                    settVerdi={(v) => {
                      setFilter(v as typeof filter);
                      liste.current?.focus();
                    }}
                    valg={[
                      { id: "alle", navn: `Alle ${elever.length}` },
                      {
                        id: "tilstede",
                        navn: `Til stede ${elever.length - antallBorte}`,
                      },
                      {
                        id: "borte",
                        navn: (
                          <span className="inline-flex items-center gap-1.5">
                            <Skarprikk slag="o" storrelse={9} />
                            Borte {antallBorte}
                          </span>
                        ),
                      },
                      // Bare når økta er i gang: før det er alle «ikke sett».
                      ...(antallSkaret > 0
                        ? [
                            {
                              id: "ikkesett",
                              navn: (
                                <span className="inline-flex items-center gap-1.5">
                                  <Skarprikk slag="t" storrelse={9} />
                                  Ikke sett {antallIkkeSett}
                                </span>
                              ),
                            },
                          ]
                        : []),
                    ]}
                  />
                )}
                {/* Fremdrift, ikke statistikk (DESIGN.md §12): hvor mange som er skåret. */}
                <span className="text-etikett tabular-nums text-blekk-dempet">
                  {antallSkaret} av {elever.length} skåret
                </span>
                <span className="h-1 w-[120px] overflow-hidden rounded-sm bg-stripe">
                  <span
                    className="block h-full rounded-sm bg-aksent transition-[width] duration-[var(--tid-inn)]"
                    style={{
                      width: `${elever.length ? (antallSkaret / elever.length) * 100 : 0}%`,
                    }}
                  />
                </span>
                <span className="ml-auto text-etikett text-blekk-svak">
                  Alfabetisk på fornavn
                </span>
              </div>

              {filter === "borte" && (
                <div className="mt-2 flex items-center gap-2.5 rounded-[10px] bg-flate-svak px-3 py-2 text-[calc(13px*var(--tekst-skala))] text-blekk-dempet">
                  <span>
                    {antallBorte === 0
                      ? "Ingen var borte i økta."
                      : `${antallBorte} ${antallBorte === 1 ? "elev" : "elever"} var ikke i økta ${langDato(okt.dato)}${
                          okt.klokkeslett
                            ? `, ${okt.klokkeslett}–${sluttKlokke(okt.klokkeslett, okt.varighetMin)}`
                            : ""
                        }.`}
                  </span>
                  {antallBorte > 0 && (
                    <button
                      onClick={() => {
                        void navigator.clipboard.writeText(
                          elever
                            .filter(erBorte)
                            .map((e) => `${e.fornavn} ${e.etternavn}`)
                            .join("\n"),
                        );
                        liste.current?.focus();
                      }}
                      className="ml-auto h-[26px] shrink-0 rounded-full border border-linje bg-ark px-3 text-[calc(12.5px*var(--tekst-skala))] text-blekk hover:bg-flate"
                    >
                      Kopier navnene
                    </button>
                  )}
                </div>
              )}

              {elever.length === 0 && (
                <p className="px-5 py-6 text-center text-brod text-blekk-dempet">
                  Ingen elever er koblet til {okt.fagKode} ennå. Legg dem inn
                  under Elever, så dukker de opp her, også i økter som allerede
                  er skåret.
                </p>
              )}

              <div className="relative">
                {/*
              Markøren er én flate som glir til neste elev (DESIGN.md §8),
              ikke en bakgrunn som hopper. Skåringen venter aldri på den.
            */}
                {elever.length > 0 && (
                  <div
                    aria-hidden
                    className="markor-flate pointer-events-none absolute inset-x-0 top-0 z-0 h-[38px] rounded-lg"
                    style={{
                      transform: `translateY(${Math.max(0, synlige.indexOf(markert)) * RAD}px)`,
                    }}
                  />
                )}
                {synlige
                  .map((i) => elever[i])
                  .map((elev, k) => {
                    const i = synlige[k];
                    return (
                      <ElevRad
                        key={elev.elevId}
                        elev={elev}
                        verdier={plott}
                        tastekart={tastekart}
                        markert={i === markert}
                        radRef={i === markert ? markertRad : undefined}
                        avholdt={avholdt}
                        nullverdi={nullverdi}
                        pop={sistSatt === elev.elevId}
                        onKlikk={() => {
                          setMarkert(i);
                          liste.current?.focus();
                        }}
                        onVelg={(v) => skaar(i, v)}
                        onNotat={() => setNotatFor(elev.elevId)}
                        skriverNotat={notatFor === elev.elevId}
                        onNotatFerdig={async (tekst) => {
                          if (tekst !== null) {
                            await settSkaringsnotat(elev.elevId, okt.id, tekst);
                            setElever((f) =>
                              f.map((e) =>
                                e.elevId === elev.elevId
                                  ? { ...e, notat: tekst.trim() || null }
                                  : e,
                              ),
                            );
                          }
                          setNotatFor(null);
                          liste.current?.focus();
                        }}
                        onApneElev={() => onApneElev(elev.elevId)}
                      />
                    );
                  })}
              </div>
              <div className="h-4" />
            </div>

            <aside
              className={`flex ${loddrett ? "w-[360px]" : "w-80"} shrink-0 flex-col gap-[22px] overflow-auto border-l border-linje-medium bg-flate-svak/70 px-[22px] py-[18px]`}
            >
              {/* Mens økta pågår, tar den loddrette planen plassen. */}
              {/* Hvem som var borte forrige gang, alle sammen. */}
              <BorteSist
                okt={okt}
                skolearId={skolearId}
                elever={elever}
                onVelg={(elevId) => {
                  const i = elever.findIndex((e) => e.elevId === elevId);
                  if (i >= 0) {
                    setFilter("alle");
                    setMarkert(i);
                    liste.current?.focus();
                  }
                }}
              />
              {!loddrett && <Forrigenotat okt={okt} />}
              <Liveplan
                okt={okt}
                na={na}
                loddrett={loddrett}
                onLagre={async (plan) => {
                  await endreOkt(okt.id, { plan });
                  onEndret();
                }}
                onApnePlan={() => setModus("plan")}
              />
              {/* Kladden vises også her, så lappen står foran deg i økta (16.7). */}
              <div>
                <p className="mb-2 text-etikett font-semibold text-blekk">
                  Kladd
                </p>
                <Kladdfelt
                  kompakt
                  verdi={okt.kladd}
                  onLagre={async (v) => {
                    await endreOkt(okt.id, { kladd: v });
                    onEndret();
                  }}
                />
              </div>
              <div className="flex min-h-[200px] flex-1 flex-col">
                <p className="mb-2 text-etikett font-semibold text-blekk">
                  Øktlogg
                </p>
                <Markdownfelt
                  key={`logg-${okt.id}`}
                  verdi={okt.logg}
                  minRader={6}
                  plassholder="Hvordan gikk det? - [ ] blir et gjøremål på I dag."
                  onLagre={async (v) => {
                    await endreOkt(okt.id, { logg: v });
                    onEndret();
                  }}
                />
              </div>
            </aside>
          </div>

          <Tastestripe
            id="skaring"
            klasse="shrink-0 justify-start gap-4 px-[22px]"
          >
            <Tasthint
              taster={plott
                .filter((v) => v.rang > 0)
                .map((v) => tastekart.get(v.id) ?? "")}
            >
              {plott
                .filter((v) => v.rang > 0)
                .map((v) => v.kode.toLowerCase())
                .join(" · ")}
            </Tasthint>
            {nullverdi && (
              <Tasthint taster={[tastekart.get(nullverdi.id) ?? "0"]}>
                {nullverdi.kode.toLowerCase()}
              </Tasthint>
            )}
            <Tasthint taster={["↑", "↓"]}>flytt</Tasthint>
            <Tasthint taster={["N"]}>notat</Tasthint>
            <Tasthint taster={["⌫"]}>fjern</Tasthint>
            <span className="ml-auto">
              <Tasthint taster={["esc"]}>lukk, alt er lagret</Tasthint>
            </span>
          </Tastestripe>
        </>
      )}
    </section>
  );
}

/** Radhøyden i skåringslista (DESIGN.md §3: 38 px med 28 px bilde). */
const RAD = 38;

type Filter = "alle" | "tilstede" | "borte" | "ikkesett";

/** Filteret økta skal åpne med, satt av «Vis» i Ferdig-linja (19.4). */
let startfilter: Filter | null = null;

function sluttKlokke(kl: string, min: number): string {
  const [t, m] = kl.split(":").map(Number);
  const tot = t * 60 + m + min;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(tot / 60) % 24)}:${p(tot % 60)}`;
}

function ElevRad({
  elev,
  verdier,
  tastekart,
  markert,
  radRef,
  avholdt,
  nullverdi,
  pop,
  onKlikk,
  onVelg,
  onNotat,
  skriverNotat,
  onNotatFerdig,
  onApneElev,
}: {
  elev: OktElev;
  verdier: Skalaverdi[];
  tastekart: Map<string, string>;
  markert: boolean;
  /** settes bare på den markerte raden, så autoscrollen vet hvor den er */
  radRef?: React.RefObject<HTMLDivElement | null>;
  avholdt: boolean;
  nullverdi: Skalaverdi | null;
  /** verdien ble nettopp satt: prikken «popper» */
  pop: boolean;
  onKlikk: () => void;
  onVelg: (v: Skalaverdi) => void;
  onNotat: () => void;
  /** notatfeltet er åpent i denne raden (N) */
  skriverNotat: boolean;
  /** null = avbrutt */
  onNotatFerdig: (tekst: string | null) => void;
  onApneElev: () => void;
}) {
  // Er økta avholdt, har alle en verdi. De du ikke har trykket på er 0 (§3.3).
  const visesSom =
    elev.skalaverdiId ?? (avholdt ? (nullverdi?.id ?? null) : null);
  const eksplisitt = elev.skalaverdiId !== null;
  // Borte (16.8, variant B): den fjerde prikken blir mørk med kryss og
  // ring, trafikklyset dempes, og navn og bilde blekes. Raden står der den
  // står, uten merkelapp.
  const borte =
    eksplisitt &&
    verdier.find((v) => v.id === elev.skalaverdiId)?.teller_ikke === 1;

  return (
    <div
      ref={radRef}
      onClick={onKlikk}
      // 38 px rader med 28 px bilde (DESIGN.md §3, bestemt 06.10). Høyden
      // er låst, så heller ikke notatfeltet i raden kan gjøre den høyere.
      className="group relative z-[1] grid h-[38px] cursor-default grid-cols-[132px_28px_minmax(150px,220px)_44px_minmax(0,1fr)] items-center gap-x-3 border-b border-linje-svak pl-2.5 text-[calc(13.5px*var(--tekst-skala))] hover:bg-[color-mix(in_srgb,var(--color-aksent)_3.5%,transparent)]"
    >
      {/*
        Trafikklyset først (11.4), så blikket ikke må hoppe fra navnet og
        ut til høyre kant. Fast rekkefølge: rød · gul · grønn · ikke i økta.
      */}
      <div className="flex gap-1">
        {verdier.map((v) => (
          <Merke
            key={v.id}
            verdi={v}
            valgt={visesSom === v.id}
            eksplisitt={eksplisitt}
            borte={borte}
            pop={pop && visesSom === v.id}
            tast={tastekart.get(v.id)}
            onVelg={(e) => {
              e.stopPropagation();
              onVelg(v);
            }}
          />
        ))}
      </div>
      <span
        className="inline-flex"
        style={borte ? { opacity: 0.4, filter: "grayscale(1)" } : undefined}
      >
        <Elevfoto elevId={elev.elevId} storrelse={28} />
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onApneElev();
        }}
        title={`${elev.fornavn} ${elev.etternavn}: åpne eleven`}
        className={`truncate text-left hover:text-aksent ${
          borte
            ? "text-blekk-svak"
            : eksplisitt || markert
              ? "font-medium"
              : "text-blekk-dempet"
        }`}
      >
        {elev.fornavn} {elev.etternavn}
      </button>

      <span className="truncate text-etikett text-blekk-dempet">
        {elev.klasse ?? ""}
      </span>

      {/*
        Notatet fra denne økta, i egen kolonne. N åpner feltet rett i raden.
        Står markøren på en elev uten notat, vises forrige notat i grått —
        det man skrev sist er ofte det man trenger å huske nå.
      */}
      {skriverNotat ? (
        <Notatfelt start={elev.notat ?? ""} onFerdig={onNotatFerdig} />
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNotat();
          }}
          title={
            elev.notat ??
            (elev.forrigeNotat
              ? `Forrige økt: ${elev.forrigeNotat}`
              : "Legg til notat (N)")
          }
          className="min-w-0 truncate text-left text-[calc(12.5px*var(--tekst-skala))]"
        >
          {elev.notat ? (
            <span className="text-blekk">{elev.notat}</span>
          ) : markert && elev.forrigeNotat ? (
            <span className="italic text-blekk-svak">{elev.forrigeNotat}</span>
          ) : (
            <span className="text-blekk-svakest opacity-0 group-hover:opacity-100">
              + notat
            </span>
          )}
        </button>
      )}
    </div>
  );
}

/**
 * Helfylt sirkel i verdiens farge (DESIGN.md §9). Valgt verdi står i full
 * styrke, de andre er nesten usynlige. En verdi som nettopp ble satt,
 * «popper» kort (§8). En verdi som bare er fylt ut ved visning — eleven
 * er ikke trykket på — tegnes som ikke skåret: ingenting valgt.
 */
function Merke({
  verdi,
  valgt,
  eksplisitt,
  borte,
  pop,
  tast,
  onVelg,
}: {
  verdi: Skalaverdi;
  valgt: boolean;
  eksplisitt: boolean;
  /** eleven er satt som borte: de andre prikkene dempes mer */
  borte: boolean;
  pop: boolean;
  tast?: string;
  onVelg: (e: React.MouseEvent) => void;
}) {
  const farge = skalafarge(verdi.farge);
  const pa = valgt && eksplisitt;
  // Borte: mørk prikk med hvitt kryss og en ring, så den ikke kan
  // forveksles med «ikke skåret ennå» (fire lyse prikker).
  if (pa && verdi.teller_ikke === 1)
    return (
      <button
        onClick={onVelg}
        title={`${tast ? `${tast}: ` : ""}${verdi.kode}${verdi.etikett ? `: ${verdi.etikett}` : ""}`}
        className="grid h-6 w-7 place-items-center rounded-md"
      >
        <span
          className={`rounded-full shadow-[0_0_0_2px_var(--color-ark),0_0_0_3.5px_var(--color-borte)] ${
            pop ? "pop" : ""
          }`}
        >
          <Skarprikk slag="o" storrelse={13} />
        </span>
      </button>
    );

  return (
    <button
      onClick={onVelg}
      title={`${tast ? `${tast}: ` : ""}${verdi.kode}${verdi.etikett ? `: ${verdi.etikett}` : ""}`}
      className={`grid h-6 w-7 place-items-center rounded-md ${
        pa
          ? ""
          : borte
            ? "opacity-15 hover:bg-bord hover:opacity-70"
            : "opacity-20 hover:bg-bord hover:opacity-70"
      }`}
    >
      <span className={pa && pop ? "pop" : ""}>
        <Skarprikk
          slag={slagFraVerdi(verdi)}
          farge={
            verdi.farge && !["gronn", "gul", "rod"].includes(verdi.farge)
              ? farge
              : undefined
          }
          storrelse={pa ? 15 : 13}
        />
      </span>
    </button>
  );
}

/**
 * Det du skrev i loggen forrige gang i faget, rett over dagens logg — så
 * beskjeden fra sist står der du er når timen begynner.
 */
function Forrigenotat({ okt }: { okt: Okt }) {
  const [forrige, setForrige] = useState<Awaited<
    ReturnType<typeof hentForrigeOkt>
  > | null>(null);
  const ark = useArk();
  useEffect(() => {
    void hentForrigeOkt(okt).then(setForrige);
  }, [okt.id, okt.dato, okt.klokkeslett]);

  if (!forrige) return null;

  return (
    <div className="mb-3">
      <button
        onClick={() => ark.apneOkt(forrige.id)}
        className="mb-1.5 block text-left text-[calc(13px*var(--tekst-skala))] font-semibold text-blekk hover:underline"
      >
        Fra forrige økt
        <span className="font-normal text-blekk-svak">
          {" "}
          · {kortDag(forrige.dato)}
        </span>
      </button>
      {forrige.logg?.trim() ? (
        <div className="text-[calc(13.5px*var(--tekst-skala))] text-blekk">
          <Markdown tekst={forrige.logg} />
        </div>
      ) : (
        <p className="text-liten text-blekk-svak">
          Du skrev ikke noe notat forrige økt.
        </p>
      )}
    </div>
  );
}

/**
 * Notatfeltet i raden. Én linje, samme høyde som raden: Enter lagrer, Esc
 * angrer. Tom tekst fjerner notatet.
 */
function Notatfelt({
  start,
  onFerdig,
}: {
  start: string;
  onFerdig: (tekst: string | null) => void;
}) {
  const [tekst, setTekst] = useState(start);
  // Esc og Enter flytter fokus tilbake til lista, og da mister feltet
  // fokus. Uten vakta ville blur-en lagre teksten man nettopp angret.
  const ferdig = useRef(false);
  const avslutt = (t: string | null) => {
    if (ferdig.current) return;
    ferdig.current = true;
    onFerdig(t);
  };
  return (
    <input
      autoFocus
      value={tekst}
      placeholder="Notat: Enter lagrer, Esc angrer"
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setTekst(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") avslutt(null);
        if (e.key === "Enter") avslutt(tekst);
      }}
      onBlur={() => avslutt(tekst)}
      className="h-5 min-w-0 flex-1 rounded-vanlig border border-aksent bg-ark px-1.5 text-liten outline-none placeholder:text-blekk-svak"
    />
  );
}

export function langDato(dato: string): string {
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Minutter igjen av økta, når den pågår nå; ellers null. */
function minIgjen(okt: Okt, na: Date): number | null {
  if (!okt.klokkeslett) return null;
  const idag = `${na.getFullYear()}-${String(na.getMonth() + 1).padStart(2, "0")}-${String(na.getDate()).padStart(2, "0")}`;
  if (okt.dato !== idag) return null;
  const [t, m] = okt.klokkeslett.split(":").map(Number);
  const start = t * 60 + m;
  const naMin = na.getHours() * 60 + na.getMinutes();
  const slutt = start + okt.varighetMin;
  return naMin >= start && naMin < slutt ? slutt - naMin : null;
}

/**
 * «Borte sist»: alle elevene som var «ikke i økta» i forrige avholdte økt i
 * faget (ikke skåret er ikke borte, 19.4),
 * uten tak og uansett hva annet som gjelder dem. Bare fornavn (etternavnets
 * forbokstav når to har samme), fordi økta kan stå på skjerm i klasserommet.
 */
function BorteSist({
  okt,
  skolearId,
  elever,
  onVelg,
}: {
  okt: Okt;
  skolearId: string;
  elever: OktElev[];
  onVelg: (elevId: string) => void;
}) {
  const [sist, setSist] = useState<ReturnType<typeof borteSist>>(null);
  useEffect(() => {
    let avbrutt = false;
    void hentOktrader(skolearId).then((r) => {
      if (!avbrutt) setSist(borteSist(r, okt));
    });
    return () => {
      avbrutt = true;
    };
  }, [okt.id, okt.dato, okt.klokkeslett, skolearId]);
  if (!sist) return null;

  const hvem = sist.elevIder
    .map((id) => elever.find((e) => e.elevId === id))
    .filter((e): e is OktElev => !!e)
    .sort((a, b) => a.fornavn.localeCompare(b.fornavn, "nb-NO"));
  const navn = (e: OktElev) =>
    elever.filter((x) => x.fornavn === e.fornavn).length > 1
      ? `${e.fornavn} ${e.etternavn.charAt(0)}.`
      : e.fornavn;
  const dag = new Date(`${sist.dato}T12:00:00`).toLocaleDateString("nb-NO", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
  });

  return (
    <div>
      <p className="mb-2 text-etikett font-semibold text-blekk">
        Borte sist
        <span className="font-normal text-blekk-svak">
          {" "}
          · {dag}
          {hvem.length > 0 && ` · ${hvem.length}`}
        </span>
      </p>
      {hvem.length === 0 ? (
        <p className="text-liten text-blekk-svak">Alle var til stede.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {hvem.map((e) => (
            <button
              key={e.elevId}
              onClick={() => onVelg(e.elevId)}
              title={`${e.fornavn} ${e.etternavn}: vis i lista`}
              className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-ark px-2.5 text-[calc(12.5px*var(--tekst-skala))] shadow-[inset_0_0_0_1px_var(--color-linje)] hover:shadow-[inset_0_0_0_1px_var(--color-aksent)]"
            >
              <Skarprikk slag="o" storrelse={9} />
              {navn(e)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
