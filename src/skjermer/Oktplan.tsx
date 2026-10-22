import { Notat } from "../ui/Notat";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Okt } from "../data/okter";
import {
  LENGDER,
  STEG,
  dragEnde,
  flyttTid,
  klokke,
  lengste,
  lesPlan,
  begrens,
  lesTittel,
  minutter,
  nyttPunkt,
  skiller,
  skrivPlan,
  startTider,
  sumTekst,
  tilMinutter,
  PLANVISNING,
  lesPlanvisning,
  type Planpunkt,
  type Planvisning,
} from "../data/oktplan";
import { hentInnstilling } from "../data/skolear";
import { nyPlass, useDra } from "../ui/dra";

/**
 * Planen i øktas planlegging (ARBEIDSLISTE 15.2–15.3, lerretet OktPlanNy).
 *
 * Øverst en tidslinje over hele økta, der hver aktivitet er et felt med
 * bredde etter minuttene. Der drar man i skillet for å flytte tid mellom to
 * bolker, i enden av den siste for å gi eller fylle luft, og i feltene for
 * å bytte rekkefølge. Under står lista: starttid, tittel, minutter med
 * − / +, og en beskrivelse som foldes ut.
 *
 * Øktas lengde endres aldri herfra. Går planen over, sies det uten rødt,
 * med et tilbud om å korte ned den lengste aktiviteten.
 *
 * Planen er lærerens egen og går aldri ut av appen.
 */

type Rad = Planpunkt & { id: string };

const ny = (d: Partial<Planpunkt> = {}): Rad => ({
  ...nyttPunkt(d),
  id: crypto.randomUUID(),
});
const beholdes = (p: Planpunkt) => p.type === "pause" || p.tekst.trim() !== "";

