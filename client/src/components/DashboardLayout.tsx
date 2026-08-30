import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import GlobalSearch from "./GlobalSearch";
import {
  LayoutDashboard,
  Users,
  MapPin,
  FileBarChart,
  LogOut,
  PanelLeft,
  Shield,
  FileSpreadsheet,
  Settings,
  Zap,
  MessageSquare,
  ClipboardCheck,
  CalendarDays,
  FileText,
  FileQuestion,
  Calculator,
  Home,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import ScrollToTop from "./ScrollToTop";
import PageTransition from "./PageTransition";

const menuItems = [
  { icon: LayoutDashboard, label: "ダッシュボード", path: "/" },
  { icon: ClipboardCheck, label: "書類チェックシート", path: "/document-checklist" },
  { icon: CalendarDays, label: "会議シート", path: "/meeting-sheet" },
  { icon: FileQuestion, label: "案件相談シート", path: "/consultation-sheet" },
  { icon: Calculator, label: "資金計画書", path: "/funding-plan" },
  { icon: Home, label: "買付証明書", path: "/purchase-offer" },
  { icon: FileText, label: "議事録チャンネル", path: "/minutes" },
  { icon: MapPin, label: "訪問マップ", path: "/map" },
  { icon: FileBarChart, label: "AIレポート", path: "/reports" },
  { icon: FileSpreadsheet, label: "CSV管理", path: "/csv" },
  { icon: MessageSquare, label: "Slack連携", path: "/slack" },
  { icon: Users, label: "顧客管理", path: "/customer-files" },
  { icon: Zap, label: "API連携", path: "/api-settings" },
  { icon: Settings, label: "設定", path: "/settings" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="relative flex items-center justify-center min-h-screen overflow-hidden">
        {/* Premium gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a1628] via-[#1a2a4a] to-[#0d1f3c]" />
        {/* Animated geometric pattern overlay */}
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c9a84c' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
        {/* Radial glow effect */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#c9a84c]/5 blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-[#1e3a5f]/20 blur-[100px]" />
        
        {/* Login card */}
        <div className="relative z-10 flex flex-col items-center gap-8 p-10 max-w-md w-full mx-4">
          <div className="absolute inset-0 bg-white/[0.03] backdrop-blur-xl rounded-3xl border border-white/[0.08] shadow-2xl" />
          
          <div className="relative flex flex-col items-center gap-5">
            {/* Logo with golden glow */}
            <div className="relative">
              <div className="absolute inset-0 bg-[#c9a84c]/20 blur-2xl rounded-full scale-150" />
              <div className="relative w-24 h-24 rounded-2xl overflow-hidden flex items-center justify-center shadow-2xl ring-1 ring-[#c9a84c]/20">
                <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663202284124/RKGGtTpPHKxdLuEo.png" alt="CRM Logo" className="w-full h-full object-contain" />
              </div>
            </div>
            
            <h1 className="text-2xl font-bold tracking-tight text-center text-white">
              上田と光の営業書類顧客管理
            </h1>
            <p className="text-sm text-white/50 text-center max-w-sm leading-relaxed">
              営業顧客管理システムにアクセスするにはログインが必要です。
            </p>
          </div>
          
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="relative w-full bg-gradient-to-r from-[#c9a84c] to-[#d4b85a] hover:from-[#d4b85a] hover:to-[#e0c76a] text-[#0a1628] font-semibold shadow-lg shadow-[#c9a84c]/20 hover:shadow-xl hover:shadow-[#c9a84c]/30 transition-all duration-300 border-0 rounded-xl h-12 text-base"
          >
            ログイン
          </Button>
          
          <p className="relative text-xs text-white/30 text-center">
            Powered by UH Business Solutions
          </p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar, setOpenMobile, isMobile: sidebarIsMobile } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find((item) => item.path === location);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft =
        sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      setIsResizing(false);
    };
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const isAdmin = user?.role === "admin";

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="ナビゲーション切替"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663202284124/RKGGtTpPHKxdLuEo.png" alt="CRM" className="w-6 h-6 object-contain shrink-0 rounded" />
                  <span className="font-semibold tracking-tight truncate text-sm">
                    上田と光の営業書類顧客管理
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663202284124/RKGGtTpPHKxdLuEo.png" alt="CRM" className="w-6 h-6 object-contain rounded" />
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {menuItems.map((item) => {
                const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => {
                        setLocation(item.path);
                        if (sidebarIsMobile) {
                          setOpenMobile(false);
                        }
                      }}
                      tooltip={item.label}
                      className="h-10 transition-all font-normal"
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {isAdmin ? "管理者" : "営業担当"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>ログアウト</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        <ScrollToTop />
        <div className="flex border-b h-14 items-center justify-between bg-background/95 px-3 md:px-6 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
          <div className="flex items-center gap-2">
            {isMobile && (
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
            )}
            <span className="font-medium text-foreground text-sm hidden md:block">
              {activeMenuItem?.label ?? "メニュー"}
            </span>
          </div>
          <GlobalSearch />
        </div>
        <main className="flex-1 p-4 md:p-6">
          <PageTransition>{children}</PageTransition>
        </main>
      </SidebarInset>
    </>
  );
}
