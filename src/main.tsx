import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { temaFraKopi } from "./ui/tema";
import { glassFraKopi } from "./ui/glass";
import { palettFraKopi } from "./ui/palett";
import { bevegelseFraKopi } from "./ui/bevegelse";
import { leggZoomIMenyen, zoomFraKopi } from "./ui/zoom";
import { nettleserSnarvei } from "./ui/taster";

// Lys eller mørk, glass og palett før første tegning, så appen ikke blinker.
temaFraKopi();
glassFraKopi();
palettFraKopi();
bevegelseFraKopi();
zoomFraKopi();

// Windows (14.2): Ctrl+P, F, R, W og F5 hører til appen. Uten dette skriver
// WebView2 ut siden, åpner søk eller laster appen på nytt. Fanges før alt
// annet; appens egne lyttere får tasten likevel.
window.addEventListener(
  "keydown",
  (e) => {
    if (nettleserSnarvei(e)) e.preventDefault();
  },
  true,
);

// Zoom i View-menyen (10.6). Utenfor Tauri finnes ingen meny.
void leggZoomIMenyen().catch(() => {});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
