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
 * Planen mens økta pågår (ARBEIDSLISTE 15.6–15.7): med Øktplan: Full en
 * loddrett tidslinje i høyre kolonne (lerretet OktLiveVertikal, valgt i
 * stedet for den vannrette stripa), med Enkel én linje under arkhodet og
 * lista med avkrysning.
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
  loddrett = false,
  onLagre,
  onApnePlan,
}: {
  okt: Okt;
  na: Date;
  /**
   * Øktplan: Full, den dagen økta er: planen som en loddrett tidslinje med
   * nå-markøren (lerretet OktLiveVertikal, valgt 14.10 i stedet for stripa).
   */
  loddrett?: boolean;
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

  if (loddrett && start && inn !== null && punkter.length > 0)
    return (
      <Loddrett
        punkter={punkter}
        liste={liste}
        aktiv={aktiv}
        inn={inn}
        start={start}
        lengde={lengde}
        klikkbar={klikkbar}
        onKlikk={klikk}
        onPluss={(i) => endre(i, { forlenget: punkter[i].forlenget + 5 })}
      />
    );

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

/** Høyden på den loddrette tidslinjen, som i lerretet. */
const HOYDE = 480;

/**
 * Planen som loddrett tidslinje i høyre kolonne (lerretet OktLiveVertikal).
 * Klokkeslettene til venstre, ett felt per aktivitet med høyde etter
 * minuttene, en strek ved øktas slutt og nå-markøren tvers over. Den aktive
 * fylles ovenfra etter hvert som tida går, og har «+5 min» nederst.
 */
function Loddrett({
  punkter,
  liste,
  aktiv,
  inn,
  start,
  lengde,
  klikkbar,
  onKlikk,
  onPluss,
}: {
  punkter: Planpunkt[];
  liste: ReturnType<typeof livePlan>["liste"];
  aktiv: number;
  inn: number;
  start: string;
  lengde: number;
  klikkbar: (i: number) => boolean;
  onKlikk: (i: number) => void;
  onPluss: (i: number) => void;
}) {
  const t = livetekst(punkter, start, lengde, inn);
  const slutt = liste[liste.length - 1].e;
  const skala = Math.max(lengde, slutt, 1);
  const pst = (m: number) => `${(m / skala) * 100}%`;
  const kl = (m: number) => klokke(tilMinutter(start) + m);
  const visNa = inn >= 0 && inn < lengde;

  return (
    <div style={INGEN}>
      <div className="flex items-baseline gap-2">
        <p className="text-etikett font-semibold text-blekk">Plan</p>
        <span className="text-[calc(12px*var(--tekst-skala))] text-blekk-svak">
          krysses av når tida er ute
        </span>
      </div>
      <p className="mt-0.5 text-[calc(12px*var(--tekst-skala))] tabular-nums text-blekk-dempet">
        {t.etikett === "Nå" ? t.under : `${t.etikett} · ${t.tittel}`}
      </p>

      <div className="relative ml-11 mt-3.5" style={{ height: HOYDE }}>
        {liste.map((l, i) => {
          const p = punkter[i];
          const erAktiv = i === aktiv && p.type === "aktivitet";
          const ute = l.e > lengde && !l.ferdig;
          const fram = erAktiv
            ? Math.min(100, ((inn - l.s) / Math.max(1, l.e - l.s)) * 100)
            : 0;
          return (
            <div key={i}>
              <span
                className="absolute -left-11 -translate-y-px text-[calc(11px*var(--tekst-skala))] tabular-nums text-blekk-svak"
                style={{ top: pst(l.s) }}
              >
                {kl(l.s)}
              </span>
              <div
                onClick={() => onKlikk(i)}
                className={`absolute inset-x-0 overflow-hidden rounded-[8px] ${
                  klikkbar(i) ? "cursor-pointer" : ""
                }`}
                style={{
                  top: pst(l.s),
                  height: `calc(${pst(l.e - l.s)} - 3px)`,
                  background:
                    p.type === "pause"
                      ? "repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-flate-svak) 50%, var(--color-ark)) 0 5px, color-mix(in srgb, var(--color-aksent) 8%, var(--color-ark)) 5px 10px)"
                      : l.ferdig
                        ? "var(--color-flate-svak)"
                        : "var(--color-ark)",
                  boxShadow: erAktiv
                    ? "inset 0 0 0 1.5px var(--color-aksent)"
                    : ute
                      ? "inset 0 0 0 1px var(--color-linje-sterk)"
                      : "inset 0 0 0 1px var(--color-linje-medium)",
                  opacity: ute ? 0.6 : 1,
                }}
              >
                {erAktiv && (
                  <div
                    className="absolute inset-x-0 top-0 border-b-[1.5px] border-[color-mix(in_srgb,var(--color-aksent)_40%,var(--color-ark))] bg-[color-mix(in_srgb,var(--color-aksent)_9%,var(--color-ark))]"
                    style={{ height: `${fram}%` }}
                  />
                )}
                <div className="relative grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2 px-[9px] py-[5px] text-[calc(13px*var(--tekst-skala))]">
                  {p.type === "pause" ? (
                    <span />
                  ) : (
                    <Hake ferdig={l.ferdig} auto={l.auto} />
                  )}
                  <span
                    className={`truncate ${erAktiv ? "font-semibold text-blekk" : ""} ${
                      l.ferdig || p.type === "pause" || l.e > lengde
                        ? "text-blekk-svak"
                        : erAktiv
                          ? ""
                          : "text-blekk"
                    }`}
                  >
                    {p.tekst}
                  </span>
                  <span
                    className={`whitespace-nowrap text-[calc(12px*var(--tekst-skala))] tabular-nums ${
                      erAktiv ? "text-blekk" : "text-blekk-svak"
                    }`}
                  >
                    {livetid(p, l, i === aktiv, inn, start, lengde)}
                  </span>
                </div>
                {erAktiv && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPluss(i);
                    }}
                    title="Trenger mer tid"
                    className="absolute bottom-[7px] right-[9px] z-[2] h-[22px] whitespace-nowrap rounded-full bg-ark px-2 text-[calc(11.5px*var(--tekst-skala))] text-aksent shadow-[inset_0_0_0_1px_var(--color-linje)] hover:bg-flate"
                  >
                    +5 min
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Øktas slutt. */}
        <div
          className="absolute -left-11 right-0 border-t-[1.5px] border-blekk/45"
          style={{ top: pst(lengde) }}
        >
          <span className="absolute left-0 top-0.5 text-[calc(11px*var(--tekst-skala))] tabular-nums text-blekk-dempet">
            {kl(lengde)}
          </span>
        </div>

        {/* Nå-markøren, tvers over. */}
        {visNa && (
          <div
            className="absolute -left-12 -right-1.5 z-[3] h-0 border-t-2 border-aksent"
            style={{ top: pst(inn) }}
          >
            <span className="absolute -top-2.5 left-0 rounded-lg bg-aksent px-1.5 py-px text-[calc(11px*var(--tekst-skala))] font-medium tabular-nums text-ark">
              {kl(inn)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Avkrysningen: lysere hake når tida krysset av, mørk når du gjorde det. */
function Hake({ ferdig, auto }: { ferdig: boolean; auto: boolean }) {
  return (
    <span
      role="checkbox"
      aria-checked={ferdig}
      className={`inline-grid h-[15px] w-[15px] place-items-center rounded-[4px] ${
        !ferdig
          ? "bg-ark shadow-[inset_0_0_0_1.5px_var(--color-linje-sterk)]"
          : auto
            ? "bg-[color-mix(in_srgb,var(--color-aksent)_45%,var(--color-ark))]"
            : "bg-aksent"
      }`}
    >
      {ferdig && (
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
  );
}
