import "./App.css";
import { TodayPage } from "./pages/today-page.tsx";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { ClosetPage } from "./pages/closet-page.tsx";
import { WelcomePage } from "./pages/onboarding.tsx";
import { isOnboardingComplete } from "./storage/onboarding.ts";
import { ToastProvider } from "./components/toast-provider.tsx";
import { UpdatePrompt } from "./components/update-prompt.tsx";

const RootRoute = () =>
  isOnboardingComplete() ? <TodayPage /> : <Navigate to="/welcome" replace />;

function App() {
  return (
    <div className="vera-phone-frame vera-bg-app">
      <ToastProvider>
        {/* Mounted once, outside the router, so the update-available prompt is
            available on every route. */}
        <UpdatePrompt />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRoute />} />
            <Route path="/welcome" element={<WelcomePage />} />
            <Route path="/closet" element={<ClosetPage />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </div>
  );
}

export default App;
