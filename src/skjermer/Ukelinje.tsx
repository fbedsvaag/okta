import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Okt } from "../data/okter";
import { Ikon } from "../ui/felles";
import { fagfarge } from "../ui/farger";

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
/** Piksler per time. */
const TIME = 28;

const DAGNAVN = ["man", "tir", "ons", "tor", "fre"];

export function Ukelinje({
  okter,
  forste,
  siste,
  idag,
  onApneOkt,
}: {
  /** alle øktene i året */
  okter: Okt[];
  /** skoleårets første og siste dag — stripa går fra uka til uka */
  forste: string;
  siste: string;
  idag: string;
  onApneOkt: (id: string) => void;
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
  const hoyde = (til - fra) * TIME;

  const styrt = useRef(false);
  const slipp = useRef<ReturnType<typeof setTimeout> | null>(null);
  const denneUka = mandagFor(idag);
  const [synlig, setSynlig] = useState(denneUka);

  // Uka som står framme, i en ref så bredde-lytteren under ser den ferske.
  const synligRef = useRef(synlig);
  synligRef.current = synlig;

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
      el.scrollLeft = i * el.clientWidth;
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
    if (styrt.current) return;
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
        <div className="w-8 shrink-0 pt-7" style={{ height: hoyde + 28 }}>
          <div className="relative" style={{ height: hoyde }}>
            {Array.from({ length: til - fra }, (_, i) => (
              <span
                key={i}
                className="absolute -translate-y-1/2 text-mikro tabular-nums text-blekk-svakest"
                style={{ top: i * TIME }}
              >
                {String(fra + i).padStart(2, "0")}
              </span>
            ))}
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
      <div
        className={`relative ${erIdag ? "bg-valgt/40" : ""}`}
        style={{
          height: hoyde,
          // Timelinjer bak øktene, som linjene i en klassejournal.
          backgroundImage: `repeating-linear-gradient(to bottom, var(--color-linje-svak) 0 1px, transparent 1px ${TIME}px)`,
        }}
      >
        {/* Den svake streken ligger bak øktene, den sterke over. */}
        {naa !== null && !erIdag && (
          <Naalinje naa={naa} fra={fra} hoyde={hoyde} sterk={false} />
        )}
        {baner.map((bane, b) =>
          bane.map((o) => (
            <Blokk
              key={o.id}
              okt={o}
              fra={fra}
              bane={b}
              baner={baner.length}
              dempet={passert}
              onApne={() => onApneOkt(o.id)}
            />
          )),
        )}
        {naa !== null && erIdag && (
          <Naalinje naa={naa} fra={fra} hoyde={hoyde} sterk />
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
  sterk,
}: {
  naa: number;
  fra: number;
  hoyde: number;
  sterk: boolean;
}) {
  const topp = (naa - fra) * TIME;
  if (topp < 0 || topp > hoyde) return null;
  const t = Math.floor(naa);
  const m = Math.floor((naa - t) * 60);
  const klokke = `${String(t).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-x-0 ${sterk ? "z-10" : ""}`}
      style={{ top: topp }}
    >
      {sterk ? (
        <>
          <span className="absolute -top-px left-0 right-0 h-[2px] bg-aksent" />
          <span className="absolute -left-[3px] -top-[3px] h-2 w-2 rounded-full bg-aksent" />
          <span className="absolute -top-4 left-1 rounded-liten bg-aksent px-1 text-mikro font-medium tabular-nums leading-tight text-ark">
            {klokke}
          </span>
        </>
      ) : (
        <span className="absolute left-0 right-0 top-0 h-px bg-aksent/30" />
      )}
    </div>
  );
}

/** Klokka nå i timer fra midnatt, oppdatert hvert halve minutt. */
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
  dempet,
  onApne,
}: {
  okt: Okt;
  fra: number;
  bane: number;
  baner: number;
  dempet: boolean;
  onApne: () => void;
}) {
  // Uten klokkeslett vet vi ikke hvor på dagen den hører hjemme. Da legges
  // den øverst med stiplet kant, framfor å stå et sted som ser presist ut.
  const utenTid = !okt.klokkeslett;
  const [start, slutt] = spennet(okt, fra);
  const topp = (start - fra) * TIME;
  const hoyde = Math.max((slutt - start) * TIME - 2, 16);

  return (
    <button
      onClick={onApne}
      title={`${okt.fagKode}${okt.tema ? ` — ${okt.tema}` : ""}${
        okt.klokkeslett ? ` · ${okt.klokkeslett}` : " · uten klokkeslett"
      }${okt.sted ? ` · ${okt.sted}` : ""}`}
      className={`absolute overflow-hidden rounded-liten bg-ark px-1.5 py-0.5 text-left text-mikro leading-tight hover:brightness-95 ${
        utenTid ? "border border-dashed border-linje-sterk" : ""
      } ${dempet ? "opacity-55" : ""}`}
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
        <span className="block text-blekk-dempet [overflow-wrap:anywhere]">
          {okt.tema}
        </span>
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
  return `Uke ${isoUke(mandag)} · ${kort(mandag)} – ${kort(fredag)}`;
}

function isoUke(dato: string): number {
  const [a, m, d] = dato.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const nyttar = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - nyttar) / 86400000 + 1) / 7);
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
