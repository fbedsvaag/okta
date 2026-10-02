import { useEffect, useRef, useState } from "react";
import { useArk } from "../ui/Arkstabel";
import { Ikon, Kappet } from "../ui/felles";
import { confirm as bekreft } from "@tauri-apps/plugin-dialog";
import {
  endreVurdering,
  fjernResultat,
  hentSkalaverdier,
  hentVurderingElever,
  hentOktvalg,
  hentVurderingsskalaer,
  knyttOkt,
  losOkt,
  settFrist,
  settKommentar,
  settLevert,
  settResultat,
  slettVurdering,
  type Oktvalg,
  type Vurdering,
  type VurderingElev,
  type Vurderingstype,
} from "../data/vurderinger";
import { taster, type Skala, type Skalaverdi } from "../skala";

/**
 * Det utvidede viewet for en vurdering, SPEC §4.6.
 *
 * Samme mønster som øktpanelet: oppgavens felter øverst, elevlista under,
 * tastatur nedover. Alle skalaene i v1 har ti verdier eller færre, så
 * knapperad per elev er nok — rutenettet for den findelte skalaen hører til §10.
 */
export function VurderingPanel({
  vurdering,
  onLukk,
  onEndret,
  onApneElev,
  onApneSamtaler,
}: {
  vurdering: Vurdering;
  onLukk: () => void;
  onEndret: () => void;
  onApneElev: (elevId: string) => void;
  /** Åpner Samtaler med faget valgt. Utelates der det ikke gir mening. */
  onApneSamtaler?: (skolearFagId: string) => void;
}) {
  const [elever, setElever] = useState<VurderingElev[]>([]);
  const [verdier, setVerdier] = useState<Skalaverdi[]>([]);
  const [skalaer, setSkalaer] = useState<Skala[]>([]);
  const [okter, setOkter] = useState<Oktvalg[]>([]);
  const [markert, setMarkert] = useState(0);
  const [kommentarFor, setKommentarFor] = useState<string | null>(null);
  const liste = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let avbrutt = false;
    (async () => {
      const [e, v, s] = await Promise.all([
        hentVurderingElever(vurdering.id, vurdering.skolearFagId),
        hentSkalaverdier(vurdering.skalaId),
        hentVurderingsskalaer(),
      ]);
      if (avbrutt) return;
      setElever(e);
      setVerdier(v);
      setSkalaer(s);
      setMarkert(0);
      liste.current?.focus();
    })();
    return () => {
      avbrutt = true;
    };
  }, [vurdering.id, vurdering.skolearFagId, vurdering.skalaId]);

  useEffect(() => {
    void hentOktvalg(vurdering.skolearFagId).then(setOkter);
  }, [vurdering.skolearFagId]);

  const tastekart = taster(verdier);
  const fraTast = new Map(
    verdier.map((v) => [tastekart.get(v.id) ?? "", v] as const),
  );
  const antallFort = elever.filter((e) => e.skalaverdiId !== null).length;

  async function foer(indeks: number, verdi: Skalaverdi) {
    const elev = elever[indeks];
    if (!elev) return;

    setElever((f) =>
      f.map((e, i) =>
        i === indeks
          ? { ...e, skalaverdiId: verdi.id, levert: verdi.rang > 0 ? 1 : 0 }
          : e,
      ),
    );
    setMarkert(Math.min(indeks + 1, elever.length - 1));

    await settResultat(vurdering.id, elev.elevId, verdi);
    onEndret();
  }

  async function fjern(indeks: number) {
    const elev = elever[indeks];
    if (!elev) return;
    setElever((f) =>
      f.map((e, i) => (i === indeks ? { ...e, skalaverdiId: null } : e)),
    );
    await fjernResultat(vurdering.id, elev.elevId);
    onEndret();
  }

  function tastetrykk(e: React.KeyboardEvent) {
    if (kommentarFor !== null) return;
    // ⌘-snarveiene (⌘K søk, ⌘[ tilbake) hører til appen, ikke lista.
    if (e.metaKey || e.ctrlKey) return;

    if (e.key === "Escape") return onLukk();
    if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      return setMarkert((i) => Math.min(i + 1, elever.length - 1));
    }
    if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
      e.preventDefault();
      return setMarkert((i) => Math.max(i - 1, 0));
    }
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      return void fjern(markert);
    }
    if (e.key.toLowerCase() === "k") {
      e.preventDefault();
      return setKommentarFor(elever[markert]?.elevId ?? null);
    }

    const verdi = fraTast.get(e.key);
    if (verdi) {
      e.preventDefault();
      void foer(markert, verdi);
    }
  }

  return (
    <aside className="flex h-full flex-col border-l border-linje bg-ark">
      <header className="flex items-baseline gap-3 border-b border-linje-medium px-5 py-3">
        <span
          aria-hidden
          className="h-3.5 w-[3px] rounded-full"
          style={{ background: vurdering.farge ?? "var(--color-linje-sterk)" }}
        />
        <span className="text-brod font-semibold">{vurdering.fagKode}</span>
        <Kappet verdi={vurdering.tittel} klasse="text-brod text-blekk-dempet" />
        <button
          onClick={onLukk}
          className="ml-auto shrink-0 text-liten text-blekk-svak hover:text-blekk"
        >
          Lukk (Esc)
        </button>
      </header>

      <div className="overflow-y-auto">
        <Felter
          okter={okter}
          vurdering={vurdering}
          skalaer={skalaer}
          onEndret={onEndret}
          onApneSamtaler={onApneSamtaler}
        />

        <div className="flex items-baseline justify-between border-y border-linje-medium bg-flate px-5 py-1.5">
          <span className="text-etikett uppercase tracking-etikett text-blekk-dempet">
            Resultater
          </span>
          <span className="text-liten tabular-nums text-blekk-dempet">
            {antallFort} av {elever.length} ført
          </span>
        </div>

        <div
          ref={liste}
          tabIndex={0}
          onKeyDown={tastetrykk}
          className="outline-none"
        >
          {elever.length === 0 && (
            <p className="px-5 py-6 text-center text-brod text-blekk-dempet">
              Ingen elever er koblet til {vurdering.fagKode} ennå.
            </p>
          )}

          {elever.map((elev, i) => (
            <ElevRad
              key={elev.elevId}
              elev={elev}
              verdier={verdier}
              tastekart={tastekart}
              markert={i === markert}
              onKlikk={() => {
                setMarkert(i);
                liste.current?.focus();
              }}
              onVelg={(v) => foer(i, v)}
              onLevert={async (levert) => {
                setElever((f) =>
                  f.map((e, j) =>
                    j === i ? { ...e, levert: levert ? 1 : 0 } : e,
                  ),
                );
                await settLevert(vurdering.id, elev.elevId, levert);
              }}
              onKommentar={() => setKommentarFor(elev.elevId)}
              onApneElev={() => onApneElev(elev.elevId)}
            />
          ))}
        </div>

        <div className="px-5 py-4">
          <button
            onClick={async () => {
              if (!(await bekreft(`Slette vurderingen «${vurdering.tittel}»?`)))
                return;
              await slettVurdering(vurdering.id);
              onLukk();
              onEndret();
            }}
            className="text-liten text-blekk-svak hover:text-feil"
          >
            Slett vurderingen
          </button>
        </div>
      </div>

      {kommentarFor && (
        <Kommentar
          key={kommentarFor}
          elev={elever.find((e) => e.elevId === kommentarFor)!}
          onLukk={async (tekst) => {
            if (tekst !== null) {
              await settKommentar(vurdering.id, kommentarFor, tekst);
              setElever((f) =>
                f.map((e) =>
                  e.elevId === kommentarFor ? { ...e, kommentar: tekst } : e,
                ),
              );
            }
            setKommentarFor(null);
            liste.current?.focus();
          }}
        />
      )}
    </aside>
  );
}

