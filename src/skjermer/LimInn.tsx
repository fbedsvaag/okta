import { useState } from "react";
import { parseListe } from "../import/parser";
import { vurderImport } from "../import/duplikat";
import { tilImportrader, utforImport, type Importrad } from "../import/utfor";
import { hentForDuplikatsjekk } from "../data/elever";
import type { FagIAr } from "../data/fag";
import { Felt, Knapp } from "../ui/felles";

/**
 * Lim inn klasseliste, SPEC §7. Ingenting skrives til databasen før
 * "Importer" er trykket — forhåndsvisningen er hele poenget.
 */
export function LimInn({
  skolearId,
  fag,
  startFagId,
  onFerdig,
  onAvbryt,
}: {
  skolearId: string;
  fag: FagIAr[];
  startFagId?: string;
  onFerdig: (melding: string) => void;
  onAvbryt: () => void;
}) {
  const [fagId, setFagId] = useState(startFagId ?? fag[0]?.id ?? "");
  const [klasse, setKlasse] = useState("");
  const [tekst, setTekst] = useState("");
  const [rader, setRader] = useState<Importrad[] | null>(null);
  const [hoppet, setHoppet] = useState(0);
  const [jobber, setJobber] = useState(false);

  async function forhandsvis() {
    const { elever, hoppetOver } = parseListe(tekst);
    if (elever.length === 0) return;

    const eksisterende = await hentForDuplikatsjekk(skolearId);
    const vurderinger = vurderImport(elever, eksisterende, {
      skolearFagId: fagId,
      valgtKlasse: klasse.trim() === "" ? null : klasse.trim(),
    });

    setRader(tilImportrader(vurderinger, klasse.trim()));
    setHoppet(hoppetOver.length);
  }

  async function importer() {
    if (!rader) return;
    setJobber(true);
    try {
      const r = await utforImport(rader, skolearId, fagId);
      const kode = fag.find((f) => f.id === fagId)?.kode ?? "faget";
      onFerdig(
        `${kode}: ${r.opprettet} nye elever, ${r.koblet} koblet fra før` +
          (r.hoppet > 0 ? `, ${r.hoppet} hoppet over` : ""),
      );
    } finally {
      setJobber(false);
    }
  }

  function endre(i: number, felter: Partial<Importrad>) {
    setRader((r) => r?.map((rad, j) => (j === i ? { ...rad, ...felter } : rad)) ?? null);
  }

  if (rader) {
    const nye = rader.filter((r) => !r.hopp && r.status !== "allerede" && r.valgt === "ny");
    const koblet = rader.filter((r) => !r.hopp && r.status !== "allerede" && r.valgt !== "ny");
    const over = rader.filter((r) => r.hopp || r.status === "allerede");

    return (
      <div className="mx-auto max-w-4xl">
        <h2 className="text-[15px] font-semibold">Forhåndsvisning</h2>
        <p className="mt-1 text-[13px] text-neutral-500">
          {nye.length} nye · {koblet.length} kobles til faget · {over.length}{" "}
          hoppes over
          {hoppet > 0 && ` · ${hoppet} overskriftslinjer ignorert`}
        </p>

        <table className="mt-4 w-full text-[13px]">
          <thead>
            <tr className="border-b border-neutral-300 text-left text-[11px] uppercase tracking-wide text-neutral-500">
              <th className="py-1 font-normal">Navn</th>
              <th className="py-1 font-normal">Klasse</th>
              <th className="py-1 font-normal">Status</th>
              <th className="py-1 font-normal">Handling</th>
            </tr>
          </thead>
          <tbody>
            {rader.map((rad, i) => (
              <ForhandsvisRad key={rad.linje.linjenr} rad={rad} onEndre={(f) => endre(i, f)} />
            ))}
          </tbody>
        </table>

        <div className="mt-5 flex gap-2">
          <Knapp variant="primar" onClick={importer} disabled={jobber}>
            {jobber ? "Importerer …" : `Importer ${nye.length + koblet.length} elever`}
          </Knapp>
          <Knapp variant="stille" onClick={() => setRader(null)}>
            Tilbake til teksten
          </Knapp>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-[15px] font-semibold">Lim inn klasseliste</h2>
      <p className="mt-1 text-[13px] text-neutral-500">
        Én elev per linje. Parseren tåler <code>Anna Reistad</code>,{" "}
        <code>Reistad, Anna</code>, punktlister og nummererte lister.
        Overskrifter hoppes over.
      </p>

      <div className="mt-4 flex gap-3">
        <label className="block w-1/2">
          <span className="mb-1 block text-[11px] uppercase tracking-wide text-neutral-500">
            Fag
          </span>
          <select
            value={fagId}
            onChange={(e) => setFagId(e.target.value)}
            className="w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-[13px]"
          >
            {fag.map((f) => (
              <option key={f.id} value={f.id}>
                {f.kode} — {f.navn}
              </option>
            ))}
          </select>
        </label>
        <Felt
          etikett="Klasse"
          verdi={klasse}
          settVerdi={setKlasse}
          plassholder="1STC"
          bredde="w-1/2"
        />
      </div>
      <p className="mt-1 text-[12px] text-neutral-500">
        Klassen brukes på linjer som ikke har klasse selv. Står den tom, blir
        elevene stående uten klasse — det er lov.
      </p>

      <textarea
        value={tekst}
        onChange={(e) => setTekst(e.target.value)}
        rows={14}
        placeholder={"Tony Soprano\nCarmela Soprano\nAdriana La Cerva"}
        className="mt-3 w-full rounded border border-neutral-300 px-2 py-2 font-mono text-[12px] outline-none focus:border-[#1d4e7c]"
      />

      <div className="mt-3 flex gap-2">
        <Knapp variant="primar" onClick={forhandsvis} disabled={tekst.trim() === "" || !fagId}>
          Forhåndsvis
        </Knapp>
        <Knapp variant="stille" onClick={onAvbryt}>
          Avbryt
        </Knapp>
      </div>
    </div>
  );
}

function ForhandsvisRad({
  rad,
  onEndre,
}: {
  rad: Importrad;
  onEndre: (felter: Partial<Importrad>) => void;
}) {
  const merke = {
    ny: { tekst: "Ny elev", stil: "text-neutral-500" },
    samme: { tekst: "Finnes fra før", stil: "text-[#1d4e7c]" },
    allerede: { tekst: "Står alt i faget", stil: "text-neutral-400" },
    spor: { tekst: "Usikker", stil: "text-[#8a5a00]" },
  }[rad.status];

  const forklaring = {
    "ulik-klasse": `Finnes i ${rad.klassekonflikt?.finnesI} — importen sier ${rad.klassekonflikt?.importenSier}`,
    "naer-match": `Ligner ${rad.kandidater.map((k) => `${k.fornavn} ${k.etternavn}`).join(", ")}`,
    "flere-treff": `${rad.kandidater.length} elever heter dette`,
    "annet-fag": rad.kandidater[0]
      ? `${rad.kandidater[0].klasse ?? "ingen klasse"} · ${rad.kandidater[0].fag.join(", ") || "ingen fag"}`
      : "",
    "allerede-i-faget": "Linja hoppes over",
    "ingen-match": "",
  }[rad.grunn];

  return (
    <tr className={`border-b border-neutral-100 ${rad.hopp ? "opacity-40" : ""}`}>
      <td className="py-1.5">
        {rad.linje.fornavn} {rad.linje.etternavn}
      </td>
      <td className="py-1.5">
        <input
          value={rad.klasse}
          onChange={(e) => onEndre({ klasse: e.target.value })}
          className="w-20 rounded border border-transparent px-1 py-0.5 tabular-nums hover:border-neutral-300 focus:border-[#1d4e7c] focus:outline-none"
        />
      </td>
      <td className={`py-1.5 ${merke.stil}`}>
        {merke.tekst}
        {forklaring && (
          <span className="ml-2 text-[12px] text-neutral-400">{forklaring}</span>
        )}
      </td>
      <td className="py-1.5">
        {rad.status === "allerede" ? (
          <span className="text-neutral-400">hoppes over</span>
        ) : (
          <div className="flex items-center gap-2">
            <select
              value={rad.valgt}
              onChange={(e) => onEndre({ valgt: e.target.value })}
              className="rounded border border-neutral-300 bg-white px-1 py-0.5 text-[12px]"
            >
              <option value="ny">Ny elev</option>
              {rad.kandidater.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.fornavn} {k.etternavn}
                  {k.klasse ? ` (${k.klasse})` : ""}
                </option>
              ))}
            </select>
            {rad.klassekonflikt && rad.valgt !== "ny" && (
              <label className="flex items-center gap-1 text-[12px] text-neutral-500">
                <input
                  type="checkbox"
                  checked={rad.byttKlasse}
                  onChange={(e) => onEndre({ byttKlasse: e.target.checked })}
                />
                bytt til {rad.klassekonflikt.importenSier}
              </label>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
