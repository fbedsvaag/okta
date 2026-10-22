import { useEffect, useRef, useState } from "react";
import {
  endreSamtaledag,
  opprettSamtaledag,
  slettSamtaledag,
  slettTrekning,
  stokk,
  tildelTema,
  tilKlokke,
  tilMin,
} from "../../data/samtale";
import {
  endreOppgavekort,
  hentRubrikkmaler,
  kopierRubrikk,
  lagreRubrikkmal,
  nyttOppgavekort,
  settMuntlig,
  slettOppgavekort,
  type Oppgavekort,
  type Rubrikk,
  type Rubrikkmal,
} from "../../data/muntlig";
import {
  oppsummering,
  type Tidsplandag,
  type Utlagtdag,
} from "../../data/tidsplan";
import { nyId } from "../../db";
import { confirm as bekreft } from "@tauri-apps/plugin-dialog";
import {
  hentOktvalg,
  hentVurderingsskalaer,
  slettVurdering,
  type Oktvalg,
} from "../../data/vurderinger";
import type { Skala } from "../../skala";
import { Felter } from "../Vurderingsfelter";
import { Bryter } from "../../ui/felles";
import type { Muntligdata } from "./MuntligArk";

type LagrePlan = (
  rekke: string[],
  tema: (elevId: string) => string | null,
  dager?: Tidsplandag[],
  min?: number,
  pause?: number,
) => Promise<void>;

/**
 * Planlegg (28.2, 28.2b, 28.3b): tidsplanen, hvordan det vurderes, og
 * oppgavekortene elevene trekker blant.
 */
export function Planlegg({
  data,
  utlagt,
  lagrePlan,
  last,
  onLukk,
  onEndret,
}: {
  data: Muntligdata;
  utlagt: Utlagtdag[];
  lagrePlan: LagrePlan;
  last: () => Promise<void>;
  onLukk: () => void;
  onEndret: () => void;
}) {
  return (
    <div>
      <Generator
        data={data}
        utlagt={utlagt}
        lagrePlan={lagrePlan}
        last={last}
      />
      <SlikVurdererDu vurdering={data.vurdering} oppsett={data.oppsett} />
      <Oppgaver data={data} />
      <OmVurderingen data={data} onLukk={onLukk} onEndret={onEndret} />
    </div>
  );
}

/** Tittel, frist, skala og økter, og sletting — nederst i Planlegg. */
function OmVurderingen({
  data,
  onLukk,
  onEndret,
}: {
  data: Muntligdata;
  onLukk: () => void;
  onEndret: () => void;
}) {
  const v = data.vurdering;
  const [skalaer, setSkalaer] = useState<Skala[]>([]);
  const [okter, setOkter] = useState<Oktvalg[]>([]);
  useEffect(() => {
    void hentVurderingsskalaer().then(setSkalaer);
    void hentOktvalg(v.skolearFagId).then(setOkter);
  }, [v.skolearFagId]);
  return (
    <section className="mt-6 border-t border-linje-svak pt-3">
      <h3 className="mb-1 text-[13px] font-semibold">Om vurderingen</h3>
      <div className="-mx-5">
        <Felter
          vurdering={v}
          skalaer={skalaer}
          okter={okter}
          onEndret={onEndret}
        />
      </div>
      <button
        onClick={async () => {
          if (!(await bekreft(`Slette vurderingen «${v.tittel}»?`))) return;
          await slettTrekning(data.dager);
          await slettVurdering(v.id);
          onLukk();
          onEndret();
        }}
        className="mt-2 text-liten text-blekk-svak hover:text-feil"
      >
        Slett vurderingen og tidsplanen
      </button>
    </section>
  );
}

// ------------------------------------------------------------- generator

