import { useEffect, useRef, useState } from "react";
import { Ikon } from "../ui/felles";
import { Markdownfelt } from "../ui/Notattekst";
import { useArk } from "../ui/Arkstabel";
import { lyttVurderinger } from "../data/endringer";
import { hentOktmal, settOktmal, type Oktmal } from "../data/perioder";
import { Malvelger } from "./Malvelger";
import { confirm as bekreft } from "@tauri-apps/plugin-dialog";
import {
  endreOkt,
  fjernSkaring,
  hentOktElever,
  hentSkaringsskala,
  settSkaring,
  settSkaringsnotat,
  slettOkt,
  teamstekst,
  type Okt,
  type OktElev,
} from "../data/okter";
import { taster, type Skalaverdi } from "../skala";
import { skalafarge } from "../ui/farger";
import {
  hentVurderingsvalg,
  knyttOkt,
  losOkt,
  type Vurderingsvalg,
} from "../data/vurderinger";

/**
 * Det utvidede viewet, SPEC §4.2 og §4.4.
 *
 * Panelet glir inn fra høyre og dekker to tredeler. Lista blir stående til
 * venstre, så du ser hvor du er. Øktas egne felter øverst, elevlista i midten,
 * øktlogg nederst — alt på ett sted, ingen ny side.
 *
 * Her skårer du. Tastene utledes av skalaen (§5), ikke hardkodet.
 */
