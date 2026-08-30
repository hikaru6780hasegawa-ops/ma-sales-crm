import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * ページ遷移時にスクロール位置を最上部にリセットするコンポーネント。
 * DashboardLayout内のSidebarInset（main[data-slot="sidebar-inset"]）のスクロールをリセットする。
 */
export default function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    // SidebarInset内のスクロールコンテナを探す
    const scrollContainer = document.querySelector('main[data-slot="sidebar-inset"]') as HTMLElement | null;
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
    }
    // フォールバック: window自体もスクロールトップ
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location]);

  return null;
}
