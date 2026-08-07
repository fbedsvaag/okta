import { useEffect, useRef, useState } from "react";
import {
  endreOkt,
  fjernSkaring,
  hentOktElever,
  hentSkaringsskala,
  settSkaring,
  settSkaringsnotat,
  slettOkt,
  type Okt,
  type OktElev,
} from "../data/okter";
import { taster, type Skalaverdi } from "../skala";
import { skalafarge } from "../ui/farger";
import { hentPerioder, periodeFor, type Periode } from "../data/perioder";

/**
 * Det utvidede viewet, SPEC §4.2 og §4.4.
 *
 * Panelet glir inn fra høyre og dekker to tredeler. Lista blir stående til
 * venstre, så du ser hvor du er. Øktas egne felter øverst, elevlista i midten,
 * øktlogg nederst — alt på ett sted, ingen ny side.
 *
 * Her skårer du. Tastene utledes av skalaen (§5), ikke hardkodet.
 */
export function OktPanel({
  okt,
  onLukk,
  onEndret,
  onApneElev,
}: {
  okt: Okt;
  onLukk: () => void;
  onEndret: () => void;
  onApneElev: (elevId: string) => void;
}) {
  const [elever, setElever] = useState<OktElev[]>([]);
  const [verdier, setVerdier] = useState<Skalaverdi[]>([]);
  const [markert, setMarkert] = useState(0);
  const [notatFor, setNotatFor] = useState<string | null>(null);
  const [perioder, setPerioder] = useState<Periode[]>([]);
  const liste = useRef<HTMLDivElement>(null);

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
      setPerioder(await hentPerioder(okt.skolearFagId));
      setMarkert(0);
      liste.current?.focus();
    })();
    return () => {
      avbrutt = true;
    };
  }, [okt.id, okt.skolearFagId]);

  const tastekart = taster(verdier);
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
    setMarkert(Math.min(indeks + 1, elever.length - 1));

    await settSkaring(elev.elevId, okt.id, verdi.id);
    onEndret();
  }

  async function fjern(indeks: number) {
    const elev = elever[indeks];
    if (!elev) return;

    setElever((f) =>
      f.map((e, i) => (i === indeks ? { ...e, skalaverdiId: null } : e)),
    );
    await fjernSkaring(elev.elevId, okt.id);
    onEndret();
  }

  function tastetrykk(e: React.KeyboardEvent) {
    if (notatFor !== null) return;

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
    <aside className="flex h-full flex-col border-l border-neutral-300 bg-white">
      <header className="flex items-baseline gap-3 border-b border-neutral-200 px-5 py-3">
        <span
          aria-hidden
          className="h-3.5 w-[3px] rounded-full"
          style={{ background: okt.farge ?? "var(--color-na-fagstrek)" }}
        />
        <span className="text-[13px] font-semibold">{okt.fagKode}</span>
        <span className="text-[13px] text-neutral-600">{langDato(okt.dato)}</span>
        <span className="font-mono text-[11px] text-neutral-400">{okt.kode}</span>
        <button
          onClick={onLukk}
          className="ml-auto text-[12px] text-neutral-400 hover:text-neutral-900"
        >
          Lukk (Esc)
        </button>
      </header>

      <div className="overflow-y-auto">
        <OktFelter okt={okt} perioder={perioder} onEndret={onEndret} />

        <div className="flex items-baseline justify-between border-y border-neutral-200 bg-neutral-50 px-5 py-1.5">
          <span className="text-[11px] uppercase tracking-wide text-neutral-500">
            Elever
          </span>
          <span className="text-[12px] tabular-nums text-neutral-500">
            {antallSkaret} av {elever.length} skåret
          </span>
        </div>

        <div
          ref={liste}
          tabIndex={0}
          onKeyDown={tastetrykk}
          className="outline-none"
        >
          {elever.length === 0 && (
            <p className="px-5 py-6 text-center text-[13px] text-neutral-500">
              Ingen elever er koblet til {okt.fagKode} ennå. Legg dem inn under
              Elever, så dukker de opp her — også i økter som allerede er skåret.
            </p>
          )}

          {elever.map((elev, i) => (
            <ElevRad
              key={elev.elevId}
              elev={elev}
              verdier={verdier}
              tastekart={tastekart}
              markert={i === markert}
              avholdt={avholdt}
              nullverdi={nullverdi}
              onKlikk={() => {
                setMarkert(i);
                liste.current?.focus();
              }}
              onVelg={(v) => skaar(i, v)}
              onNotat={() => setNotatFor(elev.elevId)}
              onApneElev={() => onApneElev(elev.elevId)}
            />
          ))}
        </div>

        <Logg okt={okt} onEndret={onEndret} />
      </div>

      {notatFor && (
        <Notat
          key={notatFor}
          elev={elever.find((e) => e.elevId === notatFor)!}
          oktId={okt.id}
          onLukk={async (tekst) => {
            if (tekst !== null) {
              await settSkaringsnotat(notatFor, okt.id, tekst);
              setElever((f) =>
                f.map((e) => (e.elevId === notatFor ? { ...e, notat: tekst } : e)),
              );
            }
            setNotatFor(null);
            liste.current?.focus();
          }}
        />
      )}
    </aside>
  );
}

