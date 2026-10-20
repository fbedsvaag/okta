import { useState } from "react";
import { parseListe } from "../import/parser";
import { erFullereNavn, vurderImport } from "../import/duplikat";
import {
  ikkePaLista,
  tilImportrader,
  utforImport,
  type Importrad,
} from "../import/utfor";
import type { EksisterendeElev } from "../import/duplikat";
import { frakobleFag, hentForDuplikatsjekk, settKjonn } from "../data/elever";
import { gjettKjonn, nesteKjonn, type Kjonnsvalg } from "../import/kjonn";
import { settElevbilde } from "../data/elevbilde";
import { lesInschool, navnenokkel, somLimInnTekst } from "../import/inschool";
import { Elevbilde } from "../ui/Elevbilde";
import type { FagIAr } from "../data/fag";
import { Bryter, Felt, Knapp } from "../ui/felles";
import { Velger } from "../ui/Velger";

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
  // Mentorgruppa limes inn uten fag: du er mentor for elever du ikke
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
  // Bildene fra en InSchool-PDF, klippet ut og klare, etter navnenøkkel.
  // Lagres på elevene først når importen bekreftes.
  const [bilder, setBilder] = useState<Map<string, string>>(new Map());
  const [pdfMelding, setPdfMelding] = useState<string | null>(null);
  // Kjønnet for hver linje (9.8): gjettet fra fornavnet, eller valgt. Bare
  // nye elever får det — de som finnes fra før, beholder sitt.
  const [kjonn, setKjonn] = useState<Map<number, Kjonnsvalg>>(new Map());
  const [leserPdf, setLeserPdf] = useState(false);

  /**
   * Leser klasselista og bildene fra InSchool-utskriften. Navnene går inn i
   * tekstfeltet som «navn; klasse», så resten er den vanlige flyten:
   * forhåndsvisning, duplikatsjekk, bekreftelse (§7).
   */
  async function lesPdf(fil: File) {
    setLeserPdf(true);
    setPdfMelding(null);
    try {
      const { apnePdf } = await import("../import/pdf");
      const pdf = await apnePdf(new Uint8Array(await fil.arrayBuffer()));
      const r = lesInschool(pdf.sider);
      if (r.elever.length === 0) {
        setPdfMelding(
          "Fant ingen klasseliste i PDF-en. Er det utskriften fra InSchool?",
        );
        return;
      }
      const klipt = new Map<string, string>();
      for (const b of r.bilder)
        klipt.set(navnenokkel(b.navn), await pdf.klipp(b.side, b.plass));
      setBilder(klipt);
      setTekst(somLimInnTekst(r.elever));

      // Faget i toppen av utskriften, når det finnes i året.
      const treff = r.fagkode
        ? fag.find(
            (f) =>
              f.grepKode === r.fagkode ||
              f.fagkode === r.fagkode ||
              f.kode === r.fagkode,
          )
        : undefined;
      const valgt = fag.find((f) => f.id === fagId);
      let omFag = "";
      if (treff && !startFagId) setFagId(treff.id);
      else if (r.fagkode && valgt && treff?.id !== valgt.id)
        omFag = ` NB: PDF-en er for ${r.fagkode}, men du legger inn i ${valgt.kode}.`;
      setPdfMelding(
        `Leste ${r.elever.length} elever og ${klipt.size} bilder fra ` +
          `${fil.name}.${omFag}`,
      );
    } catch (e) {
      setPdfMelding(`Kunne ikke lese PDF-en: ${String(e)}`);
    } finally {
      setLeserPdf(false);
    }
  }

  const bildeFor = (rad: Importrad) =>
    bilder.get(navnenokkel(`${rad.linje.fornavn} ${rad.linje.etternavn}`));

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
    setKjonn(
      new Map(
        nye.map((r) => [
          r.linje.linjenr,
          { k: gjettKjonn(r.linje.fornavn), bekreftet: false },
        ]),
      ),
    );
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
      // Kjønn bare på nye elever; de som fantes fra før, beholder sitt.
      for (const rad of rader) {
        const id = r.elevIder.get(rad.linje.linjenr);
        const v = kjonn.get(rad.linje.linjenr);
        if (id && rad.valgt === "ny" && !rad.hopp && v?.k)
          await settKjonn(id, v.k, v.bekreftet ? "satt" : "gjettet");
      }
      let medBilde = 0;
      for (const rad of rader) {
        const id = r.elevIder.get(rad.linje.linjenr);
        const bilde = bildeFor(rad);
        if (id && bilde) {
          await settElevbilde(id, bilde, "InSchool");
          medBilde++;
        }
      }
      const hvor = fagId
        ? (fag.find((f) => f.id === fagId)?.kode ?? "faget")
        : somMentor
          ? "Mentorgruppa"
          : "Uten fag";
      onFerdig(
        `${hvor}: ${r.opprettet} nye elever, ${r.koblet} fantes fra før` +
          (r.hoppet > 0 ? `, ${r.hoppet} hoppet over` : "") +
          (utIder.length > 0 ? `, ${utIder.length} tatt ut av faget` : "") +
          (medBilde > 0 ? `, ${medBilde} bilder lagt på` : "") +
          (r.navnByttet > 0 ? `, ${r.navnByttet} navn oppdatert` : ""),
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
    // Tellingen øverst: bare de nye elevene får kjønn fra importen.
    const kjonnNye = nye.map(
      (r) => kjonn.get(r.linje.linjenr) ?? { k: null, bekreftet: false },
    );
    const maVelges = kjonnNye.filter((v) => !v.k).length;
    const gjettet = kjonnNye.filter((v) => v.k && !v.bekreftet).length;

    return (
      <div className="mx-auto min-h-0 w-full max-w-4xl flex-1 overflow-auto">
        <h2 className="text-tittel font-medium">Forhåndsvisning</h2>
        <p className="mt-1 text-brod text-blekk-dempet">
          {nye.length} nye · {koblet.length} kobles til faget · {over.length}{" "}
          hoppes over
          {hoppet > 0 && ` · ${hoppet} overskriftslinjer ignorert`}
        </p>

        {/*
          Kjønn (9.8): gjettet fra fornavnet med SSBs navneliste, som følger
          appen. Brukes bare til «Bland jenter og gutter» i klassekartet.
        */}
        {nye.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-stor bg-flate px-3.5 py-2.5 text-liten">
            <span className="min-w-0 flex-1 text-blekk-dempet">
              Kjønn er gjettet fra fornavnet med SSBs navneliste, som følger med
              appen. Ingenting sendes ut. Brukes bare til «bland jenter og
              gutter» i klassekartet, og vises aldri på utskrift eller eksport.
              Klikk for å bytte.
            </span>
            <span
              className={maVelges > 0 ? "text-varsel" : "text-blekk-dempet"}
            >
              {maVelges > 0
                ? `${maVelges} må velges · ${gjettet} gjettet`
                : gjettet > 0
                  ? `${gjettet} gjettet, resten bekreftet`
                  : "Alle bekreftet"}
            </span>
            <button
              disabled={gjettet === 0}
              onClick={() =>
                setKjonn(
                  (m) =>
                    new Map(
                      [...m].map(([n, v]) => [
                        n,
                        v.k ? { ...v, bekreftet: true } : v,
                      ]),
                    ),
                )
              }
              className="flex h-[30px] items-center rounded-full border border-linje bg-ark px-3 text-[13px] hover:bg-flate disabled:opacity-40"
            >
              Bekreft alle gjettede
            </button>
          </div>
        )}

        <table className="mt-4 w-full text-brod">
          <thead>
            <tr className="border-b border-linje text-left text-etikett uppercase tracking-etikett text-blekk-dempet">
              <th className="py-1 font-normal">Navn</th>
              <th className="py-1 font-normal">Klasse</th>
              <th className="py-1 font-normal">Kjønn</th>
              <th className="py-1 font-normal">Status</th>
              <th className="py-1 font-normal">Handling</th>
            </tr>
          </thead>
          <tbody>
            {rader.map((rad, i) => (
              <ForhandsvisRad
                key={rad.linje.linjenr}
                rad={rad}
                bilde={bildeFor(rad)}
                kjonn={
                  kjonn.get(rad.linje.linjenr) ?? { k: null, bekreftet: false }
                }
                onKjonn={() =>
                  setKjonn((m) => {
                    const ny = new Map(m);
                    ny.set(
                      rad.linje.linjenr,
                      nesteKjonn(
                        m.get(rad.linje.linjenr) ?? {
                          k: null,
                          bekreftet: false,
                        },
                      ),
                    );
                    return ny;
                  })
                }
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
            <h3 className="text-brod font-semibold text-blekk">
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
                    Ingen. Alle i faget står på lista.
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
      <h2 className="text-tittel font-medium">Lim inn klasseliste</h2>
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
          <Velger
            verdi={fagId}
            settVerdi={setFagId}
            bredde="w-full"
            valg={[
              ...fag.map((f) => ({
                verdi: f.id,
                tekst: `${f.kode} · ${f.navn}`,
                farge: f.farge,
                firkant: true,
              })),
              { verdi: "", tekst: "Uten fag (mentorelever)" },
            ]}
          />
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
        elevene stående uten klasse. Det er lov.
      </p>

      {fagId !== "" && (
        <label className="mt-2 flex select-none items-center gap-2 text-brod">
          <input
            type="checkbox"
            checked={erstatt}
            onChange={(e) => setErstatt(e.target.checked)}
          />
          Lista er hele faget: ta ut dem som ikke står på den
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

      {/*
        InSchool-utskriften: navn og klasse fra tabellen, bildene fra
        rutenettet. Fila leses her på maskinen og sendes ingen steder.
      */}
      <div className="mt-3 flex items-center gap-3">
        <label
          className={`cursor-pointer rounded-vanlig border border-linje bg-ark px-3 py-1 text-brod hover:bg-flate ${leserPdf ? "opacity-50" : ""}`}
        >
          {leserPdf ? "Leser PDF …" : "Les fra InSchool-PDF …"}
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            disabled={leserPdf}
            onChange={(e) => {
              const fil = e.target.files?.[0];
              if (fil) void lesPdf(fil);
              e.target.value = "";
            }}
          />
        </label>
        {pdfMelding && (
          <span className="text-liten text-blekk-dempet" role="status">
            {pdfMelding}
          </span>
        )}
      </div>

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
  bilde,
  kjonn,
  onKjonn,
  onEndre,
}: {
  rad: Importrad;
  /** bildet fra PDF-en, når det finnes */
  bilde?: string;
  kjonn: Kjonnsvalg;
  onKjonn: () => void;
  onEndre: (felter: Partial<Importrad>) => void;
}) {
  const merke = {
    ny: { tekst: "Ny elev", stil: "text-blekk-dempet" },
    samme: { tekst: "Finnes fra før", stil: "text-aksent" },
    allerede: { tekst: "Står alt i faget", stil: "text-blekk-svak" },
    spor: { tekst: "Usikker", stil: "text-varsel" },
  }[rad.status];

  const forklaring = {
    "ulik-klasse": `Finnes i ${rad.klassekonflikt?.finnesI}, importen sier ${rad.klassekonflikt?.importenSier}`,
    "naer-match": `Ligner ${rad.kandidater.map((k) => `${k.fornavn} ${k.etternavn}`).join(", ")}`,
    "flere-treff": `${rad.kandidater.length} elever heter dette`,
    "annet-fag": rad.kandidater[0]
      ? `${rad.kandidater[0].klasse ?? "ingen klasse"} · ${rad.kandidater[0].fag.join(", ") || "ingen fag"}`
      : "",
    "allerede-i-faget": "Linja hoppes over",
    "fullere-navn": rad.kandidater[0]
      ? `Står som «${rad.kandidater[0].fornavn} ${rad.kandidater[0].etternavn}»`
      : "",
    "ingen-match": "",
  }[rad.grunn];

  const valgtElev = rad.kandidater.find((k) => k.id === rad.valgt);
  const navnUlikt =
    valgtElev !== undefined &&
    `${valgtElev.fornavn} ${valgtElev.etternavn}` !==
      `${rad.linje.fornavn} ${rad.linje.etternavn}`;

  return (
    <tr
      className={`border-b border-linje-svak ${rad.hopp ? "opacity-40" : ""}`}
    >
      <td className="py-1.5">
        {bilde && (
          <Elevbilde
            src={bilde}
            storrelse={28}
            klasse="mr-2 inline-block align-middle"
          />
        )}
        {rad.linje.fornavn} {rad.linje.etternavn}
      </td>
      <td className="py-1.5">
        <input
          value={rad.klasse}
          onChange={(e) => onEndre({ klasse: e.target.value })}
          className="w-20 rounded border border-transparent px-1 py-0.5 tabular-nums hover:border-linje focus:border-aksent focus:outline-none"
        />
      </td>
      <td className="py-1.5">
        {rad.valgt === "ny" && !rad.hopp ? (
          <Kjonnspille verdi={kjonn} onKlikk={onKjonn} />
        ) : (
          <span
            className="text-liten text-blekk-svak"
            title="Eleven finnes fra før og beholder det som står der"
          >
            fra før
          </span>
        )}
      </td>
      <td className={`py-1.5 ${merke.stil}`}>
        {merke.tekst}
        {forklaring && (
          <span className="ml-2 text-liten text-blekk-svak">{forklaring}</span>
        )}
      </td>
      <td className="py-1.5">
        {rad.status === "allerede" ? (
          valgtElev && navnUlikt ? (
            <Navnebytte rad={rad} gammel={valgtElev} onEndre={onEndre} />
          ) : (
            <span className="text-blekk-svak">hoppes over</span>
          )
        ) : (
          <div className="flex items-center gap-2">
            {/*
              Én kandidat: et ja/nei-spørsmål (DESIGN.md §10). Valget kan
              byttes fram og tilbake — ingenting skrives før importen
              bekreftes. Flere kandidater: velg i lista.
            */}
            {rad.kandidater.length === 1 ? (
              <Bryter
                storrelse="liten"
                verdi={rad.valgt === "ny" ? "ny" : "samme"}
                settVerdi={(v) => {
                  const k = rad.kandidater[0];
                  onEndre(
                    v === "ny"
                      ? { valgt: "ny", byttNavn: false }
                      : { valgt: k.id, byttNavn: erFullereNavn(rad.linje, k) },
                  );
                }}
                valg={[
                  {
                    id: "samme",
                    navn: "Ja, samme elev",
                    tittel: `${rad.kandidater[0].fornavn} ${rad.kandidater[0].etternavn}${
                      rad.kandidater[0].klasse
                        ? ` (${rad.kandidater[0].klasse})`
                        : ""
                    }`,
                  },
                  { id: "ny", navn: "Nei, en annen" },
                ]}
              />
            ) : (
              <Velger
                verdi={rad.valgt}
                settVerdi={(v) => {
                  const k = rad.kandidater.find((x) => x.id === v);
                  // Et fullere navn fra lista tas med av seg selv; et annet
                  // navn må velges med vilje.
                  onEndre({
                    valgt: v,
                    byttNavn: k ? erFullereNavn(rad.linje, k) : false,
                  });
                }}
                variant="liten"
                etikett="Elev"
                valg={[
                  { verdi: "ny", tekst: "Ny elev" },
                  ...rad.kandidater.map((k) => ({
                    verdi: k.id,
                    tekst: `${k.fornavn} ${k.etternavn}`,
                    hint: k.klasse ?? undefined,
                  })),
                ]}
              />
            )}
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
            {valgtElev && navnUlikt && (
              <Navnebytte rad={rad} gammel={valgtElev} onEndre={onEndre} />
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

/**
 * Navnet fra lista på den eleven som finnes. Det fulle navnet fra skolen
 * slår det som ble skrevet inn for hånd — men bare når boksen er krysset av.
 */
function Navnebytte({
  rad,
  gammel,
  onEndre,
}: {
  rad: Importrad;
  gammel: { fornavn: string; etternavn: string };
  onEndre: (felter: Partial<Importrad>) => void;
}) {
  return (
    <label
      className="flex items-center gap-1 text-liten text-blekk-dempet"
      title={`Erstatter «${gammel.fornavn} ${gammel.etternavn}»`}
    >
      <input
        type="checkbox"
        checked={rad.byttNavn}
        onChange={(e) => onEndre({ byttNavn: e.target.checked })}
      />
      bruk navnet fra lista
    </label>
  );
}

/**
 * Kjønnet i forhåndsvisningen (lerretet «Import»): stiplet pille = gjettet,
 * fylt = bekreftet, gul «Velg» = navnet brukes om begge. Klikk bytter
 * Jente → Gutt → Ikke satt.
 */
function Kjonnspille({
  verdi,
  onKlikk,
}: {
  verdi: Kjonnsvalg;
  onKlikk: () => void;
}) {
  const stil = !verdi.k
    ? "bg-[color-mix(in_srgb,var(--color-lys-gul)_18%,var(--color-ark))] text-varsel"
    : verdi.bekreftet
      ? "bg-valgt font-medium text-aksent"
      : "border border-dashed border-linje-sterk text-blekk";
  return (
    <button
      onClick={onKlikk}
      title="Klikk for å bytte"
      className={`inline-flex h-6 items-center rounded-full px-2.5 text-[12.5px] ${stil}`}
    >
      {!verdi.k ? "Velg" : verdi.k === "j" ? "Jente" : "Gutt"}
    </button>
  );
}