export function Oktplan({
  okt,
  enkel = false,
  onLagre,
}: {
  okt: Okt;
  /** Øktplan: Enkel (15.10): en liste med minutter, uten tidslinje å dra i */
  enkel?: boolean;
  onLagre: (plan: string | null) => Promise<void>;
}) {
  const [rader, setRader] = useState<Rad[]>([]);
  const [rest, setRest] = useState<string[]>([]);
  // Valgt rad, rad med beskrivelsen åpen, rad med lengdevalget åpent, og
  // raden der tittelen skrives.
  const [valgt, setValgt] = useState<string | null>(null);
  const [apen, setApen] = useState<string | null>(null);
  const [velgMin, setVelgMin] = useState<string | null>(null);
  const [skriver, setSkriver] = useState<string | null>(null);

  // Leses på nytt bare når planen er endret et annet sted enn her. Ellers
  // ville hver lagring gitt radene nye nøkler, og feltene mistet fokus.
  const sist = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (okt.plan === sist.current) return;
    sist.current = okt.plan;
    const l = lesPlan(okt.plan);
    setRader(l.punkter.map((p) => ({ ...p, id: crypto.randomUUID() })));
    setRest(l.rest);
  }, [okt.plan]);

  const ferske = useRef(rader);
  ferske.current = rader;

  function lagre(nye_: Rad[]) {
    // Øktas lengde er et tak: det som vokser, tar fra den lengste andre.
    const nye = begrens(ferske.current, nye_, okt.varighetMin);
    setRader(nye);
    const tekst = skrivPlan(nye.filter(beholdes), rest);
    sist.current = tekst;
    void onLagre(tekst);
  }

  const endre = (id: string, d: Partial<Planpunkt>) =>
    lagre(rader.map((r) => (r.id === id ? { ...r, ...d } : r)));

  function flytt(fra: number, til: number) {
    if (til < 0 || til >= rader.length || til === fra) return;
    const l = [...rader];
    const [x] = l.splice(fra, 1);
    l.splice(til, 0, x);
    setValgt(x.id);
    lagre(l);
  }

  function leggTil(etter: number | null, d: Partial<Planpunkt> = {}) {
    const r = ny({ min: 10, ...d });
    const l = [...rader];
    l.splice(etter === null ? l.length : etter + 1, 0, r);
    setValgt(r.id);
    if (r.type === "aktivitet") {
      setRader(l);
      setSkriver(r.id);
    } else lagre(l);
  }

  function slett(id: string) {
    const i = rader.findIndex((r) => r.id === id);
    lagre(rader.filter((r) => r.id !== id));
    return i;
  }

  const lengde = okt.varighetMin;
  const sum = minutter(rader);
  const diff = sum - lengde;
  const start = okt.klokkeslett;
  const tider = startTider(rader, start);
  const lang = lengste(rader);
  const slutt = start ? klokke(tilMinutter(start) + lengde) : null;

  if (enkel)
    return (
      <EnkelPlan
        rader={rader}
        lengde={lengde}
        lagre={lagre}
        flytt={flytt}
        slett={slett}
      />
    );

  return (
    <section className="mt-6">
      <div className="mb-2.5 flex items-baseline gap-2.5">
        <h2 className="text-[calc(15px*var(--tekst-skala))] font-semibold">
          Plan
        </h2>
        <span className="text-[calc(12px*var(--tekst-skala))] text-blekk-svak">
          bare for deg
        </span>
        <span
          className={`ml-auto text-[calc(13px*var(--tekst-skala))] tabular-nums ${
            diff > 0 ? "text-blekk" : "text-blekk-dempet"
          }`}
        >
          {sumTekst(rader, lengde)}
        </span>
      </div>

      <Tidslinje
        rader={rader}
        lengde={lengde}
        start={start}
        valgt={valgt}
        onVelg={(r) => {
          setValgt(r.id);
          setVelgMin(r.type === "pause" ? r.id : null);
          setApen(r.beskrivelse ? r.id : null);
        }}
        onFlytt={flytt}
        onEndreLive={setRader}
        begrens={(base, nye) => begrens(base, nye, lengde)}
        onEndret={lagre}
        hent={() => ferske.current}
      />

      {diff > 0 && (
        <div className="mt-1.5 flex items-center gap-2.5 rounded-[10px] bg-flate-svak px-3 py-2 text-[calc(13px*var(--tekst-skala))]">
          <span>
            Planen er {diff} min for lang.{" "}
            {slutt ? `Økta slutter ${slutt}` : `Økta er ${lengde} min`}, så det
            siste rekker ikke.
          </span>
          {lang >= 0 && (rader[lang].min ?? 0) - diff >= STEG && (
            <button
              onClick={() =>
                endre(rader[lang].id, { min: (rader[lang].min ?? 0) - diff })
              }
              className="ml-auto h-[26px] shrink-0 rounded-full border border-linje bg-ark px-3 text-[calc(12.5px*var(--tekst-skala))] hover:bg-flate"
            >
              Trekk {diff} min fra «{rader[lang].tekst}»
            </button>
          )}
        </div>
      )}

      <Liste
        rader={rader}
        tider={tider}
        lengde={lengde}
        valgt={valgt}
        apen={apen}
        velgMin={velgMin}
        skriver={skriver}
        setValgt={setValgt}
        setApen={setApen}
        setVelgMin={setVelgMin}
        setSkriver={setSkriver}
        endre={endre}
        flytt={flytt}
        slett={slett}
        lagre={lagre}
      />

      <div className="mt-2 flex items-center gap-2 pl-[80px]">
        <button
          onClick={() => leggTil(null)}
          className="h-7 shrink-0 whitespace-nowrap rounded-full border border-linje bg-ark px-3 text-[calc(12.5px*var(--tekst-skala))] hover:bg-flate"
        >
          + Aktivitet
        </button>
        <button
          onClick={() => leggTil(null, { type: "pause", tekst: "Pause" })}
          className="h-7 shrink-0 whitespace-nowrap rounded-full px-3 text-[calc(12.5px*var(--tekst-skala))] text-blekk-dempet hover:bg-flate hover:text-blekk"
        >
          + Pause
        </button>
        <span className="ml-auto max-w-[440px] text-right text-[calc(12px*var(--tekst-skala))] text-blekk-svak">
          {rader.length === 0
            ? "Ingen plan ennå. Legg til det du skal gjennom, med minutter."
            : "Dra en bolk for å flytte den. Dra i skillet for å flytte tid, eller i enden for å korte ned den siste. Pauser står fast til du klikker på dem."}
        </span>
      </div>
    </section>
  );
}

// --------------------------------------------------------------- tidslinjen

