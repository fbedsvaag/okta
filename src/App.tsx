import { createPortal } from "react-dom";
import { useSveip } from "./ui/sveip";
import { hentKart, type Kart } from "./data/klassekart";
import { lyttElever, lyttKlassekart } from "./data/endringer";
import { Klassekart } from "./skjermer/Klassekart";
import { brukTema } from "./ui/tema";
import { brukGlass } from "./ui/glass";
import { brukPalett } from "./ui/palett";
import { brukBevegelse } from "./ui/bevegelse";
import { ukenummer } from "./data/kalender";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  brukTekstskala,
  hentAktivtSkolear,
  type Skolear,
} from "./data/skolear";
import { daglingKopi } from "./data/sikkerhetskopi";
import {
  erPa as kalenderPa,
  start as startKalender,
} from "./data/kalenderfeed";
import { startAuto as startCaldav } from "./data/caldav";
import { skrivArkiv, skrivArkivTilBackup } from "./data/arkiv";
import { hentFagIAr, type FagIAr } from "./data/fag";
import {
  grupperTrekninger,
  hentSamtaledager,
  type Trekning,
} from "./data/samtale";
import { Verktoylinjespor } from "./ui/Verktoylinje";
import { hentVurderinger } from "./data/vurderinger";
import { Veiviser } from "./skjermer/Veiviser";
import { IDag } from "./skjermer/IDag";
import { Fag } from "./skjermer/Fag";
import { Elever } from "./skjermer/Elever";
import { Aret } from "./skjermer/Aret";
import { LimInn } from "./skjermer/LimInn";
import { Okter } from "./skjermer/Okter";
import { Skoleruta } from "./skjermer/Skoleruta";
import { Skolekalender } from "./skjermer/Skolekalender";
import { Innstillinger } from "./skjermer/Innstillinger";
import { Vurderinger } from "./skjermer/Vurderinger";
import { Samtaler } from "./skjermer/Samtaler";
import { Samtaleoversikt } from "./skjermer/Samtaleoversikt";
import { ElevPanel } from "./skjermer/ElevPanel";
import { FagPanel } from "./skjermer/FagPanel";
import { Bryter, Fagfirkant, Knapp, Ikon } from "./ui/felles";
import { Fagoversikt } from "./skjermer/Fagoversikt";
import { useApnetOppsettfil } from "./ui/apnetOppsettfil";
import { G_SNARVEIER, Sidemeny, type Menypunkt } from "./ui/Sidemeny";
import { Sokevindu } from "./ui/Sokevindu";
import { ArkKobling, Arkstabel, type ArkApi } from "./ui/Arkstabel";
import { brukZoom, zoomInn, zoomNull, zoomUt } from "./ui/zoom";
import { hovedtast, harModifikator, tast as visTast } from "./ui/taster";
import { useIdag } from "./ui/useIdag";
import { Toaster } from "./ui/Toast";

/**
 * Et sted i historikken.
 *
 * `id` er tingen visningen skal åpne — en økt, et fag eller en elev, alt
 * etter hvilken skjerm det er. Feltet het `okt` da det bare fantes økter.
 */
type Sted = { visning: Visning; id: string | null };

type Visning =
  | "idag"
  | "skoleruta"
  | "kalender"
  | "fag"
  /** ett fag over hele bredden — der «Fag i år» i sidemenyen åpner */
  | "fagside"
  | "elever"
  /** én elev over hele skjermen, uten lista — der søket åpner */
  | "elev"
  | "okter"
  /** fagsiden: Oversikt i Økter når et fag er valgt (11.2) */
  | "oversikt"
  /** skoleåret i faget (20.6) */
  | "aret"
  | "vurderinger"
  | "samtaler"
  | "innstillinger"
  | "liminn"
  /** oversikten; id = kart, eller «rom:<id>» / «rom:ny» for rom-editoren */
  | "klassekart";

