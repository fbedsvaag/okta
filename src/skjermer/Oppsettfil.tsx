import { useEffect, useRef, useState } from "react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  filnavn,
  importerOppsett,
  lagOppsett,
  lesOppsett,
  planleggImport,
  plantekst,
  type Deler,
  type Importplan,
  type Oppsett,
} from "../data/oppsettfil";
import { Felt, Ikon, Knapp } from "../ui/felles";
import { filbehandler } from "../ui/plattformord";
import { filnavnAv, lagreFil } from "../data/filer";

/**
 * Oppsettfila i Innstillinger › Del oppsett (SPEC §8.2, ARBEIDSLISTE 5.13).
 *
 * Lag: kryss av for det som skal være med, skriv skolens navn, og lagre én
 * fil som sendes til kollegene. Les inn: samme fire trinn som i
 * veiviseren (les, sjekk, vis hva som skjer, skriv).
 */
export function DelOppsett({
  harAr,
  startTekst,
  onImportert,
}: {
  /** en oppsettfil åpnet med dobbeltklikk */
  startTekst?: string | null;
  /** det finnes et aktivt skoleår å lage fila fra */
  harAr: boolean;
  /** noe er lagt inn: appen laster skoleår og fag på nytt */
  onImportert: () => void;
}) {
  const [skole, setSkole] = useState("");
  const [deler, setDeler] = useState<Deler>({
    skolear: true,
    fag: true,
    oktlengde: true,
    skalaer: true,
  });
  const [melding, setMelding] = useState<{
    tekst: string;
    sti?: string;
  } | null>(null);
  const [jobber, setJobber] = useState(false);

  async function lag() {
    setJobber(true);
    setMelding(null);
    try {
      const oppsett = await lagOppsett({ skole, deler });
      const sti = await lagreFil({
        filnavn: filnavn(oppsett),
        filternavn: "Oppsettfil for Økta",
        endelse: "okta",
        innhold: new TextEncoder().encode(JSON.stringify(oppsett, null, 2)),
      });
      if (!sti) return;
      setMelding({
        tekst: `Lagret ${filnavnAv(sti)}. Send den til kollegene på Teams eller e-post. De dobbeltklikker på den, eller drar den inn i første steg av oppsettet.`,
        sti,
      });
    } catch (e) {
      setMelding({ tekst: `Kunne ikke lagre fila: ${String(e)}` });
    } finally {
      setJobber(false);
    }
  }

  const avkryss = (id: keyof Deler, navn: string, hjelp: string) => (
    <label className="flex cursor-pointer items-start gap-2.5 py-1">
      <input
        type="checkbox"
        className="mt-[3px]"
        checked={deler[id]}
        onChange={(e) => setDeler((d) => ({ ...d, [id]: e.target.checked }))}
      />
      <span>
        <span className="text-brod">{navn}</span>
        <span className="block text-liten text-blekk-dempet">{hjelp}</span>
      </span>
    </label>
  );

  return (
    <>
      <p className="mb-3 text-brod text-blekk-dempet">
        En oppsettfil gir en kollega skoleåret, fridagene og fagene dine, så de
        slipper å skrive dem inn selv. Den lages fra skoleåret du står i.
      </p>

      <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-x-6 border-b border-linje-svak py-3">
        <span className="pt-1 text-brod font-medium">Skole</span>
        <div>
          <Felt
            verdi={skole}
            settVerdi={setSkole}
            plassholder="BPG"
            bredde="w-40"
          />
          <p className="mt-1.5 text-liten text-blekk-dempet">
            Står i filnavnet og hos mottakeren: «Fra BPG». Valgfritt.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-x-6 border-b border-linje-svak py-3">
        <span className="pt-1 text-brod font-medium">Ta med</span>
        <div>
          {avkryss(
            "skolear",
            "Skoleåret og fridagene",
            "Start, slutt, ferier, planleggingsdager og hendelser.",
          )}
          {avkryss(
            "fag",
            "Fagene i år",
            "Kode, navn, alias, Udir-kode, årstimetall og øktlengde. Ikke farge og rom; det velger hver lærer selv.",
          )}
          {avkryss(
            "oktlengde",
            "Standard øktlengde",
            "Brukes bare hos en kollega som ikke har lagt inn økter ennå.",
          )}
          {avkryss(
            "skalaer",
            "Egne skalaer",
            "Skalaer du har laget selv. De innebygde har alle.",
          )}
          <p className="mt-3 rounded-stor bg-flate-svak px-3 py-2 text-liten text-blekk-dempet">
            Elever, notater, skåringer og vurderinger blir aldri med.
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Knapp
          variant="primar"
          disabled={!harAr || jobber}
          onClick={() => void lag()}
        >
          Lag oppsettfil …
        </Knapp>
        {!harAr && (
          <span className="text-liten text-blekk-svak">
            Opprett et skoleår først.
          </span>
        )}
      </div>
      {melding && (
        <p className="mt-3 text-liten text-blekk-dempet" role="status">
          {melding.tekst}{" "}
          {melding.sti && (
            <button
              onClick={() => void revealItemInDir(melding.sti!)}
              className="text-aksent hover:underline"
            >
              Vis i {filbehandler()}
            </button>
          )}
        </p>
      )}

      <h3 className="mb-2 mt-8 border-b border-linje-medium pb-1 text-brod font-semibold">
        Les inn en oppsettfil
      </h3>
      <Oppsettimport
        startTekst={startTekst}
        onImportert={() => onImportert()}
        etterpa="Fagene ligger nå i fagbanken. Legg dem til skoleåret under Fag."
      />
    </>
  );
}

