import { useEffect, useRef, useState } from "react";
import type { Okt } from "../data/okter";
import {
  hentVurderingsvalg,
  knyttOkt,
  losOkt,
  nyVurderingIOkt,
  slettVurdering,
  type Vurderingstype,
  type Vurderingsvalg,
} from "../data/vurderinger";
import { leggDagIOkt } from "../data/samtale";
import { lyttVurderinger } from "../data/endringer";
import { kortDag } from "../data/fagside";
import { useArk } from "../ui/Arkstabel";
import { leggTilAngring } from "../ui/angre";
import { visToast } from "../ui/Toast";
import { Vurderingsikon } from "../ui/Vurderingsikon";

/**
 * «Vurdering i denne økta» (ARBEIDSLISTE 30.1, lerretet Oktkort): et kort
 * over økta, åpnet med V eller knappen under tittelen. Tre veier inn:
 * skriftlig prøve nå, muntlig innenfor øktas tid, eller knytt til en
 * vurdering faget har. Esc og klikk utenfor lukker kortet, og du blir i
 * økta (§29).
 */
export function OktVurderingKort({
  okt,
  skolearId,
  onLukk,
  onEndret,
}: {
  okt: Okt;
  skolearId: string;
  onLukk: () => void;
  onEndret: () => void;
}) {
  const ark = useArk();
  const [valg, setValg] = useState<Vurderingsvalg[]>([]);
  const [visning, setVisning] = useState<"start" | "knytt" | "ny">("start");
  const last = () => void hentVurderingsvalg(okt.skolearFagId).then(setValg);
  useEffect(last, [okt.skolearFagId, okt.id]);
  useEffect(() => lyttVurderinger(last), [okt.skolearFagId, okt.id]);
  const her = valg.filter((v) => v.oktIder.includes(okt.id));
  const andre = valg.filter((v) => !v.oktIder.includes(okt.id));
  // Den nærmeste vurderingen med frist fra i dag, som undertekst (tegningen).
  const neste = andre.find((v) => v.frist && v.frist >= okt.dato) ?? andre[0];
  const tema = okt.tema?.trim() || okt.fagNavn;

  // Esc lukker kortet først (fanges før arket), og det gjør klikk utenfor.
  useEffect(() => {
    const tast = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (visning !== "start") setVisning("start");
      else onLukk();
    };
    window.addEventListener("keydown", tast, true);
    return () => window.removeEventListener("keydown", tast, true);
  }, [onLukk, visning]);

  /** Laget her: kan angres, og åpnes fra linja nederst. */
  function laget(id: string, tittel: string, apne: string) {
    const angring = {
      tekst: `Vurderingen «${tittel}»`,
      angre: async () => {
        await slettVurdering(id);
        onEndret();
      },
    };
    leggTilAngring(angring);
    visToast(`Vurderingen «${tittel}» er laget og knyttet til økta`, {
      angring,
      handling: { tekst: apne, onKlikk: () => ark.apneVurdering(id) },
    });
  }

  async function skriftlig() {
    const tittel = `Skriftlig prøve: ${tema}`;
    const id = await nyVurderingIOkt(okt, tittel, "skriftlig");
    onEndret();
    onLukk();
    laget(id, tittel, "Før nå");
  }

  async function muntlig() {
    const tittel = `Muntlig: ${tema}`;
    const id = await nyVurderingIOkt(okt, tittel, "muntlig");
    await leggDagIOkt(skolearId, okt.id, id);
    onEndret();
    onLukk();
    // Tidsplanen lages i vurderingen, som legger seg over økta.
    ark.apneVurdering(id);
  }

  async function koble(id: string, pa: boolean) {
    if (pa) await knyttOkt(id, okt.id);
    else await losOkt(id, okt.id);
    last();
    onEndret();
  }

  const knapp =
    "block w-full rounded-[9px] px-2.5 py-2 text-left hover:bg-flate-svak disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent";

  return (
    <>
      <div className="fixed inset-0 z-30" onMouseDown={onLukk} />
      <div
        data-esc-forst
        className="okt-kart-inn absolute left-0 top-[calc(100%+8px)] z-40 w-[360px] rounded-[16px] bg-ark p-3 text-[calc(13px*var(--tekst-skala))] text-blekk shadow-[0_18px_50px_rgba(36,31,51,.24),0_0_0_1px_rgba(36,31,51,.07)]"
        onClick={(e) => e.stopPropagation()}
      >
        {visning === "ny" ? (
          <NyVurdering
            okt={okt}
            onAvbryt={() => setVisning("knytt")}
            onLaget={(id, tittel) => {
              onEndret();
              onLukk();
              laget(id, tittel, "Åpne vurderingen");
            }}
          />
        ) : visning === "knytt" ? (
          <>
            <div className="mb-2 flex items-baseline gap-2 px-1">
              <button
                onClick={() => setVisning("start")}
                className="text-blekk-svak hover:text-blekk"
                aria-label="Tilbake"
              >
                ‹
              </button>
              <b className="text-[calc(12px*var(--tekst-skala))] font-semibold text-blekk-dempet">
                Knytt til en vurdering i {okt.fagKode}
              </b>
            </div>
            {andre.length === 0 && (
              <p className="px-2.5 py-1.5 text-blekk-svak">
                Faget har ingen andre vurderinger.
              </p>
            )}
            <div className="max-h-[260px] overflow-auto">
              {andre.map((v) => (
                <button
                  key={v.id}
                  onClick={async () => {
                    await koble(v.id, true);
                    onLukk();
                  }}
                  className={`${knapp} flex items-center gap-2`}
                >
                  <Vurderingsikon type={v.type} />
                  <span className="min-w-0 flex-1 truncate">{v.tittel}</span>
                  {v.frist && (
                    <span className="shrink-0 text-[calc(12px*var(--tekst-skala))] text-blekk-svak">
                      frist {kortDag(v.frist)}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-1 border-t border-linje-svak pt-1">
              <button
                onClick={() => setVisning("ny")}
                className={`${knapp} text-aksent`}
              >
                + Ny vurdering …
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-2 px-1 text-[calc(12px*var(--tekst-skala))] font-semibold text-blekk-dempet">
              Vurdering i denne økta
            </p>
            {her.length > 0 && (
              <div className="mb-1.5 flex flex-col gap-1 border-b border-linje-svak px-1 pb-2">
                {her.map((v) => (
                  <span key={v.id} className="flex items-center gap-2">
                    <Vurderingsikon type={v.type} />
                    <button
                      onClick={() => {
                        onLukk();
                        ark.apneVurdering(v.id);
                      }}
                      className="min-w-0 flex-1 truncate text-left hover:underline"
                    >
                      {v.tittel}
                    </button>
                    <button
                      onClick={() => void koble(v.id, false)}
                      title="Løs fra økta"
                      className="px-1 text-blekk-svak hover:text-blekk"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <button onClick={() => void skriftlig()} className={knapp}>
              <b className="font-semibold">Skriftlig prøve nå</b>
              <small className="block text-[calc(12px*var(--tekst-skala))] text-blekk-svak">
                Elevene som er til stede blir lagt inn. Fører etterpå.
              </small>
            </button>
            <button
              onClick={() => void muntlig()}
              disabled={!okt.klokkeslett}
              className={knapp}
            >
              <b className="font-semibold">Muntlig i økta</b>
              <small className="block text-[calc(12px*var(--tekst-skala))] text-blekk-svak">
                {okt.klokkeslett
                  ? "Tidsplan innenfor øktas tid."
                  : "Økta har ikke klokkeslett, så det er ingen tid å legge samtalene i."}
              </small>
            </button>
            <button onClick={() => setVisning("knytt")} className={knapp}>
              <b className="font-semibold">Knytt til en vurdering</b>
              <small className="block truncate text-[calc(12px*var(--tekst-skala))] text-blekk-svak">
                {neste
                  ? `${neste.tittel}${neste.frist ? ` · frist ${kortDag(neste.frist)}` : ""}`
                  : "Eller lag en ny"}
              </small>
            </button>
          </>
        )}
      </div>
    </>
  );
}

/**
 * Det lille skjemaet for en ny vurdering i økta (16.9, lerretet
 * OktVurdering): navn fylt ut fra temaet med formen som prefiks, og form.
 * Kriterier og vekt redigeres under Vurderinger.
 */
const FORMER: { id: Vurderingstype | null; navn: string }[] = [
  { id: "muntlig", navn: "Muntlig" },
  { id: "skriftlig", navn: "Skriftlig" },
  { id: "praktisk", navn: "Praktisk" },
  { id: null, navn: "Annet" },
];

function NyVurdering({
  okt,
  onAvbryt,
  onLaget,
}: {
  okt: Okt;
  onAvbryt: () => void;
  onLaget: (id: string, tittel: string) => void;
}) {
  const [form, setForm] = useState<Vurderingstype | null>("skriftlig");
  const prefiks = (f: Vurderingstype | null) =>
    FORMER.find((x) => x.id === f)!.navn;
  const tema = okt.tema?.trim() || okt.fagNavn;
  const [navn, setNavn] = useState(`${prefiks("skriftlig")}: ${tema}`);
  const opptatt = useRef(false);

  async function lag() {
    if (opptatt.current) return;
    opptatt.current = true;
    const tittel = navn.trim() || `${prefiks(form)}: ${tema}`;
    const id = await nyVurderingIOkt(okt, tittel, form);
    onLaget(id, tittel);
  }

  return (
    <div className="p-1">
      <div className="mb-3 flex items-baseline gap-2">
        <span className="font-semibold">Ny vurdering</span>
        <span className="text-[calc(12px*var(--tekst-skala))] text-blekk-svak">
          knyttes til økta {kortDag(okt.dato)}
        </span>
      </div>
      <p className="mb-1 text-[calc(12px*var(--tekst-skala))] text-blekk-dempet">
        Navn
      </p>
      <input
        autoFocus
        value={navn}
        onChange={(e) => setNavn(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void lag();
          }
        }}
        className="h-8 w-full min-w-0 rounded-[7px] bg-ark px-2.5 shadow-[inset_0_0_0_1px_var(--color-linje)] outline-none focus:shadow-[inset_0_0_0_1.5px_var(--color-aksent)]"
      />
      <p className="mb-1 mt-3 text-[calc(12px*var(--tekst-skala))] text-blekk-dempet">
        Form
      </p>
      <div className="flex flex-wrap gap-1.5">
        {FORMER.map((f) => (
          <button
            key={f.navn}
            onClick={() => {
              // Formen er prefikset i navnet; byttes formen, byttes prefikset.
              const rest = navn.replace(
                /^(Muntlig|Skriftlig|Praktisk|Annet): /,
                "",
              );
              setForm(f.id);
              setNavn(`${f.navn}: ${rest}`);
            }}
            className={`planvalg-knapp ${form === f.id ? "pa" : ""}`}
          >
            {f.navn}
          </button>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2">
        <span className="text-[calc(12px*var(--tekst-skala))] text-blekk-svak">
          Kriterier og vekt: i vurderingen
        </span>
        <button
          onClick={onAvbryt}
          className="ml-auto h-8 rounded-full px-3 text-blekk-dempet hover:bg-flate"
        >
          Avbryt
        </button>
        <button
          onClick={() => void lag()}
          className="h-8 rounded-full bg-aksent px-3.5 font-medium text-ark hover:bg-aksent-mork"
        >
          Lag ↵
        </button>
      </div>
    </div>
  );
}