function ElevRad({
  elev,
  verdier,
  tastekart,
  markert,
  avholdt,
  nullverdi,
  onKlikk,
  onVelg,
  onNotat,
  onApneElev,
}: {
  elev: OktElev;
  verdier: Skalaverdi[];
  tastekart: Map<string, string>;
  markert: boolean;
  avholdt: boolean;
  nullverdi: Skalaverdi | null;
  onKlikk: () => void;
  onVelg: (v: Skalaverdi) => void;
  onNotat: () => void;
  onApneElev: () => void;
}) {
  // Er økta avholdt, har alle en verdi. De du ikke har trykket på er 0 (§3.3).
  const visesSom = elev.skalaverdiId ?? (avholdt ? nullverdi?.id ?? null : null);
  const eksplisitt = elev.skalaverdiId !== null;

  return (
    <div
      onClick={onKlikk}
      className={`flex cursor-default items-center gap-2 border-b border-neutral-100 px-5 py-1 ${
        markert ? "bg-na-blaa-flate" : "hover:bg-neutral-50"
      }`}
    >
      <span className="w-3 text-[11px] text-na-blaa">{markert ? "▸" : ""}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onApneElev();
        }}
        title="Åpne eleven"
        className={`w-44 shrink-0 truncate text-left text-[13px] hover:text-na-blaa hover:underline ${
          eksplisitt ? "" : "text-neutral-500"
        }`}
      >
        {elev.fornavn} {elev.etternavn}
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onNotat();
        }}
        title={elev.notat ?? "Legg til notat (N)"}
        className={`flex-1 truncate text-left text-[12px] italic ${
          elev.notat
            ? "text-neutral-600 hover:text-neutral-900"
            : "text-neutral-300 hover:text-neutral-600"
        }`}
      >
        {elev.notat ?? "+ notat"}
      </button>

      <div className="flex gap-1">
        {verdier.map((v) => (
          <Merke
            key={v.id}
            verdi={v}
            valgt={visesSom === v.id}
            eksplisitt={eksplisitt}
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
 * Form i tillegg til farge (§13): fylt, halvfylt, tom. Skal være lesbart uten
 * fargesyn og på avstand.
 */
function Merke({
  verdi,
  valgt,
  eksplisitt,
  tast,
  onVelg,
}: {
  verdi: Skalaverdi;
  valgt: boolean;
  eksplisitt: boolean;
  tast?: string;
  onVelg: (e: React.MouseEvent) => void;
}) {
  const farge = skalafarge(verdi.farge);

  return (
    <button
      onClick={onVelg}
      title={`${tast ? `${tast} — ` : ""}${verdi.kode}${verdi.etikett ? `: ${verdi.etikett}` : ""}`}
      className="grid h-5 w-5 place-items-center rounded-sm hover:bg-neutral-200"
    >
      <span
        className="block h-3 w-3 rounded-full border-2"
        style={{
          borderColor: valgt ? farge : "var(--color-na-kant)",
          background: valgt ? (eksplisitt ? farge : "transparent") : "transparent",
          borderStyle: verdi.teller_ikke === 1 ? "dashed" : "solid",
        }}
      />
    </button>
  );
}

function OktFelter({
  okt,
  perioder,
  onEndret,
}: {
  okt: Okt;
  perioder: Periode[];
  onEndret: () => void;
}) {
  // Perioden følger datoen. Velger du en uttrykkelig, skrives periode_id og
  // den vinner — også hvis du senere flytter periodegrensene.
  const automatisk = periodeFor({ ...okt, periodeId: null }, perioder);

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

      <Linje etikett="Periode">
        <select
          value={okt.periodeId ?? ""}
          onChange={async (e) => {
            await endreOkt(okt.id, { periode_id: e.target.value || null });
            onEndret();
          }}
          className={feltStil}
        >
          <option value="">
            {automatisk
              ? `Automatisk etter dato — ${automatisk.navn}`
              : "Automatisk etter dato — ingen treff"}
          </option>
          {perioder.map((p) => (
            <option key={p.id} value={p.id}>
              {p.navn}
              {p.start && p.slutt ? ` (${p.start} – ${p.slutt})` : ""}
            </option>
          ))}
        </select>
      </Linje>

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

      <Linje etikett="Plan">
        <textarea
          defaultValue={okt.plan ?? ""}
          key={okt.plan ?? ""}
          rows={3}
          placeholder="Hva skal skje"
          onBlur={async (e) => {
            await endreOkt(okt.id, { plan: e.target.value.trim() || null });
            onEndret();
          }}
          className={feltStil}
        />
      </Linje>
    </div>
  );
}

function Logg({ okt, onEndret }: { okt: Okt; onEndret: () => void }) {
  return (
    <div className="px-5 py-3">
      <Linje etikett="Øktlogg">
        <textarea
          defaultValue={okt.logg ?? ""}
          key={okt.logg ?? ""}
          rows={2}
          placeholder="Hvordan gikk det med klassen samlet?"
          onBlur={async (e) => {
            await endreOkt(okt.id, { logg: e.target.value.trim() || null });
            onEndret();
          }}
          className={feltStil}
        />
      </Linje>

      <button
        onClick={async () => {
          if (!confirm(`Slette økta ${okt.fagKode} ${langDato(okt.dato)}?`)) return;
          await slettOkt(okt.id);
          onEndret();
        }}
        className="mt-4 text-[12px] text-neutral-400 hover:text-red-700"
      >
        Slett økta
      </button>
    </div>
  );
}

function Notat({
  elev,
  onLukk,
}: {
  elev: OktElev;
  oktId: string;
  onLukk: (tekst: string | null) => void;
}) {
  const [tekst, setTekst] = useState(elev.notat ?? "");

  return (
    <div className="border-t border-neutral-300 bg-neutral-50 px-5 py-3">
      <p className="mb-1 text-[11px] uppercase tracking-wide text-neutral-500">
        Notat · {elev.fornavn} {elev.etternavn}
      </p>
      <textarea
        autoFocus
        value={tekst}
        rows={2}
        onChange={(e) => setTekst(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onLukk(null);
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onLukk(tekst);
        }}
        className={feltStil}
      />
      <div className="mt-1 flex gap-3 text-[12px] text-neutral-500">
        <button onClick={() => onLukk(tekst)} className="hover:text-neutral-900">
          Lagre (⌘↵)
        </button>
        <button onClick={() => onLukk(null)} className="hover:text-neutral-900">
          Avbryt (Esc)
        </button>
      </div>
    </div>
  );
}

const feltStil =
  "w-full rounded border border-neutral-300 bg-white px-2 py-1 text-[13px] tabular-nums outline-none placeholder:text-neutral-400 focus:border-na-blaa";

function Linje({
  etikett,
  children,
}: {
  etikett: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block w-full">
      <span className="mb-0.5 block text-[11px] uppercase tracking-wide text-neutral-500">
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
