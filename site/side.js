/*
 * Hjemmesiden for Økta. Vanlig JavaScript, ingen avhengigheter, ingen
 * nettverkskall. Uten skript virker siden fortsatt: lenkene går til
 * nedlastingssiden, svarene står åpne, og kortene viser sluttbildet.
 */
(function () {
  "use strict";

  var rolig =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------- Mac eller Windows */

  var ua = navigator.userAgent || "";
  var erWindows = /Windows/i.test(ua);
  var os = erWindows ? "win" : "mac";

  // Knappen for maskinen man sitter på, står først og mørk.
  document.querySelectorAll(".knapper").forEach(function (rad) {
    var mac = rad.querySelector('[data-os="mac"]');
    var win = rad.querySelector('[data-os="win"]');
    if (!mac || !win || !erWindows) return;
    rad.insertBefore(win, mac);
    win.classList.replace("sek", "pri");
    mac.classList.replace("pri", "sek");
  });

  var faner = document.querySelectorAll('.osvalg [role="tab"]');
  function velgOs(valg, fokus) {
    faner.forEach(function (f) {
      var pa = f.id === "fane-" + valg;
      f.setAttribute("aria-selected", pa ? "true" : "false");
      f.tabIndex = pa ? 0 : -1;
      var panel = document.getElementById(f.getAttribute("aria-controls"));
      if (panel) panel.hidden = !pa;
      if (pa && fokus) f.focus();
    });
  }
  faner.forEach(function (f) {
    f.addEventListener("click", function () {
      velgOs(f.id.replace("fane-", ""));
    });
    f.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      velgOs(f.id === "fane-mac" ? "win" : "mac", true);
    });
  });
  velgOs(os);

  /* ------------------------------------------------------------ spørsmål */

  document.querySelectorAll(".sp button").forEach(function (knapp) {
    knapp.addEventListener("click", function () {
      var sp = knapp.closest(".sp");
      var apen = !sp.classList.contains("apen");
      document.querySelectorAll(".sp.apen").forEach(function (x) {
        if (x === sp) return;
        x.classList.remove("apen");
        x.querySelector("button").setAttribute("aria-expanded", "false");
      });
      sp.classList.toggle("apen", apen);
      knapp.setAttribute("aria-expanded", apen ? "true" : "false");
    });
  });

  /* ---------------------------------------------------- når de synes */

  /** Kjører `start` første gang elementet ruller inn i bildet. */
  function nar(el, start) {
    if (!el) return;
    if (rolig || !("IntersectionObserver" in window)) {
      start();
      return;
    }
    var io = new IntersectionObserver(
      function (sett) {
        sett.forEach(function (x) {
          if (x.isIntersecting) {
            io.disconnect();
            start();
          }
        });
      },
      { threshold: 0.35 },
    );
    io.observe(el);
  }

  function lag(tag, kl, tekst) {
    var e = document.createElement(tag);
    if (kl) e.className = kl;
    if (tekst !== undefined) e.textContent = tekst;
    return e;
  }

  /* ------------------------------------------ animasjon: skåring */

  var ELEVER = [
    ["Alex Tangen", "1STA", "g"],
    ["Ella Fjeld", "1STA", "g"],
    ["Elias Berg", "1STA", "y"],
    ["Emil Strand", "1STA", "g"],
    ["Emma Sand", "1STA", "o"],
    ["Filip Dahl", "1STA", "r"],
    ["Henrik Aas", "1STA", "g"],
    ["Ida Moe", "1STA", "y"],
    ["Ingrid Bakken", "1STB", "g"],
    ["Jakob Næss", "1STB", "g"],
    ["Jonas Lie", "1STB", "y"],
    ["Maja Lund", "1STB", "g"],
  ];
  var TAST = { r: "1", y: "2", g: "3", o: "0" };
  var NAVN = { r: "rød", y: "gul", g: "grønn", o: "ikke i økta" };

  (function () {
    var kort = document.querySelector("[data-skaring]");
    if (!kort) return;
    var liste = kort.querySelector("[data-sk-liste]");
    var mark = kort.querySelector("[data-sk-mark]");
    var teller = kort.querySelector("[data-sk-teller]");
    var stolpe = kort.querySelector("[data-sk-stolpe]");
    var ferdig = kort.querySelector("[data-sk-ferdig]");
    var rader = ELEVER.map(function (e) {
      var li = lag("li", "skr");
      var prikker = lag("span", "prikker");
      prikker.setAttribute("aria-hidden", "true");
      ["r", "y", "g"].forEach(function (k) {
        prikker.appendChild(lag("span", "skd " + k));
      });
      prikker.appendChild(lag("span", "sko"));
      li.appendChild(prikker);
      li.appendChild(lag("span", "navn", e[0]));
      li.appendChild(lag("span", "klasse num", e[1]));
      var status = lag("span", "", "");
      status.style.position = "absolute";
      status.style.width = "1px";
      status.style.height = "1px";
      status.style.overflow = "hidden";
      status.style.clip = "rect(0 0 0 0)";
      li.appendChild(status);
      liste.appendChild(li);
      return { li: li, prikker: prikker, status: status, s: e[2] };
    });

    var n = 0;
    var tid = 0;
    var vent = 0;

    function tegn() {
      rader.forEach(function (r, i) {
        var gjort = i < n;
        var sist = i === n - 1;
        r.prikker.querySelectorAll(".skd").forEach(function (d) {
          var k = d.classList.contains("r")
            ? "r"
            : d.classList.contains("y")
              ? "y"
              : "g";
          d.classList.toggle("p", gjort && r.s === k && sist && !rolig);
          d.classList.toggle("p2", gjort && r.s === k && !(sist && !rolig));
        });
        r.prikker
          .querySelector(".sko")
          .classList.toggle("b", gjort && r.s === "o");
        r.li.classList.toggle("borte", gjort && r.s === "o");
        r.status.textContent = gjort ? ": " + NAVN[r.s] : "";
        var tast = r.li.querySelector(".sktast");
        if (sist && !rolig) {
          if (!tast) {
            tast = lag("span", "sktast", TAST[r.s]);
            tast.setAttribute("aria-hidden", "true");
            r.li.appendChild(tast);
          }
        } else if (tast) tast.remove();
      });
      var antall = Math.min(n, rader.length);
      mark.style.transform =
        "translateY(" + Math.min(n, rader.length - 1) * 36 + "px)";
      mark.style.opacity = n >= rader.length ? "0" : "1";
      teller.textContent = antall + " av " + rader.length + " skåret";
      stolpe.style.width = (antall / rader.length) * 100 + "%";
      ferdig.hidden = n < rader.length;
      ferdig.textContent =
        "Hele klassen på " +
        String(Math.round(rader.length * 0.42 * 10) / 10).replace(".", ",") +
        " sekunder";
    }

    function spill() {
      clearInterval(tid);
      clearTimeout(vent);
      if (rolig) {
        n = rader.length;
        tegn();
        return;
      }
      n = 0;
      tegn();
      tid = setInterval(function () {
        n++;
        tegn();
        if (n >= rader.length) {
          clearInterval(tid);
          vent = setTimeout(spill, 5000);
        }
      }, 420);
    }

    // Før det ruller inn: sluttbildet.
    n = rader.length;
    tegn();
    kort.querySelector("[data-sk-igjen]").addEventListener("click", spill);
    nar(kort, spill);
  })();

  /* --------------------------------------- animasjon: planlegging */

  var PLAN = [
    ["Repetisjon fra sist", 10, false],
    ["Gjennomgang: byene vokser", 25, false],
    ["Pause", 10, true],
    ["Arbeid med veggavis", 30, false],
    ["Oppsummering", 15, false],
  ];
  var LENGDE = 90;
  var STEG = 8;

  (function () {
    var kort = document.querySelector("[data-plan]");
    if (!kort) return;
    var tl = kort.querySelector("[data-pl-tl]");
    var radliste = kort.querySelector("[data-pl-rader]");
    var sum = kort.querySelector("[data-pl-sum]");
    var boks = kort.querySelector("[data-pl-boks]");
    var maaltekst = kort.querySelector("[data-pl-maaltekst]");

    var felt = PLAN.map(function (a) {
      var s = lag("div", "pseg" + (a[2] ? " p" : ""));
      s.appendChild(lag("div", "pt1", a[2] ? "Pause" : a[0]));
      s.appendChild(lag("div", "pt2 num", ""));
      tl.appendChild(s);
      return s;
    });
    var kant = lag("div", "plkant");
    kant.appendChild(lag("i"));
    kant.appendChild(lag("span", "plmus", "↔"));
    kant.hidden = true;
    tl.appendChild(kant);

    var rader = PLAN.map(function (a) {
      var li = lag("li", "prad" + (a[2] ? " pause" : ""));
      li.appendChild(lag("span", "kl num", ""));
      li.appendChild(lag("span", "t", a[0]));
      li.appendChild(lag("span", "m num", ""));
      radliste.appendChild(li);
      return li;
    });

    var n = 0;
    var tid = 0;
    var vent = 0;

    /** Minuttene i steg n: fra steg 6 er skillet dratt, 35 og 10. */
    function minutter(i) {
      var m = PLAN[i][1];
      if (n >= 6 && i === 3) m = 35;
      if (n >= 6 && i === 4) m = 10;
      return m;
    }
    function klokke(min) {
      var t = 8 * 60 + 30 + min;
      return (
        String(Math.floor(t / 60)).padStart(2, "0") +
        ":" +
        String(t % 60).padStart(2, "0")
      );
    }

    function tegn() {
      var pos = 0;
      felt.forEach(function (s, i) {
        var vis = i < n;
        var m = minutter(i);
        s.style.left =
          "calc(" + ((vis ? pos : LENGDE) / LENGDE) * 100 + "% + 1px)";
        s.style.width = "calc(" + ((vis ? m : 0) / LENGDE) * 100 + "% - 2px)";
        s.style.opacity = vis ? "1" : "0";
        s.querySelector(".pt2").textContent = m + " min";
        s.classList.toggle(
          "ny",
          (i === n - 1 && n <= PLAN.length) ||
            (n === 6 && (i === 3 || i === 4)),
        );
        if (vis) pos += m;
      });
      // Skillet mellom gruppearbeidet og exit-lappen, mens det dras.
      kant.hidden = n !== 6;
      kant.style.left = ((10 + 25 + 10 + 35) / LENGDE) * 100 + "%";

      var start = 0;
      rader.forEach(function (li, i) {
        li.classList.toggle("vis", i < n);
        li.querySelector(".kl").textContent = klokke(start);
        li.querySelector(".m").textContent = minutter(i) + " min";
        start += minutter(i);
      });

      var s = 0;
      for (var i = 0; i < Math.min(n, PLAN.length); i++) s += PLAN[i][1];
      sum.textContent =
        s === LENGDE
          ? "90 av 90 min · går opp ✓"
          : s + " av 90 min · " + (LENGDE - s) + " min luft";
      sum.classList.toggle("opp", n >= PLAN.length);
      boks.classList.toggle("x", n >= 7);
      maaltekst.textContent = n >= 7 ? "1 valgt" : "ingen valgt";
    }

    function spill() {
      clearInterval(tid);
      clearTimeout(vent);
      if (rolig) {
        n = STEG;
        tegn();
        return;
      }
      n = 0;
      tegn();
      tid = setInterval(function () {
        n++;
        tegn();
        if (n >= STEG) {
          clearInterval(tid);
          vent = setTimeout(spill, 5000);
        }
      }, 800);
    }

    // Uten bevegelse, eller før det ruller inn: sluttbildet.
    n = STEG;
    tegn();
    kort.querySelector("[data-pl-igjen]").addEventListener("click", spill);
    nar(kort, spill);
  })();
  /* ----------------------------------------------- elevkortet */

  var GRONN = "#3f9d49",
    GUL = "#d9a92f",
    ROD = "#c04a3d",
    BORTE = "#d5d8dd";
  var INNSATS = [
    ["MFL2", "#9a5a2c", [GRONN, GRONN, GUL, GRONN, GRONN, BORTE, GUL, ROD], 22],
    [
      "ENG1",
      "#3d7a5a",
      [
        GRONN,
        GRONN,
        GRONN,
        GUL,
        GRONN,
        GUL,
        GUL,
        BORTE,
        GRONN,
        GUL,
        ROD,
        GRONN,
        GRONN,
      ],
      22,
    ],
  ];
  var NOTAT = "Jobbet godt i gruppa, ba om hjelp med kildene.";

  (function () {
    var kort = document.querySelector('[data-anim="ek"]');
    if (!kort) return;
    var rut = kort.querySelector("[data-ek-innsats]");
    INNSATS.forEach(function (f) {
      var navn = lag("span", "", f[0]);
      navn.style.color = f[1];
      rut.appendChild(navn);
      var rad = lag("span");
      rad.setAttribute("aria-hidden", "true");
      for (var i = 0; i < f[3]; i++) {
        var r = lag("span", i < f[2].length ? "" : "tom");
        if (i < f[2].length) r.style.background = f[2][i];
        rad.appendChild(r);
      }
      rut.appendChild(rad);
    });

    var knapp = kort.querySelector("[data-ek-knapp]");
    var ny = kort.querySelector("[data-ek-ny]");
    var tekst = kort.querySelector("[data-ek-tekst]");
    var caret = kort.querySelector("[data-ek-caret]");
    var meta = kort.querySelector("[data-ek-meta]");
    var boks = kort.querySelector("[data-ek-boks]");
    var oppg = kort.querySelector("[data-ek-oppg]");
    var tid = [];

    function steg(s, c) {
      knapp.classList.toggle("on", s === 1);
      ny.classList.toggle("vis", s >= 2);
      tekst.textContent = NOTAT.slice(0, c);
      caret.classList.toggle("av", s >= 3);
      meta.textContent =
        s >= 3 ? "I dag · Fra økta · MFL2 · lagret" : "I dag · Fra økta · MFL2";
      boks.classList.toggle("x", s >= 4);
      oppg.classList.toggle("x", s >= 4);
    }
    function vent(ms, f) {
      tid.push(setTimeout(f, ms));
    }
    function spill() {
      tid.forEach(clearTimeout);
      tid = [];
      if (rolig) {
        steg(4, NOTAT.length);
        return;
      }
      steg(0, 0);
      vent(700, function () {
        steg(1, 0);
        vent(400, function () {
          var c = 0;
          (function skriv() {
            steg(2, ++c);
            if (c < NOTAT.length) vent(42, skriv);
            else
              vent(500, function () {
                steg(3, c);
                vent(900, function () {
                  steg(4, c);
                  vent(5000, spill);
                });
              });
          })();
        });
      });
    }
    steg(4, NOTAT.length);
    nar(kort, spill);
  })();

  /* --------------------------------------------- klassekart */

  var PULT = [
    "Ada",
    "Filip",
    "Jon",
    "Karin",
    "Liv",
    "Pål",
    "Tobias",
    "Maja",
    "Sindre",
    "Guro",
    "Arne",
    "Jenny",
  ];
  var LAAST = [0, 7];

  (function () {
    var kk = document.querySelector('[data-anim="kk"]');
    if (!kk) return;
    var rom = kk.querySelector("[data-kk-rom]");
    var stokk = kk.querySelector("[data-kk-stokk]");
    var plass = PULT.map(function (_, i) {
      return i;
    });
    var pulter = PULT.map(function (n, i) {
      var p = lag("div", "kkp");
      var t = lag("span", "", n);
      p.appendChild(t);
      if (LAAST.indexOf(i) >= 0) {
        var l = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        l.setAttribute("width", "9");
        l.setAttribute("height", "9");
        var u = document.createElementNS("http://www.w3.org/2000/svg", "use");
        u.setAttribute("href", "#las");
        l.appendChild(u);
        p.appendChild(l);
      }
      rom.appendChild(p);
      return p;
    });
    function tegn() {
      pulter.forEach(function (p, i) {
        var s = plass[i],
          kol = s % 4,
          rad = Math.floor(s / 4);
        // Prosent av pultrekka (258 px i tegningen), så den passer i flisa.
        p.style.left = ((kol * 64 + (kol >= 2 ? 10 : 0)) / 258) * 100 + "%";
        p.style.top = 38 + rad * 38 + "px";
      });
    }
    function stokkOm() {
      var fri = plass
        .map(function (_, i) {
          return i;
        })
        .filter(function (i) {
          return LAAST.indexOf(i) < 0;
        });
      var ps = fri.map(function (i) {
        return plass[i];
      });
      for (var k = ps.length - 1; k > 0; k--) {
        var j = Math.floor(Math.random() * (k + 1));
        var t = ps[k];
        ps[k] = ps[j];
        ps[j] = t;
      }
      fri.forEach(function (i, n) {
        plass[i] = ps[n];
      });
      tegn();
      stokk.classList.add("on");
      setTimeout(function () {
        stokk.classList.remove("on");
      }, 300);
    }
    tegn();
    if (!rolig)
      nar(kk, function () {
        setInterval(stokkOm, 3000);
      });
  })();

  /* --------------------------------------------- samtaler */

  var SAMTALE = [
    "Ada Lie",
    "Filip Gjerde",
    "Jon Sæther",
    "Karin Nilsen",
    "Liv Solheim",
    "Pål Grønli",
  ];

  (function () {
    var sa = document.querySelector('[data-anim="sa"]');
    if (!sa) return;
    var liste = sa.querySelector("[data-sa-rader]");
    var knapp = sa.querySelector("[data-sa-knapp]");
    var eks = sa.querySelector("[data-sa-eks]");
    var navn = SAMTALE.map(function (n, i) {
      var m = 13 * 60 + i * 15;
      var rad = lag("div", "sar");
      rad.appendChild(
        lag(
          "span",
          "t num",
          Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0"),
        ),
      );
      var e = lag("span", "san", n);
      rad.appendChild(e);
      liste.appendChild(rad);
      return e;
    });
    var n = SAMTALE.length + 2;
    function tegn() {
      knapp.classList.toggle("on", n === 1);
      eks.classList.toggle(
        "on",
        n >= SAMTALE.length + 2 && n <= SAMTALE.length + 3,
      );
      navn.forEach(function (e, i) {
        e.classList.toggle("vis", n >= i + 2);
      });
    }
    tegn();
    if (!rolig)
      nar(sa, function () {
        n = 0;
        tegn();
        setInterval(function () {
          n = n > SAMTALE.length + 6 ? 0 : n + 1;
          tegn();
        }, 450);
      });
  })();

  /* --------------------------------------------- kalenderstrøm */

  var KAL = [
    [
      "man 19.10",
      [
        ["08:30", "HIS3", "#7a4f2e", "Utvandringen til Amerika"],
        ["12:30", "NOR3", "#3f6a95", "Retorikk: appellformene"],
      ],
    ],
    [
      "ons 21.10",
      [["08:30", "HIS3", "#7a4f2e", "Byene vokser: arbeid og bolig"]],
    ],
    [
      "tor 22.10",
      [
        ["10:15", "NOR3", "#3f6a95", "Kronikk: skriv innledningen"],
        ["12:30", "REL3", "#3d7a5a", "Etiske dilemmaer i helse"],
      ],
    ],
    ["man 26.10", [["08:30", "HIS3", "#7a4f2e", "Arbeiderbevegelsen"]]],
    [
      "ons 28.10",
      [["08:30", "HIS3", "#7a4f2e", "Kvinnenes kamp for stemmerett"]],
    ],
    ["fre 30.10", [["10:15", "NOR3", "#3f6a95", "Muntlig vurdering, dag 2"]]],
  ];

  (function () {
    var rull = document.querySelector("[data-kal]");
    if (!rull) return;
    // To ganger, så rullingen går rundt uten skjøt.
    [0, 1].forEach(function () {
      KAL.forEach(function (d) {
        rull.appendChild(lag("div", "kaldag", d[0]));
        d[1].forEach(function (o) {
          var r = lag("div", "kalokt");
          var strek = lag("i");
          strek.style.background = o[2];
          r.appendChild(strek);
          var b = lag("div");
          b.style.background = o[2] + "14";
          b.appendChild(lag("small", "", o[0] + " · " + o[1]));
          b.appendChild(lag("span", "", o[3]));
          r.appendChild(b);
          rull.appendChild(r);
        });
      });
    });
  })();

  /* --------------------------------------------- glans på knappene */

  if (!rolig)
    document.addEventListener(
      "pointermove",
      function (e) {
        var b = e.target.closest && e.target.closest(".btn");
        if (!b) return;
        var r = b.getBoundingClientRect();
        b.style.setProperty("--mx", e.clientX - r.left + "px");
        b.style.setProperty("--my", e.clientY - r.top + "px");
      },
      { passive: true },
    );
})();