export default function App() {
  const [skolear, setSkolear] = useState<Skolear | null>(null);
  const [fag, setFag] = useState<FagIAr[]>([]);
  // Lytteren for ⌘1–9 står fast; den leser fagene herfra.
  const fagRef = useRef<FagIAr[]>([]);
  fagRef.current = fag;
  const [laster, setLaster] = useState(true);
  const [feil, setFeil] = useState<string | null>(null);
  const [melding, setMelding] = useState<string | null>(null);
  const [versjon, setVersjon] = useState(0);
  // Dagens dato, som skifter over midnatt (#4, #5).
  const dag = useIdag();
  // Faget Økter står filtrert på ("" = alle). Bor her, ikke i Økter, fordi
  // undermenyen i sidemenyen og ⌘1–9 velger det (DESIGN.md §6).
  const [oktFag, setOktFag] = useState("");
  // De planlagte trekningene, til sidemenyen under Samtaler (DESIGN.md §10).
  const [trekninger, setTrekninger] = useState<Trekning[]>([]);
  // Navnet på vurderingen hver trekning hører til — det er trekningens navn.
  const [vurderingsnavn, setVurderingsnavn] = useState<Map<string, string>>(
    new Map(),
  );
  // Klassekartene i året, til undermenyen under Klassekart (SPEC §4.11).
  const [kartene, setKartene] = useState<Kart[]>([]);
  // Plassen i verktøylinja som skjermene kan fylle (ui/Verktoylinje).
  const [spor, setSpor] = useState<HTMLElement | null>(null);

  const lastTrekninger = useCallback(async (skolearId: string) => {
    const [dager, vurderinger] = await Promise.all([
      hentSamtaledager(skolearId),
      hentVurderinger(skolearId),
    ]);
    setTrekninger(grupperTrekninger(dager));
    setVurderingsnavn(new Map(vurderinger.map((v) => [v.id, v.tittel])));
  }, []);

  // Navigasjonshistorikk, som i Obsidian: hvert sted du har vært ligger i en
  // liste, og pilene flytter markøren i den. Går du et nytt sted midt i
  // historikken, kappes det som lå foran — samme oppførsel som en nettleser.
  //
  // Lista og markøren ligger i samme state fordi de alltid endres sammen.
  const [historikk, setHistorikk] = useState<{ steder: Sted[]; peker: number }>(
    {
      steder: [{ visning: "idag", id: null }],
      peker: 0,
    },
  );

  const { steder, peker } = historikk;
  const { visning, id: apneId } = steder[peker];
  const valgtFag = fag.find((f) => f.id === oktFag) ?? null;

  const ga = useCallback((visning: Visning, id: string | null = null) => {
    setHistorikk((h) => {
      const na = h.steder[h.peker];
      // Samme sted to ganger på rad gir ingenting å gå tilbake gjennom.
      if (na.visning === visning && na.id === id) return h;
      const steder = [...h.steder.slice(0, h.peker + 1), { visning, id }];
      return { steder, peker: steder.length - 1 };
    });
  }, []);

  /**
   * Et fag fra undermenyen eller ⌘1–9: Oversikt for faget (11.2), også fra
   * lista eller kalenderen. Står du i Året, blir du der. «Alle fag» har
   * ingen oversikt: da lista, eller kalenderen hvis du står i den.
   */
  const velgFag = useCallback((id: string) => {
    setOktFag(id);
    setHistorikk((h) => {
      const na = h.steder[h.peker];
      if (id && (na.visning === "oversikt" || na.visning === "aret")) return h;
      if (!id && (na.visning === "okter" || na.visning === "kalender"))
        return h;
      const steder = [
        ...h.steder.slice(0, h.peker + 1),
        { visning: (id ? "oversikt" : "okter") as Visning, id: null },
      ];
      return { steder, peker: steder.length - 1 };
    });
  }, []);

  const tilbake = useCallback(
    () => setHistorikk((h) => ({ ...h, peker: Math.max(0, h.peker - 1) })),
    [],
  );

  const fram = useCallback(
    () =>
      setHistorikk((h) => ({
        ...h,
        peker: Math.min(h.steder.length - 1, h.peker + 1),
      })),
    [],
  );

  // Arkstabelen (DESIGN.md §7): en økt eller elev åpnet fra en skjerm legger
  // seg som et ark over den, i stedet for å bytte skjerm.
  const ark = useRef<ArkApi | null>(null);
  const apneOktSomArk = (id: string) => ark.current?.apneOkt(id);

  // ⌘K: søk på elev eller økt, hvor som helst i appen (§4.4).
  const [sokApent, setSokApent] = useState(false);

  // En oppsettfil åpnet med dobbeltklikk (5.13): i veiviseren uten
  // skoleår, ellers i Innstillinger › Del oppsett.
  const apnetFil = useApnetOppsettfil();
  useEffect(() => {
    if ((apnetFil.tekst || apnetFil.feil) && skolear) {
      ark.current?.lukkAlle();
      ga("innstillinger", "deloppsett");
    }
  }, [apnetFil.tekst, apnetFil.feil, skolear?.id, ga]);

  // G-snarveiene (DESIGN.md §6): G, så en bokstav innen et lite øyeblikk.
  // Aldri mens man skriver i et felt — da er G bare en bokstav.
  const ventG = useRef<number | null>(null);

  useEffect(() => {
    const taster = (e: KeyboardEvent) => {
      if (!hovedtast(e)) {
        if (harModifikator(e) || e.altKey || e.repeat) return;
        const mal = e.target as HTMLElement;
        if (mal.closest?.("input, textarea, select, [contenteditable]")) return;
        const tast = e.key.toLowerCase();
        if (ventG.current !== null) {
          window.clearTimeout(ventG.current);
          ventG.current = null;
          const punkt = G_SNARVEIER[tast];
          if (punkt) {
            e.preventDefault();
            ark.current?.lukkAlle();
            ga(punkt);
          }
          return;
        }
        if (tast === "g") {
          ventG.current = window.setTimeout(() => (ventG.current = null), 1200);
        }
        return;
      }
      // Zoom (10.6): ⌘+ og ⌘− i trinn, ⌘0 tilbake til 100 %. ⌘= tas med,
      // for på amerikansk tastatur er + på samme tast.
      if (!e.altKey && (e.key === "+" || e.key === "=")) {
        e.preventDefault();
        void zoomInn();
        return;
      }
      if (!e.altKey && (e.key === "-" || e.key === "−")) {
        e.preventDefault();
        void zoomUt();
        return;
      }
      if (e.key === "0" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        void zoomNull();
        return;
      }
      // ⌘1–9: fagene i undermenyen under Økter. ⌘0 er zoom (10.6).
      if (/^[1-9]$/.test(e.key) && !e.shiftKey && !e.altKey) {
        const n = Number(e.key);
        if (fagRef.current[n - 1]) {
          e.preventDefault();
          ark.current?.lukkAlle();
          velgFag(fagRef.current[n - 1].id);
        }
        return;
      }
      if (e.key === ",") {
        e.preventDefault();
        ark.current?.lukkAlle();
        ga("innstillinger");
      }
      if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        setSokApent(true);
      }
      if (e.key === "[") {
        e.preventDefault();
        tilbake();
      }
      if (e.key === "]") {
        e.preventDefault();
        fram();
      }
    };
    window.addEventListener("keydown", taster);
    return () => window.removeEventListener("keydown", taster);
  }, [tilbake, fram, ga, velgFag]);

  const last = useCallback(async () => {
    try {
      // Tekststørrelsen først: den gjelder hele skjermen, og skal være på
      // plass før noe tegnes.
      await brukTekstskala().catch((e) => console.error("tekstskala:", e));
      await brukTema().catch((e) => console.error("tema:", e));
      await brukGlass().catch((e) => console.error("glass:", e));
      await brukPalett().catch((e) => console.error("palett:", e));
      await brukBevegelse().catch((e) => console.error("bevegelse:", e));
      await brukZoom().catch((e) => console.error("zoom:", e));

      // Sikkerhetskopi, før noe rekker å endres i denne økta.
      await daglingKopi().catch((e) => console.error("sikkerhetskopi:", e));

      const ar = await hentAktivtSkolear();
      setSkolear(ar);
      setFag(ar ? await hentFagIAr(ar.id) : []);
      if (ar)
        await lastTrekninger(ar.id).catch((e) =>
          console.error("trekninger:", e),
        );

      // Kalenderstrømmen holdes fersk ved hver innlasting, men bare hvis
      // brukeren har slått den på. Er den av, lytter ingenting.
      if (ar && (await kalenderPa())) {
        await startKalender(ar).catch((e) => console.error("kalenderfeed:", e));
      }

      // Arkivet (§8) skrives ved oppstart, sammen med sikkerhetskopien.
      // En eksport man må huske på er ikke backup. Feiler den, skal ikke
      // appen la være å starte.
      if (ar) {
        void skrivArkiv(ar).catch((e) => console.error("arkiv:", e));
        // Og alltid ved siden av databasekopiene, som forsikring.
        void skrivArkivTilBackup(ar).catch((e) =>
          console.error("arkiv til backup:", e),
        );
      }
      setVersjon((v) => v + 1);
    } catch (e) {
      setFeil(String(e));
    } finally {
      setLaster(false);
    }
  }, [lastTrekninger]);

  useEffect(() => {
    void last();
  }, [last]);

  // Ny dag mens appen står åpen: dagens sikkerhetskopi og arkiv, som ved
  // oppstart (#4). I dag tegnes på nytt med dagen som nøkkel (#5).
  const startdag = useRef(dag);
  useEffect(() => {
    if (dag === startdag.current) return;
    startdag.current = dag;
    void (async () => {
      await daglingKopi().catch((e) => console.error("sikkerhetskopi:", e));
      if (skolear) {
        void skrivArkiv(skolear).catch((e) => console.error("arkiv:", e));
        void skrivArkivTilBackup(skolear).catch((e) =>
          console.error("arkiv til backup:", e),
        );
      }
    })();
  }, [dag]);

  // Kartene i undermenyen: lastes med året, og på nytt når kart, rom eller
  // elever endres (antallet elever står i undermenyen).
  useEffect(() => {
    if (!skolear) return;
    const lastKart = () =>
      void hentKart(skolear.id)
        .then(setKartene)
        .catch((e) => console.error("klassekart:", e));
    lastKart();
    const a = lyttKlassekart(lastKart);
    const b = lyttElever(lastKart);
    return () => {
      a();
      b();
    };
  }, [skolear?.id]);

  // Automatisk publisering til kalenderserveren, hvis den er slått på.
  // Lytteren står så lenge et skoleår er lastet.
  useEffect(() => {
    if (!skolear) return;
    return startCaldav(skolear);
  }, [skolear?.id]);

  if (feil) {
    return (
      <main className="p-8 font-mono text-brod text-feil">
        <p className="font-semibold">Databasen svarte ikke som forventet:</p>
        <pre className="mt-2 whitespace-pre-wrap">{feil}</pre>
      </main>
    );
  }

  if (laster) return <main className="p-8 text-brod text-blekk-svak">…</main>;

  if (!skolear) {
    return (
      <Veiviser
        oppsettTekst={apnetFil.tekst}
        oppsettFeil={apnetFil.feil}
        onOppsettLest={apnetFil.glem}
        onFerdig={() => {
          setLaster(true);
          void last();
        }}
      />
    );
  }

  return (
    <Arkstabel
      skolearId={skolear.id}
      onGaTil={(v, id) => ga(v, id ?? null)}
      onFagEndret={last}
    >
      <ArkKobling til={ark} />
      <div className="app-skall relative isolate flex h-full overflow-clip bg-bord text-blekk">
        <div aria-hidden className="fargeteppe ikkeutskrift">
          <i />
          <i />
          <i />
        </div>
        <Toaster />
        {sokApent && (
          <Sokevindu
            skolearId={skolear.id}
            fag={fag}
            onApneElev={(id) => ga("elev", id)}
            onApneOkt={apneOktSomArk}
            onLukk={() => setSokApent(false)}
          />
        )}
        <Sidemeny
          skolearNavn={skolear.navn}
          aktiv={aktivtPunkt(visning)}
          fag={fag}
          valgtFag={oktFag}
          onVelgFag={velgFag}
          onGa={(p) => ga(p)}
          trekninger={trekninger}
          vurderingsnavn={vurderingsnavn}
          apenTrekning={visning === "samtaler" ? (apneId ?? null) : undefined}
          onApneTrekning={(id) => ga("samtaler", id)}
          klassekart={kartene}
          apentKart={visning === "klassekart" ? (apneId ?? null) : undefined}
          onApneKart={(id) => ga("klassekart", id)}
          onSok={() => setSokApent(true)}
          onInnstillinger={() => ga("innstillinger")}
          visning={visning}
          onSkolear={() => ga("innstillinger", "skolear")}
        />

        {/*
          Hovedflaten er et hvitt ark ved siden av sidemenyen, 8 px fra
          kanten og med 10 px radius (DESIGN.md §6). Innholdet står alltid
          på hel flate — glass kommer bare på det som ligger over (§7).
        */}
        <div className="ark-flate m-2.5 flex min-w-0 flex-1 flex-col overflow-clip rounded-ark bg-ark shadow-[var(--shadow-panel)]">
          <Verktoylinje
            visning={visning}
            fagTittel={
              erOktvisning(visning) && valgtFag
                ? { kode: valgtFag.kode, farge: valgtFag.farge }
                : null
            }
            bryter={
              erOktvisning(visning) ? (
                <Visningsbryter
                  visning={
                    (visning === "oversikt" || visning === "aret") && !valgtFag
                      ? "okter"
                      : visning
                  }
                  medFag={!!valgtFag}
                  ga={ga}
                />
              ) : undefined
            }
            onSpor={setSpor}
            kanTilbake={peker > 0}
            kanFram={peker < steder.length - 1}
            onTilbake={tilbake}
            onFram={fram}
          />
          {melding && (
            <div className="ikkeutskrift flex shrink-0 items-center gap-3 border-b border-linje-medium bg-flate-svak px-6 py-1.5 text-brod text-aksent">
              <span className="inline-flex items-center gap-1.5">
                <Ikon navn="hake" />
                {melding}
              </span>
              <Knapp variant="stille" onClick={() => setMelding(null)}>
                Lukk
              </Knapp>
            </div>
          )}

          <Verktoylinjespor.Provider value={spor}>
            <main className="flex min-h-0 flex-1 flex-col overflow-clip">
              {/*
          Samme padding på alle skjermer. Den var før avhengig av om skjermen
          hadde sidepanel, og da hoppet innholdet 8 px både sidelengs og ned
          hver gang man byttet fane. Skjermene med panel er de tetteste — de
          skal ikke miste bredde — så det er den strammeste verdien som gjelder
          for alle.
        */}
              <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
                {visning === "idag" && (
                  <IDag
                    key={dag}
                    skolear={skolear}
                    fag={fag}
                    onGaTil={(v, id) => ga(v, id ?? null)}
                    onApneOkt={(id) => ark.current?.apneOkt(id, "skaring")}
                  />
                )}

                {visning === "oversikt" && valgtFag && (
                  <Fagoversikt
                    key={`${versjon}-${valgtFag.id}`}
                    skolear={skolear}
                    fag={valgtFag}
                    onRedigerFag={() => ga("fagside", valgtFag.id)}
                  />
                )}

                {visning === "aret" && valgtFag && (
                  <Aret
                    key={`${versjon}-${valgtFag.id}`}
                    skolear={skolear}
                    fag={valgtFag}
                  />
                )}

                {visning === "kalender" && (
                  <Skolekalender
                    key={versjon}
                    skolear={skolear}
                    fag={fag}
                    onApneOkt={apneOktSomArk}
                  />
                )}

                {visning === "skoleruta" && (
                  <Skoleruta key={versjon} skolear={skolear} onEndret={last} />
                )}

                {visning === "samtaler" && !apneId && (
                  <Samtaleoversikt
                    skolearNavn={skolear.navn}
                    trekninger={trekninger}
                    vurderingsnavn={vurderingsnavn}
                    fag={fag}
                    onApne={(id) => ga("samtaler", id)}
                  />
                )}
                {visning === "samtaler" && apneId && (
                  <Samtaler
                    key={`${versjon}-${apneId ?? ""}`}
                    skolear={skolear}
                    fag={fag}
                    startFagId={apneId ?? undefined}
                    onEndret={() => void lastTrekninger(skolear.id)}
                  />
                )}

                {visning === "klassekart" && (
                  <Klassekart
                    key={versjon}
                    skolearId={skolear.id}
                    id={apneId}
                    onGa={(id) => ga("klassekart", id)}
                    onTilbake={() => (peker > 0 ? tilbake() : ga("klassekart"))}
                  />
                )}

                {visning === "innstillinger" && (
                  <Innstillinger
                    oppsettTekst={apnetFil.tekst}
                    onOppsettLest={apnetFil.glem}
                    skolear={skolear}
                    fag={fag}
                    onEndret={last}
                    onApneSkoleruta={() => ga("skoleruta")}
                    onApneFag={() => ga("fag")}
                    startSide={apneId ?? undefined}
                    key={apneId ?? ""}
                  />
                )}

                {/*
          Ingen key={versjon} her, med vilje. Fag får faglista som prop og
          trenger ikke bygges opp på nytt for å vise ferske data — og gjør den
          det, nullstilles Rediger-bryteren hver gang et felt lagrer.
        */}
                {visning === "fag" && (
                  <Fag
                    skolearId={skolear.id}
                    fag={fag}
                    startFag={apneId}
                    onEndret={last}
                  />
                )}

                {visning === "elever" && (
                  <Elever
                    key={versjon}
                    startElev={apneId}
                    skolearId={skolear.id}
                    fag={fag}
                    onLimInn={() => ga("liminn")}
                  />
                )}

                {/*
              Faget alene, over hele bredden — fagsiden for året. Dit går
              «Fag i år» i sidemenyen. Lukk går dit man kom fra.
            */}
                {visning === "fagside" &&
                  apneId &&
                  fag.find((f) => f.id === apneId) && (
                    <div className="mx-auto min-h-0 w-full max-w-5xl flex-1 overflow-auto">
                      <FagPanel
                        key={apneId}
                        fag={fag.find((f) => f.id === apneId)!}
                        skolearId={skolear.id}
                        onLukk={() => (peker > 0 ? tilbake() : ga("fag"))}
                        onEndret={last}
                        onApneElev={(id, liste) =>
                          ark.current?.apneElev(id, { liste, startFag: apneId })
                        }
                        onApneVurdering={(id) => ark.current?.apneVurdering(id)}
                        onApneVurderinger={() => ga("vurderinger")}
                        onLimInn={() => ga("liminn", apneId)}
                      />
                    </div>
                  )}

                {/*
            Elevkortet alene, over hele bredden. Lista ved siden av forstyrrer
            når man har søkt opp én bestemt elev. Lukk går dit man kom fra.
          */}
                {visning === "elev" && apneId && (
                  <div className="mx-auto min-h-0 w-full max-w-5xl flex-1 overflow-auto rounded-vanlig border border-linje">
                    <ElevPanel
                      key={apneId}
                      elevId={apneId}
                      aktivtSkolearId={skolear.id}
                      onLukk={() => (peker > 0 ? tilbake() : ga("elever"))}
                      onApneOkt={apneOktSomArk}
                    />
                  </div>
                )}

                {visning === "liminn" && (
                  <LimInn
                    key={apneId ?? ""}
                    skolearId={skolear.id}
                    fag={fag}
                    // Fra et fagkort: faget står valgt, og lista er hele faget.
                    startFagId={apneId ?? undefined}
                    erstatt={apneId !== null}
                    onFerdig={(m) => {
                      setMelding(m);
                      setVersjon((v) => v + 1);
                      if (apneId) {
                        // Tilbake til faget, med kortet oppe igjen.
                        ga("fag");
                        ark.current?.apneFag(apneId);
                      } else ga("elever");
                    }}
                    onAvbryt={() => {
                      if (apneId) {
                        ga("fag");
                        ark.current?.apneFag(apneId);
                      } else ga("elever");
                    }}
                  />
                )}

                {(visning === "okter" ||
                  ((visning === "oversikt" || visning === "aret") &&
                    !valgtFag)) && (
                  <Okter
                    key={versjon}
                    skolear={skolear}
                    fag={fag}
                    startValgt={apneId}
                    filterFag={oktFag}
                    onFilterFag={setOktFag}
                    onRedigerFag={(id) => (id ? ga("fagside", id) : ga("fag"))}
                    onApneSamtaler={(id) => ga("samtaler", id)}
                  />
                )}

                {visning === "vurderinger" && (
                  <Vurderinger key={versjon} skolearId={skolear.id} fag={fag} />
                )}
              </div>
            </main>
          </Verktoylinjespor.Provider>
        </div>
      </div>
    </Arkstabel>
  );
}

