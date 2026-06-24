import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "@fontsource/cinzel/600.css";
import "@fontsource/cinzel/700.css";
import "./theme/themes.css";
import "./index.css";
import "./theme/useTheme"; // applies the saved theme before first paint

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