function Tidslinje({
  rader,
  lengde,
  start,
  valgt,
  onVelg,
  onFlytt,
  onEndreLive,
  onEndret,
  hent,
  begrens,
}: {
  rader: Rad[];
  lengde: number;
  start: string | null;
  valgt: string | null;
  onVelg: (r: Rad) => void;
  onFlytt: (fra: number, til: number) => void;
  /** mens det dras i et skille: tegnes, men lagres ikke ennå */
  onEndreLive: (r: Rad[]) => void;
  onEndret: (r: Rad[]) => void;
  hent: () => Rad[];
  /** øktas lengde som tak, regnet fra der draget begynte */
  begrens: (base: Rad[], nye: Rad[]) => Rad[];
}) {
  const linje = useRef<HTMLDivElement>(null);
  const [skilleDras, setSkilleDras] = useState<number | null>(null);
  const sum = minutter(rader);
  // Går planen over, blir skalaen lengre, og sluttstreken står inne i den.
  const skala = Math.max(lengde, sum, 1);
  const pst = (m: number) => `${(m / skala) * 100}%`;
  const valgtNr = rader.findIndex((r) => r.id === valgt);

  // Stokk om: samme dra og slipp som samtaletimeplanen, sideveis.
  const { begynn, reg, stil, erDratt, draget } = useDra({
    akse: "x",
    nokkel: (p) => (rader[p.nr] ? `tl-${rader[p.nr].id}` : undefined),
    onSlipp: (fra, mal) => onFlytt(fra.nr, nyPlass(fra, mal).nr),
  });

  /** Dra i et skille eller i enden: minuttene følger pekeren i steg på fem. */
  function dragSkille(
    e: React.PointerEvent,
    nr: number,
    regn: (base: Rad[], dMin: number) => Planpunkt[],
  ) {
    if (e.button !== 0 || !linje.current) return;
    e.preventDefault();
    e.stopPropagation();
    const base = hent();
    const perMin = linje.current.getBoundingClientRect().width / skala;
    const x0 = e.clientX;
    let siste = base;
    setSkilleDras(nr);
    document.documentElement.dataset.drar = "";
    const flytt = (ev: PointerEvent) => {
      siste = begrens(base, regn(base, (ev.clientX - x0) / perMin) as Rad[]);
      onEndreLive(siste);
    };
    const slipp = () => {
      window.removeEventListener("pointermove", flytt);
      window.removeEventListener("pointerup", slipp);
      window.removeEventListener("pointercancel", slipp);
      delete document.documentElement.dataset.drar;
      setSkilleDras(null);
      if (siste !== base) onEndret(siste);
    };
    window.addEventListener("pointermove", flytt);
    window.addEventListener("pointerup", slipp);
    window.addEventListener("pointercancel", slipp);
  }

  let pos = 0;
  const felt = rader.map((r, i) => {
    const fra = pos;
    pos += r.min ?? 0;
    return { r, i, fra, min: r.min ?? 0 };
  });

  const merker: number[] = [];
  for (let m = 0; m <= skala; m += 15) merker.push(m);

  return (
    <div>
      <div ref={linje} className="tidslinje">
        {felt.map(({ r, i, fra, min }) => (
          <div
            key={r.id}
            ref={reg({ gruppe: 0, nr: i })}
            data-dra-innhold={`tl-${r.id}`}
            onPointerDown={(e) => begynn(e, { gruppe: 0, nr: i })}
            onClick={() => !draget.current && onVelg(r)}
            title={`${r.tekst} · ${min} min`}
            className={`tl-felt ${r.type === "pause" ? "pause" : ""} ${
              erDratt({ gruppe: 0, nr: i })
                ? "loftet"
                : r.id === valgt
                  ? "valgt"
                  : ""
            } ${fra >= lengde ? "ute" : ""}`}
            style={{
              left: `calc(${pst(fra)} + 1px)`,
              width: `calc(${pst(min)} - 2px)`,
              ...stil({ gruppe: 0, nr: i }),
            }}
          >
            <div className="truncate text-[calc(12.5px*var(--tekst-skala))] font-medium">
              {r.tekst || "Uten tittel"}
            </div>
            <div className="mt-0.5 whitespace-nowrap text-[calc(11.5px*var(--tekst-skala))] tabular-nums text-blekk-dempet">
              {min} min
            </div>
          </div>
        ))}

        {/* Luft: det som er igjen av økta når planen går under. */}
        {sum < lengde && rader.length > 0 && (
          <div
            className="tl-luft"
            style={{ left: `calc(${pst(sum)} + 1px)`, right: 0 }}
          >
            Luft · {lengde - sum} min
          </div>
        )}
        {rader.length === 0 && (
          <div className="tl-luft" style={{ left: 0, right: 0 }}>
            {lengde} min
          </div>
        )}

        {/* Skillene: flytter tid mellom bolkene. Pauser står fast. */}
        {skiller(rader, valgtNr >= 0 ? valgtNr : null).map((s) => {
          const ved = felt[s.etter].fra + felt[s.etter].min;
          return (
            <div
              key={`s${s.etter}`}
              className={`tl-skille ${skilleDras === s.etter ? "dras" : ""}`}
              style={{ left: pst(ved) }}
              title="Dra for å flytte tid mellom bolkene"
              onPointerDown={(e) =>
                dragSkille(e, s.etter, (base, d) =>
                  flyttTid(base, s.fra, s.til, d),
                )
              }
            >
              <i />
            </div>
          );
        })}
        {/* Enden av siste bolk: til venstre gir luft, til høyre fyller den. */}
        {rader.length > 0 && (
          <div
            className={`tl-skille ${skilleDras === -1 ? "dras" : ""}`}
            style={{ left: pst(sum) }}
            title="Dra for å gi eller fylle luft"
            onPointerDown={(e) =>
              dragSkille(e, -1, (base, d) =>
                dragEnde(base, lengde, base[base.length - 1].min ?? STEG, d),
              )
            }
          >
            <i />
          </div>
        )}

        {/* Øktas slutt. */}
        <div className="tl-slutt" style={{ left: pst(lengde) }} />
      </div>

      <div className="relative mt-1 h-[18px] text-[calc(11px*var(--tekst-skala))] tabular-nums text-blekk-svak">
        {merker.map((m) => (
          <span
            key={m}
            className="absolute whitespace-nowrap"
            style={{
              left: pst(m),
              transform: m === 0 ? undefined : "translateX(-50%)",
            }}
          >
            {start ? klokke(tilMinutter(start) + m) : `${m} min`}
          </span>
        ))}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------- lista

function Liste({
  rader,
  tider,
  lengde,
  valgt,
  apen,
  velgMin,
  skriver,
  setValgt,
  setApen,
  setVelgMin,
  setSkriver,
  endre,
  flytt,
  slett,
  lagre,
}: {
  rader: Rad[];
  tider: (string | null)[];
  lengde: number;
  valgt: string | null;
  apen: string | null;
  velgMin: string | null;
  skriver: string | null;
  setValgt: (id: string | null) => void;
  setApen: (id: string | null) => void;
  setVelgMin: (id: string | null) => void;
  setSkriver: (id: string | null) => void;
  endre: (id: string, d: Partial<Planpunkt>) => void;
  flytt: (fra: number, til: number) => void;
  slett: (id: string) => number;
  lagre: (r: Rad[]) => void;
}) {
  const sum = minutter(rader);
  // Samme dra og slipp som samtaletimeplanen, i ⋮⋮.
  const { begynn, reg, stil, erDratt, dra } = useDra({
    nokkel: (p) => (rader[p.nr] ? `ls-${rader[p.nr].id}` : undefined),
    onSlipp: (fra, mal) => flytt(fra.nr, nyPlass(fra, mal).nr),
  });

  const sett5 = (r: Rad, min: number) =>
    endre(r.id, { min: Math.max(STEG, Math.min(240, min)) });

  /** ⌥↑↓ flytter raden, også mens tittelen skrives. */
  function tast(e: React.KeyboardEvent, i: number) {
    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      flytt(i, i + (e.key === "ArrowUp" ? -1 : 1));
    }
  }

  return (
    <div className="mt-2 flex flex-col">
      {rader.map((r, i) => {
        const p = { gruppe: 0, nr: i };
        const pause = r.type === "pause";
        const forsteLinje = r.beskrivelse.split("\n")[0];
        const restAv = lengde - (sum - (r.min ?? 0));
        return (
          <div key={r.id} ref={reg(p)}>
            <div
              data-dra-innhold={`ls-${r.id}`}
              style={stil(p)}
              tabIndex={-1}
              onKeyDown={(e) => tast(e, i)}
              onClick={() => {
                setValgt(r.id);
                setApen(apen === r.id ? null : r.id);
              }}
              className={`planrad group ${
                erDratt(p) ? "loftet" : r.id === valgt && !dra ? "valgt" : ""
              }`}
            >
              <span
                onPointerDown={(e) => begynn(e, p)}
                onClick={(e) => e.stopPropagation()}
                title="Dra for å flytte"
                className="cursor-grab touch-none select-none px-0.5 py-1.5 text-[13px] tracking-[-1px] text-blekk-svakest"
              >
                ⋮⋮
              </span>
              <span className="text-[calc(12.5px*var(--tekst-skala))] tabular-nums text-blekk-svak">
                {tider[i] ?? ""}
              </span>
              <span className="flex min-w-0 items-center gap-2">
                {pause && <span aria-hidden className="planpause" />}
                {skriver === r.id ? (
                  <Tittelfelt
                    rad={r}
                    onFerdig={(tekst, neste) => {
                      setSkriver(null);
                      const t = lesTittel(tekst);
                      const her = { ...r, tekst: t.tekst, min: t.min ?? r.min };
                      // En tom aktivitet forsvinner når man går ut av den.
                      if (!beholdes(her)) {
                        lagre(rader.filter((x) => x.id !== r.id));
                        return;
                      }
                      const nye = rader.map((x) => (x.id === r.id ? her : x));
                      if (neste) {
                        // ↵: en ny aktivitet rett under, klar til å skrives.
                        const n = ny({ min: 10 });
                        nye.splice(i + 1, 0, n);
                        setValgt(n.id);
                        setSkriver(n.id);
                      }
                      lagre(nye);
                    }}
                    onSlett={() => {
                      const k = slett(r.id);
                      setSkriver(rader[k - 1]?.id ?? null);
                    }}
                    onTast={(e) => tast(e, i)}
                  />
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setValgt(r.id);
                      setSkriver(r.id);
                    }}
                    className={`truncate text-left text-[calc(14px*var(--tekst-skala))] ${
                      pause ? "text-blekk-dempet" : "font-medium text-blekk"
                    }`}
                  >
                    {r.tekst || (
                      <span className="font-normal text-blekk-svak">
                        Hva skal skje
                      </span>
                    )}
                  </button>
                )}
                {forsteLinje && apen !== r.id && skriver !== r.id && (
                  <span className="min-w-0 flex-1 truncate text-[calc(12.5px*var(--tekst-skala))] text-blekk-svak">
                    {forsteLinje}
                  </span>
                )}
              </span>
              <span
                className="flex items-center gap-0.5 justify-self-end"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => sett5(r, (r.min ?? 0) - STEG)}
                  title="5 min mindre"
                  className="planknapp"
                >
                  −
                </button>
                <button
                  onClick={() => {
                    setValgt(r.id);
                    setVelgMin(velgMin === r.id ? null : r.id);
                  }}
                  title="Velg lengde"
                  className="w-14 whitespace-nowrap rounded-[6px] text-center text-[calc(13px*var(--tekst-skala))] leading-6 tabular-nums hover:bg-flate"
                >
                  {r.min ?? "–"} min
                </button>
                <button
                  onClick={() => sett5(r, (r.min ?? 0) + STEG)}
                  title="5 min mer"
                  className="planknapp"
                >
                  +
                </button>
              </span>
              <span
                aria-hidden
                className="inline-block text-[12px] text-blekk-svak transition-transform duration-200"
                style={{ transform: apen === r.id ? "rotate(90deg)" : "" }}
              >
                ▸
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  slett(r.id);
                }}
                title={pause ? "Fjern pausen" : "Fjern aktiviteten"}
                className="invisible text-blekk-svak hover:text-blekk group-hover:visible"
              >
                ×
              </button>
            </div>

            {velgMin === r.id && (
              <div className="planvalg">
                <span className="mr-1 text-[calc(12px*var(--tekst-skala))] text-blekk-dempet">
                  Lengde
                </span>
                {LENGDER.map((n) => (
                  <button
                    key={n}
                    onClick={() => {
                      sett5(r, n);
                      setVelgMin(null);
                    }}
                    className={`planvalg-knapp ${r.min === n ? "pa" : ""}`}
                  >
                    {n} min
                  </button>
                ))}
                {restAv > 0 && restAv !== r.min && (
                  <button
                    onClick={() => {
                      sett5(r, restAv);
                      setVelgMin(null);
                    }}
                    className="planvalg-knapp rest"
                  >
                    Resten av økta · {restAv} min
                  </button>
                )}
              </div>
            )}

            {apen === r.id && (
              <Beskrivelse
                verdi={r.beskrivelse}
                onLagre={(b) =>
                  b !== r.beskrivelse && endre(r.id, { beskrivelse: b })
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Tittelfelt({
  rad,
  onFerdig,
  onSlett,
  onTast,
}: {
  rad: Rad;
  /** neste: ↵ ble trykket, og en ny aktivitet skal lages under */
  onFerdig: (tekst: string, neste: boolean) => void;
  onSlett: () => void;
  onTast: (e: React.KeyboardEvent) => void;
}) {
  const felt = useRef<HTMLInputElement>(null);
  const ferdig = useRef(false);
  useLayoutEffect(() => {
    felt.current?.focus();
    felt.current?.select();
  }, []);
  const avslutt = (neste: boolean) => {
    if (ferdig.current) return;
    ferdig.current = true;
    onFerdig(felt.current?.value ?? "", neste);
  };
  return (
    <input
      ref={felt}
      defaultValue={rad.tekst}
      placeholder="Hva skal skje · 10 min"
      onClick={(e) => e.stopPropagation()}
      onBlur={() => avslutt(false)}
      onKeyDown={(e) => {
        onTast(e);
        if (e.defaultPrevented) return;
        if (e.key === "Enter") {
          e.preventDefault();
          avslutt(true);
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          avslutt(false);
        } else if (e.key === "Backspace" && e.currentTarget.value === "") {
          e.preventDefault();
          ferdig.current = true;
          onSlett();
        }
      }}
      className={`min-w-0 flex-1 bg-transparent text-[calc(14px*var(--tekst-skala))] outline-none placeholder:font-normal placeholder:text-blekk-svak ${
        rad.type === "pause" ? "text-blekk-dempet" : "font-medium"
      }`}
    />
  );
}

/** Beskrivelsen under en rad: valgfri, og lukket til den trengs. */
function Beskrivelse({
  verdi,
  onLagre,
}: {
  verdi: string;
  onLagre: (v: string) => void;
}) {
  return (
    <div className="planbesk">
      <Notat
        verdi={verdi}
        autoFocus={!verdi}
        minHoyde={0}
        plassholder="Hva skal skje, hva elevene gjør, hva som må være klart"
        onForlat={(t) => onLagre(t.replace(/\s+$/, ""))}
      />
      <div className="mt-1.5 text-[calc(11.5px*var(--tekst-skala))] text-blekk-svak">
        Beskrivelse · bare for deg · går aldri ut av appen
      </div>
    </div>
  );
}

// -------------------------------------------------------------------- enkel

/**
 * Øktplan: Enkel (15.10, lerretet OktPlanEnkel). En ren liste med minutter
 * og en tynn stolpe uten tekst. Det man skriver, kan ha minuttene med:
 * «Film · 15 min». Ingen dra, ingen egen pausetype, og beskrivelsene fra
 * Full vises ikke, men blir liggende.
 */
function EnkelPlan({
  rader,
  lengde,
  lagre,
  flytt,
  slett,
}: {
  rader: Rad[];
  lengde: number;
  lagre: (r: Rad[]) => void;
  flytt: (fra: number, til: number) => void;
  slett: (id: string) => number;
}) {
  const [skriver, setSkriver] = useState<string | null>(null);
  const nyLinje = useRef<HTMLInputElement>(null);
  const sum = minutter(rader);
  const diff = sum - lengde;
  const skala = Math.max(lengde, sum, 1);
  const pst = (m: number) => `${(m / skala) * 100}%`;
  let pos = 0;

  /** Teksten i en rad slik den skrives: tittel, og minuttene bak. */
  const somTekst = (r: Rad) => (r.min ? `${r.tekst} · ${r.min} min` : r.tekst);

  function ferdig(r: Rad, i: number, tekst: string, neste: boolean) {
    setSkriver(null);
    const t = lesTittel(tekst);
    const her = { ...r, tekst: t.tekst, min: t.min };
    if (!beholdes(her)) {
      lagre(rader.filter((x) => x.id !== r.id));
      return;
    }
    const nye = rader.map((x) => (x.id === r.id ? her : x));
    if (neste) {
      const n = ny();
      nye.splice(i + 1, 0, n);
      setSkriver(n.id);
    }
    lagre(nye);
  }

  return (
    <section className="mt-6">
      <div className="mb-2.5 flex items-baseline gap-2.5">
        <h2 className="text-[calc(15px*var(--tekst-skala))] font-semibold">
          Plan
        </h2>
        <span
          className={`ml-auto text-[calc(13px*var(--tekst-skala))] tabular-nums ${
            diff > 0 ? "text-blekk" : "text-blekk-dempet"
          }`}
        >
          {sum} av {lengde} min{diff > 0 && ` · ${diff} min for mye`}
        </span>
      </div>

      {/* Stolpen: 6 px, uten tekst. */}
      <div className="relative mb-3 h-1.5">
        {rader.map((r) => {
          const fra = pos;
          pos += r.min ?? 0;
          return (
            <span
              key={r.id}
              className="absolute inset-y-0 rounded-[3px]"
              style={{
                left: `calc(${pst(fra)} + 1px)`,
                width: `calc(${pst(r.min ?? 0)} - 2px)`,
                background:
                  r.type === "pause"
                    ? "var(--color-valgt)"
                    : "var(--color-linje-sterk)",
                opacity: fra >= lengde ? 0.5 : 1,
              }}
            />
          );
        })}
        {sum > lengde && (
          <span
            className="absolute -inset-y-1 border-l-[1.5px] border-blekk/45"
            style={{ left: pst(lengde) }}
          />
        )}
      </div>

      <div className="border-t border-linje-medium">
        {rader.map((r, i) => (
          <div
            key={r.id}
            className="grid min-h-[38px] grid-cols-[minmax(0,1fr)_70px] items-center border-b border-linje-svak px-2.5 text-[calc(14px*var(--tekst-skala))]"
          >
            {skriver === r.id ? (
              <Linjefelt
                start={somTekst(r)}
                onFerdig={(t, neste) => ferdig(r, i, t, neste)}
                onSlett={() => {
                  const k = slett(r.id);
                  setSkriver(rader[k - 1]?.id ?? null);
                }}
                onFlytt={(d) => flytt(i, i + d)}
              />
            ) : (
              <button
                onClick={() => setSkriver(r.id)}
                className={`truncate text-left ${
                  r.type === "pause" ? "text-blekk-dempet" : "text-blekk"
                }`}
              >
                {r.tekst}
              </button>
            )}
            <span className="text-right text-[calc(13px*var(--tekst-skala))] tabular-nums text-blekk-dempet">
              {r.min ? `${r.min} min` : ""}
            </span>
          </div>
        ))}
        <div className="grid min-h-[38px] grid-cols-[minmax(0,1fr)_70px] items-center px-2.5 text-[calc(14px*var(--tekst-skala))]">
          <input
            ref={nyLinje}
            placeholder="Skriv en ny linje, for eksempel «Film · 15 min»"
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              const t = lesTittel(e.currentTarget.value);
              if (!t.tekst) return;
              e.currentTarget.value = "";
              lagre([...rader, ny({ tekst: t.tekst, min: t.min })]);
            }}
            className="min-w-0 bg-transparent outline-none placeholder:text-blekk-svak"
          />
        </div>
      </div>
    </section>
  );
}

function Linjefelt({
  start,
  onFerdig,
  onSlett,
  onFlytt,
}: {
  start: string;
  onFerdig: (tekst: string, neste: boolean) => void;
  onSlett: () => void;
  onFlytt: (d: number) => void;
}) {
  const felt = useRef<HTMLInputElement>(null);
  const ferdig = useRef(false);
  useLayoutEffect(() => felt.current?.focus(), []);
  const avslutt = (neste: boolean) => {
    if (ferdig.current) return;
    ferdig.current = true;
    onFerdig(felt.current?.value ?? "", neste);
  };
  return (
    <input
      ref={felt}
      defaultValue={start}
      placeholder="Hva skal skje · 10 min"
      onBlur={() => avslutt(false)}
      onKeyDown={(e) => {
        if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
          e.preventDefault();
          onFlytt(e.key === "ArrowUp" ? -1 : 1);
        } else if (e.key === "Enter") {
          e.preventDefault();
          avslutt(true);
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          avslutt(false);
        } else if (e.key === "Backspace" && e.currentTarget.value === "") {
          e.preventDefault();
          ferdig.current = true;
          onSlett();
        }
      }}
      className="min-w-0 bg-transparent outline-none placeholder:text-blekk-svak"
    />
  );
}

/** Øktplan: Enkel eller Full, lest fra innstillingene. null mens den leses. */
export function usePlanvisning(): Planvisning | null {
  const [v, setV] = useState<Planvisning | null>(null);
  useEffect(() => {
    void hentInnstilling(PLANVISNING).then((x) => setV(lesPlanvisning(x)));
  }, []);
  return v;
}
