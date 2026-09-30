import { useId } from "react";

/**
 * Elevbildet, i Økta-looken: gråtoner lagt i åtte trinn (svakt posterisert) og
 * tonet fra blekk til lys lilla. Bildet er lagret som vanlige gråtoner;
 * looken er et SVG-filter her, så den kan justeres uten ny import.
 *
 * Kornet fra PDF-utskriften får stå — det er en del av poenget.
 */

// Blekk (#241f33) i skyggene, valgt-lilla (#e3ddf0) i lyset.
const MORK = [0x24, 0x1f, 0x33];
const LYS = [0xe3, 0xdd, 0xf0];
const TRINN = 8;

/** Tabellen per fargekanal: trinnene fra mørk til lys. */
function trinn(kanal: number): string {
  return Array.from({ length: TRINN }, (_, i) => {
    const t = i / (TRINN - 1);
    return ((MORK[kanal] + (LYS[kanal] - MORK[kanal]) * t) / 255).toFixed(3);
  }).join(" ");
}

export function Elevbilde({
  src,
  storrelse = 64,
  klasse = "",
  alt = "",
}: {
  src: string;
  /** sidene i px — bildet er kvadratisk, beskåret om midten */
  storrelse?: number;
  klasse?: string;
  alt?: string;
}) {
  const id = `elevbilde-${useId().replace(/:/g, "")}`;
  return (
    <span
      className={`relative shrink-0 overflow-clip rounded-liten bg-valgt ${klasse}`}
      style={{ width: storrelse, height: storrelse }}
    >
      <svg aria-hidden width="0" height="0" className="absolute">
        <filter id={id} colorInterpolationFilters="sRGB">
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncR type="discrete" tableValues={trinn(0)} />
            <feFuncG type="discrete" tableValues={trinn(1)} />
            <feFuncB type="discrete" tableValues={trinn(2)} />
          </feComponentTransfer>
        </filter>
      </svg>
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="block h-full w-full object-cover"
        style={{ filter: `url(#${id})` }}
      />
    </span>
  );
}