function ElevRad({
  elev,
  verdier,
  tastekart,
  markert,
  onKlikk,
  onVelg,
  onLevert,
  onKommentar,
  onApneElev,
}: {
  elev: VurderingElev;
  verdier: Skalaverdi[];
  tastekart: Map<string, string>;
  markert: boolean;
  onKlikk: () => void;
  onVelg: (v: Skalaverdi) => void;
  onLevert: (levert: boolean) => void;
  onKommentar: () => void;
  onApneElev: () => void;
}) {
  return (
    <div
      onClick={onKlikk}
      className={`flex cursor-default items-center gap-2 border-b border-linje-svak px-5 py-1 ${
        markert ? "bg-valgt" : "hover:bg-flate"
      }`}
    >
      <span className="w-3 text-etikett text-aksent">
        {markert ? <Ikon navn="markor" /> : null}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onApneElev();
        }}
        title="Åpne eleven"
        className="w-44 shrink-0 truncate text-left text-brod hover:text-aksent hover:underline"
      >
        {elev.fornavn} {elev.etternavn}
      </button>

      {/*
        Oppgaven eleven trakk, når vurderingen har en samtaletrekning knyttet
        til seg (§4.10). Står tom ellers — de fleste vurderinger har ingen.
      */}
      {elev.oppgave && (
        <span
          title={elev.samtaletid ? `Samtale ${elev.samtaletid}` : undefined}
          className="w-32 shrink-0 truncate text-liten text-blekk-dempet"
        >
          {elev.oppgave}
        </span>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          onKommentar();
        }}
        title={elev.kommentar ?? "Legg til kommentar (K)"}
        className={`flex-1 truncate text-left text-liten italic ${
          elev.kommentar
            ? "text-blekk-dempet hover:text-blekk"
            : "text-blekk-svakest hover:text-blekk-dempet"
        }`}
      >
        {elev.kommentar ?? "+ kommentar"}
      </button>

      <label
        onClick={(e) => e.stopPropagation()}
        title="Levert"
        className="flex items-center text-etikett text-blekk-svak"
      >
        <input
          type="checkbox"
          checked={elev.levert === 1}
          onChange={(e) => onLevert(e.target.checked)}
        />
      </label>

      <div className="flex gap-1">
        {verdier.map((v) => (
          <button
            key={v.id}
            onClick={(e) => {
              e.stopPropagation();
              onVelg(v);
            }}
            title={`${tastekart.get(v.id) ?? ""} — ${v.kode}${v.etikett ? `: ${v.etikett}` : ""}`}
            className={`min-w-7 rounded-sm border px-1.5 py-0.5 text-liten tabular-nums ${
              elev.skalaverdiId === v.id
                ? "border-aksent bg-aksent text-ark"
                : "border-linje text-blekk-dempet hover:bg-flate"
            }`}
          >
            {v.kode}
          </button>
        ))}
      </div>
    </div>
  );
}

