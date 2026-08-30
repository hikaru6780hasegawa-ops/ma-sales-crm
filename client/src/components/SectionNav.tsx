import { useEffect, useState, useCallback, useRef } from "react";
import { ChevronUp } from "lucide-react";

export interface SectionItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface SectionNavProps {
  sections: SectionItem[];
}

/**
 * ページ内セクションナビゲーション。
 * IntersectionObserverでアクティブセクションを自動検出し、
 * クリックでスムーズスクロールする。
 */
export default function SectionNav({ sections }: SectionNavProps) {
  const [activeSection, setActiveSection] = useState<string>(sections[0]?.id || "");
  const [showBackToTop, setShowBackToTop] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const isClickScrolling = useRef(false);

  // IntersectionObserverでアクティブセクションを検出
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      if (isClickScrolling.current) return;
      
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.getAttribute("data-section") || "");
        }
      }
    };

    sections.forEach((section) => {
      const el = document.querySelector(`[data-section="${section.id}"]`);
      if (el) {
        const observer = new IntersectionObserver(handleIntersect, {
          rootMargin: "-120px 0px -60% 0px",
          threshold: 0.1,
        });
        observer.observe(el);
        observers.push(observer);
      }
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [sections]);

  // スクロール位置に応じてトップに戻るボタンを表示
  useEffect(() => {
    const scrollContainer = document.querySelector('main[data-slot="sidebar-inset"]') as HTMLElement | null;
    const target = scrollContainer || window;

    const handleScroll = () => {
      const scrollTop = scrollContainer ? scrollContainer.scrollTop : window.scrollY;
      setShowBackToTop(scrollTop > 300);
    };

    target.addEventListener("scroll", handleScroll, { passive: true });
    return () => target.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = useCallback((sectionId: string) => {
    const el = document.querySelector(`[data-section="${sectionId}"]`);
    if (!el) return;

    isClickScrolling.current = true;
    setActiveSection(sectionId);

    el.scrollIntoView({ behavior: "smooth", block: "start" });

    // スクロール完了後にフラグをリセット
    setTimeout(() => {
      isClickScrolling.current = false;
    }, 800);
  }, []);

  const scrollToTop = useCallback(() => {
    const scrollContainer = document.querySelector('main[data-slot="sidebar-inset"]') as HTMLElement | null;
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  if (sections.length === 0) return null;

  return (
    <>
      <div ref={navRef} className="anchor-nav">
        <div className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => scrollToSection(section.id)}
              className={`anchor-nav-item shrink-0 flex items-center gap-1.5 ${
                activeSection === section.id ? "active" : ""
              }`}
            >
              {section.icon && <span className="shrink-0">{section.icon}</span>}
              {section.label}
            </button>
          ))}
        </div>
      </div>

      {/* トップに戻るボタン */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-6 right-6 z-50 flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-300 hover:scale-110 ${
          showBackToTop ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
        aria-label="トップに戻る"
      >
        <ChevronUp className="h-5 w-5" />
      </button>
    </>
  );
}
