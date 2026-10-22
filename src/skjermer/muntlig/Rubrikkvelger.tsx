import { useState } from "react";
import {
  antallVurdert,
  karakterforslag,
  kriterierMedTekst,
  type Rubrikk,
  type Rubrikkvalg,
  type Vurderingsform,
} from "../../data/muntlig";
import type { Skalaverdi } from "../../skala";
import { Bryter } from "../../ui/felles";

/**
 * Kriteriene for én elev (28.3b, 29.5): avkrysning, eller rubrikken som
 * tabell. Et klikk i en celle velger nivået og går videre til neste
 * kriterium som ikke er vurdert; et klikk til fjerner valget. Når alle er
 * vurdert, foreslår rubrikken en karakter. Brukes både under en muntlig
 * samtale og i føringen av en prøve.
 */
export function Rubrikkvelger({
  rubrikk: r,
  form,
  onForm,
  valg,
  onValg,
  verdier,
  onBruk,
  tittel = "Kriterier",
}: {
  rubrikk: Rubrikk;
  form: Vurderingsform;
  /** utelates der formen ikke kan byttes */
  onForm?: (f: Vurderingsform) => void;
  valg: Rubrikkvalg;
  onValg: (ny: Rubrikkvalg) => void;
  verdier: Skalaverdi[];
  /** forslaget brukes som karakter */
  onBruk: (skalaverdiId: string) => void;
  tittel?: string;
}) {
  const [fokus, setFokus] = useState(0);
  const krit = kriterierMedTekst(r);
  const forslag = form === "rubrikk" ? karakterforslag(r, valg) : null;
  const forslagVerdi =
    forslag !== null
      ? verdier.find((x) => x.kode === String(forslag))
      : undefined;
  const kolonner = `118px repeat(${r.nivaer.length}, minmax(0,1fr))`;

  return (
    <div>
      <div className="flex items-center gap-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-[.06em] text-blekk-svak">
          {form === "rubrikk" && !onForm ? "Rubrikk" : tittel}
        </div>
        <span className="flex-1" />
        {onForm && (
          <Bryter
            storrelse="liten"
            verdi={form}
            settVerdi={(f) => onForm(f === "rubrikk" ? "rubrikk" : "kriterier")}
            valg={[
              { id: "kriterier", navn: "Avkrysning" },
              { id: "rubrikk", navn: "Rubrikk" },
            ]}
          />
        )}
      </div>
      {krit.length === 0 && (
        <p className="mt-2 text-liten text-blekk-svak">
          Ingen kriterier ennå. De legges inn under{" "}
          {onForm ? "Planlegg" : "Oppsett"}.
        </p>
      )}
      {form === "kriterier" &&
        krit.map((k) => {
          const pa = valg[k.id] === true;
          return (
            <button
              key={k.id}
              onClick={() => {
                const ny = { ...valg };
                if (pa) delete ny[k.id];
                else ny[k.id] = true;
                onValg(ny);
              }}
              className="flex h-[34px] w-full items-center gap-2.5 border-b border-linje-svak text-left text-[13.5px]"
            >
              <span
                className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md text-[11px] text-ark ${
                  pa
                    ? "bg-aksent"
                    : "shadow-[inset_0_0_0_1.5px_var(--color-linje-sterk)]"
                }`}
              >
                {pa ? "✓" : ""}
              </span>
              {k.tekst}
            </button>
          );
        })}
      {form === "rubrikk" && krit.length > 0 && (
        <div className="mt-2.5 rounded-xl p-1.5 shadow-[inset_0_0_0_1px_var(--color-linje-svak)]">
          <div
            className="grid gap-[5px]"
            style={{ gridTemplateColumns: kolonner }}
          >
            <span />
            {r.nivaer.map((n) => (
              <span
                key={n.id}
                className="px-2 py-1 text-[11px] uppercase tracking-[.05em] text-blekk-svak"
              >
                {n.navn}
              </span>
            ))}
          </div>
          {krit.map((k, i) => {
            const vurdert = r.nivaer.some((n) => n.id === valg[k.id]);
            return (
              <div
                key={k.id}
                onClick={() => setFokus(i)}
                className={`mt-0.5 grid gap-[5px] rounded-[9px] p-1 transition-colors duration-200 ${
                  fokus === i ? "bg-flate-svak" : ""
                }`}
                style={{ gridTemplateColumns: kolonner }}
              >
                <span className="self-center px-1.5 py-1.5 text-[12.5px] font-medium leading-tight">
                  {k.tekst}
                </span>
                {r.nivaer.map((n) => {
                  const pa = valg[k.id] === n.id;
                  return (
                    <button
                      key={n.id}
                      aria-pressed={pa}
                      onClick={(e) => {
                        e.stopPropagation();
                        const ny = { ...valg };
                        if (pa) delete ny[k.id];
                        else ny[k.id] = n.id;
                        onValg(ny);
                        // Videre til neste kriterium som ikke er vurdert.
                        if (!pa) {
                          const neste = krit.findIndex(
                            (x, j) =>
                              j > i && !r.nivaer.some((m) => m.id === ny[x.id]),
                          );
                          setFokus(neste >= 0 ? neste : i);
                        }
                      }}
                      className={`rounded-lg px-[9px] py-[7px] text-left text-[12px] leading-snug transition-[background-color,color,box-shadow,opacity] duration-200 ${
                        pa
                          ? "bg-aksent text-ark"
                          : `bg-ark text-blekk-dempet shadow-[inset_0_0_0_1px_var(--color-linje-svak)] hover:shadow-[inset_0_0_0_1.5px_var(--color-linje-sterk)] ${
                              vurdert && fokus !== i ? "opacity-55" : ""
                            }`
                      }`}
                    >
                      {k.celler[n.id] || n.navn}
                    </button>
                  );
                })}
              </div>
            );
          })}
          <div className="mt-2 flex items-center gap-2.5 px-1">
            <span className="text-liten text-blekk-svak">
              {forslag !== null
                ? "Alle kriteriene er vurdert."
                : `${antallVurdert(r, valg)} av ${krit.length} vurdert`}
            </span>
            <span className="flex-1" />
            {forslag !== null && (
              <button
                onClick={() => forslagVerdi && onBruk(forslagVerdi.id)}
                disabled={!forslagVerdi}
                title="Sett som karakter. Bare et forslag; du bestemmer."
                className="rounded-full bg-flate px-2.5 py-0.5 text-liten hover:bg-valgt"
              >
                Rubrikken peker mot {forslag} · bruk
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
