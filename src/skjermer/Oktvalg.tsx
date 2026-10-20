import { useEffect, useRef, useState, type ReactNode } from "react";
import { confirm as bekreft } from "@tauri-apps/plugin-dialog";
import {
  endreOkt,
  gjenopprettOkter,
  slettOkter,
  slettetekst,
  type Okt,
} from "../data/okter";
import { fargelegg, type Periode } from "../data/perioder";
import {
  hentVurderingsvalg,
  knyttOkt,
  losOkt,
  type Vurderingsvalg,
} from "../data/vurderinger";
import { leggTilAngring } from "../ui/angre";
import { Flervalgslinje, Linjeknapp } from "../ui/Flervalg";
import { visToast } from "../ui/Toast";
import { harModifikator } from "../ui/taster";
import { Vurderingsikon, vurderingsvalg } from "../ui/Vurderingsikon";

/**
 * Det man kan gjøre med flere økter på en gang (ARBEIDSLISTE 16.3, lerretet
 * OktListeMasse): Periode (P) · Tid og rom (T) · Lekse (L) · Vurdering (V) ·
 * Flytt … · Slett. Alt bekreftes med en toast og kan angres (⌘Z).
 */

const n = (antall: number) => (antall === 1 ? "1 økt" : `${antall} økter`);

/**
 * Setter perioden på øktene og legger igjen en angring. Brukes både av
 * linja og av periodebrikka i raden (16.2).
 */
export async function settPeriodeMedAngre(
  okter: Okt[],
  periodeId: string | null,
  navn: string | null,
  etter: () => void,
): Promise<void> {
  if (okter.length === 0) return;
  const for_ = okter.map((o) => [o.id, o.periodeId] as const);
  await fargelegg(
    okter.map((o) => o.id),
    periodeId,
  );
  etter();
  const tekst =
    okter.length > 1
      ? periodeId
        ? `Periode satt på ${n(okter.length)}`
        : `Periode fjernet fra ${n(okter.length)}`
      : `Periode: ${navn ?? "ingen"}`;
  const angring = {
    tekst,
    angre: async () => {
      // Tilbake til det hver økt hadde, gruppert så hver periode settes én gang.
      const perVerdi = new Map<string | null, string[]>();
      for (const [id, p] of for_)
        perVerdi.set(p, [...(perVerdi.get(p) ?? []), id]);
      for (const [p, ider] of perVerdi) await fargelegg(ider, p);
      etter();
    },
  };
  leggTilAngring(angring);
  visToast(tekst, { angring });
}

type Apen = "periode" | "tid" | "lekse" | "vurdering" | "flytt" | null;

