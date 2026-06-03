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
 * Recale --app-height APRÈS un évènement de viewport (fermeture du clavier,
 * zoom/dézoom). iOS Safari laisse alors `dvh` figé à sa valeur précédente,
 * ce qui découvre un liseré du fond sous le cadre. window.innerHeight lu en JS
 * donne la hauteur fraîche.
 *
 * On NE met PAS à jour au montage : le premier rendu reste géré par `100dvh`
 * (repli de `var(--app-height, 100dvh)`), car window.innerHeight au tout premier
 * paint iOS peut être trop petit (barre d'adresse) et créerait une bande au
 * lancement.
 */
function useAppHeight() {
  useEffect(() => {
    const update = () => {
      document.documentElement.style.setProperty(
        "--app-height",
        `${window.innerHeight}px`,
      );
    };
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
