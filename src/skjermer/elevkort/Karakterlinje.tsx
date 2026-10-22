import { useEffect, useState } from "react";
import {
  hentKarakterdata,
  iTermin,
  somDesimal,
  vektetSnitt,
  type Karakterdata,
} from "../../data/karakterer";
import { lyttVurderinger } from "../../data/endringer";

/**
 * Elevens rad fra Karakterer i faget (29.4), på elevkortet: beregnet
 * vektet snitt for året, halvårskarakterene og kommentaren. Samme tall som
 * fanen, regnet med samme kode.
 */
export function Karakterlinje({
  elevId,
  skolearFagId,
  skolearSlutt,
}: {
  elevId: string;
  skolearFagId: string;
  skolearSlutt: string;
}) {
  const [data, setData] = useState<Karakterdata | null>(null);
  useEffect(() => {
    const last = () => void hentKarakterdata(skolearFagId).then(setData);
    last();
    return lyttVurderinger(last);
  }, [skolearFagId]);
  if (!data) return null;
  const snitt = (t: "host" | "var" | "aar") =>
    vektetSnitt(
      elevId,
      data.vurderinger.filter((v) => iTermin(v.dato, t, skolearSlutt)),
      data.resultater,
    );
  const h = (t: "host" | "var") => data.halvar.get(`${t}:${elevId}`);
  const aar = snitt("aar");
  if (aar === null && !h("host")?.karakter && !h("var")?.karakter) return null;
  const kommentar = h("var")?.kommentar ?? h("host")?.kommentar;
  return (
    <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-liten text-blekk-dempet">
      <span>
        Beregnet <b className="tabular-nums text-blekk">{somDesimal(aar)}</b>
      </span>
      <span>
        Høst{" "}
        <b className="tabular-nums text-blekk">{h("host")?.karakter ?? "–"}</b>
      </span>
      <span>
        Vår{" "}
        <b className="tabular-nums text-blekk">{h("var")?.karakter ?? "–"}</b>
      </span>
      {kommentar && <span className="text-blekk-svak">{kommentar}</span>}
    </div>
  );
}
