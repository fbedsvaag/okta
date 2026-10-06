import { useEffect, useRef, useState } from "react";
import { Elevfoto } from "../ui/Elevfoto";
import { Fagfirkant, Ikon } from "../ui/felles";
import { Utfold } from "../ui/Utfold";
import { Tastestripe, Tasthint } from "../ui/Tastestripe";
import { Markdown, Markdownfelt } from "../ui/Notattekst";
import { useArk } from "../ui/Arkstabel";
import { lyttVurderinger } from "../data/endringer";
import {
  hentOktmal,
  hentPerioder,
  settOktmal,
  type Oktmal,
  type Periode,
} from "../data/perioder";
import { Malvelger } from "./Malvelger";
import { confirm as bekreft } from "@tauri-apps/plugin-dialog";
import {
  endreOkt,
  hentForrigeOkt,
  fjernSkaring,
  hentOktElever,
  hentSkaringsskala,
  settSkaring,
  settSkaringsnotat,
  slettOkt,
  teamstekst,
  type Okt,
  type OktElev,
} from "../data/okter";
import { taster, type Skalaverdi } from "../skala";
import { fagfarge, skalafarge } from "../ui/farger";
import {
  hentVurderingsvalg,
  knyttOkt,
  losOkt,
  type Vurderingsvalg,
} from "../data/vurderinger";

/**
 * Økta som ark, SPEC §4.4 og DESIGN.md §10 (lerretet «OktArk»).
 *
 * Et ark over skjermen du kom fra, ikke full skjerm. Topp med fag, tittel og
 * «Pågår · n min igjen»; elevlista med skåringen til venstre; fra forrige
 * økt, planen og øktloggen til høyre; tastene i en stripe nederst. Esc
 * lukker og alt er lagret, ⌘↵ = Ferdig. Øktas øvrige felter står bak
 * «Detaljer».
 *
 * Her skårer du. Tastene utledes av skalaen (§5), ikke hardkodet.
 */
