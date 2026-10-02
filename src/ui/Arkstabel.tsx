import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { lytt, varsleOktvisning, varsleVurderinger } from "../data/endringer";
import { hentOkter, type Okt } from "../data/okter";
import { OktPanel } from "../skjermer/OktPanel";
import { ElevPanel } from "../skjermer/ElevPanel";
import { VurderingPanel } from "../skjermer/VurderingPanel";
import { hentVurderinger, type Vurdering } from "../data/vurderinger";
import { FagPanel } from "../skjermer/FagPanel";
import { hentFagIAr, type FagIAr } from "../data/fag";
import { Ikon } from "./felles";

/**
 * Ark over ark — kortlogikken (DESIGN.md §7).
 *
 * Åpner du en elev fra en økt, eller en økt fra en elev, legger den nye seg
 * som et ark over det du sto i. Du blir på siden du var på. Arket under
 * trekker seg litt tilbake og dempes, så det er tydelig at du er ett nivå
 * dypere. Lukk, Esc eller et klikk utenfor tar deg ett nivå tilbake — ikke
 * helt ut.
 *
 * Stabelen ligger rundt hele appen. Hvert panel ber den åpne noe med
 * `useArk()`; ingen skjerm trenger sin egen variant.
 */

type Ark =
  | { type: "okt"; id: string; n: number }
  | { type: "vurdering"; id: string; n: number }
  | { type: "fag"; id: string; n: number }
  | {
      type: "elev";
      id: string;
      n: number;
      /** elevene man kan bla mellom med ⌥↑/⌥↓, f.eks. alle i faget */
      liste?: string[];
      /** faget kortet skal stå filtrert på */
      startFag?: string;
    };

type Api = {
  apneOkt: (id: string) => void;
  apneVurdering: (id: string) => void;
  apneFag: (id: string) => void;
  apneElev: (
    id: string,
    valg?: { liste?: string[]; startFag?: string },
  ) => void;
  /** tar det øverste arket bort */
  lukk: () => void;
};

const Kontekst = createContext<Api | null>(null);

/** Utgangen varer like lenge som inngangen (--tid-inn), bare baklengs. */
const UT_MS = 180;

/**
 * Gir App tilgang til stabelen: App ligger utenfor Arkstabel og kan ikke
 * bruke `useArk()` selv. Denne står inni og legger API-et i en ref.
 */
export function ArkKobling({ til }: { til: { current: Api | null } }) {
  til.current = useArk();
  return null;
}

export type { Api as ArkApi };

export function useArk(): Api {
  const api = useContext(Kontekst);
  if (!api) throw new Error("useArk brukes utenfor Arkstabel");
  return api;
}

/** Skjermene et ark kan sende deg videre til. Stabelen lukkes først. */
export type Utgang = "okter" | "samtaler" | "vurderinger" | "liminn";

