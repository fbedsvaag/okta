import { useState } from "react";
import type {} from "../../data/skolear";
import type {} from "../../data/fag";
import { type Oktvalg } from "../../data/vurderinger";
import {
  kapasitet,
  tilKlokke,
  tilMin,
  type Samtaledag,
} from "../../data/samtale";
import { Ikon } from "../../ui/felles";

/** Et lite tallfelt med etiketten over. */
export function Tallfelt({
  etikett,
  verdi,
  settVerdi,
}: {
  etikett: string;
  verdi: string;
  settVerdi: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-liten text-blekk-dempet">{etikett}</span>
      <input
        inputMode="numeric"
        value={verdi}
        onChange={(e) => settVerdi(e.target.value)}
        className="h-[2.4em] w-full rounded-vanlig border border-linje bg-ark px-2.5 text-brod tabular-nums outline-none focus:border-aksent"
      />
    </label>
  );
}
/** Knappene under Generer: Trekk på nytt og de to låsene, som piller. */
export function Pilleknapp({
  pa,
  av,
  tittel,
  onKlikk,
  children,
}: {
  /** låst: knappen står trykket inn */
  pa?: boolean;
  av?: boolean;
  tittel?: string;
  onKlikk: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onKlikk}
      disabled={av}
      aria-pressed={pa}
      title={tittel}
      className={`flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-brod disabled:opacity-40 ${
        pa
          ? "border-aksent bg-valgt text-aksent"
          : "border-linje-sterk bg-ark text-blekk hover:bg-flate"
      }`}
    >
      {children}
    </button>
  );
}
/**
 * Ett kort per dag, med sin egen kapasitet.
 *
 * Kapasiteten oppdateres mens du skriver — den regnes ut fra dagen slik den
 * står akkurat nå, ikke fra noe som må lagres først.
 */
/**
 * Fagets økter som avkrysningsliste. Hver økt som krysses av, blir en
 * samtaledag med øktas klokkeslett som ramme (§4.10). Får ikke alle elevene
 * plass i én økt, krysses en til av — kapasiteten står ved hver.
 *
 * Kommende økter vises; tidligere bare når de allerede er valgt, eller når
 * du ber om dem.
 */
