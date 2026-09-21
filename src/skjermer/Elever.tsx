import { useEffect, useMemo, useRef, useState } from "react";
import { confirm as bekreft } from "@tauri-apps/plugin-dialog";
import {
  endreElev,
  finnEllerOpprettKlasse,
  frakobleFag,
  frakobletekst,
  giKlasseNyttNavn,
  hentElever,
  hentKlasser,
  koblePaFag,
  tellSkaringerIFag,
  tellForElever,
  opprettElev,
  settKlasse,
  settMentor,
  slettElever,
  slettElevtekst,
  passerFagfilter,
  slettKlasse,
  type ElevRad,
  type Klasse,
} from "../data/elever";
import type { FagIAr } from "../data/fag";
import { hentInnstilling, settInnstilling } from "../data/skolear";
import { delNavn } from "../import/parser";
import {
  Fagflervalg,
  Fagmerke,
  Felt,
  Kappet,
  Knapp,
  Kolonnevelger,
  Tomtilstand,
} from "../ui/felles";
import { hentForfalte } from "../data/elevnotat";
import { ElevPanel } from "./ElevPanel";
import { useGlidende } from "../ui/bevegelse";

/**
 * Kolonner som kan slås av og på. Fornavn står alltid — uten navn er raden
 * ikke en elev.
 */
const VALGBARE = [
  { id: "etternavn", navn: "Etternavn" },
  { id: "kode", navn: "Kode" },
  { id: "klasse", navn: "Klasse" },
  { id: "mentor", navn: "Mentorelev" },
  { id: "fag", navn: "Fag" },
  { id: "okter", navn: "Økter" },
  { id: "siste", navn: "Siste" },
  { id: "innsats", navn: "Innsats" },
  { id: "endret", navn: "Sist endret" },
] as const;

type Synlig = (typeof VALGBARE)[number]["id"];

const STANDARD: Synlig[] = ["etternavn", "klasse", "fag", "okter", "siste"];

/**
 * Elever — alle elever, klasser og fag, SPEC §4.3.
 * Limet mellom alt annet, og der du bruker en time i august.
 */
