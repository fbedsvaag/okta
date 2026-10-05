import { useEffect, useRef, useState } from "react";
import { Fagfirkant, Ikon } from "../ui/felles";
import { Markdown, Markdownfelt } from "../ui/Notattekst";
import { useArk } from "../ui/Arkstabel";
import { Elevbilde } from "../ui/Elevbilde";
import { hentAlleElevbilder } from "../data/elevbilde";
import { lyttVurderinger } from "../data/endringer";
import { hentOktmal, settOktmal, type Oktmal } from "../data/perioder";
import { Malvelger } from "./Malvelger";
import { confirm as bekreft } from "@tauri-apps/plugin-dialog";
import {
  endreOkt,
  hentForrigeOkt,
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
  // Elevbildene, små foran navnet — det er her navnene skal sitte i august.
  const [bilder, setBilder] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    void hentAlleElevbilder().then(setBilder);
  }, []);
  // Bildekolonnen står bare når noen i lista har bilde.
  const medBilder = elever.some((e) => bilder.has(e.elevId));
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
  /**
   * Plottet har fast rekkefølge (DESIGN.md §9): verdiene stigende, og
   * «ingenting her» (rang 0) til slutt — rød · gul · grønn · ikke i økta.
   * Formen bærer ikke betydningen lenger, så plassen må gjøre det.
   */
  const plott = [...verdier].sort(
    (a, b) =>
      (a.rang === 0 ? 1 : 0) - (b.rang === 0 ? 1 : 0) || a.rang - b.rang,
  );
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
        <Fagfirkant farge={okt.farge} storrelse={10} klasse="self-center" />
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
              verdier={plott}
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
              skriverNotat={notatFor === elev.elevId}
              onNotatFerdig={async (tekst) => {
                if (tekst !== null) {
                  await settSkaringsnotat(elev.elevId, okt.id, tekst);
                  setElever((f) =>
                    f.map((e) =>
                      e.elevId === elev.elevId
                        ? { ...e, notat: tekst.trim() || null }
                        : e,
                    ),
                  );
                }
                setNotatFor(null);
                liste.current?.focus();
              }}
              onApneElev={() => onApneElev(elev.elevId)}
              bilde={medBilder ? (bilder.get(elev.elevId) ?? null) : undefined}
            />
          ))}
        </div>

        <Logg okt={okt} onEndret={onEndret} />
      </div>
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
  skriverNotat,
  onNotatFerdig,
  onApneElev,
  bilde,
}: {
  elev: OktElev;
  /** bildet; null = har ikke bilde (initialene står), utelatt = ingen kolonne */
  bilde?: string | null;
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
  /** notatfeltet er åpent i denne raden (N) */
  skriverNotat: boolean;
  /** null = avbrutt */
  onNotatFerdig: (tekst: string | null) => void;
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
      // Skåringslista holder 28 px rader, så tretti elever får plass uten
      // scrolling på en 14-tommer (DESIGN.md §3). Høyden er låst, så heller
      // ikke notatfeltet i raden kan gjøre den høyere.
      className={`group flex h-7 cursor-default items-center gap-2 border-b border-linje-svak px-5 text-liten ${
        markert ? "bg-valgt" : "hover:bg-flate"
      }`}
    >
      <span className="w-3 text-etikett text-aksent">
        {markert ? <Ikon navn="markor" /> : null}
      </span>
      {/* 20 px, så raden holder seg på 28 (DESIGN.md §3). */}
      {bilde !== undefined &&
        (bilde ? (
          <Elevbilde src={bilde} storrelse={20} hjorne={4} />
        ) : (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] bg-flate text-[8px] font-medium text-blekk-svak">
            {elev.fornavn[0]}
            {elev.etternavn[0] ?? ""}
          </span>
        ))}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onApneElev();
        }}
        title="Åpne eleven"
        className={`w-[clamp(150px,28%,230px)] shrink-0 truncate text-left text-liten hover:text-aksent hover:underline ${
          eksplisitt ? "" : "text-blekk-dempet"
        }`}
      >
        {elev.fornavn} {elev.etternavn}
      </button>

      <span className="w-12 shrink-0 truncate text-blekk-dempet">
        {elev.klasse ?? ""}
      </span>

      {/*
        Notatet fra denne økta, i egen kolonne. N åpner feltet rett i raden.
        Står markøren på en elev uten notat, vises forrige notat i grått —
        det man skrev sist er ofte det man trenger å huske nå.
      */}
      {skriverNotat ? (
        <Notatfelt start={elev.notat ?? ""} onFerdig={onNotatFerdig} />
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNotat();
          }}
          title={
            elev.notat ??
            (elev.forrigeNotat
              ? `Forrige økt: ${elev.forrigeNotat}`
              : "Legg til notat (N)")
          }
          className="min-w-0 flex-1 truncate text-left text-liten"
        >
          {elev.notat ? (
            <span className="text-blekk">{elev.notat}</span>
          ) : markert && elev.forrigeNotat ? (
            <span className="italic text-blekk-svak">{elev.forrigeNotat}</span>
          ) : (
            <span className="text-blekk-svakest opacity-0 group-hover:opacity-100">
              + notat
            </span>
          )}
        </button>
      )}

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
 * Helfylt sirkel i verdiens farge (DESIGN.md §9). Valgt verdi står i full
 * styrke, de andre er nesten usynlige. Formen bærer ikke lenger betydningen;
 * det gjør den faste rekkefølgen i raden, verktøytipset og at gul er klart
 * lysest. En verdi som bare er fylt ut ved visning — eleven er ikke trykket
 * på — tegnes som ikke skåret: ingenting valgt.
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
        className="block h-3 w-3 rounded-full"
        style={{
          background: farge,
          opacity: valgt && eksplisitt ? 1 : 0.18,
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

/**
 * Det du skrev i loggen forrige gang i faget, rett over dagens logg — så
 * beskjeden fra sist står der du er når timen begynner.
 */
function Forrigenotat({ okt }: { okt: Okt }) {
  const [forrige, setForrige] = useState<Awaited<
    ReturnType<typeof hentForrigeOkt>
  > | null>(null);
  const ark = useArk();
  useEffect(() => {
    void hentForrigeOkt(okt).then(setForrige);
  }, [okt.id, okt.dato, okt.klokkeslett]);

  if (!forrige) return null;

  return (
    <div className="mb-3">
      <button
        onClick={() => ark.apneOkt(forrige.id)}
        className="mb-0.5 block text-etikett uppercase tracking-etikett text-blekk-dempet hover:text-blekk"
      >
        Notat fra forrige økt · {langDato(forrige.dato)}
      </button>
      {forrige.logg?.trim() ? (
        <div className="rounded-vanlig border-l-2 border-linje-sterk bg-flate-svak px-3 py-1.5 text-blekk-dempet">
          <Markdown tekst={forrige.logg} />
        </div>
      ) : (
        <p className="text-liten text-blekk-svak">
          Du skrev ikke noe notat forrige økt.
        </p>
      )}
    </div>
  );
}

function Logg({ okt, onEndret }: { okt: Okt; onEndret: () => void }) {
  return (
    <div className="px-5 py-3">
      <Forrigenotat okt={okt} />
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
        className="mt-4 text-liten text-blekk-svak hover:text-feil"
      >
        Slett økta
      </button>
    </div>
  );
}

/**
 * Notatfeltet i raden. Én linje, samme høyde som raden: Enter lagrer, Esc
 * angrer. Tom tekst fjerner notatet.
 */
function Notatfelt({
  start,
  onFerdig,
}: {
  start: string;
  onFerdig: (tekst: string | null) => void;
}) {
  const [tekst, setTekst] = useState(start);
  // Esc og Enter flytter fokus tilbake til lista, og da mister feltet
  // fokus. Uten vakta ville blur-en lagre teksten man nettopp angret.
  const ferdig = useRef(false);
  const avslutt = (t: string | null) => {
    if (ferdig.current) return;
    ferdig.current = true;
    onFerdig(t);
  };
  return (
    <input
      autoFocus
      value={tekst}
      placeholder="Notat — Enter lagrer, Esc angrer"
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setTekst(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") avslutt(null);
        if (e.key === "Enter") avslutt(tekst);
      }}
      onBlur={() => avslutt(tekst)}
      className="h-5 min-w-0 flex-1 rounded-vanlig border border-aksent bg-ark px-1.5 text-liten outline-none placeholder:text-blekk-svak"
    />
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
