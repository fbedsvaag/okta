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
    ["Gruppearbeid: kildekritikk", 30, false],
    ["Exit-lapp", 15, false],
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
})();