export function Oktvelger({
  okter,
  vurderingsokter,
  dager,
  kapasiteter,
  minutter,
  pause,
  kollisjon,
  onVelg,
}: {
  okter: Oktvalg[];
  /**
   * Øktene som er huket av for en vurdering — den valgte, eller alle i
   * faget når ingen er valgt. Det er bare dem samtaler legges i, så lista
   * viser bare dem til du ber om resten.
   */
  vurderingsokter: Set<string>;
  dager: Samtaledag[];
  kapasiteter: number[];
  minutter: number;
  pause: number;
  /** det som ligger på datoen — en hendelse, en fridag — eller null */
  kollisjon: (dato: string) => string | null;
  onVelg: (okt: Oktvalg, pa: boolean) => Promise<void>;
}) {
  const [visAlle, setVisAlle] = useState(false);
  const [visTidligere, setVisTidligere] = useState(false);
  const idag = new Date().toLocaleDateString("sv-SE");
  const valgt = new Map(
    dager.map((d, i) => [d.oktId, { dag: d, plass: kapasiteter[i] }]),
  );
  const synlige = okter.filter((o) =>
    visAlle
      ? visTidligere || o.dato >= idag || valgt.has(o.id)
      : vurderingsokter.has(o.id) || valgt.has(o.id),
  );
  const skjulte = visAlle ? okter.length - synlige.length : 0;

  if (okter.length === 0) {
    return (
      <p className="mb-2 text-liten text-blekk-svak">
        Faget har ingen økter ennå. Legg dem inn under Økter, eller bruk en egen
        dag under.
      </p>
    );
  }

  return (
    <div className="mb-2">
      {synlige.length === 0 ? (
        <p className="text-liten text-blekk-svak">
          Ingen økter er knyttet til vurderingen ennå. Huk av for vurderingen på
          økta, eller vis alle øktene i faget.
        </p>
      ) : (
        <ul
          className={`space-y-3 ${visAlle ? "max-h-80 overflow-y-auto pr-1" : ""}`}
        >
          {synlige.map((o) => {
            const v = valgt.get(o.id);
            const slutt = o.klokkeslett
              ? tilKlokke(tilMin(o.klokkeslett) + o.varighetMin)
              : null;
            // Kapasiteten står også på økter som ikke er valgt, så du ser
            // hva en til gir. Dagen i en økt har ingen lunsj (§3.6) før du
            // legger den inn selv.
            const plass =
              v?.plass ??
              (o.klokkeslett && slutt
                ? kapasitet(
                    {
                      fra: o.klokkeslett,
                      til: slutt,
                      lunsjFra: null,
                      lunsjMin: null,
                    },
                    minutter,
                    pause,
                  )
                : 0);
            const kolliderer = kollisjon(o.dato);
            return (
              <li key={o.id}>
                <label
                  className={`flex gap-2.5 ${o.klokkeslett ? "cursor-pointer" : "text-blekk-svak"}`}
                  title={o.klokkeslett ? undefined : "Økta mangler klokkeslett"}
                >
                  <input
                    type="checkbox"
                    checked={v !== undefined}
                    disabled={!o.klokkeslett}
                    onChange={(e) => void onVelg(o, e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-aksent)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span
                        className={`min-w-0 flex-1 truncate text-brod first-letter:uppercase ${
                          v ? "" : "text-blekk-dempet"
                        }`}
                      >
                        {dagOgDato(o.dato)}
                      </span>
                      {plass > 0 && (
                        <span className="shrink-0 text-liten tabular-nums text-blekk-dempet">
                          maks {plass}
                        </span>
                      )}
                    </span>
                    <span
                      className={`block truncate text-liten tabular-nums ${
                        kolliderer ? "text-feil" : "text-blekk-dempet"
                      }`}
                    >
                      {kolliderer
                        ? `${kolliderer} kolliderer`
                        : o.klokkeslett
                          ? `Økt ${o.klokkeslett}–${slutt}${
                              v?.dag.lunsjFra
                                ? ` · lunsj ${v.dag.lunsjFra}`
                                : ""
                            }`
                          : "uten klokkeslett"}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <span className="mt-2 flex gap-4">
        <button
          onClick={() => setVisAlle((v) => !v)}
          className="text-liten text-blekk-svak hover:text-blekk"
        >
          {visAlle
            ? "Bare øktene med vurdering"
            : `Vis alle ${okter.length} øktene i faget`}
        </button>
        {skjulte > 0 && (
          <button
            onClick={() => setVisTidligere(true)}
            className="text-liten text-blekk-svak hover:text-blekk"
          >
            Vis {skjulte} tidligere økter
          </button>
        )}
      </span>
    </div>
  );
}
/** «torsdag 15. oktober» */
function dagOgDato(dato: string): string {
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
export function Dagkort({
  dag,
  nr,
  kapasitet: plass,
  plassord = "elever",
  onEndre,
  onSlett,
}: {
  dag: Samtaledag;
  nr: number;
  kapasitet: number;
  /** «elever», eller «grupper» i gruppesamtaler */
  plassord?: string;
  onEndre: (felter: Record<string, unknown>) => Promise<void>;
  onSlett: () => void;
}) {
  const harLunsj = dag.lunsjFra !== null;

  return (
    <div className="mb-2 rounded-vanlig border border-linje bg-flate-svak p-2">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-liten font-medium">Dag {nr}</span>
        <span className="flex items-baseline gap-2">
          <span className="text-liten tabular-nums text-blekk-dempet">
            {plass > 0 ? `Maks ${plass} ${plassord}` : "–"}
          </span>
          <button
            onClick={onSlett}
            className="text-blekk-svakest hover:text-feil"
            title="Fjern dagen"
          >
            <Ikon navn="kryss" />
          </button>
        </span>
      </div>

      <input
        type="date"
        defaultValue={dag.dato}
        key={`d${dag.dato}`}
        onBlur={(e) => void onEndre({ dato: e.target.value })}
        className={feltstil + " mb-1.5 w-full"}
      />

      <div className="flex gap-1.5">
        <input
          type="time"
          defaultValue={dag.fra}
          key={`f${dag.fra}`}
          onBlur={(e) => void onEndre({ fra: e.target.value })}
          className={feltstil + " w-1/2"}
        />
        <input
          type="time"
          defaultValue={dag.til}
          key={`t${dag.til}`}
          onBlur={(e) => void onEndre({ til: e.target.value })}
          className={feltstil + " w-1/2"}
        />
      </div>

      <label className="mt-1.5 flex select-none items-center gap-1.5 text-liten text-blekk-dempet">
        <input
          type="checkbox"
          checked={harLunsj}
          onChange={(e) =>
            void onEndre(
              e.target.checked
                ? { lunsj_fra: "11:45", lunsj_min: 30 }
                : { lunsj_fra: null, lunsj_min: null },
            )
          }
        />
        Lunsjpause
      </label>

      {harLunsj && (
        <div className="mt-1.5 flex gap-1.5">
          <input
            type="time"
            defaultValue={dag.lunsjFra ?? "11:45"}
            key={`lf${dag.lunsjFra}`}
            onBlur={(e) => void onEndre({ lunsj_fra: e.target.value })}
            className={feltstil + " w-1/2"}
          />
          <input
            type="number"
            min={5}
            max={120}
            defaultValue={dag.lunsjMin ?? 30}
            key={`lm${dag.lunsjMin}`}
            onBlur={(e) =>
              void onEndre({ lunsj_min: Number(e.target.value) || 30 })
            }
            className={feltstil + " w-1/2"}
          />
        </div>
      )}
    </div>
  );
}

const feltstil =
  "rounded border border-linje bg-ark px-2 py-1 text-brod tabular-nums outline-none focus:border-aksent";
