import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Okt } from "../data/okter";
import { Ikon } from "../ui/felles";
import { fagfarge } from "../ui/farger";
import { ukenummer } from "../data/kalender";

/**
 * Uka på forsiden, som en kalender: dagene bortover, klokka nedover.
 *
 * Hele skoleåret ligger i én vannrett stripe, og én uke — fem dager — står
 * framme av gangen. Man blar med to fingre på styreflata, eller med pilene.
 * Rullingen snapper til hele uker (`scroll-snap`), så den alltid lander på en
 * mandag, og den er myk fordi det er nettleserens egen rulling som gjør
 * jobben — ingen JavaScript i hvert bilde.
 *
 * Hensikten er å se **formen** på uka: hvor blokkene ligger, og like viktig
 * hvor de ikke ligger. En dag uten økter er en tom kolonne.
 *
 * Høyden er den samme hele året — klokkespennet regnes ut fra alle øktene,
 * ikke fra uka som vises — så ingenting under flytter seg når man blar.
 */

/** Klokka vises alltid minst fra 08 til 16, og utvides om øktene krever det. */
const TIDLIGST = 8;
const SENEST = 16;
/** Piksler per time, når ikke noe annet er valgt. */
const TIME = 28;
/** Høyden på raden for heldagshendelser, når den vises. */
const HELDAG = 24;

/** Det som ligger over hele dagen: fridag, rød dag, hendelse, samtaler. */
export type Heldag = {
  navn: string;
  type: "helligdag" | "fri" | "hendelse" | "samtale";
};

const DAGNAVN = ["man", "tir", "ons", "tor", "fre"];

