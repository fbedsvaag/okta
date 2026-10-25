import { useEffect, useState } from "react";
import type { Okt } from "../data/okter";
import {
  klokke,
  lesPlan,
  livePlan,
  livetekst,
  livetid,
  skrivPlan,
  tilMinutter,
  type Planpunkt,
} from "../data/oktplan";

/**
 * Planen mens økta pågår (ARBEIDSLISTE 15.6–15.7, 30.4): med Øktplan: Full
 * en vannrett stripe under arkhodet (lerretet Oktkort), med Enkel én linje.
 * I høyre kolonne står lista med avkrysning i begge.
 *
 * Skåringen animeres aldri (SPEC §13). Tidslinjen oppdateres én gang i
 * minuttet, uten overgang, så den ikke trekker blikket fra elevlista.
 */

/** Klokka nå, oppdatert ved hvert minuttskifte. */
export function useMinutt(): Date {
  const [na, setNa] = useState(() => new Date());
  useEffect(() => {
    let t = 0;
    const neste = () => {
      const d = new Date();
      t = window.setTimeout(
        () => {
          setNa(new Date());
          neste();
        },
        60_000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 50,
      );
    };
    neste();
    return () => window.clearTimeout(t);
  }, []);
  return na;
}

/** Hele minutter siden øktas start (negativ før), eller null uten klokkeslett. */
export function minutterInn(okt: Okt, na: Date): number | null {
  if (!okt.klokkeslett) return null;
  const start = new Date(`${okt.dato}T${okt.klokkeslett}:00`);
  return Math.floor((na.getTime() - start.getTime()) / 60_000);
}

/** Stripa vises den dagen økta er, og bare når den har klokkeslett. */
export function visesLive(okt: Okt, na: Date): boolean {
  const p = (n: number) => String(n).padStart(2, "0");
  const idag = `${na.getFullYear()}-${p(na.getMonth() + 1)}-${p(na.getDate())}`;
  return !!okt.klokkeslett && okt.dato === idag;
}

const INGEN = { transition: "none" } as const;

/**
 * Øktplan: Enkel, den dagen økta er: én linje under arkhodet,
 * «Nå · Gruppearbeid: kildekritikk · 25 min igjen» (15.10). Med Full står
 * det samme i den loddrette planen til høyre.
 */
export function Nalinje({ okt, na }: { okt: Okt; na: Date }) {
  const inn = minutterInn(okt, na);
  if (inn === null || !okt.klokkeslett) return null;
  const { punkter } = lesPlan(okt.plan);
  const t = livetekst(punkter, okt.klokkeslett, okt.varighetMin, inn);
  return (
    <div
      style={INGEN}
      className="flex shrink-0 items-center gap-2.5 border-b border-linje-medium bg-flate-svak/50 px-[28px] py-2.5 text-[calc(13.5px*var(--tekst-skala))]"
    >
      <span className="text-[calc(12px*var(--tekst-skala))] text-blekk-dempet">
        {t.etikett}
      </span>
      <span className="truncate font-medium">{t.tittel}</span>
      <span className="ml-auto shrink-0 tabular-nums text-blekk-dempet">
        {igjenTekst(t)}
      </span>
    </div>
  );
}

/** «25 min igjen» av den aktive, til linja i Enkel. */
function igjenTekst(t: { hoyre: string }): string {
  const m = t.hoyre.match(/^(\d+) av (\d+) min$/);
  return m ? `${Number(m[2]) - Number(m[1])} min igjen` : t.hoyre;
}

/**
 * Planen i høyre kolonne i skåringen (15.7): avkrysning (av seg selv når
 * tida er ute, eller med et klikk), tida til høyre, og den aktive uthevet
 * med en tynn framdriftsstrek og «+5 min».
 */