const TYPER: { verdi: Vurderingstype; navn: string }[] = [
  { verdi: "skriftlig", navn: "Skriftlig" },
  { verdi: "muntlig", navn: "Muntlig" },
  { verdi: "praktisk", navn: "Praktisk" },
];

function Felter({
  vurdering,
  skalaer,
  okter,
  onEndret,
  onApneSamtaler,
}: {
  vurdering: Vurdering;
  skalaer: Skala[];
  /** øktene i faget, til «Økt»-valget */
  okter: Oktvalg[];
  onEndret: () => void;
  onApneSamtaler?: (skolearFagId: string) => void;
}) {
  return (
    <div className="space-y-2 px-5 py-3">
      <Linje etikett="Tittel">
        <input
          defaultValue={vurdering.tittel}
          key={vurdering.tittel}
          onBlur={async (e) => {
            const t = e.target.value.trim();
            if (t && t !== vurdering.tittel) {
              await endreVurdering(vurdering.id, { tittel: t });
              onEndret();
            }
          }}
          className={feltStil}
        />
      </Linje>

      {/* Rutenett, ikke flex: i et smalt ark brekker feltene til to rader i
          stedet for at «Økt» klemmes til én bokstav. */}
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(10rem,1fr))]">
        <Linje etikett="Type">
          <select
            value={vurdering.type ?? ""}
            onChange={async (e) => {
              await endreVurdering(vurdering.id, {
                type: (e.target.value || null) as Vurderingstype | null,
              });
              onEndret();
            }}
            className={feltStil}
          >
            <option value="">—</option>
            {TYPER.map((t) => (
              <option key={t.verdi} value={t.verdi}>
                {t.navn}
              </option>
            ))}
          </select>
          {/*
            En muntlig vurdering trekkes i Samtaler. Inngangen står her, der
            man er når man vet at den skal trekkes (§4.10).
          */}
          {vurdering.type === "muntlig" && onApneSamtaler && (
            <button
              onClick={() => onApneSamtaler(vurdering.skolearFagId)}
              className="mt-1 text-liten text-blekk-dempet hover:text-blekk"
            >
              Trekk rekkefølge og tema <Ikon navn="pil" />
            </button>
          )}
        </Linje>

        <Linje etikett="Frist">
          <input
            type="date"
            defaultValue={vurdering.frist ?? ""}
            key={vurdering.frist ?? ""}
            onBlur={async (e) => {
              const ny = e.target.value || null;
              if (ny === vurdering.frist) return;
              // Økta følger fristen når det finnes en økt den dagen.
              await settFrist(vurdering.id, ny);
              onEndret();
            }}
            className={feltStil}
          />
        </Linje>

        {/*
          Økta vurderingen holdes i. Settes av seg selv når fristen faller
          på en øktdag; velges her når det er en annen — innleveringen som
          gis ut i én time og leveres senere. Vises på årsplanen.
        */}
        <Oktkobling vurdering={vurdering} okter={okter} onEndret={onEndret} />

        <Linje etikett="Skala">
          <select
            value={vurdering.skalaId}
            onChange={async (e) => {
              if (
                !(await bekreft(
                  "Bytte skala? Resultater som allerede er ført peker på verdier " +
                    "i den gamle skalaen og må føres på nytt.",
                ))
              )
                return;
              await endreVurdering(vurdering.id, { skala_id: e.target.value });
              onEndret();
            }}
            className={feltStil}
          >
            {skalaer.map((s) => (
              <option key={s.id} value={s.id}>
                {s.navn}
              </option>
            ))}
          </select>
        </Linje>
      </div>

      <Linje etikett="Beskrivelse">
        <textarea
          defaultValue={vurdering.beskrivelse ?? ""}
          key={vurdering.beskrivelse ?? ""}
          rows={2}
          placeholder="Hva går oppgaven ut på?"
          onBlur={async (e) => {
            await endreVurdering(vurdering.id, {
              beskrivelse: e.target.value.trim() || null,
            });
            onEndret();
          }}
          className={feltStil}
        />
      </Linje>
    </div>
  );
}