export function Oktvalg({
  valgte,
  perioder,
  onEndret,
  onTom,
}: {
  valgte: Okt[];
  /** alle periodene i året; de som passer faget, filtreres her */
  perioder: Periode[];
  onEndret: () => void;
  onTom: () => void;
}) {
  const [apen, setApen] = useState<Apen>(null);
  const fagene = new Set(valgte.map((o) => o.skolearFagId));
  const etFag = fagene.size === 1 ? [...fagene][0] : null;
  const egne = perioder.filter((p) => p.skolearFagId === etFag);
  const [vurderinger, setVurderinger] = useState<Vurderingsvalg[]>([]);
  useEffect(() => {
    if (etFag) void hentVurderingsvalg(etFag).then(setVurderinger);
    else setVurderinger([]);
  }, [etFag]);
  useEffect(() => {
    if (valgte.length === 0) setApen(null);
  }, [valgte.length]);

  // P · T · L · V åpner valgene, ikke mens man skriver.
  useEffect(() => {
    if (valgte.length === 0) return;
    const tast = (e: KeyboardEvent) => {
      if (harModifikator(e) || e.altKey) return;
      const mal = e.target as HTMLElement;
      if (mal.closest?.("input, textarea, select, [contenteditable]")) return;
      const k = { p: "periode", t: "tid", l: "lekse", v: "vurdering" }[
        e.key.toLowerCase()
      ] as Apen | undefined;
      if (!k) return;
      e.preventDefault();
      setApen((a) => (a === k ? null : k));
    };
    window.addEventListener("keydown", tast);
    return () => window.removeEventListener("keydown", tast);
  }, [valgte.length]);

  /** Endrer felter på alle, og legger igjen en angring med det de hadde. */
  async function endreAlle(
    tekst: string,
    felter: (o: Okt) => Parameters<typeof endreOkt>[1],
    tilbake: (o: Okt) => Parameters<typeof endreOkt>[1],
  ) {
    const for_ = [...valgte];
    for (const o of for_) await endreOkt(o.id, felter(o));
    setApen(null);
    onEndret();
    const angring = {
      tekst,
      angre: async () => {
        for (const o of for_) await endreOkt(o.id, tilbake(o));
        onEndret();
      },
    };
    leggTilAngring(angring);
    visToast(tekst, { angring });
  }

  async function slett() {
    if (!(await bekreft(slettetekst(valgte)))) return;
    const ider = valgte.map((o) => o.id);
    await slettOkter(ider);
    onTom();
    onEndret();
    const tekst = `${n(ider.length)} slettet`;
    const angring = {
      tekst,
      angre: async () => {
        await gjenopprettOkter(ider);
        onEndret();
      },
    };
    leggTilAngring(angring);
    visToast(tekst, { angring });
  }

  const knapp = (k: Exclude<Apen, null>, tekst: string, tast?: string) => (
    <Linjeknapp
      tast={tast}
      apen={apen === k}
      onKlikk={() => setApen(apen === k ? null : k)}
    >
      {tekst}
    </Linjeknapp>
  );

  return (
    <Flervalgslinje antall={valgte.length} hva={["økt", "økter"]} onTom={onTom}>
      <span className="relative">
        {knapp("periode", "Periode", "P")}
        {apen === "periode" && (
          <Sprett onLukk={() => setApen(null)}>
            {etFag ? (
              <>
                <p className="menygruppe">Sett periode på {n(valgte.length)}</p>
                {[
                  { id: null, navn: "Ingen periode", farge: null },
                  ...egne,
                ].map((p) => (
                  <button
                    key={p.id ?? "ingen"}
                    onClick={() => {
                      setApen(null);
                      void settPeriodeMedAngre(
                        valgte,
                        p.id,
                        p.id ? p.navn : null,
                        onEndret,
                      );
                    }}
                    className={`menyrad hover:bg-flate ${p.id ? "" : "text-blekk-dempet"}`}
                  >
                    <span
                      className="h-[7px] w-[7px] flex-none rounded-full"
                      style={{ background: p.farge ?? "transparent" }}
                    />
                    {p.navn}
                  </button>
                ))}
              </>
            ) : (
              <p className="menyrad text-blekk-dempet">
                Velg økter i ett fag for å sette periode.
              </p>
            )}
          </Sprett>
        )}
      </span>

      <span className="relative">
        {knapp("tid", "Tid og rom", "T")}
        {apen === "tid" && (
          <Sprett onLukk={() => setApen(null)}>
            <Tidogrom
              antall={valgte.length}
              onBruk={(kl, min, rom) =>
                void endreAlle(
                  `Tid og rom satt på ${n(valgte.length)}`,
                  () => ({
                    ...(kl !== null ? { klokkeslett: kl } : {}),
                    ...(min !== null ? { varighet_min: min } : {}),
                    ...(rom !== null ? { sted: rom } : {}),
                  }),
                  (o) => ({
                    klokkeslett: o.klokkeslett,
                    varighet_min: o.varighetMin,
                    sted: o.sted,
                  }),
                )
              }
            />
          </Sprett>
        )}
      </span>

      <span className="relative">
        {knapp("lekse", "Lekse", "L")}
        {apen === "lekse" && (
          <Sprett onLukk={() => setApen(null)}>
            <Enlinje
              etikett={`Lekse på ${n(valgte.length)}`}
              plassholder="Hva elevene skal ha gjort"
              onBruk={(lekse) =>
                void endreAlle(
                  `Lekse satt på ${n(valgte.length)}`,
                  () => ({ lekse: lekse || null }),
                  (o) => ({ lekse: o.lekse }),
                )
              }
            />
          </Sprett>
        )}
      </span>

      <span className="relative">
        {knapp("vurdering", "Vurdering", "V")}
        {apen === "vurdering" && (
          <Sprett onLukk={() => setApen(null)}>
            {!etFag ? (
              <p className="menyrad text-blekk-dempet">
                Velg økter i ett fag for å knytte en vurdering.
              </p>
            ) : vurderinger.length === 0 ? (
              <p className="menyrad text-blekk-dempet">
                Ingen vurderinger i faget ennå.
              </p>
            ) : (
              <>
                <p className="menygruppe">Knytt {n(valgte.length)} til</p>
                {vurderinger.map((v) => (
                  <button
                    key={v.id}
                    onClick={async () => {
                      setApen(null);
                      const nye = valgte.filter(
                        (o) => !v.oktIder.includes(o.id),
                      );
                      for (const o of nye) await knyttOkt(v.id, o.id);
                      onEndret();
                      const tekst = `${n(valgte.length)} knyttet til «${v.tittel}»`;
                      const angring = {
                        tekst,
                        angre: async () => {
                          for (const o of nye) await losOkt(v.id, o.id);
                          onEndret();
                        },
                      };
                      leggTilAngring(angring);
                      visToast(tekst, { angring });
                    }}
                    className="menyrad hover:bg-flate"
                  >
                    <Vurderingsikon type={v.type} />
                    <span className="min-w-0 truncate">{v.tittel}</span>
                    {vurderingsvalg(v).hint && (
                      <span className="menyrad-hint">
                        {vurderingsvalg(v).hint}
                      </span>
                    )}
                  </button>
                ))}
              </>
            )}
          </Sprett>
        )}
      </span>

      <span className="relative">
        <Linjeknapp
          apen={apen === "flytt"}
          onKlikk={() => setApen(apen === "flytt" ? null : "flytt")}
        >
          Flytt …
        </Linjeknapp>
        {apen === "flytt" && (
          <Sprett onLukk={() => setApen(null)}>
            <Flytt
              antall={valgte.length}
              onBruk={(dager) => {
                const om = (d: string, x: number) => {
                  const t = new Date(`${d}T12:00:00`);
                  t.setDate(t.getDate() + x);
                  return t.toLocaleDateString("sv-SE");
                };
                const hvor =
                  Math.abs(dager) % 7 === 0
                    ? `${Math.abs(dager) / 7} ${Math.abs(dager) === 7 ? "uke" : "uker"}`
                    : `${Math.abs(dager)} ${Math.abs(dager) === 1 ? "dag" : "dager"}`;
                void endreAlle(
                  `${n(valgte.length)} flyttet ${hvor} ${dager > 0 ? "fram" : "tilbake"}`,
                  (o) => ({ dato: om(o.dato, dager) }),
                  (o) => ({ dato: o.dato }),
                );
              }}
            />
          </Sprett>
        )}
      </span>

      <span className="mx-1 h-5 w-px bg-white/20" />
      <Linjeknapp fare onKlikk={() => void slett()}>
        Slett
      </Linjeknapp>
    </Flervalgslinje>
  );
}

