import { useEffect, useState, type ReactNode } from "react";
import { confirm as bekreft } from "@tauri-apps/plugin-dialog";
import {
  endreOkt,
  hentForrigeOkt,
  hentOktElever,
  slettOkt,
  teamstekst,
  type Okt,
  type OktElev,
} from "../data/okter";
import {
  fargelegg,
  hentOktmal,
  hentPerioder,
  settOktmal,
  type Oktmal,
  type Periode,
} from "../data/perioder";
import { finnFag, type Kompetansemaal } from "../data/grep";
import {
  hentVurderingsvalg,
  knyttOkt,
  losOkt,
  type Vurderingsvalg,
} from "../data/vurderinger";
import { hentOktrader, type Oktrad } from "../data/oktrader";
import { hentApneOppfolginger } from "../data/elevnotat";
import { folgOpp, iPerioden, type Oppfolging } from "../data/oktplan";
import { kortDag } from "../data/fagside";
import { lyttVurderinger } from "../data/endringer";
import { useArk } from "../ui/Arkstabel";
import { Markdown } from "../ui/Notattekst";
import { Tastestripe, Tasthint } from "../ui/Tastestripe";
import { tast } from "../ui/taster";
import { idag as dagensDato } from "../db";
import { Velger } from "../ui/Velger";
import { Oktplan, usePlanvisning } from "./Oktplan";

/**
 * Økta i planlegging (ARBEIDSLISTE 11.5, lerretet «OktPlan»).
 *
 * Venstre: fakta (dato, tid, rom, periode, vurdering), lekse og agenda til
 * elevene, planen som en sjekkliste med minutter mot øktas lengde, og
 * kompetansemålene i økta. Høyre: fra forrige økt, hvem som bør følges opp,
 * og hvor i perioden økta ligger. Alt lagres når feltet forlates.
 */
export function OktPlanlegging({
  okt,
  skolearId,
  fagOkter,
  periode,
  onEndret,
  onLukk,
  onVisIOkter,
}: {
  okt: Okt;
  skolearId: string;
  fagOkter: Okt[];
  periode: Periode | null;
  onEndret: () => void;
  onLukk: () => void;
  onVisIOkter: () => void;
}) {
  async function lagre(felt: Parameters<typeof endreOkt>[1]) {
    await endreOkt(okt.id, felt);
    onEndret();
  }
  // Øktplan: Enkel | Full (15.10). Ingenting tegnes før valget er lest,
  // så planen ikke blinker fra den ene til den andre.
  const visning = usePlanvisning();
  if (!visning) return null;
  const enkel = visning === "enkel";

  return (
    <>
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto px-[26px] pb-6 pt-[18px]">
          {/* Faktaraden: alt på én linje, med etiketter over (15.5). */}
          <Fakta okt={okt} enkel={enkel} onLagre={lagre} />
          <div className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-4">
            <Tekstfelt
              etikett="Lekse"
              hint={enkel ? undefined : "står på årsplanen"}
              verdi={okt.lekse}
              plassholder="Hva elevene skal ha gjort"
              onLagre={(v) => lagre({ lekse: v })}
            />
            <div>
              <Tekstfelt
                etikett="Agenda til elevene"
                hint={enkel ? undefined : "går ut i kalenderen"}
                verdi={okt.agenda}
                plassholder="Repetisjon · Case i grupper · Exit-lapp"
                onLagre={(v) => lagre({ agenda: v })}
              />
              <Kopier okt={okt} />
            </div>
          </div>

          <Oktplan
            okt={okt}
            enkel={enkel}
            onLagre={(plan) => lagre({ plan })}
          />
          <Mal okt={okt} periode={periode} enkel={enkel} />
          {/* Enkel: vurderingen står her, ikke i faktaraden. */}
          {enkel && (
            <div className="mt-4 flex items-center gap-2.5 text-[calc(13.5px*var(--tekst-skala))]">
              <span className="text-[calc(12px*var(--tekst-skala))] text-blekk-dempet">
                Vurdering
              </span>
              <Vurdering okt={okt} onEndret={() => void lagre({})} />
            </div>
          )}

          <div className="mt-6 flex gap-4">
            <button
              onClick={onVisIOkter}
              className="text-liten text-blekk-dempet hover:text-blekk"
            >
              Vis i <i>Økter</i> →
            </button>
            <button
              onClick={async () => {
                if (
                  !(await bekreft(
                    `Slette økta ${okt.fagKode} ${kortDag(okt.dato)}?`,
                  ))
                )
                  return;
                await slettOkt(okt.id);
                onEndret();
                onLukk();
              }}
              className="text-liten text-blekk-svak hover:text-feil"
            >
              Slett økta
            </button>
          </div>
        </div>

        <aside className="flex w-[300px] shrink-0 flex-col gap-[22px] overflow-auto border-l border-linje-medium bg-flate-svak/70 px-[22px] py-[18px]">
          <Forrige okt={okt} />
          <FolgOpp okt={okt} skolearId={skolearId} />
          <Perioden okt={okt} periode={periode} fagOkter={fagOkter} />
        </aside>
      </div>

      <Tastestripe klasse="shrink-0 justify-start gap-4 px-[22px]">
        <Tasthint taster={[tast("⌘"), "←", "→"]}>forrige / neste økt</Tasthint>
        <Tasthint taster={["↵"]}>
          {enkel ? "ny linje" : "ny aktivitet"}
        </Tasthint>
        <Tasthint taster={[tast("⌥"), "↑", "↓"]}>
          {enkel ? "flytt linje" : "flytt aktivitet"}
        </Tasthint>
        <span className="ml-auto">
          <Tasthint taster={["esc"]}>lukk, alt er lagret</Tasthint>
        </span>
      </Tastestripe>
    </>
  );
}

