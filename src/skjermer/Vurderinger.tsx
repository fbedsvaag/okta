import { useEffect, useMemo, useState } from "react";
import {
  hentVurderinger,
  hentVurderingsskalaer,
  opprettVurdering,
  type Vurdering,
  type Vurderingstype,
} from "../data/vurderinger";
import type { FagIAr } from "../data/fag";
import type { Skala } from "../skala";
import { Felt, Knapp, Tomtilstand } from "../ui/felles";
import { VurderingPanel } from "./VurderingPanel";
import { ElevPanel } from "./ElevPanel";

/**
 * Vurderinger, SPEC §4.6.
 *
 * Egen skjerm, ikke en bolk inne i fagportalen. Grunnen er at de samme
 * vurderingene skal vises både under faget og under eleven — da må de bo
 * ett sted og lånes ut derfra.
 */
export function Vurderinger({
  skolearId,
  fag,
  onApneOkt,
}: {
  skolearId: string;
  fag: FagIAr[];
  onApneOkt: (oktId: string) => void;
}) {
  const [vurderinger, setVurderinger] = useState<Vurdering[]>([]);
  const [skalaer, setSkalaer] = useState<Skala[]>([]);
  const [valgt, setValgt] = useState<string | null>(null);
  const [filterFag, setFilterFag] = useState("");
  const [sok, setSok] = useState("");
  const [lagerNy, setLagerNy] = useState(false);
  const [valgtElev, setValgtElev] = useState<string | null>(null);

  async function last() {
    setVurderinger(await hentVurderinger(skolearId));
  }

  useEffect(() => {
    void last();
    void hentVurderingsskalaer().then(setSkalaer);
  }, [skolearId]);

  const synlige = useMemo(() => {
    const s = sok.trim().toLocaleLowerCase("nb-NO");
    return vurderinger.filter((v) => {
      if (filterFag && v.skolearFagId !== filterFag) return false;
      if (s && !v.tittel.toLocaleLowerCase("nb-NO").includes(s)) return false;
      return true;
    });
  }, [vurderinger, filterFag, sok]);

  const apen = vurderinger.find((v) => v.id === valgt) ?? null;

  return (
    <div className="flex h-full">
      <div className={`min-w-0 overflow-y-auto ${apen ? "hidden w-full pr-4 lg:block lg:w-1/3" : "w-full"}`}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Felt
            verdi={sok}
            settVerdi={setSok}
            plassholder="Søk i tittel"
            bredde={apen ? "w-full" : "w-56"}
          />
          <select
            value={filterFag}
            onChange={(e) => setFilterFag(e.target.value)}
            className="rounded border border-neutral-300 bg-white px-2 py-1.5 text-[13px]"
          >
            <option value="">Alle fag</option>
            {fag.map((f) => (
              <option key={f.id} value={f.id}>
                {f.kode}
              </option>
            ))}
          </select>
          <div className="ml-auto">
            <Knapp variant="primar" onClick={() => setLagerNy(true)}>
              + Ny vurdering
            </Knapp>
          </div>
        </div>

        {lagerNy && (
          <NyVurdering
            fag={fag}
            skalaer={skalaer}
            startFagId={filterFag || fag[0]?.id}
            onLagret={async (id) => {
              setLagerNy(false);
              await last();
              setValgt(id);
            }}
            onAvbryt={() => setLagerNy(false)}
          />
        )}

        {vurderinger.length === 0 && !lagerNy ? (
          <Tomtilstand
            tekst={
              fag.length === 0
                ? "Legg inn fagene dine først."
                : "Ingen vurderinger ennå — prøver, innleveringer og framlegg legges inn her."
            }
            handling={
              fag.length > 0 ? (
                <Knapp variant="primar" onClick={() => setLagerNy(true)}>
                  Ny vurdering
                </Knapp>
              ) : undefined
            }
          />
        ) : (
          <div className="border-t border-neutral-200">
            {synlige.map((v) => (
              <Rad
                key={v.id}
                vurdering={v}
                valgt={valgt === v.id}
                kompakt={apen !== null}
                onVelg={() => setValgt(v.id)}
              />
            ))}
          </div>
        )}

        {vurderinger.length > 0 && (
          <p className="mt-3 text-[12px] text-neutral-500">
            {synlige.length} av {vurderinger.length} vurderinger
          </p>
        )}
      </div>

      {apen && (
        <div className="min-w-0 w-full lg:w-2/3">
          {valgtElev ? (
            // Elevportalen legger seg oppå vurderingen. Esc tar deg tilbake
            // til den du sto i, ikke helt ut.
            <ElevPanel
              key={valgtElev}
              elevId={valgtElev}
              aktivtSkolearId={skolearId}
              onLukk={() => setValgtElev(null)}
              onApneOkt={onApneOkt}
            />
          ) : (
            <VurderingPanel
              vurdering={apen}
              onLukk={() => setValgt(null)}
              onEndret={last}
              onApneElev={setValgtElev}
            />
          )}
        </div>
      )}
    </div>
  );
}