/** Et lite glassvindu over knappen i linja. Lukkes av esc og klikk utenfor. */
function Sprett({
  children,
  onLukk,
}: {
  children: ReactNode;
  onLukk: () => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const ut = (e: MouseEvent) => {
      const t = e.target as Node;
      // Knappen som åpnet, lukker selv.
      if (el.current?.parentElement?.contains(t)) return;
      onLukk();
    };
    const tast = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onLukk();
    };
    window.addEventListener("mousedown", ut);
    window.addEventListener("keydown", tast, true);
    return () => {
      window.removeEventListener("mousedown", ut);
      window.removeEventListener("keydown", tast, true);
    };
  }, [onLukk]);
  return (
    <div
      ref={el}
      className="glass-meny absolute bottom-[calc(100%+10px)] left-0 w-64 whitespace-normal rounded-[14px] p-[5px] text-blekk"
    >
      {children}
    </div>
  );
}

function Tidogrom({
  antall,
  onBruk,
}: {
  antall: number;
  /** null: feltet er tomt og endres ikke */
  onBruk: (kl: string | null, min: number | null, rom: string | null) => void;
}) {
  const [fra, setFra] = useState("");
  const [til, setTil] = useState("");
  const [rom, setRom] = useState("");
  const tilMin = (k: string) => {
    const [t, m] = k.split(":").map(Number);
    return t * 60 + m;
  };
  const min = fra && til ? tilMin(til) - tilMin(fra) : null;
  const bruk = () =>
    onBruk(fra || null, min && min > 0 ? min : null, rom.trim() || null);
  return (
    <div className="space-y-2 p-2">
      <p className="text-[calc(12px*var(--tekst-skala))] text-blekk-dempet">
        På {n(antall)}. Tomme felter endres ikke.
      </p>
      <div className="flex items-center gap-1.5 tabular-nums">
        <input
          type="time"
          autoFocus
          value={fra}
          onChange={(e) => setFra(e.target.value)}
          className="h-8 rounded-[7px] bg-ark px-2 shadow-[inset_0_0_0_1px_var(--color-linje)] outline-none"
        />
        –
        <input
          type="time"
          value={til}
          onChange={(e) => setTil(e.target.value)}
          className="h-8 rounded-[7px] bg-ark px-2 shadow-[inset_0_0_0_1px_var(--color-linje)] outline-none"
        />
      </div>
      <input
        value={rom}
        onChange={(e) => setRom(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && bruk()}
        placeholder="Rom"
        className="h-8 w-full rounded-[7px] bg-ark px-2 shadow-[inset_0_0_0_1px_var(--color-linje)] outline-none"
      />
      <button
        onClick={bruk}
        disabled={!fra && !rom.trim()}
        className="h-8 w-full rounded-full bg-aksent text-ark disabled:opacity-40"
      >
        Bruk
      </button>
    </div>
  );
}

function Enlinje({
  etikett,
  plassholder,
  onBruk,
}: {
  etikett: string;
  plassholder: string;
  onBruk: (v: string) => void;
}) {
  const [v, setV] = useState("");
  return (
    <div className="space-y-2 p-2">
      <p className="text-[calc(12px*var(--tekst-skala))] text-blekk-dempet">
        {etikett}
      </p>
      <input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onBruk(v.trim())}
        placeholder={plassholder}
        className="h-8 w-full rounded-[7px] bg-ark px-2 shadow-[inset_0_0_0_1px_var(--color-linje)] outline-none"
      />
      <button
        onClick={() => onBruk(v.trim())}
        className="h-8 w-full rounded-full bg-aksent text-ark"
      >
        Bruk
      </button>
    </div>
  );
}

