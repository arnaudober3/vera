import { Link } from "react-router-dom";
import "./navigation-bar.css";

type Page = "today" | "closet" | "favourites";

interface NavigationBarData {
  activePage: Page;
}

export default function NavigationBar({ activePage }: NavigationBarData) {
  return (
    <nav className="vera-nav-pill z-100">
      <Link
        to="/"
        className={`vera-nav-item ${activePage === "today" ? "active" : ""}`}
        aria-current={activePage === "today" ? "page" : undefined}
        aria-label="Open home page - Today's outfit suggestions"
      >
        Today
      </Link>

      <Link
        to="/closet"
        className={`vera-nav-item ${activePage === "closet" ? "active" : ""}`}
        aria-current={activePage === "closet" ? "page" : undefined}
        aria-label="Open closet page"
      >
        Closet
      </Link>

      <Link
        to="/favourites"
        className={`vera-nav-item ${activePage === "favourites" ? "active" : ""}`}
        aria-current={activePage === "favourites" ? "page" : undefined}
        aria-label="Open favourite outfits page"
      >
        Favourites
      </Link>
    </nav>
  );
}
