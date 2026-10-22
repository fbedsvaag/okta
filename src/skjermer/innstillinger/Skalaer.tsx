import { useEffect, useRef, useState } from "react";
import { hentSkalaer, hentVerdier, type Skala } from "../../skala";
import {
  bruktPerVerdi,
  bruktSkala,
  lagreSkala,
  malVerdier,
  rangFor,
  SkalaFeil,
  slettSkala,
  tilUtkast,
  type Redigerbar,
  type Skalautkast,
} from "../../data/skalaer";
import { Bryter, Knapp } from "../../ui/felles";
import { skalafarge } from "../../ui/farger";
import { visToast } from "../../ui/Toast";
import {
  endreRubrikkmal,
  hentRubrikkmaler,
  slettRubrikkmal,
  type Rubrikkmal,
} from "../../data/muntlig";

const FARGER: { f: Redigerbar["farge"]; navn: string }[] = [
  { f: null, navn: "Ingen farge" },
  { f: "rod", navn: "Rød" },
  { f: "gul", navn: "Gul" },
  { f: "gronn", navn: "Grønn" },
];

const BRUK: { id: Skala["bruksomrade"]; navn: string }[] = [
  { id: "vurdering", navn: "Vurdering" },
  { id: "skaring", navn: "Skåring" },
  { id: "begge", navn: "Begge" },
];

const tom = (): Redigerbar => ({
  id: null,
  kode: "",
  etikett: "",
  farge: null,
  bestatt: null,
  teller_ikke: 0,
});

/**
 * Skalaer (ARBEIDSLISTE §22, lerretet Skalaer): innebygde og egne skalaer,
 * maler for nye, redigering av verdiene med taster, farge, bestått og
 * «teller ikke», og en forhåndsvisning av hvordan det ser ut ved føring.
 */
