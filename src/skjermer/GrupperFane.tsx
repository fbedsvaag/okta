import { useEffect, useState } from "react";
import {
  endreKart,
  hentKart,
  hentKildeElever,
  hentRegler,
  kartForKilde,
  type Elevregel,
  type Innstillinger,
  type Kart,
  type Kartelev,
  type Kildetype,
} from "../data/klassekart";
import { hentFagIAr, type FagIAr } from "../data/fag";
import { hentKlasser, type Klasse } from "../data/elever";
import { hentOkter, type Okt } from "../data/okter";
import { hentInnstilling } from "../data/skolear";
import { lyttKlassekart } from "../data/endringer";
import { useLagretInnstilling } from "../ui/useLagretInnstilling";
import { fagfarge } from "../ui/farger";
import { KlassekartGrupper } from "./KlassekartGrupper";

/**
 * Grupper-fanen i Plasser og grupper (ARBEIDSLISTE 25.3, lerretet
 * PlasserGrupper): grupper for en klasse eller et fag, uten rom og kart.
 * Kilden velges som chip; faget i økta du har nå er valgt. Gruppene og
 * historikken ligger på kildens kart (et skjult et når kilden ikke har
 * noe), så fanen og klassekartet deler «Unngå samme som sist».
 */

export type Kilde = {
  type: Kildetype;
  id: string;
  navn: string;
  farge: string | null;
  antall: number;
};

const nokkel = (k: { type: Kildetype; id: string }) => `${k.type}:${k.id}`;

/** Faget i økta som pågår nå, eller den neste i dag. */
export function fagNa(okter: Okt[], na = new Date()): string | null {
  const dag = na.toLocaleDateString("sv-SE");
  const min = na.getHours() * 60 + na.getMinutes();
  const iDag = okter
    .filter((o) => o.dato === dag && o.klokkeslett)
    .map((o) => {
      const [t, m] = o.klokkeslett!.split(":").map(Number);
      return { o, fra: t * 60 + m, til: t * 60 + m + o.varighetMin };
    })
    .sort((a, b) => a.fra - b.fra);
  const pagar = iDag.find((x) => x.fra <= min && min < x.til);
  const neste = iDag.find((x) => x.fra > min);
  return (pagar ?? neste ?? iDag[iDag.length - 1])?.o.skolearFagId ?? null;
}

export function GrupperFane({ skolearId }: { skolearId: string }) {
  const [kilder, setKilder] = useState<Kilde[]>([]);
  const [valgt, setValgt] = useLagretInnstilling<string>(
    "grupper_kilde",
    "",
    (v) => v ?? "",
    String,
  );
  const [kart, setKart] = useState<Kart | null>(null);
  const [elever, setElever] = useState<Kartelev[]>([]);
  const [regler, setRegler] = useState<Elevregel[]>([]);

  // Kildene: fagene i året, klassene, og mentorgruppa om du er mentor.
  useEffect(() => {
    void (async () => {
      const [fag, klasser, okter, mentor] = await Promise.all([
        hentFagIAr(skolearId),
        hentKlasser(skolearId),
        hentOkter(skolearId),
        hentInnstilling("mentor"),
      ]);
      const ut: Kilde[] = [];
      for (const f of fag as FagIAr[])
        ut.push({
          type: "fag",
          id: f.id,
          navn: f.kode,
          farge: f.farge,
          antall: (await hentKildeElever("fag", f.id, skolearId)).length,
        });
      for (const k of klasser as Klasse[])
        ut.push({
          type: "klasse",
          id: k.id,
          navn: k.navn,
          farge: null,
          antall: k.antall,
        });
      if (mentor === "pa")
        ut.push({
          type: "mentorgruppe",
          id: skolearId,
          navn: "Mentorgruppa",
          farge: null,
          antall: (await hentKildeElever("mentorgruppe", skolearId, skolearId))
            .length,
        });
      setKilder(ut.filter((k) => k.antall > 0));
      // Faget i økta du har nå går foran det du valgte sist.
      const na = fagNa(okter);
      if (na) setValgt(nokkel({ type: "fag", id: na }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skolearId]);

  const kilde = kilder.find((k) => nokkel(k) === valgt) ?? kilder[0] ?? null;

  useEffect(() => {
    if (!kilde) return;
    let avbrutt = false;
    const last = async () => {
      const id = await kartForKilde(skolearId, kilde.type, kilde.id);
      const [k, e, r] = await Promise.all([
        hentKart(skolearId, true).then((a) => a.find((x) => x.id === id)),
        hentKildeElever(kilde.type, kilde.id, skolearId),
        hentRegler(kilde.type, kilde.id),
      ]);
      if (avbrutt || !k) return;
      setKart(k);
      setElever(e);
      setRegler(r);
    };
    void last();
    return () => {
      avbrutt = true;
    };
  }, [skolearId, kilde && nokkel(kilde)]);

  // Reglene kan endres i klassekartet; de leses på nytt.
  useEffect(
    () =>
      lyttKlassekart(() => {
        if (kilde) void hentRegler(kilde.type, kilde.id).then(setRegler);
      }),
    [kilde && nokkel(kilde)],
  );

  function endreInnst(endring: Partial<Innstillinger>) {
    if (!kart) return;
    const ny = { ...kart.innstillinger, ...endring };
    setKart({ ...kart, innstillinger: ny });
    void endreKart(kart.id, { innstillinger: ny });
  }

  if (kilder.length === 0)
    return (
      <p className="py-10 text-center text-brod text-blekk-dempet">
        Ingen fag eller klasser med elever ennå.
      </p>
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="ikkeutskrift flex flex-wrap items-center gap-2 pb-3">
        {kilder.map((k) => {
          const pa = kilde && nokkel(k) === nokkel(kilde);
          return (
            <button
              key={nokkel(k)}
              onClick={() => setValgt(nokkel(k))}
              aria-pressed={!!pa}
              className={`flex h-[30px] items-center gap-2 rounded-full px-3 text-[13px] ${
                pa
                  ? "bg-ark font-medium shadow-[inset_0_0_0_1.5px_var(--color-aksent)]"
                  : "bg-flate-svak text-blekk-dempet hover:bg-flate"
              }`}
            >
              {k.type === "mentorgruppe" ? (
                <span className="h-2 w-2 rounded-full bg-aksent" />
              ) : (
                <span
                  className="h-2 w-2 rounded-[2px]"
                  style={{
                    background: k.farge
                      ? fagfarge(k.farge)
                      : "var(--color-linje-sterk)",
                  }}
                />
              )}
              {k.navn}
              <span className="text-etikett tabular-nums text-blekk-svak">
                {k.antall}
              </span>
            </button>
          );
        })}
        <span className="ml-1 text-etikett text-blekk-svak">
          Faget i økta du har nå er valgt.
        </span>
      </div>
      {kart && (
        <KlassekartGrupper
          key={kart.id}
          kart={kart}
          innst={kart.innstillinger}
          elever={elever}
          regler={regler}
          onEndreInnst={endreInnst}
        />
      )}
    </div>
  );
}
