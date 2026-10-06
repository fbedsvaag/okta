import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { temaFraKopi } from "./ui/tema";
import { glassFraKopi } from "./ui/glass";
import { palettFraKopi } from "./ui/palett";
import { bevegelseFraKopi } from "./ui/bevegelse";

// Lys eller mørk, glass og palett før første tegning, så appen ikke blinker.
temaFraKopi();
glassFraKopi();
palettFraKopi();
bevegelseFraKopi();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
