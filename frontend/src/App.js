import { useState, useEffect, createContext, useContext } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, Link } from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "sonner";
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  FileText,
  ClipboardList,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X
} from "lucide-react";

// Pages
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
import POS from "./pages/POS";
import Invoices from "./pages/Invoices";
import Quotations from "./pages/Quotations";
import Reports from "./pages/Reports";
import SettingsPage from "./pages/Settings";
import Login from "./pages/Login";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
    } catch (error) {
      console.error("Error fetching user:", error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { username, password });
      const { token: newToken, user: userData } = response.data;
      localStorage.setItem("token", newToken);
      axios.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
      setToken(newToken);
      setUser(userData);
      toast.success("تم تسجيل الدخول بنجاح");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.detail || "فشل تسجيل الدخول");
      return false;
    }
  };

  const register = async (username, password, name) => {
    try {
      const response = await axios.post(`${API}/auth/register`, { username, password, name });
      const { token: newToken, user: userData } = response.data;
      localStorage.setItem("token", newToken);
      axios.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
      setToken(newToken);
      setUser(userData);
      toast.success("تم إنشاء الحساب بنجاح");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.detail || "فشل إنشاء الحساب");
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    delete axios.defaults.headers.common["Authorization"];
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Settings Context
const SettingsContext = createContext(null);

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(null);
  const { token } = useAuth();

  useEffect(() => {
    if (token) {
      fetchSettings();
    }
  }, [token]);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/settings`);
      setSettings(response.data);
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };

  const updateSettings = async (newSettings) => {
    try {
      const response = await axios.put(`${API}/settings`, newSettings);
      setSettings(response.data);
      toast.success("تم حفظ الإعدادات بنجاح");
      return true;
    } catch (error) {
      toast.error("فشل حفظ الإعدادات");
      return false;
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, fetchSettings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

// Protected Route
const ProtectedRoute = ({ children }) => {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[hsl(var(--primary))] border-t-transparent"></div>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Sidebar Component
const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { path: "/", icon: LayoutDashboard, label: "لوحة التحكم" },
    { path: "/pos", icon: ShoppingCart, label: "نقطة البيع" },
    { path: "/products", icon: Package, label: "المنتجات" },
    { path: "/customers", icon: Users, label: "العملاء" },
    { path: "/invoices", icon: FileText, label: "الفواتير" },
    { path: "/quotations", icon: ClipboardList, label: "عروض الأسعار" },
    { path: "/reports", icon: BarChart3, label: "التقارير" },
    { path: "/settings", icon: Settings, label: "الإعدادات" },
  ];

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        data-testid="mobile-menu-btn"
        className="fixed top-4 right-4 z-50 p-2 bg-white rounded-xl shadow-lg md:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`sidebar ${mobileOpen ? "translate-x-0" : "translate-x-full"} md:translate-x-0 transition-transform duration-300`}
      >
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">
              <FileText size={20} />
            </div>
            <div>
              <h1 className="font-bold text-lg" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                نظام المبيعات
              </h1>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">متوافق مع ZATCA</span>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              data-testid={`nav-${item.path.replace("/", "") || "dashboard"}`}
              className={`nav-item ${location.pathname === item.path ? "active" : ""}`}
              onClick={() => setMobileOpen(false)}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-[hsl(var(--border))] relative z-50">
          <div className="flex items-center gap-3 mb-4 px-3">
            <div className="w-10 h-10 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center text-white font-bold">
              {user?.name?.charAt(0) || "م"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{user?.name || "مستخدم"}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                {user?.username}
              </p>
            </div>
          </div>
          <button
            data-testid="logout-btn"
            onClick={handleLogout}
            className="nav-item w-full text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.1)] relative z-50"
          >
            <LogOut size={20} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>
    </>
  );
};

// Layout Component
const Layout = ({ children }) => {
  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">{children}</main>
    </div>
  );
};

function AppRoutes() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[hsl(var(--primary))] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <SettingsProvider>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/pos" element={<POS />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/invoices" element={<Invoices />} />
                  <Route path="/quotations" element={<Quotations />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </Layout>
            </SettingsProvider>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-center" richColors dir="rtl" />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