export function Ukelinje({
  okter,
  forste,
  siste,
  idag,
  onApneOkt,
  time = TIME,
  heldag,
  valgt = null,
  onUke,
}: {
  /** alle øktene i året */
  okter: Okt[];
  /** skoleårets første og siste dag — stripa går fra uka til uka */
  forste: string;
  siste: string;
  idag: string;
  onApneOkt: (id: string) => void;
  /** piksler per time; kalenderens ukevisning er høyere enn forsidens */
  time?: number;
  /** gis den, får hver dag en rad for det som ligger over hele dagen */
  heldag?: (dato: string) => Heldag[];
  /** økta som er valgt, og får en ring rundt seg */
  valgt?: string | null;
  /** mandagen i uka som står framme, når den endres */
  onUke?: (mandag: string) => void;
}) {
  const stripe = useRef<HTMLDivElement>(null);
  const naa = useNaa();

  // Mandagene fra skolestart til skoleslutt, og uka med i dag i seg — også
  // om i dag ligger utenfor året, så forsiden aldri står på en tom stripe.
  const mandager = useMemo(() => {
    const start = mandagFor(forste < idag ? forste : idag);
    const slutt = mandagFor(siste > idag ? siste : idag);
    const ut: string[] = [];
    for (let m = start; m <= slutt; m = leggTil(m, 7)) ut.push(m);
    return ut;
  }, [forste, siste, idag]);

  const perDag = useMemo(() => {
    const kart = new Map<string, Okt[]>();
    for (const o of okter) kart.set(o.dato, [...(kart.get(o.dato) ?? []), o]);
    return kart;
  }, [okter]);

  // Samme spenn hele året, så høyden står fast.
  const [fra, til] = useMemo(() => {
    let f = TIDLIGST;
    let t = SENEST;
    for (const o of okter) {
      if (!o.klokkeslett) continue;
      const s = timer(o.klokkeslett);
      f = Math.min(f, Math.floor(s));
      t = Math.max(t, Math.ceil(s + o.varighetMin / 60));
    }
    return [f, t];
  }, [okter]);
  const hoyde = (til - fra) * time;

  const styrt = useRef(false);
  const slipp = useRef<ReturnType<typeof setTimeout> | null>(null);
  const denneUka = mandagFor(idag);
  const [synlig, setSynlig] = useState(denneUka);
  useEffect(() => onUke?.(synlig), [synlig, onUke]);
  const topp = heldag ? 28 + HELDAG : 28;

  // Uka som står framme, i en ref så bredde-lytteren under ser den ferske.
  const synligRef = useRef(synlig);
  synligRef.current = synlig;
  // Bredden uka sist ble plassert etter. Endres den (zoom, smalere vindu),
  // kommer det rulle-hendelser som ikke er blaing — de skal ikke leses.
  const bredde = useRef(0);

  // Står på denne uka fra start, uten å gli dit. Og holder seg på uka når
  // bredden endrer seg: stripa kan være smalere i første bilde enn når
  // vinduet har lagt seg, og da ble den stående mellom to uker.
  useLayoutEffect(() => {
    const el = stripe.current;
    if (!el) return;
    const plasser = () => {
      const i = mandager.indexOf(synligRef.current);
      if (i < 0) return;
      // Rullingen dette gir, er ikke brukeren som blar. Uten sperren leste
      // lesPosisjon mellomposisjonen og satte uka én bakover.
      styrt.current = true;
      bredde.current = el.clientWidth;
      el.scrollLeft = i * el.clientWidth;
      // Snappingen kan flytte stripa etter at bredden har lagt seg (zoom,
      // 10.6). Ett bilde senere settes den på plass igjen.
      requestAnimationFrame(() => {
        el.scrollLeft = mandager.indexOf(synligRef.current) * el.clientWidth;
      });
      if (slipp.current) clearTimeout(slipp.current);
      slipp.current = setTimeout(() => (styrt.current = false), 150);
    };
    plasser();
    const ro = new ResizeObserver(plasser);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mandager]);

  /**
   * Blar til en uke. Målet regnes ut her, og etiketten settes med en gang —
   * den venter ikke på at rullingen er ferdig.
   */
  function ga(til: "forrige" | "neste" | "idag") {
    const el = stripe.current;
    if (!el) return;
    const na = mandager.indexOf(synlig);
    const mal =
      til === "idag"
        ? mandager.indexOf(denneUka)
        : Math.min(
            Math.max(na + (til === "neste" ? 1 : -1), 0),
            mandager.length - 1,
          );
    setSynlig(mandager[mal]);
    // Mens rullingen glir, forbigår den ukene imellom. De skal ikke vises i
    // etiketten.
    styrt.current = true;
    if (slipp.current) clearTimeout(slipp.current);
    slipp.current = setTimeout(() => (styrt.current = false), 700);
    el.scrollTo({ left: mal * el.clientWidth, behavior: "smooth" });
  }

  /** Uka som står framme etter et sveip på styreflata. */
  function lesPosisjon(el: HTMLDivElement) {
    if (styrt.current || el.clientWidth !== bredde.current) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (mandager[i]) setSynlig(mandager[i]);
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <span className="text-liten tabular-nums text-blekk-dempet">
          {ukeTekst(synlig)}
        </span>
        <span className="grow" />
        <button
          onClick={() => ga("forrige")}
          title="Forrige uke"
          className="rounded px-1.5 py-0.5 text-blekk-dempet hover:bg-flate hover:text-blekk"
        >
          <span className="inline-block rotate-180">
            <Ikon navn="pil" />
          </span>
        </button>
        <button
          onClick={() => ga("idag")}
          disabled={synlig === denneUka}
          className="rounded px-2 py-0.5 text-liten text-blekk-dempet hover:bg-flate hover:text-blekk disabled:opacity-40"
        >
          Denne uka
        </button>
        <button
          onClick={() => ga("neste")}
          title="Neste uke"
          className="rounded px-1.5 py-0.5 text-blekk-dempet hover:bg-flate hover:text-blekk"
        >
          <Ikon navn="pil" />
        </button>
      </div>

      <div className="flex">
        {/* Klokka står fast til venstre mens ukene glir forbi. */}
        <div
          className="w-10 shrink-0"
          style={{ height: hoyde + topp, paddingTop: topp }}
        >
          <div className="relative" style={{ height: hoyde }}>
            {Array.from({ length: til - fra }, (_, i) => {
              // Timen nærmest nå skjules når klokkeslettet står i aksen,
              // så de ikke ligger oppå hverandre.
              const skjult =
                synlig === denneUka &&
                naa >= fra &&
                naa <= til &&
                Math.round(naa) === fra + i;
              return (
                <span
                  key={i}
                  className={`absolute right-1.5 -translate-y-1/2 text-mikro tabular-nums text-blekk-svak ${
                    skjult ? "invisible" : ""
                  }`}
                  style={{ top: i * time }}
                >
                  {String(fra + i).padStart(2, "0")}
                </span>
              );
            })}
            {/* Klokka nå, i aksen (ARBEIDSLISTE 9.3). */}
            {synlig === denneUka && naa >= fra && naa <= til && (
              <span
                className="absolute right-0.5 z-10 -translate-y-1/2 rounded-liten bg-aksent px-1 text-mikro font-medium tabular-nums leading-tight text-ark"
                style={{ top: (naa - fra) * time }}
              >
                {klokke(naa)}
              </span>
            )}
          </div>
        </div>

        <div
          ref={stripe}
          onScroll={(e) => lesPosisjon(e.currentTarget)}
          className="flex min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain scrollbar-skjult"
        >
          {mandager.map((mandag) => (
            <div
              key={mandag}
              className="grid w-full shrink-0 snap-start grid-cols-5"
            >
              {DAGNAVN.map((navn, d) => {
                const dato = leggTil(mandag, d);
                return (
                  <Dag
                    key={dato}
                    navn={navn}
                    dato={dato}
                    okter={perDag.get(dato) ?? []}
                    idag={idag}
                    fra={fra}
                    hoyde={hoyde}
                    naa={mandag === mandagFor(idag) ? naa : null}
                    onApneOkt={onApneOkt}
                    time={time}
                    heldag={heldag ? heldag(dato) : null}
                    valgt={valgt}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Dag({
  navn,
  dato,
  okter,
  idag,
  fra,
  hoyde,
  naa,
  onApneOkt,
  time,
  heldag,
  valgt,
}: {
  navn: string;
  dato: string;
  okter: Okt[];
  idag: string;
  fra: number;
  hoyde: number;
  /** klokka nå i timer fra midnatt, når dagen er i inneværende uke */
  naa: number | null;
  onApneOkt: (id: string) => void;
  time: number;
  /** null = ingen heldagsrad */
  heldag: Heldag[] | null;
  valgt: string | null;
}) {
  const erIdag = dato === idag;
  const passert = dato < idag;
  const baner = fordelPaBaner(okter, fra);

  return (
    <div className="min-w-0 border-l border-linje-svak first:border-l-0">
      <div
        className={`flex h-7 items-baseline gap-1.5 px-1.5 pt-1 text-liten tabular-nums ${
          erIdag
            ? "font-medium text-aksent"
            : passert
              ? "text-blekk-svakest"
              : "text-blekk-dempet"
        }`}
      >
        {navn} {Number(dato.slice(8))}.
      </div>
      {heldag && (
        <div
          className="flex items-center gap-1 overflow-hidden border-b border-linje-svak px-1"
          style={{ height: HELDAG }}
        >
          {heldag.map((h, i) => (
            <span
              key={i}
              title={h.navn}
              className={`min-w-0 truncate rounded-liten px-1.5 text-mikro leading-5 ${HELDAGSTONE[h.type]}`}
            >
              {h.navn}
            </span>
          ))}
        </div>
      )}
      <div
        className={`relative ${erIdag ? "bg-valgt/40" : ""}`}
        style={{
          height: hoyde,
          // Timelinjer bak øktene, som linjene i en klassejournal.
          backgroundImage: `repeating-linear-gradient(to bottom, var(--color-linje-svak) 0 1px, transparent 1px ${time}px)`,
        }}
      >
        {/* Den svake streken ligger bak øktene, den sterke over. */}
        {naa !== null && !erIdag && (
          <Naalinje
            naa={naa}
            fra={fra}
            hoyde={hoyde}
            time={time}
            sterk={false}
          />
        )}
        {baner.map((bane, b) =>
          bane.map((o) => (
            <Blokk
              key={o.id}
              okt={o}
              fra={fra}
              bane={b}
              baner={baner.length}
              time={time}
              valgt={valgt === o.id}
              onApne={() => onApneOkt(o.id)}
            />
          )),
        )}
        {/*
          Tiden som har gått: fagfargene dempes og et lyst slør legges over
          (ARBEIDSLISTE 9.3) — ikke grått. Hele dagen for dager som er
          passert, fram til nå i dag.
        */}
        {(passert || (erIdag && naa !== null)) && (
          <div
            aria-hidden
            className="passert-slor pointer-events-none absolute inset-x-0 top-0 z-[5]"
            style={{
              height: passert
                ? hoyde
                : Math.min(Math.max((naa! - fra) * time, 0), hoyde),
            }}
          />
        )}
        {naa !== null && erIdag && (
          <Naalinje naa={naa} fra={fra} hoyde={hoyde} time={time} sterk />
        )}
      </div>
    </div>
  );
}

/**
 * Streken for klokka nå, som i Fantastical: tydelig med en prikk og
 * klokkeslettet i dagens kolonne, svak over resten av uka. Står utenfor
 * kalenderens klokkespenn, vises den ikke.
 */
function Naalinje({
  naa,
  fra,
  hoyde,
  time,
  sterk,
}: {
  naa: number;
  fra: number;
  hoyde: number;
  time: number;
  sterk: boolean;
}) {
  const topp = (naa - fra) * time;
  if (topp < 0 || topp > hoyde) return null;

  // Klokkeslettet står i aksen til venstre, ikke her (ARBEIDSLISTE 9.3).
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-x-0 ${sterk ? "z-10" : ""}`}
      style={{ top: topp }}
    >
      {sterk ? (
        <>
          <span className="absolute -top-[1.5px] left-0 right-0 h-[3px] rounded-full bg-aksent" />
          <span className="absolute -left-[4px] -top-[4px] h-[9px] w-[9px] rounded-full bg-aksent" />
        </>
      ) : (
        <span className="absolute left-0 right-0 top-0 h-px bg-aksent/40" />
      )}
    </div>
  );
}

/** «10:40» fra timer siden midnatt. */
function klokke(naa: number): string {
  const t = Math.floor(naa);
  const m = Math.floor((naa - t) * 60);
  return `${String(t).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Klokka nå i timer fra midnatt, oppdatert hvert halve minutt. */
const HELDAGSTONE: Record<Heldag["type"], string> = {
  helligdag:
    "bg-helligdag-flate text-blekk shadow-[inset_0_0_0_1px_var(--color-helligdag-kant)]",
  fri: "bg-fri-flate text-blekk-dempet",
  hendelse: "bg-hendelse-flate text-blekk-dempet",
  samtale: "bg-ark text-aksent shadow-[inset_0_0_0_1px_var(--color-aksent)]",
};

function useNaa(): number {
  const les = () => {
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  };
  const [naa, setNaa] = useState(les);
  useEffect(() => {
    const t = setInterval(() => setNaa(les()), 30_000);
    return () => clearInterval(t);
  }, []);
  return naa;
}

function Blokk({
  okt,
  fra,
  bane,
  baner,
  time,
  valgt,
  onApne,
}: {
  okt: Okt;
  fra: number;
  bane: number;
  baner: number;
  time: number;
  valgt: boolean;
  onApne: () => void;
}) {
  // Uten klokkeslett vet vi ikke hvor på dagen den hører hjemme. Da legges
  // den øverst med stiplet kant, framfor å stå et sted som ser presist ut.
  const utenTid = !okt.klokkeslett;
  const [start, slutt] = spennet(okt, fra);
  const topp = (start - fra) * time;
  const hoyde = Math.max((slutt - start) * time - 2, 16);

  return (
    <button
      onClick={onApne}
      title={`${okt.fagKode}${okt.tema ? `: ${okt.tema}` : ""}${
        okt.klokkeslett ? ` · ${okt.klokkeslett}` : " · uten klokkeslett"
      }${okt.sted ? ` · ${okt.sted}` : ""}`}
      className={`absolute overflow-hidden rounded-liten bg-ark px-1.5 py-0.5 text-left text-mikro leading-tight hover:brightness-95 ${
        utenTid ? "border border-dashed border-linje-sterk" : ""
      } ${valgt ? "z-10 ring-2 ring-aksent" : ""}`}
      style={{
        top: topp + 1,
        height: hoyde,
        left: `calc(${(bane / baner) * 100}% + 2px)`,
        width: `calc(${100 / baner}% - 4px)`,
        // Svak tone i fagfargen oppå arket (DESIGN.md §4) — gradienten er
        // bare en måte å legge tonen over bg-ark på, så den ikke blir
        // gjennomsiktig mot rutenettet under.
        backgroundImage: okt.farge
          ? `linear-gradient(${okt.farge}1c, ${okt.farge}1c)`
          : undefined,
      }}
    >
      <span
        className="block truncate font-medium"
        style={{ color: okt.farge ? fagfarge(okt.farge) : undefined }}
      >
        {okt.fagKode}
        {okt.klokkeslett && (
          <span className="ml-1 font-normal tabular-nums text-blekk-svak">
            {okt.klokkeslett}
          </span>
        )}
      </span>
      {okt.tema && (
        <span className="block truncate text-blekk">{okt.tema}</span>
      )}
      {/* Rommet i liten grå skrift (ARBEIDSLISTE 7.5). */}
      {okt.sted && (
        <span className="block truncate text-blekk-svak">{okt.sted}</span>
      )}
    </button>
  );
}

/**
 * Hvor på dagen en økt ligger, i timer fra midnatt.
 *
 * Uten klokkeslett legges den først på aksen med én times lengde — samme
 * plassering som `Blokk` tegner den. De to må regne likt, ellers legges to
 * økter uten klokkeslett oppå hverandre.
 */
export function spennet(o: Okt, fra: number): [number, number] {
  if (!o.klokkeslett) return [fra, fra + 1];
  const start = timer(o.klokkeslett);
  return [start, start + o.varighetMin / 60];
}

/**
 * Deler øktene i baner slik at to som overlapper står side om side i
 * stedet for oppå hverandre.
 *
 * Det skjer sjelden — men når det gjør det, er det som regel en feil man vil
 * se, ikke skjule.
 */
export function fordelPaBaner(okter: Okt[], fra: number): Okt[][] {
  const sortert = [...okter].sort(
    (a, b) => spennet(a, fra)[0] - spennet(b, fra)[0],
  );
  const baner: Okt[][] = [];

  for (const o of sortert) {
    const [start, slutt] = spennet(o, fra);
    const plass = baner.find((bane) =>
      bane.every((b) => {
        const [bs, bslutt] = spennet(b, fra);
        return start >= bslutt || slutt <= bs;
      }),
    );
    if (plass) plass.push(o);
    else baner.push([o]);
  }
  return baner;
}

/** «Uke 40 · 28. sep – 2. okt» */
export function ukeTekst(mandag: string): string {
  const fredag = leggTil(mandag, 4);
  const kort = (d: string) =>
    new Date(`${d}T12:00:00`)
      .toLocaleDateString("nb-NO", { day: "numeric", month: "short" })
      .replace(/\.$/, "");
  return `Uke ${ukenummer(mandag)} · ${kort(mandag)} – ${kort(fredag)}`;
}

function timer(klokkeslett: string): number {
  const [t, m] = klokkeslett.split(":").map(Number);
  return t + (m || 0) / 60;
}

export function leggTil(dato: string, dager: number): string {
  const d = new Date(`${dato}T12:00:00`);
  d.setDate(d.getDate() + dager);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Mandagen i uka datoen ligger i. */
export function mandagFor(dato: string): string {
  const d = new Date(`${dato}T12:00:00`);
  return leggTil(dato, -((d.getDay() + 6) % 7));
}
