import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { lytt } from "../data/endringer";
import { hentOkter, type Okt } from "../data/okter";
import { OktPanel } from "../skjermer/OktPanel";
import { ElevPanel } from "../skjermer/ElevPanel";
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
  apneElev: (
    id: string,
    valg?: { liste?: string[]; startFag?: string },
  ) => void;
  /** tar det øverste arket bort */
  lukk: () => void;
};

const Kontekst = createContext<Api | null>(null);

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

export function Arkstabel({
  skolearId,
  onVisIOkter,
  children,
}: {
  skolearId: string;
  /** «Vis i Økter» på et øktark: lukker stabelen og går til lista */
  onVisIOkter: (oktId: string) => void;
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

  const lukk = useCallback(() => setStabel((s) => s.slice(0, -1)), []);

  const api: Api = {
    apneOkt: (id) => legg({ type: "okt", id }),
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

  return (
    <Kontekst.Provider value={api}>
      {children}

      {stabel.length > 0 && (
        <div
          className="fixed inset-0 z-40 bg-blekk/10"
          onMouseDown={(e) => e.target === e.currentTarget && lukk()}
        >
          {stabel.map((ark, i) => {
            const dybde = stabel.length - 1 - i;
            return (
              <div
                key={ark.n}
                aria-hidden={dybde > 0}
                className={`absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-ark shadow-[var(--shadow-ark)] transition-[transform,filter] duration-[var(--tid-inn)] ${
                  dybde === 0 ? "gli-inn" : "pointer-events-none"
                }`}
                style={
                  dybde > 0
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
                    onVisIOkter={() => {
                      setStabel([]);
                      onVisIOkter(ark.id);
                    }}
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
            onEndret={() =>
              void hentOkter(skolearId).then((o) =>
                setOkt(o.find((x) => x.id === oktId) ?? null),
              )
            }
            onApneElev={onApneElev}
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
