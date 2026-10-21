import { useEffect, useMemo, useState } from "react";
import {
  bekreftUtkast,
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
import { Velger } from "../ui/Velger";
import {
  Utkastmerke,
  Vurderingsikon,
  vurderingstype,
} from "../ui/Vurderingsikon";

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
            <Velger
              verdi={filterFag}
              settVerdi={setFilterFag}
              etikett="Fag"
              valg={[
                {
                  verdi: "",
                  tekst: "Alle fag",
                  hint: String(vurderinger.length),
                },
                ...fag.map((f) => ({
                  verdi: f.id,
                  tekst: f.kode,
                  hint: String(antallPerFag.get(f.id) ?? 0),
                  farge: f.farge,
                  firkant: true,
                })),
              ]}
            />
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
              {synlige.some((v) => v.utkast === 1) && (
                <div className="flex items-center gap-3 border-b border-linje-svak px-2 py-2 text-liten text-blekk-dempet">
                  <Utkastmerke />
                  <span className="flex-1">
                    {synlige.filter((v) => v.utkast === 1).length} hentet fra i
                    fjor. De står ikke blant fristene før du bekrefter dem.
                  </span>
                  <Knapp
                    onClick={async () => {
                      await bekreftUtkast(
                        synlige.filter((v) => v.utkast === 1).map((v) => v.id),
                      );
                      await last();
                    }}
                  >
                    Bekreft alle
                  </Knapp>
                </div>
              )}
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
      <span
        className={`flex min-w-0 flex-1 items-center gap-2 ${
          vurdering.utkast === 1 ? "opacity-60" : ""
        }`}
      >
        <Kappet verdi={vurdering.tittel} klasse="min-w-0" />
        {vurdering.utkast === 1 && <Utkastmerke />}
      </span>
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
        <Velger
          verdi={fagId}
          settVerdi={setFagId}
          valg={fag.map((f) => ({
            verdi: f.id,
            tekst: f.kode,
            farge: f.farge,
            firkant: true,
          }))}
        />
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
        <Velger
          verdi={type}
          settVerdi={(v) => setType(v as Vurderingstype | "")}
          valg={[
            { verdi: "", tekst: "Ingen type", dempet: true },
            ...(["skriftlig", "muntlig", "praktisk"] as const).map((t) => ({
              verdi: t,
              tekst: vurderingstype(t),
              ikon: <Vurderingsikon type={t} />,
            })),
          ]}
        />
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
        <Velger
          verdi={valgtSkala}
          settVerdi={setSkalaId}
          valg={skalaer.map((s) => ({ verdi: s.id, tekst: s.navn }))}
        />
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