// ------------------------------------------------------------------- fakta

function Fakta({
  okt,
  enkel,
  onLagre,
}: {
  okt: Okt;
  enkel: boolean;
  onLagre: (felt: Parameters<typeof endreOkt>[1]) => Promise<void>;
}) {
  const [perioder, setPerioder] = useState<Periode[]>([]);
  useEffect(() => {
    void hentPerioder(okt.skolearFagId).then(setPerioder);
  }, [okt.skolearFagId]);
  const slutt = okt.klokkeslett
    ? sluttKlokke(okt.klokkeslett, okt.varighetMin)
    : "";

  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
      <Rad etikett="Dato">
        <input
          type="date"
          defaultValue={okt.dato}
          key={okt.dato}
          onBlur={(e) =>
            e.target.value &&
            e.target.value !== okt.dato &&
            void onLagre({ dato: e.target.value })
          }
          className={`${felt} tabular-nums`}
        />
      </Rad>
      <Rad etikett="Tid">
        <span
          className={`${felt} inline-flex items-center gap-1 tabular-nums focus-within:shadow-[inset_0_0_0_1.5px_var(--color-aksent)]`}
        >
          <input
            type="time"
            defaultValue={okt.klokkeslett ?? ""}
            key={`s${okt.klokkeslett}`}
            onBlur={(e) =>
              void onLagre({ klokkeslett: e.target.value || null })
            }
            className="w-[54px] bg-transparent outline-none"
          />
          –
          <input
            type="time"
            defaultValue={slutt}
            key={`e${slutt}`}
            disabled={!okt.klokkeslett}
            onBlur={(e) => {
              if (!okt.klokkeslett || !e.target.value) return;
              const min = tilMin(e.target.value) - tilMin(okt.klokkeslett);
              if (min > 0 && min !== okt.varighetMin)
                void onLagre({ varighet_min: min });
            }}
            className="w-[54px] bg-transparent outline-none disabled:text-blekk-svak"
          />
        </span>
      </Rad>
      <Rad etikett="Rom">
        <input
          defaultValue={okt.sted ?? ""}
          key={okt.sted ?? ""}
          placeholder="–"
          onBlur={(e) => void onLagre({ sted: e.target.value.trim() || null })}
          className={`${felt} w-[100px]`}
        />
      </Rad>
      <Rad etikett="Periode">
        <Velger
          etikett="Periode"
          verdi={okt.periodeId ?? ""}
          settVerdi={async (v) => {
            await fargelegg([okt.id], v || null);
            void onLagre({});
          }}
          valg={[
            { verdi: "", tekst: "Ingen periode", dempet: true },
            ...perioder.map((p) => ({
              verdi: p.id,
              tekst: p.navn,
              farge: p.farge,
            })),
          ]}
        />
      </Rad>
      {!enkel && (
        <Rad etikett="Vurdering">
          <Vurdering okt={okt} onEndret={() => void onLagre({})} />
        </Rad>
      )}
    </div>
  );
}

