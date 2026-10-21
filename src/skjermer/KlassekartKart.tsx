import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  DELER,
  endreKart,
  hentKart,
  hentKildeElever,
  hentOppsett,
  hentRegler,
  hentRom,
  lagreOppsett,
  leggTilRegel,
  plasserIRom,
  sammenFor,
  slettRegel,
  storrelse,
  type Elevregel,
  type Innstillinger,
  type Kart,
  type Kartelev,
  type Oppsett,
  type Rom,
} from "../data/klassekart";
import {
  fordelPlasser,
  naboer,
  type Brudd,
  type Modus,
} from "../data/fordeling";
import {
  kartListe,
  kartSvg,
  kortnavn,
  romramme,
  svgSomPng,
} from "../data/karttegning";
import { IVerktoylinja } from "../ui/Verktoylinje";
import {
  Bryter,
  Fagfirkant,
  Kontekstmeny,
  Menylinje,
  Menyskille,
  Menyvalg,
} from "../ui/felles";
import { Elevfoto } from "../ui/Elevfoto";
import { KlassekartGrupper } from "./KlassekartGrupper";
import { hovedtast, tast as visTast } from "../ui/taster";
import { filnavnAv, lagreFil } from "../data/filer";
import { Velger } from "../ui/Velger";

/**
 * Klassekartet — Plasser (SPEC §4.11, lerretet «Klassekart»).
 *
 * Rommet med elevene. Klikk på en plass låser eleven der; dra for å bytte.
 * «Ikke til stede i dag» gjelder bare til kartet lukkes. Stokk på nytt
 * (⌘R) fordeler alle som ikke er låst. «Bruk» lagrer plasseringen med dato
 * — det gjør også utskrift og kopiering — og de lagrede plasseringene er
 * historikken «Unngå dem som har sittet sammen» regner på.
 */
/**
 * Kartet som skal vises fra kateteret neste gang det åpnes — lenken i
 * øktkortet («Klassekart»), der læreren ser om alle sitter riktig. Gjelder
 * bare den ene visningen; kartets lagrede valg røres ikke.
 */
let fraKateteretNeste: string | null = null;
export function visFraKateteret(kartId: string): void {
  fraKateteretNeste = kartId;
}