export function OktPanel({
  okt,
  onLukk,
  onEndret,
  onApneElev,
  onVisIOkter,
}: {
  okt: Okt;
  onLukk: () => void;
  onEndret: () => void;
  onApneElev: (elevId: string) => void;
  onVisIOkter: () => void;
}) {
  // Eleven som nettopp fikk en verdi: prikken hans «popper» (DESIGN.md §8).
  const [sistSatt, setSistSatt] = useState<string | null>(null);
  const [detaljer, setDetaljer] = useState(false);
  const [periode, setPeriode] = useState<Periode | null>(null);
  useEffect(() => {
    if (!okt.periodeId) return setPeriode(null);
    void hentPerioder(okt.skolearFagId).then((p) =>
      setPeriode(p.find((x) => x.id === okt.periodeId) ?? null),
    );
  }, [okt.periodeId, okt.skolearFagId]);
  // «Pågår · n min igjen», oppdatert hvert halve minutt.
  const [na, setNa] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNa(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  const pagar = minIgjen(okt, na);

  // ⌘↵ = Ferdig, også fra et felt i arket.
  useEffect(() => {
    const tast = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onLukk();
      }
    };
    window.addEventListener("keydown", tast);
    return () => window.removeEventListener("keydown", tast);
  }, [onLukk]);
  const [elever, setElever] = useState<OktElev[]>([]);
  const [verdier, setVerdier] = useState<Skalaverdi[]>([]);
  const [markert, setMarkert] = useState(0);
  const [notatFor, setNotatFor] = useState<string | null>(null);
  const liste = useRef<HTMLDivElement>(null);
  const markertRad = useRef<HTMLDivElement>(null);

  /**
   * Ruller den markerte raden inn i synsfeltet.
   *
   * `block: "nearest"` gjør at det bare skjer når raden faktisk er utenfor —
   * står den midt på skjermen, rører ingenting seg. Det er forskjellen på en
   * rolig liste og en som hopper ved hvert tastetrykk.
   *
   * Myk rulling med mindre systemet ber om mindre bevegelse. Skåringen kan gå
   * fort, og en animasjon som ikke rekker å bli ferdig før neste tastetrykk
   * skal avbrytes, ikke stables opp.
   */
  useEffect(() => {
    const rad = markertRad.current;
    if (!rad) return;
    const rolig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rad.scrollIntoView({
      block: "nearest",
      behavior: rolig ? "auto" : "smooth",
    });
  }, [markert]);

  useEffect(() => {
    let avbrutt = false;
    (async () => {
      const [e, v] = await Promise.all([
        hentOktElever(okt.id, okt.skolearFagId),
        hentSkaringsskala(okt.skolearFagId),
      ]);
      if (avbrutt) return;
      setElever(e);
      setVerdier(v);
      setMarkert(0);
      liste.current?.focus();
    })();
    return () => {
      avbrutt = true;
    };
  }, [okt.id, okt.skolearFagId]);

  const tastekart = taster(verdier);
  /**
   * Plottet har fast rekkefølge (DESIGN.md §9): verdiene stigende, og
   * «ingenting her» (rang 0) til slutt — rød · gul · grønn · ikke i økta.
   * Formen bærer ikke betydningen lenger, så plassen må gjøre det.
   */
  const plott = [...verdier].sort(
    (a, b) =>
      (a.rang === 0 ? 1 : 0) - (b.rang === 0 ? 1 : 0) || a.rang - b.rang,
  );
  /** tast -> skalaverdi, slik at 0–3 slår opp riktig verdi for denne skalaen */
  const fraTast = new Map(
    verdier.map((v) => [tastekart.get(v.id) ?? "", v] as const),
  );

  /** Økta er avholdt så snart minst én elev er skåret (§3.3). */
  const avholdt = elever.some((e) => e.skalaverdiId !== null);
  const nullverdi = verdier.find((v) => v.rang === 0) ?? null;
  const antallSkaret = elever.filter((e) => e.skalaverdiId !== null).length;

  async function skaar(indeks: number, verdi: Skalaverdi) {
    const elev = elever[indeks];
    if (!elev) return;

    setElever((f) =>
      f.map((e, i) => (i === indeks ? { ...e, skalaverdiId: verdi.id } : e)),
    );
    setSistSatt(elev.elevId);
    setMarkert(Math.min(indeks + 1, elever.length - 1));

    await settSkaring(elev.elevId, okt.id, verdi.id);
    onEndret();
  }

  async function fjern(indeks: number) {
    const elev = elever[indeks];
    if (!elev) return;

    // Ingen bekreftelse her, med vilje. ⌫ ligger midt i skåringsflyten, og
    // et spørsmål per tastetrykk ville ødelagt hele poenget. Handlingen er
    // ett tastetrykk å gjenta, og raden viser med en gang hva som skjedde.
    setElever((f) =>
      f.map((e, i) => (i === indeks ? { ...e, skalaverdiId: null } : e)),
    );
    await fjernSkaring(elev.elevId, okt.id);
    onEndret();
  }

  function tastetrykk(e: React.KeyboardEvent) {
    if (notatFor !== null) return;
    // ⌘-snarveiene (⌘K søk, ⌘[ tilbake) hører til appen, ikke lista.
    if (e.metaKey || e.ctrlKey) return;

    if (e.key === "Escape") {
      onLukk();
      return;
    }
    if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      setMarkert((i) => Math.min(i + 1, elever.length - 1));
      return;
    }
    if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
      e.preventDefault();
      setMarkert((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      void fjern(markert);
      return;
    }
    if (e.key.toLowerCase() === "n") {
      e.preventDefault();
      setNotatFor(elever[markert]?.elevId ?? null);
      return;
    }

    const verdi = fraTast.get(e.key);
    if (verdi) {
      e.preventDefault();
      void skaar(markert, verdi);
    }
  }

  return (
    <section
      aria-label={`Økt: ${okt.tema || okt.fagNavn}`}
      className="flex h-full min-h-0 flex-col"
    >
      <header className="shrink-0 border-b border-linje-medium px-[26px] pb-4 pt-5">
        <div className="flex min-w-0 items-center gap-3">
          <Fagfirkant farge={okt.farge} storrelse={12} />
          <span
            className="shrink-0 text-[calc(15px*var(--tekst-skala))] font-semibold"
            style={{ color: okt.farge ? fagfarge(okt.farge) : undefined }}
          >
            {okt.fagKode}
          </span>
          <h1 className="min-w-0 truncate text-[calc(28px*var(--tekst-skala))] font-light leading-tight tracking-overskrift">
            {okt.tema || okt.fagNavn}
          </h1>
          <span className="flex-1" />
          {pagar !== null && (
            <span className="inline-flex shrink-0 items-center gap-[7px] rounded-full bg-flate px-2.5 py-1 text-[calc(12.5px*var(--tekst-skala))] font-medium text-aksent">
              <span className="puls h-[7px] w-[7px] rounded-full bg-aksent" />
              Pågår · {pagar} min igjen
            </span>
          )}
          <button
            onClick={() => setDetaljer((d) => !d)}
            aria-expanded={detaljer}
            className="shrink-0 rounded-full px-2.5 py-1 text-liten text-blekk-dempet hover:bg-flate hover:text-blekk"
          >
            Detaljer
          </button>
          <span className="shrink-0 rounded-full bg-flate px-2 py-0.5 text-etikett text-blekk-dempet">
            esc
          </span>
          <button
            onClick={onLukk}
            className="flex h-8 shrink-0 items-center gap-2 rounded-full bg-aksent px-3.5 text-brod font-medium text-ark hover:bg-aksent-mork"
          >
            Ferdig <span className="text-etikett opacity-70">⌘↵</span>
          </button>
        </div>
        <p className="ml-[24px] mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[calc(13px*var(--tekst-skala))] text-blekk-dempet">
          <span className="first-letter:uppercase">{langDato(okt.dato)}</span>
          {okt.klokkeslett && (
            <>
              ·
              <span className="tabular-nums">
                {okt.klokkeslett}–
                {sluttKlokke(okt.klokkeslett, okt.varighetMin)}
              </span>
            </>
          )}
          {okt.sted && (
            <>
              ·{" "}
              <span>{/^\d/.test(okt.sted) ? `Rom ${okt.sted}` : okt.sted}</span>
            </>
          )}
          {periode && (
            <>
              ·
              <span className="inline-flex items-center gap-[5px]">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    background: periode.farge ?? "var(--color-linje-sterk)",
                  }}
                />
                {periode.navn}
              </span>
            </>
          )}
        </p>
      </header>

      {/*
        Øktas øvrige felter — dato, tid, tema, rom, agenda, lekse, mål og
        vurdering — står bak «Detaljer», så arket er skåringen først.
      */}
      <Utfold apen={detaljer}>
        <div className="max-h-[45vh] overflow-y-auto border-b border-linje-medium bg-flate-svak">
          <OktFelter okt={okt} onEndret={onEndret} />
          <div className="flex gap-4 px-5 pb-3">
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
                    `Slette økta ${okt.fagKode} ${langDato(okt.dato)}?`,
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
      </Utfold>

      <div className="flex min-h-0 flex-1">
        <div
          ref={liste}
          tabIndex={0}
          onKeyDown={tastetrykk}
          aria-label="Elevliste — skår med talltastene"
          className="uten-fokusring min-w-0 flex-1 overflow-auto px-[22px] pt-3 outline-none"
        >
          <div className="flex items-center gap-3 border-b border-linje pb-2.5">
            <span className="text-[calc(13px*var(--tekst-skala))] font-semibold">
              Elever
            </span>
            {/* Fremdrift, ikke statistikk (DESIGN.md §12): hvor mange som er skåret. */}
            <span className="text-etikett tabular-nums text-blekk-dempet">
              {antallSkaret} av {elever.length} skåret
            </span>
            <span className="h-1 w-[120px] overflow-hidden rounded-sm bg-stripe">
              <span
                className="block h-full rounded-sm bg-aksent transition-[width] duration-[var(--tid-inn)]"
                style={{
                  width: `${elever.length ? (antallSkaret / elever.length) * 100 : 0}%`,
                }}
              />
            </span>
            <span className="ml-auto text-etikett text-blekk-svak">
              Alfabetisk på fornavn
            </span>
          </div>

          {elever.length === 0 && (
            <p className="px-5 py-6 text-center text-brod text-blekk-dempet">
              Ingen elever er koblet til {okt.fagKode} ennå. Legg dem inn under
              Elever, så dukker de opp her — også i økter som allerede er
              skåret.
            </p>
          )}

          <div className="relative">
            {/*
              Markøren er én flate som glir til neste elev (DESIGN.md §8),
              ikke en bakgrunn som hopper. Skåringen venter aldri på den.
            */}
            {elever.length > 0 && (
              <div
                aria-hidden
                className="markor-flate pointer-events-none absolute inset-x-0 top-0 z-0 h-[38px] rounded-lg"
                style={{ transform: `translateY(${markert * RAD}px)` }}
              />
            )}
            {elever.map((elev, i) => (
              <ElevRad
                key={elev.elevId}
                elev={elev}
                verdier={plott}
                tastekart={tastekart}
                markert={i === markert}
                radRef={i === markert ? markertRad : undefined}
                avholdt={avholdt}
                nullverdi={nullverdi}
                pop={sistSatt === elev.elevId}
                onKlikk={() => {
                  setMarkert(i);
                  liste.current?.focus();
                }}
                onVelg={(v) => skaar(i, v)}
                onNotat={() => setNotatFor(elev.elevId)}
                skriverNotat={notatFor === elev.elevId}
                onNotatFerdig={async (tekst) => {
                  if (tekst !== null) {
                    await settSkaringsnotat(elev.elevId, okt.id, tekst);
                    setElever((f) =>
                      f.map((e) =>
                        e.elevId === elev.elevId
                          ? { ...e, notat: tekst.trim() || null }
                          : e,
                      ),
                    );
                  }
                  setNotatFor(null);
                  liste.current?.focus();
                }}
                onApneElev={() => onApneElev(elev.elevId)}
              />
            ))}
          </div>
          <div className="h-4" />
        </div>

        <aside className="flex w-80 shrink-0 flex-col gap-[22px] overflow-auto border-l border-linje-medium bg-flate-svak/70 px-[22px] py-[18px]">
          <Forrigenotat okt={okt} />
          <div>
            <p className="mb-2 text-etikett font-semibold text-blekk">Plan</p>
            {/* Avkrysning i planen lagres med en gang. */}
            <Markdownfelt
              key={`plan-${okt.id}`}
              verdi={okt.plan}
              minRader={3}
              plassholder="- [ ] Det du skal gjennom i økta"
              onLagre={async (v) => {
                await endreOkt(okt.id, { plan: v });
                onEndret();
              }}
            />
          </div>
          <div className="flex min-h-[200px] flex-1 flex-col">
            <p className="mb-2 text-etikett font-semibold text-blekk">
              Øktlogg
            </p>
            <Markdownfelt
              key={`logg-${okt.id}`}
              verdi={okt.logg}
              minRader={6}
              plassholder="Hvordan gikk det? - [ ] blir et gjøremål på I dag."
              onLagre={async (v) => {
                await endreOkt(okt.id, { logg: v });
                onEndret();
              }}
            />
          </div>
        </aside>
      </div>

      <Tastestripe klasse="shrink-0 justify-start gap-4 px-[22px]">
        <Tasthint
          taster={plott
            .filter((v) => v.rang > 0)
            .map((v) => tastekart.get(v.id) ?? "")}
        >
          {plott
            .filter((v) => v.rang > 0)
            .map((v) => v.kode.toLowerCase())
            .join(" · ")}
        </Tasthint>
        {nullverdi && (
          <Tasthint taster={[tastekart.get(nullverdi.id) ?? "0"]}>
            {nullverdi.kode.toLowerCase()}
          </Tasthint>
        )}
        <Tasthint taster={["↑", "↓"]}>flytt</Tasthint>
        <Tasthint taster={["N"]}>notat</Tasthint>
        <Tasthint taster={["⌫"]}>fjern</Tasthint>
        <span className="ml-auto">
          <Tasthint taster={["esc"]}>lukk — alt er lagret</Tasthint>
        </span>
      </Tastestripe>
    </section>
  );
}

