import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./lib/i18n"; // initialize i18next before render
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(<App />);

