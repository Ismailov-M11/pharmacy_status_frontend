import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Login from "./pages/Login";
import AgentPanel from "./pages/AgentPanel";
import AdminPanel from "./pages/AdminPanel";
import LeadsPanel from "./pages/LeadsPanel";
import PharmacyMaps from "./pages/PharmacyMaps";
import PharmaciesActivity from "./pages/PharmaciesActivity";
import NewPharmacies from "./pages/NewPharmacies";
import DeliveryAnalytics from "./pages/DeliveryAnalytics";
import OsonList from "./pages/OsonList";
import NotificationCenter from "./pages/NotificationCenter";
import UserCarts from "./pages/UserCarts";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="text-gray-500">Loading...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function RoleBasedRoute({
  allowedRoles,
  children,
}: {
  allowedRoles: string[];
  children: React.ReactNode;
}) {
  const { role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="text-gray-500">Loading...</span>
      </div>
    );
  }

  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to="/login" replace />;
  }

  return <ProtectedRoute>{children}</ProtectedRoute>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  path="/agent"
                  element={
                    <RoleBasedRoute
                      allowedRoles={["ROLE_AGENT", "ROLE_OPERATOR"]}
                    >
                      <AgentPanel />
                    </RoleBasedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <RoleBasedRoute allowedRoles={["ROLE_ADMIN"]}>
                      <AdminPanel />
                    </RoleBasedRoute>
                  }
                />
                <Route
                  path="/leads"
                  element={
                    <RoleBasedRoute allowedRoles={["ROLE_ADMIN", "ROLE_AGENT", "ROLE_OPERATOR"]}>
                      <LeadsPanel />
                    </RoleBasedRoute>
                  }
                />
                <Route
                  path="/maps"
                  element={
                    <RoleBasedRoute
                      allowedRoles={["ROLE_ADMIN", "ROLE_AGENT", "ROLE_OPERATOR"]}
                    >
                      <PharmacyMaps />
                    </RoleBasedRoute>
                  }
                />
                <Route
                  path="/pharmacies-activity"
                  element={
                    <RoleBasedRoute
                      allowedRoles={["ROLE_ADMIN", "ROLE_AGENT", "ROLE_OPERATOR"]}
                    >
                      <PharmaciesActivity />
                    </RoleBasedRoute>
                  }
                />
                <Route
                  path="/new-pharmacies"
                  element={
                    <RoleBasedRoute
                      allowedRoles={["ROLE_ADMIN", "ROLE_AGENT", "ROLE_OPERATOR"]}
                    >
                      <NewPharmacies />
                    </RoleBasedRoute>
                  }
                />
                <Route
                  path="/delivery-analytics"
                  element={
                    <RoleBasedRoute
                      allowedRoles={["ROLE_ADMIN", "ROLE_AGENT", "ROLE_OPERATOR"]}
                    >
                      <DeliveryAnalytics />
                    </RoleBasedRoute>
                  }
                />
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route
                  path="/notification-center"
                  element={
                    <RoleBasedRoute allowedRoles={["ROLE_ADMIN"]}>
                      <NotificationCenter />
                    </RoleBasedRoute>
                  }
                />
                <Route
                  path="/oson-list"
                  element={
                    <RoleBasedRoute
                      allowedRoles={["ROLE_ADMIN", "ROLE_AGENT", "ROLE_OPERATOR"]}
                    >
                      <OsonList />
                    </RoleBasedRoute>
                  }
                />
                <Route
                  path="/user-carts"
                  element={
                    <RoleBasedRoute allowedRoles={["ROLE_ADMIN", "ROLE_AGENT", "ROLE_OPERATOR"]}>
                      <UserCarts />
                    </RoleBasedRoute>
                  }
                />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
