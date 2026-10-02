import { useEffect, useState } from "react";
import { confirm as bekreft } from "@tauri-apps/plugin-dialog";
import {
  endreSkolear,
  hentFridager,
  opprettFridag,
  slettFridag,
  type Skolear,
} from "../data/skolear";
import { roddagerISpenn, type Fridag } from "../data/kalender";
import { Felt, Knapp } from "../ui/felles";

/**
 * Skoleruta — skoleårets rammer.
 *
 * Her ligger start og slutt, og alle dagene det ikke blir undervisning:
 * ferier, planleggingsdager og hendelser. Serieopprettelsen (§4.2) leser
 * denne lista, så ferieukene skrives inn én gang i august og gjelder resten
 * av året.
 *
 * «Hendelse» er dagen som ikke er fri, men likevel opptatt — eksamen i et
 * annet fag, ekskursjon, fellesarrangement. Skolen går, men timen din blir
 * det ikke noe av, og da skal den ikke telle som planlagt undervisning.
 *
 * Røde dager står nederst som en lesbar liste. De regnes ut og kan ikke
 * redigeres — det er ikke noe å bestemme der.
 */
export function Skoleruta({
  skolear,
  onEndret,
}: {
  skolear: Skolear;
  onEndret: () => void;
}) {
  const [fridager, setFridager] = useState<Fridag[]>([]);

  async function last() {
    setFridager(await hentFridager(skolear.id));
  }

  useEffect(() => {
    void last();
  }, [skolear.id]);

  const rode = roddagerISpenn(skolear.start, skolear.slutt);

  return (
    // Skoleruta er ett skjema og én liste. Den ruller i sin helhet, men
    // trenger sin egen rullesone nå som App-ramma ikke ruller lenger.
    <div className="mx-auto min-h-0 w-full max-w-2xl flex-1 overflow-auto">
      <Bolk tittel="Skoleåret">
        <div className="flex gap-3">
          <Felt
            etikett="Navn"
            verdi={skolear.navn}
            settVerdi={() => {}}
            bredde="w-32"
          />
          <label className="block">
            <Etikett>Første skoledag</Etikett>
            <input
              type="date"
              defaultValue={skolear.start}
              key={skolear.start}
              onBlur={async (e) => {
                if (e.target.value && e.target.value !== skolear.start) {
                  await endreSkolear(skolear.id, { start: e.target.value });
                  onEndret();
                }
              }}
              className={felt}
            />
          </label>
          <label className="block">
            <Etikett>Siste skoledag</Etikett>
            <input
              type="date"
              defaultValue={skolear.slutt}
              key={skolear.slutt}
              onBlur={async (e) => {
                if (e.target.value && e.target.value !== skolear.slutt) {
                  await endreSkolear(skolear.id, { slutt: e.target.value });
                  onEndret();
                }
              }}
              className={felt}
            />
          </label>
        </div>
      </Bolk>

      <Bolk tittel="Ferier og fridager">
        {fridager.length === 0 ? (
          <p className="py-1 text-brod text-blekk-svak">
            Ingen lagt inn ennå. Høstferie, juleferie, vinterferie og
            planleggingsdager hører hjemme her — det samme gjør hendelser som
            eksamen i et annet fag.
          </p>
        ) : (
          <table className="w-full text-brod">
            <tbody>
              {fridager.map((f) => (
                <tr key={f.id} className="border-b border-linje-svak">
                  <td className="py-1.5">{f.navn}</td>
                  <td className="w-24 py-1.5 text-blekk-dempet">
                    {TYPENAVN[f.type]}
                  </td>
                  <td className="w-44 py-1.5 tabular-nums text-blekk-dempet">
                    {kort(f.fra)}
                    {f.til !== f.fra && ` – ${kort(f.til)}`}
                  </td>
                  <td className="w-16 py-1.5 text-right">
                    <button
                      onClick={async () => {
                        if (
                          !(await bekreft(
                            `Slette «${f.navn}»?\n\n` +
                              "Dagene blir da vanlige skoledager igjen, og " +
                              "økter som ligger der slutter å bli markert som " +
                              "en konflikt.",
                          ))
                        )
                          return;
                        await slettFridag(f.id);
                        await last();
                      }}
                      className="text-liten text-blekk-svak hover:text-feil"
                    >
                      Slett
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <NyFridag skolearId={skolear.id} onLagt={last} />
      </Bolk>

      <Bolk tittel={`Røde dager i ${skolear.navn}`}>
        <p className="mb-2 text-liten text-blekk-dempet">
          Regnes ut fra påsken og trenger ingen vedlikehold. Serier hopper over
          dem automatisk.
        </p>
        <ul className="columns-2 text-brod">
          {rode.map((r) => (
            <li key={r.dato + r.navn} className="flex gap-2 py-0.5">
              <span className="w-24 tabular-nums text-blekk-dempet">
                {kort(r.dato)}
              </span>
              <span className="text-blekk-dempet">{r.navn}</span>
            </li>
          ))}
        </ul>
      </Bolk>
    </div>
  );
}

const TYPENAVN: Record<Fridag["type"], string> = {
  ferie: "Ferie",
  planlegging: "Planlegging",
  hendelse: "Hendelse",
  annet: "Annet",
};

function NyFridag({
  skolearId,
  onLagt,
}: {
  skolearId: string;
  onLagt: () => void;
}) {
  const [navn, setNavn] = useState("");
  const [type, setType] = useState<Fridag["type"]>("ferie");
  const [fra, setFra] = useState("");
  const [til, setTil] = useState("");

  async function lagre() {
    if (navn.trim() === "" || !fra) return;
    // Én dag er lovlig: da er til lik fra.
    await opprettFridag(skolearId, navn.trim(), type, fra, til || fra);
    setNavn("");
    setFra("");
    setTil("");
    onLagt();
  }

  return (
    <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-linje-medium pt-3">
      <Felt
        etikett="Navn"
        verdi={navn}
        settVerdi={setNavn}
        plassholder="Høstferie"
        bredde="w-44"
        onEnter={lagre}
      />
      <label className="block">
        <Etikett>Type</Etikett>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as Fridag["type"])}
          className={felt}
        >
          <option value="ferie">Ferie</option>
          <option value="planlegging">Planleggingsdag</option>
          <option value="hendelse">Hendelse</option>
          <option value="annet">Annet</option>
        </select>
      </label>
      <Felt
        etikett="Fra"
        verdi={fra}
        settVerdi={setFra}
        type="date"
        bredde="w-40"
      />
      <Felt
        etikett="Til"
        verdi={til}
        settVerdi={setTil}
        type="date"
        bredde="w-40"
      />
      <Knapp onClick={lagre}>Legg til</Knapp>
    </div>
  );
}

const felt =
  "rounded border border-linje bg-ark px-2 py-1.5 text-brod tabular-nums";

function Etikett({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-etikett uppercase tracking-etikett text-blekk-dempet">
      {children}
    </span>
  );
}

function Bolk({
  tittel,
  children,
}: {
  tittel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-7">
      <h2 className="mb-2 border-b border-linje-medium pb-1 text-etikett uppercase tracking-etikett text-blekk-dempet">
        {tittel}
      </h2>
      {children}
    </section>
  );
}

function kort(dato: string): string {
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}
