import { useEffect, useState } from "react";
import {
  hentElevAr,
  hentElevFag,
  hentElevGrunnlag,
  hentElevVurderinger,
  hentHeatmap,
  settElevnotat,
  type ElevAr,
  type ElevGrunnlag,
  type ElevVurdering,
  type FagRad,
  type HeatmapRute,
} from "../data/elevportal";
import {
  finnEllerOpprettKlasse,
  hentKlasser,
  settKlasse,
  type Klasse,
} from "../data/elever";
import { Fagmerke } from "../ui/felles";
import { NOYTRAL, skalafarge } from "../ui/farger";

/**
 * Elevportalen, SPEC §4.5.
 *
 * Ett spørsmål: hvordan har det gått med denne eleven i år? Heatmapet per
 * fag øverst, vurderingene under, notater nederst.
 */
export function ElevPanel({
  elevId,
  aktivtSkolearId,
  onLukk,
  onApneOkt,
}: {
  elevId: string;
  aktivtSkolearId: string;
  onLukk: () => void;
  onApneOkt: (oktId: string) => void;
}) {
  const [elev, setElev] = useState<ElevGrunnlag | null>(null);
  const [ar, setAr] = useState<ElevAr[]>([]);
  const [valgtAr, setValgtAr] = useState(aktivtSkolearId);
  const [fagRader, setFagRader] = useState<FagRad[]>([]);
  const [tommeFag, setTommeFag] = useState<
    { skolearFagId: string; fagKode: string; fagNavn: string; farge: string | null }[]
  >([]);
  const [vurderinger, setVurderinger] = useState<ElevVurdering[]>([]);
  const [klasser, setKlasser] = useState<Klasse[]>([]);

  useEffect(() => {
    let avbrutt = false;
    (async () => {
      const [g, a] = await Promise.all([hentElevGrunnlag(elevId), hentElevAr(elevId)]);
      if (avbrutt) return;
      setElev(g);
      setAr(a);
    })();
    return () => {
      avbrutt = true;
    };
  }, [elevId]);

  useEffect(() => {
    let avbrutt = false;
    (async () => {
      const [h, f, v] = await Promise.all([
        hentHeatmap(elevId, valgtAr),
        hentElevFag(elevId, valgtAr),
        hentElevVurderinger(elevId, valgtAr),
      ]);
      if (avbrutt) return;
      setFagRader(h);
      setTommeFag(f.filter((x) => !h.some((r) => r.skolearFagId === x.skolearFagId)));
      setVurderinger(v);
      setKlasser(await hentKlasser(valgtAr));
    })();
    return () => {
      avbrutt = true;
    };
  }, [elevId, valgtAr]);

  useEffect(() => {
    const lukkPaEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onLukk();
    };
    window.addEventListener("keydown", lukkPaEsc);
    return () => window.removeEventListener("keydown", lukkPaEsc);
  }, [onLukk]);

  if (!elev) return null;

  const detteAret = ar.find((a) => a.skolearId === valgtAr);

  return (
    <aside className="flex h-full flex-col border-l border-linje bg-ark">
      <header className="flex items-baseline gap-3 border-b border-linje-medium px-5 py-3">
        <span className="text-tittel font-semibold">
          {elev.fornavn} {elev.etternavn}
        </span>
        <span className="font-mono text-etikett text-blekk-svak">{elev.kode}</span>
        <Klassevelger
          klasser={klasser}
          valgt={detteAret?.klasse ?? null}
          onVelg={async (klasseId) => {
            await settKlasse(elevId, valgtAr, klasseId);
            setAr(await hentElevAr(elevId));
          }}
          onNy={async (navn) => {
            const id = await finnEllerOpprettKlasse(valgtAr, navn);
            await settKlasse(elevId, valgtAr, id);
            setKlasser(await hentKlasser(valgtAr));
            setAr(await hentElevAr(elevId));
          }}
        />
        <button
          onClick={onLukk}
          className="ml-auto shrink-0 text-liten text-blekk-svak hover:text-blekk"
        >
          Lukk (Esc)
        </button>
      </header>

      <div className="overflow-y-auto px-5 py-4">
        {ar.length > 1 && (
          <div className="mb-4 flex gap-1">
            {ar.map((a) => (
              <button
                key={a.skolearId}
                onClick={() => setValgtAr(a.skolearId)}
                className={`rounded-vanlig px-2 py-0.5 text-liten tabular-nums ${
                  a.skolearId === valgtAr
                    ? "bg-valgt font-medium text-aksent"
                    : "text-blekk-dempet hover:text-blekk"
                }`}
              >
                {a.navn}
                {a.klasse ? ` · ${a.klasse}` : ""}
              </button>
            ))}
          </div>
        )}

        <Bolk tittel="Innsats per økt">
          {fagRader.length === 0 && tommeFag.length === 0 ? (
            <Stille>Eleven har ingen fag dette skoleåret.</Stille>
          ) : (
            <>
              {fagRader.map((rad) => (
                <Heatmap key={rad.skolearFagId} rad={rad} onApneOkt={onApneOkt} />
              ))}
              {tommeFag.map((f) => (
                <div key={f.skolearFagId} className="flex items-center gap-2 py-1.5">
                  <span className="w-16 shrink-0">
                    <Fagmerke kode={f.fagKode} farge={f.farge} />
                  </span>
                  <Stille>Ingen økter lagt inn ennå</Stille>
                </div>
              ))}
            </>
          )}
        </Bolk>

        <Bolk tittel="Vurderinger">
          {vurderinger.length === 0 ? (
            <Stille>Ingen vurderinger i fagene hens ennå.</Stille>
          ) : (
            <table className="w-full text-brod">
              <tbody>
                {vurderinger.map((v, i) => (
                  <tr key={i} className="border-b border-linje-svak align-top">
                    <td className="w-16 py-1.5">
                      <Fagmerke kode={v.fagKode} farge={null} liten />
                    </td>
                    <td className="py-1.5">
                      {v.tittel}
                      {v.kommentar && (
                        <p className="text-liten italic text-blekk-dempet">
                          {v.kommentar}
                        </p>
                      )}
                    </td>
                    <td className="w-20 py-1.5 tabular-nums text-blekk-dempet">
                      {v.frist ?? ""}
                    </td>
                    <td className="w-16 py-1.5 text-right">
                      {v.resultat ? (
                        <span className="rounded-liten border border-linje px-1.5 py-0.5 tabular-nums">
                          {v.resultat}
                        </span>
                      ) : (
                        <span className="text-blekk-svakest">
                          {v.levert === 1 ? "levert" : "–"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Bolk>

        <Bolk tittel="Notat">
          <textarea
            defaultValue={elev.notat ?? ""}
            key={elev.id}
            rows={4}
            placeholder="Observasjoner, avtaler, det du vil huske til elevsamtalen."
            onBlur={(e) => void settElevnotat(elev.id, e.target.value)}
            className="w-full rounded-vanlig border border-linje px-2 py-1.5 text-brod outline-none placeholder:text-blekk-svak focus:border-aksent"
          />
          <p className="mt-1 text-etikett text-blekk-svak">
            Dette er arbeidsmateriale. Helse, hjemmeforhold og andre særlige
            kategorier hører ikke hjemme her.
          </p>
        </Bolk>
      </div>
    </aside>
  );
}

/**
 * Klassen settes sjelden — som regel bare når noen bytter klasse midt i året.
 * Men den skal kunne endres der man ser eleven, ikke bare fra tabellen.
 */
function Klassevelger({
  klasser,
  valgt,
  onVelg,
  onNy,
}: {
  klasser: Klasse[];
  valgt: string | null;
  onVelg: (klasseId: string | null) => void;
  onNy: (navn: string) => void;
}) {
  const [skriver, setSkriver] = useState(false);
  const valgtId = klasser.find((k) => k.navn === valgt)?.id ?? "";

  if (skriver) {
    return (
      <input
        autoFocus
        placeholder="1STC"
        onBlur={(e) => {
          const navn = e.target.value.trim();
          setSkriver(false);
          if (navn) onNy(navn);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setSkriver(false);
        }}
        className="w-24 rounded-vanlig border border-aksent px-1 py-0.5 text-brod outline-none"
      />
    );
  }

  return (
    <select
      value={valgtId}
      onChange={(e) => {
        if (e.target.value === "__ny") return setSkriver(true);
        onVelg(e.target.value === "" ? null : e.target.value);
      }}
      title="Klasse dette skoleåret"
      className="rounded-vanlig border border-transparent bg-transparent px-1 py-0.5 text-brod text-blekk-dempet hover:border-linje focus:border-aksent focus:outline-none"
    >
      <option value="">Ingen klasse</option>
      {klasser.map((k) => (
        <option key={k.id} value={k.id}>
          {k.navn}
        </option>
      ))}
      <option value="__ny">Ny klasse …</option>
    </select>
  );
}

function Heatmap({
  rad,
  onApneOkt,
}: {
  rad: FagRad;
  onApneOkt: (oktId: string) => void;
}) {
  const talt = tell(rad.ruter);

  return (
    <div className="py-2">
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0">
          <Fagmerke kode={rad.fagKode} farge={rad.farge} />
        </span>
        <div className="flex flex-wrap gap-[3px]">
          {rad.ruter.map((rute, i) => (
            <Rute key={rute.oktId + i} rute={rute} onKlikk={() => onApneOkt(rute.oktId)} />
          ))}
        </div>
      </div>
      <p className="ml-[4.5rem] mt-1 text-liten tabular-nums text-blekk-dempet">
        {rad.ruter.length} økter · {talt.gronn} grønne, {talt.gul} gule, {talt.rod}{" "}
        røde
        {talt.ikke > 0 && `, ${talt.ikke} ikke i økta`}
        {talt.uavholdt > 0 && ` · ${talt.uavholdt} ikke avholdt`}
      </p>
    </div>
  );
}

/**
 * Form i tillegg til farge (§13). "Ikke i økta" er tomt omriss og skal aldri
 * kunne forveksles med rødt. Økter som ikke er avholdt tegnes som et hull.
 */
function Rute({ rute, onKlikk }: { rute: HeatmapRute; onKlikk: () => void }) {
  const avholdt = rute.avholdt > 0;
  const ikkeIOkta = rute.tellerIkke === 1 || (avholdt && rute.verdiKode === null);
  const farge = rute.verdiFarge ? skalafarge(rute.verdiFarge) : null;

  const tittel = [
    rute.dato,
    rute.tema,
    !avholdt
      ? "ikke avholdt"
      : ikkeIOkta
        ? "ikke i økta"
        : (rute.verdiKode ?? ""),
    rute.notat,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      onClick={onKlikk}
      title={tittel}
      className="h-3.5 w-3.5 rounded-[2px] border"
      style={
        !avholdt
          ? { borderColor: "var(--color-na-kant-svak)", borderStyle: "dotted", background: "transparent" }
          : ikkeIOkta
            ? { borderColor: NOYTRAL, borderStyle: "dashed", background: "transparent" }
            : { borderColor: farge ?? NOYTRAL, background: farge ?? "transparent" }
      }
    />
  );
}

function tell(ruter: HeatmapRute[]) {
  const t = { gronn: 0, gul: 0, rod: 0, ikke: 0, uavholdt: 0 };
  for (const r of ruter) {
    if (r.avholdt === 0) t.uavholdt++;
    else if (r.tellerIkke === 1 || r.verdiKode === null) t.ikke++;
    else if (r.verdiFarge === "gronn") t.gronn++;
    else if (r.verdiFarge === "gul") t.gul++;
    else if (r.verdiFarge === "rod") t.rod++;
  }
  return t;
}

function Bolk({ tittel, children }: { tittel: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="mb-2 border-b border-linje-medium pb-1 text-etikett uppercase tracking-etikett text-blekk-dempet">
        {tittel}
      </h3>
      {children}
    </section>
  );
}

function Stille({ children }: { children: React.ReactNode }) {
  return <p className="py-1 text-brod text-blekk-svak">{children}</p>;
}
