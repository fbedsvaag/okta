import { useCallback, useEffect, useState } from "react";
import { hentAktivtSkolear, type Skolear } from "./data/skolear";
import { daglingKopi } from "./data/sikkerhetskopi";
import { erPa as kalenderPa, start as startKalender } from "./data/kalenderfeed";
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
import { Knapp } from "./ui/felles";
import { Ordmerke } from "./ui/logo";

type Sted = { visning: Visning; okt: string | null };

type Visning =
  | "idag"
  | "skoleruta"
  | "kalender"
  | "fag"
  | "elever"
  | "okter"
  | "perioder"
  | "vurderinger"
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
  const [historikk, setHistorikk] = useState<{ steder: Sted[]; peker: number }>({
    steder: [{ visning: "idag", okt: null }],
    peker: 0,
  });

  const { steder, peker } = historikk;
  const { visning, okt: apneOkt } = steder[peker];

  const ga = useCallback((visning: Visning, okt: string | null = null) => {
    setHistorikk((h) => {
      const na = h.steder[h.peker];
      // Samme sted to ganger på rad gir ingenting å gå tilbake gjennom.
      if (na.visning === visning && na.okt === okt) return h;
      const steder = [...h.steder.slice(0, h.peker + 1), { visning, okt }];
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

  useEffect(() => {
    const taster = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
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
      // Sikkerhetskopi først, før noe rekker å endres i denne økta.
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
    <div className="app-skall flex h-screen flex-col overflow-hidden bg-bord text-blekk">
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
        <Fane
          navn={skolear.navn}
          aktiv={erArsfane(visning)}
          onKlikk={() => ga("idag")}
          tabulaer
        />
        <Skille />
        <Fane navn="Fag" aktiv={visning === "fag"} onKlikk={() => ga("fag")} />
        <Skille />
        <Fane
          navn="Elever"
          aktiv={visning === "elever" || visning === "liminn"}
          onKlikk={() => ga("elever")}
        />
        <Skille />
        <Fane
          navn="Økter"
          aktiv={visning === "okter" || visning === "perioder"}
          onKlikk={() => ga("okter")}
        />
        <Skille />
        <Fane
          navn="Vurderinger"
          aktiv={visning === "vurderinger"}
          onKlikk={() => ga("vurderinger")}
        />
        <span className="grow" />
        <Fane
          navn="Innstillinger"
          aktiv={visning === "innstillinger"}
          onKlikk={() => ga("innstillinger")}
        />
      </header>

      {(visning === "okter" || visning === "perioder") && (
        <div className="ikkeutskrift flex shrink-0 gap-1 border-b border-linje-medium px-6 py-1.5">
          <Underfane
            navn="Liste"
            aktiv={visning === "okter"}
            onKlikk={() => ga("okter")}
          />
          <Underfane
            navn="Perioder"
            aktiv={visning === "perioder"}
            onKlikk={() => ga("perioder")}
          />
        </div>
      )}

      {erArsfane(visning) && (
        <div className="ikkeutskrift flex shrink-0 gap-1 border-b border-linje-medium px-6 py-1.5">
          <Underfane
            navn="I dag"
            aktiv={visning === "idag"}
            onKlikk={() => ga("idag")}
          />
          <Underfane
            navn="Kalender"
            aktiv={visning === "kalender"}
            onKlikk={() => ga("kalender")}
          />
          <Underfane
            navn="Skoleruta"
            aktiv={visning === "skoleruta"}
            onKlikk={() => ga("skoleruta")}
          />
        </div>
      )}

      {melding && (
        <div className="ikkeutskrift flex shrink-0 items-center gap-3 border-b border-linje-medium bg-flate-svak px-6 py-1.5 text-brod text-aksent">
          <span>✓ {melding}</span>
          <Knapp variant="stille" onClick={() => setMelding(null)}>
            Lukk
          </Knapp>
        </div>
      )}

      <main className="min-h-0 flex-1 overflow-hidden">
        <div
          className={`${
            medPanel(visning)
              ? "h-full px-6 py-4"
              : "h-full overflow-y-auto px-6 py-5 sm:px-8 sm:py-6"
          }`}
        >
        {visning === "idag" && (
          <IDag
            skolear={skolear}
            fag={fag}
            onGaTil={(v) => ga(v)}
            onApneOkt={(id) => ga("okter", id)}
          />
        )}

        {visning === "kalender" && (
          <Skolekalender
            key={versjon}
            skolear={skolear}
            fag={fag}
            onApneOkt={(id) => ga("okter", id)}
          />
        )}

        {visning === "skoleruta" && (
          <Skoleruta key={versjon} skolear={skolear} onEndret={last} />
        )}

        {visning === "innstillinger" && <Innstillinger skolear={skolear} fag={fag} />}

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
            skolearId={skolear.id}
            fag={fag}
            onLimInn={() => ga("liminn")}
            onApneOkt={(id) => ga("okter", id)}
          />
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
            key={versjon}
            skolear={skolear}
            fag={fag}
            startValgt={apneOkt}
            onApnePerioder={() => ga("perioder")}
          />
        )}

        {visning === "perioder" && (
          <Perioder
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
            onApneOkt={(id) => ga("okter", id)}
          />
        )}
        </div>
      </main>
    </div>
  );
}

/**
 * Skjermer med sidepanel har sin egen rullesone i hver kolonne, så de skal
 * ikke ligge inni en som ruller. Ellers får man to rullefelt oppå hverandre.
 */
function medPanel(v: Visning): boolean {
  return v === "okter" || v === "elever" || v === "vurderinger" || v === "fag";
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

/** Fanene som hører under årstallet i headeren. */
function erArsfane(v: Visning): boolean {
  return v === "idag" || v === "kalender" || v === "skoleruta";
}

function Skille() {
  return <span className="hidden select-none px-0.5 text-blekk-svakest sm:inline">·</span>;
}

function Underfane({
  navn,
  aktiv,
  onKlikk,
}: {
  navn: string;
  aktiv: boolean;
  onKlikk: () => void;
}) {
  return (
    <button
      onClick={onKlikk}
      className={`rounded px-2 py-0.5 text-liten ${
        aktiv
          ? "bg-flate font-medium text-blekk"
          : "text-blekk-dempet hover:text-blekk"
      }`}
    >
      {navn}
    </button>
  );
}
