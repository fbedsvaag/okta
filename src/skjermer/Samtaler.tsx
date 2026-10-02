import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useArk } from "../ui/Arkstabel";
import { confirm as bekreft } from "@tauri-apps/plugin-dialog";
import type { Skolear } from "../data/skolear";
import { hentInnstilling, settInnstilling } from "../data/skolear";
import type { FagIAr } from "../data/fag";
import { hentElever, type ElevRad } from "../data/elever";
import {
  hentOktvalg,
  hentVurderinger,
  type Oktvalg,
  type Vurdering,
} from "../data/vurderinger";
import {
  antallEnheter,
  delIGrupper,
  delPaDager,
  endreSamtaledag,
  enhetId,
  flyttTilEnhet,
  medlemmerAv,
  samlePaTid,
  finnLunsj,
  fjernDagFraOkt,
  leggDagIOkt,
  settTrekningensVurdering,
  slettTrekning,
  flyttInnenDagen,
  flyttMellomDager,
  grupperTrekninger,
  somMarkdown,
  somTeamsHtml,
  hentHistorikk,
  hentSamtaledager,
  hentSamtaler,
  kapasitet,
  lagreTrekning,
  leggUtDagen,
  merknad,
  opprettSamtaledag,
  slettSamtaledag,
  stokk,
  tildelTema,
  trekkOmRekkefolge,
  trekkOmTema,
  tilKlokke,
  tilMin,
  timerPaDagen,
  vektetRekkefolge,
  type Eksportdag,
  type Plassering,
  type Samtaledag,
  type Trekning,
} from "../data/samtale";
import { invoke } from "@tauri-apps/api/core";
import { mentorStatus, publiserMentor } from "../data/caldav";
import {
  hentNotatPerElev,
  opprettElevnotat,
  endreElevnotat,
  type Elevnotat,
} from "../data/elevnotat";
import { Bryter, Felt, Ikon, Kappet, Knapp, Tomtilstand } from "../ui/felles";

/**
 * Samtaletrekkeren, SPEC §4.10.
 *
 * Én sammenhengende kolonne til venstre og resultatet til høyre. Ingen faner,
 * ingen steg, ingen veiviser — alt som styrer trekningen er synlig samtidig.
 */

export type Modus = "fag" | "mentor";

/** Datatypen når et navn dras ut av en gruppe (ikke hele raden). */
const ELEVDRAG = "application/x-okta-elev";
type Visning = "timeplan" | "fordeling" | "alfabetisk";

/** En dag slik den vises i timeplanen. */
type Dagplan = {
  dag: Samtaledag;
  /** Utledes av hullet mellom to samtaler — lagres ikke som egen rad. */
  lunsj: { fra: string; til: string } | null;
  rader: {
    /** raden i basen, når trekningen er lagret */
    samtaleId: string | null;
    /** eleven — eller gruppa, som én enhet (se `enhetId`) */
    elevId: string;
    /** navnene, kommaseparert når det er en gruppe */
    navn: string;
    /** elevene på plassen: én, eller flere i en gruppesamtale */
    medlemmer: { id: string; navn: string }[];
    tema: string | null;
    fra: string;
    til: string;
    motte: boolean;
  }[];
};

/** Standardverdier for en ny dag (§4.10). */
const NY_DAG = { fra: "08:30", til: "15:00", lunsjFra: "11:45", lunsjMin: 30 };

/**
 * Temalista har ingen egen tabell — `samtale.tema` lagrer resultatet, ikke
 * oppsettet. Den ligger derfor i `innstilling`, per fag, som kolonnevalgene.
 */
const temanokkel = (fagId: string) => `samtale_temaer_${fagId}`;

