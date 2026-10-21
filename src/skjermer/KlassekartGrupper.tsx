import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import {
  hentOppsett,
  lagreOppsett,
  navngiOppsett,
  sammenFor,
  slettOppsett,
  type Elevregel,
  type Innstillinger,
  type Kart,
  type Kartelev,
  type Oppsett,
} from "../data/klassekart";
import {
  fordelGrupper,
  gruppestorrelser,
  type Brudd,
  type Modus,
} from "../data/fordeling";
import { gruppeListe, kortnavn } from "../data/karttegning";
import { IVerktoylinja } from "../ui/Verktoylinje";
import { Bryter } from "../ui/felles";
import { Elevfoto } from "../ui/Elevfoto";
import { Avkrysning, innsatsfarge } from "./KlassekartKart";
import { hovedtast, tast as visTast } from "../ui/taster";
import { PULTFARGER } from "../data/pultfarger";
import { Gruppebilde } from "./Gruppebilde";

/**
 * Klassekartet — Grupper (SPEC §4.11, lerretet «KlassekartGrupper»).
 *
 * Antall grupper med − og +; størrelsen regnes ut («á 4–5»), og går det
 * ikke opp, blir noen én større. Gruppene er kort med svak farge og nummer,
 * og navnet kan skrives om. Elever dras mellom gruppene. Kopier til Teams og
 * Skriv ut lagrer gruppesettet, som blir historikken «Unngå samme grupper
 * som sist» regner på.
 */
/** Hvor lenge navnet bruker på å lande når det slippes (ms). */
const LANDING = 280;

/** Et lagret gruppesett for en annen klasse eller et annet fag (25.7). */
export type AnnetSett = {
  kilde: string;
  kildeNavn: string;
  farge: string | null;
  oppsett: Oppsett;
};