/**
 * Les inn en oppsettfil: velg eller dra inn fila, se hva som skjer, legg
 * inn. Brukes i Innstillinger og i første steg av veiviseren.
 */
export function Oppsettimport({
  startTekst,
  onImportert,
  etterpa,
  knappetekst = "Legg inn",
}: {
  /** innholdet i en fil som er åpnet med dobbeltklikk */
  startTekst?: string | null;
  onImportert: (r: { skolearId: string | null; oppsett: Oppsett }) => void;
  /** setningen som står når importen er ferdig */
  etterpa?: string;
  knappetekst?: string;
}) {
  const [feil, setFeil] = useState<string[] | null>(null);
  const [plan, setPlan] = useState<Importplan | null>(null);
  const [ferdig, setFerdig] = useState(false);
  const [jobber, setJobber] = useState(false);
  const [drar, setDrar] = useState(false);
  const velger = useRef<HTMLInputElement>(null);

  async function les(tekst: string) {
    setFerdig(false);
    setPlan(null);
    const r = lesOppsett(tekst);
    if (!r.ok) {
      setFeil(r.feil);
      return;
    }
    setFeil(null);
    setPlan(await planleggImport(r.oppsett));
  }

  useEffect(() => {
    if (startTekst) void les(startTekst);
  }, [startTekst]);

  async function leggInn() {
    if (!plan) return;
    setJobber(true);
    try {
      const r = await importerOppsett(plan);
      setFerdig(true);
      onImportert({ skolearId: r.skolearId, oppsett: plan.oppsett });
    } catch (e) {
      setFeil([`Noe gikk galt, og ingenting ble lagt inn: ${String(e)}`]);
    } finally {
      setJobber(false);
    }
  }

  const fra = plan
    ? [plan.oppsett.laget_av, plan.oppsett.skole].filter(Boolean).join(", ")
    : "";

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrar(true);
        }}
        onDragLeave={() => setDrar(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setDrar(false);
          const fil = e.dataTransfer.files[0];
          if (fil) await les(await fil.text());
        }}
        className={`flex items-center gap-3 rounded-stor border border-dashed px-4 py-3 ${
          drar ? "border-aksent bg-flate" : "border-linje-sterk"
        }`}
      >
        <span className="text-liten text-blekk-dempet">
          Dra oppsettfila (.okta) hit, eller
        </span>
        <Knapp onClick={() => velger.current?.click()}>Velg fil …</Knapp>
        <input
          ref={velger}
          type="file"
          accept=".okta,application/json"
          className="hidden"
          onChange={async (e) => {
            const fil = e.target.files?.[0];
            e.target.value = "";
            if (fil) await les(await fil.text());
          }}
        />
      </div>

      {feil && (
        <div
          className="mt-3 rounded-stor border border-feil bg-feil-flate px-3 py-2 text-liten text-feil"
          role="alert"
        >
          {feil.map((f, i) => (
            <p key={i}>{f}</p>
          ))}
        </div>
      )}

      {plan && !ferdig && (
        <div className="mt-3 rounded-stor bg-flate-svak px-4 py-3">
          {fra && (
            <p className="mb-1.5 text-liten text-blekk-dempet">Fra {fra}</p>
          )}
          <ul className="space-y-1 text-brod">
            {plantekst(plan).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <div className="mt-3">
            <Knapp
              variant="primar"
              disabled={jobber}
              onClick={() => void leggInn()}
            >
              {jobber ? "Legger inn …" : knappetekst}
            </Knapp>
          </div>
        </div>
      )}

      {ferdig && (
        <p
          className="mt-3 flex items-center gap-2 text-brod text-aksent"
          role="status"
        >
          <Ikon navn="hake" /> Lagt inn.{etterpa ? ` ${etterpa}` : ""}
        </p>
      )}
    </div>
  );
}
