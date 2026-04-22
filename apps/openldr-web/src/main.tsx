import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import DocsLayout from "./pages/docs/DocsLayout.tsx";
import GettingStarted from "./pages/docs/GettingStarted.tsx";
import APIReference from "./pages/docs/APIReference.tsx";
import ChangelogPage from "./pages/docs/ChangelogPage.tsx";

const base = import.meta.env.BASE_URL;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={base}>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/docs" element={<DocsLayout />}>
          <Route index element={<GettingStarted />} />
          <Route path="getting-started" element={<GettingStarted />} />
          <Route path="api" element={<APIReference />} />
          <Route path="changelog" element={<ChangelogPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
