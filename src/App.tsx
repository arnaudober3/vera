import "./App.css";
import { TodayPage } from "./pages/today-page.tsx";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { ClosetPage } from "./pages/closet-page.tsx";
import { FavouritesPage } from "./pages/favourites-page.tsx";
import { WelcomePage } from "./pages/onboarding.tsx";
import { isOnboardingComplete } from "./storage/onboarding.ts";

const RootRoute = () =>
  isOnboardingComplete() ? <TodayPage /> : <Navigate to="/welcome" replace />;

function App() {
  return (
    <div className="bg-app min-h-screen flex flex-col">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRoute />} />
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/closet" element={<ClosetPage />} />
          <Route path="/favourites" element={<FavouritesPage />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
