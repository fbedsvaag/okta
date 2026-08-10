import { useEffect, useState } from "react";
import { confirm as bekreft } from "@tauri-apps/plugin-dialog";
import {
  endreFag,
  endreFagIAr,
  fjernFagFraAr,
  leggFagIAr,
  type FagIAr,
} from "../data/fag";
import { hentInnstilling } from "../data/skolear";
import { FAGFARGER } from "../ui/farger";
import { Felt, Knapp, Tomtilstand } from "../ui/felles";
import { FagPanel } from "./FagPanel";
import { ElevPanel } from "./ElevPanel";
import { useGlidende } from "../ui/bevegelse";
import { hentFagElever, type FagElev } from "../data/fagportal";

/**
 * Fagene mine i dette skoleåret, SPEC §4.8.
 *
 * Kode, navn og farge hører til fagbanken og følger faget mellom år.
 * Årstimetall og standard varighet hører til året, og kan være noe annet
 * neste gang faget undervises.
 */
export function Fag({
  skolearId,
  fag,
  onEndret,
  onApneOkt,
  onApneVurderinger,
}: {
  skolearId: string;
  fag: FagIAr[];
  onEndret: () => void;
  onApneOkt: (oktId: string) => void;
  onApneVurderinger: () => void;
}) {
  const [globalVarighet, setGlobalVarighet] = useState("180");
  // Lesemodus er standard. Feltene låses opp med bryteren, slik at et klikk
  // i tabellen åpner fagportalen i stedet for å sette markøren i et felt.
  const [rediger, setRediger] = useState(false);
  const [valgtFag, setValgtFag] = useState<string | null>(null);
  const [valgtElev, setValgtElev] = useState<string | null>(null);
  const { vist: apent, apen: glir } = useGlidende(
    fag.find((f) => f.id === valgtFag) ?? null,
  );

  // Elevene i det åpne faget, i samme rekkefølge som fagpanelet viser dem.
  // Brukes bare til å bla — panelet henter sine egne data selv.
  const [fagElever, setFagElever] = useState<FagElev[]>([]);
  const [retning, setRetning] = useState<"opp" | "ned" | null>(null);

  useEffect(() => {
    if (!apent) return;
    void hentFagElever(apent.id, skolearId).then(setFagElever);
  }, [apent?.id, skolearId]);

  const nr = fagElever.findIndex((e) => e.elevId === valgtElev);

  function blaTil(steg: number) {
    if (nr < 0 || fagElever.length === 0) return;
    // Går rundt i begge ender — lista er kort nok til at det er greiere
    // enn å stoppe, og du slipper å lure på om det er flere igjen.
    const ny = (nr + steg + fagElever.length) % fagElever.length;
    setRetning(steg > 0 ? "opp" : "ned");
    setValgtElev(fagElever[ny].elevId);
  }

  useEffect(() => {
    void hentInnstilling("standard_varighet_min").then((v) =>
      setGlobalVarighet(v ?? "180"),
    );
  }, []);

  return (
    <div className="flex h-full overflow-hidden">
      <div className={`liste-bredde min-w-0 overflow-y-auto ${glir ? "hidden w-full pr-4 lg:block lg:w-1/3" : "w-full max-w-4xl"}`}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-tittel font-semibold">Fag i dette skoleåret</h2>
        <label className="flex items-center gap-2 text-liten text-blekk-dempet">
          <input
            type="checkbox"
            checked={rediger}
            onChange={(e) => {
              setRediger(e.target.checked);
              if (e.target.checked) setValgtFag(null);
            }}
          />
          Rediger
        </label>
      </div>
      <p className="mt-1 text-brod text-blekk-dempet">
        {rediger
          ? "Feltene lagrer når du forlater dem. Escape angrer."
          : "Klikk på et fag for å åpne det. Slå på Rediger for å endre feltene."}
      </p>

      {fag.length === 0 ? (
        <div className="mt-5">
          <Tomtilstand tekst="Ingen fag i dette skoleåret ennå." />
        </div>
      ) : (
        <div className="overflow-x-auto">
        <table className="mt-5 w-full min-w-[38rem] text-brod">
          <thead>
            <tr className="border-b border-linje text-left text-etikett uppercase tracking-etikett text-blekk-dempet">
              <th className="w-6 py-1 font-normal"></th>
              <th className="w-28 py-1 font-normal">Kode</th>
              <th className="py-1 font-normal">Navn</th>
              <th className="w-28 py-1 text-right font-normal">Årstimer</th>
              {/* Varighet vises bare i redigeringsmodus. I lesevisningen sto
                  den med samme arvede verdi på hver rad. */}
              {rediger && (
                <th className="w-32 py-1 text-right font-normal">Varighet</th>
              )}
              <th className="w-16 py-1"></th>
            </tr>
          </thead>
          <tbody>
            {fag.map((f) => (
              <FagRad
                key={f.id}
                fag={f}
                globalVarighet={globalVarighet}
                rediger={rediger}
                valgt={valgtFag === f.id}
                onApne={() => setValgtFag(f.id)}
                onEndret={onEndret}
              />
            ))}
          </tbody>
        </table>
        </div>
      )}

      <NyttFag skolearId={skolearId} antall={fag.length} onLagt={onEndret} />
      </div>

      {apent && (
        <div className={`panel min-w-0 w-full lg:w-2/3 ${glir ? "" : "panel-ute"}`}>
          {valgtElev ? (
            <ElevPanel
              key={valgtElev}
              elevId={valgtElev}
              aktivtSkolearId={skolearId}
              onLukk={() => setValgtElev(null)}
              onApneOkt={onApneOkt}
              bla={
                nr >= 0
                  ? {
                      nr: nr + 1,
                      av: fagElever.length,
                      retning,
                      forrige: () => blaTil(-1),
                      neste: () => blaTil(1),
                    }
                  : undefined
              }
            />
          ) : (
            <FagPanel
              key={apent.id}
              fag={apent}
              skolearId={skolearId}
              onLukk={() => setValgtFag(null)}
              onApneElev={setValgtElev}
              onApneVurderinger={onApneVurderinger}
            />
          )}
        </div>
      )}
    </div>
  );
}

