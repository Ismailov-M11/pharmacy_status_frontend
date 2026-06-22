import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Globe,
  Map,
  Headset,
  UserCog,
  LogOut,
  User,
  Activity,
  Store,
  Menu,
  Moon,
  Sun,
  TrendingUp,
  ShoppingBag,
  ShoppingCart,
  Bell,
  ChevronRight,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  description: string;
  colorBg: string;
  colorIcon: string;
  colorActive: string;
  colorActiveBorder: string;
}

export function Header() {
  const { language, setLanguage, t } = useLanguage();
  const { logout, role, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navigationItems: NavItem[] = [];

  if (role === "ROLE_ADMIN") {
    navigationItems.push(
      {
        label: t.notificationCenter || "Центр уведомлений",
        path: "/notification-center",
        icon: Bell,
        description: "Уведомления и кампании",
        colorBg: "bg-violet-100 dark:bg-violet-900/40",
        colorIcon: "text-violet-600 dark:text-violet-400",
        colorActive: "bg-violet-50 dark:bg-violet-900/20",
        colorActiveBorder: "border-violet-500",
      },
      {
        label: t.adminPanel || "Панель администратора",
        path: "/admin",
        icon: User,
        description: "Управление аптеками",
        colorBg: "bg-blue-100 dark:bg-blue-900/40",
        colorIcon: "text-blue-600 dark:text-blue-400",
        colorActive: "bg-blue-50 dark:bg-blue-900/20",
        colorActiveBorder: "border-blue-500",
      },
      {
        label: t.leadsTitle || "Лиды",
        path: "/leads",
        icon: UserCog,
        description: "Управление лидами",
        colorBg: "bg-indigo-100 dark:bg-indigo-900/40",
        colorIcon: "text-indigo-600 dark:text-indigo-400",
        colorActive: "bg-indigo-50 dark:bg-indigo-900/20",
        colorActiveBorder: "border-indigo-500",
      },
      {
        label: t.maps || "Карты",
        path: "/maps",
        icon: Map,
        description: "Аптеки на карте",
        colorBg: "bg-emerald-100 dark:bg-emerald-900/40",
        colorIcon: "text-emerald-600 dark:text-emerald-400",
        colorActive: "bg-emerald-50 dark:bg-emerald-900/20",
        colorActiveBorder: "border-emerald-500",
      },
      {
        label: t.activities || "Активности",
        path: "/pharmacies-activity",
        icon: Activity,
        description: "Активация / деактивация",
        colorBg: "bg-orange-100 dark:bg-orange-900/40",
        colorIcon: "text-orange-600 dark:text-orange-400",
        colorActive: "bg-orange-50 dark:bg-orange-900/20",
        colorActiveBorder: "border-orange-500",
      },
      {
        label: t.newPharmacies || "Новые аптеки",
        path: "/new-pharmacies",
        icon: Store,
        description: "Отчёт по онбордингу",
        colorBg: "bg-teal-100 dark:bg-teal-900/40",
        colorIcon: "text-teal-600 dark:text-teal-400",
        colorActive: "bg-teal-50 dark:bg-teal-900/20",
        colorActiveBorder: "border-teal-500",
      },
      {
        label: t.deliveryAnalytics || "Аналитика доставок",
        path: "/delivery-analytics",
        icon: TrendingUp,
        description: "Метрики доставки",
        colorBg: "bg-rose-100 dark:bg-rose-900/40",
        colorIcon: "text-rose-600 dark:text-rose-400",
        colorActive: "bg-rose-50 dark:bg-rose-900/20",
        colorActiveBorder: "border-rose-500",
      },
      {
        label: "OSON List",
        path: "/oson-list",
        icon: ShoppingBag,
        description: "Каталог аптек OSON",
        colorBg: "bg-amber-100 dark:bg-amber-900/40",
        colorIcon: "text-amber-600 dark:text-amber-400",
        colorActive: "bg-amber-50 dark:bg-amber-900/20",
        colorActiveBorder: "border-amber-500",
      },
      {
        label: t.userCarts || "Корзины пользователей",
        path: "/user-carts",
        icon: ShoppingCart,
        description: "Черновики заказов",
        colorBg: "bg-cyan-100 dark:bg-cyan-900/40",
        colorIcon: "text-cyan-600 dark:text-cyan-400",
        colorActive: "bg-cyan-50 dark:bg-cyan-900/20",
        colorActiveBorder: "border-cyan-500",
      },
    );
  } else if (role === "ROLE_AGENT" || role === "ROLE_OPERATOR") {
    const agentLabel =
      role === "ROLE_OPERATOR"
        ? t.operatorPanel || "Панель оператора"
        : t.agentPanel || "Панель агента";
    const agentIcon = role === "ROLE_OPERATOR" ? Headset : UserCog;
    navigationItems.push(
      {
        label: agentLabel,
        path: "/agent",
        icon: agentIcon,
        description: "Основная панель",
        colorBg: "bg-blue-100 dark:bg-blue-900/40",
        colorIcon: "text-blue-600 dark:text-blue-400",
        colorActive: "bg-blue-50 dark:bg-blue-900/20",
        colorActiveBorder: "border-blue-500",
      },
      {
        label: t.leadsTitle || "Лиды",
        path: "/leads",
        icon: UserCog,
        description: "Управление лидами",
        colorBg: "bg-indigo-100 dark:bg-indigo-900/40",
        colorIcon: "text-indigo-600 dark:text-indigo-400",
        colorActive: "bg-indigo-50 dark:bg-indigo-900/20",
        colorActiveBorder: "border-indigo-500",
      },
      {
        label: t.maps || "Карты",
        path: "/maps",
        icon: Map,
        description: "Аптеки на карте",
        colorBg: "bg-emerald-100 dark:bg-emerald-900/40",
        colorIcon: "text-emerald-600 dark:text-emerald-400",
        colorActive: "bg-emerald-50 dark:bg-emerald-900/20",
        colorActiveBorder: "border-emerald-500",
      },
      {
        label: t.activities || "Активности",
        path: "/pharmacies-activity",
        icon: Activity,
        description: "Активация / деактивация",
        colorBg: "bg-orange-100 dark:bg-orange-900/40",
        colorIcon: "text-orange-600 dark:text-orange-400",
        colorActive: "bg-orange-50 dark:bg-orange-900/20",
        colorActiveBorder: "border-orange-500",
      },
      {
        label: t.newPharmacies || "Новые аптеки",
        path: "/new-pharmacies",
        icon: Store,
        description: "Отчёт по онбордингу",
        colorBg: "bg-teal-100 dark:bg-teal-900/40",
        colorIcon: "text-teal-600 dark:text-teal-400",
        colorActive: "bg-teal-50 dark:bg-teal-900/20",
        colorActiveBorder: "border-teal-500",
      },
      {
        label: t.deliveryAnalytics || "Аналитика доставок",
        path: "/delivery-analytics",
        icon: TrendingUp,
        description: "Метрики доставки",
        colorBg: "bg-rose-100 dark:bg-rose-900/40",
        colorIcon: "text-rose-600 dark:text-rose-400",
        colorActive: "bg-rose-50 dark:bg-rose-900/20",
        colorActiveBorder: "border-rose-500",
      },
      {
        label: "OSON List",
        path: "/oson-list",
        icon: ShoppingBag,
        description: "Каталог аптек OSON",
        colorBg: "bg-amber-100 dark:bg-amber-900/40",
        colorIcon: "text-amber-600 dark:text-amber-400",
        colorActive: "bg-amber-50 dark:bg-amber-900/20",
        colorActiveBorder: "border-amber-500",
      },
      {
        label: t.userCarts || "Корзины пользователей",
        path: "/user-carts",
        icon: ShoppingCart,
        description: "Черновики заказов",
        colorBg: "bg-cyan-100 dark:bg-cyan-900/40",
        colorIcon: "text-cyan-600 dark:text-cyan-400",
        colorActive: "bg-cyan-50 dark:bg-cyan-900/20",
        colorActiveBorder: "border-cyan-500",
      },
    );
  }

  const currentItem = navigationItems.find((i) => i.path === location.pathname);

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm sticky top-0 z-50 transition-colors">
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3 md:py-4 flex flex-wrap items-center justify-between gap-y-3">

        {/* ── Navigation Menu ── */}
        <div className="order-1">
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-600 dark:text-gray-300 hover:text-purple-700 dark:hover:text-purple-400 h-9 w-9 md:h-10 md:w-10 transition-colors"
                aria-label="Navigation menu"
              >
                {menuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="start"
              sideOffset={8}
              className="w-72 p-0 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl dark:bg-gray-900"
            >
              {/* Header section */}
              <div className="px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 dark:from-purple-800 dark:to-purple-900">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/20 backdrop-blur-sm">
                    <img
                      src="/logo.png"
                      alt="Logo"
                      className="w-6 h-6"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm leading-tight">
                      {t.siteTitle || "Aptekalar holati"}
                    </div>
                    {user?.username && (
                      <div className="text-purple-200 text-xs mt-0.5">
                        {user.username}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Nav label */}
              <div className="px-4 pt-3 pb-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  Навигация
                </span>
              </div>

              {/* Items */}
              <div className="px-2 pb-2 space-y-0.5">
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <DropdownMenuItem
                      key={item.path}
                      onClick={() => {
                        navigate(item.path);
                        setMenuOpen(false);
                      }}
                      className={`
                        cursor-pointer rounded-lg px-3 py-2.5 flex items-center gap-3 group
                        border-l-2 transition-all duration-150 outline-none
                        ${isActive
                          ? `${item.colorActive} ${item.colorActiveBorder}`
                          : "border-transparent hover:bg-gray-50 dark:hover:bg-gray-800"
                        }
                      `}
                    >
                      {/* Icon badge */}
                      <div
                        className={`
                          flex items-center justify-center w-8 h-8 rounded-lg shrink-0 transition-transform duration-150
                          ${item.colorBg}
                          ${isActive ? "scale-105" : "group-hover:scale-105"}
                        `}
                      >
                        <Icon className={`h-4 w-4 ${item.colorIcon}`} />
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-sm font-medium leading-tight truncate ${
                            isActive
                              ? "text-gray-900 dark:text-gray-100"
                              : "text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {item.label}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                          {item.description}
                        </div>
                      </div>

                      {/* Active arrow / hover arrow */}
                      <ChevronRight
                        className={`h-3.5 w-3.5 shrink-0 transition-all duration-150 ${
                          isActive
                            ? `${item.colorIcon} opacity-100`
                            : "text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 group-hover:-translate-x-0.5"
                        }`}
                      />
                    </DropdownMenuItem>
                  );
                })}
              </div>

              <div className="pb-2" />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ── Logo ── */}
        <div className="flex items-center gap-3 order-1">
          <img
            src="/logo.png"
            alt={t.siteTitle || "Aptekalar holati"}
            className="w-10 h-10 md:w-12 md:h-12"
          />
          <div>
            <div className="font-bold text-lg md:text-xl text-purple-700 dark:text-purple-400 hidden md:block">
              {t.siteTitle || "Aptekalar holati"}
            </div>
            {currentItem && (
              <div className="text-xs text-gray-400 dark:text-gray-500 hidden md:block">
                {currentItem.label}
              </div>
            )}
          </div>
        </div>

        {/* ── Right controls ── */}
        <div className="flex items-center gap-2 order-2 md:order-3">
          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="text-gray-600 dark:text-gray-300 hover:text-purple-700 dark:hover:text-purple-400 h-9 w-9 md:h-10 md:w-10"
            aria-label="Toggle theme"
          >
            {theme === "light" ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
          </Button>

          {/* Language */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-600 dark:text-gray-300 hover:text-purple-700 dark:hover:text-purple-400 h-9 w-9 md:h-10 md:w-10"
              >
                <Globe className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="dark:bg-gray-900 dark:border-gray-700">
              <DropdownMenuItem
                onClick={() => setLanguage("ru")}
                className={
                  language === "ru"
                    ? "bg-purple-50 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                    : ""
                }
              >
                🇷🇺 Русский
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setLanguage("uz")}
                className={
                  language === "uz"
                    ? "bg-purple-50 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                    : ""
                }
              >
                🇺🇿 O'zbekcha
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Logout button (desktop) */}
          <Button
            onClick={handleLogout}
            variant="outline"
            className="h-9 w-9 md:w-auto md:px-3 p-0 md:py-2 text-purple-700 dark:text-purple-400 border-purple-700 dark:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900 hover:text-purple-700 dark:hover:text-purple-300 text-sm justify-center"
          >
            <LogOut className="h-5 w-5 md:mr-2 md:h-4 md:w-4" />
            <span className="hidden md:block">{t.logout}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
