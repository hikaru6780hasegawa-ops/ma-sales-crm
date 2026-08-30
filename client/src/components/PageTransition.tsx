import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";

/**
 * ページ遷移時にフェードイン + スライドアップのアニメーションを適用するラッパーコンポーネント。
 * 子要素をラップして使用する。
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isAnimating, setIsAnimating] = useState(false);
  const [displayChildren, setDisplayChildren] = useState(children);
  const prevLocation = useRef(location);

  useEffect(() => {
    if (prevLocation.current !== location) {
      prevLocation.current = location;
      setIsAnimating(true);
      // 新しいchildrenをセット
      setDisplayChildren(children);
      // アニメーション完了後にフラグをリセット
      const timer = setTimeout(() => setIsAnimating(false), 400);
      return () => clearTimeout(timer);
    } else {
      // 同じlocationでchildrenが変わった場合（データ更新等）
      setDisplayChildren(children);
    }
  }, [location, children]);

  return (
    <div
      className={isAnimating ? "animate-page-enter" : ""}
      style={{ willChange: isAnimating ? "opacity, transform" : "auto" }}
    >
      {displayChildren}
    </div>
  );
}