function Vurdering({ okt, onEndret }: { okt: Okt; onEndret: () => void }) {
  const [valg, setValg] = useState<Vurderingsvalg[]>([]);
  const ark = useArk();
  const last = () => void hentVurderingsvalg(okt.skolearFagId).then(setValg);
  useEffect(last, [okt.skolearFagId, okt.id]);
  useEffect(() => lyttVurderinger(last), [okt.skolearFagId, okt.id]);
  const her = valg.filter((v) => v.oktIder.includes(okt.id));
  const andre = valg.filter((v) => !v.oktIder.includes(okt.id));

  async function koble(id: string, pa: boolean) {
    if (pa) await knyttOkt(id, okt.id);
    else await losOkt(id, okt.id);
    last();
    onEndret();
  }

  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
      {her.map((v) => (
        <span
          key={v.id}
          className="inline-flex h-8 items-center gap-1.5 rounded-[7px] bg-[color-mix(in_srgb,var(--color-aksent)_7%,var(--color-ark))] px-2.5 text-[calc(13.5px*var(--tekst-skala))]"
        >
          <button
            onClick={() => ark.apneVurdering(v.id)}
            className="max-w-[220px] truncate hover:underline"
          >
            {v.tittel}
          </button>
          <button
            onClick={() => void koble(v.id, false)}
            title="Løs fra økta"
            className="text-blekk-svak hover:text-blekk"
          >
            ×
          </button>
        </span>
      ))}
      {andre.length > 0 ? (
        <Velger
          etikett="Knytt til vurdering"
          verdi=""
          plassholder={her.length ? "+" : "+ Knytt til"}
          settVerdi={(v) => void koble(v, true)}
          valg={andre.map((v) => ({ verdi: v.id, tekst: v.tittel }))}
        />
      ) : (
        her.length === 0 && (
          <span className="flex h-8 items-center text-[calc(13.5px*var(--tekst-skala))] text-blekk-svak">
            Ingen vurderinger i faget
          </span>
        )
      )}
    </span>
  );
}

function Kopier({ okt }: { okt: Okt }) {
  const [kopiert, setKopiert] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(teamstekst(okt));
        setKopiert(true);
        setTimeout(() => setKopiert(false), 1500);
      }}
      className="mt-1 text-[calc(12px*var(--tekst-skala))] text-blekk-svak hover:text-blekk"
    >
      {kopiert ? "Kopiert" : "Kopier til Teams"}
    </button>
  );
}

// ----------------------------------------------------------- kompetansemål

/**
 * Kompetansemålene i økta (11.5): fagets mål med avkrysning, periodens mål
 * merket med en prikk, og valgte mål i full farge. Fag uten Udir-kode får
 * et fritekstfelt.
 */
