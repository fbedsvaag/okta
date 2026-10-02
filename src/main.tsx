import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { temaFraKopi } from "./ui/tema";

// Lys eller mørk før første tegning, så appen ikke blinker lyst.
temaFraKopi();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