export function Arkstabel({
  skolearId,
  onGaTil,
  onFagEndret,
  children,
}: {
  skolearId: string;
  /** «Vis i Økter», «Trekk rekkefølge» og lignende: ut av arkene, til en skjerm */
  onGaTil: (visning: Utgang, id?: string) => void;
  /** et fag er endret i et fagark; appen laster faglista på nytt */
  onFagEndret: () => void;
  children: ReactNode;
}) {
  const [stabel, setStabel] = useState<Ark[]>([]);
  const teller = useRef(0);

  const legg = useCallback((ark: Omit<Ark, "n">) => {
    setStabel((s) => {
      const topp = s[s.length - 1];
      // Samme ting to ganger på rad gir ingenting nytt å se.
      if (topp && topp.type === ark.type && topp.id === ark.id) return s;
      return [...s, { ...ark, n: ++teller.current } as Ark];
    });
  }, []);

  // Ark som er på vei ut. De blir stående mens de glir bort, og tas ut av
  // stabelen først når animasjonen er ferdig — ellers blinker det.
  const [lukkende, setLukkende] = useState<Set<number>>(new Set());
  const lukkendeRef = useRef(lukkende);
  lukkendeRef.current = lukkende;

  const stabelRef = useRef(stabel);
  stabelRef.current = stabel;

  /**
   * Klikk utenfor: alle arkene glir ut samtidig, med samme utgang som ett.
   * Før tok klikket bare det øverste, og arket under ble hengende.
   */
  const lukkAlle = useCallback(() => {
    const alle = stabelRef.current.map((a) => a.n);
    if (alle.length === 0) return;
    lukkendeRef.current = new Set(alle);
    setLukkende(lukkendeRef.current);
    setTimeout(() => {
      setStabel((x) => x.filter((a) => !alle.includes(a.n)));
      setLukkende(new Set());
    }, UT_MS);
  }, []);

  const lukk = useCallback(() => {
    const topp = [...stabelRef.current]
      .reverse()
      .find((a) => !lukkendeRef.current.has(a.n));
    if (!topp) return;
    const n = topp.n;
    // Merkes med en gang, så et nytt Esc midt i animasjonen tar neste ark.
    lukkendeRef.current = new Set(lukkendeRef.current).add(n);
    setLukkende(lukkendeRef.current);
    setTimeout(() => {
      setStabel((x) => x.filter((a) => a.n !== n));
      setLukkende((l) => {
        const ny = new Set(l);
        ny.delete(n);
        return ny;
      });
    }, UT_MS);
  }, []);

  const gaTil = (visning: Utgang, id?: string) => {
    setStabel([]);
    setLukkende(new Set());
    onGaTil(visning, id);
  };

  const api: Api = {
    apneOkt: (id) => legg({ type: "okt", id }),
    apneVurdering: (id) => legg({ type: "vurdering", id }),
    apneFag: (id) => legg({ type: "fag", id }),
    apneElev: (id, valg) => legg({ type: "elev", id, ...valg }),
    lukk,
  };

  // Esc tar ett nivå tilbake. Fanges før alt annet (capture), så elevkortets
  // egen Esc-lytter ikke også lukker — da ville to nivåer forsvunnet på én
  // gang. I et felt angrer Esc teksten, og da lar vi den være.
  useEffect(() => {
    if (stabel.length === 0) return;
    const tast = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const i = e.target as HTMLElement;
      if (i.closest?.("input, textarea, select")) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      lukk();
    };
    window.addEventListener("keydown", tast, true);
    return () => window.removeEventListener("keydown", tast, true);
  }, [stabel.length, lukk]);

  const aktive = stabel.filter((a) => !lukkende.has(a.n));

  return (
    <Kontekst.Provider value={api}>
      {children}

      {stabel.length > 0 && (
        <div
          className={`fixed inset-0 z-40 transition-colors ${
            aktive.length > 0 ? "bg-teppe/15" : "bg-transparent"
          }`}
          style={{ transitionDuration: `${UT_MS}ms` }}
          onMouseDown={(e) => e.target === e.currentTarget && lukkAlle()}
        >
          {stabel.map((ark, i) => {
            const paVeiUt = lukkende.has(ark.n);
            // Dybden regnes blant arkene som blir stående, så arket under
            // begynner å gli tilbake samtidig som det øverste glir ut.
            const dybde = paVeiUt ? 0 : aktive.length - 1 - aktive.indexOf(ark);
            // Et ark under som glir ut sammen med det over (klikk utenfor),
            // starter utgangen der det står — forskjøvet og krympet — og
            // ikke fra rett posisjon. Ellers hopper det først.
            const utFra = stabel.slice(i + 1).length;
            return (
              <div
                key={ark.n}
                aria-hidden={dybde > 0}
                className={`ark absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-ark shadow-[var(--shadow-ark)] ${
                  paVeiUt
                    ? "gli-ut pointer-events-none"
                    : dybde > 0
                      ? "pointer-events-none"
                      : // Inngangen spilles bare for arket som nettopp ble
                        // åpnet — ikke for det under når det blir øverst igjen.
                        ark.n === teller.current
                        ? "gli-inn"
                        : ""
                }`}
                style={
                  paVeiUt && utFra > 0
                    ? ({
                        "--fra": `translateX(-${utFra * 32}px) scale(0.98)`,
                      } as React.CSSProperties)
                    : dybde > 0
                      ? {
                          // Arket under skyves litt mot venstre, krymper og
                          // dempes — kanten stikker fram, så lagene kan leses.
                          transform: `translateX(-${dybde * 32}px) scale(0.98)`,
                          filter: "brightness(0.94)",
                        }
                      : undefined
                }
              >
                {ark.type === "okt" ? (
                  <OktArk
                    oktId={ark.id}
                    skolearId={skolearId}
                    underst={i === 0}
                    onLukk={lukk}
                    onApneElev={(id) => api.apneElev(id)}
                    onVisIOkter={() => gaTil("okter", ark.id)}
                  />
                ) : ark.type === "vurdering" ? (
                  <VurderingArk
                    vurderingId={ark.id}
                    skolearId={skolearId}
                    underst={i === 0}
                    onLukk={lukk}
                    onApneElev={(id) => api.apneElev(id)}
                    onApneSamtaler={(fagId) => gaTil("samtaler", fagId)}
                  />
                ) : ark.type === "fag" ? (
                  <FagArk
                    fagId={ark.id}
                    skolearId={skolearId}
                    underst={i === 0}
                    onLukk={lukk}
                    onEndret={onFagEndret}
                    onApneElev={(id, liste) =>
                      api.apneElev(id, { liste, startFag: ark.id })
                    }
                    onApneVurdering={api.apneVurdering}
                    onApneVurderinger={() => gaTil("vurderinger")}
                    onLimInn={() => gaTil("liminn", ark.id)}
                  />
                ) : (
                  <ElevArk
                    ark={ark}
                    skolearId={skolearId}
                    underst={i === 0}
                    onLukk={lukk}
                    onApneOkt={api.apneOkt}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </Kontekst.Provider>
  );
}

/** Stripa øverst i et ark: tilbake eller lukk, og en vei videre. */
function Arkhode({
  underst,
  onLukk,
  children,
}: {
  underst: boolean;
  onLukk: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-linje-medium px-5 py-1">
      {!underst && (
        <button
          onClick={onLukk}
          className="text-liten text-blekk-dempet hover:text-blekk"
        >
          <span className="inline-block rotate-180">
            <Ikon navn="pil" />
          </span>{" "}
          Tilbake
        </button>
      )}
      <span className="grow" />
      {children}
    </div>
  );
}

function OktArk({
  oktId,
  skolearId,
  underst,
  onLukk,
  onApneElev,
  onVisIOkter,
}: {
  oktId: string;
  skolearId: string;
  underst: boolean;
  onLukk: () => void;
  onApneElev: (id: string) => void;
  onVisIOkter: () => void;
}) {
  const [okt, setOkt] = useState<Okt | null>(null);

  useEffect(() => {
    let avbrutt = false;
    const last = () =>
      void hentOkter(skolearId).then((o) => {
        if (!avbrutt) setOkt(o.find((x) => x.id === oktId) ?? null);
      });
    last();
    // Endres økta — her eller et annet sted — hentes den på nytt.
    const slutt = lytt(last);
    return () => {
      avbrutt = true;
      slutt();
    };
  }, [oktId, skolearId]);

  return (
    <>
      <Arkhode underst={underst} onLukk={onLukk}>
        <button
          onClick={onVisIOkter}
          className="text-liten text-blekk-svak hover:text-blekk"
        >
          Vis i Økter <Ikon navn="pil" />
        </button>
      </Arkhode>
      <div className="min-h-0 flex-1 overflow-auto">
        {okt && (
          <OktPanel
            key={okt.id}
            okt={okt}
            onLukk={onLukk}
            onEndret={() => {
              void hentOkter(skolearId).then((o) =>
                setOkt(o.find((x) => x.id === oktId) ?? null),
              );
              // Lista under — Økter, uka på forsiden — skal vise det.
              varsleOktvisning();
            }}
            onApneElev={onApneElev}
          />
        )}
      </div>
    </>
  );
}

function VurderingArk({
  vurderingId,
  skolearId,
  underst,
  onLukk,
  onApneElev,
  onApneSamtaler,
}: {
  vurderingId: string;
  skolearId: string;
  underst: boolean;
  onLukk: () => void;
  onApneElev: (id: string) => void;
  onApneSamtaler: (skolearFagId: string) => void;
}) {
  const [vurdering, setVurdering] = useState<Vurdering | null>(null);

  const last = useCallback(
    () =>
      void hentVurderinger(skolearId).then((v) =>
        setVurdering(v.find((x) => x.id === vurderingId) ?? null),
      ),
    [vurderingId, skolearId],
  );
  useEffect(last, [last]);

  return (
    <>
      <Arkhode underst={underst} onLukk={onLukk} />
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        {vurdering && (
          <VurderingPanel
            key={vurdering.id}
            vurdering={vurdering}
            onLukk={onLukk}
            onEndret={() => {
              last();
              // Lista under — Vurderinger eller et fagkort — skal vise det.
              varsleVurderinger();
            }}
            onApneElev={onApneElev}
            onApneSamtaler={onApneSamtaler}
          />
        )}
      </div>
    </>
  );
}

function FagArk({
  fagId,
  skolearId,
  underst,
  onLukk,
  onEndret,
  onApneElev,
  onApneVurdering,
  onApneVurderinger,
  onLimInn,
}: {
  fagId: string;
  skolearId: string;
  underst: boolean;
  onLukk: () => void;
  onEndret: () => void;
  onApneElev: (id: string, liste: string[]) => void;
  onApneVurdering: (id: string) => void;
  onApneVurderinger: () => void;
  onLimInn: () => void;
}) {
  const [fag, setFag] = useState<FagIAr | null>(null);

  const last = useCallback(
    () =>
      void hentFagIAr(skolearId).then((f) =>
        setFag(f.find((x) => x.id === fagId) ?? null),
      ),
    [fagId, skolearId],
  );
  useEffect(last, [last]);

  return (
    <>
      <Arkhode underst={underst} onLukk={onLukk} />
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        {fag && (
          <FagPanel
            key={fag.id}
            fag={fag}
            skolearId={skolearId}
            onLukk={onLukk}
            onEndret={() => {
              last();
              onEndret();
            }}
            onApneElev={onApneElev}
            onApneVurdering={onApneVurdering}
            onApneVurderinger={onApneVurderinger}
            onLimInn={onLimInn}
          />
        )}
      </div>
    </>
  );
}

function ElevArk({
  ark,
  skolearId,
  underst,
  onLukk,
  onApneOkt,
}: {
  ark: Extract<Ark, { type: "elev" }>;
  skolearId: string;
  underst: boolean;
  onLukk: () => void;
  onApneOkt: (id: string) => void;
}) {
  // Blaing mellom elevene i lista kortet ble åpnet fra, f.eks. faget.
  const [elevId, setElevId] = useState(ark.id);
  const [retning, setRetning] = useState<"opp" | "ned" | null>(null);
  const liste = ark.liste ?? [];
  const nr = liste.indexOf(elevId);

  function bla(steg: number) {
    if (nr < 0) return;
    setRetning(steg > 0 ? "opp" : "ned");
    setElevId(liste[(nr + steg + liste.length) % liste.length]);
  }

  return (
    <>
      <Arkhode underst={underst} onLukk={onLukk} />
      <div className="min-h-0 flex-1 overflow-auto">
        <ElevPanel
          key={elevId}
          elevId={elevId}
          aktivtSkolearId={skolearId}
          startFag={ark.startFag}
          onLukk={onLukk}
          onApneOkt={onApneOkt}
          bla={
            nr >= 0 && liste.length > 1
              ? {
                  nr: nr + 1,
                  av: liste.length,
                  retning,
                  forrige: () => bla(-1),
                  neste: () => bla(1),
                }
              : undefined
          }
        />
      </div>
    </>
  );
}