function Generator({
  data,
  utlagt,
  lagrePlan,
  last,
}: {
  data: Muntligdata;
  utlagt: Utlagtdag[];
  lagrePlan: LagrePlan;
  last: () => Promise<void>;
}) {
  const { oppsett: o, vurdering: v } = data;
  const tp = (): Tidsplandag[] =>
    data.dager.map((d) => ({
      id: d.id,
      dato: d.dato,
      fra: d.fra,
      lunsjFra: d.lunsjFra,
      lunsjMin: d.lunsjMin,
    }));
  const titler = data.kort.map((k) => k.tittel).filter((t) => t.trim());
  const temaNa = (rekke: string[]) => {
    if (!o.trekkNa) return (id: string) => data.samtale.get(id)?.tema ?? null;
    const kart = tildelTema(rekke, titler);
    return (id: string) => kart.get(id) ?? null;
  };
  const beholdTema = (id: string) => data.samtale.get(id)?.tema ?? null;
  const lunsj = data.dager.find((d) => d.lunsjFra) ?? null;
  const lunsjFra = lunsj?.lunsjFra ?? null;
  const lunsjMin = lunsj?.lunsjMin ?? 30;

  async function nyDag() {
    const siste = data.dager[data.dager.length - 1];
    const dato = siste?.dato
      ? plussDag(siste.dato)
      : (v.oktDato ?? v.frist ?? iDag());
    const fra = siste?.fra ?? "08:30";
    const id = await opprettSamtaledag(data.skolearId, {
      skolearFagId: v.skolearFagId,
      vurderingId: v.id,
      dato,
      fra,
      til: fra,
      lunsjFra,
      lunsjMin: lunsjFra ? lunsjMin : null,
    });
    const dager = [
      ...tp(),
      { id, dato, fra, lunsjFra, lunsjMin: lunsjFra ? lunsjMin : null },
    ];
    // Første dag: elevene legges ut i rekkefølgen som står, alfabetisk.
    await lagrePlan(
      data.rekke,
      data.harPlan ? beholdTema : temaNa(data.rekke),
      dager,
    );
  }

  async function endreDag(id: string, felter: Partial<Tidsplandag>) {
    await endreSamtaledag(id, {
      ...(felter.dato !== undefined && { dato: felter.dato }),
      ...(felter.fra !== undefined && { fra: felter.fra }),
    });
    const dager = tp().map((d) => (d.id === id ? { ...d, ...felter } : d));
    if (data.harPlan) await lagrePlan(data.rekke, beholdTema, dager);
    else await last();
  }

  async function fjernDag(id: string) {
    await slettSamtaledag(id);
    const dager = tp().filter((d) => d.id !== id);
    if (dager.length > 0) await lagrePlan(data.rekke, beholdTema, dager);
    else await last();
  }

  async function settLunsj(fra: string | null, min: number) {
    for (const d of data.dager)
      await endreSamtaledag(d.id, {
        lunsj_fra: fra,
        lunsj_min: fra ? min : null,
      });
    const dager = tp().map((d) => ({
      ...d,
      lunsjFra: fra,
      lunsjMin: fra ? min : null,
    }));
    if (data.harPlan) await lagrePlan(data.rekke, beholdTema, dager);
    else await last();
  }

  async function settTider(min: number, pause: number) {
    await settMuntlig(v.id, { samtaleMin: min, pauseMin: pause });
    if (data.harPlan)
      await lagrePlan(data.rekke, beholdTema, undefined, min, pause);
  }

  return (
    <section className="mb-5 rounded-[14px] p-4 shadow-[inset_0_0_0_1px_var(--color-linje-svak)]">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-[13px] font-semibold">Tidsplan</h3>
        <span className="text-liten tabular-nums text-blekk-svak">
          {data.dager.length > 0 ? oppsummering(utlagt) : ""}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="w-[86px] text-liten text-blekk-dempet">Dager</span>
        {data.dager.map((d) => (
          <span
            key={d.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-flate-svak py-0.5 pl-2.5 pr-1 text-liten"
          >
            <input
              type="date"
              value={d.dato}
              onChange={(e) => void endreDag(d.id, { dato: e.target.value })}
              className="bg-transparent tabular-nums outline-none"
            />
            <span className="text-blekk-svak">fra</span>
            <Steg
              verdi={d.fra}
              onMinus={() =>
                void endreDag(d.id, { fra: tilKlokke(tilMin(d.fra) - 5) })
              }
              onPluss={() =>
                void endreDag(d.id, { fra: tilKlokke(tilMin(d.fra) + 5) })
              }
            />
            <button
              onClick={() => void fjernDag(d.id)}
              title="Fjern dagen"
              className="px-1 text-[15px] text-blekk-svakest hover:text-feil"
            >
              ×
            </button>
          </span>
        ))}
        <button
          onClick={() => void nyDag()}
          className="text-[13px] text-aksent hover:underline"
        >
          + dag
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        <Felt navn="Per elev">
          <Steg
            verdi={`${o.samtaleMin} min`}
            onMinus={() =>
              void settTider(Math.max(1, o.samtaleMin - 1), o.pauseMin)
            }
            onPluss={() => void settTider(o.samtaleMin + 1, o.pauseMin)}
          />
        </Felt>
        <Felt navn="Pause">
          <Steg
            verdi={`${o.pauseMin} min`}
            onMinus={() =>
              void settTider(o.samtaleMin, Math.max(0, o.pauseMin - 1))
            }
            onPluss={() => void settTider(o.samtaleMin, o.pauseMin + 1)}
          />
        </Felt>
        <Felt navn="Lunsj">
          {lunsjFra ? (
            <>
              <Steg
                verdi={lunsjFra}
                onMinus={() =>
                  void settLunsj(tilKlokke(tilMin(lunsjFra) - 5), lunsjMin)
                }
                onPluss={() =>
                  void settLunsj(tilKlokke(tilMin(lunsjFra) + 5), lunsjMin)
                }
              />
              <button
                onClick={() => void settLunsj(null, lunsjMin)}
                title="Ingen lunsj"
                className="px-1 text-[15px] text-blekk-svakest hover:text-feil"
              >
                ×
              </button>
            </>
          ) : (
            <button
              disabled={data.dager.length === 0}
              onClick={() => void settLunsj("11:30", 30)}
              className="text-[13px] text-aksent hover:underline disabled:opacity-40"
            >
              + lunsj
            </button>
          )}
        </Felt>
        {lunsjFra && (
          <Felt navn="Lunsjlengde">
            <Steg
              verdi={`${lunsjMin} min`}
              onMinus={() =>
                void settLunsj(lunsjFra, Math.max(5, lunsjMin - 5))
              }
              onPluss={() => void settLunsj(lunsjFra, lunsjMin + 5)}
            />
          </Felt>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          disabled={data.dager.length === 0}
          onClick={() => {
            const rekke = stokk(data.elever.map((e) => e.elevId));
            void lagrePlan(rekke, temaNa(rekke));
          }}
          className="h-[30px] rounded-full bg-aksent px-3.5 text-[13px] font-medium text-ark hover:bg-aksent-mork disabled:opacity-40"
        >
          🎲 Trekk rekkefølge
        </button>
        <button
          disabled={data.dager.length === 0}
          onClick={() => {
            const rekke = [...data.elever]
              .sort((a, b) => a.fornavn.localeCompare(b.fornavn, "nb"))
              .map((e) => e.elevId);
            void lagrePlan(rekke, data.harPlan ? beholdTema : temaNa(rekke));
          }}
          className="h-[30px] rounded-full border border-linje-sterk bg-ark px-3 text-[13px] hover:bg-flate disabled:opacity-40"
        >
          Alfabetisk
        </button>
        <span className="flex-1" />
        <span className="text-liten text-blekk-dempet">Oppgaven trekkes</span>
        <Bryter
          storrelse="liten"
          verdi={o.trekkNa ? "na" : "under"}
          settVerdi={async (x) => {
            const na = x === "na";
            await settMuntlig(v.id, { trekkNa: na });
            // Trekkes den nå, får de som mangler oppgave en med en gang.
            if (na && data.harPlan && titler.length > 0) {
              const kart = tildelTema(data.rekke, titler);
              await lagrePlan(
                data.rekke,
                (id) => data.samtale.get(id)?.tema ?? kart.get(id) ?? null,
              );
            }
          }}
          valg={[
            { id: "na", navn: "nå, for alle" },
            { id: "under", navn: "under samtalen" },
          ]}
        />
      </div>
      {data.dager.length === 0 && (
        <p className="mt-3 text-liten text-blekk-svak">
          Legg til en dag, så legges de {data.elever.length} elevene i{" "}
          {v.fagKode} ut med tider.
        </p>
      )}
    </section>
  );
}

function Felt({ navn, children }: { navn: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-liten text-blekk-dempet">{navn}</span>
      {children}
    </span>
  );
}

/** − verdi + */
function Steg({
  verdi,
  onMinus,
  onPluss,
}: {
  verdi: string;
  onMinus: () => void;
  onPluss: () => void;
}) {
  const k =
    "grid h-6 w-6 place-items-center rounded-full text-blekk-dempet hover:bg-flate hover:text-blekk";
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-ark px-0.5 shadow-[inset_0_0_0_1px_var(--color-linje)]">
      <button onClick={onMinus} className={k} aria-label="Mindre">
        −
      </button>
      <span className="min-w-[46px] text-center text-[13px] tabular-nums">
        {verdi}
      </span>
      <button onClick={onPluss} className={k} aria-label="Mer">
        +
      </button>
    </span>
  );
}

// ------------------------------------------------------ slik vurderer du

export function SlikVurdererDu({
  vurdering: v,
  oppsett,
}: {
  vurdering: { id: string; tittel: string };
  oppsett: { rubrikk: Rubrikk; form: "kriterier" | "rubrikk" };
}) {
  const [r, setR] = useState<Rubrikk>(oppsett.rubrikk);
  const [form, setForm] = useState(oppsett.form);
  const [maler, setMaler] = useState<Rubrikkmal[]>([]);
  const [malApen, setMalApen] = useState(false);
  const [malNavn, setMalNavn] = useState<string | null>(null);
  const [lagret, setLagret] = useState(false);
  const venter = useRef<number | null>(null);
  const siste = useRef(r);

  useEffect(() => void hentRubrikkmaler().then(setMaler), []);
  // Lagres litt etter siste tastetrykk, og når arket lukkes.
  useEffect(
    () => () => {
      if (venter.current !== null) {
        window.clearTimeout(venter.current);
        void settMuntlig(v.id, { rubrikk: siste.current });
      }
    },
    [v.id],
  );
  function endre(ny: Rubrikk) {
    setR(ny);
    siste.current = ny;
    if (venter.current !== null) window.clearTimeout(venter.current);
    venter.current = window.setTimeout(() => {
      venter.current = null;
      void settMuntlig(v.id, { rubrikk: ny });
    }, 600);
  }
  const krit = (i: number, f: (k: Rubrikk["kriterier"][number]) => void) => {
    const ny = structuredClone(r);
    f(ny.kriterier[i]);
    endre(ny);
  };

  return (
    <section className="mb-5 rounded-[14px] bg-flate-svak p-4">
      <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
        <h3 className="text-[13px] font-semibold">Slik vurderer du</h3>
        <Bryter
          storrelse="liten"
          verdi={form}
          settVerdi={(f) => {
            const ny = f === "rubrikk" ? "rubrikk" : "kriterier";
            setForm(ny);
            void settMuntlig(v.id, { form: ny });
          }}
          valg={[
            { id: "kriterier", navn: "Kriterier" },
            { id: "rubrikk", navn: "Rubrikk" },
          ]}
        />
        <span className="flex-1" />
        <span className="relative">
          <button
            onClick={() => setMalApen((a) => !a)}
            className="h-[30px] rounded-full border border-linje-sterk bg-ark px-3 text-[13px] hover:bg-flate"
          >
            Lagrede rubrikker{" "}
            <span className="text-[11px] text-blekk-svak">⌄</span>
          </button>
          {malApen && (
            <div className="glass-meny absolute right-0 top-9 z-[60] w-[280px] rounded-[14px] p-1.5">
              {maler.length === 0 && (
                <p className="px-2 py-2 text-liten text-blekk-svak">
                  Ingen lagrede rubrikker ennå.
                </p>
              )}
              {maler.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    endre(kopierRubrikk(m.rubrikk));
                    setForm("rubrikk");
                    void settMuntlig(v.id, { form: "rubrikk" });
                    setMalApen(false);
                  }}
                  className="block w-full rounded-[9px] px-2.5 py-1.5 text-left hover:bg-flate"
                >
                  <b className="block text-[13px] font-medium">{m.navn}</b>
                  <small className="text-liten text-blekk-svak">
                    {m.rubrikk.kriterier.length} kriterier ·{" "}
                    {m.rubrikk.nivaer.length} nivåer
                  </small>
                </button>
              ))}
              <p className="px-2 pb-0.5 pt-1.5 text-liten text-blekk-svak">
                Velg for å bruke en kopi her. Malen endres ikke.
              </p>
            </div>
          )}
        </span>
        {malNavn === null ? (
          <button
            onClick={() => setMalNavn(v.tittel)}
            className="h-[30px] rounded-full border border-linje-sterk bg-ark px-3 text-[13px] hover:bg-flate"
          >
            {lagret ? "Lagret som mal ✓" : "Lagre som mal"}
          </button>
        ) : (
          <input
            autoFocus
            value={malNavn}
            onChange={(e) => setMalNavn(e.target.value)}
            onBlur={() => setMalNavn(null)}
            onKeyDown={async (e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                setMalNavn(null);
              }
              if (e.key === "Enter" && malNavn.trim()) {
                await lagreRubrikkmal(malNavn.trim(), r);
                setMalNavn(null);
                setLagret(true);
                setMaler(await hentRubrikkmaler());
              }
            }}
            placeholder="Navn på malen ↵"
            className="h-[30px] w-48 rounded-full bg-ark px-3 text-[13px] shadow-[inset_0_0_0_1.5px_var(--color-aksent)] outline-none"
          />
        )}
      </div>

      {form === "rubrikk" ? (
        <div>
          <div
            className="grid items-center gap-1.5"
            style={{
              gridTemplateColumns: `130px repeat(${r.nivaer.length}, minmax(0,1fr)) 22px`,
            }}
          >
            <span />
            {r.nivaer.map((n, i) => (
              <input
                key={n.id}
                value={n.navn}
                onChange={(e) => {
                  const ny = structuredClone(r);
                  ny.nivaer[i].navn = e.target.value;
                  endre(ny);
                }}
                className="min-w-0 rounded-md bg-transparent px-1.5 py-1 text-etikett uppercase tracking-[.05em] text-blekk-svak outline-none hover:bg-ark focus:bg-ark focus:shadow-[inset_0_0_0_1.5px_var(--color-aksent)]"
              />
            ))}
            <span />
            {r.kriterier.map((k, i) => (
              <Rad key={k.id}>
                <textarea
                  value={k.tekst}
                  placeholder="Kriterium"
                  rows={2}
                  onChange={(e) => krit(i, (x) => (x.tekst = e.target.value))}
                  className={`${celle} font-medium`}
                />
                {r.nivaer.map((n) => (
                  <textarea
                    key={n.id}
                    value={k.celler[n.id] ?? ""}
                    placeholder="Beskriv nivået"
                    rows={2}
                    onChange={(e) =>
                      krit(i, (x) => (x.celler[n.id] = e.target.value))
                    }
                    className={celle}
                  />
                ))}
                <Fjern
                  onKlikk={() =>
                    endre({
                      ...r,
                      kriterier: r.kriterier.filter((x) => x.id !== k.id),
                    })
                  }
                />
              </Rad>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-3.5">
            <button
              onClick={() =>
                endre({
                  ...r,
                  kriterier: [
                    ...r.kriterier,
                    { id: nyId(), tekst: "", celler: {} },
                  ],
                })
              }
              className="text-[13px] text-aksent hover:underline"
            >
              + Kriterium
            </button>
            <button
              onClick={() =>
                endre({
                  ...r,
                  nivaer: [...r.nivaer, { id: nyId(), navn: "Nytt nivå" }],
                })
              }
              className="text-[13px] text-aksent hover:underline"
            >
              + Nivå
            </button>
            {r.nivaer.length > 2 && (
              <button
                onClick={() => endre({ ...r, nivaer: r.nivaer.slice(0, -1) })}
                className="text-[13px] text-blekk-svak hover:text-feil"
              >
                − Siste nivå
              </button>
            )}
            <span className="text-liten text-blekk-svak">
              Nivåene står fra lavest til høyest.
            </span>
          </div>
        </div>
      ) : (
        <div>
          {r.kriterier.map((k, i) => (
            <div key={k.id} className="flex items-center gap-1.5">
              <span className="w-4 text-center text-blekk-svakest">☐</span>
              <input
                value={k.tekst}
                placeholder="Kriterium"
                onChange={(e) => krit(i, (x) => (x.tekst = e.target.value))}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  const ny = structuredClone(r);
                  ny.kriterier.splice(i + 1, 0, {
                    id: nyId(),
                    tekst: "",
                    celler: {},
                  });
                  endre(ny);
                  fokusEtter(`[data-krit="${i + 1}"]`);
                }}
                data-krit={i}
                className={inn}
              />
              <Fjern
                onKlikk={() =>
                  endre({
                    ...r,
                    kriterier: r.kriterier.filter((x) => x.id !== k.id),
                  })
                }
              />
            </div>
          ))}
          <button
            onClick={() =>
              endre({
                ...r,
                kriterier: [
                  ...r.kriterier,
                  { id: nyId(), tekst: "", celler: {} },
                ],
              })
            }
            className="ml-[22px] mt-1.5 text-[12.5px] text-aksent hover:underline"
          >
            + Kriterium
          </button>
          <p className="ml-[22px] mt-1.5 text-liten text-blekk-svak">
            Krysses av for hver elev. Bytt til Rubrikk for å beskrive nivåer.
          </p>
        </div>
      )}
    </section>
  );
}