export function KlassekartGrupper({
  kart,
  innst,
  elever: alle,
  borte,
  regler,
  andreSett,
  startOppsett,
  onApneAnnet,
  onEndreInnst,
  kildevelger,
}: {
  kart: Kart;
  innst: Innstillinger;
  elever: Kartelev[];
  /** borte i dag (25.5): med «Bare de som er her» er de ikke med */
  borte: Set<string>;
  regler: Elevregel[];
  /** settene for de andre kildene, under kildens egne i «Lagrede grupper» */
  andreSett: AnnetSett[];
  /** et lagret sett som skal vises i stedet for det siste */
  startOppsett?: string | null;
  onApneAnnet: (kilde: string, oppsettId: string) => void;
  onEndreInnst: (endring: Partial<Innstillinger>) => void;
  /** chipene for klasse/fag, til venstre i linja med Stokk */
  kildevelger?: ReactNode;
}) {
  const bareHer = innst.bareHer !== false;
  const elever = bareHer ? alle.filter((e) => !borte.has(e.id)) : alle;
  const borteNa = bareHer ? alle.filter((e) => borte.has(e.id)) : [];
  const [grupper, setGrupper] = useState<string[][]>([]);
  const [navn, setNavn] = useState<(string | null)[]>([]);
  const [historikk, setHistorikk] = useState<Oppsett[]>([]);
  const [brudd, setBrudd] = useState<Brudd[]>([]);
  const [lagret, setLagret] = useState(true);
  const [melding, setMelding] = useState<string | null>(null);
  // Navnet på gruppesettet, og hvilket lagret sett som vises (null = nytt).
  const [settNavn, setSettNavn] = useState("");
  const [aktivt, setAktivt] = useState<string | null>(null);
  const [visTidligere, setVisTidligere] = useState(false);
  const [visBilde, setVisBilde] = useState(false);
  const tidligereKnapp = useRef<HTMLButtonElement>(null);
  const [tidligerePos, setTidligerePos] = useState({ top: 0, right: 0 });
  useLayoutEffect(() => {
    const r = tidligereKnapp.current?.getBoundingClientRect();
    if (visTidligere && r)
      setTidligerePos({
        top: r.bottom + 6,
        right: window.innerWidth - r.right,
      });
  }, [visTidligere]);

  const elevAv = new Map(alle.map((e) => [e.id, e]));
  // Antall grupper, eller hvor mange per gruppe (25.4).
  const per = innst.perGruppe ?? null;
  const antall =
    per !== null
      ? Math.max(1, Math.round(elever.length / Math.max(1, per)))
      : Math.max(1, Math.min(innst.antallGrupper, elever.length || 1));
  const storrelser = gruppestorrelser(elever.length, antall);
  const minst = Math.min(...storrelser);
  const storst = Math.max(...storrelser);

  /** Viser et lagret gruppesett, med de elevene som fortsatt er med. */
  function visOppsett(o: Oppsett) {
    const iKilden = new Set(alle.map((e) => e.id));
    const n = Math.max(...o.rader.map((r) => r.gruppe ?? 0)) + 1;
    const gr: string[][] = Array.from({ length: n }, () => []);
    const nv: (string | null)[] = Array(n).fill(null);
    for (const r of o.rader)
      if (r.gruppe !== null && iKilden.has(r.elevId)) {
        gr[r.gruppe].push(r.elevId);
        nv[r.gruppe] = r.gruppenavn;
      }
    // Nye elever i den minste gruppa.
    const med = new Set(gr.flat());
    for (const e of elever)
      if (!med.has(e.id))
        gr.reduce((a, b) => (b.length < a.length ? b : a)).push(e.id);
    husk();
    setGrupper(gr);
    setNavn(nv);
    setBrudd([]);
    setAktivt(o.id);
    setSettNavn(o.navn ?? "");
    setLagret(true);
  }

  useEffect(() => {
    void (async () => {
      const h = await hentOppsett(kart.id, "gruppe");
      setHistorikk(h);
      // Start fra settet som ble valgt, eller sist brukte.
      const start = h.find((o) => o.id === startOppsett) ?? h[0];
      if (start) visOppsett(start);
      else stokk(h);
    })();
    // Bare når kartet byttes: ikke når elevene lastes på nytt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kart.id, startOppsett, alle.length]);

  /*
   * FLIP (25.6): når gruppene stokkes eller antallet endres, glir hvert
   * navn rolig fra der det sto til den nye plassen (420 ms, ingen sprett).
   */
  const foer = useRef<Map<string, DOMRect> | null>(null);
  function husk() {
    const m = new Map<string, DOMRect>();
    document
      .querySelectorAll<HTMLElement>("[data-elev-rad]")
      .forEach((el) => m.set(el.dataset.elevRad!, el.getBoundingClientRect()));
    foer.current = m;
  }
  useLayoutEffect(() => {
    const m = foer.current;
    foer.current = null;
    // Første visning (ingenting å flytte fra): ingen animasjon.
    if (!m || m.size === 0) return;
    if (document.documentElement.dataset.bevegelse === "av") return;
    document.querySelectorAll<HTMLElement>("[data-elev-rad]").forEach((el) => {
      const a = m.get(el.dataset.elevRad!);
      const b = el.getBoundingClientRect();
      if (!a) {
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260 });
        return;
      }
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (dx || dy)
        el.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
          { duration: 420, easing: "cubic-bezier(.22,1,.36,1)" },
        );
    });
  }, [grupper]);

  function stokk(h = historikk, n = antall, med = elever) {
    husk();
    const hist = sammenFor(
      h,
      (a, b) => a.gruppe !== null && a.gruppe === b.gruppe,
    );
    const r = fordelGrupper({
      elever: med,
      antall: n,
      laste: new Map(),
      holdFra: regler.map((x) => [x.elevA, x.elevB] as [string, string]),
      historikk: hist.vekt,
      modus: innst.fordeling as Modus,
      bland: innst.bland,
      unnga: innst.unnga,
      frø: Math.floor(Math.random() * 2 ** 31),
    });
    setGrupper(r.grupper);
    setNavn((nv) => r.grupper.map((_, i) => nv[i] ?? null));
    setBrudd(r.brudd);
    setLagret(false);
    setAktivt(null);
    setSettNavn("");
  }

  /** − / +: antall grupper, eller elever per gruppe. */
  function endreTall(d: number) {
    if (per !== null) {
      const ny = Math.max(2, Math.min(elever.length, per + d));
      if (ny === per) return;
      onEndreInnst({ perGruppe: ny });
      stokk(historikk, Math.max(1, Math.round(elever.length / ny)));
    } else {
      const maks = Math.max(1, Math.floor(elever.length / 2));
      const ny = Math.max(1, Math.min(maks, antall + d));
      if (ny === antall) return;
      onEndreInnst({ antallGrupper: ny });
      stokk(historikk, ny);
    }
  }

  function settBareHer(pa: boolean) {
    onEndreInnst({ bareHer: pa });
    stokk(historikk, antall, pa ? alle.filter((e) => !borte.has(e.id)) : alle);
  }

  async function bruk(hvorfor?: string) {
    const id = await lagreOppsett(
      kart.id,
      "gruppe",
      grupper.flatMap((g, i) =>
        g.map((elevId) => ({ elevId, gruppe: i, gruppenavn: navn[i] ?? null })),
      ),
      settNavn,
    );
    setHistorikk(await hentOppsett(kart.id, "gruppe"));
    setAktivt(id);
    setLagret(true);
    setMelding(
      hvorfor ??
        (settNavn.trim()
          ? `«${settNavn.trim()}» er lagret`
          : "Gruppene er lagret"),
    );
  }

  /** Nytt navn på settet som vises, når det alt er lagret. */
  async function navngi() {
    if (!lagret || !aktivt) return;
    const o = historikk.find((x) => x.id === aktivt);
    if ((o?.navn ?? "") === settNavn.trim()) return;
    await navngiOppsett(aktivt, settNavn);
    setHistorikk(await hentOppsett(kart.id, "gruppe"));
  }

  async function slettSett(o: Oppsett) {
    await slettOppsett(o.id);
    const h = await hentOppsett(kart.id, "gruppe");
    setHistorikk(h);
    if (o.id === aktivt) {
      setAktivt(null);
      setLagret(false);
    }
    setMelding(`${o.navn ? `«${o.navn}»` : "Gruppesettet"} er slettet`);
  }

  const tekst = () =>
    gruppeListe({ tittel: kart.kildeNavn, grupper, navn, elever });

  async function teams() {
    await navigator.clipboard.writeText(tekst());
    if (!lagret) await bruk("Kopiert til Teams, og lagret");
    else setMelding("Kopiert til Teams");
  }

  async function skrivUt() {
    if (!lagret) await bruk();
    await invoke("skriv_ut");
  }

  useEffect(() => {
    const tast = (e: KeyboardEvent) => {
      if (!hovedtast(e)) return;
      const k = e.key.toLowerCase();
      if (k === "r" && !e.shiftKey) {
        e.preventDefault();
        stokk();
      } else if (k === "p" && !e.shiftKey) {
        e.preventDefault();
        void skrivUt();
      }
    };
    window.addEventListener("keydown", tast);
    return () => window.removeEventListener("keydown", tast);
  });

  useEffect(() => {
    if (!melding) return;
    const t = window.setTimeout(() => setMelding(null), 3500);
    return () => window.clearTimeout(t);
  }, [melding]);

  // ------------------------------------------------------------- å dra

  const [dra, setDra] = useState<{
    elevId: string;
    x: number;
    y: number;
    flyttet: boolean;
    /** gruppa pekeren er over nå; null = ingen */
    mal: number | null;
    /** sluppet: navnet glir til plassen sin før gruppene oppdateres */
    lander?: boolean;
  } | null>(null);
  const draRef = useRef(dra);
  draRef.current = dra;

  useEffect(() => {
    if (!dra) return;
    const flytter = (e: PointerEvent) => {
      const over = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest<HTMLElement>("[data-gruppe]");
      const mal = over ? Number(over.dataset.gruppe) : null;
      setDra(
        (d) =>
          d && {
            ...d,
            x: e.clientX,
            y: e.clientY,
            mal,
            flyttet:
              d.flyttet || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4,
          },
      );
    };
    const slipp = () => {
      window.removeEventListener("pointermove", flytter);
      window.removeEventListener("pointerup", slipp);
      const d = draRef.current;
      if (!d?.flyttet) {
        setDra(null);
        return;
      }
      // Navnet glir rolig ned på plassen sin — den nye i gruppa, eller
      // tilbake der det kom fra — og først da oppdateres gruppene.
      const plass =
        document.querySelector<HTMLElement>("[data-gruppe-plass]") ??
        document.querySelector<HTMLElement>(`[data-elev-rad="${d.elevId}"]`);
      const r = plass?.getBoundingClientRect();
      const flytt =
        d.mal !== null && !!document.querySelector("[data-gruppe-plass]");
      setDra({
        ...d,
        lander: true,
        x: r ? r.left + 64 : d.x,
        y: r ? r.top + r.height / 2 : d.y,
      });
      window.setTimeout(() => {
        if (flytt && d.mal !== null) {
          const til = d.mal;
          setGrupper((gr) => {
            const ny = gr.map((g) => g.filter((x) => x !== d.elevId));
            ny[til].push(d.elevId);
            return ny;
          });
          setLagret(false);
        }
        setDra(null);
      }, LANDING);
    };
    window.addEventListener("pointermove", flytter);
    window.addEventListener("pointerup", slipp);
    return () => {
      window.removeEventListener("pointermove", flytter);
      window.removeEventListener("pointerup", slipp);
    };
  }, [dra !== null]);

  const navnPa = (id: string) => {
    const e = elevAv.get(id);
    return e ? kortnavn(e) : "?";
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <IVerktoylinja>
        {melding && (
          <span role="status" className="truncate text-liten text-aksent">
            {melding}
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          <input
            value={settNavn}
            onChange={(e) => setSettNavn(e.target.value)}
            onBlur={() => void navngi()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (lagret) void navngi();
                else void bruk();
              }
            }}
            placeholder="Navn på gruppene"
            aria-label="Navn på gruppene"
            className="h-8 w-44 min-w-0 rounded-full border border-linje bg-ark px-3 text-brod outline-none placeholder:text-blekk-svakest focus:border-aksent"
          />
          <button
            ref={tidligereKnapp}
            onClick={() => setVisTidligere((v) => !v)}
            disabled={historikk.length + andreSett.length === 0}
            className="flex h-8 items-center rounded-full border border-linje-sterk bg-ark/70 px-3.5 text-brod hover:bg-ark disabled:border-transparent disabled:bg-transparent disabled:text-blekk-svak"
          >
            Lagrede grupper
            <span className="ml-1.5 text-[11px] text-blekk-svak">⌄</span>
          </button>
          <button
            onClick={() => void teams()}
            className="flex h-8 items-center rounded-full border border-linje-sterk bg-ark/70 px-3.5 text-brod hover:bg-ark"
          >
            Kopier til Teams
          </button>
          <button
            onClick={() => setVisBilde(true)}
            className="flex h-8 items-center rounded-full border border-linje-sterk bg-ark/70 px-3.5 text-brod hover:bg-ark"
          >
            Bilde til elevene
          </button>
          <button
            onClick={() => void skrivUt()}
            className="flex h-8 items-center rounded-full border border-linje-sterk bg-ark/70 px-3.5 text-brod hover:bg-ark"
          >
            Skriv ut
          </button>
        </span>
      </IVerktoylinja>

      {/* Papiret: gruppene med navn, uten bilder og farger. */}
      <div className="kunutskrift">
        <h1 className="mb-4 text-[18px] font-semibold">{kart.kildeNavn}</h1>
        <div className="grid grid-cols-3 gap-4">
          {grupper.map((g, i) => (
            <div
              key={i}
              className="break-inside-avoid border border-[#ccc] p-3"
            >
              <p className="mb-1.5 font-semibold">
                {navn[i]?.trim() || `Gruppe ${i + 1}`}
              </p>
              {g.map((id) => (
                <p key={id}>{navnPa(id)}</p>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="ikkeutskrift flex flex-wrap items-center gap-2 pb-3">
        {kildevelger}
        <span className="flex-1" />
        <button
          onClick={() => void bruk()}
          disabled={lagret}
          className="flex h-[30px] items-center rounded-full border border-linje-sterk bg-ark px-3 text-[13px] hover:bg-flate disabled:border-transparent disabled:bg-transparent disabled:text-blekk-svak"
        >
          {lagret ? (historikk[0] ? "Lagret" : "Ikke lagret ennå") : "Lagre"}
        </button>
        <button
          onClick={() => stokk()}
          className="flex h-[30px] items-center gap-2 rounded-full bg-aksent px-3 text-[13px] font-medium text-ark hover:bg-aksent-mork"
        >
          Stokk
          <span className="text-[11px] opacity-65">{visTast("⌘R")}</span>
        </button>
      </div>
      <div className="ikkeutskrift flex flex-wrap items-center gap-x-3.5 gap-y-2.5 rounded-[14px] bg-flate-svak px-2.5 py-2">
        <Bryter
          storrelse="liten"
          verdi={per !== null ? "per" : "antall"}
          settVerdi={(v) => {
            if (v === "per") {
              onEndreInnst({
                perGruppe: Math.max(2, Math.round(elever.length / antall)),
              });
            } else {
              onEndreInnst({ perGruppe: null, antallGrupper: antall });
            }
          }}
          valg={[
            { id: "antall", navn: "Antall" },
            { id: "per", navn: "Per gruppe" },
          ]}
        />
        <span className="inline-flex items-center rounded-md bg-ark shadow-[inset_0_0_0_1px_var(--color-linje)]">
          <button
            aria-label={per !== null ? "Færre per gruppe" : "Færre grupper"}
            onClick={() => endreTall(-1)}
            className="h-7 w-7 text-blekk-dempet hover:text-blekk"
          >
            −
          </button>
          <span className="min-w-[22px] text-center font-semibold tabular-nums">
            {per ?? storrelser.length}
          </span>
          <button
            aria-label={per !== null ? "Flere per gruppe" : "Flere grupper"}
            onClick={() => endreTall(1)}
            className="h-7 w-7 text-blekk-dempet hover:text-blekk"
          >
            +
          </button>
        </span>
        <span className="min-w-[118px] text-[calc(12.5px*var(--tekst-skala))] tabular-nums text-blekk-dempet">
          {elever.length === 0
            ? ""
            : per !== null
              ? `${storrelser.length} grupper · ${elever.length} elever`
              : `á ${minst === storst ? minst : `${minst}–${storst}`} · ${elever.length} elever`}
        </span>
        <Bryter
          storrelse="liten"
          verdi={innst.fordeling}
          settVerdi={(v) => onEndreInnst({ fordeling: v as Modus })}
          valg={[
            { id: "tilfeldig", navn: "Tilfeldig", tittel: "Helt tilfeldig" },
            {
              id: "spre",
              navn: "Spre",
              tittel: "Blander innsats i hver gruppe",
            },
            { id: "samle", navn: "Samle", tittel: "Lik innsats sammen" },
          ]}
        />
        <Avkrysning verdi={bareHer} sett={settBareHer}>
          Bare de som er her
        </Avkrysning>
        <Avkrysning
          verdi={innst.unnga}
          sett={(v) => onEndreInnst({ unnga: v })}
        >
          Unngå samme som sist
        </Avkrysning>
        <Avkrysning
          verdi={innst.bland}
          sett={(v) => onEndreInnst({ bland: v })}
        >
          Bland jenter og gutter
        </Avkrysning>
      </div>
      {borteNa.length > 0 && (
        <p className="ikkeutskrift mx-0.5 mt-2.5 flex flex-wrap items-center gap-1.5 text-[calc(12.5px*var(--tekst-skala))] text-blekk-dempet">
          Borte i dag, ikke med:
          {borteNa.map((e) => (
            <span
              key={e.id}
              className="rounded-full bg-flate-svak px-2 py-0.5 text-blekk-svak line-through"
            >
              {e.fornavn} {e.etternavn}
            </span>
          ))}
          <span className="text-blekk-svak">· fra fraværet i dagens økt</span>
        </p>
      )}
      {brudd.length > 0 && (
        <p className="ikkeutskrift text-[calc(12px*var(--tekst-skala))] text-varsel">
          {brudd
            .map((b) =>
              b.regel === "hold"
                ? `${b.tekst.split("|").map(navnPa).join(" og ")} er i samme gruppe.`
                : b.tekst,
            )
            .join(" ")}
        </p>
      )}

      <div className="ikkeutskrift grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(240px,1fr))] content-start gap-3.5 overflow-auto pb-7 pt-3">
        {grupper.map((g, i) => {
          const farge = GRUPPEFARGER[i % GRUPPEFARGER.length];
          // Forhåndsvisningen før man slipper: eleven forlater sin gruppe og
          // får en plass nederst i gruppa pekeren er over.
          const flytter =
            dra?.flyttet &&
            dra.mal !== null &&
            !grupper[dra.mal]?.includes(dra.elevId);
          const mottar = flytter && dra.mal === i;
          const mister = flytter && g.includes(dra.elevId);
          const antall = g.length + (mottar ? 1 : 0) - (mister ? 1 : 0);
          return (
            <section
              key={i}
              data-gruppe={i}
              className="rounded-xl px-3 pb-2.5 pt-3"
              style={{
                background: `color-mix(in srgb, ${farge} ${mottar ? 12 : 6}%, var(--color-ark))`,
                boxShadow: mottar
                  ? `inset 0 0 0 2px ${farge}`
                  : `inset 0 0 0 1px color-mix(in srgb, ${farge} 20%, transparent)`,
              }}
            >
              <div className="flex items-center gap-2 px-1 pb-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: farge }}
                />
                <input
                  aria-label="Gruppenavn"
                  value={navn[i] ?? `Gruppe ${i + 1}`}
                  onChange={(e) => {
                    const v = e.target.value;
                    setNavn((nv) => nv.map((x, j) => (j === i ? v : x)));
                    setLagret(false);
                  }}
                  className="w-32 rounded bg-transparent text-[calc(14px*var(--tekst-skala))] font-semibold outline-none focus:bg-ark"
                />
                <span className="ml-auto text-[12px] tabular-nums text-blekk-dempet">
                  {antall} elever
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {g.map((id) => {
                  const e = elevAv.get(id);
                  if (!e) return null;
                  return (
                    <div
                      key={id}
                      data-elev-rad={id}
                      onPointerDown={(ev) => {
                        ev.preventDefault();
                        setDra({
                          elevId: id,
                          x: ev.clientX,
                          y: ev.clientY,
                          flyttet: false,
                          mal: null,
                        });
                      }}
                      className={`flex h-9 cursor-grab items-center gap-[9px] rounded-lg bg-ark px-2 shadow-[0_0_0_1px_var(--color-linje-medium)] ${
                        dra?.flyttet && dra.elevId === id
                          ? mister
                            ? "gruppe-forlater"
                            : "opacity-30"
                          : ""
                      }`}
                    >
                      <Elevfoto
                        elevId={id}
                        storrelse={24}
                        navn={`${e.fornavn} ${e.etternavn}`}
                      />
                      <span className="truncate text-[calc(13.5px*var(--tekst-skala))]">
                        {e.fornavn} {e.etternavn}
                      </span>
                      {e.harSkar && (
                        <span
                          className="ml-auto h-2 w-2 shrink-0 rounded-full"
                          style={{ background: innsatsfarge(e.innsats) }}
                        />
                      )}
                    </div>
                  );
                })}
                {mottar && (
                  <div
                    data-gruppe-plass
                    className="gruppe-plass flex h-9 items-center gap-[9px] overflow-hidden rounded-lg bg-ark px-2"
                    style={{ boxShadow: `inset 0 0 0 1.5px ${farge}` }}
                  >
                    <Elevfoto elevId={dra.elevId} storrelse={24} />
                    <span className="truncate text-[calc(13.5px*var(--tekst-skala))] text-blekk-dempet">
                      {elevAv.get(dra.elevId)?.fornavn}{" "}
                      {elevAv.get(dra.elevId)?.etternavn}
                    </span>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Lista over lagrede gruppesett, utenfor verktøylinja så den ikke klippes. */}
      {createPortal(
        <>
          {visTidligere && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setVisTidligere(false)}
              />
              <div
                style={{ top: tidligerePos.top, right: tidligerePos.right }}
                className="fixed z-40 max-h-[360px] w-80 overflow-auto rounded-xl bg-ark p-1.5 shadow-[0_12px_32px_rgba(36,31,51,.18),0_0_0_1px_var(--color-linje)]"
              >
                {historikk.length > 0 && (
                  <div className="px-2.5 pb-1 pt-1.5 text-etikett font-semibold text-blekk-dempet">
                    {kart.kildeNavn}
                  </div>
                )}
                {historikk.map((o) => {
                  const n = new Set(o.rader.map((r) => r.gruppe)).size;
                  return (
                    <div
                      key={o.id}
                      className={`group flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] hover:bg-flate ${
                        o.id === aktivt ? "bg-valgt" : ""
                      }`}
                    >
                      <button
                        onClick={() => {
                          visOppsett(o);
                          setVisTidligere(false);
                        }}
                        className="flex min-w-0 flex-1 items-baseline gap-2 text-left"
                      >
                        <span
                          className={`truncate ${o.navn ? "font-medium" : "text-blekk-dempet"}`}
                        >
                          {o.navn ?? "Uten navn"}
                        </span>
                        <span className="ml-auto shrink-0 text-etikett tabular-nums text-blekk-svak">
                          {new Date(o.tid).toLocaleDateString("nb-NO", {
                            day: "numeric",
                            month: "short",
                          })}{" "}
                          · {n} grupper
                        </span>
                      </button>
                      <button
                        onClick={() => void slettSett(o)}
                        title="Slett gruppesettet"
                        aria-label={`Slett ${o.navn ?? "gruppesettet"}`}
                        className="shrink-0 px-1 text-blekk-svak opacity-0 hover:text-feil group-hover:opacity-100"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
                {andreSett.length > 0 && (
                  <div className="px-2.5 pb-1 pt-2.5 text-etikett font-semibold text-blekk-dempet">
                    Andre klasser og fag
                  </div>
                )}
                {andreSett.map((a) => (
                  <button
                    key={a.oppsett.id}
                    onClick={() => {
                      setVisTidligere(false);
                      onApneAnnet(a.kilde, a.oppsett.id);
                    }}
                    className="flex w-full items-baseline gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-flate"
                  >
                    <span
                      className="h-2 w-2 shrink-0 self-center rounded-[2px]"
                      style={{
                        background: a.farge ?? "var(--color-linje-sterk)",
                      }}
                    />
                    <span className="truncate">
                      {a.kildeNavn} · {a.oppsett.navn ?? "Uten navn"}
                    </span>
                    <span className="ml-auto shrink-0 text-etikett tabular-nums text-blekk-svak">
                      {new Date(a.oppsett.tid).toLocaleDateString("nb-NO", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </button>
                ))}
                <p className="px-2.5 pb-1.5 pt-2 text-etikett leading-normal text-blekk-svak">
                  Lagres når du kopierer til Teams, skriver ut eller trykker
                  Lagre. «Unngå samme som sist» regner på disse.
                </p>
              </div>
            </>
          )}
        </>,
        document.body,
      )}
      {visBilde && (
        <Gruppebilde
          kode={kart.kildeNavn}
          startOverskrift={settNavn.trim() || "Grupper"}
          grupper={grupper.map((g, i) => ({
            farge: GRUPPEFARGER[i % GRUPPEFARGER.length],
            elever: g
              .map((id) => elevAv.get(id))
              .filter((e): e is Kartelev => !!e)
              .map((e) => ({ fornavn: e.fornavn, etternavn: e.etternavn })),
          }))}
          onLagret={async () => {
            if (!lagret) await bruk("Bildet er lagret, og gruppene med");
            else setMelding("Bildet er lagret");
          }}
          onLukk={() => setVisBilde(false)}
        />
      )}
      {dra?.flyttet && (
        <div
          className={`pointer-events-none fixed z-50 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-lg bg-ark px-3 py-1.5 text-brod ${
            dra.lander
              ? "gruppe-lander rotate-0 shadow-[0_1px_3px_rgba(36,31,51,.12)]"
              : "rotate-[-1.5deg] shadow-[0_10px_24px_rgba(36,31,51,.22)]"
          }`}
          style={{ left: dra.x, top: dra.y }}
        >
          <Elevfoto elevId={dra.elevId} storrelse={22} />
          {elevAv.get(dra.elevId)?.fornavn}
        </div>
      )}
    </div>
  );
}

/** Gruppefargene: de samme som på pultene, og aldri trafikklyset. */
const GRUPPEFARGER = PULTFARGER;
