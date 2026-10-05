import { brukTema } from "./ui/tema";
import { brukGlass } from "./ui/glass";
import { brukPalett } from "./ui/palett";
import { ukenummer } from "./data/kalender";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { Veiviser } from "./skjermer/Veiviser";
import { IDag } from "./skjermer/IDag";
import { Fag } from "./skjermer/Fag";
import { Elever } from "./skjermer/Elever";
import { LimInn } from "./skjermer/LimInn";
import { Okter } from "./skjermer/Okter";
import { Perioder } from "./skjermer/Perioder";
import { Skoleruta } from "./skjermer/Skoleruta";
import { Skolekalender } from "./skjermer/Skolekalender";
import { Innstillinger } from "./skjermer/Innstillinger";
import { Vurderinger } from "./skjermer/Vurderinger";
import { Samtaler } from "./skjermer/Samtaler";
import { ElevPanel } from "./skjermer/ElevPanel";
import { Knapp, Ikon } from "./ui/felles";
import { G_SNARVEIER, Sidemeny, type Menypunkt } from "./ui/Sidemeny";
import { Sokevindu } from "./ui/Sokevindu";
import { ArkKobling, Arkstabel, type ArkApi } from "./ui/Arkstabel";

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
  | "elever"
  /** én elev over hele skjermen, uten lista — der søket åpner */
  | "elev"
  | "okter"
  | "perioder"
  | "vurderinger"
  | "samtaler"
  | "innstillinger"
  | "liminn";

