import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./navigation-bar.css";

type Page = "today" | "closet";

interface NavigationBarData {
  activePage: Page;
  action?: ReactNode;
}

export default function NavigationBar({ activePage, action }: NavigationBarData) {
  const { t } = useTranslation();
  return (
    <div className="vera-nav-dock z-100">
      <nav className="vera-nav-pill">
        <Link
          to="/"
          className={`vera-nav-item ${activePage === "today" ? "active" : ""}`}
          aria-current={activePage === "today" ? "page" : undefined}
          aria-label={t("nav.todayAria")}
        >
          {t("nav.today")}
        </Link>

        <Link
          to="/closet"
          className={`vera-nav-item ${activePage === "closet" ? "active" : ""}`}
          aria-current={activePage === "closet" ? "page" : undefined}
          aria-label={t("nav.closetAria")}
        >
          {t("nav.closet")}
        </Link>
      </nav>
      {action}
    </div>
  );
}
