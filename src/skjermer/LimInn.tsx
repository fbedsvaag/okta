import { useState } from "react";
import { parseListe } from "../import/parser";
import { vurderImport } from "../import/duplikat";
import {
  ikkePaLista,
  tilImportrader,
  utforImport,
  type Importrad,
} from "../import/utfor";
import type { EksisterendeElev } from "../import/duplikat";
import { frakobleFag, hentForDuplikatsjekk } from "../data/elever";
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
  erstatt: erstattFraStart = false,
  onFerdig,
  onAvbryt,
}: {
  skolearId: string;
  fag: FagIAr[];
  startFagId?: string;
  /** lista er hele faget: de som ikke står på den, tas ut (slettes ikke) */
  erstatt?: boolean;
  onFerdig: (melding: string) => void;
  onAvbryt: () => void;
}) {
  const [fagId, setFagId] = useState(startFagId ?? fag[0]?.id ?? "");
  const [klasse, setKlasse] = useState("");
  // Mentorgruppa limes inn uten fag: du er kontaktlærer for elever du ikke
  // underviser, og da finnes det ingen fagkobling å lage (§7).
  const [somMentor, setSomMentor] = useState(false);
  const [tekst, setTekst] = useState("");
  const [rader, setRader] = useState<Importrad[] | null>(null);
  const [hoppet, setHoppet] = useState(0);
  const [jobber, setJobber] = useState(false);
  const [erstatt, setErstatt] = useState(erstattFraStart);
  // Elevene i faget i dag, og de av dem som skal tas ut. Forhåndsvalget er
  // alle som ikke står på lista; hver kan krysses av igjen.
  const [medlemmer, setMedlemmer] = useState<EksisterendeElev[]>([]);
  const [tasUt, setTasUt] = useState<Set<string>>(new Set());

  async function forhandsvis() {
    const { elever, hoppetOver } = parseListe(tekst);
    if (elever.length === 0) return;

    const eksisterende = await hentForDuplikatsjekk(skolearId);
    const vurderinger = vurderImport(elever, eksisterende, {
      skolearFagId: fagId || null,
      valgtKlasse: klasse.trim() === "" ? null : klasse.trim(),
    });

    const nye = tilImportrader(vurderinger, klasse.trim());
    setRader(nye);
    setHoppet(hoppetOver.length);
    const iFaget = fagId
      ? eksisterende.filter((e) => e.skolearFagIder.includes(fagId))
      : [];
    setMedlemmer(iFaget);
    setTasUt(
      new Set(
        ikkePaLista(
          nye,
          iFaget.map((e) => e.id),
        ),
      ),
    );
  }

  async function importer() {
    if (!rader) return;
    setJobber(true);
    try {
      const r = await utforImport(rader, skolearId, fagId || null, somMentor);
      const utIder =
        erstatt && fagId
          ? ikkePaLista(
              rader,
              medlemmer.map((e) => e.id),
            ).filter((id) => tasUt.has(id))
          : [];
      for (const id of utIder) await frakobleFag(id, fagId);
      const hvor = fagId
        ? (fag.find((f) => f.id === fagId)?.kode ?? "faget")
        : somMentor
          ? "Mentorgruppa"
          : "Uten fag";
      onFerdig(
        `${hvor}: ${r.opprettet} nye elever, ${r.koblet} fantes fra før` +
          (r.hoppet > 0 ? `, ${r.hoppet} hoppet over` : "") +
          (utIder.length > 0 ? `, ${utIder.length} tatt ut av faget` : ""),
      );
    } finally {
      setJobber(false);
    }
  }

  function endre(i: number, felter: Partial<Importrad>) {
    setRader(
      (r) =>
        r?.map((rad, j) => (j === i ? { ...rad, ...felter } : rad)) ?? null,
    );
  }

  if (rader) {
    const nye = rader.filter(
      (r) => !r.hopp && r.status !== "allerede" && r.valgt === "ny",
    );
    const koblet = rader.filter(
      (r) => !r.hopp && r.status !== "allerede" && r.valgt !== "ny",
    );
    const over = rader.filter((r) => r.hopp || r.status === "allerede");

    return (
      <div className="mx-auto min-h-0 w-full max-w-4xl flex-1 overflow-auto">
        <h2 className="font-display text-tittel">Forhåndsvisning</h2>
        <p className="mt-1 text-brod text-blekk-dempet">
          {nye.length} nye · {koblet.length} kobles til faget · {over.length}{" "}
          hoppes over
          {hoppet > 0 && ` · ${hoppet} overskriftslinjer ignorert`}
        </p>

        <table className="mt-4 w-full text-brod">
          <thead>
            <tr className="border-b border-linje text-left text-etikett uppercase tracking-etikett text-blekk-dempet">
              <th className="py-1 font-normal">Navn</th>
              <th className="py-1 font-normal">Klasse</th>
              <th className="py-1 font-normal">Status</th>
              <th className="py-1 font-normal">Handling</th>
            </tr>
          </thead>
          <tbody>
            {rader.map((rad, i) => (
              <ForhandsvisRad
                key={rad.linje.linjenr}
                rad={rad}
                onEndre={(f) => endre(i, f)}
              />
            ))}
          </tbody>
        </table>

        {/*
          Lista er hele faget: de som står i faget, men ikke på lista, tas
          ut. De slettes ikke — de står under Elever, uten fag om dette var
          det eneste, og slettes der om det er meningen.
        */}
        {erstatt && fagId && (
          <div className="mt-5">
            <h3 className="text-etikett uppercase tracking-etikett text-blekk-dempet">
              Står i faget, men ikke på lista
            </h3>
            {(() => {
              const ute = ikkePaLista(
                rader,
                medlemmer.map((e) => e.id),
              );
              if (ute.length === 0)
                return (
                  <p className="mt-1 text-brod text-blekk-svak">
                    Ingen — alle i faget står på lista.
                  </p>
                );
              return (
                <>
                  <p className="mt-1 text-liten text-blekk-dempet">
                    Krysset av = tas ut av faget. Eleven slettes ikke, og
                    skåringene blir liggende.
                  </p>
                  {medlemmer
                    .filter((e) => ute.includes(e.id))
                    .map((e) => (
                      <label
                        key={e.id}
                        className="flex items-center gap-2 py-0.5 text-brod"
                      >
                        <input
                          type="checkbox"
                          checked={tasUt.has(e.id)}
                          onChange={(ev) =>
                            setTasUt((f) => {
                              const ny = new Set(f);
                              if (ev.target.checked) ny.add(e.id);
                              else ny.delete(e.id);
                              return ny;
                            })
                          }
                        />
                        {e.fornavn} {e.etternavn}
                        {e.klasse && (
                          <span className="text-liten text-blekk-svak">
                            {e.klasse}
                          </span>
                        )}
                      </label>
                    ))}
                </>
              );
            })()}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <Knapp variant="primar" onClick={importer} disabled={jobber}>
            {jobber
              ? "Importerer …"
              : `Importer ${nye.length + koblet.length} elever`}
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
      <h2 className="font-display text-tittel">Lim inn klasseliste</h2>
      <p className="mt-1 text-brod text-blekk-dempet">
        Én elev per linje. Parseren tåler <code>Anna Reistad</code>,{" "}
        <code>Reistad, Anna</code>, punktlister og nummererte lister.
        Overskrifter hoppes over.
      </p>

      <div className="mt-4 flex gap-3">
        <label className="block w-1/2">
          <span className="mb-1 block text-etikett uppercase tracking-etikett text-blekk-dempet">
            Fag
          </span>
          <select
            value={fagId}
            onChange={(e) => setFagId(e.target.value)}
            className="w-full rounded border border-linje bg-ark px-2 py-1.5 text-brod"
          >
            {fag.map((f) => (
              <option key={f.id} value={f.id}>
                {f.kode} — {f.navn}
              </option>
            ))}
            <option value="">Uten fag — mentorelever</option>
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
      <p className="mt-1 text-liten text-blekk-dempet">
        Klassen brukes på linjer som ikke har klasse selv. Står den tom, blir
        elevene stående uten klasse — det er lov.
      </p>

      {fagId !== "" && (
        <label className="mt-2 flex select-none items-center gap-2 text-brod">
          <input
            type="checkbox"
            checked={erstatt}
            onChange={(e) => setErstatt(e.target.checked)}
          />
          Lista er hele faget — ta ut dem som ikke står på den
        </label>
      )}

      <label className="mt-2 flex select-none items-center gap-2 text-brod">
        <input
          type="checkbox"
          checked={somMentor}
          onChange={(e) => setSomMentor(e.target.checked)}
        />
        Merk dem som mentorelever dette året
      </label>
      {somMentor && klasse.trim() === "" && (
        <p className="mt-1 text-liten text-varsel">
          Mentormerket henger på klassen (§3.2). Linjer uten klasse blir
          opprettet, men ikke merket.
        </p>
      )}
      {fagId === "" && !somMentor && (
        <p className="mt-1 text-liten text-blekk-dempet">
          Uten fag opprettes elevene og plasseres i klassen, men kobles ikke til
          noe fag. Limer du dem inn i et fag senere, blir de gjenkjent.
        </p>
      )}

      <textarea
        value={tekst}
        onChange={(e) => setTekst(e.target.value)}
        rows={14}
        placeholder={"Tony Soprano\nCarmela Soprano\nAdriana La Cerva"}
        className="mt-3 w-full rounded border border-linje px-2 py-2 font-mono text-liten outline-none focus:border-aksent"
      />

      <div className="mt-3 flex gap-2">
        <Knapp
          variant="primar"
          onClick={forhandsvis}
          disabled={tekst.trim() === "" || !fagId}
        >
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
    ny: { tekst: "Ny elev", stil: "text-blekk-dempet" },
    samme: { tekst: "Finnes fra før", stil: "text-aksent" },
    allerede: { tekst: "Står alt i faget", stil: "text-blekk-svak" },
    spor: { tekst: "Usikker", stil: "text-varsel" },
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
    <tr
      className={`border-b border-linje-svak ${rad.hopp ? "opacity-40" : ""}`}
    >
      <td className="py-1.5">
        {rad.linje.fornavn} {rad.linje.etternavn}
      </td>
      <td className="py-1.5">
        <input
          value={rad.klasse}
          onChange={(e) => onEndre({ klasse: e.target.value })}
          className="w-20 rounded border border-transparent px-1 py-0.5 tabular-nums hover:border-linje focus:border-aksent focus:outline-none"
        />
      </td>
      <td className={`py-1.5 ${merke.stil}`}>
        {merke.tekst}
        {forklaring && (
          <span className="ml-2 text-liten text-blekk-svak">{forklaring}</span>
        )}
      </td>
      <td className="py-1.5">
        {rad.status === "allerede" ? (
          <span className="text-blekk-svak">hoppes over</span>
        ) : (
          <div className="flex items-center gap-2">
            <select
              value={rad.valgt}
              onChange={(e) => onEndre({ valgt: e.target.value })}
              className="rounded border border-linje bg-ark px-1 py-0.5 text-liten"
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
              <label className="flex items-center gap-1 text-liten text-blekk-dempet">
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
