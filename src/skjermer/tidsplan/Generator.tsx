import {
  endreSamtaledag,
  slettSamtaledag,
  stokk,
  tildelTema,
  tilKlokke,
  tilMin,
  type Samtaledag,
} from "../../data/samtale";
import {
  oppsummering,
  type Tidsplandag,
  type Utlagtdag,
} from "../../data/tidsplan";
import { Bryter } from "../../ui/felles";
import { Velger } from "../../ui/Velger";
import type { Oktvalg } from "../../data/vurderinger";

/**
 * Tidsplangeneratoren (ARBEIDSLISTE 28.2b), felles for muntlig vurdering og
 * mentorsamtalene (29.6): dager, starttid, minutter per elev, pause, lunsj,
 * trukket eller alfabetisk rekkefølge. Alle tider regnes ut på nytt med en
 * gang.
 */

export type LagrePlan = (
  rekke: string[],
  tema: (elevId: string) => string | null,
  dager?: Tidsplandag[],
  min?: number,
  pause?: number,
) => Promise<void>;

export type Plankilde = {
  dager: Samtaledag[];
  elever: { elevId: string; fornavn: string }[];
  rekke: string[];
  harPlan: boolean;
  min: number;
  pause: number;
  /** temaet (oppgaven) eleven har nå */
  tema: (elevId: string) => string | null;
};

export function tilTidsplandager(dager: Samtaledag[]): Tidsplandag[] {
  return dager.map((d) => ({
    id: d.id,
    dato: d.dato,
    fra: d.fra,
    lunsjFra: d.lunsjFra,
    lunsjMin: d.lunsjMin,
    oktId: d.oktId,
    til: d.til,
  }));
}

