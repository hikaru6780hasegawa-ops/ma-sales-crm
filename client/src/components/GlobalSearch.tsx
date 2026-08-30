import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Users, CalendarCheck, Briefcase, FileText, Hash, X, Loader2 } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";

export default function GlobalSearch() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isLoading } = trpc.search.global.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.length > 0 }
  );

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const navigate = useCallback((path: string) => {
    setLocation(path);
    setIsOpen(false);
    setQuery("");
  }, [setLocation]);

  const hasResults = results && (
    results.customers.length > 0 ||
    results.activities.length > 0 ||
    results.deals.length > 0 ||
    results.documents.length > 0
  );

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder="検索... (⌘K)"
          className="pl-9 pr-8 h-9 bg-muted/50 border-0 focus-visible:ring-1"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setIsOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {isOpen && debouncedQuery.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-popover text-popover-foreground border rounded-lg shadow-lg z-50 overflow-hidden max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !hasResults ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              「{debouncedQuery}」に一致する結果はありません
            </div>
          ) : (
            <div className="py-1">
              {/* Customers */}
              {results!.customers.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Users className="h-3 w-3" />
                    顧客
                  </div>
                  {results!.customers.map((c: any) => (
                    <button
                      key={`c-${c.id}`}
                      className="w-full text-left px-3 py-2 hover:bg-accent transition-colors flex items-center gap-2"
                      onClick={() => navigate(`/customers/${c.id}`)}
                    >
                      <Badge variant="outline" className="text-xs font-mono shrink-0">
                        <Hash className="h-2.5 w-2.5 mr-0.5" />{c.id}
                      </Badge>
                      <span className="text-sm truncate">{c.companyName}</span>
                      {c.contactName && <span className="text-xs text-muted-foreground truncate">- {c.contactName}</span>}
                    </button>
                  ))}
                </div>
              )}

              {/* Activities */}
              {results!.activities.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1.5 border-t">
                    <CalendarCheck className="h-3 w-3" />
                    営業活動
                  </div>
                  {results!.activities.map((a: any) => (
                    <button
                      key={`a-${a.id}`}
                      className="w-full text-left px-3 py-2 hover:bg-accent transition-colors flex items-center gap-2"
                      onClick={() => navigate("/activities")}
                    >
                      <Badge variant="outline" className="text-xs font-mono shrink-0">
                        <Hash className="h-2.5 w-2.5 mr-0.5" />{a.id}
                      </Badge>
                      <span className="text-sm truncate">{a.subject}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Deals */}
              {results!.deals.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1.5 border-t">
                    <Briefcase className="h-3 w-3" />
                    案件
                  </div>
                  {results!.deals.map((d: any) => (
                    <button
                      key={`d-${d.id}`}
                      className="w-full text-left px-3 py-2 hover:bg-accent transition-colors flex items-center gap-2"
                      onClick={() => navigate("/deals")}
                    >
                      <Badge variant="outline" className="text-xs font-mono shrink-0">
                        <Hash className="h-2.5 w-2.5 mr-0.5" />{d.id}
                      </Badge>
                      <span className="text-sm truncate">{d.dealName}</span>
                      <span className="text-xs text-muted-foreground">¥{(d.amount ?? 0).toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Documents */}
              {results!.documents.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1.5 border-t">
                    <FileText className="h-3 w-3" />
                    スキャンドキュメント
                  </div>
                  {results!.documents.map((d: any) => (
                    <button
                      key={`doc-${d.id}`}
                      className="w-full text-left px-3 py-2 hover:bg-accent transition-colors flex items-center gap-2"
                      onClick={() => navigate("/scanner")}
                    >
                      <Badge variant="outline" className="text-xs font-mono shrink-0">
                        <Hash className="h-2.5 w-2.5 mr-0.5" />{d.id}
                      </Badge>
                      <span className="text-sm truncate">{d.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
