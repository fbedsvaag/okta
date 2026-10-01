import { useEffect, useState } from "react";

/**
 * Elevbildet, i Økta-looken: halvtone som i avistrykk — prikker som vokser
 * der bildet er mørkt — over en myk tone fra blekk til lys lilla, og et
 * pittelite korn oppå.
 *
 * Bildet er lagret som vanlige gråtoner; looken tegnes her, når bildet
 * vises, så den kan justeres uten ny import. Resultatet huskes per bilde og
 * størrelse, så det tegnes bare én gang.
 */

// Blekk (#241f33) i skyggene, valgt-lilla (#e3ddf0) i lyset.
const MORK: [number, number, number] = [0x24, 0x1f, 0x33];
const LYS: [number, number, number] = [0xe3, 0xdd, 0xf0];
/** Rastervinkelen, som i trykk — 45° skjuler rutenettet best. */
const VINKEL = Math.PI / 4;
/** Hvor tydelig den myke tonen under prikkene står, 0–1. */
const UNDERTONE = 0.8;
/** Hvor dekkende prikkene er. Under 1 lar tonen under skinne gjennom. */
const PRIKKDEKNING = 0.5;
/** Lysner mellomtonene litt, så bakgrunnen ikke fylles av prikker. */
const GAMMA = 0.8;
/** Kornet, i gråtrinn opp og ned. */
const KORN = 9;

const ferdige = new Map<string, string>();

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
  const nokkel = `${storrelse}:${src}`;
  const [tegnet, setTegnet] = useState(() => ferdige.get(nokkel) ?? null);

  useEffect(() => {
    const finnes = ferdige.get(nokkel);
    if (finnes) return setTegnet(finnes);
    let avbrutt = false;
    void halvtone(src, storrelse).then((url) => {
      ferdige.set(nokkel, url);
      if (!avbrutt) setTegnet(url);
    });
    return () => {
      avbrutt = true;
    };
  }, [nokkel, src, storrelse]);

  return (
    <span
      className={`relative shrink-0 overflow-clip rounded-liten bg-valgt ${klasse}`}
      style={{ width: storrelse, height: storrelse }}
    >
      {tegnet && (
        <img
          src={tegnet}
          alt={alt}
          draggable={false}
          className="block h-full w-full"
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

/** Tegner halvtonen i et lerret og gir det tilbake som PNG data-URL. */
async function halvtone(src: string, storrelse: number): Promise<string> {
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

  // Kontrasten strekkes mellom 2. og 98. persentil — utskriftene er grå og
  // flate — og mellomtonene løftes litt.
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
  const lys = (x: number, y: number) => {
    const cx = Math.min(px - 1, Math.max(0, Math.round(x)));
    const cy = Math.min(px - 1, Math.max(0, Math.round(y)));
    return kilde[cy * px + cx];
  };

  // 1. Den myke tonen under, løftet mot lyset så prikkene bærer bildet.
  const ut = g.createImageData(px, px);
  for (let i = 0; i < px * px; i++) {
    const l = kilde[i];
    const [r, gr, b] = blandFarge(1 - (1 - l) * UNDERTONE);
    ut.data[i * 4] = r;
    ut.data[i * 4 + 1] = gr;
    ut.data[i * 4 + 2] = b;
    ut.data[i * 4 + 3] = 255;
  }
  g.putImageData(ut, 0, 0);

  // 2. Prikkene, i et rutenett dreid 45°. Arealet følger mørket.
  // Rasteret: rundt femti prikker over bildet, men aldri finere enn at en
  // prikk fortsatt er en prikk på skjermen.
  const tetthet = px / storrelse;
  const celle = Math.max(2.4 * tetthet, px / 50);
  const cos = Math.cos(VINKEL);
  const sin = Math.sin(VINKEL);
  const rekkevidde = Math.ceil((px * 1.5) / celle);
  g.fillStyle = `rgb(${MORK.join(",")})`;
  g.globalAlpha = PRIKKDEKNING;
  for (let i = -rekkevidde; i <= rekkevidde; i++) {
    for (let j = -rekkevidde; j <= rekkevidde; j++) {
      const u = i * celle;
      const v = j * celle;
      const x = px / 2 + u * cos - v * sin;
      const y = px / 2 + u * sin + v * cos;
      if (x < -celle || y < -celle || x > px + celle || y > px + celle)
        continue;
      const morke = 1 - lys(x, y);
      const r = (celle / 2) * Math.sqrt(morke);
      if (r < 0.25) continue;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  }

  g.globalAlpha = 1;

  // 3. Kornet. Fast frø, så samme bilde får samme korn hver gang.
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
