#!/usr/bin/env python3
"""
Henter SSBs åpne navnestatistikk og skriver src/data/fornavn.json.

Kjøres av eieren ved behov, aldri av appen: appen gjør ingen nettverkskall
(CLAUDE.md, regel 1). Fila som skrives, committes og følger appen.

Kilde: Statistisk sentralbyrå (SSB), tabell 10501 «Personer, etter jente-
eller guttenavn», CC BY 4.0. Hvert navn står som jentenavn (kode med «1»
foran) og/eller guttenavn («2» foran), med antall personer som har det.

Resultatet er fornavn (små bokstaver) → andel jenter, 0–1, med tre
desimaler. Bare navn med minst 50 bærere er med. Appen gjetter kjønn når
andelen er ≥ 0,95 (jente) eller ≤ 0,05 (gutt), og lar resten stå tomt.

Bruk:  python3 scripts/hent_navn.py
"""
import json
import pathlib
import urllib.request

TABELL = "https://data.ssb.no/api/v0/no/table/10501"
UT = pathlib.Path(__file__).resolve().parent.parent / "src" / "data" / "fornavn.json"
MINST = 50


def hent(url, data=None):
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode() if data else None,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as svar:
        return json.load(svar)


def main():
    meta = hent(TABELL)
    variabler = {v["code"]: v for v in meta["variables"]}
    fornavn = variabler["Fornavn"]
    sist = variabler["Tid"]["values"][-1]
    tekst = dict(zip(fornavn["values"], fornavn["valueTexts"]))

    svar = hent(
        TABELL,
        {
            "query": [
                {"code": "Fornavn", "selection": {"filter": "all", "values": ["*"]}},
                {"code": "ContentsCode", "selection": {"filter": "item", "values": ["Personer"]}},
                {"code": "Tid", "selection": {"filter": "item", "values": [sist]}},
            ],
            "response": {"format": "json-stat2"},
        },
    )
    koder = svar["dimension"]["Fornavn"]["category"]["index"]
    verdier = svar["value"]

    jenter: dict[str, int] = {}
    gutter: dict[str, int] = {}
    for kode, i in koder.items():
        antall = verdier[i] or 0
        navn = tekst[kode].strip().lower()
        if kode.startswith("1"):
            jenter[navn] = jenter.get(navn, 0) + antall
        elif kode.startswith("2"):
            gutter[navn] = gutter.get(navn, 0) + antall

    ut = {}
    for navn in sorted(set(jenter) | set(gutter)):
        j = jenter.get(navn, 0)
        g = gutter.get(navn, 0)
        if j + g >= MINST:
            ut[navn] = round(j / (j + g), 3)

    UT.write_text(json.dumps(ut, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Skrev {len(ut)} navn fra SSB tabell 10501 ({sist}) til {UT}")


if __name__ == "__main__":
    main()
