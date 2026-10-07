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
import {
  Fagfirkant,
  Felt,
  Ikon,
  Kappet,
  Knapp,
  Tomtilstand,
} from "../ui/felles";
import { useArk } from "../ui/Arkstabel";
import { lyttVurderinger } from "../data/endringer";

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
}: {
  skolearId: string;
  fag: FagIAr[];
}) {
  const [vurderinger, setVurderinger] = useState<Vurdering[]>([]);
  const [skalaer, setSkalaer] = useState<Skala[]>([]);
  const [valgt, setValgt] = useState<string | null>(null);
  const [filterFag, setFilterFag] = useState("");
  const [sok, setSok] = useState("");
  const [lagerNy, setLagerNy] = useState(false);
  const ark = useArk();

  async function last() {
    setVurderinger(await hentVurderinger(skolearId));
  }

  useEffect(() => {
    void last();
    void hentVurderingsskalaer().then(setSkalaer);
  }, [skolearId]);
  // Vurderingen åpnes som et ark over lista; endres den der, skal lista
  // vise det med en gang.
  useEffect(() => lyttVurderinger(() => void last()), [skolearId]);

  function apne(id: string) {
    setValgt(id);
    ark.apneVurdering(id);
  }

  const synlige = useMemo(() => {
    const s = sok.trim().toLocaleLowerCase("nb-NO");
    return vurderinger.filter((v) => {
      if (filterFag && v.skolearFagId !== filterFag) return false;
      if (s && !v.tittel.toLocaleLowerCase("nb-NO").includes(s)) return false;
      return true;
    });
  }, [vurderinger, filterFag, sok]);

  // Hvor mange vurderinger hvert fag har. Står i fagfilteret, så man ser
  // hvilke fag som mangler vurderinger uten å måtte klikke seg gjennom dem.
  const antallPerFag = useMemo(() => {
    const kart = new Map<string, number>();
    for (const v of vurderinger) {
      kart.set(v.skolearFagId, (kart.get(v.skolearFagId) ?? 0) + 1);
    }
    return kart;
  }, [vurderinger]);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 overflow-clip">
      <div className="liste-bredde flex w-full min-w-0 flex-col">
        <div className="shrink-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Felt
              verdi={sok}
              settVerdi={setSok}
              plassholder="Søk i tittel"
              bredde="w-56"
            />
            <select
              value={filterFag}
              onChange={(e) => setFilterFag(e.target.value)}
              className="rounded border border-linje bg-ark px-2 py-1.5 text-brod"
            >
              <option value="">Alle fag ({vurderinger.length})</option>
              {fag.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.kode} ({antallPerFag.get(f.id) ?? 0})
                </option>
              ))}
            </select>
            <div className="ml-auto">
              <Knapp variant="primar" onClick={() => setLagerNy(true)}>
                + Ny vurdering
              </Knapp>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {lagerNy && (
            <NyVurdering
              fag={fag}
              skalaer={skalaer}
              startFagId={filterFag || fag[0]?.id}
              onLagret={async (id) => {
                setLagerNy(false);
                await last();
                apne(id);
              }}
              onAvbryt={() => setLagerNy(false)}
            />
          )}

          {vurderinger.length === 0 && !lagerNy ? (
            <Tomtilstand
              tekst={
                fag.length === 0
                  ? "Legg inn fagene dine først."
                  : "Ingen vurderinger ennå. Prøver, innleveringer og framlegg legges inn her."
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
            <div>
              {perManed(synlige).map(([maned, gruppe]) => (
                <div key={maned}>
                  <div className="sticky top-0 z-10 border-y border-linje-medium bg-flate px-2 py-1 text-etikett uppercase tracking-etikett text-blekk-dempet">
                    {maned === "uten" ? "Uten frist" : manedsnavn(maned)}
                  </div>
                  {gruppe.map((v) => (
                    <Rad
                      key={v.id}
                      vurdering={v}
                      valgt={valgt === v.id}
                      kompakt={false}
                      onVelg={() => apne(v.id)}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}

          {vurderinger.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-liten text-blekk-dempet">
              <span className="tabular-nums">
                {synlige.length} av {vurderinger.length} vurderinger
              </span>
              {/*
              Fordelingen per fag, med fagets egen farge. Da ser man hvilke
              fag som ligger tynt an uten å bytte filter for å telle.
            */}
              {fag.map((f) => (
                <span key={f.id} className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      background: f.farge ?? "var(--color-linje-sterk)",
                    }}
                  />
                  {f.kode}
                  <span className="tabular-nums text-blekk-svak">
                    {antallPerFag.get(f.id) ?? 0}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
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
    vurdering.frist !== null &&
    vurdering.frist < iDag() &&
    vurdering.fort === 0;

  return (
    <button
      onClick={onVelg}
      className={`flex w-full items-center gap-3 border-b border-linje-svak px-2 py-1.5 text-left text-brod ${
        valgt ? "bg-valgt" : "hover:bg-flate"
      }`}
    >
      <Fagfirkant farge={vurdering.farge} />
      <Kappet verdi={vurdering.fagKode} klasse="w-20 shrink-0 font-medium" />
      <span
        className={`w-24 shrink-0 tabular-nums ${
          passert ? "font-medium text-feil" : "text-blekk-dempet"
        }`}
      >
        {vurdering.frist ? kortDato(vurdering.frist) : "ingen frist"}
      </span>
      <Kappet verdi={vurdering.tittel} klasse="flex-1" />
      {!kompakt && (
        <>
          <span className="w-20 shrink-0 text-blekk-dempet">
            {vurdering.type ? TYPENAVN[vurdering.type] : ""}
          </span>
          <Kappet
            verdi={vurdering.skalaNavn}
            klasse="w-32 shrink-0 text-blekk-svak"
          />
        </>
      )}
      <span className="w-14 shrink-0 text-right tabular-nums text-blekk-dempet">
        {vurdering.fort === 0 ? (
          "·"
        ) : vurdering.fort >= vurdering.elever ? (
          <Ikon navn="hake" />
        ) : (
          `${vurdering.fort}/${vurdering.elever}`
        )}
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
    <div className="mb-4 flex flex-wrap items-end gap-3 border border-linje bg-flate p-3">
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
          <option value="">–</option>
          <option value="skriftlig">Skriftlig</option>
          <option value="muntlig">Muntlig</option>
          <option value="praktisk">Praktisk</option>
        </select>
      </label>

      <Felt
        etikett="Frist"
        verdi={frist}
        settVerdi={setFrist}
        type="date"
        bredde="w-40"
      />

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

      <Knapp
        variant="primar"
        onClick={lagre}
        disabled={!fagId || tittel.trim() === ""}
      >
        Opprett
      </Knapp>
      <Knapp variant="stille" onClick={onAvbryt}>
        Avbryt
      </Knapp>
    </div>
  );
}

const velgerStil = "rounded border border-linje bg-ark px-2 py-1.5 text-brod";

function Etikett({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-etikett uppercase tracking-etikett text-blekk-dempet">
      {children}
    </span>
  );
}

/**
 * Vurderingene gruppert per måned etter frist.
 *
 * De uten frist havner i en egen bolk til slutt — de finnes, men hører ikke
 * hjemme i noen måned, og skal ikke gjemmes bort.
 */
function perManed(rader: Vurdering[]): [string, Vurdering[]][] {
  const kart = new Map<string, Vurdering[]>();
  for (const v of rader) {
    const m = v.frist ? v.frist.slice(0, 7) : "uten";
    kart.set(m, [...(kart.get(m) ?? []), v]);
  }
  const navn = [...kart.keys()].filter((k) => k !== "uten").sort();
  if (kart.has("uten")) navn.push("uten");
  return navn.map((n) => [n, kart.get(n)!]);
}

function manedsnavn(maned: string): string {
  return new Date(`${maned}-01T00:00:00`).toLocaleDateString("nb-NO", {
    month: "long",
    year: "numeric",
  });
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