export function KlassekartKart({
  kartId,
  skolearId,
  onRedigerRom,
}: {
  kartId: string;
  skolearId: string;
  /** «rom:<id>» eller «rom:ny» */
  onRedigerRom: (romId: string | null) => void;
}) {
  const [kart, setKart] = useState<Kart | null>(null);
  const [rom, setRom] = useState<Rom | null>(null);
  const [elever, setElever] = useState<Kartelev[]>([]);
  const [regler, setRegler] = useState<Elevregel[]>([]);
  const [historikk, setHistorikk] = useState<Oppsett[]>([]);
  const [innst, setInnst] = useState<Innstillinger | null>(null);
  // Åpnet fra øktkortet: plassene, fra kateteret, så lenge kartet står
  // åpent — også når det lastes på nytt — til læreren endrer noe selv.
  const fraKateteret = useRef(fraKateteretNeste === kartId);
  if (fraKateteretNeste === kartId) fraKateteretNeste = null;
  // Kartets egne, lagrede valg — det som lagres når noe endres.
  const lagretInnst = useRef<Innstillinger | null>(null);

  // Plasseringen på skjermen. Ikke lagret før «Bruk», utskrift eller kopi.
  const [plass, setPlass] = useState<Map<string, number>>(new Map());
  const [laste, setLaste] = useState<Set<string>>(new Set());
  const [borte, setBorte] = useState<Set<string>>(new Set());
  const [brudd, setBrudd] = useState<Brudd[]>([]);
  const [farge, setFarge] = useState<"ingen" | "innsats">("ingen");
  const [melding, setMelding] = useState<string | null>(null);
  const [lagret, setLagret] = useState(true);
  const [delMeny, setDelMeny] = useState<{ x: number; y: number } | null>(null);

  const plasser = useMemo(() => plasserIRom(rom?.deler ?? []), [rom]);

  async function last() {
    const k = (await hentKart(skolearId)).find((x) => x.id === kartId);
    if (!k) return;
    const [r, e, g, h] = await Promise.all([
      hentRom(),
      hentKildeElever(k.kildeType, k.kildeId, skolearId),
      hentRegler(k.kildeType, k.kildeId),
      hentOppsett(kartId, "plass"),
    ]);
    const rommet = r.find((x) => x.id === k.romId) ?? null;
    setKart(k);
    lagretInnst.current = k.innstillinger;
    setInnst(
      fraKateteret.current
        ? { ...k.innstillinger, visning: "plasser", fraElevene: false }
        : k.innstillinger,
    );
    setRom(rommet);
    setElever(e);
    setRegler(g);
    setHistorikk(h);

    // Start fra sist brukte plassering. Plasser som ikke finnes lenger, og
    // elever som ikke er i kilden lenger, faller bort. Nye elever får de
    // ledige plassene, forfra.
    const seter = plasserIRom(rommet?.deler ?? []);
    const finnes = new Set(seter.map((p) => p.nr));
    const iKilden = new Set(e.map((x) => x.id));
    const ny = new Map<string, number>();
    const las = new Set<string>();
    if (h[0])
      for (const rad of h[0].rader)
        if (rad.plass && finnes.has(rad.plass) && iKilden.has(rad.elevId)) {
          ny.set(rad.elevId, rad.plass);
          if (rad.last) las.add(rad.elevId);
        }
    if (h.length === 0) {
      setPlass(new Map());
      setLaste(new Set());
      stokk(e, seter, new Set(), new Map(), k.innstillinger, g, h);
      return;
    }
    const opptatt = new Set(ny.values());
    const ledige = seter.filter((p) => !opptatt.has(p.nr));
    for (const el of e)
      if (!ny.has(el.id) && ledige.length > 0)
        ny.set(el.id, ledige.shift()!.nr);
    setPlass(ny);
    setLaste(las);
  }

  useEffect(() => {
    void last();
  }, [kartId, skolearId]);

  // Naboparene i rommet, og hvem som har sittet sammen før.
  const naboSett = useMemo(
    () => new Set(naboer(plasser).map(([a, b]) => `${a}|${b}`)),
    [plasser],
  );
  const sammen = useMemo(
    () =>
      sammenFor(
        historikk,
        (a, b) =>
          !!a.plass &&
          !!b.plass &&
          (naboSett.has(`${a.plass}|${b.plass}`) ||
            naboSett.has(`${b.plass}|${a.plass}`)),
      ),
    [historikk, naboSett],
  );

  function stokk(
    e = elever,
    seter = plasser,
    las = laste,
    naa = plass,
    i = innst,
    g = regler,
    h = historikk,
  ) {
    if (!i) return;
    const tilstede = e.filter((x) => !borte.has(x.id));
    const lasteMap = new Map<string, number>();
    for (const id of las) {
      const nr = naa.get(id);
      if (nr) lasteMap.set(id, nr);
    }
    const naboer2 = new Set(naboer(seter).map(([a, b]) => `${a}|${b}`));
    const hist = sammenFor(
      h,
      (a, b) =>
        !!a.plass &&
        !!b.plass &&
        (naboer2.has(`${a.plass}|${b.plass}`) ||
          naboer2.has(`${b.plass}|${a.plass}`)),
    );
    const r = fordelPlasser({
      elever: tilstede,
      plasser: seter,
      laste: lasteMap,
      holdFra: g.map((x) => [x.elevA, x.elevB] as [string, string]),
      historikk: hist.vekt,
      modus: i.fordeling as Modus,
      bland: i.bland,
      unnga: i.unnga,
      frø: Math.floor(Math.random() * 2 ** 31),
    });
    setPlass(r.plass);
    setBrudd(r.brudd);
    setLagret(false);
  }

  function endreInnst(endring: Partial<Innstillinger>) {
    if (!innst) return;
    const ny = { ...innst, ...endring };
    setInnst(ny);
    // Kateter-visningen fra øktkortet lagres ikke; bare det læreren endret.
    const lagres = { ...(lagretInnst.current ?? innst), ...endring };
    lagretInnst.current = lagres;
    void endreKart(kartId, { innstillinger: lagres });
  }

  async function bruk(hvorfor?: string) {
    await lagreOppsett(
      kartId,
      "plass",
      [...plass].map(([elevId, nr]) => ({
        elevId,
        plass: nr,
        last: laste.has(elevId),
      })),
    );
    setHistorikk(await hentOppsett(kartId, "plass"));
    setLagret(true);
    setMelding(hvorfor ?? "Plasseringen er lagret");
  }

  // ------------------------------------------------------------ dele

  const tittel = kart ? `${kart.kildeNavn}${rom ? ` · ${rom.navn}` : ""}` : "";
  const svg = () =>
    kartSvg({
      tittel,
      deler: rom?.deler ?? [],
      plasser,
      plass,
      elever,
      fraElevene: innst?.fraElevene ?? false,
    });

  async function skrivUt(pdf = false) {
    if (!lagret) await bruk();
    await invoke("skriv_ut");
    if (pdf) setMelding("Velg «Lagre som PDF» i utskriftsdialogen");
  }

  async function kopierBilde() {
    try {
      const png = await svgSomPng(svg());
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": png }),
      ]);
      if (!lagret) await bruk("Kopiert som bilde, og lagret");
      else setMelding("Kopiert som bilde");
    } catch (e) {
      setMelding(`Fikk ikke kopiert: ${String(e)}`);
    }
  }

  async function lagrePng() {
    const png = new Uint8Array(await (await svgSomPng(svg())).arrayBuffer());
    const sti = await lagreFil({
      filnavn: `Klassekart ${tittel.replace(/[·/]/g, "-")}.png`,
      filternavn: "PNG",
      endelse: "png",
      innhold: png,
    });
    if (!sti) return;
    if (!lagret) await bruk(`Lagret ${filnavnAv(sti)}`);
    else setMelding(`Lagret ${filnavnAv(sti)}`);
  }

  async function kopierListe() {
    await navigator.clipboard.writeText(
      kartListe({ tittel, plasser, plass, elever }),
    );
    if (!lagret) await bruk("Kopiert som liste, og lagret");
    else setMelding("Kopiert som liste");
  }

  // ⌘R stokker, ⌘P skriver ut, ⌘C kopierer bildet, ⇧⌘E lagrer PDF.
  useEffect(() => {
    const tast = (e: KeyboardEvent) => {
      if (!hovedtast(e)) return;
      // Gruppene har sine egne taster.
      if (innst?.visning === "grupper") return;
      const iFelt = (e.target as HTMLElement).closest?.(
        "input, textarea, select, [contenteditable]",
      );
      const k = e.key.toLowerCase();
      if (k === "r" && !e.shiftKey) {
        e.preventDefault();
        stokk();
      } else if (k === "p" && !e.shiftKey) {
        e.preventDefault();
        void skrivUt();
      } else if (k === "e" && e.shiftKey) {
        e.preventDefault();
        void skrivUt(true);
      } else if (
        k === "c" &&
        !e.shiftKey &&
        !iFelt &&
        !window.getSelection()?.toString()
      ) {
        e.preventDefault();
        void kopierBilde();
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
    /** plassen pekeren står over, til forhåndsvisningen */
    mal?: number | null;
  } | null>(null);
  const draRef = useRef(dra);
  draRef.current = dra;

  function flytt(elevId: string, til: number | "borte") {
    const fra = plass.get(elevId);
    const ny = new Map(plass);
    const nyBorte = new Set(borte);
    if (til === "borte") {
      ny.delete(elevId);
      nyBorte.add(elevId);
      const l = new Set(laste);
      l.delete(elevId);
      setLaste(l);
    } else {
      const der = [...plass].find(([, nr]) => nr === til)?.[0];
      nyBorte.delete(elevId);
      ny.set(elevId, til);
      if (der && der !== elevId) {
        if (fra) ny.set(der, fra);
        else {
          // Fra «ikke til stede»: den som satt der, får første ledige plass.
          ny.delete(der);
          const opptatt = new Set(ny.values());
          const ledig = plasser.find((p) => !opptatt.has(p.nr));
          if (ledig) ny.set(der, ledig.nr);
          else nyBorte.add(der);
        }
      }
    }
    setPlass(ny);
    setBorte(nyBorte);
    setLagret(false);
  }

  useEffect(() => {
    if (!dra) return;
    const flytter = (e: PointerEvent) =>
      setDra(
        (d) =>
          d && {
            ...d,
            x: e.clientX,
            y: e.clientY,
            flyttet:
              d.flyttet || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4,
            mal: malVed(e.clientX, e.clientY),
          },
      );
    const slipp = (e: PointerEvent) => {
      const d = draRef.current;
      setDra(null);
      if (!d) return;
      if (!d.flyttet) {
        // Et klikk: lås eller lås opp — bare for den som har en plass.
        if (plass.has(d.elevId)) {
          const l = new Set(laste);
          if (l.has(d.elevId)) l.delete(d.elevId);
          else l.add(d.elevId);
          setLaste(l);
          setLagret(false);
        }
        return;
      }
      const mal = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest<HTMLElement>("[data-plass], [data-borte]");
      if (!mal) return;
      if (mal.dataset.borte !== undefined) flytt(d.elevId, "borte");
      else flytt(d.elevId, Number(mal.dataset.plass));
    };
    window.addEventListener("pointermove", flytter);
    window.addEventListener("pointerup", slipp);
    return () => {
      window.removeEventListener("pointermove", flytter);
      window.removeEventListener("pointerup", slipp);
    };
  }, [dra !== null]);

  /** Plassen under pekeren mens det dras, eller null. */
  function malVed(x: number, y: number): number | null {
    const el = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>("[data-plass]");
    return el ? Number(el.dataset.plass) : null;
  }

  // Forhåndsvisning (som i Økter): eleven som sitter der du sikter, tones
  // ned, og på plassen du drar fra tones den eleven inn.
  const fraPlass = dra?.flyttet ? plass.get(dra.elevId) : undefined;
  const malPlass =
    dra?.flyttet && dra.mal != null && dra.mal !== fraPlass ? dra.mal : null;
  const byttesMed =
    malPlass != null
      ? ([...plass].find(
          ([id, nr]) => nr === malPlass && id !== dra?.elevId,
        )?.[0] ?? null)
      : null;

  // ------------------------------------------------------------- tegne

  const flateRef = useRef<HTMLDivElement>(null);
  const [plassBredde, setPlassBredde] = useState(800);
  useEffect(() => {
    const el = flateRef.current;
    if (!el) return;
    const o = new ResizeObserver(() => setPlassBredde(el.clientWidth));
    o.observe(el);
    return () => o.disconnect();
  }, [rom !== null]);

  if (!kart || !innst) return null;

  if (innst.visning === "grupper")
    return (
      <KlassekartGrupper
        kart={kart}
        innst={innst}
        elever={elever}
        regler={regler}
        onEndreInnst={endreInnst}
      />
    );

  const ramme = romramme(rom?.deler ?? []);
  const skala = Math.min(1.5, Math.max(0.6, plassBredde / (ramme.b + 20)));
  const snu = (x: number, y: number, b = 0, h = 0) =>
    innst.fraElevene
      ? {
          x: ramme.x + ramme.b - (x - ramme.x) - b,
          y: ramme.y + ramme.h - (y - ramme.y) - h,
        }
      : { x, y };
  const px = (x: number) => (x - ramme.x) * skala;
  const py = (y: number) => (y - ramme.y) * skala;

  const elevPa = new Map<number, Kartelev>();
  const elevAv = new Map(elever.map((e) => [e.id, e]));
  for (const [id, nr] of plass) {
    const e = elevAv.get(id);
    if (e) elevPa.set(nr, e);
  }
  const utenPlass = elever.filter((e) => !plass.has(e.id) && !borte.has(e.id));
  const oftest = [...sammen.ganger].sort((a, b) => b[1] - a[1])[0];
  const navnPa = (id: string) => {
    const e = elevAv.get(id);
    return e ? kortnavn(e) : "?";
  };

  return (
    <div className="flex min-h-0 flex-1">
      <IVerktoylinja>
        {kart.kildeType === "mentorgruppe" ? (
          <span className="h-2.5 w-2.5 rounded-full bg-aksent" />
        ) : (
          <Fagfirkant farge={kart.farge} storrelse={10} />
        )}
        <h2 className="text-[calc(15px*var(--tekst-skala))] font-semibold">
          {kart.kildeNavn}
        </h2>
        <span className="text-liten text-blekk-dempet">
          {rom?.navn ?? "Uten rom"}
        </span>
        <Bryter
          storrelse="liten"
          verdi="plasser"
          settVerdi={(v) => endreInnst({ visning: v as "grupper" })}
          valg={[
            { id: "plasser", navn: "Plasser" },
            { id: "grupper", navn: "Grupper" },
          ]}
        />
        {melding && (
          <span role="status" className="truncate text-liten text-aksent">
            {melding}
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          <Bryter
            storrelse="liten"
            verdi={innst.fraElevene ? "elever" : "kateter"}
            settVerdi={(v) => endreInnst({ fraElevene: v === "elever" })}
            valg={[
              { id: "kateter", navn: "Fra kateteret" },
              { id: "elever", navn: "Fra elevene" },
            ]}
          />
          <button
            onClick={() => onRedigerRom(rom?.id ?? null)}
            className="flex h-8 items-center rounded-full border border-linje-sterk bg-ark/70 px-3.5 text-brod hover:bg-ark"
          >
            {rom ? "Rediger rom" : "Tegn rom"}
          </button>
          <button
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setDelMeny(
                delMeny ? null : { x: r.right - 300, y: r.bottom + 6 },
              );
            }}
            className={`flex h-8 items-center gap-1.5 rounded-full border border-linje-sterk px-3.5 text-brod hover:bg-ark ${delMeny ? "bg-flate" : "bg-ark/70"}`}
          >
            Del
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
              <path
                d="M2 3.5l3 3 3-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
              />
            </svg>
          </button>
        </span>
      </IVerktoylinja>

      {delMeny && (
        <Kontekstmeny
          x={delMeny.x}
          y={delMeny.y}
          onLukk={() => setDelMeny(null)}
        >
          <Menyvalg onKlikk={() => void skrivUt()}>
            <Menylinje tast={visTast("⌘P")} under="A4 liggende, ett ark">
              Skriv ut…
            </Menylinje>
          </Menyvalg>
          <Menyvalg onKlikk={() => void skrivUt(true)}>
            <Menylinje tast={visTast("⇧⌘E")} under="Samme ark som utskriften">
              Lagre som PDF…
            </Menylinje>
          </Menyvalg>
          <Menyskille />
          <Menyvalg onKlikk={() => void kopierBilde()}>
            <Menylinje
              tast={visTast("⌘C")}
              under="PNG, lim rett inn i Teams eller OneNote"
            >
              Kopier som bilde
            </Menylinje>
          </Menyvalg>
          <Menyvalg onKlikk={() => void lagrePng()}>
            <Menylinje under="Til skjermen i klasserommet">
              Lagre som PNG…
            </Menylinje>
          </Menyvalg>
          <Menyvalg onKlikk={() => void kopierListe()}>
            <Menylinje under="Pult for pult, som tekst">
              Kopier som liste
            </Menylinje>
          </Menyvalg>
          <p className="mx-2 mb-1 mt-1.5 w-[268px] border-t border-linje-medium pt-2 text-[calc(11.5px*var(--tekst-skala))] leading-[1.45] text-blekk-dempet">
            Viser fornavn og første bokstav i etternavnet. Kjønn, innsats og
            bilder blir aldri med.
          </p>
        </Kontekstmeny>
      )}

      {/* Papiret: bare navn, ingen bilder, farger eller kjønn. */}
      <style>
        {"@media print { @page { size: A4 landscape; margin: 10mm; } }"}
      </style>
      <div
        className="kunutskrift w-full [&>svg]:h-auto [&>svg]:max-h-[180mm] [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svg() }}
      />

      <section
        aria-label="Klasserommet"
        className="ikkeutskrift flex min-w-0 flex-1 flex-col gap-3.5 pr-6"
      >
        <p className="text-[calc(12px*var(--tekst-skala))] tabular-nums text-blekk-svak">
          {elever.length} elever · {plasser.length} plasser · {laste.size} låst
          {borte.size > 0 && ` · ${borte.size} ikke til stede`}
        </p>
        <div ref={flateRef} className="min-h-0 flex-1 overflow-auto">
          {!rom ? (
            <div className="rounded-xl border border-dashed border-linje px-4 py-10 text-center text-brod text-blekk-dempet">
              <p>Kartet har ikke noe rom ennå.</p>
              <button
                onClick={() => onRedigerRom(null)}
                className="mt-3 text-aksent hover:underline"
              >
                Tegn rommet
              </button>
            </div>
          ) : (
            <div
              className="relative"
              style={{ width: ramme.b * skala, height: ramme.h * skala }}
            >
              {rom.deler.map((d) => {
                const s = storrelse(d);
                const p = snu(d.x, d.y, s.b, s.h);
                const stil = {
                  left: px(p.x),
                  top: py(p.y),
                  width: s.b * skala,
                  height: s.h * skala,
                };
                if (DELER[d.type].plasser.length > 0)
                  return (
                    <div
                      key={d.id}
                      className="absolute rounded-[10px] bg-flate shadow-[inset_0_0_0_1px_var(--color-linje-medium)]"
                      style={stil}
                    />
                  );
                if (d.type === "tavle")
                  return (
                    <div
                      key={d.id}
                      className="absolute flex items-center justify-center rounded-md bg-linje-medium text-[12px] tracking-[0.06em] text-blekk-dempet"
                      style={{ ...stil, minHeight: 24 }}
                    >
                      TAVLE
                    </div>
                  );
                if (d.type === "kateter")
                  return (
                    <div
                      key={d.id}
                      className="absolute flex items-center justify-center rounded-lg text-[12px] text-blekk-svak shadow-[inset_0_0_0_1.5px_var(--color-linje)]"
                      style={stil}
                    >
                      Kateter
                    </div>
                  );
                if (d.type === "dor")
                  return (
                    <div
                      key={d.id}
                      className="absolute flex items-end text-[11px] text-blekk-svak"
                      style={stil}
                    >
                      Dør
                    </div>
                  );
                return (
                  <div
                    key={d.id}
                    className="absolute"
                    style={{
                      ...stil,
                      background:
                        "repeating-linear-gradient(90deg, var(--color-linje) 0 12px, transparent 12px 18px)",
                      backgroundSize: "100% 4px",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "center",
                    }}
                  />
                );
              })}

              {/* De ledige plassene, og slippmål for dra. */}
              {plasser.map((p) => {
                const q = snu(p.x, p.y);
                return (
                  <div
                    key={p.nr}
                    data-plass={p.nr}
                    className={`absolute flex items-center justify-center rounded-[7px] text-[12px] text-linje-sterk transition-shadow duration-150 ${
                      malPlass === p.nr && !elevPa.has(p.nr)
                        ? "shadow-[inset_0_0_0_1.5px_var(--color-aksent)]"
                        : ""
                    }`}
                    style={{
                      left: px(q.x) - 48 * skala,
                      top: py(q.y) - 27 * skala,
                      width: 96 * skala,
                      height: 54 * skala,
                    }}
                  >
                    {!elevPa.has(p.nr) && "Ledig"}
                  </div>
                );
              })}

              {/* Den som byttes, tonet inn på plassen du drar fra. */}
              {byttesMed &&
                fraPlass != null &&
                (() => {
                  const p = plasser.find((x) => x.nr === fraPlass);
                  const e = elevAv.get(byttesMed);
                  if (!p || !e) return null;
                  const q = snu(p.x, p.y);
                  return (
                    <div
                      key={`forhand-${byttesMed}`}
                      aria-hidden
                      className="dra-forhand pointer-events-none absolute z-[2] flex items-center gap-2 overflow-hidden rounded-[7px] bg-ark px-2 text-blekk-dempet shadow-[inset_0_0_0_1.5px_var(--color-aksent)]"
                      style={{
                        left: px(q.x) - 48 * skala,
                        top: py(q.y) - 27 * skala,
                        width: 96 * skala,
                        height: 54 * skala,
                      }}
                    >
                      {skala >= 0.9 && (
                        <Elevfoto elevId={byttesMed} storrelse={24} />
                      )}
                      <span className="flex min-w-0 flex-col leading-tight">
                        <span className="truncate text-[calc(13px*var(--tekst-skala))] font-medium">
                          {e.fornavn}
                        </span>
                        <span className="truncate text-[calc(11px*var(--tekst-skala))]">
                          {e.etternavn}
                        </span>
                      </span>
                    </div>
                  );
                })()}

              {/*
                Elevene, med nøkkel på eleven og ikke på plassen: stokkes
                kartet, glir hver elev fra der den satt til den nye plassen.
              */}
              {[...plass].map(([id, nr]) => {
                const e = elevAv.get(id);
                const p = plasser.find((x) => x.nr === nr);
                if (!e || !p) return null;
                const q = snu(p.x, p.y);
                const last = laste.has(id);
                const tone =
                  farge === "innsats" && e.harSkar
                    ? innsatsfarge(e.innsats)
                    : null;
                return (
                  <button
                    key={id}
                    data-plass={nr}
                    title={`${e.fornavn} ${e.etternavn}${last ? " (låst)" : ""}`}
                    onPointerDown={(ev) => {
                      ev.preventDefault();
                      setDra({
                        elevId: id,
                        x: ev.clientX,
                        y: ev.clientY,
                        flyttet: false,
                      });
                    }}
                    className={`kartelev absolute flex cursor-grab items-center gap-2 overflow-hidden rounded-[7px] px-2 text-left transition-opacity duration-150 hover:bg-ark/70 ${
                      dra?.flyttet && dra.elevId === id
                        ? "opacity-30"
                        : byttesMed === id
                          ? "opacity-35"
                          : ""
                    }`}
                    style={{
                      left: px(q.x) - 48 * skala,
                      top: py(q.y) - 27 * skala,
                      width: 96 * skala,
                      height: 54 * skala,
                      background: tone
                        ? `color-mix(in srgb, ${tone} 12%, transparent)`
                        : last
                          ? "var(--color-ark)"
                          : undefined,
                      boxShadow: last
                        ? "inset 0 0 0 1.5px var(--color-aksent)"
                        : undefined,
                    }}
                  >
                    {skala >= 0.9 && (
                      <Elevfoto
                        elevId={id}
                        storrelse={24}
                        navn={`${e.fornavn} ${e.etternavn}`}
                      />
                    )}
                    <span className="flex min-w-0 flex-col leading-tight">
                      <span className="truncate text-[calc(13px*var(--tekst-skala))] font-medium">
                        {e.fornavn}
                      </span>
                      <span className="truncate text-[calc(11px*var(--tekst-skala))] text-blekk-dempet">
                        {e.etternavn}
                      </span>
                    </span>
                    {last && (
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 16 16"
                        aria-label="Låst"
                        className="absolute right-1.5 top-1.5 text-aksent"
                      >
                        <rect
                          x="3"
                          y="7"
                          width="10"
                          height="7"
                          rx="1.5"
                          fill="currentColor"
                        />
                        <path
                          d="M5.5 7V5a2.5 2.5 0 015 0v2"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                        />
                      </svg>
                    )}
                    {tone && (
                      <span
                        className="absolute bottom-1.5 right-2 h-2 w-2 rounded-full"
                        style={{ background: tone }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {utenPlass.length > 0 && (
          <p className="text-liten text-varsel">
            Uten plass: {utenPlass.map((e) => kortnavn(e)).join(", ")}
          </p>
        )}
        <p className="flex items-center gap-3.5 text-[calc(12px*var(--tekst-skala))] text-blekk-svak">
          <span className="ml-auto">
            Klikk en plass for å låse eleven der · dra for å bytte
          </span>
        </p>
      </section>

      <aside
        aria-label="Fordeling"
        className="ikkeutskrift -my-2 -mr-2 flex w-[300px] shrink-0 flex-col overflow-auto border-l border-linje-medium bg-flate-svak px-5 pb-5 pt-1"
      >
        <Blokk tittel="Fordel etter">
          <Bryter
            fyll
            storrelse="liten"
            verdi={innst.fordeling}
            settVerdi={(v) => endreInnst({ fordeling: v as Modus })}
            valg={[
              { id: "tilfeldig", navn: "Tilfeldig" },
              { id: "spre", navn: "Spre" },
              { id: "samle", navn: "Samle" },
            ]}
          />
          <p className="mt-2 text-[calc(12.5px*var(--tekst-skala))] leading-normal text-blekk-dempet">
            {FORDELINGSTEKST[innst.fordeling]}
          </p>
        </Blokk>
        <Blokk>
          <Avkrysning
            verdi={innst.bland}
            sett={(v) => endreInnst({ bland: v })}
          >
            Bland jenter og gutter
          </Avkrysning>
          <div className="mt-2.5" />
          <Avkrysning
            verdi={innst.unnga}
            sett={(v) => endreInnst({ unnga: v })}
          >
            Unngå dem som har sittet sammen
          </Avkrysning>
          <p className="ml-[25px] mt-1.5 text-[calc(12px*var(--tekst-skala))] text-blekk-dempet">
            {oftest
              ? `Oftest: ${oftest[0]
                  .split("|")
                  .map((id) => elevAv.get(id)?.fornavn ?? "?")
                  .join(
                    " og ",
                  )}, ${oftest[1]} ${oftest[1] === 1 ? "gang" : "ganger"}`
              : "Ingen har sittet sammen ennå"}
          </p>
        </Blokk>
        <Blokk tittel="Hold fra hverandre">
          <Regler
            regler={regler}
            elever={elever}
            navnPa={navnPa}
            onLeggTil={async (a, b) => {
              await leggTilRegel(kart.kildeType, kart.kildeId, a, b);
              setRegler(await hentRegler(kart.kildeType, kart.kildeId));
            }}
            onSlett={async (id) => {
              await slettRegel(id);
              setRegler(await hentRegler(kart.kildeType, kart.kildeId));
            }}
          />
        </Blokk>
        <Blokk tittel="Farge på pultene">
          <Bryter
            fyll
            storrelse="liten"
            verdi={farge}
            settVerdi={(v) => setFarge(v as "ingen" | "innsats")}
            valg={[
              { id: "ingen", navn: "Ingen" },
              { id: "innsats", navn: "Innsats" },
            ]}
          />
          <p className="mt-2 text-[calc(12px*var(--tekst-skala))] text-blekk-svak">
            Innsats = snitt av trafikklyset de siste 10 øktene. Vises bare for
            deg.
          </p>
        </Blokk>
        <Blokk tittel="Ikke til stede i dag" siste>
          <div
            data-borte
            className={`flex min-h-11 flex-wrap items-center gap-2 rounded-lg px-2.5 py-2 shadow-[inset_0_0_0_1.5px_var(--color-linje-medium)] ${
              dra?.flyttet ? "bg-valgt/40" : ""
            }`}
          >
            {[...borte].map((id) => {
              const e = elevAv.get(id);
              if (!e) return null;
              return (
                <span
                  key={id}
                  onPointerDown={(ev) => {
                    ev.preventDefault();
                    setDra({
                      elevId: id,
                      x: ev.clientX,
                      y: ev.clientY,
                      flyttet: false,
                    });
                  }}
                  className="inline-flex h-[26px] cursor-grab items-center gap-1.5 rounded-full bg-flate pl-1 pr-2.5 text-[calc(12.5px*var(--tekst-skala))]"
                >
                  <Elevfoto elevId={id} storrelse={20} />
                  {e.fornavn}
                </span>
              );
            })}
            <span className="text-[calc(12px*var(--tekst-skala))] text-blekk-svak">
              Dra en elev hit
            </span>
          </div>
        </Blokk>

        <div className="mt-auto flex flex-col gap-2 pt-4">
          {brudd
            .filter((b) => b.regel !== "plass")
            .map((b, i) => (
              <p
                key={i}
                className="text-[calc(12px*var(--tekst-skala))] text-varsel"
              >
                {b.regel === "hold"
                  ? `${b.tekst
                      .split("|")
                      .map(navnPa)
                      .join(" og ")} sitter sammen, og begge er låst.`
                  : b.tekst}
              </p>
            ))}
          <button
            onClick={() => stokk()}
            className="flex h-[38px] items-center justify-center gap-2 rounded-full bg-aksent text-[calc(14px*var(--tekst-skala))] font-medium text-ark hover:bg-aksent-mork"
          >
            Stokk på nytt
            <span className="text-[11px] opacity-65">{visTast("⌘R")}</span>
          </button>
          <button
            onClick={() => void bruk()}
            disabled={lagret}
            className="flex h-[34px] items-center justify-center rounded-full border border-linje-sterk bg-ark text-brod hover:bg-flate disabled:border-transparent disabled:bg-transparent disabled:text-blekk-svak"
          >
            {lagret
              ? historikk[0]
                ? `Brukt ${tidspunkt(historikk[0].tid)}`
                : "Ikke brukt ennå"
              : "Bruk"}
          </button>
          <p className="text-center text-[calc(12px*var(--tekst-skala))] tabular-nums text-blekk-dempet">
            {laste.size === 0
              ? "Ingen er låst"
              : `${laste.size} låste ${laste.size === 1 ? "elev blir" : "elever blir"} sittende`}
          </p>
        </div>
      </aside>

      {dra?.flyttet && (
        <div
          className="pointer-events-none fixed z-50 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-ark px-3 py-1.5 text-brod font-medium shadow-lg"
          style={{ left: dra.x, top: dra.y }}
        >
          <Elevfoto elevId={dra.elevId} storrelse={22} />
          {elevAv.get(dra.elevId)?.fornavn}
        </div>
      )}
    </div>
  );
}

export const FORDELINGSTEKST: Record<Modus, string> = {
  tilfeldig: "Ren tilfeldighet, med reglene under.",
  spre: "Elever med lav innsats sitter ved siden av noen med høy.",
  samle: "Elever med lav innsats samles foran, nær kateteret.",
};

/** Trafikklysfargen til et innsatssnitt. */
export function innsatsfarge(v: number): string {
  return v >= 0.75
    ? "var(--color-lys-gronn)"
    : v >= 0.4
      ? "var(--color-lys-gul)"
      : "var(--color-lys-rod)";
}

/** «i dag 10.12», «6.10» */
function tidspunkt(iso: string): string {
  const d = new Date(iso);
  const idag = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return d.toDateString() === idag.toDateString()
    ? `i dag ${p(d.getHours())}.${p(d.getMinutes())}`
    : `${d.getDate()}.${d.getMonth() + 1}`;
}

export function Blokk({
  tittel,
  siste,
  children,
}: {
  tittel?: string;
  siste?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`py-3.5 ${siste ? "" : "border-b border-linje-medium"}`}>
      {tittel && (
        <h3 className="mb-2 text-[calc(13px*var(--tekst-skala))] font-semibold">
          {tittel}
        </h3>
      )}
      {children}
    </div>
  );
}

export function Avkrysning({
  verdi,
  sett,
  children,
}: {
  verdi: boolean;
  sett: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-[calc(13.5px*var(--tekst-skala))]">
      <input
        type="checkbox"
        checked={verdi}
        onChange={(e) => sett(e.target.checked)}
        className="m-0 h-[15px] w-[15px] accent-[var(--color-aksent)]"
      />
      {children}
    </label>
  );
}

/** «Hold fra hverandre»: parene som chips, og «+ Legg til» med to valg. */
export function Regler({
  regler,
  elever,
  navnPa,
  onLeggTil,
  onSlett,
}: {
  regler: Elevregel[];
  elever: Kartelev[];
  navnPa: (id: string) => string;
  onLeggTil: (a: string, b: string) => Promise<void>;
  onSlett: (id: string) => Promise<void>;
}) {
  const [ny, setNy] = useState<{ a: string; b: string } | null>(null);
  const valg = (verdi: string, sett: (v: string) => void, ikke: string) => (
    <Velger
      verdi={verdi}
      settVerdi={sett}
      variant="liten"
      bredde="min-w-0 flex-1"
      etikett="Elev"
      plassholder="Velg elev"
      valg={elever
        .filter((e) => e.id !== ikke)
        .map((e) => ({ verdi: e.id, tekst: `${e.fornavn} ${e.etternavn}` }))}
    />
  );
  return (
    <div className="flex flex-wrap gap-1.5">
      {regler.map((r) => (
        <span
          key={r.id}
          className="group inline-flex h-[26px] items-center gap-1.5 rounded-full bg-flate px-2.5 text-[calc(12.5px*var(--tekst-skala))]"
        >
          {navnPa(r.elevA)} <span className="text-blekk-svak">⟷</span>{" "}
          {navnPa(r.elevB)}
          <button
            aria-label="Fjern regelen"
            onClick={() => void onSlett(r.id)}
            className="text-blekk-svak hover:text-feil"
          >
            ×
          </button>
        </span>
      ))}
      {ny ? (
        <div className="mt-1 flex w-full flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            {valg(ny.a, (a) => setNy({ ...ny, a }), ny.b)}
            <span className="text-blekk-svak">⟷</span>
            {valg(ny.b, (b) => setNy({ ...ny, b }), ny.a)}
          </div>
          <div className="flex justify-end gap-1.5">
            <button
              onClick={() => setNy(null)}
              className="h-7 rounded-full px-3 text-liten text-blekk-dempet hover:bg-flate"
            >
              Avbryt
            </button>
            <button
              disabled={!ny.a || !ny.b}
              onClick={async () => {
                await onLeggTil(ny.a, ny.b);
                setNy(null);
              }}
              className="h-7 rounded-full bg-aksent px-3 text-liten font-medium text-ark disabled:opacity-40"
            >
              Legg til
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setNy({ a: "", b: "" })}
          className="inline-flex h-[26px] items-center rounded-full px-2.5 text-[calc(12.5px*var(--tekst-skala))] text-blekk-dempet shadow-[inset_0_0_0_1px_var(--color-linje)] hover:text-blekk"
        >
          + Legg til
        </button>
      )}
    </div>
  );
}
