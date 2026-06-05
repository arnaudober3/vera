import type { ReactNode } from "react";
import "./app-footer.css";

/**
 * Footer en flux, ancré en bas du .vera-phone-frame (flex-shrink: 0).
 * Regroupe le BasketStrip (conditionnel) et la NavigationBar : la zone
 * scrollable au-dessus (flex: 1) réserve naturellement leur place, donc
 * plus de cale magique ni de positionnement fixe/absolu, et aucun saut.
 */
export const AppFooter = ({ children }: { children: ReactNode }) => (
  <footer className="vera-footer">{children}</footer>
);
