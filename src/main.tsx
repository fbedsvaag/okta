import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { temaFraKopi } from "./ui/tema";
import { glassFraKopi } from "./ui/glass";
import { palettFraKopi } from "./ui/palett";
import { bevegelseFraKopi } from "./ui/bevegelse";
import { leggZoomIMenyen, zoomFraKopi } from "./ui/zoom";

// Lys eller mørk, glass og palett før første tegning, så appen ikke blinker.
temaFraKopi();
glassFraKopi();
palettFraKopi();
bevegelseFraKopi();
zoomFraKopi();

// Zoom i View-menyen (10.6). Utenfor Tauri finnes ingen meny.
void leggZoomIMenyen().catch(() => {});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
