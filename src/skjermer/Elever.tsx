import { useEffect, useMemo, useRef, useState } from "react";
import {
  finnEllerOpprettKlasse,
  frakobleFag,
  giKlasseNyttNavn,
  hentElever,
  hentKlasser,
  koblePaFag,
  opprettElev,
  settKlasse,
  slettKlasse,
  type ElevRad,
  type Klasse,
} from "../data/elever";
import type { FagIAr } from "../data/fag";
import { hentInnstilling, settInnstilling } from "../data/skolear";
import { delNavn } from "../import/parser";
import { Fagmerke, Felt, Knapp, Kolonnevelger, Tomtilstand } from "../ui/felles";
import { ElevPanel } from "./ElevPanel";

/**
 * Kolonner som kan slås av og på. Fornavn står alltid — uten navn er raden
 * ikke en elev.
 */
const VALGBARE = [
  { id: "etternavn", navn: "Etternavn" },
  { id: "kode", navn: "Kode" },
  { id: "klasse", navn: "Klasse" },
  { id: "fag", navn: "Fag" },
  { id: "okter", navn: "Økter" },
  { id: "siste", navn: "Siste" },
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
  onLimInn,
  onApneOkt,
}: {
  skolearId: string;
  fag: FagIAr[];
  onLimInn: () => void;
  onApneOkt: (oktId: string) => void;
}) {
  const [elever, setElever] = useState<ElevRad[]>([]);
  const [klasser, setKlasser] = useState<Klasse[]>([]);
  const [fane, setFane] = useState<"elever" | "klasser">("elever");
  const [sok, setSok] = useState("");
  const [filterKlasse, setFilterKlasse] = useState("");
  const [filterFag, setFilterFag] = useState("");
  const [valgtElev, setValgtElev] = useState<string | null>(null);
  const [synligeKolonner, setSynligeKolonner] = useState<Set<Synlig>>(
    new Set(STANDARD),
  );
  const [sortering, setSortering] = useState<Sortering>({
    kolonne: "fornavn",
    stigende: true,
  });

  async function last() {
    setElever(await hentElever(skolearId));
    setKlasser(await hentKlasser(skolearId));
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

  // Panelet tar to tredeler av bredden, så da vises bare navnet.
  const vis: ReadonlySet<Synlig> = valgtElev ? new Set<Synlig>() : synligeKolonner;

  const synlige = useMemo(() => {
    const s = sok.trim().toLocaleLowerCase("nb-NO");
    const filtrert = elever.filter((e) => {
      if (filterKlasse && e.klasseId !== filterKlasse) return false;
      if (filterFag && !e.fagIder.includes(filterFag)) return false;
      if (s && !`${e.fornavn} ${e.etternavn}`.toLocaleLowerCase("nb-NO").includes(s))
        return false;
      return true;
    });
    return sorter(filtrert, sortering);
  }, [elever, sok, filterKlasse, filterFag, sortering]);

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
    <div className="flex h-full">
      <div className={`min-w-0 overflow-y-auto ${valgtElev ? "hidden w-full pr-4 lg:block lg:w-1/3" : "w-full"}`}>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <Felt verdi={sok} settVerdi={setSok} plassholder="Søk etter navn" bredde="w-56" />

        <Velger
          verdi={filterKlasse}
          settVerdi={setFilterKlasse}
          tom="Alle klasser"
          valg={klasser.map((k) => ({ id: k.id, tekst: `${k.navn} (${k.antall})` }))}
        />
        <Velger
          verdi={filterFag}
          settVerdi={setFilterFag}
          tom="Alle fag"
          valg={fag.map((f) => ({ id: f.id, tekst: f.kode }))}
        />

        <div className="ml-auto flex items-center gap-2">
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

      {elever.length === 0 ? (
        <Tomtilstand
          tekst="Ingen elever i dette skoleåret ennå."
          handling={<Knapp variant="primar" onClick={onLimInn}>Lim inn en klasseliste</Knapp>}
        />
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-neutral-300 text-left text-[11px] uppercase tracking-wide text-neutral-500">
              <Overskrift kolonne="fornavn" sortering={sortering} onKlikk={bytSortering}>
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
                <Overskrift kolonne="kode" sortering={sortering} onKlikk={bytSortering}>
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
              {vis.has("fag") && (
                <Overskrift kolonne="fag" sortering={sortering} onKlikk={bytSortering}>
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
                valgt={valgtElev === e.id}
                vis={vis}
                onApne={() => setValgtElev(e.id)}
                onEndret={last}
              />
            ))}
            <NyElevRad
              kolonner={2 + vis.size}
              skolearId={skolearId}
              arvKlasse={filterKlasse || null}
              arvFag={filterFag || null}
              onLagret={last}
            />
          </tbody>
        </table>
        </div>
      )}

      <p className="mt-3 text-[12px] text-neutral-500">
        {synlige.length} av {elever.length} elever
      </p>
      </div>

      {valgtElev && (
        <div className="min-w-0 w-full lg:w-2/3">
          <ElevPanel
            key={valgtElev}
            elevId={valgtElev}
            aktivtSkolearId={skolearId}
            onLukk={() => setValgtElev(null)}
            onApneOkt={onApneOkt}
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
  | "fag"
  | "okter"
  | "siste";
type Sortering = { kolonne: Kolonne; stigende: boolean };

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
      case "klasse":
        // Elever uten klasse havner sist begge veier — de er ikke «minst».
        if (!a.klasseNavn !== !b.klasseNavn) return a.klasseNavn ? -1 : 1;
        return tekst(a.klasseNavn).localeCompare(tekst(b.klasseNavn), "nb-NO");
      case "fag":
        return a.fagKoder.join(",").localeCompare(b.fagKoder.join(","), "nb-NO");
      case "okter":
        return a.okter - b.okter;
      case "siste":
        if (!a.siste !== !b.siste) return a.siste ? -1 : 1;
        return tekst(a.siste).localeCompare(tekst(b.siste));
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
    <th className="whitespace-nowrap py-1 pr-5 font-normal">
      <button
        onClick={() => onKlikk(kolonne)}
        className={`flex w-full items-center gap-1 uppercase tracking-wide hover:text-neutral-900 ${
          hoyre ? "justify-end" : ""
        } ${aktiv ? "text-neutral-900" : ""}`}
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
      className="rounded border border-neutral-300 bg-white px-2 py-1.5 text-[13px]"
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
  valgt,
  vis,
  onApne,
  onEndret,
}: {
  elev: ElevRad;
  fag: FagIAr[];
  klasser: Klasse[];
  skolearId: string;
  valgt: boolean;
  vis: ReadonlySet<Synlig>;
  onApne: () => void;
  onEndret: () => void;
}) {
  const [apenFag, setApenFag] = useState(false);
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
      className={`border-b border-neutral-100 ${
        valgt ? "bg-[#eaf0f6]" : "hover:bg-[#f4f7fa]"
      }`}
    >
      <td className="whitespace-nowrap py-1.5 pr-5">
        <button
          onClick={onApne}
          className="text-left hover:text-[#1d4e7c] hover:underline"
        >
          {elev.fornavn}
        </button>
      </td>
      {vis.has("etternavn") && (
        <td className="whitespace-nowrap py-1.5 pr-5">
          <button
            onClick={onApne}
            className="text-left hover:text-[#1d4e7c] hover:underline"
          >
            {elev.etternavn}
          </button>
        </td>
      )}
      {vis.has("kode") && (
        <td className="whitespace-nowrap py-1.5 pr-5 font-mono text-[12px] tabular-nums text-neutral-400">
          {elev.kode}
        </td>
      )}
      <td className={`py-1.5 pr-5 ${vis.has("klasse") ? "" : "hidden"}`}>
        {skriverKlasse ? (
          <input
            autoFocus
            placeholder="1STC"
            onBlur={(e) => void lagKlasse(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setSkriverKlasse(false);
            }}
            className="w-full rounded border border-[#1d4e7c] px-1 py-0.5 outline-none"
          />
        ) : (
          <select
            value={elev.klasseId ?? ""}
            onChange={(e) => byttKlasse(e.target.value)}
            className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-neutral-300 focus:border-[#1d4e7c] focus:outline-none"
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
      <td className={`relative py-1.5 pr-5 ${vis.has("fag") ? "" : "hidden"}`}>
        <button
          onClick={() => setApenFag((v) => !v)}
          className="w-full rounded border border-transparent px-1 py-0.5 text-left hover:border-neutral-300"
        >
          {elev.fagIder.length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {elev.fagIder.map((id) => {
                const f = fag.find((x) => x.id === id);
                return f ? <Fagmerke key={id} kode={f.kode} farge={f.farge} /> : null;
              })}
            </span>
          ) : (
            <span className="text-neutral-400">ingen fag</span>
          )}
        </button>
        {apenFag && (
          <div className="absolute left-0 top-full z-10 mt-1 w-56 rounded border border-neutral-300 bg-white p-2 shadow-lg">
            {fag.map((f) => (
              <label
                key={f.id}
                className="flex items-center gap-2 py-0.5 text-[13px] hover:bg-neutral-50"
              >
                <input
                  type="checkbox"
                  checked={elev.fagIder.includes(f.id)}
                  onChange={async (e) => {
                    if (e.target.checked) await koblePaFag(elev.id, f.id);
                    else await frakobleFag(elev.id, f.id);
                    onEndret();
                  }}
                />
                <Fagmerke kode={f.kode} farge={f.farge} />
                <span className="truncate text-neutral-500">{f.navn}</span>
              </label>
            ))}
            <button
              onClick={() => setApenFag(false)}
              className="mt-1 w-full border-t border-neutral-200 pt-1 text-[12px] text-neutral-500"
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
        <td className="whitespace-nowrap py-1.5 pr-5 text-right tabular-nums text-neutral-500">
          {elev.siste ? dagerSiden(elev.siste) : "–"}
        </td>
      )}
      <td />
    </tr>
  );
}

function dagerSiden(dato: string): string {
  const dager = Math.round((Date.now() - new Date(dato).getTime()) / 86_400_000);
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
  arvKlasse,
  arvFag,
  onLagret,
}: {
  kolonner: number;
  skolearId: string;
  arvKlasse: string | null;
  arvFag: string | null;
  onLagret: () => void;
}) {
  const [navn, setNavn] = useState("");
  const felt = useRef<HTMLInputElement>(null);

  async function lagre() {
    const { fornavn, etternavn } = delNavn(navn);
    if (fornavn.trim() === "") return;

    const id = await opprettElev(fornavn, etternavn);
    if (arvKlasse) await settKlasse(id, skolearId, arvKlasse);
    if (arvFag) await koblePaFag(id, arvFag);

    setNavn("");
    onLagret();
    felt.current?.focus();
  }

  return (
    <tr>
      <td colSpan={kolonner} className="py-1.5">
        <input
          ref={felt}
          value={navn}
          onChange={(e) => setNavn(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void lagre();
            }
          }}
          placeholder="+ Legg til elev …"
          className="w-full rounded border border-transparent px-1 py-0.5 text-neutral-600 outline-none placeholder:text-neutral-400 hover:border-neutral-300 focus:border-[#1d4e7c]"
        />
      </td>
    </tr>
  );
}

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
        <h2 className="text-[15px] font-semibold">Klasser</h2>
        <Knapp variant="stille" onClick={onTilbake}>
          Tilbake til elevene
        </Knapp>
      </div>

      {klasser.length === 0 ? (
        <Tomtilstand tekst="Ingen klasser ennå. De opprettes når du limer inn en liste." />
      ) : (
        <table className="w-full text-[13px]">
          <tbody>
            {klasser.map((k) => (
              <tr key={k.id} className="border-b border-neutral-100">
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
                    className="rounded border border-transparent px-1 py-0.5 hover:border-neutral-300 focus:border-[#1d4e7c] focus:outline-none"
                  />
                </td>
                <td className="w-24 py-1.5 text-right tabular-nums text-neutral-500">
                  {k.antall} elever
                </td>
                <td className="w-20 py-1.5 text-right">
                  <button
                    onClick={async () => {
                      const svar = confirm(
                        k.antall > 0
                          ? `${k.navn} har ${k.antall} elever. De blir stående uten klasse — ingen elever slettes. Slette klassen?`
                          : `Slette ${k.navn}?`,
                      );
                      if (!svar) return;
                      await slettKlasse(k.id);
                      onEndret();
                    }}
                    className="text-[12px] text-neutral-400 hover:text-red-700"
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