function Flytt({
  antall,
  onBruk,
}: {
  antall: number;
  onBruk: (dager: number) => void;
}) {
  const [tall, setTall] = useState(1);
  const [enhet, setEnhet] = useState<1 | 7>(7);
  const knapp = (retning: 1 | -1, tekst: string) => (
    <button
      onClick={() => onBruk(retning * tall * enhet)}
      disabled={tall < 1}
      className="h-8 flex-1 rounded-full bg-aksent text-ark disabled:opacity-40"
    >
      {tekst}
    </button>
  );
  return (
    <div className="space-y-2 p-2">
      <p className="text-[calc(12px*var(--tekst-skala))] text-blekk-dempet">
        Flytt {n(antall)}. Tid og rom står.
      </p>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={1}
          autoFocus
          value={tall}
          onChange={(e) => setTall(Math.max(0, Number(e.target.value)))}
          className="h-8 w-16 rounded-[7px] bg-ark px-2 tabular-nums shadow-[inset_0_0_0_1px_var(--color-linje)] outline-none"
        />
        <button
          onClick={() => setEnhet(1)}
          className={`h-8 rounded-full px-3 ${enhet === 1 ? "bg-valgt font-medium" : "hover:bg-flate"}`}
        >
          dager
        </button>
        <button
          onClick={() => setEnhet(7)}
          className={`h-8 rounded-full px-3 ${enhet === 7 ? "bg-valgt font-medium" : "hover:bg-flate"}`}
        >
          uker
        </button>
      </div>
      <div className="flex gap-1.5">
        {knapp(-1, "Tilbake")}
        {knapp(1, "Fram")}
      </div>
    </div>
  );
}