function FagRad({
  fag,
  globalVarighet,
  rediger,
  valgt,
  onApne,
  onEndret,
}: {
  fag: FagIAr;
  globalVarighet: string;
  rediger: boolean;
  valgt: boolean;
  onApne: () => void;
  onEndret: () => void;
}) {
  const [visFarger, setVisFarger] = useState(false);

  if (!rediger) {
    return (
      <tr
        className={`cursor-pointer border-b border-linje-svak ${
          valgt ? "bg-valgt" : "hover:bg-flate-svak"
        }`}
        onClick={onApne}
      >
        <td className="py-1.5">
          <span
            aria-hidden
            className="block h-4 w-[3px] rounded-full"
            style={{ background: fag.farge ?? "var(--color-linje-sterk)" }}
          />
        </td>
        <td className="py-1.5 font-medium">{fag.kode}</td>
        <td className="py-1.5">{fag.navn}</td>
        {/*
          Årstimer og varighet står alltid, også når fagkortet er åpent.
          De ble tidligere skjult for å spare bredde, men det er nettopp
          tallene man vil se mens man ser på faget.
        */}
        <td className="py-1.5 text-right tabular-nums text-blekk-dempet">
          {fag.arstimetall ?? "—"}
        </td>
        <td />
      </tr>
    );
  }

  return (
    <tr className="border-b border-linje-svak">
      <td className="py-1.5">
        <div className="relative">
          <button
            onClick={() => setVisFarger((v) => !v)}
            title="Bytt farge"
            className="block h-4 w-[3px] rounded-full"
            style={{ background: fag.farge ?? "var(--color-linje-sterk)" }}
          />
          {visFarger && (
            <div className="absolute left-0 top-full z-20 mt-1 w-52 rounded border border-linje bg-ark p-2 shadow-lg">
              <div className="grid grid-cols-6 gap-1">
                {FAGFARGER.map((farge) => (
                  <button
                    key={farge}
                    title={farge}
                    onClick={async () => {
                      await endreFag(fag.fagId, { farge });
                      setVisFarger(false);
                      onEndret();
                    }}
                    className={`h-5 w-5 rounded-sm ring-offset-1 hover:ring-1 hover:ring-linje-sterk ${
                      fag.farge === farge ? "ring-1 ring-blekk-dempet" : ""
                    }`}
                    style={{ background: farge }}
                  />
                ))}
              </div>

              <label className="mt-2 flex items-center gap-2 border-t border-linje-medium pt-2 text-liten text-blekk-dempet">
                <input
                  type="color"
                  // Hex, ikke token: <input type="color"> godtar bare en
                  // bokstavelig hex-verdi, ikke en CSS-variabel.
                  value={fag.farge ?? "#2f5d8a"}
                  onChange={async (e) => {
                    await endreFag(fag.fagId, { farge: e.target.value });
                    onEndret();
                  }}
                  className="h-6 w-8 cursor-pointer rounded border border-linje bg-ark p-0.5"
                />
                Egen farge
              </label>

              <button
                onClick={() => setVisFarger(false)}
                className="mt-1 w-full text-liten text-blekk-dempet hover:text-blekk"
              >
                Lukk
              </button>
            </div>
          )}
        </div>
      </td>

      <td className="py-1.5">
        <Innfelt
          verdi={fag.kode}
          lagre={async (v) => {
            await endreFag(fag.fagId, { kode: v });
            onEndret();
          }}
          klasser="font-medium"
        />
      </td>

      <td className="py-1.5">
        <Innfelt
          verdi={fag.navn}
          lagre={async (v) => {
            await endreFag(fag.fagId, { navn: v });
            onEndret();
          }}
        />
      </td>

      <td className="py-1.5 text-right">
        <Innfelt
          verdi={fag.arstimetall === null ? "" : String(fag.arstimetall)}
          plassholder="—"
          hoyre
          lagre={async (v) => {
            await endreFagIAr(fag.id, { arstimetall: taltEllerNull(v) });
            onEndret();
          }}
        />
      </td>

      <td className="py-1.5 text-right">
        <Innfelt
          verdi={
            fag.standardVarighetMin === null ? "" : String(fag.standardVarighetMin)
          }
          plassholder={`${globalVarighet} (arvet)`}
          hoyre
          lagre={async (v) => {
            await endreFagIAr(fag.id, { standard_varighet_min: taltEllerNull(v) });
            onEndret();
          }}
        />
      </td>

      <td className="py-1.5 text-right">
        <button
          onClick={async () => {
            if (
              !await bekreft(
                `Fjerne ${fag.kode} fra dette skoleåret?\n\n` +
                  `Faget blir liggende i fagbanken, og øktene og elevkoblingene ` +
                  `blir stående. Du kan legge det tilbake senere.`,
              )
            )
              return;
            await fjernFagFraAr(fag.id);
            onEndret();
          }}
          className="text-liten text-blekk-svak hover:text-red-700"
        >
          Fjern
        </button>
      </td>
    </tr>
  );
}

