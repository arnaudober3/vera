import "./App.css";
import { useEffect } from "react";
import { TodayPage } from "./pages/today-page.tsx";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { ClosetPage } from "./pages/closet-page.tsx";
import { LookbookPage } from "./pages/lookbook-page.tsx";
import { WelcomePage } from "./pages/onboarding.tsx";
import { isOnboardingComplete } from "./storage/onboarding.ts";

const RootRoute = () =>
  isOnboardingComplete() ? <TodayPage /> : <Navigate to="/welcome" replace />;

/**
 * Synchronise --app-height sur la hauteur réelle de la fenêtre.
 * iOS Safari ne recalcule pas l'unité CSS `dvh` après un pinch-zoom/dézoom :
 * la hauteur reste figée à sa valeur d'avant zoom, laissant un liseré du fond
 * sous le cadre. Lire window.innerHeight en JS donne toujours la valeur fraîche.
 * Les événements visualViewport se déclenchent au zoom/dézoom (et au clavier),
 * ce que `window.resize` seul ne couvre pas sur iOS.
 */
function useAppHeight() {
  useEffect(() => {
    const update = () => {
      document.documentElement.style.setProperty(
        "--app-height",
        `${window.innerHeight}px`,
      );
    };
    update();
    window.addEventListener("resize", update);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
    };
  }, []);
}

function App() {
  useAppHeight();
  return (
    <div className="vera-phone-frame vera-bg-app">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRoute />} />
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/closet" element={<ClosetPage />} />
          <Route path="/closet/basket" element={<ClosetPage />} />
          <Route path="/lookbook" element={<LookbookPage />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