function Mal({
  okt,
  periode,
  enkel,
}: {
  okt: Okt;
  periode: Periode | null;
  /** Enkel: foldet til én linje til den åpnes */
  enkel: boolean;
}) {
  const [apen, setApen] = useState(false);
  // Prikken for periodens mål har periodens farge.
  const farge = periode?.farge ?? "var(--color-aksent)";
  const [mal, setMal] = useState<Oktmal | null>(null);
  const [liste, setListe] = useState<Kompetansemaal[]>([]);
  const [laereplan, setLaereplan] = useState<string | null>(null);
  const [visAlle, setVisAlle] = useState(false);
  const last = () => void hentOktmal(okt.id).then(setMal);
  useEffect(last, [okt.id, okt.periodeId]);
  useEffect(() => {
    if (!mal?.grepKode) return;
    void finnFag(mal.grepKode).then((f) => {
      setListe(f?.kompetansemaal ?? []);
      setLaereplan(f?.laereplan ?? null);
    });
  }, [mal?.grepKode]);

  if (!mal) return null;

  if (!mal.grepKode)
    return (
      <section className="mt-6">
        <Tekstfelt
          etikett="Kompetansemål i økta"
          hint="faget har ingen Udir-kode"
          verdi={mal.fritekst}
          plassholder="Skriv målet her"
          onLagre={async (v) => {
            await endreOkt(okt.id, { kompetansemal: v });
            last();
          }}
        />
      </section>
    );

  const valgt = new Set(mal.egne);
  const periodens = new Set(mal.fraPeriode);
  const udir = laereplan ? `udir.no/lk20/${laereplan.toLowerCase()}` : null;
  // Foldet sammen: bare valgte mål og periodens mål (15.4). Resten ligger
  // bak «Vis alle», så planen ikke drukner.
  const synlige = visAlle
    ? liste
    : liste.filter((k) => valgt.has(k.kode) || periodens.has(k.kode));

  if (enkel && !apen)
    return (
      <button
        onClick={() => setApen(true)}
        className="mt-6 flex items-baseline gap-2 text-left"
      >
        <span className="text-[12px] text-blekk-svak">▸</span>
        <span className="text-[calc(15px*var(--tekst-skala))] font-semibold">
          Kompetansemål
        </span>
        <span className="text-[calc(12px*var(--tekst-skala))] text-blekk-svak">
          {valgt.size} valgt
        </span>
      </button>
    );

  return (
    <section className="mt-7">
      <div className="mb-1.5 flex items-baseline gap-2.5">
        <h2 className="text-[calc(15px*var(--tekst-skala))] font-semibold">
          Kompetansemål
        </h2>
        <span className="text-[calc(12px*var(--tekst-skala))] text-blekk-svak">
          {valgt.size} valgt
          {periodens.size > 0 && (
            <>
              {" · "}
              <span style={{ color: farge }}>●</span> periodens mål
            </>
          )}
        </span>
        <span className="ml-auto flex items-baseline gap-4">
          {udir && visAlle && (
            <button
              onClick={() =>
                void import("@tauri-apps/plugin-opener").then((o) =>
                  o.openUrl(`https://www.${udir}`),
                )
              }
              className="text-[calc(12.5px*var(--tekst-skala))] text-blekk-svak hover:text-blekk hover:underline"
            >
              {udir} →
            </button>
          )}
          {liste.length > synlige.length || visAlle ? (
            <button
              onClick={() => setVisAlle(!visAlle)}
              className="text-[calc(12.5px*var(--tekst-skala))] text-aksent hover:underline"
            >
              {visAlle ? "Vis færre ▴" : `Vis alle ${liste.length} ▾`}
            </button>
          ) : null}
        </span>
      </div>
      {synlige.length === 0 && (
        <p className="py-1 text-[calc(13px*var(--tekst-skala))] text-blekk-svak">
          Ingen mål valgt for økta.
        </p>
      )}
      {synlige.map((k) => {
        const pa = valgt.has(k.kode);
        const fraPeriode = periodens.has(k.kode);
        const nr = liste.indexOf(k) + 1;
        return (
          <label
            key={k.kode}
            className="grid min-h-[30px] cursor-pointer grid-cols-[18px_14px_22px_minmax(0,1fr)] items-center gap-x-2 text-[calc(13px*var(--tekst-skala))]"
          >
            <input
              type="checkbox"
              checked={pa}
              onChange={async (e) => {
                await settOktmal(okt.id, k.kode, e.target.checked);
                last();
              }}
              className="accent-[var(--color-aksent)]"
            />
            <span className="text-[10px]" style={{ color: farge }}>
              {fraPeriode ? "●" : ""}
            </span>
            <span className="tabular-nums text-blekk-dempet">{nr}</span>
            <span
              title={k.tekst}
              className={`truncate ${pa ? "text-blekk" : "text-blekk-dempet"}`}
            >
              {k.tekst}
            </span>
          </label>
        );
      })}
    </section>
  );
}

// ------------------------------------------------------------------- høyre

function Forrige({ okt }: { okt: Okt }) {
  const [forrige, setForrige] =
    useState<Awaited<ReturnType<typeof hentForrigeOkt>>>(null);
  const ark = useArk();
  useEffect(() => {
    void hentForrigeOkt(okt).then(setForrige);
  }, [okt.id, okt.dato, okt.klokkeslett]);
  if (!forrige) return null;
  return (
    <div>
      <button
        onClick={() => ark.apneOkt(forrige.id)}
        className="mb-1.5 block text-left text-[calc(13px*var(--tekst-skala))] font-semibold hover:underline"
      >
        Fra forrige økt
        <span className="font-normal text-blekk-svak">
          {" "}
          · {kortDag(forrige.dato)}
        </span>
      </button>
      {forrige.logg?.trim() ? (
        <div className="text-[calc(13.5px*var(--tekst-skala))]">
          <Markdown tekst={forrige.logg} />
        </div>
      ) : (
        <p className="text-liten text-blekk-svak">
          Du skrev ikke noe notat forrige økt.
        </p>
      )}
    </div>
  );
}

/**
 * «Følg opp i økta»: rød to ganger på rad, borte sist, eller et åpent
 * oppfølgingspunkt. Bare fornavn, og aldri hva punktet gjelder — økta kan
 * stå på skjerm i klasserommet (§4.7).
 */
