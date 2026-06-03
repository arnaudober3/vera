import "./App.css";
import { TodayPage } from "./pages/today-page.tsx";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { ClosetPage } from "./pages/closet-page.tsx";
import { LookbookPage } from "./pages/lookbook-page.tsx";
import { WelcomePage } from "./pages/onboarding.tsx";
import { isOnboardingComplete } from "./storage/onboarding.ts";

const RootRoute = () =>
  isOnboardingComplete() ? <TodayPage /> : <Navigate to="/welcome" replace />;

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/closet" element={<ClosetPage />} />
        <Route path="/closet/basket" element={<ClosetPage />} />
        <Route path="/lookbook" element={<LookbookPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