function Kommentar({
  elev,
  onLukk,
}: {
  elev: VurderingElev;
  onLukk: (tekst: string | null) => void;
}) {
  const [tekst, setTekst] = useState(elev.kommentar ?? "");

  return (
    <div className="border-t border-linje bg-flate px-5 py-3">
      <p className="mb-1 text-etikett uppercase tracking-etikett text-blekk-dempet">
        Kommentar · {elev.fornavn} {elev.etternavn}
      </p>
      <textarea
        autoFocus
        value={tekst}
        rows={3}
        onChange={(e) => setTekst(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onLukk(null);
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onLukk(tekst);
        }}
        className={feltStil}
      />
      <div className="mt-1 flex gap-3 text-liten text-blekk-dempet">
        <button onClick={() => onLukk(tekst)} className="hover:text-blekk">
          Lagre (⌘↵)
        </button>
        <button onClick={() => onLukk(null)} className="hover:text-blekk">
          Avbryt (Esc)
        </button>
      </div>
    </div>
  );
}

const feltStil =
  "w-full rounded border border-linje bg-ark px-2 py-1 text-brod tabular-nums outline-none placeholder:text-blekk-svak focus:border-aksent";

function Linje({
  etikett,
  children,
}: {
  etikett: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block w-full">
      <span className="mb-0.5 block text-etikett uppercase tracking-etikett text-blekk-dempet">
        {etikett}
      </span>
      {children}
    </label>
  );
}

/**
 * Øktene vurderingen holdes i. En muntlig vurdering som ikke får plass i én
 * økt, strekkes over flere — da står den på alle i årsplanen.
 *
 * Ikke en <label>: den har flere knapper i seg.
 */
function Oktkobling({
  vurdering,
  okter,
  onEndret,
}: {
  vurdering: Vurdering;
  okter: Oktvalg[];
  onEndret: () => void;
}) {
  const her = okter.filter((o) => vurdering.oktIder.includes(o.id));
  const andre = okter.filter((o) => !vurdering.oktIder.includes(o.id));
  const ark = useArk();

  return (
    <div>
      <span className="mb-0.5 block text-etikett uppercase tracking-etikett text-blekk-dempet">
        {her.length > 1 ? "Økter" : "Økt"}
      </span>
      {her.map((o) => (
        <div key={o.id} className="flex items-baseline gap-2 text-brod">
          <button
            onClick={() => ark.apneOkt(o.id)}
            className="min-w-0 flex-1 truncate text-left hover:text-aksent hover:underline"
          >
            {oktetikett(o)}
          </button>
          <button
            onClick={async () => {
              await losOkt(vurdering.id, o.id);
              onEndret();
            }}
            className="shrink-0 text-liten text-blekk-svak hover:text-blekk"
          >
            Løs
          </button>
        </div>
      ))}
      <select
        value=""
        onChange={async (e) => {
          if (!e.target.value) return;
          await knyttOkt(vurdering.id, e.target.value);
          onEndret();
        }}
        className={`${feltStil} ${her.length > 0 ? "mt-1" : ""}`}
      >
        <option value="">
          {her.length > 0 ? "Legg til en økt til …" : "Knytt til en økt …"}
        </option>
        {andre.map((o) => (
          <option key={o.id} value={o.id}>
            {oktetikett(o)}
          </option>
        ))}
      </select>
    </div>
  );
}

/** «tir 06.10 · Markedsanalyse» */
function oktetikett(o: Oktvalg): string {
  const d = new Date(`${o.dato}T12:00:00`);
  const dag = d
    .toLocaleDateString("nb-NO", { weekday: "short" })
    .replace(".", "");
  const dato = d.toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
  });
  const tid = o.klokkeslett ? ` ${o.klokkeslett}` : "";
  return `${dag} ${dato}${tid}${o.tema ? ` · ${o.tema}` : ""}`;
}