export function OktPanel({
  okt,
  onLukk,
  onEndret,
  onApneElev,
}: {
  okt: Okt;
  onLukk: () => void;
  onEndret: () => void;
  onApneElev: (elevId: string) => void;
}) {
  const [elever, setElever] = useState<OktElev[]>([]);
  const [verdier, setVerdier] = useState<Skalaverdi[]>([]);
  const [markert, setMarkert] = useState(0);
  const [notatFor, setNotatFor] = useState<string | null>(null);
  const liste = useRef<HTMLDivElement>(null);
  const markertRad = useRef<HTMLDivElement>(null);

  /**
   * Ruller den markerte raden inn i synsfeltet.
   *
   * `block: "nearest"` gjør at det bare skjer når raden faktisk er utenfor —
   * står den midt på skjermen, rører ingenting seg. Det er forskjellen på en
   * rolig liste og en som hopper ved hvert tastetrykk.
   *
   * Myk rulling med mindre systemet ber om mindre bevegelse. Skåringen kan gå
   * fort, og en animasjon som ikke rekker å bli ferdig før neste tastetrykk
   * skal avbrytes, ikke stables opp.
   */
  useEffect(() => {
    const rad = markertRad.current;
    if (!rad) return;
    const rolig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rad.scrollIntoView({
      block: "nearest",
      behavior: rolig ? "auto" : "smooth",
    });
  }, [markert]);

  useEffect(() => {
    let avbrutt = false;
    (async () => {
      const [e, v] = await Promise.all([
        hentOktElever(okt.id, okt.skolearFagId),
        hentSkaringsskala(okt.skolearFagId),
      ]);
      if (avbrutt) return;
      setElever(e);
      setVerdier(v);
      setMarkert(0);
      liste.current?.focus();
    })();
    return () => {
      avbrutt = true;
    };
  }, [okt.id, okt.skolearFagId]);

  const tastekart = taster(verdier);
  /** tast -> skalaverdi, slik at 0–3 slår opp riktig verdi for denne skalaen */
  const fraTast = new Map(
    verdier.map((v) => [tastekart.get(v.id) ?? "", v] as const),
  );

  /** Økta er avholdt så snart minst én elev er skåret (§3.3). */
  const avholdt = elever.some((e) => e.skalaverdiId !== null);
  const nullverdi = verdier.find((v) => v.rang === 0) ?? null;
  const antallSkaret = elever.filter((e) => e.skalaverdiId !== null).length;

  async function skaar(indeks: number, verdi: Skalaverdi) {
    const elev = elever[indeks];
    if (!elev) return;

    setElever((f) =>
      f.map((e, i) => (i === indeks ? { ...e, skalaverdiId: verdi.id } : e)),
    );
    setMarkert(Math.min(indeks + 1, elever.length - 1));

    await settSkaring(elev.elevId, okt.id, verdi.id);
    onEndret();
  }

  async function fjern(indeks: number) {
    const elev = elever[indeks];
    if (!elev) return;

    // Ingen bekreftelse her, med vilje. ⌫ ligger midt i skåringsflyten, og
    // et spørsmål per tastetrykk ville ødelagt hele poenget. Handlingen er
    // ett tastetrykk å gjenta, og raden viser med en gang hva som skjedde.
    setElever((f) =>
      f.map((e, i) => (i === indeks ? { ...e, skalaverdiId: null } : e)),
    );
    await fjernSkaring(elev.elevId, okt.id);
    onEndret();
  }

  function tastetrykk(e: React.KeyboardEvent) {
    if (notatFor !== null) return;
    // ⌘-snarveiene (⌘K søk, ⌘[ tilbake) hører til appen, ikke lista.
    if (e.metaKey || e.ctrlKey) return;

    if (e.key === "Escape") {
      onLukk();
      return;
    }
    if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      setMarkert((i) => Math.min(i + 1, elever.length - 1));
      return;
    }
    if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
      e.preventDefault();
      setMarkert((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      void fjern(markert);
      return;
    }
    if (e.key.toLowerCase() === "n") {
      e.preventDefault();
      setNotatFor(elever[markert]?.elevId ?? null);
      return;
    }

    const verdi = fraTast.get(e.key);
    if (verdi) {
      e.preventDefault();
      void skaar(markert, verdi);
    }
  }

  return (
    <aside className="flex h-full flex-col border-l border-linje bg-ark">
      <header className="flex items-baseline gap-3 border-b border-linje-medium px-5 py-3">
        <span
          aria-hidden
          className="h-3.5 w-[3px] rounded-full"
          style={{ background: okt.farge ?? "var(--color-linje-sterk)" }}
        />
        <span className="text-brod font-semibold">{okt.fagKode}</span>
        <span className="text-brod text-blekk-dempet">
          {langDato(okt.dato)}
        </span>
        <span className="font-mono text-etikett text-blekk-svak">
          {okt.kode}
        </span>
        <button
          onClick={onLukk}
          className="ml-auto text-liten text-blekk-svak hover:text-blekk"
        >
          Lukk (Esc)
        </button>
      </header>

      <div className="overflow-y-auto">
        <OktFelter okt={okt} onEndret={onEndret} />

        <div className="flex items-baseline justify-between border-y border-linje-medium bg-flate px-5 py-1.5">
          <span className="text-etikett uppercase tracking-etikett text-blekk-dempet">
            Elever
          </span>
          <span className="text-liten tabular-nums text-blekk-dempet">
            {antallSkaret} av {elever.length} skåret
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
              Ingen elever er koblet til {okt.fagKode} ennå. Legg dem inn under
              Elever, så dukker de opp her — også i økter som allerede er
              skåret.
            </p>
          )}

          {elever.map((elev, i) => (
            <ElevRad
              key={elev.elevId}
              elev={elev}
              verdier={verdier}
              tastekart={tastekart}
              markert={i === markert}
              radRef={i === markert ? markertRad : undefined}
              avholdt={avholdt}
              nullverdi={nullverdi}
              onKlikk={() => {
                setMarkert(i);
                liste.current?.focus();
              }}
              onVelg={(v) => skaar(i, v)}
              onNotat={() => setNotatFor(elev.elevId)}
              onApneElev={() => onApneElev(elev.elevId)}
            />
          ))}
        </div>

        <Logg okt={okt} onEndret={onEndret} />
      </div>

      {notatFor && (
        <Notat
          key={notatFor}
          elev={elever.find((e) => e.elevId === notatFor)!}
          oktId={okt.id}
          onLukk={async (tekst) => {
            if (tekst !== null) {
              await settSkaringsnotat(notatFor, okt.id, tekst);
              setElever((f) =>
                f.map((e) =>
                  e.elevId === notatFor ? { ...e, notat: tekst } : e,
                ),
              );
            }
            setNotatFor(null);
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
  radRef,
  avholdt,
  nullverdi,
  onKlikk,
  onVelg,
  onNotat,
  onApneElev,
}: {
  elev: OktElev;
  verdier: Skalaverdi[];
  tastekart: Map<string, string>;
  markert: boolean;
  /** settes bare på den markerte raden, så autoscrollen vet hvor den er */
  radRef?: React.RefObject<HTMLDivElement | null>;
  avholdt: boolean;
  nullverdi: Skalaverdi | null;
  onKlikk: () => void;
  onVelg: (v: Skalaverdi) => void;
  onNotat: () => void;
  onApneElev: () => void;
}) {
  // Er økta avholdt, har alle en verdi. De du ikke har trykket på er 0 (§3.3).
  const visesSom =
    elev.skalaverdiId ?? (avholdt ? (nullverdi?.id ?? null) : null);
  const eksplisitt = elev.skalaverdiId !== null;

  return (
    <div
      ref={radRef}
      onClick={onKlikk}
      // Skåringslista holder den gamle tettheten: 13px og 28px rader, så
      // tretti elever fortsatt får plass uten scrolling (DESIGN.md).
      className={`flex cursor-default items-center gap-2 border-b border-linje-svak px-5 py-1 text-liten ${
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
        className={`w-44 shrink-0 truncate text-left text-liten hover:text-aksent hover:underline ${
          eksplisitt ? "" : "text-blekk-dempet"
        }`}
      >
        {elev.fornavn} {elev.etternavn}
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onNotat();
        }}
        title={elev.notat ?? "Legg til notat (N)"}
        className={`flex-1 truncate text-left text-liten italic ${
          elev.notat
            ? "text-blekk-dempet hover:text-blekk"
            : "text-blekk-svakest hover:text-blekk-dempet"
        }`}
      >
        {elev.notat ?? "+ notat"}
      </button>

      <div className="flex gap-1">
        {verdier.map((v) => (
          <Merke
            key={v.id}
            verdi={v}
            valgt={visesSom === v.id}
            eksplisitt={eksplisitt}
            tast={tastekart.get(v.id)}
            onVelg={(e) => {
              e.stopPropagation();
              onVelg(v);
            }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Form i tillegg til farge (§13): fylt, halvfylt, tom. Skal være lesbart uten
 * fargesyn og på avstand.
 */
function Merke({
  verdi,
  valgt,
  eksplisitt,
  tast,
  onVelg,
}: {
  verdi: Skalaverdi;
  valgt: boolean;
  eksplisitt: boolean;
  tast?: string;
  onVelg: (e: React.MouseEvent) => void;
}) {
  const farge = skalafarge(verdi.farge);

  return (
    <button
      onClick={onVelg}
      title={`${tast ? `${tast} — ` : ""}${verdi.kode}${verdi.etikett ? `: ${verdi.etikett}` : ""}`}
      className="grid h-5 w-5 place-items-center rounded-sm hover:bg-linje-medium"
    >
      <span
        className="block h-3 w-3 rounded-full border-2"
        style={{
          borderColor: valgt ? farge : "var(--color-linje)",
          background: valgt
            ? eksplisitt
              ? farge
              : "transparent"
            : "transparent",
          borderStyle: verdi.teller_ikke === 1 ? "dashed" : "solid",
        }}
      />
    </button>
  );
}

function OktFelter({ okt, onEndret }: { okt: Okt; onEndret: () => void }) {
  const [kopiert, setKopiert] = useState(false);

  return (
    <div className="space-y-2 px-5 py-3">
      <div className="flex gap-2">
        <Linje etikett="Dato">
          <input
            type="date"
            defaultValue={okt.dato}
            key={okt.dato}
            onBlur={async (e) => {
              if (e.target.value && e.target.value !== okt.dato) {
                await endreOkt(okt.id, { dato: e.target.value });
                onEndret();
              }
            }}
            className={feltStil}
          />
        </Linje>
        <Linje etikett="Klokkeslett">
          <input
            type="time"
            defaultValue={okt.klokkeslett ?? ""}
            key={okt.klokkeslett ?? ""}
            onBlur={async (e) => {
              await endreOkt(okt.id, { klokkeslett: e.target.value || null });
              onEndret();
            }}
            className={feltStil}
          />
        </Linje>
        <Linje etikett="Varighet">
          <input
            type="number"
            defaultValue={okt.varighetMin}
            key={okt.varighetMin}
            onBlur={async (e) => {
              const n = Number(e.target.value);
              if (n > 0 && n !== okt.varighetMin) {
                await endreOkt(okt.id, { varighet_min: Math.round(n) });
                onEndret();
              }
            }}
            className={feltStil}
          />
        </Linje>
      </div>

      <Linje etikett="Tema">
        <input
          defaultValue={okt.tema ?? ""}
          key={okt.tema ?? ""}
          placeholder="Hva handler økta om?"
          onBlur={async (e) => {
            await endreOkt(okt.id, { tema: e.target.value.trim() || null });
            onEndret();
          }}
          className={feltStil}
        />
      </Linje>

      {/* Fylles ut fra fagets standard rom (Fag-panelet). */}
      <Linje etikett="Rom">
        <input
          defaultValue={okt.sted ?? ""}
          key={okt.sted ?? ""}
          placeholder="Romnummer, sal, ute"
          onBlur={async (e) => {
            await endreOkt(okt.id, { sted: e.target.value.trim() || null });
            onEndret();
          }}
          className={feltStil}
        />
      </Linje>

      {/*
        Agenda er skrevet for eleven og går ut i kalenderen som kommentar.
        Plan og øktlogg lenger ned er lærerens egne notater og går aldri ut.
      */}
      <Linje etikett="Agenda">
        <textarea
          defaultValue={okt.agenda ?? ""}
          key={okt.agenda ?? ""}
          rows={2}
          placeholder="Kort om økta — dette ser elevene i kalenderen"
          onBlur={async (e) => {
            await endreOkt(okt.id, { agenda: e.target.value.trim() || null });
            onEndret();
          }}
          className={feltStil}
        />
        {/*
          Kopien tar med akkurat det agendaen allerede er ment for — det
          eleven skal se. Plan og øktlogg blir igjen her.
        */}
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(teamstekst(okt));
            setKopiert(true);
            setTimeout(() => setKopiert(false), 1500);
          }}
          className="mt-1 text-liten text-blekk-svak hover:text-blekk"
        >
          {kopiert ? (
            <>
              <Ikon navn="hake" /> Kopiert
            </>
          ) : (
            "Kopier til Teams"
          )}
        </button>
      </Linje>

      {/* Lekse står på årsplanarket og i Teams-kopien, aldri i kalenderen. */}
      <Linje etikett="Lekse">
        <textarea
          defaultValue={okt.lekse ?? ""}
          key={okt.lekse ?? ""}
          rows={1}
          placeholder="Til denne økta — står på årsplanen"
          onBlur={async (e) => {
            await endreOkt(okt.id, { lekse: e.target.value.trim() || null });
            onEndret();
          }}
          className={feltStil}
        />
      </Linje>

      <Kompetansemal okt={okt} />

      <Vurderingskobling okt={okt} onEndret={onEndret} />

      {/*
        Plan er tatt ut av panelet — tema, agenda og lekse dekker det som
        trengs. Feltet vises bare der det allerede står noe, så ingenting
        som er skrevet blir borte.
      */}
      {okt.plan && (
        <Linje etikett="Plan">
          <textarea
            defaultValue={okt.plan ?? ""}
            key={okt.plan ?? ""}
            rows={3}
            placeholder="Hva skal skje"
            onBlur={async (e) => {
              await endreOkt(okt.id, { plan: e.target.value.trim() || null });
              onEndret();
            }}
            className={feltStil}
          />
        </Linje>
      )}
    </div>
  );
}

/**
 * Kompetansemålene økta tar for seg. Målene perioden dekker, står huket av
 * av seg selv; her legges det økta tar for seg i tillegg. Fag uten Udir-kode
 * har ingen liste å velge fra, og får et fritekstfelt i stedet.
 */
function Kompetansemal({ okt }: { okt: Okt }) {
  const [mal, setMal] = useState<Oktmal | null>(null);
  const last = () => void hentOktmal(okt.id).then(setMal);
  useEffect(last, [okt.id, okt.periodeId]);

  if (!mal) return null;

  if (!mal.grepKode) {
    return (
      <Linje etikett="Kompetansemål">
        <textarea
          defaultValue={mal.fritekst ?? ""}
          key={mal.fritekst ?? ""}
          rows={1}
          placeholder="Faget har ingen Udir-kode — skriv målet her"
          onBlur={async (e) => {
            await endreOkt(okt.id, {
              kompetansemal: e.target.value.trim() || null,
            });
            last();
          }}
          className={feltStil}
        />
      </Linje>
    );
  }

  return (
    <div>
      <Malvelger
        grepKode={mal.grepKode}
        valgte={mal.egne}
        arvet={
          mal.periodeNavn
            ? { koder: mal.fraPeriode, fra: mal.periodeNavn }
            : undefined
        }
        dekketAndreSteder={mal.dekketAndreSteder}
        onBytt={async (kode, pa) => {
          await settOktmal(okt.id, kode, pa);
          last();
        }}
      />
    </div>
  );
}

/**
 * Vurderingene som holdes i økta, med mulighet til å knytte flere eller løse
 * dem. Står på årsplanen i Vurdering-kolonnen.
 *
 * Ikke en <label> som de andre linjene: den har flere knapper i seg, og et
 * klikk på en label sendes videre til første kontroll inni.
 */
function Vurderingskobling({
  okt,
  onEndret,
}: {
  okt: Okt;
  onEndret: () => void;
}) {
  const [valg, setValg] = useState<Vurderingsvalg[]>([]);
  const ark = useArk();
  const last = () => void hentVurderingsvalg(okt.skolearFagId).then(setValg);
  useEffect(last, [okt.skolearFagId, okt.id]);
  useEffect(() => lyttVurderinger(last), [okt.skolearFagId, okt.id]);

  const her = valg.filter((v) => v.oktIder.includes(okt.id));
  const andre = valg.filter((v) => !v.oktIder.includes(okt.id));

  async function koble(vurderingId: string, pa: boolean) {
    if (pa) await knyttOkt(vurderingId, okt.id);
    else await losOkt(vurderingId, okt.id);
    last();
    onEndret();
  }

  return (
    <div>
      <span className="mb-0.5 block text-etikett uppercase tracking-etikett text-blekk-dempet">
        Vurdering
      </span>
      {her.map((v) => (
        <div key={v.id} className="flex items-baseline gap-2 text-brod">
          <button
            onClick={() => ark.apneVurdering(v.id)}
            className="min-w-0 flex-1 truncate text-left hover:text-aksent hover:underline"
          >
            {v.tittel}
          </button>
          <button
            onClick={() => void koble(v.id, false)}
            className="shrink-0 text-liten text-blekk-svak hover:text-blekk"
          >
            Løs fra økta
          </button>
        </div>
      ))}
      {andre.length > 0 ? (
        <select
          value=""
          onChange={(e) => e.target.value && void koble(e.target.value, true)}
          className={`${feltStil} ${her.length > 0 ? "mt-1" : ""}`}
        >
          <option value="">
            {her.length > 0 ? "Knytt enda en …" : "Knytt en vurdering …"}
          </option>
          {andre.map((v) => (
            <option key={v.id} value={v.id}>
              {v.tittel}
              {v.oktIder.length > 0
                ? ` (står også på ${v.oktIder.length} ${v.oktIder.length === 1 ? "annen økt" : "andre økter"})`
                : ""}
            </option>
          ))}
        </select>
      ) : (
        her.length === 0 && (
          <p className="text-liten text-blekk-svak">
            Ingen vurderinger i faget ennå.
          </p>
        )
      )}
    </div>
  );
}

function Logg({ okt, onEndret }: { okt: Okt; onEndret: () => void }) {
  return (
    <div className="px-5 py-3">
      {/* Ikke en <label>: markdown-visningen er klikkbar i seg selv. */}
      <div>
        <span className="mb-0.5 block text-etikett uppercase tracking-etikett text-blekk-dempet">
          Øktlogg
        </span>
        <Markdownfelt
          key={okt.id}
          verdi={okt.logg}
          minRader={2}
          plassholder="Hvordan gikk det med klassen samlet?"
          onLagre={async (v) => {
            await endreOkt(okt.id, { logg: v });
            onEndret();
          }}
        />
      </div>

      <button
        onClick={async () => {
          if (
            !(await bekreft(
              `Slette økta ${okt.fagKode} ${langDato(okt.dato)}?`,
            ))
          )
            return;
          await slettOkt(okt.id);
          onEndret();
        }}
        className="mt-4 text-liten text-blekk-svak hover:text-red-700"
      >
        Slett økta
      </button>
    </div>
  );
}

function Notat({
  elev,
  onLukk,
}: {
  elev: OktElev;
  oktId: string;
  onLukk: (tekst: string | null) => void;
}) {
  const [tekst, setTekst] = useState(elev.notat ?? "");

  return (
    <div className="border-t border-linje bg-flate px-5 py-3">
      <p className="mb-1 text-etikett uppercase tracking-etikett text-blekk-dempet">
        Notat · {elev.fornavn} {elev.etternavn}
      </p>
      <textarea
        autoFocus
        value={tekst}
        rows={2}
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

export function langDato(dato: string): string {
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
