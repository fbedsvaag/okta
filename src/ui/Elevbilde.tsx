import { useEffect, useState } from "react";

/**
 * Elevbildet, i Økta-looken: en myk tone fra blekk til lys lilla, og et
 * pittelite korn oppå. (Halvtone ble prøvd og tatt bort igjen.)
 *
 * Bildet er lagret som vanlige gråtoner; looken tegnes her, når bildet
 * vises, så den kan justeres uten ny import. Resultatet huskes per bilde og
 * størrelse, så det tegnes bare én gang.
 */

// Blekk (#241f33) i skyggene, valgt-lilla (#e3ddf0) i lyset.
const MORK: [number, number, number] = [0x24, 0x1f, 0x33];
const LYS: [number, number, number] = [0xe3, 0xdd, 0xf0];
/** Lysner mellomtonene litt; utskriftene er mørke og flate. */
const GAMMA = 0.85;
/** Kornet, i gråtrinn opp og ned. */
const KORN = 9;

const ferdige = new Map<string, string>();

export function Elevbilde({
  src,
  storrelse = 64,
  klasse = "",
  alt = "",
  hjorne,
}: {
  src: string;
  /** hjørneradius i px; uten står appens små hjørner */
  hjorne?: number;
  /** sidene i px — bildet er kvadratisk, beskåret om midten */
  storrelse?: number;
  klasse?: string;
  alt?: string;
}) {
  const nokkel = `${storrelse}:${src}`;
  const [tegnet, setTegnet] = useState(() => ferdige.get(nokkel) ?? null);

  useEffect(() => {
    const finnes = ferdige.get(nokkel);
    if (finnes) return setTegnet(finnes);
    let avbrutt = false;
    void tone(src, storrelse).then((url) => {
      ferdige.set(nokkel, url);
      if (!avbrutt) setTegnet(url);
    });
    return () => {
      avbrutt = true;
    };
  }, [nokkel, src, storrelse]);

  return (
    <span
      className={`relative shrink-0 overflow-hidden bg-valgt ${hjorne === undefined ? "rounded-liten" : ""} ${klasse}`}
      style={{
        width: storrelse,
        height: storrelse,
        borderRadius: hjorne,
      }}
    >
      {tegnet && (
        <img
          src={tegnet}
          alt={alt}
          draggable={false}
          className="block h-full w-full"
          // Hjørnene også på bildet: WebKit klipper ikke alltid barnet
          // etter forelderens radius.
          style={{ borderRadius: hjorne }}
        />
      )}
    </span>
  );
}

function blandFarge(t: number): [number, number, number] {
  return [0, 1, 2].map((k) => MORK[k] + (LYS[k] - MORK[k]) * t) as [
    number,
    number,
    number,
  ];
}

/** Tegner bildet med tonen og kornet, og gir det tilbake som PNG data-URL. */
async function tone(src: string, storrelse: number): Promise<string> {
  const bilde = new Image();
  bilde.src = src;
  await bilde.decode();

  const px = Math.round(storrelse * Math.max(2, window.devicePixelRatio || 1));
  const lerret = document.createElement("canvas");
  lerret.width = lerret.height = px;
  const g = lerret.getContext("2d", { willReadFrequently: true })!;

  // Kvadratisk utsnitt om midten, litt høyt — ansiktet sitter over midten.
  const side = Math.min(bilde.width, bilde.height);
  const sx = (bilde.width - side) / 2;
  const sy = Math.max(0, (bilde.height - side) * 0.3);
  g.drawImage(bilde, sx, sy, side, side, 0, 0, px, px);
  const raa = g.getImageData(0, 0, px, px).data;

  // Kontrasten strekkes mellom 2. og 98. persentil, og mellomtonene løftes
  // litt.
  const verdier = new Uint8Array(px * px);
  for (let i = 0; i < verdier.length; i++) verdier[i] = raa[i * 4];
  const sortert = [...verdier].sort((a, b) => a - b);
  const lav = sortert[Math.floor(sortert.length * 0.02)];
  const hoy = Math.max(lav + 1, sortert[Math.floor(sortert.length * 0.98)]);
  const kilde = new Float32Array(px * px);
  for (let i = 0; i < kilde.length; i++) {
    const t = Math.min(1, Math.max(0, (verdier[i] - lav) / (hoy - lav)));
    kilde[i] = Math.pow(t, GAMMA);
  }
  // Tonen: gråtonene lagt fra blekk i skyggene til lys lilla i lyset.
  const ut = g.createImageData(px, px);
  for (let i = 0; i < px * px; i++) {
    const [r, gr, b] = blandFarge(kilde[i]);
    ut.data[i * 4] = r;
    ut.data[i * 4 + 1] = gr;
    ut.data[i * 4 + 2] = b;
    ut.data[i * 4 + 3] = 255;
  }
  g.putImageData(ut, 0, 0);

  // Kornet. Fast frø, så samme bilde får samme korn hver gang.
  const ferdig = g.getImageData(0, 0, px, px);
  let frø = src.length;
  const tilfeldig = () => {
    frø = (frø * 1664525 + 1013904223) % 4294967296;
    return frø / 4294967296;
  };
  for (let i = 0; i < ferdig.data.length; i += 4) {
    const s = (tilfeldig() - 0.5) * 2 * KORN;
    ferdig.data[i] += s;
    ferdig.data[i + 1] += s;
    ferdig.data[i + 2] += s;
  }
  g.putImageData(ferdig, 0, 0);

  return lerret.toDataURL("image/png");
}
