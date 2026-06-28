import "./App.css";
import { TodayPage } from "./pages/today-page.tsx";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { ClosetPage } from "./pages/closet-page.tsx";
import { LookbookPage } from "./pages/lookbook-page.tsx";
import { WelcomePage } from "./pages/onboarding.tsx";
import { GoogleCallbackPage } from "./pages/google-callback.tsx";
import { isOnboardingComplete } from "./storage/onboarding.ts";
import { ToastProvider } from "./components/toast-provider.tsx";
import { NotificationTest } from "./pages/notification-test.tsx";

const RootRoute = () =>
  isOnboardingComplete() ? <TodayPage /> : <Navigate to="/welcome" replace />;

function App() {
  const isDebugEnabled = import.meta.env.VITE_ENABLE_DEBUG === "true";

  return (
    <div className="vera-phone-frame vera-bg-app">
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRoute />} />
            <Route path="/welcome" element={<WelcomePage />} />
            <Route path="/closet" element={<ClosetPage />} />
            <Route path="/closet/basket" element={<ClosetPage />} />
            <Route path="/lookbook" element={<LookbookPage />} />
            <Route path="/google/callback" element={<GoogleCallbackPage />} />
            {isDebugEnabled && (
              <Route path="/notification-test" element={<NotificationTest />} />
            )}
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </div>
  );
}

export default App;
