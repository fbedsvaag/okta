import { useCallback, useEffect, useState } from "react";
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
import { Sokevindu } from "./ui/Sokevindu";
import { Ordmerke } from "./ui/logo";

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

  // ⌘K: søk på elev eller økt, hvor som helst i appen (§4.4).
  const [sokApent, setSokApent] = useState(false);

  useEffect(() => {
    const taster = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
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
  }, [tilbake, fram]);

  const last = useCallback(async () => {
    try {
      // Tekststørrelsen først: den gjelder hele skjermen, og skal være på
      // plass før noe tegnes.
      await brukTekstskala().catch((e) => console.error("tekstskala:", e));

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
      <main className="p-8 font-mono text-brod text-red-800">
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
    <div className="app-skall flex h-full flex-col overflow-clip bg-bord text-blekk">
      {sokApent && (
        <Sokevindu
          skolearId={skolear.id}
          fag={fag}
          onApneElev={(id) => ga("elev", id)}
          onApneOkt={(id) => ga("okter", id)}
          onLukk={() => setSokApent(false)}
        />
      )}
      <header className="ikkeutskrift flex shrink-0 flex-wrap items-center gap-x-1 gap-y-1 border-b border-linje px-4 py-2">
        <span className="mr-3">
          <Ordmerke />
        </span>
        <Pil
          retning="tilbake"
          av={peker === 0}
          onKlikk={tilbake}
          hint="Tilbake (⌘[)"
        />
        <Pil
          retning="fram"
          av={peker >= steder.length - 1}
          onKlikk={fram}
          hint="Fram (⌘])"
        />
        <span className="mx-2 h-4 w-px bg-linje-medium" />
        {/*
          Én rad. Kalender og Perioder er visninger av øktene og står som en
          bryter i Økter; Skoleruta ligger under Innstillinger.
        */}
        <Fane
          navn="I dag"
          aktiv={visning === "idag"}
          onKlikk={() => ga("idag")}
        />
        <Fane
          navn="Økter"
          aktiv={erOktvisning(visning)}
          onKlikk={() => ga("okter")}
        />
        <Fane
          navn="Elever"
          aktiv={
            visning === "elever" || visning === "elev" || visning === "liminn"
          }
          onKlikk={() => ga("elever")}
        />
        <Fane
          navn="Vurderinger"
          aktiv={visning === "vurderinger"}
          onKlikk={() => ga("vurderinger")}
        />
        <Fane
          navn="Samtaler"
          aktiv={visning === "samtaler"}
          onKlikk={() => ga("samtaler")}
        />
        <Fane navn="Fag" aktiv={visning === "fag"} onKlikk={() => ga("fag")} />
        <span className="grow" />
        {/* Synlig inngang til ⌘K, så snarveien kan oppdages. */}
        <button
          onClick={() => setSokApent(true)}
          className="mr-2 flex items-center gap-2 rounded border border-linje px-2 py-0.5 text-liten text-blekk-svak hover:border-linje-sterk hover:text-blekk"
        >
          Søk
          <kbd className="font-sans text-blekk-svakest">⌘K</kbd>
        </button>
        <button
          onClick={() => ga("innstillinger")}
          title="Skoleåret — bytt eller endre i Innstillinger"
          className="mr-1 px-1 text-liten tabular-nums text-blekk-svak hover:text-blekk"
        >
          {skolear.navn}
        </button>
        <Fane
          navn="Innstillinger"
          aktiv={visning === "innstillinger" || visning === "skoleruta"}
          onKlikk={() => ga("innstillinger")}
        />
      </header>

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

      {/*
        Flex hele veien ned, ingen prosenthøyder. `h-full` krever at hver
        forelder har en definert høyde, og brister det ett sted vokser
        innholdet forbi skallet — som da lar seg rulle med hjulet selv om
        det er satt til overflow-clip. Da flytter fanene på seg.

        `min-h-0` er det som lar en flex-boks bli mindre enn innholdet sitt.
        Uten den nekter den å krympe, og rullesonen under får aldri en
        begrenset høyde å rulle innenfor.
      */}
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
              onApneOkt={(id) => ga("okter", id)}
            />
          )}

          {visning === "kalender" && (
            <Skolekalender
              bryter={<Visningsbryter visning={visning} ga={ga} />}
              key={versjon}
              skolear={skolear}
              fag={fag}
              onApneOkt={(id) => ga("okter", id)}
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
              onEndret={last}
              onApneOkt={(id) => ga("okter", id)}
              onApneVurderinger={() => ga("vurderinger")}
            />
          )}

          {visning === "elever" && (
            <Elever
              key={versjon}
              startElev={apneId}
              skolearId={skolear.id}
              fag={fag}
              onLimInn={() => ga("liminn")}
              onApneOkt={(id) => ga("okter", id)}
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
                onApneOkt={(id) => ga("okter", id)}
              />
            </div>
          )}

          {visning === "liminn" && (
            <LimInn
              skolearId={skolear.id}
              fag={fag}
              onFerdig={(m) => {
                setMelding(m);
                ga("elever");
                setVersjon((v) => v + 1);
              }}
              onAvbryt={() => ga("elever")}
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
              onApneOkt={(id) => ga("okter", id)}
            />
          )}

          {visning === "vurderinger" && (
            <Vurderinger
              key={versjon}
              skolearId={skolear.id}
              fag={fag}
              onApneSamtaler={(fagId) => ga("samtaler", fagId)}
              onApneOkt={(id) => ga("okter", id)}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function Pil({
  retning,
  av,
  onKlikk,
  hint,
}: {
  retning: "tilbake" | "fram";
  av: boolean;
  onKlikk: () => void;
  hint: string;
}) {
  return (
    <button
      onClick={onKlikk}
      disabled={av}
      title={hint}
      className="rounded px-1.5 py-0.5 text-tittel leading-none text-blekk-svak hover:bg-flate hover:text-blekk disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-blekk-svak"
    >
      {retning === "tilbake" ? "\u2039" : "\u203a"}
    </button>
  );
}

function Fane({
  navn,
  aktiv,
  onKlikk,
  tabulaer,
}: {
  navn: string;
  aktiv: boolean;
  onKlikk: () => void;
  tabulaer?: boolean;
}) {
  return (
    <button
      onClick={onKlikk}
      className={`rounded px-2 py-0.5 text-brod ${tabulaer ? "tabular-nums" : ""} ${
        aktiv
          ? "bg-valgt font-medium text-aksent"
          : "text-blekk-dempet hover:text-blekk"
      }`}
    >
      {navn}
    </button>
  );
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