export function Generator({
  kilde: k,
  utlagt,
  lagrePlan,
  last,
  opprettDag,
  settTider: lagreTider,
  standardDato,
  tom,
  trekk,
  okter,
}: {
  kilde: Plankilde;
  utlagt: Utlagtdag[];
  lagrePlan: LagrePlan;
  last: () => Promise<void>;
  /** lager en ny samtaledag og gir id-en */
  opprettDag: (d: Omit<Tidsplandag, "id">) => Promise<string>;
  settTider: (min: number, pause: number) => Promise<void>;
  /** datoen den første dagen får */
  standardDato: string;
  /** teksten når det ikke finnes dager */
  tom: string;
  /** oppgavene som trekkes (muntlig); utelates for mentorsamtaler */
  trekk?: {
    na: boolean;
    titler: string[];
    settNa: (na: boolean) => Promise<void>;
  };
  /**
   * Øktene i faget (muntlig): en dag legges i en økt, med øktas start og
   * slutt, og vurderingen knyttes til økta. Utelates for mentorsamtaler.
   */
  okter?: {
    valg: Oktvalg[];
    /** øktene vurderingen allerede er knyttet til */
    knyttet: string[];
    /** legger en samtaledag i økta og gir dagen, eller null uten klokkeslett */
    leggI: (oktId: string) => Promise<Tidsplandag | null>;
    fjern: (samtaledagId: string) => Promise<void>;
  };
}) {
  const tp = () => tilTidsplandager(k.dager);
  const temaNa = (rekke: string[]) => {
    if (!trekk?.na) return k.tema;
    const kart = tildelTema(rekke, trekk.titler);
    return (id: string) => kart.get(id) ?? null;
  };
  const lunsj = k.dager.find((d) => d.lunsjFra) ?? null;
  const lunsjFra = lunsj?.lunsjFra ?? null;
  const lunsjMin = lunsj?.lunsjMin ?? 30;

  async function nyDag() {
    const siste = k.dager[k.dager.length - 1];
    const dato = siste?.dato ? plussDag(siste.dato) : standardDato;
    const fra = siste?.fra ?? "08:30";
    const ny = { dato, fra, lunsjFra, lunsjMin: lunsjFra ? lunsjMin : null };
    const id = await opprettDag(ny);
    // Første dag: elevene legges ut i rekkefølgen som står, alfabetisk.
    await lagrePlan(k.rekke, k.harPlan ? k.tema : temaNa(k.rekke), [
      ...tp(),
      { id, ...ny },
    ]);
  }

  async function endreDag(id: string, felter: Partial<Tidsplandag>) {
    await endreSamtaledag(id, {
      ...(felter.dato !== undefined && { dato: felter.dato }),
      ...(felter.fra !== undefined && { fra: felter.fra }),
    });
    const dager = tp().map((d) => (d.id === id ? { ...d, ...felter } : d));
    if (k.harPlan) await lagrePlan(k.rekke, k.tema, dager);
    else await last();
  }

  async function iOkt(oktId: string) {
    if (!okter) return;
    const ny = await okter.leggI(oktId);
    if (!ny) return;
    await lagrePlan(k.rekke, k.harPlan ? k.tema : temaNa(k.rekke), [
      ...tp(),
      ny,
    ]);
  }

  async function fjernDag(id: string) {
    const dag = k.dager.find((d) => d.id === id);
    // En dag i en økt løses fra økta, så vurderingen ikke henger igjen der.
    if (dag?.oktId && okter) await okter.fjern(id);
    else await slettSamtaledag(id);
    const dager = tp().filter((d) => d.id !== id);
    if (dager.length > 0) await lagrePlan(k.rekke, k.tema, dager);
    else await last();
  }

  async function settLunsj(fra: string | null, min: number) {
    // En økt har ingen lunsj i seg.
    for (const d of k.dager.filter((x) => !x.oktId))
      await endreSamtaledag(d.id, {
        lunsj_fra: fra,
        lunsj_min: fra ? min : null,
      });
    const dager = tp().map((d) => ({
      ...d,
      lunsjFra: fra,
      lunsjMin: fra ? min : null,
    }));
    if (k.harPlan) await lagrePlan(k.rekke, k.tema, dager);
    else await last();
  }

  async function settTider(min: number, pause: number) {
    await lagreTider(min, pause);
    if (k.harPlan) await lagrePlan(k.rekke, k.tema, undefined, min, pause);
    else await last();
  }

  return (
    <section className="mb-5 rounded-[14px] p-4 shadow-[inset_0_0_0_1px_var(--color-linje-svak)]">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-[13px] font-semibold">Tidsplan</h3>
        <span className="text-liten tabular-nums text-blekk-svak">
          {k.dager.length > 0 ? oppsummering(utlagt) : ""}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="w-[86px] text-liten text-blekk-dempet">Dager</span>
        {k.dager.map((d) =>
          d.oktId ? (
            <span
              key={d.id}
              title="Samtalene ligger i økta, med øktas start og slutt"
              className="inline-flex items-center gap-1.5 rounded-full bg-valgt py-1 pl-2.5 pr-1 text-liten"
            >
              <span className="font-medium">Økt</span>
              <span className="tabular-nums">
                {oktdato(d.dato)} {d.fra}–{d.til}
              </span>
              <button
                onClick={() => void fjernDag(d.id)}
                title="Ta samtalene ut av økta"
                className="px-1 text-[15px] text-blekk-svakest hover:text-feil"
              >
                ×
              </button>
            </span>
          ) : (
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
          ),
        )}
        {okter && (
          <Velger
            verdi=""
            variant="liten"
            settVerdi={(id) => void iOkt(id)}
            plassholder="+ økt …"
            etikett="Legg samtalene i en økt"
            valg={okter.valg
              .filter(
                (o) => o.klokkeslett && !k.dager.some((d) => d.oktId === o.id),
              )
              .sort(
                (a, b) =>
                  Number(okter.knyttet.includes(b.id)) -
                  Number(okter.knyttet.includes(a.id)),
              )
              .map((o) => ({
                verdi: o.id,
                tekst: `${oktdato(o.dato)} ${o.klokkeslett}${o.tema ? ` · ${o.tema}` : ""}`,
                hint: okter.knyttet.includes(o.id) ? "knyttet" : undefined,
              }))}
          />
        )}
        <button
          onClick={() => void nyDag()}
          className="text-[13px] text-aksent hover:underline"
        >
          {okter ? "+ egen dag" : "+ dag"}
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        <Felt navn="Per elev">
          <Steg
            verdi={`${k.min} min`}
            onMinus={() => void settTider(Math.max(1, k.min - 1), k.pause)}
            onPluss={() => void settTider(k.min + 1, k.pause)}
          />
        </Felt>
        <Felt navn="Pause">
          <Steg
            verdi={`${k.pause} min`}
            onMinus={() => void settTider(k.min, Math.max(0, k.pause - 1))}
            onPluss={() => void settTider(k.min, k.pause + 1)}
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
              disabled={k.dager.length === 0}
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
          disabled={k.dager.length === 0}
          onClick={() => {
            const rekke = stokk(k.elever.map((e) => e.elevId));
            void lagrePlan(rekke, temaNa(rekke));
          }}
          className="h-[30px] rounded-full bg-aksent px-3.5 text-[13px] font-medium text-ark hover:bg-aksent-mork disabled:opacity-40"
        >
          🎲 Trekk rekkefølge
        </button>
        {trekk && (
          <button
            disabled={!k.harPlan || trekk.titler.length === 0}
            title={
              trekk.titler.length === 0
                ? "Legg inn oppgaver under Oppgaver først"
                : "Hver elev trekker en oppgave. Rekkefølgen står."
            }
            onClick={() => {
              const kart = tildelTema(k.rekke, trekk.titler);
              void lagrePlan(k.rekke, (id) => kart.get(id) ?? null);
            }}
            className="h-[30px] rounded-full bg-aksent px-3.5 text-[13px] font-medium text-ark hover:bg-aksent-mork disabled:opacity-40"
          >
            🎲 Trekk oppgaver
          </button>
        )}
        <button
          disabled={k.dager.length === 0}
          onClick={() => {
            const rekke = [...k.elever]
              .sort((a, b) => a.fornavn.localeCompare(b.fornavn, "nb"))
              .map((e) => e.elevId);
            void lagrePlan(rekke, k.harPlan ? k.tema : temaNa(rekke));
          }}
          className="h-[30px] rounded-full border border-linje-sterk bg-ark px-3 text-[13px] hover:bg-flate disabled:opacity-40"
        >
          Alfabetisk
        </button>
        {trekk && (
          <>
            <span className="flex-1" />
            <span className="text-liten text-blekk-dempet">
              Oppgaven trekkes
            </span>
            <Bryter
              storrelse="liten"
              verdi={trekk.na ? "na" : "under"}
              settVerdi={async (x) => {
                const na = x === "na";
                await trekk.settNa(na);
                // Trekkes den nå, får de som mangler oppgave en med en gang.
                if (na && k.harPlan && trekk.titler.length > 0) {
                  const kart = tildelTema(k.rekke, trekk.titler);
                  await lagrePlan(
                    k.rekke,
                    (id) => k.tema(id) ?? kart.get(id) ?? null,
                  );
                }
              }}
              valg={[
                { id: "na", navn: "nå, for alle" },
                { id: "under", navn: "under samtalen" },
              ]}
            />
          </>
        )}
      </div>
      {k.dager.length === 0 && (
        <p className="mt-3 text-liten text-blekk-svak">{tom}</p>
      )}
      {utlagt.some((d) => d.forMange > 0) && (
        <p className="mt-3 text-liten text-feil">
          {utlagt
            .filter((d) => d.forMange > 0)
            .map(
              (d) =>
                `${d.forMange} ${d.forMange === 1 ? "elev går" : "elever går"} over økta ${oktdato(d.dag.dato)} (slutter ${d.dag.til})`,
            )
            .join(" · ")}
          . Legg til en økt til, eller kort ned minuttene.
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

/** «tor 5.11» */
function oktdato(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  const dag = d
    .toLocaleDateString("nb-NO", { weekday: "short" })
    .replace(".", "");
  return `${dag} ${d.getDate()}.${d.getMonth() + 1}`;
}

/** Neste skoledag: over helga. */
export function plussDag(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function iDag(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