function taltEllerNull(v: string): number | null {
  const n = Number(v.trim());
  return v.trim() === "" || Number.isNaN(n) ? null : Math.round(n);
}

/** Redigerbart felt som lagrer når det forlates, uten lagre-knapp. */
function Innfelt({
  verdi,
  lagre,
  plassholder,
  hoyre,
  klasser = "",
}: {
  verdi: string;
  lagre: (v: string) => Promise<void>;
  plassholder?: string;
  hoyre?: boolean;
  klasser?: string;
}) {
  return (
    <input
      defaultValue={verdi}
      key={verdi}
      placeholder={plassholder}
      onBlur={async (e) => {
        if (e.target.value !== verdi) await lagre(e.target.value.trim());
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          e.currentTarget.value = verdi;
          e.currentTarget.blur();
        }
      }}
      className={`w-full rounded border border-transparent px-1 py-0.5 tabular-nums outline-none placeholder:text-blekk-svak hover:border-linje focus:border-aksent ${
        hoyre ? "text-right" : ""
      } ${klasser}`}
    />
  );
}

function NyttFag({
  skolearId,
  antall,
  onLagt,
}: {
  skolearId: string;
  antall: number;
  onLagt: () => void;
}) {
  const [kode, setKode] = useState("");
  const [navn, setNavn] = useState("");

  async function leggTil() {
    if (kode.trim() === "") return;
    await leggFagIAr(
      skolearId,
      kode.trim(),
      navn.trim() || kode.trim(),
      FAGFARGER[antall % FAGFARGER.length],
    );
    setKode("");
    setNavn("");
    onLagt();
  }

  return (
    <div className="mt-5 flex items-end gap-3 border-t border-linje-medium pt-4">
      <Felt
        etikett="Kode"
        verdi={kode}
        settVerdi={setKode}
        plassholder="MFL1"
        bredde="w-32"
        onEnter={leggTil}
      />
      <Felt
        etikett="Navn"
        verdi={navn}
        settVerdi={setNavn}
        plassholder="Markedsføring og ledelse 1"
        bredde="w-80"
        onEnter={leggTil}
      />
      <Knapp onClick={leggTil}>Legg til fag</Knapp>
    </div>
  );
}