/** Radhøyden i skåringslista (DESIGN.md §3: 38 px med 28 px bilde). */
const RAD = 38;

function sluttKlokke(kl: string, min: number): string {
  const [t, m] = kl.split(":").map(Number);
  const tot = t * 60 + m + min;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(tot / 60) % 24)}:${p(tot % 60)}`;
}

function ElevRad({
  elev,
  verdier,
  tastekart,
  markert,
  radRef,
  avholdt,
  nullverdi,
  pop,
  onKlikk,
  onVelg,
  onNotat,
  skriverNotat,
  onNotatFerdig,
  onApneElev,
}: {
  elev: OktElev;
  verdier: Skalaverdi[];
  tastekart: Map<string, string>;
  markert: boolean;
  /** settes bare på den markerte raden, så autoscrollen vet hvor den er */
  radRef?: React.RefObject<HTMLDivElement | null>;
  avholdt: boolean;
  nullverdi: Skalaverdi | null;
  /** verdien ble nettopp satt: prikken «popper» */
  pop: boolean;
  onKlikk: () => void;
  onVelg: (v: Skalaverdi) => void;
  onNotat: () => void;
  /** notatfeltet er åpent i denne raden (N) */
  skriverNotat: boolean;
  /** null = avbrutt */
  onNotatFerdig: (tekst: string | null) => void;
  onApneElev: () => void;
}) {
  // Er økta avholdt, har alle en verdi. De du ikke har trykket på er 0 (§3.3).
  const visesSom =
    elev.skalaverdiId ?? (avholdt ? (nullverdi?.id ?? null) : null);
  const eksplisitt = elev.skalaverdiId !== null;

  return (
    <div
      ref={radRef}
      onClick={onKlikk}
      // 38 px rader med 28 px bilde (DESIGN.md §3, bestemt 06.10). Høyden
      // er låst, så heller ikke notatfeltet i raden kan gjøre den høyere.
      className="group relative z-[1] grid h-[38px] cursor-default grid-cols-[28px_minmax(150px,220px)_44px_minmax(0,1fr)_132px] items-center gap-x-3 border-b border-linje-svak pl-2.5 text-[calc(13.5px*var(--tekst-skala))] hover:bg-[color-mix(in_srgb,var(--color-aksent)_3.5%,transparent)]"
    >
      <Elevfoto elevId={elev.elevId} storrelse={28} />
      <button
        onClick={(e) => {
          e.stopPropagation();
          onApneElev();
        }}
        title={`${elev.fornavn} ${elev.etternavn} — åpne eleven`}
        className={`truncate text-left hover:text-aksent ${
          eksplisitt || markert ? "font-medium" : "text-blekk-dempet"
        }`}
      >
        {elev.fornavn} {elev.etternavn}
      </button>

      <span className="truncate text-etikett text-blekk-dempet">
        {elev.klasse ?? ""}
      </span>

      {/*
        Notatet fra denne økta, i egen kolonne. N åpner feltet rett i raden.
        Står markøren på en elev uten notat, vises forrige notat i grått —
        det man skrev sist er ofte det man trenger å huske nå.
      */}
      {skriverNotat ? (
        <Notatfelt start={elev.notat ?? ""} onFerdig={onNotatFerdig} />
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNotat();
          }}
          title={
            elev.notat ??
            (elev.forrigeNotat
              ? `Forrige økt: ${elev.forrigeNotat}`
              : "Legg til notat (N)")
          }
          className="min-w-0 truncate text-left text-[calc(12.5px*var(--tekst-skala))]"
        >
          {elev.notat ? (
            <span className="text-blekk">{elev.notat}</span>
          ) : markert && elev.forrigeNotat ? (
            <span className="italic text-blekk-svak">{elev.forrigeNotat}</span>
          ) : (
            <span className="text-blekk-svakest opacity-0 group-hover:opacity-100">
              + notat
            </span>
          )}
        </button>
      )}

      <div className="flex justify-end gap-1">
        {verdier.map((v) => (
          <Merke
            key={v.id}
            verdi={v}
            valgt={visesSom === v.id}
            eksplisitt={eksplisitt}
            pop={pop && visesSom === v.id}
            tast={tastekart.get(v.id)}
            onVelg={(e) => {
              e.stopPropagation();
              onVelg(v);
            }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Helfylt sirkel i verdiens farge (DESIGN.md §9). Valgt verdi står i full
 * styrke, de andre er nesten usynlige. En verdi som nettopp ble satt,
 * «popper» kort (§8). En verdi som bare er fylt ut ved visning — eleven
 * er ikke trykket på — tegnes som ikke skåret: ingenting valgt.
 */
function Merke({
  verdi,
  valgt,
  eksplisitt,
  pop,
  tast,
  onVelg,
}: {
  verdi: Skalaverdi;
  valgt: boolean;
  eksplisitt: boolean;
  pop: boolean;
  tast?: string;
  onVelg: (e: React.MouseEvent) => void;
}) {
  const farge = skalafarge(verdi.farge);
  const pa = valgt && eksplisitt;

  return (
    <button
      onClick={onVelg}
      title={`${tast ? `${tast} — ` : ""}${verdi.kode}${verdi.etikett ? `: ${verdi.etikett}` : ""}`}
      className={`grid h-6 w-7 place-items-center rounded-md ${
        pa ? "" : "opacity-20 hover:bg-bord hover:opacity-70"
      }`}
    >
      <span
        className={`block rounded-full ${pa ? "h-[15px] w-[15px]" : "h-[13px] w-[13px]"} ${
          pa && pop ? "pop" : ""
        }`}
        style={{ background: farge }}
      />
    </button>
  );
}

function OktFelter({ okt, onEndret }: { okt: Okt; onEndret: () => void }) {
  const [kopiert, setKopiert] = useState(false);

  return (
    <div className="space-y-2 px-5 py-3">
      <div className="flex gap-2">
        <Linje etikett="Dato">
          <input
            type="date"
            defaultValue={okt.dato}
            key={okt.dato}
            onBlur={async (e) => {
              if (e.target.value && e.target.value !== okt.dato) {
                await endreOkt(okt.id, { dato: e.target.value });
                onEndret();
              }
            }}
            className={feltStil}
          />
        </Linje>
        <Linje etikett="Klokkeslett">
          <input
            type="time"
            defaultValue={okt.klokkeslett ?? ""}
            key={okt.klokkeslett ?? ""}
            onBlur={async (e) => {
              await endreOkt(okt.id, { klokkeslett: e.target.value || null });
              onEndret();
            }}
            className={feltStil}
          />
        </Linje>
        <Linje etikett="Varighet">
          <input
            type="number"
            defaultValue={okt.varighetMin}
            key={okt.varighetMin}
            onBlur={async (e) => {
              const n = Number(e.target.value);
              if (n > 0 && n !== okt.varighetMin) {
                await endreOkt(okt.id, { varighet_min: Math.round(n) });
                onEndret();
              }
            }}
            className={feltStil}
          />
        </Linje>
      </div>

      <Linje etikett="Tema">
        <input
          defaultValue={okt.tema ?? ""}
          key={okt.tema ?? ""}
          placeholder="Hva handler økta om?"
          onBlur={async (e) => {
            await endreOkt(okt.id, { tema: e.target.value.trim() || null });
            onEndret();
          }}
          className={feltStil}
        />
      </Linje>

      {/* Fylles ut fra fagets standard rom (Fag-panelet). */}
      <Linje etikett="Rom">
        <input
          defaultValue={okt.sted ?? ""}
          key={okt.sted ?? ""}
          placeholder="Romnummer, sal, ute"
          onBlur={async (e) => {
            await endreOkt(okt.id, { sted: e.target.value.trim() || null });
            onEndret();
          }}
          className={feltStil}
        />
      </Linje>

      {/*
        Agenda er skrevet for eleven og går ut i kalenderen som kommentar.
        Plan og øktlogg lenger ned er lærerens egne notater og går aldri ut.
      */}
      <Linje etikett="Agenda">
        <textarea
          defaultValue={okt.agenda ?? ""}
          key={okt.agenda ?? ""}
          rows={2}
          placeholder="Kort om økta — dette ser elevene i kalenderen"
          onBlur={async (e) => {
            await endreOkt(okt.id, { agenda: e.target.value.trim() || null });
            onEndret();
          }}
          className={feltStil}
        />
        {/*
          Kopien tar med akkurat det agendaen allerede er ment for — det
          eleven skal se. Plan og øktlogg blir igjen her.
        */}
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(teamstekst(okt));
            setKopiert(true);
            setTimeout(() => setKopiert(false), 1500);
          }}
          className="mt-1 text-liten text-blekk-svak hover:text-blekk"
        >
          {kopiert ? (
            <>
              <Ikon navn="hake" /> Kopiert
            </>
          ) : (
            "Kopier til Teams"
          )}
        </button>
      </Linje>

      {/* Lekse står på årsplanarket og i Teams-kopien, aldri i kalenderen. */}
      <Linje etikett="Lekse">
        <textarea
          defaultValue={okt.lekse ?? ""}
          key={okt.lekse ?? ""}
          rows={1}
          placeholder="Til denne økta — står på årsplanen"
          onBlur={async (e) => {
            await endreOkt(okt.id, { lekse: e.target.value.trim() || null });
            onEndret();
          }}
          className={feltStil}
        />
      </Linje>

      <Kompetansemal okt={okt} />

      <Vurderingskobling okt={okt} onEndret={onEndret} />

      {/*
        Plan er tatt ut av panelet — tema, agenda og lekse dekker det som
        trengs. Feltet vises bare der det allerede står noe, så ingenting
        som er skrevet blir borte.
      */}
      {/* Planen står i høyre spalte, med avkrysning. */}
    </div>
  );
}

/**
 * Kompetansemålene økta tar for seg. Målene perioden dekker, står huket av
 * av seg selv; her legges det økta tar for seg i tillegg. Fag uten Udir-kode
 * har ingen liste å velge fra, og får et fritekstfelt i stedet.
 */
function Kompetansemal({ okt }: { okt: Okt }) {
  const [mal, setMal] = useState<Oktmal | null>(null);
  const last = () => void hentOktmal(okt.id).then(setMal);
  useEffect(last, [okt.id, okt.periodeId]);

  if (!mal) return null;

  if (!mal.grepKode) {
    return (
      <Linje etikett="Kompetansemål">
        <textarea
          defaultValue={mal.fritekst ?? ""}
          key={mal.fritekst ?? ""}
          rows={1}
          placeholder="Faget har ingen Udir-kode — skriv målet her"
          onBlur={async (e) => {
            await endreOkt(okt.id, {
              kompetansemal: e.target.value.trim() || null,
            });
            last();
          }}
          className={feltStil}
        />
      </Linje>
    );
  }

  return (
    <div>
      <Malvelger
        grepKode={mal.grepKode}
        valgte={mal.egne}
        arvet={
          mal.periodeNavn
            ? { koder: mal.fraPeriode, fra: mal.periodeNavn }
            : undefined
        }
        dekketAndreSteder={mal.dekketAndreSteder}
        onBytt={async (kode, pa) => {
          await settOktmal(okt.id, kode, pa);
          last();
        }}
      />
    </div>
  );
}

/**
 * Vurderingene som holdes i økta, med mulighet til å knytte flere eller løse
 * dem. Står på årsplanen i Vurdering-kolonnen.
 *
 * Ikke en <label> som de andre linjene: den har flere knapper i seg, og et
 * klikk på en label sendes videre til første kontroll inni.
 */
function Vurderingskobling({
  okt,
  onEndret,
}: {
  okt: Okt;
  onEndret: () => void;
}) {
  const [valg, setValg] = useState<Vurderingsvalg[]>([]);
  const ark = useArk();
  const last = () => void hentVurderingsvalg(okt.skolearFagId).then(setValg);
  useEffect(last, [okt.skolearFagId, okt.id]);
  useEffect(() => lyttVurderinger(last), [okt.skolearFagId, okt.id]);

  const her = valg.filter((v) => v.oktIder.includes(okt.id));
  const andre = valg.filter((v) => !v.oktIder.includes(okt.id));

  async function koble(vurderingId: string, pa: boolean) {
    if (pa) await knyttOkt(vurderingId, okt.id);
    else await losOkt(vurderingId, okt.id);
    last();
    onEndret();
  }

  return (
    <div>
      <span className="mb-0.5 block text-etikett uppercase tracking-etikett text-blekk-dempet">
        Vurdering
      </span>
      {her.map((v) => (
        <div key={v.id} className="flex items-baseline gap-2 text-brod">
          <button
            onClick={() => ark.apneVurdering(v.id)}
            className="min-w-0 flex-1 truncate text-left hover:text-aksent hover:underline"
          >
            {v.tittel}
          </button>
          <button
            onClick={() => void koble(v.id, false)}
            className="shrink-0 text-liten text-blekk-svak hover:text-blekk"
          >
            Løs fra økta
          </button>
        </div>
      ))}
      {andre.length > 0 ? (
        <select
          value=""
          onChange={(e) => e.target.value && void koble(e.target.value, true)}
          className={`${feltStil} ${her.length > 0 ? "mt-1" : ""}`}
        >
          <option value="">
            {her.length > 0 ? "Knytt enda en …" : "Knytt en vurdering …"}
          </option>
          {andre.map((v) => (
            <option key={v.id} value={v.id}>
              {v.tittel}
              {v.oktIder.length > 0
                ? ` (står også på ${v.oktIder.length} ${v.oktIder.length === 1 ? "annen økt" : "andre økter"})`
                : ""}
            </option>
          ))}
        </select>
      ) : (
        her.length === 0 && (
          <p className="text-liten text-blekk-svak">
            Ingen vurderinger i faget ennå.
          </p>
        )
      )}
    </div>
  );
}

/**
 * Det du skrev i loggen forrige gang i faget, rett over dagens logg — så
 * beskjeden fra sist står der du er når timen begynner.
 */
function Forrigenotat({ okt }: { okt: Okt }) {
  const [forrige, setForrige] = useState<Awaited<
    ReturnType<typeof hentForrigeOkt>
  > | null>(null);
  const ark = useArk();
  useEffect(() => {
    void hentForrigeOkt(okt).then(setForrige);
  }, [okt.id, okt.dato, okt.klokkeslett]);

  if (!forrige) return null;

  return (
    <div className="mb-3">
      <button
        onClick={() => ark.apneOkt(forrige.id)}
        className="mb-0.5 block text-etikett uppercase tracking-etikett text-blekk-dempet hover:text-blekk"
      >
        Notat fra forrige økt · {langDato(forrige.dato)}
      </button>
      {forrige.logg?.trim() ? (
        <div className="rounded-vanlig border-l-2 border-linje-sterk bg-flate-svak px-3 py-1.5 text-blekk-dempet">
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
 * Notatfeltet i raden. Én linje, samme høyde som raden: Enter lagrer, Esc
 * angrer. Tom tekst fjerner notatet.
 */
function Notatfelt({
  start,
  onFerdig,
}: {
  start: string;
  onFerdig: (tekst: string | null) => void;
}) {
  const [tekst, setTekst] = useState(start);
  // Esc og Enter flytter fokus tilbake til lista, og da mister feltet
  // fokus. Uten vakta ville blur-en lagre teksten man nettopp angret.
  const ferdig = useRef(false);
  const avslutt = (t: string | null) => {
    if (ferdig.current) return;
    ferdig.current = true;
    onFerdig(t);
  };
  return (
    <input
      autoFocus
      value={tekst}
      placeholder="Notat — Enter lagrer, Esc angrer"
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setTekst(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") avslutt(null);
        if (e.key === "Enter") avslutt(tekst);
      }}
      onBlur={() => avslutt(tekst)}
      className="h-5 min-w-0 flex-1 rounded-vanlig border border-aksent bg-ark px-1.5 text-liten outline-none placeholder:text-blekk-svak"
    />
  );
}

const feltStil =
  "w-full rounded border border-linje bg-ark px-2 py-1 text-brod tabular-nums outline-none placeholder:text-blekk-svak focus:border-aksent";

function Linje({
  etikett,
  children,
}: {
  etikett: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block w-full">
      <span className="mb-0.5 block text-etikett uppercase tracking-etikett text-blekk-dempet">
        {etikett}
      </span>
      {children}
    </label>
  );
}

export function langDato(dato: string): string {
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Minutter igjen av økta, når den pågår nå; ellers null. */
function minIgjen(okt: Okt, na: Date): number | null {
  if (!okt.klokkeslett) return null;
  const idag = `${na.getFullYear()}-${String(na.getMonth() + 1).padStart(2, "0")}-${String(na.getDate()).padStart(2, "0")}`;
  if (okt.dato !== idag) return null;
  const [t, m] = okt.klokkeslett.split(":").map(Number);
  const start = t * 60 + m;
  const naMin = na.getHours() * 60 + na.getMinutes();
  const slutt = start + okt.varighetMin;
  return naMin >= start && naMin < slutt ? slutt - naMin : null;
}
