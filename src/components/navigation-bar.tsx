import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import "./navigation-bar.css";

type Page = "today" | "closet" | "favourites";

interface NavigationBarData {
  activePage: Page;
  action?: ReactNode;
}

export default function NavigationBar({ activePage, action }: NavigationBarData) {
  return (
    <div className="vera-nav-dock z-100">
      <nav className="vera-nav-pill">
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
      {action}
    </div>
  );
}