export function Samtaler({
  skolear,
  fag,
  startFagId,
}: {
  skolear: Skolear;
  fag: FagIAr[];
  /** Faget man kom fra, f.eks. fra en muntlig vurdering. */
  startFagId?: string;
}) {
  const [modus, setModus] = useState<Modus>(startFagId ? "fag" : "fag");
  const [fagId, setFagId] = useState(startFagId ?? fag[0]?.id ?? "");
  const [samtaletid, setSamtaletid] = useState("20");
  const [pause, setPause] = useState("5");
  const [temaer, setTemaer] = useState<string[]>([]);
  const [dager, setDager] = useState<Samtaledag[]>([]);
  const [elever, setElever] = useState<ElevRad[]>([]);
  const [egenListe, setEgenListe] = useState("");
  const [brukEgen, setBrukEgen] = useState(false);
  const [historikk, setHistorikk] = useState<Map<string, Plassering[]>>(
    new Map(),
  );
  // Vektingen er av som standard. Ren tilfeldighet er normaltilstanden (§4.10).
  const [vekting, setVekting] = useState(false);
  const [trekning, setTrekning] = useState<Dagplan[] | null>(null);
  const [lagret, setLagret] = useState(true);
  // De to hovedlåsene overlever en ny generering — de er en arbeidsmåte man
  // har valgt. Elevlåsene nullstilles, siden en ny trekning er en ny start
  // for enkeltvalgene (§4.10).
  const [lastTema, setLastTema] = useState(false);
  const [lastRekkefolge, setLastRekkefolge] = useState(false);
  const [lasteElever, setLasteElever] = useState<Set<string>>(new Set());
  const [dragmelding, setDragmelding] = useState<string | null>(null);
  const [visning, setVisning] = useState<Visning>("timeplan");
  const [kopiert, setKopiert] = useState<"teams" | "md" | null>(null);
  const [notater, setNotater] = useState<Map<string, Elevnotat>>(new Map());
  // Alle samtaledagene i året, ikke bare de som hører til valget nå — det er
  // dem oversikten øverst er til for.
  const [alleDager, setAlleDager] = useState<Samtaledag[]>([]);
  const [kalender, setKalender] = useState<Awaited<
    ReturnType<typeof mentorStatus>
  > | null>(null);
  const [publiserer, setPubliserer] = useState(false);
  const [vurderinger, setVurderinger] = useState<Vurdering[]>([]);
  // Hvor mange som har samtale sammen: 1 = enkeltvis, 2 = par, osv.
  // Huskes per fag, og for mentorsamtalene for seg.
  const [storrelse, setStorrelse] = useState(1);
  const storrelseNokkel =
    modus === "mentor"
      ? "samtale_storrelse_mentor"
      : `samtale_storrelse_${fagId}`;
  // Fagets økter, til avkrysningen. Samtalene legges i øktene (§4.10).
  const [oktvalg, setOktvalg] = useState<Oktvalg[]>([]);
  // Vurderingen trekningen hører til. Står på dagene i basen, men må kunne
  // velges før noen dag finnes — da øktene krysses av etterpå.
  const [valgtVurdering, setValgtVurdering] = useState("");

  const minutter = Number(samtaletid) || 20;
  const pausen = Number(pause) || 0;

  /**
   * Temaene som faktisk gjelder.
   *
   * Mentorsamtalen har ikke oppgavenummer (§4.10). Lista over temaer lastes
   * bare i fagmodus, så den blir stående med forrige fags verdier når man
   * bytter — og da delte trekningen dem ut i mentormodus også. Modus leses
   * derfor ut her, ett sted, så de to trekningsveiene ikke kan komme i utakt.
   */
  const aktiveTemaer =
    modus === "fag" ? temaer.filter((t) => t.trim() !== "") : [];

  async function last() {
    setElever(await hentElever(skolear.id));
    setHistorikk(await hentHistorikk(skolear.id));

    const alle = await hentSamtaledager(skolear.id);
    setAlleDager(alle);
    const mine = alle.filter((d) =>
      modus === "mentor" ? d.skolearFagId === null : d.skolearFagId === fagId,
    );
    setDager(mine);

    // Er det allerede trukket på disse dagene, vises det som står i basen.
    const lagrede: Dagplan[] = [];
    for (const dag of mine) {
      const samtaler = await hentSamtaler(dag.id);
      if (samtaler.length === 0) continue;
      const tider = samtaler.map((s) => ({
        fra: s.klokkeslett,
        til: tilKlokke(tilMin(s.klokkeslett) + s.varighetMin),
      }));
      // Elever på samme klokkeslett er én gruppesamtale. De samles igjen til
      // én plass, slik de ble trukket.
      lagrede.push({
        dag,
        lunsj: finnLunsj(tider, dag),
        rader: samlePaTid(samtaler).map((gr) => {
          const s = gr[0];
          const medlemmer = gr.map((x) => ({
            id: x.elevId,
            navn: `${x.fornavn} ${x.etternavn}`,
          }));
          return {
            samtaleId: s.id,
            elevId: enhetId(gr.map((x) => x.elevId)),
            navn: medlemmer.map((m) => m.navn).join(", "),
            medlemmer,
            // En dag uten fag har ingen oppgave. Sto det likevel noe der fra
            // før, er det spor etter feilen over, og det skal ikke vises.
            tema: dag.skolearFagId === null ? null : s.tema,
            fra: s.klokkeslett,
            til: tilKlokke(tilMin(s.klokkeslett) + s.varighetMin),
            motte: gr.every((x) => x.motte),
          };
        }),
      });
    }
    setTrekning(lagrede.length > 0 ? lagrede : null);
    setNotater(await notaterFor(lagrede));
    setKalender(await mentorStatus(skolear));
    setVurderinger(await hentVurderinger(skolear.id));
    setLagret(true);

    if (modus === "fag") {
      setOktvalg(await hentOktvalg(fagId));
      setValgtVurdering(mine.find((d) => d.vurderingId)?.vurderingId ?? "");
    }

    // I mentormodus ligger én dag klar med én gang, så datofeltet er fremme
    // og ikke gjemt bak en «legg til»-lenke. I fagmodus velges øktene.
    if (mine.length === 0 && modus === "mentor") {
      await opprettSamtaledag(skolear.id, {
        skolearFagId: modus === "mentor" ? null : fagId,
        dato: "",
        ...NY_DAG,
      });
      const etter = await hentSamtaledager(skolear.id);
      setAlleDager(etter);
      setDager(
        etter.filter((d) =>
          modus === "mentor"
            ? d.skolearFagId === null
            : d.skolearFagId === fagId,
        ),
      );
    }
  }

  useEffect(() => {
    void last();
  }, [skolear.id, modus, fagId]);

  useEffect(() => {
    void hentInnstilling(storrelseNokkel).then((v) =>
      setStorrelse(v ? Math.max(1, Number(v) || 1) : 1),
    );
  }, [storrelseNokkel]);

  useEffect(() => {
    if (modus !== "fag" || !fagId) return;
    void hentInnstilling(temanokkel(fagId)).then((v) =>
      setTemaer(v ? (JSON.parse(v) as string[]) : []),
    );
  }, [modus, fagId]);

  function lagreTemaer(nye: string[]) {
    setTemaer(nye);
    if (modus === "fag" && fagId) {
      void settInnstilling(temanokkel(fagId), JSON.stringify(nye));
    }
  }

  /** Elevene trekningen gjelder — fra appen, eller fra lista du limte inn. */
  const deltakere = useMemo(() => {
    if (brukEgen) {
      return egenListe
        .split("\n")
        .map((n) => n.trim())
        .filter((n) => n !== "")
        .map((navn, i) => ({ id: `limt-${i}`, navn }));
    }
    const passer =
      modus === "mentor"
        ? (e: ElevRad) => e.mentor
        : (e: ElevRad) => e.fagIder.includes(fagId);
    return elever
      .filter(passer)
      .map((e) => ({ id: e.id, navn: `${e.fornavn} ${e.etternavn}` }));
  }, [brukEgen, egenListe, elever, modus, fagId]);

  /** Legger ut dagene og bygger radene som vises. */
  function byggPlan(
    perDag: string[][],
    temakart: Map<string, string>,
  ): Dagplan[] {
    const navn = new Map(deltakere.map((d) => [d.id, d.navn]));
    const plan: Dagplan[] = [];

    dager.forEach((dag, i) => {
      const paDagen = perDag[i] ?? [];
      if (paDagen.length === 0) return;

      const alle = leggUtDagen(dag, paDagen.length, minutter, pausen);
      const lunsjslot = alle.find((s) => s.type === "lunsj");
      const slots = alle.filter((s) => s.type === "samtale");
      plan.push({
        dag,
        lunsj: lunsjslot
          ? { fra: tilKlokke(lunsjslot.fra), til: tilKlokke(lunsjslot.til) }
          : null,
        rader: slots.map((s, j) => {
          const medlemmer = medlemmerAv(paDagen[j]).map((id) => ({
            id,
            navn: navn.get(id) ?? "",
          }));
          return {
            samtaleId: null,
            elevId: paDagen[j],
            navn: medlemmer.map((m) => m.navn).join(", "),
            medlemmer,
            tema: temakart.get(paDagen[j]) ?? null,
            fra: tilKlokke(s.fra),
            til: tilKlokke(s.til),
            motte: true,
          };
        }),
      });
    });
    return plan;
  }

  /**
   * Skriver trekningen.
   *
   * Innlimte elever finnes ikke i basen, og samtale.elev_id har fremmednøkkel
   * til elev — da vises trekningen uten å lagres, tydelig merket. Å gjøre
   * innlimingen ubrukelig ville vært verre.
   */
  async function skriv(plan: Dagplan[]) {
    setTrekning(plan);

    if (brukEgen) {
      setLagret(false);
      return;
    }

    for (const d of plan) {
      // En gruppe pakkes ut: hver elev får sin rad, på samme klokkeslett.
      await lagreTrekning(
        d.dag.id,
        d.rader.flatMap((r) =>
          medlemmerAv(r.elevId).map((elevId) => ({
            elevId,
            klokkeslett: r.fra,
            varighetMin: minutter,
            tema: r.tema,
          })),
        ),
      );
    }
    setLagret(true);
    // Les tilbake fra basen: da får radene sine ekte id-er, og oversikten
    // over planlagte samtaler får riktig antall. Uten dette sto den igjen
    // med «ikke trukket» etter en trekning.
    await last();
  }

  /**
   * Flytter en rad, innen dagen eller til en annen dag.
   *
   * Klokkeslettene står der de står — det er elevene som flyttes mellom dem.
   * `fra` og `til` er plasser i den viste timeplanen, som hopper over dager
   * uten elever; de oversettes her til dagslista, som `byggPlan` leser.
   */
  async function flytt(
    fra: { dag: number; rad: number },
    til: { dag: number; rad: number; etter: boolean },
  ) {
    if (!trekning) return;

    const perDag = dager.map(
      (d) =>
        trekning.find((p) => p.dag.id === d.id)?.rader.map((r) => r.elevId) ??
        [],
    );
    const idx = (planIdx: number) =>
      dager.findIndex((d) => d.id === trekning[planIdx]?.dag.id);
    const fraDag = idx(fra.dag);
    const tilDag = idx(til.dag);
    if (fraDag < 0 || tilDag < 0) return;

    let nye = perDag;
    if (fraDag === tilDag) {
      nye[fraDag] = flyttInnenDagen(perDag[fraDag], fra.rad, til.rad);
    } else {
      const svar = flyttMellomDager(
        perDag,
        kapasiteter,
        { dag: fraDag, rad: fra.rad },
        { dag: tilDag, rad: til.rad, etter: til.etter },
      );
      nye = svar.perDag;
      if (svar.byttet) {
        const navn = new Map(deltakere.map((d) => [d.id, d.navn]));
        const flyttet = perDag[fraDag][fra.rad];
        setDragmelding(
          `Dagen var full, så ${navn.get(flyttet) ?? "eleven"} og ${navn.get(svar.byttet) ?? "eleven"} byttet plass.`,
        );
        setTimeout(() => setDragmelding(null), 6000);
      }
    }

    const na = new Map<string, string>();
    for (const d of trekning) {
      for (const r of d.rader) if (r.tema) na.set(r.elevId, r.tema);
    }
    await skriv(byggPlan(nye, na));
  }

  /**
   * Flytter én elev fra sin gruppe over i en annen — den manuelle justeringen
   * av gruppene. Temaet og låsen følger plassen, ikke eleven.
   */
  async function flyttElev(elevId: string, dagIdx: number, radIdx: number) {
    if (!trekning) return;
    const perDag = dager.map(
      (d) =>
        trekning.find((p) => p.dag.id === d.id)?.rader.map((r) => r.elevId) ??
        [],
    );
    const tilDag = dager.findIndex((d) => d.id === trekning[dagIdx]?.dag.id);
    if (tilDag < 0) return;

    const { perDag: nye, nyId } = flyttTilEnhet(perDag, elevId, {
      dag: tilDag,
      rad: radIdx,
    });
    if (nyId.size === 0) return;

    const tema = new Map<string, string>();
    for (const d of trekning)
      for (const r of d.rader)
        if (r.tema) tema.set(nyId.get(r.elevId) ?? r.elevId, r.tema);
    setLasteElever((l) => new Set([...l].map((id) => nyId.get(id) ?? id)));
    await skriv(byggPlan(nye, tema));
  }

  /**
   * Notatene for en trekning, slått opp på elev per dag.
   *
   * Nøkkelen er `elevId` fordi en elev bare har én rad per dag i praksis, og
   * fordi oppslaget da også finner notater skrevet på elevsiden.
   */
  async function notaterFor(plan: Dagplan[]): Promise<Map<string, Elevnotat>> {
    const ut = new Map<string, Elevnotat>();
    for (const d of plan) {
      const funnet = await hentNotatPerElev(
        d.rader.map((r) => r.elevId),
        d.dag.dato,
      );
      for (const [elevId, notat] of funnet) ut.set(elevId, notat);
    }
    return ut;
  }

  /**
   * Notatet fra samtalen lagres i møteloggen (§4.7), ikke på timeplanraden.
   *
   * Da står det på elevsiden sammen med alt annet du har notert om hen over
   * tid — og det finnes fortsatt bare ett sted notater om en elev bor.
   */
  async function lagreNotat(
    rad: Dagplan["rader"][number],
    dag: Samtaledag,
    tekst: string,
    folgesOpp: boolean,
  ) {
    const finnes = notater.get(rad.elevId);

    if (finnes) {
      await endreElevnotat(finnes.id, { tekst, skalFolgesOpp: folgesOpp });
    } else {
      if (!rad.samtaleId) return;
      await opprettElevnotat(rad.elevId, dag.skolearId, {
        dato: dag.dato,
        tekst,
        // Fagsamtalens notat henger på faget, så det dukker opp når elevkortet
        // filtreres på det. Mentorsamtalens står uten fag, som den skal.
        skolearFagId: dag.skolearFagId,
        skalFolgesOpp: folgesOpp,
        samtaleId: rad.samtaleId,
      });
    }

    setNotater(await notaterFor(trekning ?? []));
  }

  async function publiser() {
    setPubliserer(true);
    try {
      await publiserMentor(skolear);
      setKalender(await mentorStatus(skolear));
      setVurderinger(await hentVurderinger(skolear.id));
    } catch (feil) {
      setDragmelding(`Publiseringen feilet: ${String(feil)}`);
    } finally {
      setPubliserer(false);
    }
  }

  /** Formen eksportene arbeider på. */
  function tilEksport(): Eksportdag[] {
    return (trekning ?? []).map((d) => ({
      dato: d.dag.dato,
      lunsj: d.lunsj,
      rader: d.rader.map((r) => ({
        navn: r.navn,
        tema: r.tema,
        fra: r.fra,
        til: r.til,
        motte: r.motte,
      })),
    }));
  }

  async function tilMarkdown() {
    await navigator.clipboard.writeText(
      somMarkdown(tilEksport(), modus === "fag"),
    );
    setKopiert("md");
    setTimeout(() => setKopiert(null), 1500);
  }

  async function tilTeams() {
    const html = somTeamsHtml(tilEksport(), modus === "fag");
    // Teams tar imot formatert tabell når den limes som text/html.
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([somMarkdown(tilEksport(), modus === "fag")], {
          type: "text/plain",
        }),
      }),
    ]);
    setKopiert("teams");
    setTimeout(() => setKopiert(null), 1500);
  }

  /**
   * Sletter en planlagt trekning — alle dagene og samtalene. Spør først, og
   * sier hva som forsvinner.
   */
  async function slettPlan(dagene: Samtaledag[], navn: string) {
    const antall = dagene.reduce((n, d) => n + d.antall, 0);
    const iOkter = dagene.some((d) => d.oktId);
    if (
      !(await bekreft(
        `Slette de planlagte samtalene i ${navn}?\n\n` +
          `${dagene.length} ${dagene.length === 1 ? "dag" : "dager"}` +
          (antall > 0 ? ` og ${antall} samtaler` : "") +
          " forsvinner." +
          (iOkter ? " Vurderingen løses fra øktene samtalene lå i." : "") +
          "\n\nSikkerhetskopien fra i dag er veien tilbake.",
      ))
    )
      return;
    await slettTrekning(dagene);
    setTrekning(null);
    await last();
  }

  /** Helt ny trekning. Fordeler på nytt over dagene, og løser opp elevlåsene. */
  async function generer() {
    if (
      trekning &&
      !(await bekreft(
        "Generer ny trekning?\n\nDen som ligger nå blir erstattet, og låsene på enkeltelever løses opp.",
      ))
    )
      return;

    const ider = deltakere.map((d) => d.id);
    const ordnet = vekting ? vektetRekkefolge(ider, historikk) : stokk(ider);
    // Gruppene settes sammen av den trukne rekkefølgen, så de er tilfeldige
    // de også. Hver gruppe er én plass i timeplanen.
    const enheter = delIGrupper(ordnet, storrelse).map(enhetId);

    setLasteElever(new Set());
    await skriv(
      byggPlan(
        delPaDager(enheter, kapasiteter),
        tildelTema(enheter, aktiveTemaer),
      ),
    );
  }

  /**
   * Trekker om innenfor den fordelingen som allerede er gjort.
   *
   * Låsene bestemmer hva som faktisk endres. Er begge på, skjer ingenting —
   * og da sier hjelpeteksten det, framfor at knappen ser ut til å virke.
   */
  async function trekkPaNytt() {
    if (!trekning) return generer();
    if (lastTema && lastRekkefolge) return;

    const perDag = trekning.map((d) => d.rader.map((r) => r.elevId));
    const na = new Map<string, string>();
    for (const d of trekning) {
      for (const r of d.rader) if (r.tema) na.set(r.elevId, r.tema);
    }

    const nyPerDag = lastRekkefolge
      ? perDag
      : trekkOmRekkefolge(perDag, lasteElever);

    const nyttTema = lastTema
      ? na
      : trekkOmTema(perDag.flat(), na, lasteElever, aktiveTemaer);

    await skriv(byggPlan(nyPerDag, nyttTema));
  }

  const kapasiteter = dager.map((d) => kapasitet(d, minutter, pausen));
  const samletKapasitet = kapasiteter.reduce((a, b) => a + b, 0);
  // Plassene som trengs: én per elev, eller én per gruppe.
  const plasserTrengs = antallEnheter(deltakere.length, storrelse);
  const plassord = storrelse > 1 ? "grupper" : "elever";
  const timer = dager.reduce((sum, d) => sum + timerPaDagen(d), 0);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 gap-6 overflow-clip">
      {/*
        Oppsettskolonnen. Én sammenhengende kolonne med sin egen rullesone —
        ingen faner, ingen steg. Alt som styrer trekningen er synlig samtidig.
      */}
      <div className="flex w-80 shrink-0 flex-col overflow-clip">
        <div className="min-h-0 flex-1 space-y-5 overflow-auto pr-1">
          {/*
            Oversikten står øverst fordi den er inngangen: kommer du tilbake
            til skjermen, er det den planlagte trekningen du leter etter — ikke
            innstillingene til en ny.
          */}
          <Bolk tittel="Planlagte samtaler">
            <Trekningsliste
              trekninger={grupperTrekninger(alleDager)}
              aktiv={modus === "mentor" ? null : fagId}
              erMentor={modus === "mentor"}
              onVelg={(skolearFagId) => {
                setModus(skolearFagId === null ? "mentor" : "fag");
                if (skolearFagId !== null) setFagId(skolearFagId);
              }}
              onSlett={(t) =>
                void slettPlan(t.dager, t.fagKode ?? "mentorsamtalene")
              }
            />
          </Bolk>

          <Bolk tittel="Modus">
            <div className="flex gap-1">
              <Modusknapp
                aktiv={modus === "fag"}
                onClick={() => setModus("fag")}
              >
                Fagsamtale
              </Modusknapp>
              <Modusknapp
                aktiv={modus === "mentor"}
                onClick={() => setModus("mentor")}
              >
                Mentorsamtale
              </Modusknapp>
            </div>
            {modus === "fag" && (
              <select
                value={fagId}
                onChange={(e) => setFagId(e.target.value)}
                className="mt-2 w-full rounded border border-linje bg-ark px-2 py-1.5 text-brod"
              >
                {fag.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.kode} — {f.navn}
                  </option>
                ))}
              </select>
            )}
            {modus === "mentor" && (
              <p className="mt-2 text-liten text-blekk-dempet">
                Mentorsamtalen hører ikke til noe fag. Elevene er mentorelevene
                dine i år.
              </p>
            )}
          </Bolk>

          <Bolk tittel="Grunninnstillinger">
            <div className="flex gap-2">
              <Felt
                etikett="Minutter per samtale"
                verdi={samtaletid}
                settVerdi={setSamtaletid}
                bredde="w-1/2"
              />
              <Felt
                etikett="Pause (min)"
                verdi={pause}
                settVerdi={setPause}
                bredde="w-1/2"
              />
            </div>
            <label className="mt-2 block">
              <span className="mb-1 block text-etikett uppercase tracking-etikett text-blekk-dempet">
                Samtale
              </span>
              <select
                value={storrelse}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setStorrelse(n);
                  void settInnstilling(storrelseNokkel, String(n));
                }}
                className="w-full rounded border border-linje bg-ark px-2 py-1.5 text-brod"
              >
                <option value={1}>Enkeltvis</option>
                <option value={2}>I par</option>
                <option value={3}>Tre og tre</option>
                <option value={4}>Fire og fire</option>
                <option value={5}>Fem og fem</option>
                <option value={6}>Seks og seks</option>
              </select>
            </label>
            <p className="mt-1 text-liten text-blekk-dempet">
              {deltakere.length} elever
              {storrelse > 1 && ` i ${plasserTrengs} grupper`} · plass til{" "}
              {samletKapasitet} {plassord}
            </p>
            {storrelse > 1 && (
              <p className="mt-1 text-liten text-blekk-svak">
                Minuttene gjelder hele gruppa. Går det ikke opp, blir de siste
                gruppene én større. Dra et navn i timeplanen over på en annen
                gruppe for å flytte eleven.
              </p>
            )}
          </Bolk>

          <Bolk tittel="Elever">
            {!brukEgen ? (
              <>
                <p className="text-brod text-blekk-dempet">
                  {deltakere.length > 0
                    ? `${deltakere.length} elever hentet fra ${
                        modus === "mentor" ? "mentorgruppa" : "faget"
                      }.`
                    : modus === "mentor"
                      ? "Ingen mentorelever i år ennå."
                      : "Ingen elever er koblet til dette faget."}
                </p>
                <button
                  onClick={() => setBrukEgen(true)}
                  className="mt-1 text-liten text-blekk-svak hover:text-blekk"
                >
                  Lim inn en egen liste
                </button>
              </>
            ) : (
              <>
                <textarea
                  value={egenListe}
                  onChange={(e) => setEgenListe(e.target.value)}
                  rows={6}
                  placeholder={"Tony Soprano\nCarmela Soprano"}
                  className="w-full rounded border border-linje px-2 py-1.5 font-mono text-liten outline-none focus:border-aksent"
                />
                <button
                  onClick={() => {
                    setBrukEgen(false);
                    setEgenListe("");
                  }}
                  className="mt-1 text-liten text-blekk-svak hover:text-blekk"
                >
                  Bruk elevene fra appen i stedet
                </button>
              </>
            )}
          </Bolk>

          {/* Mentorsamtalen har ikke oppgavenummer (§4.10). */}
          {modus === "fag" && (
            <Bolk tittel="Oppgavenummer og tema">
              {temaer.length === 0 && (
                <p className="text-liten text-blekk-svak">
                  Ingen temaer ennå. Uten temaer trekkes bare rekkefølgen.
                </p>
              )}
              {temaer.map((t, i) => (
                <div key={i} className="mb-1 flex items-center gap-2">
                  <span className="w-6 shrink-0 text-right text-liten tabular-nums text-blekk-svak">
                    {i + 1}
                  </span>
                  <input
                    value={t}
                    onChange={(e) =>
                      lagreTemaer(
                        temaer.map((x, j) => (j === i ? e.target.value : x)),
                      )
                    }
                    placeholder={`Oppgave ${i + 1}`}
                    className="min-w-0 flex-1 rounded border border-linje bg-ark px-2 py-1 text-brod outline-none focus:border-aksent"
                  />
                  <button
                    onClick={() =>
                      lagreTemaer(temaer.filter((_, j) => j !== i))
                    }
                    className="shrink-0 px-1 text-blekk-svakest hover:text-feil"
                    title="Fjern"
                  >
                    <Ikon navn="kryss" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => lagreTemaer([...temaer, ""])}
                className="mt-1 text-liten text-blekk-dempet hover:text-blekk"
              >
                + Legg til tema
              </button>
            </Bolk>
          )}

          <Bolk
            tittel={modus === "fag" ? "Vurdering og økter" : "Samtaledager"}
          >
            {/*
              Hvilken vurdering trekningen hører til. Uten den vises ikke
              oppgaven eleven fikk under selve vurderingen (§4.6), og den
              står ikke på øktene i årsplanen.
            */}
            {modus === "fag" && (
              <label className="mb-3 block">
                <span className="mb-1 block text-etikett uppercase tracking-etikett text-blekk-dempet">
                  Hører til vurdering
                </span>
                <select
                  value={valgtVurdering}
                  onChange={async (e) => {
                    setValgtVurdering(e.target.value);
                    await settTrekningensVurdering(
                      dager,
                      e.target.value || null,
                    );
                    await last();
                  }}
                  className="w-full rounded border border-linje bg-ark px-2 py-1.5 text-brod"
                >
                  <option value="">Ingen</option>
                  {vurderinger
                    .filter((v) => v.skolearFagId === fagId)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.tittel}
                      </option>
                    ))}
                </select>
              </label>
            )}

            {modus === "fag" && (
              <Oktvelger
                okter={oktvalg}
                vurderingsokter={
                  new Set(
                    vurderinger
                      .filter(
                        (v) =>
                          v.skolearFagId === fagId &&
                          (!valgtVurdering || v.id === valgtVurdering),
                      )
                      .flatMap((v) => v.oktIder),
                  )
                }
                dager={dager}
                kapasiteter={kapasiteter}
                plassord={plassord}
                onVelg={async (okt, pa) => {
                  const dag = dager.find((d) => d.oktId === okt.id);
                  if (pa) {
                    await leggDagIOkt(
                      skolear.id,
                      okt.id,
                      valgtVurdering || null,
                    );
                  } else if (dag) {
                    if (
                      dag.antall > 0 &&
                      !(await bekreft(
                        `Ta samtalene ut av økta ${kortDato(okt.dato)}?\n\n` +
                          `${dag.antall} samtaler er trukket der. De forsvinner.`,
                      ))
                    )
                      return;
                    await fjernDagFraOkt(dag.id);
                  }
                  await last();
                }}
              />
            )}

            {/*
              Egne dager, utenfor øktene. I mentormodus er det de eneste —
              mentorsamtalen har ikke noe fag og dermed ingen økter.
            */}
            {dager.map((dag, i) =>
              dag.oktId ? null : (
                <Dagkort
                  key={dag.id}
                  dag={dag}
                  nr={i + 1}
                  kapasitet={kapasiteter[i]}
                  plassord={plassord}
                  onEndre={async (felter) => {
                    await endreSamtaledag(dag.id, felter);
                    await last();
                  }}
                  onSlett={async () => {
                    if (
                      !(await bekreft(
                        `Slette dag ${i + 1}?\n\nSamtalene som er trukket på den forsvinner.`,
                      ))
                    )
                      return;
                    await slettSamtaledag(dag.id);
                    await last();
                  }}
                />
              ),
            )}
            <button
              onClick={async () => {
                await opprettSamtaledag(skolear.id, {
                  skolearFagId: modus === "mentor" ? null : fagId,
                  dato: "",
                  vurderingId: modus === "fag" ? valgtVurdering || null : null,
                  ...NY_DAG,
                });
                await last();
              }}
              className="mt-1 text-liten text-blekk-dempet hover:text-blekk"
            >
              {modus === "fag" ? "+ Egen dag utenfor øktene" : "+ Legg til dag"}
            </button>

            {dager.length > 0 && (
              <p className="mt-2 text-liten text-blekk-svak">
                {timer} timer satt av til vurdering
              </p>
            )}
          </Bolk>

          {/*
            Historikken er synlig mens du trekker, ikke bare etterpå. Merknadene
            vises uansett om vektingen er på — de er opplysning, ikke konsekvens
            av en innstilling (§4.10).
          */}
          <Bolk tittel="Historikk">
            <Historikkoversikt deltakere={deltakere} historikk={historikk} />
            <label className="mt-2 flex select-none items-center gap-1.5 text-liten text-blekk-dempet">
              <input
                type="checkbox"
                checked={vekting}
                onChange={(e) => setVekting(e.target.checked)}
              />
              Vekt mot gjentakelse
            </label>
          </Bolk>
        </div>

        {/* Generer, og under den Trekk på nytt med de to låsene (§4.10). */}
        <div className="shrink-0 space-y-3 border-t border-linje-medium pt-3">
          <Knapp
            variant="primar"
            disabled={deltakere.length === 0 || dager.length === 0}
            onClick={() => void generer()}
          >
            Generer timeplan
          </Knapp>

          {trekning && (
            <div>
              <h2 className="mb-2 text-etikett uppercase tracking-etikett text-blekk-dempet">
                Trekk på nytt
              </h2>
              <div className="flex gap-1">
                <Lasknapp
                  last={lastTema}
                  onKlikk={() => setLastTema((v) => !v)}
                >
                  Tema
                </Lasknapp>
                <Lasknapp
                  last={lastRekkefolge}
                  onKlikk={() => setLastRekkefolge((v) => !v)}
                >
                  Rekkefølge
                </Lasknapp>
              </div>
              <p className="mt-1 min-h-4 text-liten text-blekk-svak">
                {lashint(lastTema, lastRekkefolge)}
              </p>
              <button
                onClick={() => void trekkPaNytt()}
                disabled={lastTema && lastRekkefolge}
                className="mt-1 w-full rounded border border-linje bg-ark px-3 py-1.5 text-brod hover:bg-flate disabled:opacity-40 disabled:hover:bg-ark"
              >
                Trekk på nytt
              </button>
              {lasteElever.size > 0 && (
                <p className="mt-1 text-liten text-blekk-svak">
                  {lasteElever.size}{" "}
                  {lasteElever.size === 1 ? "elev" : "elever"} låst
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {plasserTrengs > samletKapasitet && dager.length > 0 && (
          <div className="mb-4 border border-varsel bg-fri-flate px-3 py-2 text-brod text-varsel">
            Kapasiteten ({samletKapasitet} {plassord}) er lavere enn det som
            trengs ({plasserTrengs} {plassord}).{" "}
            {modus === "fag"
              ? "Kryss av for flere økter, legg til en egen dag, eller reduser pausetiden."
              : "Legg til flere dager, forleng øktene, eller reduser pausetiden."}
          </div>
        )}

        {dragmelding && (
          <div className="mb-4 border border-linje bg-flate px-3 py-2 text-brod text-blekk-dempet">
            {dragmelding}
          </div>
        )}

        {!lagret && (
          <div className="mb-4 border border-linje bg-flate px-3 py-2 text-brod text-blekk-dempet">
            Trekningen er ikke lagret. Elevene i den innlimte lista finnes ikke
            i appen, så det er ingenting å henge samtalene på. Lim dem inn under
            Elever først, så lagres trekningen og teller i historikken.
          </div>
        )}

        {trekning !== null && (
          <div className="mb-4 flex items-center gap-2">
            <Knapp onClick={() => void tilTeams()}>
              {kopiert === "teams" ? (
                <>
                  <Ikon navn="hake" /> Kopiert
                </>
              ) : (
                "Kopier til Teams"
              )}
            </Knapp>
            <Knapp onClick={() => void tilMarkdown()}>
              {kopiert === "md" ? (
                <>
                  <Ikon navn="hake" /> Kopiert
                </>
              ) : (
                "Kopier som markdown"
              )}
            </Knapp>
            <Knapp onClick={() => void invoke("skriv_ut")}>Skriv ut</Knapp>
            <Knapp
              variant="stille"
              onClick={() =>
                void slettPlan(
                  dager,
                  modus === "mentor"
                    ? "mentorsamtalene"
                    : (fag.find((f) => f.id === fagId)?.kode ?? "faget"),
                )
              }
            >
              Slett planen
            </Knapp>

            {/*
              Publiseringen er en bevisst handling, ikke en bivirkning av at
              du dro en rad. Knappen sier hva som venter — og at noe er endret
              siden sist, så du vet at kalenderen er i utakt (§8.1).
            */}
            {modus === "mentor" && kalender?.pa && (
              <span className="ml-auto flex items-center gap-2">
                <span className="text-liten text-blekk-dempet">
                  {kalendertekst(kalender)}
                </span>
                <Knapp
                  variant={
                    kalender.endrede + kalender.fjernes > 0
                      ? "primar"
                      : "vanlig"
                  }
                  disabled={
                    publiserer || kalender.endrede + kalender.fjernes === 0
                  }
                  onClick={() => void publiser()}
                >
                  {publiserer ? "Publiserer …" : "Publiser til kalender"}
                </Knapp>
              </span>
            )}
          </div>
        )}

        {trekning !== null && (
          <div className="mb-4 flex gap-1">
            <Bryter
              storrelse="liten"
              verdi={visning}
              settVerdi={(v) => setVisning(v as Visning)}
              valg={[
                { id: "timeplan", navn: "Timeplan" },
                { id: "fordeling", navn: "Fordeling" },
                { id: "alfabetisk", navn: "Alfabetisk" },
                // Fordelingen handler om temaene, og mentorsamtalen har ingen.
              ].filter((v) => !(v.id === "fordeling" && modus === "mentor"))}
            />
          </div>
        )}

        {trekning === null ? (
          <Tomtilstand
            tekst={
              dager.length === 0
                ? modus === "fag"
                  ? "Kryss av for øktene samtalene skal ligge i, til venstre — eller legg til en egen dag."
                  : "Legg til minst én samtaledag til venstre."
                : "Sett opp trekningen til venstre og trykk Generer timeplan."
            }
          />
        ) : visning === "fordeling" ? (
          <Fordeling plan={trekning} />
        ) : visning === "alfabetisk" ? (
          <Alfabetisk plan={trekning} medTema={modus === "fag"} />
        ) : (
          <Timeplan
            plan={trekning}
            historikk={historikk}
            laste={lasteElever}
            notater={notater}
            onNotat={(rad, dag, tekst, folgesOpp) =>
              void lagreNotat(rad, dag, tekst, folgesOpp)
            }
            onFlytt={(fra, til) => void flytt(fra, til)}
            onFlyttElev={(elevId, dag, rad) => void flyttElev(elevId, dag, rad)}
            onLas={(elevId) =>
              setLasteElever((f) => {
                const ny = new Set(f);
                if (ny.has(elevId)) ny.delete(elevId);
                else ny.add(elevId);
                return ny;
              })
            }
          />
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ deler

function Bolk({
  tittel,
  children,
}: {
  tittel: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 border-b border-linje-medium pb-1 text-etikett uppercase tracking-etikett text-blekk-dempet">
        {tittel}
      </h2>
      {children}
    </section>
  );
}

function Modusknapp({
  aktiv,
  onClick,
  children,
}: {
  aktiv: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={aktiv}
      className={`flex-1 rounded-vanlig border px-2 py-1.5 text-brod ${
        aktiv
          ? "border-aksent bg-valgt font-medium text-aksent"
          : "border-linje text-blekk-dempet hover:bg-flate"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Ett kort per dag, med sin egen kapasitet.
 *
 * Kapasiteten oppdateres mens du skriver — den regnes ut fra dagen slik den
 * står akkurat nå, ikke fra noe som må lagres først.
 */
/**
 * Fagets økter som avkrysningsliste. Hver økt som krysses av, blir en
 * samtaledag med øktas klokkeslett som ramme (§4.10). Får ikke alle elevene
 * plass i én økt, krysses en til av — kapasiteten står ved hver.
 *
 * Kommende økter vises; tidligere bare når de allerede er valgt, eller når
 * du ber om dem.
 */
function Oktvelger({
  okter,
  vurderingsokter,
  dager,
  kapasiteter,
  plassord,
  onVelg,
}: {
  okter: Oktvalg[];
  /**
   * Øktene som er huket av for en vurdering — den valgte, eller alle i
   * faget når ingen er valgt. Det er bare dem samtaler legges i, så lista
   * viser bare dem til du ber om resten.
   */
  vurderingsokter: Set<string>;
  dager: Samtaledag[];
  kapasiteter: number[];
  plassord: string;
  onVelg: (okt: Oktvalg, pa: boolean) => Promise<void>;
}) {
  const [visAlle, setVisAlle] = useState(false);
  const [visTidligere, setVisTidligere] = useState(false);
  const idag = new Date().toLocaleDateString("sv-SE");
  const valgt = new Map(dager.map((d, i) => [d.oktId, kapasiteter[i]]));
  const synlige = okter.filter((o) =>
    visAlle
      ? visTidligere || o.dato >= idag || valgt.has(o.id)
      : vurderingsokter.has(o.id) || valgt.has(o.id),
  );
  const skjulte = visAlle ? okter.length - synlige.length : 0;

  if (okter.length === 0) {
    return (
      <p className="mb-2 text-liten text-blekk-svak">
        Faget har ingen økter ennå. Legg dem inn under Økter, eller bruk en egen
        dag under.
      </p>
    );
  }

  return (
    <div className="mb-2">
      <span className="mb-1 block text-etikett uppercase tracking-etikett text-blekk-dempet">
        Legg samtalene i økta
      </span>
      {synlige.length === 0 ? (
        <p className="text-liten text-blekk-svak">
          Ingen økter er knyttet til vurderingen ennå. Huk av for vurderingen på
          økta, eller vis alle øktene i faget.
        </p>
      ) : (
        <div className="max-h-64 overflow-y-auto rounded border border-linje bg-ark">
          {synlige.map((o) => {
            const pa = valgt.has(o.id);
            const plass = valgt.get(o.id);
            const tid = o.klokkeslett
              ? `${o.klokkeslett}–${tilKlokke(tilMin(o.klokkeslett) + o.varighetMin)}`
              : null;
            return (
              <label
                key={o.id}
                className={`flex items-baseline gap-2 border-b border-linje-svak px-2 py-1 text-brod last:border-b-0 ${
                  tid ? "hover:bg-flate" : "text-blekk-svak"
                }`}
                title={tid ? undefined : "Økta mangler klokkeslett"}
              >
                <input
                  type="checkbox"
                  checked={pa}
                  disabled={!tid}
                  onChange={(e) => void onVelg(o, e.target.checked)}
                  className="self-center"
                />
                <span className="shrink-0 tabular-nums">
                  {kortDato(o.dato)}
                </span>
                <span className="shrink-0 tabular-nums text-blekk-dempet">
                  {tid ?? "uten klokkeslett"}
                </span>
                <span className="min-w-0 flex-1 truncate text-blekk-dempet">
                  {o.tema}
                </span>
                {pa && (
                  <span className="shrink-0 text-liten tabular-nums text-blekk-dempet">
                    maks {plass} {plassord}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      )}
      <span className="mt-1 flex gap-4">
        <button
          onClick={() => setVisAlle((v) => !v)}
          className="text-liten text-blekk-svak hover:text-blekk"
        >
          {visAlle
            ? "Bare øktene med vurdering"
            : `Vis alle ${okter.length} øktene i faget`}
        </button>
        {skjulte > 0 && (
          <button
            onClick={() => setVisTidligere(true)}
            className="text-liten text-blekk-svak hover:text-blekk"
          >
            Vis {skjulte} tidligere økter
          </button>
        )}
      </span>
    </div>
  );
}

function Dagkort({
  dag,
  nr,
  kapasitet: plass,
  plassord = "elever",
  onEndre,
  onSlett,
}: {
  dag: Samtaledag;
  nr: number;
  kapasitet: number;
  /** «elever», eller «grupper» i gruppesamtaler */
  plassord?: string;
  onEndre: (felter: Record<string, unknown>) => Promise<void>;
  onSlett: () => void;
}) {
  const harLunsj = dag.lunsjFra !== null;

  return (
    <div className="mb-2 rounded-vanlig border border-linje bg-flate-svak p-2">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-liten font-medium">Dag {nr}</span>
        <span className="flex items-baseline gap-2">
          <span className="text-liten tabular-nums text-blekk-dempet">
            {plass > 0 ? `Maks ${plass} ${plassord}` : "–"}
          </span>
          <button
            onClick={onSlett}
            className="text-blekk-svakest hover:text-feil"
            title="Fjern dagen"
          >
            <Ikon navn="kryss" />
          </button>
        </span>
      </div>

      <input
        type="date"
        defaultValue={dag.dato}
        key={`d${dag.dato}`}
        onBlur={(e) => void onEndre({ dato: e.target.value })}
        className={feltstil + " mb-1.5 w-full"}
      />

      <div className="flex gap-1.5">
        <input
          type="time"
          defaultValue={dag.fra}
          key={`f${dag.fra}`}
          onBlur={(e) => void onEndre({ fra: e.target.value })}
          className={feltstil + " w-1/2"}
        />
        <input
          type="time"
          defaultValue={dag.til}
          key={`t${dag.til}`}
          onBlur={(e) => void onEndre({ til: e.target.value })}
          className={feltstil + " w-1/2"}
        />
      </div>

      <label className="mt-1.5 flex select-none items-center gap-1.5 text-liten text-blekk-dempet">
        <input
          type="checkbox"
          checked={harLunsj}
          onChange={(e) =>
            void onEndre(
              e.target.checked
                ? { lunsj_fra: "11:45", lunsj_min: 30 }
                : { lunsj_fra: null, lunsj_min: null },
            )
          }
        />
        Lunsjpause
      </label>

      {harLunsj && (
        <div className="mt-1.5 flex gap-1.5">
          <input
            type="time"
            defaultValue={dag.lunsjFra ?? "11:45"}
            key={`lf${dag.lunsjFra}`}
            onBlur={(e) => void onEndre({ lunsj_fra: e.target.value })}
            className={feltstil + " w-1/2"}
          />
          <input
            type="number"
            min={5}
            max={120}
            defaultValue={dag.lunsjMin ?? 30}
            key={`lm${dag.lunsjMin}`}
            onBlur={(e) =>
              void onEndre({ lunsj_min: Number(e.target.value) || 30 })
            }
            className={feltstil + " w-1/2"}
          />
        </div>
      )}
    </div>
  );
}

const feltstil =
  "rounded border border-linje bg-ark px-2 py-1 text-brod tabular-nums outline-none focus:border-aksent";

/**
 * Timeplanen: én bolk per dag, én rad per samtale.
 *
 * Plassnummeret løper sammenhengende over alle dagene — dag 2 fortsetter der
 * dag 1 sluttet (§4.10).
 */
function Timeplan({
  plan,
  historikk,
  laste,
  notater,
  onLas,
  onNotat,
  onFlytt,
  onFlyttElev,
}: {
  plan: Dagplan[];
  historikk: Map<string, Plassering[]>;
  laste: ReadonlySet<string>;
  notater: Map<string, Elevnotat>;
  onLas: (elevId: string) => void;
  onNotat: (
    rad: Dagplan["rader"][number],
    dag: Samtaledag,
    tekst: string,
    folgesOpp: boolean,
  ) => void;
  onFlytt: (
    fra: { dag: number; rad: number },
    til: { dag: number; rad: number; etter: boolean },
  ) => void;
  /** en elev dras fra sin gruppe over på en annen plass */
  onFlyttElev: (elevId: string, dag: number, rad: number) => void;
}) {
  // Et navn åpner elevkortet som et ark over timeplanen.
  const ark = useArk();
  let plass = 0;

  return (
    <div className="space-y-6">
      {plan.map((d, dagIdx) => (
        <section key={d.dag.id}>
          <div className="mb-1 flex items-baseline justify-between border-b border-linje pb-1">
            <h2 className="font-display text-tittel first-letter:uppercase">
              {langDato(d.dag.dato)}
            </h2>
            <span className="text-liten tabular-nums text-blekk-dempet">
              {d.dag.fra}–{d.dag.til} ·{" "}
              {d.rader.reduce((n, r) => n + r.medlemmer.length, 0)} elever
              {d.rader.some((r) => r.medlemmer.length > 1) &&
                ` i ${d.rader.length} grupper`}
            </span>
          </div>

          {d.rader.map((r, radIdx) => {
            plass++;
            // Lunsjen står på sin plass i rekka: rett før den første samtalen
            // som begynner etter at pausen er over.
            const lunsjHer =
              d.lunsj !== null &&
              r.fra >= d.lunsj.til &&
              (radIdx === 0 || d.rader[radIdx - 1].fra < d.lunsj.fra);
            // Merknaden bygges på historikken FØR denne trekningen, så den
            // sier noe om hva som har skjedd — ikke om det som nettopp ble
            // trukket.
            const notis = merknad(historikk.get(r.elevId) ?? []);
            const erLast = laste.has(r.elevId);
            return (
              <Fragment key={`${r.elevId}-${r.fra}`}>
                {lunsjHer && d.lunsj && (
                  <div className="flex items-baseline gap-3 border-b border-linje-svak py-1.5 text-brod italic text-blekk-svak">
                    <span className="w-6 shrink-0 text-right">—</span>
                    <span className="w-24 shrink-0 tabular-nums">
                      {d.lunsj.fra}–{d.lunsj.til}
                    </span>
                    <span className="flex-1">
                      Lunsj ({tilMin(d.lunsj.til) - tilMin(d.lunsj.fra)} min)
                    </span>
                  </div>
                )}
                <div
                  draggable={!erLast}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      "text/plain",
                      JSON.stringify({ dagIdx, radIdx }),
                    );
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    // Et navn dratt ut av en gruppe: eleven flyttes hit.
                    const elev = e.dataTransfer.getData(ELEVDRAG);
                    if (elev) return onFlyttElev(elev, dagIdx, radIdx);
                    const data = e.dataTransfer.getData("text/plain");
                    if (!data) return;
                    const kilde = JSON.parse(data) as {
                      dagIdx: number;
                      radIdx: number;
                    };
                    // Nedre halvdel av raden betyr «etter denne». Slik kan en
                    // elev dras helt sist på en annen dag.
                    const r = e.currentTarget.getBoundingClientRect();
                    const etter = e.clientY > r.top + r.height / 2;
                    onFlytt(
                      { dag: kilde.dagIdx, rad: kilde.radIdx },
                      { dag: dagIdx, rad: radIdx, etter },
                    );
                  }}
                  className={`flex items-baseline gap-3 border-b border-linje-svak py-1.5 text-brod ${
                    r.motte ? "" : "text-blekk-svak line-through"
                  } ${erLast ? "bg-flate-svak" : "cursor-grab"}`}
                >
                  <span className="w-6 shrink-0 text-right tabular-nums text-blekk-svak">
                    {plass}
                  </span>
                  <span className="w-24 shrink-0 tabular-nums text-blekk-dempet">
                    {r.fra}–{r.til}
                  </span>
                  {r.medlemmer.length > 1 ? (
                    <span className="flex min-w-0 flex-1 flex-wrap gap-1">
                      {r.medlemmer.map((m) => (
                        <span
                          key={m.id}
                          draggable={!erLast}
                          onDragStart={(e) => {
                            // Navnet, ikke hele raden: raden har sitt eget drag.
                            e.stopPropagation();
                            e.dataTransfer.setData(ELEVDRAG, m.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onClick={() => ark.apneElev(m.id)}
                          title="Klikk for elevkortet, dra til en annen gruppe"
                          className={`cursor-pointer rounded-full bg-flate px-2 py-px hover:bg-linje-medium ${erLast ? "" : "active:cursor-grab"}`}
                        >
                          {m.navn}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <button
                      onClick={() =>
                        r.medlemmer[0] && ark.apneElev(r.medlemmer[0].id)
                      }
                      className="min-w-0 flex-1 text-left hover:text-aksent"
                    >
                      <Kappet verdi={r.navn} />
                    </button>
                  )}
                  {r.tema && (
                    <Kappet
                      verdi={r.tema}
                      klasse="w-40 shrink-0 text-blekk-dempet"
                    />
                  )}
                  <span className="w-32 shrink-0 text-right text-liten text-blekk-svak">
                    {r.motte ? notis : "møtte ikke"}
                  </span>
                  <button
                    onClick={() => onLas(r.elevId)}
                    title={
                      erLast
                        ? "Lås opp — eleven trekkes om igjen"
                        : "Lås — eleven beholder plass og tema"
                    }
                    className={`w-5 shrink-0 text-liten ${
                      erLast
                        ? "text-aksent"
                        : "text-blekk-svakest hover:text-blekk"
                    }`}
                  >
                    <Ikon navn={erLast ? "las" : "apen-las"} />
                  </button>
                </div>

                {/* Notatet går til elevens møtelogg, så det hører til én elev. */}
                {r.samtaleId && r.medlemmer.length === 1 && (
                  <Notatfelt
                    notat={notater.get(r.elevId) ?? null}
                    onLagre={(tekst, folgesOpp) =>
                      onNotat(r, d.dag, tekst, folgesOpp)
                    }
                  />
                )}
              </Fragment>
            );
          })}
        </section>
      ))}
    </div>
  );
}

/**
 * Hvem som hadde tidlig eller sent sist, samlet.
 *
 * Bare de som har noe å si står her — de fleste har ingenting, og det er
 * nettopp derfor de som har det er verdt å se på.
 */
function Historikkoversikt({
  deltakere,
  historikk,
}: {
  deltakere: { id: string; navn: string }[];
  historikk: Map<string, Plassering[]>;
}) {
  const grupper = new Map<string, string[]>();
  for (const d of deltakere) {
    const notis = merknad(historikk.get(d.id) ?? []);
    if (!notis) continue;
    grupper.set(notis, [...(grupper.get(notis) ?? []), d.navn.split(" ")[0]]);
  }

  if (grupper.size === 0) {
    return (
      <p className="text-liten text-blekk-svak">
        Ingenting å melde ennå. Etter et par trekninger står det her hvem som
        har hatt tidlig eller sent.
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {[...grupper].map(([notis, navn]) => (
        <li key={notis} className="text-liten">
          <span className="text-blekk-dempet">{notis}</span>{" "}
          <span className="text-blekk-svak">· {navn.join(", ")}</span>
        </li>
      ))}
    </ul>
  );
}

/** Ordlyden fra §4.10 — den sier hva «Trekk på nytt» faktisk gjør. */
function lashint(tema: boolean, rekkefolge: boolean): string {
  if (tema && rekkefolge) return "Begge er låst — ingenting endres.";
  if (tema) return "Temaer holdes — kun rekkefølge trekkes.";
  if (rekkefolge) return "Rekkefølge holdes — kun tema trekkes.";
  return "";
}

function Lasknapp({
  last,
  onKlikk,
  children,
}: {
  last: boolean;
  onKlikk: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onKlikk}
      aria-pressed={last}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-vanlig border px-2 py-1 text-liten ${
        last
          ? "border-aksent bg-valgt text-aksent"
          : "border-linje text-blekk-dempet hover:bg-flate"
      }`}
    >
      <Ikon navn={last ? "las" : "apen-las"} />
      {children}
    </button>
  );
}

function langDato(dato: string): string {
  if (!dato) return "Dato ikke satt";
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/**
 * Fordeling — ett kort per elev i tidsrekkefølge på tvers av alle dagene.
 *
 * Plassnummeret er posisjonen i køen denne trekningen, ikke en fast id.
 */
function Fordeling({ plan }: { plan: Dagplan[] }) {
  const alle = plan.flatMap((d) => d.rader);

  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(11rem,1fr))]">
      {alle.map((r, i) => (
        <div
          key={`${r.elevId}-${r.fra}`}
          className={`rounded-vanlig border border-linje bg-ark px-3 py-2 ${
            r.motte ? "" : "opacity-50"
          }`}
        >
          <span className="text-liten tabular-nums text-blekk-svak">
            {i + 1}
          </span>
          <p className="truncate text-brod font-medium">{r.navn}</p>
          {r.tema && (
            <p className="truncate text-liten text-blekk-dempet">{r.tema}</p>
          )}
          <p className="text-liten tabular-nums text-blekk-svak">{r.fra}</p>
        </div>
      ))}
    </div>
  );
}

/** Alfabetisk — lista sortert på navn, med tidspunkt og dag. */
function Alfabetisk({ plan, medTema }: { plan: Dagplan[]; medTema: boolean }) {
  // Én rad per elev, også i gruppesamtaler — lista er til å finne seg selv.
  const rader = plan
    .flatMap((d) =>
      d.rader.flatMap((r) =>
        r.medlemmer.map((m) => ({
          ...r,
          elevId: m.id,
          navn: m.navn,
          dato: d.dag.dato,
        })),
      ),
    )
    .sort((a, b) => a.navn.localeCompare(b.navn, "nb-NO"));

  return (
    <table className="w-full text-brod">
      <thead>
        <tr className="border-b border-linje text-left text-etikett uppercase tracking-etikett text-blekk-dempet">
          <th className="py-1">Navn</th>
          {medTema && <th className="py-1">Oppgave</th>}
          <th className="py-1">Tid</th>
          <th className="py-1">Dag</th>
        </tr>
      </thead>
      <tbody>
        {rader.map((r) => (
          <tr
            key={`${r.elevId}-${r.fra}`}
            className={`border-b border-linje-svak ${
              r.motte ? "" : "text-blekk-svak line-through"
            }`}
          >
            <td className="py-1.5">{r.navn}</td>
            {medTema && (
              <td className="py-1.5 text-blekk-dempet">{r.tema ?? ""}</td>
            )}
            <td className="py-1.5 tabular-nums text-blekk-dempet">
              {r.fra}–{r.til}
            </td>
            <td className="py-1.5 tabular-nums text-blekk-dempet">
              {kortDato(r.dato)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function kortDato(dato: string): string {
  if (!dato) return "—";
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
  });
}

/**
 * Notatet fra samtalen, skrevet der du står under dagen.
 *
 * Det lagres i møteloggen på elevsiden (§4.7), ikke på timeplanraden — så det
 * står sammen med alt annet du har notert om eleven over tid. Feltet er
 * sammenklappet til det finnes noe å vise, så en dag uten notater er rolig.
 */
function Notatfelt({
  notat,
  onLagre,
}: {
  notat: Elevnotat | null;
  onLagre: (tekst: string, folgesOpp: boolean) => void;
}) {
  const [apent, setApent] = useState(false);

  if (!apent && !notat) {
    return (
      <div className="border-b border-linje-svak pb-1.5 pl-[7.5rem]">
        <button
          onClick={() => setApent(true)}
          className="text-liten text-blekk-svakest hover:text-blekk"
        >
          + notat
        </button>
      </div>
    );
  }

  return (
    <div className="border-b border-linje-svak py-1.5 pl-[7.5rem]">
      <textarea
        defaultValue={notat?.tekst ?? ""}
        key={notat?.id ?? "ny"}
        autoFocus={apent && !notat}
        rows={2}
        placeholder="Hva ble sagt, og hva ble avtalt?"
        onBlur={(e) => {
          const tekst = e.target.value.trim();
          if (tekst === "" || tekst === notat?.tekst) return;
          onLagre(tekst, notat?.skalFolgesOpp ?? false);
        }}
        className="w-full rounded-vanlig border border-linje px-2 py-1 text-brod outline-none placeholder:text-blekk-svakest focus:border-aksent"
      />
      <label className="mt-1 flex select-none items-center gap-1.5 text-liten text-blekk-dempet">
        <input
          type="checkbox"
          checked={notat?.skalFolgesOpp ?? false}
          disabled={!notat}
          title={notat ? undefined : "Skriv notatet først"}
          onChange={(e) => notat && onLagre(notat.tekst, e.target.checked)}
        />
        Skal følges opp
        <span className="ml-auto text-blekk-svakest">
          {notat ? "lagret i møteloggen" : ""}
        </span>
      </label>
    </div>
  );
}

/**
 * Trekningene som finnes i året, med den du står i markert.
 *
 * Uten denne er en trekning bare synlig hvis man tilfeldigvis står på riktig
 * modus og fag når skjermen åpnes — og en mentortrekning er da usynlig, siden
 * skjermen alltid begynner på fagsamtale.
 */
function Trekningsliste({
  trekninger,
  aktiv,
  erMentor,
  onVelg,
  onSlett,
}: {
  trekninger: Trekning[];
  /** skolear_fag-id-en man står i, eller null for mentormodus */
  aktiv: string | null;
  erMentor: boolean;
  onVelg: (skolearFagId: string | null) => void;
  onSlett: (t: Trekning) => void;
}) {
  if (trekninger.length === 0) {
    return (
      <p className="text-liten text-blekk-svak">
        Ingen samtaler planlagt ennå. Sett opp dagene under, så står de her.
      </p>
    );
  }

  return (
    <ul className="space-y-0.5">
      {trekninger.map((t) => (
        <Trekningsrad
          key={t.skolearFagId ?? "mentor"}
          t={t}
          valgt={erMentor ? t.skolearFagId === null : t.skolearFagId === aktiv}
          onVelg={() => onVelg(t.skolearFagId)}
          onSlett={() => onSlett(t)}
        />
      ))}
    </ul>
  );
}

/**
 * Én planlagt trekning. Sveip til venstre med to fingre viser Slett-knappen,
 * som i Mail; sveip tilbake skjuler den.
 *
 * Sveipet kommer som vannrett rulling (deltaX). Det summeres over et kort
 * vindu, så et lite sidelengs dytt mens man ruller nedover ikke utløser noe.
 */
function Trekningsrad({
  t,
  valgt,
  onVelg,
  onSlett,
}: {
  t: Trekning;
  valgt: boolean;
  onVelg: () => void;
  onSlett: () => void;
}) {
  const [apen, setApen] = useState(false);
  const sum = useRef(0);
  const nullstill = useRef<ReturnType<typeof setTimeout> | null>(null);

  return (
    <li
      className="relative overflow-hidden rounded-vanlig"
      onWheel={(e) => {
        if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
        sum.current += e.deltaX;
        if (nullstill.current) clearTimeout(nullstill.current);
        nullstill.current = setTimeout(() => (sum.current = 0), 250);
        if (sum.current > 40) {
          setApen(true);
          sum.current = 0;
        } else if (sum.current < -40) {
          setApen(false);
          sum.current = 0;
        }
      }}
    >
      <button
        onClick={onSlett}
        tabIndex={apen ? 0 : -1}
        aria-hidden={!apen}
        className="absolute inset-y-0 right-0 w-20 bg-feil text-liten font-medium text-ark"
      >
        Slett
      </button>
      <button
        onClick={() => (apen ? setApen(false) : onVelg())}
        style={{ transform: apen ? "translateX(-5rem)" : undefined }}
        className={`relative flex w-full items-baseline gap-2 rounded-vanlig px-2 py-1 text-left text-brod transition-transform duration-150 ${
          valgt ? "bg-valgt text-aksent" : "bg-bord hover:bg-flate"
        }`}
      >
        <Kappet
          verdi={t.fagKode ?? "Mentorsamtale"}
          klasse="min-w-0 flex-1 font-medium"
        />
        <span className="shrink-0 text-liten tabular-nums text-blekk-dempet">
          {spenn(t)}
        </span>
        <span className="w-14 shrink-0 text-right text-liten tabular-nums text-blekk-svak">
          {t.antall > 0 ? `${t.antall} stk` : "ikke trukket"}
        </span>
      </button>
    </li>
  );
}

/** «24. nov» for én dag, «2.–3. des» for flere. */
function spenn(t: Trekning): string {
  if (!t.forste) return "dato mangler";
  if (t.forste === t.siste) return kortDato(t.forste);
  return `${kortDato(t.forste)}–${kortDato(t.siste)}`;
}

/**
 * Hva kalenderen vet om trekningen.
 *
 * Sier om den er i utakt, ikke bare om publiseringen er slått på — en
 * omstokking etter publisering skal være synlig som noe som må sendes.
 */
function kalendertekst(k: {
  kalender: string;
  publiserte: number;
  uendret: number;
  endrede: number;
  fjernes: number;
}): string {
  if (!k.kalender.trim()) return "Ingen kalender satt i innstillingene";

  const utakt = k.endrede + k.fjernes;
  if (utakt === 0) {
    return k.uendret === 0
      ? "Ingenting å publisere"
      : `${k.uendret} publisert, ingen endringer`;
  }
  if (k.publiserte === 0) return `${k.endrede} samtaler ikke publisert ennå`;
  return `${utakt} endret siden publisering`;
}
