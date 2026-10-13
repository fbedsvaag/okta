import { Sammenleggknapp, useApen } from "../ui/Sammenleggbar";
import { Utfold } from "../ui/Utfold";
import { useEffect, useState } from "react";
import type { Skolear } from "../data/skolear";
import type { FagIAr } from "../data/fag";
import { hentOkter, type Okt } from "../data/okter";
import { Fagfirkant, Ikon, Knapp, Tomtilstand } from "../ui/felles";
import { Markdown } from "../ui/Notattekst";
import { vekslBoks } from "../ui/markdown";
import { endreOkt } from "../data/okter";
import { hentPerioder } from "../data/perioder";
import { useArk } from "../ui/Arkstabel";
import { Arsoversikt } from "./Arsoversikt";
import { dagenssetning, hentSamtalerPaDato } from "../data/samtale";
import { Ukelinje } from "./Ukelinje";
import { lytt, lyttOktvisning } from "../data/endringer";
import { dagen, type Dagslinje } from "../data/dagen";

/**
 * I dag — startskjermen, SPEC §4.1, med årsoversikten under.
 *
 * MERK: §13 sier «ingen grafer på forsiden», og §10 legger et rikere dashbord
 * til senere. Årsoversikten er lagt inn etter uttrykkelig beslutning fra
 * eieren, som overstyrer begge. SPEC.md er ikke skrevet om — koden avviker
 * altså bevisst fra spec-en på dette punktet.
 */
export function IDag({
  skolear,
  fag,
  onGaTil,
  onApneOkt,
}: {
  skolear: Skolear;
  fag: FagIAr[];
  onGaTil: (
    visning: "fag" | "elever" | "okter" | "vurderinger" | "samtaler",
    /** tingen skjermen skal åpne — f.eks. eleven du klikket på */
    id?: string,
  ) => void;
  /** åpner økta som et ark over forsiden */
  onApneOkt: (id: string) => void;
}) {
  const [okter, setOkter] = useState<Okt[]>([]);
  const [samtaler, setSamtaler] = useState<
    Awaited<ReturnType<typeof hentSamtalerPaDato>>
  >([]);

  const lastOkter = () => void hentOkter(skolear.id).then(setOkter);
  useEffect(lastOkter, [skolear.id]);
  // Endres en økt i et ark over forsiden, skal uka vise det med en gang.
  useEffect(() => lytt(lastOkter), [skolear.id]);
  useEffect(() => lyttOktvisning(lastOkter), [skolear.id]);

  // En økt, en elev eller en vurdering åpnes som et ark over forsiden
  // (Arkstabel) — du blir her.
  const apne = onApneOkt;
  const ark = useArk();

  useEffect(() => {
    void hentSamtalerPaDato(skolear.id, isoDato(new Date())).then(setSamtaler);
  }, [skolear.id]);

  const idag = isoDato(new Date());

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-clip">
      {/* Datoen blir stående mens resten ruller. */}
      <div className="shrink-0 pb-2">
        <h1 className="text-[calc(32px*var(--tekst-skala))] font-light leading-tight tracking-overskrift first-letter:uppercase">
          {langDato(idag)}
        </h1>
      </div>

      {/* Rullefeltet er skjult — man ruller med styreflata. */}
      <div className="scrollbar-skjult min-h-0 flex-1 overflow-auto">
        <Arsoversikt
          skolearId={skolear.id}
          skolestart={skolear.start}
          skoleslutt={skolear.slutt}
          fag={fag}
          okter={okter}
          onApneElev={(elevId) => ark.apneElev(elevId)}
          onApneVurdering={(id) => ark.apneVurdering(id)}
        >
          {/*
            Samtaledagen står først: er det samtaler i dag, er det dem dagen
            handler om. Setningen sier hva som venter — hvem du begynner med,
            hvor mange som står igjen, og når du er ferdig (§4.10).
          */}
          {samtaler.length > 0 && (
            <Bolk tittel="Samtaler" nokkel="forside-samtaler">
              <p className="py-1 text-brod">
                {dagenssetning(
                  samtaler,
                  new Date().toTimeString().slice(0, 5),
                  samtaler.every((s) => s.erMentor),
                )}
              </p>
              <button
                onClick={() => onGaTil("samtaler")}
                className="text-liten text-blekk-dempet hover:text-blekk"
              >
                Åpne timeplanen <Ikon navn="pil" />
              </button>
            </Bolk>
          )}

          {/*
            Uten økter er det ingenting å vise — da peker forsiden dit man
            begynner.
          */}
          {okter.length === 0 && (
            <Tomtilstand
              tekst={
                fag.length === 0
                  ? "Ingen fag i skoleåret ennå."
                  : "Ingen økter er lagt inn ennå."
              }
              handling={
                <Knapp
                  variant="primar"
                  onClick={() => onGaTil(fag.length === 0 ? "fag" : "okter")}
                >
                  {fag.length === 0 ? "Legg inn fagene dine" : "Legg inn økter"}
                </Knapp>
              }
            />
          )}

          {okter.length > 0 && (
            <Dagensokter okter={okter} idag={idag} onApne={apne} />
          )}

          <Bolk tittel="Uka" nokkel="forside-uka">
            <Ukelinje
              okter={okter}
              forste={skolear.start}
              siste={skolear.slutt}
              idag={idag}
              onApneOkt={apne}
            />
          </Bolk>
        </Arsoversikt>
      </div>
    </div>
  );
}