const TYPENAVN: Record<Vurderingstype, string> = {
  skriftlig: "Skriftlig",
  muntlig: "Muntlig",
  praktisk: "Praktisk",
};

function Rad({
  vurdering,
  valgt,
  kompakt,
  onVelg,
}: {
  vurdering: Vurdering;
  valgt: boolean;
  kompakt: boolean;
  onVelg: () => void;
}) {
  const passert =
    vurdering.frist !== null && vurdering.frist < iDag() && vurdering.fort === 0;

  return (
    <button
      onClick={onVelg}
      className={`flex w-full items-center gap-3 border-b border-neutral-100 px-2 py-1.5 text-left text-[13px] ${
        valgt ? "bg-[#eaf0f6]" : "hover:bg-neutral-50"
      }`}
    >
      <span
        aria-hidden
        className="h-3.5 w-[3px] shrink-0 rounded-full"
        style={{ background: vurdering.farge ?? "#c9c9c9" }}
      />
      <span className="w-12 shrink-0 font-medium">{vurdering.fagKode}</span>
      <span
        className={`w-24 shrink-0 tabular-nums ${
          passert ? "font-medium text-[#b3261e]" : "text-neutral-600"
        }`}
      >
        {vurdering.frist ? kortDato(vurdering.frist) : "ingen frist"}
      </span>
      <span className="flex-1 truncate">{vurdering.tittel}</span>
      {!kompakt && (
        <>
          <span className="w-20 shrink-0 text-neutral-500">
            {vurdering.type ? TYPENAVN[vurdering.type] : ""}
          </span>
          <span className="w-32 shrink-0 truncate text-neutral-400">
            {vurdering.skalaNavn}
          </span>
        </>
      )}
      <span className="w-14 shrink-0 text-right tabular-nums text-neutral-500">
        {vurdering.fort === 0
          ? "·"
          : vurdering.fort >= vurdering.elever
            ? "✓"
            : `${vurdering.fort}/${vurdering.elever}`}
      </span>
    </button>
  );
}

function NyVurdering({
  fag,
  skalaer,
  startFagId,
  onLagret,
  onAvbryt,
}: {
  fag: FagIAr[];
  skalaer: Skala[];
  startFagId?: string;
  onLagret: (id: string) => void;
  onAvbryt: () => void;
}) {
  const [fagId, setFagId] = useState(startFagId ?? fag[0]?.id ?? "");
  const [tittel, setTittel] = useState("");
  const [type, setType] = useState<Vurderingstype | "">("");
  const [frist, setFrist] = useState("");
  const [skalaId, setSkalaId] = useState("");

  const valgtSkala = skalaId || skalaer[0]?.id || "";

  async function lagre() {
    if (!fagId || tittel.trim() === "" || !valgtSkala) return;
    onLagret(
      await opprettVurdering(
        fagId,
        valgtSkala,
        tittel.trim(),
        type || null,
        frist || null,
      ),
    );
  }

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 border border-neutral-300 bg-neutral-50 p-3">
      <label className="block">
        <Etikett>Fag</Etikett>
        <select
          value={fagId}
          onChange={(e) => setFagId(e.target.value)}
          className={velgerStil}
        >
          {fag.map((f) => (
            <option key={f.id} value={f.id}>
              {f.kode}
            </option>
          ))}
        </select>
      </label>

      <Felt
        etikett="Tittel"
        verdi={tittel}
        settVerdi={setTittel}
        plassholder="Fagartikkel: markedsanalyse"
        bredde="w-72"
        autoFocus
        onEnter={lagre}
      />

      <label className="block">
        <Etikett>Type</Etikett>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as Vurderingstype | "")}
          className={velgerStil}
        >
          <option value="">—</option>
          <option value="skriftlig">Skriftlig</option>
          <option value="muntlig">Muntlig</option>
          <option value="praktisk">Praktisk</option>
        </select>
      </label>

      <Felt etikett="Frist" verdi={frist} settVerdi={setFrist} type="date" bredde="w-40" />

      <label className="block">
        <Etikett>Skala</Etikett>
        <select
          value={valgtSkala}
          onChange={(e) => setSkalaId(e.target.value)}
          className={velgerStil}
        >
          {skalaer.map((s) => (
            <option key={s.id} value={s.id}>
              {s.navn}
            </option>
          ))}
        </select>
      </label>

      <Knapp variant="primar" onClick={lagre} disabled={!fagId || tittel.trim() === ""}>
        Opprett
      </Knapp>
      <Knapp variant="stille" onClick={onAvbryt}>
        Avbryt
      </Knapp>
    </div>
  );
}

const velgerStil =
  "rounded border border-neutral-300 bg-white px-2 py-1.5 text-[13px]";

function Etikett({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-[11px] uppercase tracking-wide text-neutral-500">
      {children}
    </span>
  );
}

function iDag(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function kortDato(dato: string): string {
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}
