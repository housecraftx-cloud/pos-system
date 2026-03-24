import { useState, useEffect } from "react";
import axios from "axios";
import { API } from "../App";
import {
  Package,
  Users,
  FileText,
  TrendingUp,
  AlertTriangle,
  ShoppingCart,
  CreditCard,
  Banknote
} from "lucide-react";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/stats`);
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("ar-SA", {
      style: "currency",
      currency: "SAR",
    }).format(amount);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-100px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[hsl(var(--primary))] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div data-testid="dashboard-page">
      <header className="page-header">
        <h1 className="page-title">لوحة التحكم</h1>
        <span className="text-sm text-[hsl(var(--muted-foreground))]">
          {new Date().toLocaleDateString("ar-SA", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </span>
      </header>

      <div className="page-content">
        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card animate-fade-in-up">
            <div
              className="stat-icon"
              style={{ backgroundColor: "hsl(var(--primary) / 0.1)" }}
            >
              <TrendingUp size={24} style={{ color: "hsl(var(--primary))" }} />
            </div>
            <div className="stat-value" data-testid="today-sales-value">
              {formatCurrency(stats?.today_sales || 0)}
            </div>
            <div className="stat-label">مبيعات اليوم</div>
          </div>

          <div className="stat-card animate-fade-in-up stagger-1">
            <div
              className="stat-icon"
              style={{ backgroundColor: "hsl(var(--accent) / 0.1)" }}
            >
              <FileText size={24} style={{ color: "hsl(var(--accent))" }} />
            </div>
            <div className="stat-value" data-testid="today-invoices-value">
              {stats?.today_invoices_count || 0}
            </div>
            <div className="stat-label">فواتير اليوم</div>
          </div>

          <div className="stat-card animate-fade-in-up stagger-2">
            <div
              className="stat-icon"
              style={{ backgroundColor: "hsl(var(--chart-3) / 0.1)" }}
            >
              <Package size={24} style={{ color: "hsl(var(--chart-3))" }} />
            </div>
            <div className="stat-value" data-testid="total-products-value">
              {stats?.total_products || 0}
            </div>
            <div className="stat-label">إجمالي المنتجات</div>
          </div>

          <div className="stat-card animate-fade-in-up stagger-3">
            <div
              className="stat-icon"
              style={{ backgroundColor: "hsl(var(--chart-5) / 0.1)" }}
            >
              <Users size={24} style={{ color: "hsl(var(--chart-5))" }} />
            </div>
            <div className="stat-value" data-testid="total-customers-value">
              {stats?.total_customers || 0}
            </div>
            <div className="stat-label">إجمالي العملاء</div>
          </div>
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl border border-[hsl(var(--border))] p-6 animate-fade-in-up stagger-4">
            <div className="flex items-center justify-between mb-4">
              <h3
                className="font-semibold text-lg"
                style={{ fontFamily: "'Tajawal', sans-serif" }}
              >
                إجمالي المبيعات
              </h3>
              <ShoppingCart size={20} className="text-[hsl(var(--muted-foreground))]" />
            </div>
            <div className="text-2xl font-bold text-[hsl(var(--primary))]" data-testid="total-sales-value">
              {formatCurrency(stats?.total_sales || 0)}
            </div>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              من {stats?.total_invoices || 0} فاتورة
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-[hsl(var(--border))] p-6 animate-fade-in-up stagger-5">
            <div className="flex items-center justify-between mb-4">
              <h3
                className="font-semibold text-lg"
                style={{ fontFamily: "'Tajawal', sans-serif" }}
              >
                المنتجات منخفضة المخزون
              </h3>
              <AlertTriangle
                size={20}
                className={
                  stats?.low_stock_products > 0
                    ? "text-[hsl(var(--warning))]"
                    : "text-[hsl(var(--muted-foreground))]"
                }
              />
            </div>
            <div
              className={`text-2xl font-bold ${
                stats?.low_stock_products > 0
                  ? "text-[hsl(var(--warning))]"
                  : "text-[hsl(var(--foreground))]"
              }`}
              data-testid="low-stock-value"
            >
              {stats?.low_stock_products || 0}
            </div>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              منتج أقل من 10 قطع
            </p>
          </div>

          <div className="bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] rounded-2xl p-6 text-white animate-fade-in-up stagger-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                ابدأ البيع
              </h3>
              <CreditCard size={20} />
            </div>
            <p className="text-white/80 text-sm mb-4">
              انتقل إلى نقطة البيع لإنشاء فاتورة جديدة
            </p>
            <a
              href="/pos"
              data-testid="go-to-pos-btn"
              className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              نقطة البيع
              <ShoppingCart size={16} />
            </a>
          </div>
        </div>

        {/* Recent Invoices */}
        <div className="bg-white rounded-2xl border border-[hsl(var(--border))] overflow-hidden animate-fade-in-up">
          <div className="p-6 border-b border-[hsl(var(--border))]">
            <h3
              className="font-semibold text-lg"
              style={{ fontFamily: "'Tajawal', sans-serif" }}
            >
              آخر الفواتير
            </h3>
          </div>

          {stats?.recent_invoices?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[hsl(var(--muted)/0.3)]">
                    <th className="text-right p-4 font-medium text-[hsl(var(--muted-foreground))] text-sm">
                      رقم الفاتورة
                    </th>
                    <th className="text-right p-4 font-medium text-[hsl(var(--muted-foreground))] text-sm">
                      العميل
                    </th>
                    <th className="text-right p-4 font-medium text-[hsl(var(--muted-foreground))] text-sm">
                      المبلغ
                    </th>
                    <th className="text-right p-4 font-medium text-[hsl(var(--muted-foreground))] text-sm">
                      طريقة الدفع
                    </th>
                    <th className="text-right p-4 font-medium text-[hsl(var(--muted-foreground))] text-sm">
                      التاريخ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent_invoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      data-testid={`invoice-row-${invoice.id}`}
                      className="border-t border-[hsl(var(--border))] hover:bg-[hsl(var(--muted)/0.3)]"
                    >
                      <td className="p-4 font-mono text-sm">{invoice.invoice_number}</td>
                      <td className="p-4">{invoice.customer_name}</td>
                      <td className="p-4 font-semibold">{formatCurrency(invoice.total)}</td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1.5">
                          {invoice.payment_method === "cash" ? (
                            <>
                              <Banknote size={16} className="text-[hsl(var(--success))]" />
                              <span>نقدي</span>
                            </>
                          ) : (
                            <>
                              <CreditCard size={16} className="text-[hsl(var(--primary))]" />
                              <span>شبكة</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-[hsl(var(--muted-foreground))]">
                        {formatDate(invoice.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center">
              <FileText
                size={48}
                className="mx-auto mb-4 text-[hsl(var(--muted-foreground))] opacity-50"
              />
              <p className="text-[hsl(var(--muted-foreground))]">لا توجد فواتير بعد</p>
              <a
                href="/pos"
                className="inline-block mt-4 text-[hsl(var(--primary))] hover:underline"
              >
                إنشاء أول فاتورة
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