export function Elever({
  skolearId,
  fag,
  startElev = null,
  onLimInn,
  onApneOkt,
}: {
  skolearId: string;
  /** Elev som skal stå åpen med en gang, f.eks. klikket fra forsiden. */
  startElev?: string | null;
  fag: FagIAr[];
  onLimInn: () => void;
  onApneOkt: (oktId: string) => void;
}) {
  const [elever, setElever] = useState<ElevRad[]>([]);
  const [klasser, setKlasser] = useState<Klasse[]>([]);
  const [fane, setFane] = useState<"elever" | "klasser">("elever");
  const [sok, setSok] = useState("");
  const [filterKlasse, setFilterKlasse] = useState("");
  // Flere fag kan velges, med AND eller OR mellom dem: «hvem har både MFL1
  // og ENG1» er et annet spørsmål enn «hvem har ett av dem».
  const [filterFag, setFilterFag] = useState<Set<string>>(new Set());
  const [fagModus, setFagModus] = useState<"alle" | "minstEtt">("alle");
  // Mentorfilteret virker uavhengig av klasse- og fagfilteret (§4.3).
  const [baraMentor, setBaraMentor] = useState(false);
  // Elever med et åpent, forfalt oppfølgingspunkt (§4.7). Merket sier bare at
  // noe venter — aldri hva. Tabellen vises i klasserommet og i møter.
  const [forfalte, setForfalte] = useState<Set<string>>(new Set());
  const [feil, setFeil] = useState<string | null>(null);
  const [valgtElev, setValgtElev] = useState<string | null>(startElev);
  const [synligeKolonner, setSynligeKolonner] = useState<Set<Synlig>>(
    new Set(STANDARD),
  );
  const [sortering, setSortering] = useState<Sortering>({
    kolonne: "fornavn",
    stigende: true,
  });
  // Lesemodus er standard, som i Fag. Da åpner et klikk i tabellen eleven
  // i stedet for å sette markøren i et felt.
  const [rediger, setRediger] = useState(false);
  // Flervalg til sletting, atskilt fra `valgtElev` som er elevkortet du ser.
  const [merket, setMerket] = useState<Set<string>>(new Set());

  // Kommer man hit med en elev i sikte — fra forsiden eller et heatmap —
  // skal hen åpne seg, også når panelet allerede står på en annen.
  useEffect(() => {
    if (startElev) setValgtElev(startElev);
  }, [startElev]);

  async function last() {
    setElever(await hentElever(skolearId));
    setKlasser(await hentKlasser(skolearId));
    setForfalte(await hentForfalte(skolearId));
  }

  useEffect(() => {
    void last();
    void hentInnstilling("elev_kolonner").then((v) => {
      if (v) setSynligeKolonner(new Set(JSON.parse(v) as Synlig[]));
    });
  }, [skolearId]);

  function byttKolonne(id: Synlig, pa: boolean) {
    setSynligeKolonner((f) => {
      const ny = new Set(f);
      if (pa) ny.add(id);
      else ny.delete(id);
      void settInnstilling("elev_kolonner", JSON.stringify([...ny]));
      return ny;
    });
  }

  // Panelet beholder siste elev mens det glir ut, ellers blir det tomt
  // midt i animasjonen.
  const { vist: visElev, apen: apentPanel } = useGlidende(valgtElev);

  // Panelet tar to tredeler av bredden, så de brede kolonnene må vike. Men
  // etternavnet blir stående — uten det bytter lista utseende i det du
  // klikker, og to elever med samme fornavn blir umulige å skille.
  const vis: ReadonlySet<Synlig> = apentPanel
    ? new Set<Synlig>(synligeKolonner.has("etternavn") ? ["etternavn"] : [])
    : synligeKolonner;

  const synlige = useMemo(() => {
    const s = sok.trim().toLocaleLowerCase("nb-NO");
    const filtrert = elever.filter((e) => {
      if (filterKlasse && e.klasseId !== filterKlasse) return false;
      if (!passerFagfilter(e.fagIder, filterFag, fagModus)) return false;
      if (baraMentor && !e.mentor) return false;
      if (
        s &&
        !`${e.fornavn} ${e.etternavn}`.toLocaleLowerCase("nb-NO").includes(s)
      )
        return false;
      return true;
    });
    return sorter(filtrert, sortering);
  }, [elever, sok, filterKlasse, filterFag, fagModus, baraMentor, sortering]);

  const alleMerket =
    synlige.length > 0 && synlige.every((e) => merket.has(e.id));

  // Bla gjennom lista slik den faktisk står — filtrert og sortert. Blar du
  // i 1STC sortert på innsats, er det den rekkefølgen som gjelder, ikke
  // alfabetisk på tvers av alle.
  const [retning, setRetning] = useState<"opp" | "ned" | null>(null);
  const nr = synlige.findIndex((e) => e.id === valgtElev);

  function blaTil(steg: number) {
    if (nr < 0 || synlige.length === 0) return;
    const ny = (nr + steg + synlige.length) % synlige.length;
    setRetning(steg > 0 ? "opp" : "ned");
    setValgtElev(synlige[ny].id);
  }

  function bytSortering(kolonne: Kolonne) {
    setSortering((s) =>
      s.kolonne === kolonne
        ? { kolonne, stigende: !s.stigende }
        : { kolonne, stigende: true },
    );
  }

  if (fane === "klasser") {
    return (
      <Klasser
        skolearId={skolearId}
        klasser={klasser}
        onEndret={last}
        onTilbake={() => setFane("elever")}
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 overflow-clip">
      <div
        className={`liste-bredde flex min-w-0 flex-col ${
          apentPanel ? "hidden w-full pr-4 lg:flex lg:w-1/3" : "w-full"
        }`}
      >
        {/* Søk, filtre og knapper blir stående mens lista ruller. */}
        <div className="shrink-0">
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <Felt
              verdi={sok}
              settVerdi={setSok}
              plassholder="Søk etter navn"
              bredde="w-56"
            />

            <Velger
              verdi={filterKlasse}
              settVerdi={setFilterKlasse}
              tom="Alle klasser"
              valg={klasser.map((k) => ({
                id: k.id,
                tekst: `${k.navn} (${k.antall})`,
              }))}
            />
            <Fagflervalg
              fag={fag}
              valgte={filterFag}
              settValgte={setFilterFag}
              modus={fagModus}
              settModus={setFagModus}
            />

            <label
              title="Bare elevene du er kontaktlærer for i år"
              className="flex select-none items-center gap-1.5 text-liten text-blekk-dempet"
            >
              <input
                type="checkbox"
                checked={baraMentor}
                onChange={(e) => setBaraMentor(e.target.checked)}
              />
              Mentorelever
              <span className="tabular-nums text-blekk-svak">
                {elever.filter((e) => e.mentor).length}
              </span>
            </label>

            <div className="ml-auto flex items-center gap-2">
              <label className="flex select-none items-center gap-2 text-liten text-blekk-dempet">
                <input
                  type="checkbox"
                  checked={rediger}
                  onChange={(e) => {
                    setRediger(e.target.checked);
                    if (e.target.checked) setValgtElev(null);
                  }}
                />
                Rediger
              </label>
              <Kolonnevelger
                valgbare={VALGBARE}
                vis={synligeKolonner}
                onEndre={(id, pa) => byttKolonne(id as Synlig, pa)}
              />
              <Knapp onClick={() => setFane("klasser")}>
                Klasser ({klasser.length})
              </Knapp>
              <Knapp onClick={onLimInn}>Lim inn liste</Knapp>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {/* Arket lista ligger på. Skrivebordet er flata rundt (§13). */}
          {elever.length === 0 ? (
            <Tomtilstand
              tekst="Ingen elever i dette skoleåret ennå."
              handling={
                <Knapp variant="primar" onClick={onLimInn}>
                  Lim inn en klasseliste
                </Knapp>
              }
            />
          ) : (
            <div className="rounded-vanlig border border-linje bg-ark px-3">
              <table className="tabell-fast w-full text-brod">
                <thead>
                  <tr className="border-b border-linje text-left text-etikett uppercase tracking-etikett text-blekk-dempet">
                    <th className="w-6 py-1">
                      <input
                        type="checkbox"
                        checked={alleMerket}
                        title={
                          alleMerket ? "Fjern merkingen" : "Merk alle i lista"
                        }
                        onChange={(e) =>
                          setMerket(
                            e.target.checked
                              ? new Set(synlige.map((s) => s.id))
                              : new Set(),
                          )
                        }
                      />
                    </th>
                    <Overskrift
                      kolonne="fornavn"
                      sortering={sortering}
                      onKlikk={bytSortering}
                    >
                      Fornavn
                    </Overskrift>
                    {vis.has("etternavn") && (
                      <Overskrift
                        kolonne="etternavn"
                        sortering={sortering}
                        onKlikk={bytSortering}
                      >
                        Etternavn
                      </Overskrift>
                    )}
                    {vis.has("kode") && (
                      <Overskrift
                        kolonne="kode"
                        sortering={sortering}
                        onKlikk={bytSortering}
                      >
                        Kode
                      </Overskrift>
                    )}
                    {vis.has("klasse") && (
                      <Overskrift
                        kolonne="klasse"
                        sortering={sortering}
                        onKlikk={bytSortering}
                      >
                        Klasse
                      </Overskrift>
                    )}
                    {vis.has("mentor") && (
                      <Overskrift
                        kolonne="mentor"
                        sortering={sortering}
                        onKlikk={bytSortering}
                      >
                        Mentorelev
                      </Overskrift>
                    )}
                    {vis.has("fag") && (
                      <Overskrift
                        kolonne="fag"
                        sortering={sortering}
                        onKlikk={bytSortering}
                      >
                        Fag
                      </Overskrift>
                    )}
                    {vis.has("okter") && (
                      <Overskrift
                        kolonne="okter"
                        sortering={sortering}
                        onKlikk={bytSortering}
                        hoyre
                      >
                        Økter
                      </Overskrift>
                    )}
                    {vis.has("siste") && (
                      <Overskrift
                        kolonne="siste"
                        sortering={sortering}
                        onKlikk={bytSortering}
                        hoyre
                      >
                        Siste
                      </Overskrift>
                    )}
                    {vis.has("innsats") && (
                      <Overskrift
                        kolonne="innsats"
                        sortering={sortering}
                        onKlikk={bytSortering}
                      >
                        Innsats
                      </Overskrift>
                    )}
                    {vis.has("endret") && (
                      <Overskrift
                        kolonne="endret"
                        sortering={sortering}
                        onKlikk={bytSortering}
                        hoyre
                      >
                        Sist endret
                      </Overskrift>
                    )}
                    {/* Tar opp slakken, så kolonnene over hugger innholdet sitt. */}
                    <th className="w-full" />
                  </tr>
                </thead>
                <tbody>
                  {synlige.map((e) => (
                    <Rad
                      key={e.id}
                      elev={e}
                      fag={fag}
                      klasser={klasser}
                      skolearId={skolearId}
                      rediger={rediger}
                      valgt={valgtElev === e.id}
                      merket={merket.has(e.id)}
                      forfalt={forfalte.has(e.id)}
                      vis={vis}
                      onApne={() => setValgtElev(e.id)}
                      onMerk={(pa) =>
                        setMerket((f) => {
                          const ny = new Set(f);
                          if (pa) ny.add(e.id);
                          else ny.delete(e.id);
                          return ny;
                        })
                      }
                      onEndret={last}
                      onFeil={setFeil}
                    />
                  ))}
                  <NyElevRad
                    kolonner={3 + vis.size}
                    skolearId={skolearId}
                    klasser={klasser}
                    fag={fag}
                    arvKlasse={filterKlasse || null}
                    arvFag={filterFag.size === 1 ? [...filterFag][0] : null}
                    arvMentor={baraMentor}
                    onLagret={last}
                    onFeil={setFeil}
                  />
                </tbody>
              </table>
            </div>
          )}

          {feil && (
            <div className="mt-3 flex items-center gap-3 border border-feil bg-feil-flate px-3 py-2 text-brod text-feil">
              <span>{feil}</span>
              <button
                onClick={() => setFeil(null)}
                className="ml-auto text-liten hover:underline"
              >
                Lukk
              </button>
            </div>
          )}

          {merket.size > 0 && (
            <div className="sticky bottom-0 mt-3 flex items-center gap-3 border border-linje bg-flate px-3 py-2 text-brod shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
              <span className="tabular-nums">
                {merket.size} {merket.size === 1 ? "elev" : "elever"} merket
              </span>
              <div className="ml-auto flex items-center gap-2">
                <Knapp variant="stille" onClick={() => setMerket(new Set())}>
                  Nullstill
                </Knapp>
                <button
                  onClick={async () => {
                    const ider = [...merket];
                    const navn = elever
                      .filter((e) => merket.has(e.id))
                      .map((e) => `${e.fornavn} ${e.etternavn}`);
                    const n = await tellForElever(ider);
                    if (!(await bekreft(slettElevtekst(navn, n)))) return;
                    await slettElever(ider);
                    if (valgtElev && merket.has(valgtElev)) setValgtElev(null);
                    setMerket(new Set());
                    await last();
                  }}
                  className="text-brod text-feil hover:text-feil-mork"
                >
                  Slett{" "}
                  {merket.size === 1 ? "eleven" : `de ${merket.size} elevene`}
                </button>
              </div>
            </div>
          )}

          <p className="mt-3 text-liten text-blekk-dempet">
            {synlige.length} av {elever.length} elever
          </p>
        </div>
      </div>

      {visElev && (
        <div
          className={`panel min-h-0 min-w-0 w-full overflow-auto lg:w-2/3 ${apentPanel ? "" : "panel-ute"}`}
        >
          <ElevPanel
            key={visElev}
            elevId={visElev}
            aktivtSkolearId={skolearId}
            startFag={filterFag.size === 1 ? [...filterFag][0] : ""}
            onLukk={() => setValgtElev(null)}
            onApneOkt={onApneOkt}
            bla={
              nr >= 0
                ? {
                    nr: nr + 1,
                    av: synlige.length,
                    retning,
                    forrige: () => blaTil(-1),
                    neste: () => blaTil(1),
                  }
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
}

type Kolonne =
  | "fornavn"
  | "etternavn"
  | "kode"
  | "klasse"
  | "mentor"
  | "fag"
  | "okter"
  | "siste"
  | "innsats"
  | "endret";
type Sortering = { kolonne: Kolonne; stigende: boolean };

/** Andel grønt av skåringene som teller. -1 for elever uten noen. */
function andelGronn(e: ElevRad): number {
  const n = e.gronn + e.gul + e.rod;
  return n === 0 ? -1 : e.gronn / n;
}

function sorter(rader: ElevRad[], { kolonne, stigende }: Sortering): ElevRad[] {
  const tekst = (v: string | null) => (v ?? "").toLocaleLowerCase("nb-NO");
  const sammenlikn = (a: ElevRad, b: ElevRad): number => {
    switch (kolonne) {
      case "fornavn":
        return `${tekst(a.fornavn)} ${tekst(a.etternavn)}`.localeCompare(
          `${tekst(b.fornavn)} ${tekst(b.etternavn)}`,
          "nb-NO",
        );
      case "etternavn":
        // Etternavn først, fornavn som tiebreak — ellers hopper søsken rundt.
        return `${tekst(a.etternavn)} ${tekst(a.fornavn)}`.localeCompare(
          `${tekst(b.etternavn)} ${tekst(b.fornavn)}`,
          "nb-NO",
        );
      case "kode":
        return tekst(a.kode).localeCompare(tekst(b.kode), "nb-NO");
      case "mentor":
        // Mentorelevene først når man sorterer på kolonnen — det er dem man
        // sorterer for å se.
        return Number(b.mentor) - Number(a.mentor);
      case "klasse":
        // Elever uten klasse havner sist begge veier — de er ikke «minst».
        if (!a.klasseNavn !== !b.klasseNavn) return a.klasseNavn ? -1 : 1;
        return tekst(a.klasseNavn).localeCompare(tekst(b.klasseNavn), "nb-NO");
      case "fag":
        return a.fagKoder
          .join(",")
          .localeCompare(b.fagKoder.join(","), "nb-NO");
      case "okter":
        return a.okter - b.okter;
      case "siste":
        if (!a.siste !== !b.siste) return a.siste ? -1 : 1;
        return tekst(a.siste).localeCompare(tekst(b.siste));
      case "innsats":
        // Andel grønt av det som teller. Elever uten skåringer sist.
        return andelGronn(b) - andelGronn(a);
      case "endret":
        return b.endret.localeCompare(a.endret);
    }
  };

  return [...rader].sort((a, b) => (stigende ? 1 : -1) * sammenlikn(a, b));
}

function Overskrift({
  kolonne,
  sortering,
  onKlikk,
  hoyre,
  children,
}: {
  kolonne: Kolonne;
  sortering: Sortering;
  onKlikk: (k: Kolonne) => void;
  hoyre?: boolean;
  children: React.ReactNode;
}) {
  const aktiv = sortering.kolonne === kolonne;
  return (
    <th className="h-[var(--hoyde-rad)] py-1 pr-5 font-normal">
      <button
        onClick={() => onKlikk(kolonne)}
        className={`flex w-full items-center gap-1 uppercase tracking-etikett hover:text-blekk ${
          hoyre ? "justify-end" : ""
        } ${aktiv ? "text-blekk" : ""}`}
      >
        {children}
        <span className={aktiv ? "" : "invisible"}>
          {sortering.stigende ? "\u2191" : "\u2193"}
        </span>
      </button>
    </th>
  );
}

function Velger({
  verdi,
  settVerdi,
  tom,
  valg,
}: {
  verdi: string;
  settVerdi: (v: string) => void;
  tom: string;
  valg: { id: string; tekst: string }[];
}) {
  return (
    <select
      value={verdi}
      onChange={(e) => settVerdi(e.target.value)}
      className="rounded-vanlig border border-linje bg-ark px-2 py-1.5 text-brod"
    >
      <option value="">{tom}</option>
      {valg.map((v) => (
        <option key={v.id} value={v.id}>
          {v.tekst}
        </option>
      ))}
    </select>
  );
}

function Rad({
  elev,
  fag,
  klasser,
  skolearId,
  rediger,
  valgt,
  merket,
  forfalt,
  vis,
  onApne,
  onMerk,
  onEndret,
  onFeil,
}: {
  elev: ElevRad;
  fag: FagIAr[];
  klasser: Klasse[];
  skolearId: string;
  rediger: boolean;
  valgt: boolean;
  merket: boolean;
  forfalt: boolean;
  vis: ReadonlySet<Synlig>;
  onApne: () => void;
  onMerk: (pa: boolean) => void;
  onEndret: () => void;
  onFeil: (tekst: string) => void;
}) {
  const [apenFag, setApenFag] = useState(false);
  // Avkrysningen viser valget med en gang. Nullstilles når lista har lastet
  // på nytt, så basen er fasit til slutt.
  const [onsketMentor, setOnsketMentor] = useState<boolean | null>(null);
  useEffect(() => setOnsketMentor(null), [elev.mentor]);
  // prompt() finnes ikke i Tauri-vinduet, så «Ny klasse …» gjør cellen om til
  // et skrivefelt i stedet for å åpne en dialog.
  const [skriverKlasse, setSkriverKlasse] = useState(false);

  async function byttKlasse(verdi: string) {
    if (verdi === "__ny") {
      setSkriverKlasse(true);
      return;
    }
    await settKlasse(elev.id, skolearId, verdi === "" ? null : verdi);
    onEndret();
  }

  async function lagKlasse(navn: string) {
    const rent = navn.trim();
    setSkriverKlasse(false);
    if (rent === "") return;
    const id = await finnEllerOpprettKlasse(skolearId, rent);
    await settKlasse(elev.id, skolearId, id);
    onEndret();
  }
  return (
    <tr
      // Hele rada åpner eleven, ikke bare navnet. I redigeringsmodus gjør den
      // ingenting — der skal et klikk treffe feltet du sikter på.
      onClick={rediger ? undefined : onApne}
      className={`h-[var(--hoyde-rad)] border-b border-linje-svak ${
        rediger ? "" : "cursor-pointer"
      } ${valgt ? "bg-valgt" : merket ? "bg-flate-svak" : "hover:bg-flate-svak"}`}
    >
      {/* Klikket stoppes her, ellers ville avhukingen åpnet elevkortet. */}
      <td className="py-1.5" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={merket}
          title="Merk for sletting"
          onChange={(e) => onMerk(e.target.checked)}
        />
      </td>
      <td className="py-1.5 pr-5">
        {forfalt && (
          <span
            aria-label="Har et forfalt oppfølgingspunkt"
            title="Har et forfalt oppfølgingspunkt"
            className="mr-1.5 inline-block align-middle text-varsel"
          >
            ●
          </span>
        )}
        <Navnefelt
          verdi={elev.fornavn}
          rediger={rediger}
          onApne={onApne}
          onLagre={async (v) => {
            await endreElev(elev.id, { fornavn: v });
            onEndret();
          }}
        />
      </td>
      {vis.has("etternavn") && (
        <td className="py-1.5 pr-5">
          <Navnefelt
            verdi={elev.etternavn}
            rediger={rediger}
            onApne={onApne}
            onLagre={async (v) => {
              await endreElev(elev.id, { etternavn: v });
              onEndret();
            }}
          />
        </td>
      )}
      {vis.has("kode") && (
        <td className="whitespace-nowrap py-1.5 pr-5 font-mono text-liten tabular-nums text-blekk-svak">
          {elev.kode}
        </td>
      )}
      {/*
        Klassen vises, men redigeres ikke her. En nedtrekksliste i hver rad
        gjør at et klikk i tabellen like gjerne endrer noe som å åpne eleven,
        og klassen byttes sjelden. Den settes i elevpanelet i stedet.
      */}
      <td className={`py-1.5 pr-5 ${vis.has("klasse") ? "" : "hidden"}`}>
        {!rediger ? (
          <span className="whitespace-nowrap">
            {elev.klasseNavn ?? <span className="text-blekk-svakest">—</span>}
          </span>
        ) : skriverKlasse ? (
          <input
            autoFocus
            placeholder="1STC"
            onBlur={(e) => void lagKlasse(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setSkriverKlasse(false);
            }}
            className="w-full rounded-vanlig border border-aksent px-1 py-0.5 outline-none"
          />
        ) : (
          <select
            value={elev.klasseId ?? ""}
            onChange={(e) => byttKlasse(e.target.value)}
            className="w-full rounded-vanlig border border-transparent bg-transparent px-1 py-0.5 hover:border-linje focus:border-aksent focus:outline-none"
          >
            <option value="">Ingen klasse</option>
            {klasser.map((k) => (
              <option key={k.id} value={k.id}>
                {k.navn}
              </option>
            ))}
            <option value="__ny">Ny klasse …</option>
          </select>
        )}
      </td>
      {/*
        Mentormerket henger på klassekoblingen (§3.2), så uten klasse finnes
        det ingen rad å merke.

        Da vises det ingen avkrysningsboks i det hele tatt. En deaktivert boks
        ser ut som en boks, og det var nettopp problemet: den så ut som den
        virket. En strek gjør det ikke.
      */}
      <td
        className={`py-1.5 pr-5 ${vis.has("mentor") ? "" : "hidden"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {elev.klasseId === null ? (
          <span
            title="Sett klasse først — mentormerket henger på klassen"
            className="cursor-help select-none text-blekk-svakest"
          >
            —
          </span>
        ) : (
          <input
            type="checkbox"
            checked={onsketMentor ?? elev.mentor}
            title="Min mentorelev dette året"
            onChange={async (e) => {
              const pa = e.target.checked;
              // Vis valget med en gang, og la lista bekrefte det etterpå.
              setOnsketMentor(pa);
              try {
                const ok = await settMentor(elev.id, skolearId, pa);
                if (!ok) {
                  setOnsketMentor(null);
                  onFeil(
                    "Eleven har ingen klasse dette året, så merket kunne ikke settes.",
                  );
                  return;
                }
                onEndret();
              } catch (feil) {
                // Uten dette forsvinner en feil i stillhet, og boksen ser bare
                // ut som den ikke gjorde noe.
                setOnsketMentor(null);
                onFeil(`Kunne ikke lagre mentormerket: ${String(feil)}`);
              }
            }}
          />
        )}
      </td>
      <td className={`relative py-1.5 pr-5 ${vis.has("fag") ? "" : "hidden"}`}>
        <button
          onClick={() => rediger && setApenFag((v) => !v)}
          disabled={!rediger}
          className={`w-full rounded-vanlig border border-transparent px-1 py-0.5 text-left ${
            rediger ? "hover:border-linje" : "cursor-default"
          }`}
        >
          {elev.fagIder.length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {elev.fagIder.map((id) => {
                const f = fag.find((x) => x.id === id);
                return f ? (
                  <Fagmerke key={id} kode={f.kode} farge={f.farge} />
                ) : null;
              })}
            </span>
          ) : (
            <span className="text-blekk-svak">ingen fag</span>
          )}
        </button>
        {apenFag && (
          <div className="absolute left-0 top-full z-10 mt-1 w-56 rounded-vanlig border border-linje bg-ark p-2 shadow-lg">
            {fag.map((f) => (
              <label
                key={f.id}
                className="flex items-center gap-2 py-0.5 text-brod hover:bg-flate"
              >
                <input
                  type="checkbox"
                  checked={elev.fagIder.includes(f.id)}
                  onChange={async (e) => {
                    if (e.target.checked) {
                      await koblePaFag(elev.id, f.id);
                    } else {
                      // Å hake av og på igjen er ufarlig i seg selv — raden
                      // kommer tilbake. Men har eleven skåringer i faget,
                      // forsvinner hen ut av heatmapet og fagoversikten, og
                      // da er det verdt et spørsmål.
                      const n = await tellSkaringerIFag(elev.id, f.id);
                      if (
                        n > 0 &&
                        !(await bekreft(frakobletekst(elev.fornavn, f.kode, n)))
                      ) {
                        e.target.checked = true;
                        return;
                      }
                      await frakobleFag(elev.id, f.id);
                    }
                    onEndret();
                  }}
                />
                <Fagmerke kode={f.kode} farge={f.farge} />
                <Kappet verdi={f.navn} klasse="text-blekk-dempet" />
              </label>
            ))}
            <button
              onClick={() => setApenFag(false)}
              className="mt-1 w-full border-t border-linje-medium pt-1 text-liten text-blekk-dempet"
            >
              Lukk
            </button>
          </div>
        )}
      </td>
      {vis.has("okter") && (
        <td className="whitespace-nowrap py-1.5 pr-5 text-right tabular-nums">
          {elev.okter || "–"}
        </td>
      )}
      {vis.has("siste") && (
        <td className="whitespace-nowrap py-1.5 pr-5 text-right tabular-nums text-blekk-dempet">
          {elev.siste ? dagerSiden(elev.siste) : "–"}
        </td>
      )}
      {vis.has("innsats") && (
        <td className="py-1.5 pr-5">
          <Innsatsstripe elev={elev} />
        </td>
      )}
      {vis.has("endret") && (
        <td className="whitespace-nowrap py-1.5 pr-5 text-right tabular-nums text-blekk-dempet">
          {kortTid(elev.endret)}
        </td>
      )}
      <td />
    </tr>
  );
}

/**
 * Navnet: lesbart som lenke, redigerbart i redigeringsmodus.
 *
 * Feltet vokser med innholdet framfor å klippe. Et navn som er klippet er
 * verre enn en tabell som blir litt bredere — det er eleven det gjelder.
 */
function Navnefelt({
  verdi,
  rediger,
  onApne,
  onLagre,
}: {
  verdi: string;
  rediger: boolean;
  onApne: () => void;
  onLagre: (v: string) => Promise<void>;
}) {
  if (!rediger) {
    return (
      <button
        onClick={onApne}
        className="text-left hover:text-aksent hover:underline"
      >
        {verdi}
      </button>
    );
  }

  return (
    <input
      defaultValue={verdi}
      key={verdi}
      onBlur={async (e) => {
        const ny = e.target.value.trim();
        if (ny && ny !== verdi) await onLagre(ny);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          e.currentTarget.value = verdi;
          e.currentTarget.blur();
        }
      }}
      // Full bredde av kolonnen framfor en fast `size`. Et tegnbredde-mål
      // tvinger tabellen bredere enn vinduet så snart et navn er langt.
      className="w-full min-w-0 rounded-vanlig border border-transparent px-1 py-0.5 outline-none hover:border-linje focus:border-aksent"
    />
  );
}

/**
 * Fordelingen av elevens skåringer som en tynn stripe. Samme fargespråk som
 * heatmapet og årsoversikten — «ikke i økta» er allerede filtrert bort i
 * spørringen, så stripa viser bare det som teller.
 */
function Innsatsstripe({ elev }: { elev: ElevRad }) {
  const deler = [
    { n: elev.gronn, f: "var(--color-lys-gronn)", navn: "grønn" },
    { n: elev.gul, f: "var(--color-lys-gul)", navn: "gul" },
    { n: elev.rod, f: "var(--color-lys-rod)", navn: "rød" },
  ].filter((d) => d.n > 0);

  if (deler.length === 0) {
    return <span className="text-blekk-svakest">–</span>;
  }

  return (
    <span
      className="flex h-[6px] w-24 gap-[2px] overflow-clip rounded-liten"
      title={deler.map((d) => `${d.navn} ${d.n}`).join(" · ")}
    >
      {deler.map((d) => (
        <span key={d.navn} style={{ background: d.f, flexGrow: d.n }} />
      ))}
    </span>
  );
}

/** Dato uten klokkeslett — tidspunktet er sjelden det interessante. */
function kortTid(iso: string): string {
  return new Date(iso).toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function dagerSiden(dato: string): string {
  const dager = Math.round(
    (Date.now() - new Date(dato).getTime()) / 86_400_000,
  );
  if (dager <= 0) return "i dag";
  return `${dager} d`;
}

/**
 * Den tomme raden nederst. Skriv navnet, trykk Enter, og raden lagres samtidig
 * som en ny tom rad dukker opp. Ingen dialogvindu, ingen lagre-knapp (§4.3).
 */
function NyElevRad({
  kolonner,
  skolearId,
  klasser,
  fag,
  arvKlasse,
  arvFag,
  arvMentor,
  onLagret,
  onFeil,
}: {
  kolonner: number;
  skolearId: string;
  klasser: Klasse[];
  fag: FagIAr[];
  arvKlasse: string | null;
  arvFag: string | null;
  arvMentor: boolean;
  onLagret: () => void;
  onFeil: (tekst: string) => void;
}) {
  const [fornavn, setFornavn] = useState("");
  const [etternavn, setEtternavn] = useState("");
  const [klasseId, setKlasseId] = useState(arvKlasse ?? "");
  const [nyKlasse, setNyKlasse] = useState("");
  const [mentor, setMentor] = useState(arvMentor);
  const [valgteFag, setValgteFag] = useState<Set<string>>(
    new Set(arvFag ? [arvFag] : []),
  );
  const [jobber, setJobber] = useState(false);
  const forste = useRef<HTMLInputElement>(null);

  // Mentormerket henger på klassen (§3.2), så uten klasse er det ingenting
  // å merke — og da skal boksen ikke gå an å hake av.
  const harKlasse =
    klasseId === "__ny" ? nyKlasse.trim() !== "" : klasseId !== "";
  const kanLagre = fornavn.trim() !== "" && etternavn.trim() !== "" && !jobber;

  function nullstill() {
    setFornavn("");
    setEtternavn("");
    setNyKlasse("");
    // Klasse, fag og mentor beholdes: skriver man inn en klasse, er det som
    // regel flere på rad fra samme klasse.
    forste.current?.focus();
  }

  /**
   * Skriver man hele navnet i første felt, deles det når man går videre —
   * «Kåre Kålrabi» skal ikke kreve to tastetrykk ekstra.
   */
  function delOpp() {
    if (etternavn.trim() !== "" || !fornavn.includes(" ")) return;
    const delt = delNavn(fornavn);
    if (delt.etternavn !== "") {
      setFornavn(delt.fornavn);
      setEtternavn(delt.etternavn);
    }
  }

  async function lagre() {
    if (!kanLagre) return;
    setJobber(true);
    try {
      const id = await opprettElev(fornavn.trim(), etternavn.trim());

      const valgtKlasse =
        klasseId === "__ny"
          ? nyKlasse.trim() === ""
            ? null
            : await finnEllerOpprettKlasse(skolearId, nyKlasse.trim())
          : klasseId || null;

      if (valgtKlasse) {
        await settKlasse(id, skolearId, valgtKlasse);
        if (mentor) await settMentor(id, skolearId, true);
      }
      for (const f of valgteFag) await koblePaFag(id, f);

      nullstill();
      onLagret();
    } catch (feil) {
      onFeil(`Kunne ikke opprette eleven: ${String(feil)}`);
    } finally {
      setJobber(false);
    }
  }

  function tast(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      void lagre();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setFornavn("");
      setEtternavn("");
    }
  }

  return (
    <tr>
      {/*
        Alle feltene i én operasjon (§4.3). Raden spenner over hele tabellen
        framfor å følge kolonnene, så den er den samme uansett hvilke kolonner
        som er slått på — og eleven blir aldri lagret halvferdig.
      */}
      <td colSpan={kolonner} className="py-2">
        <div className="flex flex-wrap items-center gap-2" onKeyDown={tast}>
          <input
            ref={forste}
            value={fornavn}
            onChange={(e) => setFornavn(e.target.value)}
            onBlur={delOpp}
            placeholder="Fornavn"
            className={feltstil}
          />
          <input
            value={etternavn}
            onChange={(e) => setEtternavn(e.target.value)}
            placeholder="Etternavn"
            className={feltstil}
          />

          <select
            value={klasseId}
            onChange={(e) => setKlasseId(e.target.value)}
            className={feltstil}
          >
            <option value="">Ingen klasse</option>
            {klasser.map((k) => (
              <option key={k.id} value={k.id}>
                {k.navn}
              </option>
            ))}
            <option value="__ny">Ny klasse …</option>
          </select>
          {klasseId === "__ny" && (
            <input
              autoFocus
              value={nyKlasse}
              onChange={(e) => setNyKlasse(e.target.value)}
              placeholder="1STC"
              className={`${feltstil} w-24`}
            />
          )}

          <label
            title={
              harKlasse
                ? "Min mentorelev dette året"
                : "Velg klasse først — mentormerket henger på klassen"
            }
            className={`flex select-none items-center gap-1.5 text-liten ${
              harKlasse ? "text-blekk-dempet" : "text-blekk-svakest"
            }`}
          >
            <input
              type="checkbox"
              checked={mentor && harKlasse}
              disabled={!harKlasse}
              onChange={(e) => setMentor(e.target.checked)}
            />
            Mentorelev
          </label>

          {fag.length > 0 && (
            <span className="flex flex-wrap items-center gap-1">
              {fag.map((f) => (
                <label
                  key={f.id}
                  className="flex cursor-pointer select-none items-center gap-1"
                >
                  <input
                    type="checkbox"
                    checked={valgteFag.has(f.id)}
                    onChange={(e) =>
                      setValgteFag((v) => {
                        const ny = new Set(v);
                        if (e.target.checked) ny.add(f.id);
                        else ny.delete(f.id);
                        return ny;
                      })
                    }
                  />
                  <Fagmerke kode={f.kode} farge={f.farge} liten />
                </label>
              ))}
            </span>
          )}

          <span className="ml-auto flex items-center gap-2">
            {fornavn.trim() !== "" && etternavn.trim() === "" && (
              <span className="text-liten text-varsel">
                Etternavn må fylles ut
              </span>
            )}
            <Knapp
              variant="primar"
              disabled={!kanLagre}
              onClick={() => void lagre()}
            >
              {jobber ? "Lagrer …" : "Lagre"}
            </Knapp>
          </span>
        </div>
      </td>
    </tr>
  );
}

const feltstil =
  "rounded-vanlig border border-linje bg-ark px-2 py-1 text-brod outline-none focus:border-aksent";

function Klasser({
  skolearId,
  klasser,
  onEndret,
  onTilbake,
}: {
  skolearId: string;
  klasser: Klasse[];
  onEndret: () => void;
  onTilbake: () => void;
}) {
  const [nyttNavn, setNyttNavn] = useState("");

  return (
    <div className="max-w-lg">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-tittel">Klasser</h2>
        <Knapp variant="stille" onClick={onTilbake}>
          Tilbake til elevene
        </Knapp>
      </div>

      {klasser.length === 0 ? (
        <Tomtilstand tekst="Ingen klasser ennå. De opprettes når du limer inn en liste." />
      ) : (
        <table className="w-full text-brod">
          <tbody>
            {klasser.map((k) => (
              <tr key={k.id} className="border-b border-linje-svak">
                <td className="py-1.5">
                  <input
                    defaultValue={k.navn}
                    onBlur={async (e) => {
                      const navn = e.target.value.trim();
                      if (navn && navn !== k.navn) {
                        await giKlasseNyttNavn(k.id, navn);
                        onEndret();
                      }
                    }}
                    className="rounded-vanlig border border-transparent px-1 py-0.5 hover:border-linje focus:border-aksent focus:outline-none"
                  />
                </td>
                <td className="w-24 py-1.5 text-right tabular-nums text-blekk-dempet">
                  {k.antall} elever
                </td>
                <td className="w-20 py-1.5 text-right">
                  <button
                    onClick={async () => {
                      const svar = await bekreft(
                        k.antall > 0
                          ? `${k.navn} har ${k.antall} elever. De blir stående uten klasse — ingen elever slettes. Slette klassen?`
                          : `Slette ${k.navn}?`,
                      );
                      if (!svar) return;
                      await slettKlasse(k.id);
                      onEndret();
                    }}
                    className="text-liten text-blekk-svak hover:text-red-700"
                  >
                    Slett
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-4 flex items-end gap-2">
        <Felt
          etikett="Ny klasse"
          verdi={nyttNavn}
          settVerdi={setNyttNavn}
          plassholder="1STC"
          bredde="w-40"
          onEnter={async () => {
            if (!nyttNavn.trim()) return;
            await finnEllerOpprettKlasse(skolearId, nyttNavn.trim());
            setNyttNavn("");
            onEndret();
          }}
        />
        <Knapp
          onClick={async () => {
            if (!nyttNavn.trim()) return;
            await finnEllerOpprettKlasse(skolearId, nyttNavn.trim());
            setNyttNavn("");
            onEndret();
          }}
        >
          Opprett
        </Knapp>
      </div>
    </div>
  );
}