const celle =
  "min-h-[52px] min-w-0 resize-none rounded-lg bg-ark px-2 py-1.5 text-[12.5px] leading-snug outline-none shadow-[inset_0_0_0_1px_var(--color-linje-svak)] placeholder:text-blekk-svakest focus:shadow-[inset_0_0_0_1.5px_var(--color-aksent)]";
const inn =
  "min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-[3px] text-[13px] outline-none placeholder:text-blekk-svakest hover:bg-flate-svak focus:bg-ark focus:shadow-[inset_0_0_0_1.5px_var(--color-aksent)]";

function Rad({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Fjern({ onKlikk, tittel }: { onKlikk: () => void; tittel?: string }) {
  return (
    <button
      onClick={onKlikk}
      title={tittel ?? "Fjern"}
      className="px-1 text-[15px] text-blekk-svakest hover:text-feil"
    >
      ×
    </button>
  );
}

function fokusEtter(velger: string) {
  window.setTimeout(
    () => document.querySelector<HTMLInputElement>(velger)?.focus(),
    30,
  );
}

// -------------------------------------------------------------- oppgaver

function Oppgaver({ data }: { data: Muntligdata }) {
  const v = data.vurdering;
  const [kort, setKort] = useState<Oppgavekort[]>(data.kort);
  const [flere, setFlere] = useState(data.oppsett.trekkFlere);
  const venter = useRef(new Map<string, number>());

  // Nye kort fra basen (et nytt kort er lagt til) tas inn, uten å
  // overskrive det som skrives.
  useEffect(() => {
    setKort((k) => data.kort.map((d) => k.find((x) => x.id === d.id) ?? d));
  }, [data.kort]);

  function endre(id: string, f: (k: Oppgavekort) => Oppgavekort) {
    setKort((alle) => {
      const ny = alle.map((k) => (k.id === id ? f(k) : k));
      const k = ny.find((x) => x.id === id)!;
      const t = venter.current.get(id);
      if (t) window.clearTimeout(t);
      venter.current.set(
        id,
        window.setTimeout(() => {
          venter.current.delete(id);
          void endreOppgavekort(id, k);
        }, 500),
      );
      return ny;
    });
  }
  // Det som venter, lagres når arket lukkes.
  const ferske = useRef(kort);
  ferske.current = kort;
  useEffect(
    () => () => {
      for (const [id, t] of venter.current) {
        window.clearTimeout(t);
        const k = ferske.current.find((x) => x.id === id);
        if (k) void endreOppgavekort(id, k);
      }
    },
    [],
  );

  return (
    <section>
      <div className="mb-2.5 flex flex-wrap items-baseline gap-2.5">
        <h3 className="whitespace-nowrap text-[13px] font-semibold">
          Oppgaver ({kort.length})
        </h3>
        <span className="text-liten text-blekk-svak">
          Hver elev trekker én, og spørsmålene dukker opp under samtalen.
        </span>
        <span className="flex-1" />
        <label className="inline-flex cursor-pointer select-none items-center gap-[7px] text-[12.5px] text-blekk-dempet">
          <input
            type="checkbox"
            checked={flere}
            onChange={(e) => {
              setFlere(e.target.checked);
              void settMuntlig(v.id, { trekkFlere: e.target.checked });
            }}
            className="accent-[var(--color-aksent)]"
          />
          Kan trekkes flere ganger
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {kort.map((k, ki) => (
          <div
            key={k.id}
            className="rounded-[14px] bg-ark px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--color-linje-svak)]"
          >
            <div className="flex items-center gap-2">
              <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[7px] bg-flate text-[11.5px] font-semibold text-blekk-dempet">
                {ki + 1}
              </span>
              <input
                value={k.tittel}
                placeholder="Tittel på oppgaven"
                onChange={(e) =>
                  endre(k.id, (x) => ({ ...x, tittel: e.target.value }))
                }
                className={`${inn} text-[14px] font-semibold`}
              />
              <Fjern
                tittel="Fjern oppgaven"
                onKlikk={async () => {
                  setKort((a) => a.filter((x) => x.id !== k.id));
                  await slettOppgavekort(k.id);
                }}
              />
            </div>
            <input
              value={k.beskrivelse}
              placeholder="Kort om caset (valgfritt)"
              onChange={(e) =>
                endre(k.id, (x) => ({ ...x, beskrivelse: e.target.value }))
              }
              className={`${inn} mb-2 ml-[30px] mt-0.5 w-[calc(100%-30px)] text-blekk-dempet`}
            />
            <p className="mb-1 ml-[30px] text-liten text-blekk-svak">
              Spørsmål du kan stille
            </p>
            {k.sporsmal.map((q, qi) => (
              <div key={qi} className="ml-6 flex items-center gap-1.5">
                <span className="w-4 text-center text-[12px] text-blekk-svakest">
                  ?
                </span>
                <input
                  value={q}
                  placeholder="Nytt spørsmål"
                  data-q={`${k.id}-${qi}`}
                  onChange={(e) =>
                    endre(k.id, (x) => ({
                      ...x,
                      sporsmal: x.sporsmal.map((s, i) =>
                        i === qi ? e.target.value : s,
                      ),
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    endre(k.id, (x) => {
                      const s = [...x.sporsmal];
                      s.splice(qi + 1, 0, "");
                      return { ...x, sporsmal: s };
                    });
                    fokusEtter(`[data-q="${k.id}-${qi + 1}"]`);
                  }}
                  className={inn}
                />
                <Fjern
                  onKlikk={() =>
                    endre(k.id, (x) => ({
                      ...x,
                      sporsmal: x.sporsmal.filter((_, i) => i !== qi),
                    }))
                  }
                />
              </div>
            ))}
            <button
              onClick={() => {
                endre(k.id, (x) => ({ ...x, sporsmal: [...x.sporsmal, ""] }));
                fokusEtter(`[data-q="${k.id}-${k.sporsmal.length}"]`);
              }}
              className="ml-[30px] mt-1 text-[12.5px] text-aksent hover:underline"
            >
              + Spørsmål
            </button>
          </div>
        ))}
        <button
          onClick={async () => {
            const id = await nyttOppgavekort(v.id, kort.length + 1);
            setKort((a) => [
              ...a,
              {
                id,
                nr: a.length + 1,
                tittel: "",
                beskrivelse: "",
                sporsmal: [""],
              },
            ]);
          }}
          className="grid min-h-[120px] place-items-center rounded-[14px] text-[13.5px] text-aksent shadow-[inset_0_0_0_1.5px_var(--color-linje)] hover:bg-flate-svak"
        >
          + Ny oppgave
        </button>
      </div>
    </section>
  );
}

function plussDag(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + 1);
  // Over helga.
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function iDag(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
