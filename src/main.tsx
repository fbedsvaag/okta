import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { temaFraKopi } from "./ui/tema";
import { glassFraKopi } from "./ui/glass";

// Lys eller mørk, og glass, før første tegning, så appen ikke blinker.
temaFraKopi();
glassFraKopi();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