export function Skalaer() {
  const [skalaer, setSkalaer] = useState<Skala[]>([]);
  const [antall, setAntall] = useState<Record<string, number>>({});
  const [valgt, setValgt] = useState<string | null>(null);
  const [utkast, setUtkast] = useState<Skalautkast | null>(null);
  const [endret, setEndret] = useState(false);
  const [brukt, setBrukt] = useState<Map<string, number>>(new Map());
  const [bruktI, setBruktI] = useState({
    vurderinger: 0,
    fag: 0,
    resultater: 0,
  });
  const [feil, setFeil] = useState<string | null>(null);
  const [nyApen, setNyApen] = useState(false);
  const [forh, setForh] = useState(-1);
  const [loft, setLoft] = useState(-1);

  async function lastListe(velg?: string) {
    const s = await hentSkalaer();
    const a: Record<string, number> = {};
    for (const x of s) a[x.id] = (await hentVerdier(x.id)).length;
    setSkalaer(s);
    setAntall(a);
    if (velg) void apne(velg, s);
    else if (!valgt && s[0]) void apne(s[0].id, s);
  }
  useEffect(() => {
    void lastListe();
  }, []);

  async function apne(id: string, liste = skalaer) {
    const s = liste.find((x) => x.id === id);
    if (!s) return;
    setValgt(id);
    setUtkast(tilUtkast(s, await hentVerdier(id)));
    setBrukt(await bruktPerVerdi(id));
    setBruktI(await bruktSkala(id));
    setEndret(false);
    setFeil(null);
    setForh(-1);
  }

  function ny(u: Skalautkast) {
    setValgt(null);
    setUtkast(u);
    setBrukt(new Map());
    setBruktI({ vurderinger: 0, fag: 0, resultater: 0 });
    setEndret(true);
    setFeil(null);
    setNyApen(false);
    window.setTimeout(
      () =>
        document.querySelector<HTMLInputElement>('[data-kode="0"]')?.focus(),
      60,
    );
  }

  const skala = skalaer.find((s) => s.id === valgt);
  const innebygd = !!skala?.innebygd;
  const egen = !innebygd;
  const sett = (fn: (u: Skalautkast) => Skalautkast) => {
    setUtkast((u) => (u ? fn(u) : u));
    setEndret(true);
    setFeil(null);
  };
  const settVerdi = (i: number, felt: Partial<Redigerbar>) =>
    sett((u) => ({
      ...u,
      verdier: u.verdier.map((v, j) => (j === i ? { ...v, ...felt } : v)),
    }));

  async function lagre() {
    if (!utkast) return;
    try {
      const id = await lagreSkala(utkast);
      visToast(`«${utkast.navn.trim()}» er lagret`);
      await lastListe(id);
    } catch (e) {
      setFeil(e instanceof SkalaFeil ? e.message : String(e));
    }
  }

  // Dra ⋮⋮ for rekkefølge: rad for rad, slik som i tegningen.
  function dra(e: React.PointerEvent, i: number) {
    if (!egen) return;
    e.preventDefault();
    let naa = i;
    const y0 = e.clientY;
    let flyttet = false;
    const flytt = (ev: PointerEvent) => {
      if (!flyttet && Math.abs(ev.clientY - y0) < 4) return;
      flyttet = true;
      setLoft(naa);
      let mal = -1;
      document.querySelectorAll<HTMLElement>("[data-vr]").forEach((n) => {
        const r = n.getBoundingClientRect();
        if (ev.clientY >= r.top && ev.clientY <= r.bottom)
          mal = Number(n.dataset.vr);
      });
      if (mal >= 0 && mal !== naa) {
        const fra = naa;
        sett((u) => {
          const v = [...u.verdier];
          const [x] = v.splice(fra, 1);
          v.splice(mal, 0, x);
          return { ...u, verdier: v };
        });
        naa = mal;
        setLoft(mal);
      }
    };
    const slipp = () => {
      window.removeEventListener("pointermove", flytt);
      window.removeEventListener("pointerup", slipp);
      setLoft(-1);
    };
    window.addEventListener("pointermove", flytt);
    window.addEventListener("pointerup", slipp);
  }

  const verdier = utkast?.verdier ?? [];
  const fylt = verdier.filter((v) => v.kode.trim());
  const rang = rangFor(verdier);
  const medTast = verdier.filter((_, i) => rang[i] !== 0).length <= 9;
  const tast = (i: number) => {
    if (!medTast || !verdier[i].kode.trim()) return "";
    if (rang[i] === 0) return "0";
    return String(
      verdier.slice(0, i + 1).filter((_, j) => rang[j] !== 0).length,
    );
  };
  const skalaBrukt = bruktI.vurderinger + bruktI.fag + bruktI.resultater > 0;

  const info = innebygd
    ? "Innebygde skalaer kan ikke endres, men du kan kopiere dem og gjøre kopien til din egen."
    : skalaBrukt
      ? `Brukt i ${bruktI.vurderinger} vurderinger${bruktI.fag ? ` og ${bruktI.fag} fag` : ""}. Du kan endre navn, forklaring, farge og rekkefølge. Verdier som er brukt, kan ikke slettes, og resultatene som er ført, beholder verdien sin.`
      : `Ikke brukt ennå. Velg den når du lager en vurdering, eller som skåringsskala for et fag. ${
          medTast
            ? "Med 9 verdier eller færre får hver verdi en tast."
            : "Over 9 verdier: når du fører, skriver du verdien (for eksempel 4+) og trykker Enter."
        }`;

  return (
    <div
      className="grid grid-cols-[220px_minmax(0,1fr)] gap-6"
      data-k="skalaer"
    >
      <div>
        <h1 className="text-[calc(28px*var(--tekst-skala))] font-light tracking-overskrift">
          Skalaer
        </h1>
        <p className="mb-1.5 mt-1 text-liten leading-normal text-blekk-dempet">
          Brukes når du fører vurderinger og skårer økter.
        </p>
        {[
          { navn: "Innebygde", liste: skalaer.filter((s) => s.innebygd) },
          { navn: "Dine", liste: skalaer.filter((s) => !s.innebygd) },
        ].map((g) => (
          <div key={g.navn}>
            <p className="mx-3 mb-1 mt-3.5 text-[11px] uppercase tracking-[0.06em] text-blekk-svak">
              {g.navn}
            </p>
            {g.liste.map((s) => (
              <button
                key={s.id}
                onClick={() => void apne(s.id)}
                aria-current={valgt === s.id ? "true" : undefined}
                className={`flex h-[38px] w-full items-center gap-2.5 rounded-[10px] px-3 text-left text-[calc(13.5px*var(--tekst-skala))] ${
                  valgt === s.id
                    ? "bg-ark font-medium shadow-[inset_0_0_0_1px_var(--color-linje),0_1px_3px_rgba(36,31,51,0.06)]"
                    : "hover:bg-flate-svak"
                }`}
              >
                <span className="min-w-0 truncate">{s.navn}</span>
                <small className="ml-auto shrink-0 text-etikett font-normal text-blekk-svak">
                  {antall[s.id] ?? 0} verdier
                </small>
              </button>
            ))}
          </div>
        ))}
        <button
          onClick={() => setNyApen(true)}
          className="flex h-[38px] w-full items-center rounded-[10px] px-3 text-left text-[calc(13.5px*var(--tekst-skala))] text-aksent hover:bg-flate-svak"
        >
          + Ny skala
        </button>
        <Rubrikkmaler />
      </div>

      {utkast && (
        <div className="flex min-w-0 flex-col gap-3.5">
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <input
              value={utkast.navn}
              readOnly={innebygd}
              onChange={(e) => sett((u) => ({ ...u, navn: e.target.value }))}
              placeholder="Navn på skalaen"
              aria-label="Navn på skalaen"
              className="min-w-0 flex-1 bg-transparent text-[calc(24px*var(--tekst-skala))] font-light tracking-[-0.01em] outline-none"
            />
            {innebygd ? (
              <>
                <span className="rounded-md bg-flate px-2 py-[3px] text-etikett text-blekk-dempet">
                  Innebygd · kan ikke endres
                </span>
                <Knapp
                  onClick={async () =>
                    skala &&
                    ny(tilUtkast(skala, await hentVerdier(skala.id), true))
                  }
                >
                  Kopier og endre
                </Knapp>
              </>
            ) : (
              <Bryter
                storrelse="liten"
                verdi={utkast.bruksomrade}
                settVerdi={(v) =>
                  sett((u) => ({
                    ...u,
                    bruksomrade: v as Skala["bruksomrade"],
                  }))
                }
                valg={BRUK.map((b) => ({ id: b.id, navn: b.navn }))}
              />
            )}
          </div>

          <div className="inn-grp py-1">
            <div className="skala-rad h-[34px] whitespace-normal border-b border-linje-medium text-[11px] uppercase leading-tight tracking-[0.05em] text-blekk-svak">
              <span />
              <span>Tast</span>
              <span>Verdi</span>
              <span>Forklaring</span>
              <span>Farge</span>
              <span>Bestått</span>
              <span title="Teller ikke i snitt og statistikk">Teller ikke</span>
              <span />
            </div>
            <div className="max-h-[440px] overflow-auto">
              {verdier.map((v, i) => {
                const n = v.id ? (brukt.get(v.id) ?? 0) : 0;
                const kanSlette = egen && n === 0 && verdier.length > 2;
                return (
                  <div
                    key={v.id ?? `ny-${i}`}
                    data-vr={i}
                    className={`skala-rad h-10 border-b border-linje-svak ${loft === i ? "loft" : ""}`}
                  >
                    <span
                      onPointerDown={(e) => dra(e, i)}
                      className={`touch-none select-none tracking-[-1px] text-blekk-svakest ${egen ? "cursor-grab" : ""}`}
                      title={egen ? "Dra for å flytte" : undefined}
                    >
                      {egen ? "⋮⋮" : ""}
                    </span>
                    <span>
                      <span className="skala-tast">{tast(i) || "–"}</span>
                    </span>
                    <input
                      data-kode={i}
                      value={v.kode}
                      readOnly={innebygd}
                      placeholder="Verdi"
                      onChange={(e) => settVerdi(i, { kode: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter" || innebygd) return;
                        e.preventDefault();
                        if (i === verdier.length - 1)
                          sett((u) => ({
                            ...u,
                            verdier: [...u.verdier, tom()],
                          }));
                        window.setTimeout(
                          () =>
                            document
                              .querySelector<HTMLInputElement>(
                                `[data-kode="${i + 1}"]`,
                              )
                              ?.focus(),
                          30,
                        );
                      }}
                      className="skala-felt font-semibold"
                    />
                    <input
                      value={v.etikett}
                      readOnly={innebygd}
                      placeholder="Forklaring som vises ved føring"
                      onChange={(e) =>
                        settVerdi(i, { etikett: e.target.value })
                      }
                      className="skala-felt"
                    />
                    <span className="flex gap-[5px]">
                      {FARGER.map((f) => (
                        <button
                          key={f.navn}
                          title={f.navn}
                          aria-label={f.navn}
                          aria-pressed={v.farge === f.f}
                          disabled={innebygd}
                          onClick={() => settVerdi(i, { farge: f.f })}
                          className={`skala-farge ${f.f ? "" : "ingen"}`}
                          style={{
                            background: f.f ? skalafarge(f.f) : undefined,
                          }}
                        />
                      ))}
                    </span>
                    <span>
                      <input
                        type="checkbox"
                        aria-label="Regnes som bestått"
                        title="Regnes som bestått"
                        checked={v.bestatt === 1}
                        disabled={innebygd}
                        onChange={(e) =>
                          settVerdi(i, { bestatt: e.target.checked ? 1 : 0 })
                        }
                        className="accent-[var(--color-aksent)]"
                      />
                    </span>
                    <span>
                      <input
                        type="checkbox"
                        aria-label="Teller ikke"
                        title="Holdes utenfor snitt og statistikk, f.eks. «Ikke levert»"
                        checked={v.teller_ikke === 1}
                        disabled={innebygd}
                        onChange={(e) =>
                          settVerdi(i, {
                            teller_ikke: e.target.checked ? 1 : 0,
                          })
                        }
                        className="accent-[var(--color-aksent)]"
                      />
                    </span>
                    <button
                      disabled={!kanSlette}
                      onClick={() =>
                        sett((u) => ({
                          ...u,
                          verdier: u.verdier.filter((_, j) => j !== i),
                        }))
                      }
                      title={
                        innebygd
                          ? "Innebygd"
                          : n > 0
                            ? `Brukt ${n} ${n === 1 ? "gang" : "ganger"}, kan ikke slettes`
                            : verdier.length <= 2
                              ? "En skala trenger minst to verdier"
                              : "Slett verdien"
                      }
                      className="text-center text-[15px] text-blekk-svakest enabled:hover:text-feil disabled:opacity-35"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
            {egen && (
              <div className="flex flex-wrap items-center gap-2.5 px-3.5 py-2.5">
                <Knapp
                  onClick={() => {
                    sett((u) => ({ ...u, verdier: [...u.verdier, tom()] }));
                    window.setTimeout(
                      () =>
                        document
                          .querySelector<HTMLInputElement>(
                            `[data-kode="${verdier.length}"]`,
                          )
                          ?.focus(),
                      30,
                    );
                  }}
                >
                  + Legg til verdi
                </Knapp>
                <span className="text-etikett text-blekk-svak">
                  ↵ i siste felt lager en ny · dra ⋮⋮ for rekkefølge, øverst er
                  lavest
                </span>
                <span className="grow" />
                {valgt && (
                  <button
                    disabled={skalaBrukt}
                    title={
                      skalaBrukt
                        ? "Skalaen er brukt og kan ikke slettes"
                        : "Slett skalaen"
                    }
                    onClick={async () => {
                      try {
                        await slettSkala(valgt);
                        setUtkast(null);
                        setValgt(null);
                        await lastListe();
                      } catch (e) {
                        setFeil(String(e instanceof Error ? e.message : e));
                      }
                    }}
                    className="text-liten text-blekk-svak enabled:hover:text-feil disabled:opacity-40"
                  >
                    Slett skalaen
                  </button>
                )}
                <Knapp
                  variant="primar"
                  disabled={!endret}
                  onClick={() => void lagre()}
                >
                  {valgt ? "Lagre endringer" : "Lag skalaen"}
                </Knapp>
              </div>
            )}
            {feil && (
              <p className="px-3.5 pb-2.5 text-liten text-feil">{feil}</p>
            )}
          </div>

          <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-4">
            <div className="inn-grp px-[18px] py-4">
              <div className="mb-2.5 text-etikett font-semibold">
                Slik ser det ut når du fører
              </div>
              <div className="mb-2.5 flex items-center gap-2.5 text-liten">
                <span className="h-[26px] w-[26px] rounded-full bg-valgt" />
                <b className="font-medium">Ada L.</b>
                <span className="text-blekk-svak">
                  ·{" "}
                  {medTast
                    ? "trykk en tast eller klikk"
                    : "skriv verdien eller klikk"}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {fylt.map((v) => {
                  const i = verdier.indexOf(v);
                  return (
                    <button
                      key={i}
                      onClick={() => setForh(i)}
                      title={v.etikett || undefined}
                      className={`skala-chip ${forh === i ? "valgt" : ""}`}
                      style={
                        v.farge && forh !== i
                          ? ({
                              "--c": skalafarge(v.farge),
                            } as React.CSSProperties)
                          : undefined
                      }
                      data-farge={v.farge ?? undefined}
                    >
                      {tast(i) && (
                        <span className="skala-tast liten">{tast(i)}</span>
                      )}
                      {v.kode}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2.5 min-h-4 text-etikett text-blekk-dempet">
                {forh >= 0 && verdier[forh]
                  ? `${verdier[forh].etikett || verdier[forh].kode}${
                      verdier[forh].teller_ikke
                        ? " · telles ikke i snittet"
                        : ""
                    }${
                      verdier[forh].bestatt === 1
                        ? " · bestått"
                        : verdier[forh].bestatt === 0
                          ? " · ikke bestått"
                          : ""
                    }`
                  : "Klikk en verdi for å se hvordan den registreres."}
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-[10px] bg-flate-svak px-3 py-2.5 text-[calc(12.5px*var(--tekst-skala))] leading-normal text-blekk-dempet">
              <span className="text-[15px]">ⓘ</span>
              <span>{info}</span>
            </div>
          </div>
        </div>
      )}

      {nyApen && (
        <NySkala
          skalaer={skalaer}
          onLukk={() => setNyApen(false)}
          onVelg={ny}
        />
      )}
    </div>
  );
}

/** «Ny skala»: velg et utgangspunkt (22.2). */
function NySkala({
  skalaer,
  onLukk,
  onVelg,
}: {
  skalaer: Skala[];
  onLukk: () => void;
  onVelg: (u: Skalautkast) => void;
}) {
  const [maks, setMaks] = useState("20");
  const [kopiAv, setKopiAv] = useState(skalaer[0]?.id ?? "");
  const boks = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const tast = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onLukk();
      }
    };
    window.addEventListener("keydown", tast, true);
    return () => window.removeEventListener("keydown", tast, true);
  }, [onLukk]);

  const utkast = (navn: string, verdier: Redigerbar[]): Skalautkast => ({
    id: null,
    navn,
    bruksomrade: "vurdering",
    verdier,
  });
  const MALER: { navn: string; under: React.ReactNode; velg: () => void }[] = [
    {
      navn: "Egen liste",
      under:
        "Skriv inn verdiene selv, for eksempel Ikke vist · Under utvikling · Godt",
      velg: () => onVelg(utkast("Ny skala", malVerdier("liste"))),
    },
    {
      navn: "Karakter med + og −",
      under: "1 til 6 med 2−, 2, 2+ … ferdig utfylt",
      velg: () => onVelg(utkast("Karakter med + og −", malVerdier("pm"))),
    },
    {
      navn: "Poeng",
      under: (
        <span className="flex items-center gap-1.5">
          Fra 0 til
          <input
            value={maks}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) =>
              setMaks(e.target.value.replace(/\D/g, "").slice(0, 3))
            }
            className="inn-felt h-6 w-12 text-right"
            aria-label="Maks poeng"
          />
        </span>
      ),
      velg: () => {
        const m = Math.max(1, Number(maks) || 20);
        onVelg(utkast(`Poeng 0–${m}`, malVerdier("poeng", m)));
      },
    },
    {
      navn: "Kopier en skala",
      under: (
        <select
          value={kopiAv}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setKopiAv(e.target.value)}
          className="inn-felt h-6"
          aria-label="Skala å kopiere"
        >
          {skalaer.map((s) => (
            <option key={s.id} value={s.id}>
              {s.navn}
            </option>
          ))}
        </select>
      ),
      velg: async () => {
        const s = skalaer.find((x) => x.id === kopiAv);
        if (s) onVelg(tilUtkast(s, await hentVerdier(s.id), true));
      },
    },
  ];
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-teppe/20"
      onClick={onLukk}
    >
      <div
        ref={boks}
        role="dialog"
        aria-label="Ny skala"
        onClick={(e) => e.stopPropagation()}
        className="glass-meny w-[560px] max-w-[calc(100vw-32px)] rounded-[22px] px-6 py-[22px]"
      >
        <div className="text-[calc(20px*var(--tekst-skala))] font-light">
          Ny skala
        </div>
        <p className="mb-3.5 mt-1 text-liten text-blekk-dempet">
          Velg et utgangspunkt. Du kan endre alt etterpå.
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          {MALER.map((m) => (
            <div
              key={m.navn}
              role="button"
              tabIndex={0}
              onClick={() => void m.velg()}
              onKeyDown={(e) => e.key === "Enter" && void m.velg()}
              className="flex cursor-pointer flex-col gap-1 rounded-[14px] bg-ark px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--color-linje-medium)] hover:shadow-[inset_0_0_0_1.5px_var(--color-aksent)]"
            >
              <b className="text-[calc(14px*var(--tekst-skala))] font-semibold">
                {m.navn}
              </b>
              <span className="text-[calc(12.5px*var(--tekst-skala))] leading-snug text-blekk-dempet">
                {m.under}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Knapp onClick={onLukk}>Avbryt</Knapp>
        </div>
      </div>
    </div>
  );
}

/**
 * Rubrikkene som er lagret som maler (28.3b), ved siden av skalaene. De
 * lages i en vurdering («Lagre som mal»); her kan de få nytt navn eller
 * slettes. En vurdering som har brukt en mal, har sin egen kopi.
 */
function Rubrikkmaler() {
  const [maler, setMaler] = useState<Rubrikkmal[]>([]);
  const last = () => void hentRubrikkmaler().then(setMaler);
  useEffect(last, []);
  return (
    <div data-k="rubrikker">
      <p className="mx-3 mb-1 mt-5 text-[11px] uppercase tracking-[0.06em] text-blekk-svak">
        Rubrikker
      </p>
      {maler.length === 0 && (
        <p className="mx-3 text-liten leading-normal text-blekk-svak">
          Ingen ennå. Lag en rubrikk i en vurdering og velg «Lagre som mal».
        </p>
      )}
      {maler.map((m) => (
        <div
          key={m.id}
          className="group flex h-[38px] items-center gap-1 rounded-[10px] px-3 hover:bg-flate-svak"
        >
          <input
            defaultValue={m.navn}
            aria-label="Navn på rubrikken"
            onBlur={async (e) => {
              const navn = e.target.value.trim();
              if (navn && navn !== m.navn) await endreRubrikkmal(m.id, navn);
              last();
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="min-w-0 flex-1 bg-transparent text-[calc(13.5px*var(--tekst-skala))] outline-none"
          />
          <small className="shrink-0 text-etikett text-blekk-svak">
            {m.rubrikk.kriterier.length} × {m.rubrikk.nivaer.length}
          </small>
          <button
            onClick={async () => {
              await slettRubrikkmal(m.id);
              visToast(`Rubrikken «${m.navn}» er slettet`);
              last();
            }}
            title="Slett malen. Vurderinger som har brukt den, beholder sin kopi."
            className="px-1 text-[15px] text-blekk-svakest opacity-0 hover:text-feil group-hover:opacity-100"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