const SKJERMNAVN: Record<Visning, string> = {
  idag: "I dag",
  okter: "Økter",
  oversikt: "Økter",
  aret: "Økter",
  kalender: "Økter",
  elever: "Elever",
  elev: "Elever",
  liminn: "Elever",
  vurderinger: "Vurderinger",
  samtaler: "Samtaler",
  fag: "Fag",
  fagside: "Fag",
  innstillinger: "Innstillinger",
  skoleruta: "Skoleruta",
  klassekart: "Klassekart",
};

/**
 * Verktøylinja øverst i arket: en glasskapsel som flyter 10 px inn
 * (DESIGN.md §6–7). Foreløpig står bare skjermnavnet her, og uka på «I dag»;
 * skjermenes egne knapper står fortsatt i skjermen.
 */
function Verktoylinje({
  visning,
  fagTittel,
  bryter,
  onSpor,
  kanTilbake,
  kanFram,
  onTilbake,
  onFram,
}: {
  visning: Visning;
  /** Økter med et fag valgt: fagfirkant og kode i stedet for «Økter» (11.2) */
  fagTittel?: { kode: string; farge: string | null } | null;
  /** Liste | Kalender, eller Oversikt | Økter | Kalender, rett etter tittelen */
  bryter?: React.ReactNode;
  /** plassen skjermene fyller med `<IVerktoylinja>` */
  onSpor: (el: HTMLElement | null) => void;
  kanTilbake: boolean;
  kanFram: boolean;
  onTilbake: () => void;
  onFram: () => void;
}) {
  const dag = useIdag();
  // Sveip med to fingre: til høyre tilbake, til venstre fram.
  const sveip = useSveip(onTilbake, onFram, kanTilbake, kanFram);

  // Får ikke skjermens knapper plass, kommer en pil ytterst til høyre.
  // Den bretter linja ut over flere rader, og sammen igjen. Ny skjerm:
  // tilbake til én rad.
  const [spor, setSpor] = useState<HTMLElement | null>(null);
  const [flyter, setFlyter] = useState(false);
  const [utvidet, setUtvidet] = useState(false);
  const utvidetRef = useRef(false);
  utvidetRef.current = utvidet;
  const sporRef = useCallback(
    (el: HTMLElement | null) => {
      onSpor(el);
      setSpor(el);
    },
    [onSpor],
  );
  useEffect(() => setUtvidet(false), [visning]);
  useLayoutEffect(() => {
    if (!spor) return;
    const sjekk = () => {
      // Utbrettet bryter linja, så da måles den som én rad et øyeblikk:
      // klassene byttes, bredden leses og klassene settes tilbake, før
      // noe tegnes. Får alt plass igjen, legges linja sammen og pila går.
      const ut = utvidetRef.current;
      const bryt = ["verktoy-utbrettet", "flex-wrap"];
      if (ut) {
        spor.classList.remove(...bryt);
        spor.classList.add("overflow-hidden");
      }
      const flyterNa = spor.scrollWidth > spor.clientWidth + 1;
      if (ut) {
        spor.classList.add(...bryt);
        spor.classList.remove("overflow-hidden");
      }
      setFlyter(flyterNa);
      if (ut && !flyterNa) setUtvidet(false);
    };
    const ro = new ResizeObserver(sjekk);
    ro.observe(spor);
    const mo = new MutationObserver(sjekk);
    mo.observe(spor, { childList: true, subtree: true, characterData: true });
    sjekk();
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [spor, utvidet]);

  return (
    <div
      className={`glass-verktoy ikkeutskrift mx-3 mt-2.5 flex shrink-0 gap-2.5 pl-2 pr-2 ${
        utvidet
          ? "min-h-12 items-start rounded-[24px] py-2"
          : "h-12 items-center rounded-full"
      }`}
    >
      {/*
        Tilbake og fram, som i en nettleser (⌘[ ⌘]). Sto før nederst i
        sidemenyen, der de var vanskelige å finne.
      */}
      <span className="flex shrink-0 items-center">
        <Pil retning="tilbake" av={!kanTilbake} onKlikk={onTilbake} />
        <Pil retning="fram" av={!kanFram} onKlikk={onFram} />
      </span>
      {/* Til body: glasset rundt gjør ellers «fixed» relativ til kapselen. */}
      {sveip !== 0 &&
        createPortal(
          <span
            aria-hidden
            className={`pointer-events-none fixed top-1/2 z-50 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-ark text-[22px] text-aksent shadow-[var(--shadow-ark)] ${
              sveip > 0 ? "left-4" : "right-4"
            }`}
            style={{
              opacity: Math.abs(sveip),
              transform: `translateY(-50%) scale(${0.6 + 0.4 * Math.abs(sveip)})`,
            }}
          >
            {sveip > 0 ? "‹" : "›"}
          </span>,
          document.body,
        )}
      {/* Samtaletrekkeren har trekningens navn der i stedet (DESIGN §10). */}
      {fagTittel ? (
        <span className="flex shrink-0 items-center gap-2 text-brod font-semibold">
          <Fagfirkant farge={fagTittel.farge} storrelse={10} />
          {fagTittel.kode}
        </span>
      ) : (
        visning !== "samtaler" && (
          <span className="text-brod font-semibold">{SKJERMNAVN[visning]}</span>
        )
      )}
      {bryter && <span className="ml-1 shrink-0">{bryter}</span>}
      {visning === "idag" && (
        <span className="text-brod tabular-nums text-blekk-dempet">
          Uke {ukenummer(dag)}
        </span>
      )}
      <div
        ref={sporRef}
        className={`flex min-w-0 flex-1 items-center gap-2 ${
          utvidet
            ? "verktoy-utbrettet flex-wrap gap-y-1.5"
            : flyter
              ? "overflow-hidden [mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)]"
              : "overflow-hidden"
        }`}
      />
      {(flyter || utvidet) && (
        <button
          onClick={() => setUtvidet((u) => !u)}
          aria-expanded={utvidet}
          title={utvidet ? "Vis på én linje" : "Vis alle knappene"}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-blekk-dempet hover:bg-flate hover:text-blekk"
        >
          <Ikon
            navn="vinkel"
            klasse={`transition-transform ${utvidet ? "rotate-180" : ""}`}
          />
        </button>
      )}
    </div>
  );
}

/** Hvilket punkt i sidemenyen som står markert for en visning. */
function aktivtPunkt(v: Visning): Menypunkt | "innstillinger" | null {
  if (
    v === "idag" ||
    v === "vurderinger" ||
    v === "samtaler" ||
    v === "klassekart"
  )
    return v;
  // Fagene er undermeny under Økter, så fagsiden hører til der.
  if (erOktvisning(v) || v === "fag" || v === "fagside") return "okter";
  if (v === "elever" || v === "elev" || v === "liminn") return "elever";
  if (v === "innstillinger" || v === "skoleruta") return "innstillinger";
  return null;
}

/** Visningene som hører under Økter-fanen. */
function erOktvisning(v: Visning): boolean {
  return v === "okter" || v === "kalender" || v === "oversikt" || v === "aret";
}

/**
 * Liste og Kalender er to måter å se øktene på; med et fag valgt kommer
 * fagsiden først: Oversikt | Økter | Kalender (11.2, lerretet «Fagside»).
 * Bryteren står i verktøylinja, rett etter tittelen, på samme sted i alle
 * visningene (SPEC §4), så den ikke hopper.
 */
function Visningsbryter({
  visning,
  medFag,
  ga,
}: {
  visning: Visning;
  /** et fag er valgt: Oversikt kommer med, og lista heter Økter */
  medFag: boolean;
  ga: (v: Visning) => void;
}) {
  const valg = medFag
    ? [
        { id: "oversikt", navn: "Oversikt" },
        { id: "aret", navn: "Året" },
        { id: "okter", navn: "Økter" },
        { id: "kalender", navn: "Kalender" },
      ]
    : [
        { id: "okter", navn: "Liste" },
        { id: "kalender", navn: "Kalender" },
      ];
  return (
    <Bryter
      storrelse="liten"
      valg={valg}
      verdi={visning}
      settVerdi={(v) => ga(v as Visning)}
    />
  );
}

function Pil({
  retning,
  av,
  onKlikk,
}: {
  retning: "tilbake" | "fram";
  av: boolean;
  onKlikk: () => void;
}) {
  return (
    <button
      onClick={onKlikk}
      disabled={av}
      aria-label={retning === "tilbake" ? "Tilbake" : "Fram"}
      title={
        retning === "tilbake"
          ? `Tilbake (${visTast("⌘[")} eller sveip til høyre med to fingre)`
          : `Fram (${visTast("⌘]")} eller sveip til venstre med to fingre)`
      }
      className="grid h-8 w-8 place-items-center rounded-full text-[20px] leading-none text-blekk hover:bg-[var(--glass-valgt)] disabled:text-blekk-svakest disabled:hover:bg-transparent"
    >
      {retning === "tilbake" ? "‹" : "›"}
    </button>
  );
}