export default function App() {
  const [skolear, setSkolear] = useState<Skolear | null>(null);
  const [fag, setFag] = useState<FagIAr[]>([]);
  const [laster, setLaster] = useState(true);
  const [feil, setFeil] = useState<string | null>(null);
  const [melding, setMelding] = useState<string | null>(null);
  const [versjon, setVersjon] = useState(0);

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

  const ga = useCallback((visning: Visning, id: string | null = null) => {
    setHistorikk((h) => {
      const na = h.steder[h.peker];
      // Samme sted to ganger på rad gir ingenting å gå tilbake gjennom.
      if (na.visning === visning && na.id === id) return h;
      const steder = [...h.steder.slice(0, h.peker + 1), { visning, id }];
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

  // G-snarveiene (DESIGN.md §6): G, så en bokstav innen et lite øyeblikk.
  // Aldri mens man skriver i et felt — da er G bare en bokstav.
  const ventG = useRef<number | null>(null);

  useEffect(() => {
    const taster = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) {
        if (e.altKey || e.repeat) return;
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
  }, [tilbake, fram, ga]);

  const last = useCallback(async () => {
    try {
      // Tekststørrelsen først: den gjelder hele skjermen, og skal være på
      // plass før noe tegnes.
      await brukTekstskala().catch((e) => console.error("tekstskala:", e));
      await brukTema().catch((e) => console.error("tema:", e));
      await brukGlass().catch((e) => console.error("glass:", e));
      await brukPalett().catch((e) => console.error("palett:", e));

      // Sikkerhetskopi, før noe rekker å endres i denne økta.
      await daglingKopi().catch((e) => console.error("sikkerhetskopi:", e));

      const ar = await hentAktivtSkolear();
      setSkolear(ar);
      setFag(ar ? await hentFagIAr(ar.id) : []);

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
  }, []);

  useEffect(() => {
    void last();
  }, [last]);

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
        <div aria-hidden className="fargeteppe ikkeutskrift" />
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
          apentFagId={visning === "fag" ? apneId : null}
          kanTilbake={peker > 0}
          kanFram={peker < steder.length - 1}
          onGa={(p) => ga(p)}
          onSok={() => setSokApent(true)}
          onApneFag={(id) => ga("fag", id)}
          onAlleFag={() => ga("fag")}
          onInnstillinger={() => ga("innstillinger")}
          onTilbake={tilbake}
          onFram={fram}
        />

        {/*
          Hovedflaten er et hvitt ark ved siden av sidemenyen, 8 px fra
          kanten og med 10 px radius (DESIGN.md §6). Innholdet står alltid
          på hel flate — glass kommer bare på det som ligger over (§7).
        */}
        <div className="ark-flate m-2.5 flex min-w-0 flex-1 flex-col overflow-clip rounded-ark bg-ark shadow-[var(--shadow-panel)]">
          <Verktoylinje visning={visning} />
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
                  skolear={skolear}
                  fag={fag}
                  onGaTil={(v, id) => ga(v, id ?? null)}
                  onApneOkt={apneOktSomArk}
                />
              )}

              {visning === "kalender" && (
                <Skolekalender
                  bryter={<Visningsbryter visning={visning} ga={ga} />}
                  key={versjon}
                  skolear={skolear}
                  fag={fag}
                  onApneOkt={apneOktSomArk}
                />
              )}

              {visning === "skoleruta" && (
                <Skoleruta key={versjon} skolear={skolear} onEndret={last} />
              )}

              {visning === "samtaler" && (
                <Samtaler
                  key={versjon}
                  skolear={skolear}
                  fag={fag}
                  startFagId={apneId ?? undefined}
                />
              )}

              {visning === "innstillinger" && (
                <Innstillinger
                  skolear={skolear}
                  fag={fag}
                  onEndret={last}
                  onApneSkoleruta={() => ga("skoleruta")}
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

              {visning === "okter" && (
                <Okter
                  bryter={<Visningsbryter visning={visning} ga={ga} />}
                  key={versjon}
                  skolear={skolear}
                  fag={fag}
                  startValgt={apneId}
                  onApnePerioder={() => ga("perioder")}
                />
              )}

              {visning === "perioder" && (
                <Perioder
                  bryter={<Visningsbryter visning={visning} ga={ga} />}
                  key={versjon}
                  skolear={skolear}
                  fag={fag}
                  onApneOkt={apneOktSomArk}
                />
              )}

              {visning === "vurderinger" && (
                <Vurderinger key={versjon} skolearId={skolear.id} fag={fag} />
              )}
            </div>
          </main>
        </div>
      </div>
    </Arkstabel>
  );
}

const SKJERMNAVN: Record<Visning, string> = {
  idag: "I dag",
  okter: "Økter",
  kalender: "Økter",
  perioder: "Økter",
  elever: "Elever",
  elev: "Elever",
  liminn: "Elever",
  vurderinger: "Vurderinger",
  samtaler: "Samtaler",
  fag: "Fag",
  innstillinger: "Innstillinger",
  skoleruta: "Skoleruta",
};

/**
 * Verktøylinja øverst i arket: en glasskapsel som flyter 10 px inn
 * (DESIGN.md §6–7). Foreløpig står bare skjermnavnet her, og uka på «I dag»;
 * skjermenes egne knapper står fortsatt i skjermen.
 */
function Verktoylinje({ visning }: { visning: Visning }) {
  return (
    <div className="glass-verktoy ikkeutskrift mx-2.5 mt-2.5 flex h-11 shrink-0 items-center gap-2.5 rounded-full px-5">
      <span className="text-brod font-semibold">{SKJERMNAVN[visning]}</span>
      {visning === "idag" && (
        <span className="text-brod tabular-nums text-blekk-dempet">
          Uke {ukenummer(isoIDag())}
        </span>
      )}
    </div>
  );
}

function isoIDag(): string {
  const d = new Date();
  const to = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${to(d.getMonth() + 1)}-${to(d.getDate())}`;
}

/** Hvilket punkt i sidemenyen som står markert for en visning. */
function aktivtPunkt(v: Visning): Menypunkt | "fag" | "innstillinger" | null {
  if (v === "idag" || v === "vurderinger" || v === "samtaler") return v;
  if (erOktvisning(v)) return "okter";
  if (v === "elever" || v === "elev" || v === "liminn") return "elever";
  if (v === "fag") return "fag";
  if (v === "innstillinger" || v === "skoleruta") return "innstillinger";
  return null;
}

/** Visningene som hører under Økter-fanen. */
function erOktvisning(v: Visning): boolean {
  return v === "okter" || v === "kalender" || v === "perioder";
}

/**
 * Liste, Kalender og Perioder er tre måter å se øktene på. Bryteren står
 * først i verktøylinja i alle tre, på samme sted, så den ikke hopper.
 */
function Visningsbryter({
  visning,
  ga,
}: {
  visning: Visning;
  ga: (v: Visning) => void;
}) {
  const valg: [Visning, string][] = [
    ["okter", "Liste"],
    ["kalender", "Kalender"],
    ["perioder", "Perioder"],
  ];
  return (
    <div className="inline-flex shrink-0 rounded border border-linje bg-ark p-0.5">
      {valg.map(([v, navn]) => (
        <button
          key={v}
          onClick={() => ga(v)}
          className={`rounded-sm px-2.5 py-0.5 text-liten ${
            visning === v
              ? "bg-valgt font-medium text-aksent"
              : "text-blekk-dempet hover:text-blekk"
          }`}
        >
          {navn}
        </button>
      ))}
    </div>
  );
}