function FolgOpp({ okt, skolearId }: { okt: Okt; skolearId: string }) {
  const [liste, setListe] = useState<Oppfolging[]>([]);
  const [elever, setElever] = useState<Map<string, OktElev>>(new Map());
  const ark = useArk();
  useEffect(() => {
    let avbrutt = false;
    void Promise.all([
      hentOktrader(skolearId),
      hentApneOppfolginger(skolearId),
      hentOktElever(okt.id, okt.skolearFagId),
    ]).then(([rader, apne, e]: [Oktrad[], { elevId: string }[], OktElev[]]) => {
      if (avbrutt) return;
      setListe(
        folgOpp(rader, okt, new Set(apne.map((a) => a.elevId))).slice(0, 6),
      );
      setElever(new Map(e.map((x) => [x.elevId, x])));
    });
    return () => {
      avbrutt = true;
    };
  }, [okt.id, okt.dato, okt.skolearFagId, skolearId]);

  return (
    <div>
      <h3 className="mb-1.5 text-[calc(13px*var(--tekst-skala))] font-semibold">
        Følg opp i økta
      </h3>
      {liste.length === 0 ? (
        <p className="text-liten text-blekk-svak">
          Ingen å følge opp fra forrige gang.
        </p>
      ) : (
        liste.map((o) => {
          const e = elever.get(o.elevId);
          if (!e) return null;
          return (
            <button
              key={o.elevId}
              onClick={() => ark.apneElev(o.elevId)}
              className="flex w-full items-center gap-2 py-[3px] text-left text-[calc(13px*var(--tekst-skala))] hover:underline"
            >
              <span
                className="h-[7px] w-[7px] shrink-0 rounded-full"
                style={{
                  background:
                    o.grunn === "rod"
                      ? "var(--color-lys-rod)"
                      : o.grunn === "borte"
                        ? "var(--color-lys-borte)"
                        : "var(--color-aksent)",
                }}
              />
              <span className="truncate">
                {e.fornavn}:{" "}
                {o.grunn === "rod"
                  ? "rød to ganger på rad"
                  : o.grunn === "borte"
                    ? "borte sist"
                    : "åpent oppfølgingspunkt"}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}

function Perioden({
  okt,
  periode,
  fagOkter,
}: {
  okt: Okt;
  periode: Periode | null;
  fagOkter: Okt[];
}) {
  const p = iPerioden(okt, fagOkter);
  if (!periode || !p) return null;
  const idag = dagensDato();
  const farge = periode.farge ?? "var(--color-aksent)";
  return (
    <div>
      <h3 className="mb-1.5 text-[calc(13px*var(--tekst-skala))] font-semibold">
        Perioden
      </h3>
      <p className="text-[calc(13px*var(--tekst-skala))]">
        {periode.navn} · økt {p.nr} av {p.av}
      </p>
      <div className="mt-2 flex gap-[3px]">
        {p.okter.map((o) => (
          <span
            key={o.id}
            title={`${kortDag(o.dato)}${o.tema ? ` · ${o.tema}` : ""}`}
            className="h-1.5 flex-1 rounded-[2px]"
            style={{
              background:
                o.id === okt.id
                  ? "var(--color-aksent)"
                  : o.dato < idag
                    ? farge
                    : `color-mix(in srgb, ${farge} 18%, transparent)`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------- deler

function Rad({ etikett, children }: { etikett: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-[5px] text-[calc(13.5px*var(--tekst-skala))]">
      <span className="text-[calc(12px*var(--tekst-skala))] text-blekk-dempet">
        {etikett}
      </span>
      {children}
    </div>
  );
}

function Tekstfelt({
  etikett,
  hint,
  verdi,
  plassholder,
  onLagre,
}: {
  etikett: string;
  hint?: string;
  verdi: string | null;
  plassholder: string;
  onLagre: (v: string | null) => void | Promise<void>;
}) {
  return (
    <label className="block">
      <span className="mb-[5px] block text-[calc(12px*var(--tekst-skala))] text-blekk-dempet">
        {etikett}
        {hint && <span className="text-blekk-svak"> · {hint}</span>}
      </span>
      <input
        defaultValue={verdi ?? ""}
        key={verdi ?? ""}
        placeholder={plassholder}
        onBlur={(e) => {
          const v = e.target.value.trim() || null;
          if (v !== verdi) void onLagre(v);
        }}
        className={`${felt} w-full text-[calc(13.5px*var(--tekst-skala))] placeholder:text-blekk-svak`}
      />
    </label>
  );
}

/** Feltene i faktaraden: samme høyde og kant som nedtrekksmenyen. */
const felt =
  "h-8 min-w-0 rounded-[7px] bg-ark px-2.5 shadow-[inset_0_0_0_1px_var(--color-linje)] outline-none focus:shadow-[inset_0_0_0_1.5px_var(--color-aksent)]";

function tilMin(kl: string): number {
  const [t, m] = kl.split(":").map(Number);
  return t * 60 + m;
}

function sluttKlokke(kl: string, min: number): string {
  const tot = tilMin(kl) + min;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(tot / 60) % 24)}:${p(tot % 60)}`;
}