/**
 * Dagens økter (DESIGN.md §10): tida i egen kolonne, fagfirkanten på linje
 * med tittelen, og fag, rom og periode på linja under. Notatet fra forrige
 * økt i faget står under hver økt og kan legges sammen — valget huskes for
 * alle øktene samlet. Boksene i notatet kan krysses av rett her.
 *
 * Ingen oppsummeringssetning over: den gjentok bare det lista sier.
 */
function Dagensokter({
  okter,
  idag,
  onApne,
}: {
  okter: Okt[];
  idag: string;
  onApne: (id: string) => void;
}) {
  const d = dagen(okter, idag);
  const [perioder, setPerioder] = useState<Map<string, string>>(new Map());
  const [na, setNa] = useState(() => new Date());

  // Periodenavnene til dagens økter. Få fag, få kall.
  const fagIDag = [...new Set(d.linjer.map((l) => l.okt.skolearFagId))].join();
  useEffect(() => {
    let avbrutt = false;
    void Promise.all(fagIDag.split(",").filter(Boolean).map(hentPerioder)).then(
      (lister) => {
        if (!avbrutt)
          setPerioder(new Map(lister.flat().map((p) => [p.id, p.navn])));
      },
    );
    return () => {
      avbrutt = true;
    };
  }, [fagIDag]);

  // «om 1 t 50 min» skal stemme uten at man laster forsiden på nytt.
  // ↵ åpner økta som pågår, eller den neste i dag (ARBEIDSLISTE 7.5).
  // Bare når ingenting annet har fokus — ikke i et felt eller et åpent kort.
  useEffect(() => {
    const tast = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.activeElement && document.activeElement !== document.body)
        return;
      const naMin = new Date().getHours() * 60 + new Date().getMinutes();
      const neste = d.linjer
        .map((l) => okter.find((o) => o.id === l.okt.id)!)
        .find((o) => {
          if (!o.klokkeslett) return true;
          const [t, m] = o.klokkeslett.split(":").map(Number);
          return t * 60 + m + o.varighetMin > naMin;
        });
      if (!neste) return;
      e.preventDefault();
      onApne(neste.id);
    };
    window.addEventListener("keydown", tast);
    return () => window.removeEventListener("keydown", tast);
  });

  useEffect(() => {
    const t = window.setInterval(() => setNa(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <Bolk tittel="Dagens økter" nokkel="forside-dagens">
      {d.linjer.length === 0 ? (
        <p className="py-1 text-brod text-blekk-dempet">Ingen økter i dag.</p>
      ) : (
        <ul className="divide-y divide-linje-medium">
          {d.linjer.map((l) => {
            const okt = okter.find((o) => o.id === l.okt.id)!;
            return (
              <Dagensokt
                key={okt.id}
                okt={okt}
                linje={l}
                periode={
                  okt.periodeId ? perioder.get(okt.periodeId) : undefined
                }
                na={na}
                onApne={onApne}
              />
            );
          })}
        </ul>
      )}
    </Bolk>
  );
}

function Dagensokt({
  okt,
  linje,
  periode,
  na,
  onApne,
}: {
  okt: Okt;
  linje: Dagslinje;
  periode?: string;
  na: Date;
  onApne: (id: string) => void;
}) {
  const slutt = okt.klokkeslett
    ? leggTilMinutter(okt.klokkeslett, okt.varighetMin)
    : null;
  const nar = narTekst(okt.klokkeslett, slutt, na);
  // Fagkoden, ikke fagnavnet (ARBEIDSLISTE 9.4): «MFL2 · Rom 214 · Markedsmiks».
  // Et rom som bare er et nummer, får «Rom» foran.
  const rom = okt.sted && /^\d/.test(okt.sted) ? `Rom ${okt.sted}` : okt.sted;
  const under = [okt.fagKode, rom, periode].filter(Boolean);

  return (
    <li className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-4 py-4">
      <div className="tabular-nums">
        <p className="text-[calc(22px*var(--tekst-skala))] leading-tight">
          {okt.klokkeslett ?? "–"}
        </p>
        {slutt && <p className="text-liten text-blekk-dempet">til {slutt}</p>}
      </div>

      <div className="min-w-0">
        {/*
          Firkanten i egen kolonne, på linje med tittelen, så både tittelen
          og linja under starter på samme sted (DESIGN.md §6).
        */}
        <div className="grid grid-cols-[12px_minmax(0,1fr)_auto] items-baseline gap-x-2.5">
          <Fagfirkant farge={okt.farge} storrelse={12} klasse="self-center" />
          <button
            onClick={() => onApne(okt.id)}
            className="min-w-0 truncate text-left text-tittel font-medium hover:text-aksent"
          >
            {okt.tema || okt.fagNavn}
          </button>
          <span className="flex items-center gap-3">
            {nar && (
              <span className="text-liten tabular-nums text-blekk-dempet">
                {nar}
              </span>
            )}
            <button
              onClick={() => onApne(okt.id)}
              title="Åpne økta (↵)"
              className="flex items-center gap-1.5 rounded-vanlig px-1 py-0.5 text-etikett text-blekk-dempet hover:text-blekk"
            >
              <kbd className="rounded border border-linje bg-ark px-1.5 font-sans leading-4">
                ↵
              </kbd>
              åpne økta
            </button>
          </span>
          <span />
          <p className="col-span-2 truncate text-liten text-blekk-dempet">
            <span className="font-medium text-blekk">{under[0]}</span>
            {under.length > 1 && ` · ${under.slice(1).join(" · ")}`}
          </p>
        </div>

        <div className="ml-[22px] mt-3 max-w-2xl">
          <ForrigeNotat linje={linje} onApne={onApne} />
        </div>
      </div>
    </li>
  );
}

/** Notatet fra forrige økt i faget, som en boks som kan legges sammen. */
function ForrigeNotat({
  linje,
  onApne,
}: {
  linje: Dagslinje;
  onApne: (id: string) => void;
}) {
  const [apen, setApen] = useApen("forside-forrige-notat");
  const { forrige } = linje;
  const [logg, setLogg] = useState(forrige?.logg ?? null);
  useEffect(() => setLogg(forrige?.logg ?? null), [forrige?.logg]);

  if (!forrige) {
    return <p className="text-liten text-blekk-svak">Første økt i faget.</p>;
  }
  const nar = kortDato(forrige.dato);

  if (!logg?.trim()) {
    return (
      <p className="text-liten text-blekk-svak">
        Ingen notat fra forrige økt ({nar}).
      </p>
    );
  }

  return (
    <div className="rounded-stor border border-linje-medium bg-flate-svak px-3 py-2">
      <Sammenleggknapp
        tittel={`Notat fra forrige økt (${nar})`}
        apen={apen}
        onBytt={() => setApen(!apen)}
        etter={apen ? undefined : (linje.notat ?? undefined)}
      />
      {apen && (
        <div className="mt-1.5 pl-3.5">
          <Markdown
            tekst={logg}
            onVekslBoks={(nr) => {
              const ny = vekslBoks(logg, nr);
              setLogg(ny);
              void endreOkt(forrige.id, { logg: ny });
            }}
          />
          <button
            onClick={() => onApne(forrige.id)}
            className="mt-1.5 text-liten text-aksent underline-offset-2 hover:underline"
          >
            Åpne økta {nar.split(" ")[1]}
          </button>
        </div>
      )}
    </div>
  );
}

function leggTilMinutter(kl: string, min: number): string {
  const [t, m] = kl.split(":").map(Number);
  const tot = t * 60 + m + min;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(tot / 60) % 24)}:${p(tot % 60)}`;
}

/** «om 1 t 50 min», «pågår», eller ingenting når økta er over. */
function narTekst(
  fra: string | null,
  til: string | null,
  na: Date,
): string | null {
  if (!fra) return null;
  const naMin = na.getHours() * 60 + na.getMinutes();
  const [ft, fm] = fra.split(":").map(Number);
  const start = ft * 60 + fm;
  if (naMin < start) {
    const igjen = start - naMin;
    const t = Math.floor(igjen / 60);
    const m = igjen % 60;
    return `om ${t > 0 ? `${t} t ` : ""}${m > 0 || t === 0 ? `${m} min` : ""}`.trim();
  }
  if (til) {
    const [tt, tm] = til.split(":").map(Number);
    if (naMin < tt * 60 + tm) return "pågår";
  }
  return null;
}

/** «tor 1.10» */
function kortDato(dato: string): string {
  const d = new Date(`${dato}T00:00:00`);
  const dag = d
    .toLocaleDateString("nb-NO", { weekday: "short" })
    .replace(".", "");
  return `${dag} ${d.getDate()}.${d.getMonth() + 1}`;
}

/** En bolk på forsiden. Legges sammen med et klikk på overskriften. */
function Bolk({
  tittel,
  nokkel,
  children,
}: {
  tittel: string;
  /** husker om bolken er lagt sammen (ui/Sammenleggbar) */
  nokkel: string;
  children: React.ReactNode;
}) {
  const [apen, setApen] = useApen(nokkel);
  return (
    <section>
      <div
        className={`border-b border-linje-medium pb-1 ${apen ? "mb-1" : ""}`}
      >
        <Sammenleggknapp
          tittel={tittel}
          apen={apen}
          onBytt={() => setApen(!apen)}
        />
      </div>
      <Utfold apen={apen}>{children}</Utfold>
    </section>
  );
}

function isoDato(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function langDato(dato: string): string {
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
