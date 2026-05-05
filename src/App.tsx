import "./App.css";
import { TodayPage } from "./pages/today-page.tsx";
import { BrowserRouter, Route, Routes } from "react-router";
import { ClosetPage } from "./pages/closet-page.tsx";
import { FavouritesPage } from "./pages/favourites-page.tsx";

function App() {
  return (
    <div className="bg-app min-h-screen flex flex-col">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<TodayPage />} />
          <Route path="/closet" element={<ClosetPage />} />
          <Route path="/favourites" element={<FavouritesPage />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