export function Liveplan({
  okt,
  na,
  onLagre,
  onApnePlan,
}: {
  okt: Okt;
  na: Date;
  onLagre: (plan: string | null) => Promise<void>;
  onApnePlan: () => void;
}) {
  const { punkter, rest } = lesPlan(okt.plan);
  const inn = minutterInn(okt, na);
  const start = okt.klokkeslett;
  const lengde = okt.varighetMin;
  const { liste, aktiv } = livePlan(punkter, start, inn);

  const endre = (i: number, d: Partial<Planpunkt>) =>
    void onLagre(
      skrivPlan(
        punkter.map((p, k) => (k === i ? { ...p, ...d } : p)),
        rest,
      ),
    );

  /**
   * Klikk på avkrysningen: den aktive er ferdig før tida, og neste starter.
   * En som er krysset av med et klikk, kan krysses av igjen.
   */
  const klikkbar = (i: number) =>
    punkter[i].type === "aktivitet" &&
    (i === aktiv || punkter[i].gjort || inn === null);
  const klikk = (i: number) => {
    if (!klikkbar(i)) return;
    if (punkter[i].gjort) endre(i, { gjort: false, ferdig: null });
    else
      endre(i, {
        gjort: true,
        ferdig: start ? klokke(na.getHours() * 60 + na.getMinutes()) : null,
      });
  };

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <p className="text-etikett font-semibold text-blekk">Plan</p>
        {punkter.length > 0 && start && (
          <span className="text-[calc(12px*var(--tekst-skala))] text-blekk-svak">
            krysses av når tida er ute
          </span>
        )}
      </div>
      {punkter.length === 0 ? (
        <div className="mt-2 rounded-[10px] border border-dashed border-linje p-3.5 text-[calc(13px*var(--tekst-skala))] leading-normal text-blekk-dempet">
          Ingen plan for økta.
          <br />
          <button onClick={onApnePlan} className="text-aksent hover:underline">
            Legg til aktivitet
          </button>{" "}
          åpner Planlegging.
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-0.5">
          {punkter.map((p, i) => {
            const l = liste[i];
            const erAktiv = i === aktiv && p.type === "aktivitet";
            const rekker = l.e <= lengde;
            const kan = klikkbar(i);
            const fram =
              erAktiv && inn !== null
                ? Math.min(100, ((inn - l.s) / Math.max(1, l.e - l.s)) * 100)
                : 0;
            return (
              <div
                key={i}
                onClick={() => klikk(i)}
                className={`grid min-h-[34px] grid-cols-[18px_minmax(0,1fr)_auto_auto] items-center gap-[9px] rounded-[8px] px-2 py-1 text-[calc(13px*var(--tekst-skala))] ${
                  erAktiv
                    ? "bg-[color-mix(in_srgb,var(--color-aksent)_7%,var(--color-ark))]"
                    : ""
                } ${kan ? "cursor-pointer" : ""}`}
              >
                {p.type === "pause" ? (
                  <span aria-hidden className="planpause" />
                ) : (
                  <span
                    role="checkbox"
                    aria-checked={l.ferdig}
                    aria-label={p.tekst}
                    className={`inline-grid h-[15px] w-[15px] place-items-center rounded-[4px] ${
                      !l.ferdig
                        ? "bg-ark shadow-[inset_0_0_0_1.5px_var(--color-linje-sterk)]"
                        : l.auto
                          ? "bg-[color-mix(in_srgb,var(--color-aksent)_45%,var(--color-ark))]"
                          : "bg-aksent"
                    }`}
                  >
                    {l.ferdig && (
                      <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden>
                        <path
                          d="M1.8 5.2l2.2 2.2L8.4 2.8"
                          stroke="var(--color-ark)"
                          strokeWidth="2"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                )}
                <span className="min-w-0">
                  <span
                    className={`block truncate ${
                      erAktiv ? "font-semibold text-blekk" : ""
                    } ${
                      l.ferdig || p.type === "pause" || !rekker
                        ? "text-blekk-svak"
                        : erAktiv
                          ? ""
                          : "text-blekk"
                    }`}
                  >
                    {p.tekst}
                  </span>
                  {erAktiv && (
                    <span className="mt-1 block h-[3px] overflow-hidden rounded-sm bg-valgt">
                      <span
                        className="block h-full bg-aksent"
                        style={{ ...INGEN, width: `${fram}%` }}
                      />
                    </span>
                  )}
                </span>
                <span>
                  {erAktiv && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        endre(i, { forlenget: p.forlenget + 5 });
                      }}
                      title="Trenger mer tid"
                      className="h-[22px] whitespace-nowrap rounded-full bg-ark px-2 text-[calc(11.5px*var(--tekst-skala))] text-aksent shadow-[inset_0_0_0_1px_var(--color-linje)] hover:bg-flate"
                    >
                      +5 min
                    </button>
                  )}
                </span>
                <span
                  className={`whitespace-nowrap text-[calc(12px*var(--tekst-skala))] tabular-nums ${
                    erAktiv ? "text-blekk" : "text-blekk-svak"
                  }`}
                >
                  {livetid(p, l, i === aktiv, inn, start, lengde)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Stripa under arkhodet mens økta går (30.4, lerretet Oktkort): «Nå» og
 * aktiviteten til venstre, bolkene med nålen i midten, og «9 av 30 min ·
 * i rute» til høyre. Oppdateres én gang i minuttet, uten overgang.
 */
export function Tidsstripe({ okt, na }: { okt: Okt; na: Date }) {
  const inn = minutterInn(okt, na);
  const start = okt.klokkeslett;
  const { punkter } = lesPlan(okt.plan);
  if (inn === null || !start || punkter.length === 0) return null;
  const lengde = okt.varighetMin;
  const { liste, aktiv } = livePlan(punkter, start, inn);
  const t = livetekst(punkter, start, lengde, inn);
  const slutt = liste[liste.length - 1].e;
  const skala = Math.max(lengde, slutt, 1);
  const pst = (m: number) => (Math.max(0, Math.min(skala, m)) / skala) * 100;
  const kl = (m: number) => klokke(tilMinutter(start) + m);
  const visNa = inn >= 0 && inn < lengde;
  const status =
    t.etikett !== "Nå" || aktiv < 0
      ? t.under
      : t.etter > 0
        ? `${t.etter} min etter planen`
        : "i rute";

  return (
    <div
      style={INGEN}
      className="flex shrink-0 items-center gap-[18px] border-b border-linje-medium px-[28px] py-2.5"
    >
      <div className="w-[170px] min-w-0 shrink-0">
        <p className="text-[calc(12px*var(--tekst-skala))] text-blekk-svak">
          {t.etikett}
        </p>
        <p className="truncate text-[calc(13.5px*var(--tekst-skala))] font-semibold">
          {t.tittel}
        </p>
      </div>
      <div className="relative h-[30px] min-w-0 flex-1">
        {liste.map((l, i) => {
          const p = punkter[i];
          const erAktiv = i === aktiv && p.type === "aktivitet";
          return (
            <span
              key={i}
              title={`${p.tekst} · ${kl(l.s)}–${kl(l.e)}`}
              className="absolute top-1.5 h-3 rounded-[4px]"
              style={{
                left: `${pst(l.s)}%`,
                width: `calc(${pst(l.e) - pst(l.s)}% - 3px)`,
                background:
                  p.type === "pause"
                    ? "repeating-linear-gradient(135deg, var(--color-valgt) 0 4px, var(--color-ark) 4px 8px)"
                    : erAktiv
                      ? "var(--color-ark)"
                      : l.ferdig
                        ? "color-mix(in srgb, var(--color-aksent) 42%, var(--color-ark))"
                        : "color-mix(in srgb, var(--color-aksent) 15%, var(--color-ark))",
                boxShadow: erAktiv
                  ? "inset 0 0 0 1.5px var(--color-aksent)"
                  : undefined,
                opacity: l.e > lengde && !l.ferdig ? 0.55 : 1,
              }}
            />
          );
        })}
        {visNa && (
          <span
            aria-hidden
            className="absolute top-0 h-[22px] w-0.5 rounded-[1px] bg-aksent before:absolute before:-left-[3px] before:-top-[3px] before:h-2 before:w-2 before:rounded-full before:bg-aksent"
            style={{ left: `${pst(inn)}%` }}
          />
        )}
        <span className="absolute left-0 top-5 text-[calc(10.5px*var(--tekst-skala))] tabular-nums text-blekk-svak">
          {kl(0)}
        </span>
        {visNa && (
          <span
            className="absolute top-5 -translate-x-1/2 text-[calc(10.5px*var(--tekst-skala))] font-semibold tabular-nums text-aksent"
            style={{ left: `${pst(inn)}%` }}
          >
            {kl(inn)}
          </span>
        )}
        <span
          className="absolute top-5 -translate-x-full text-[calc(10.5px*var(--tekst-skala))] tabular-nums text-blekk-svak"
          style={{ left: `${pst(lengde)}%` }}
        >
          {kl(lengde)}
        </span>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[calc(14px*var(--tekst-skala))] font-semibold tabular-nums">
          {t.hoyre}
        </p>
        <p className="text-[calc(12px*var(--tekst-skala))] text-blekk-svak">
          {status}
        </p>
      </div>
    </div>
  );
}
