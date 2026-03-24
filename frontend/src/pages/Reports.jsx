import { useState, useEffect } from "react";
import axios from "axios";
import { API } from "../App";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  BarChart3,
  TrendingUp,
  Calendar,
  Download,
  CreditCard,
  Banknote,
  FileText,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export default function Reports() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async (start = "", end = "") => {
    setLoading(true);
    try {
      let url = `${API}/reports/sales`;
      const params = new URLSearchParams();
      if (start) params.append("start_date", start);
      if (end) params.append("end_date", end);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await axios.get(url);
      setReport(response.data);
    } catch (error) {
      toast.error("فشل تحميل التقرير");
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    fetchReport(startDate, endDate);
  };

  const handleClearFilter = () => {
    setStartDate("");
    setEndDate("");
    fetchReport();
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
    });
  };

  const COLORS = ["hsl(144, 69%, 19%)", "hsl(160, 84%, 39%)"];

  const paymentData = report
    ? [
        { name: "نقدي", value: report.payment_breakdown.cash || 0 },
        { name: "شبكة", value: report.payment_breakdown.card || 0 },
      ]
    : [];

  const dailyData = report?.daily_sales?.slice(-7).reverse() || [];

  if (loading && !report) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-100px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[hsl(var(--primary))] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div data-testid="reports-page">
      <header className="page-header">
        <h1 className="page-title">التقارير</h1>
      </header>

      <div className="page-content">
        {/* Date Filter */}
        <div className="bg-white rounded-2xl border border-[hsl(var(--border))] p-6 mb-6">
          <h3
            className="font-semibold mb-4 flex items-center gap-2"
            style={{ fontFamily: "'Tajawal', sans-serif" }}
          >
            <Calendar size={20} />
            تصفية حسب التاريخ
          </h3>
          <div className="flex flex-wrap items-end gap-4">
            <div className="form-group mb-0">
              <Label className="form-label text-sm">من تاريخ</Label>
              <Input
                data-testid="report-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="form-input w-40"
              />
            </div>
            <div className="form-group mb-0">
              <Label className="form-label text-sm">إلى تاريخ</Label>
              <Input
                data-testid="report-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="form-input w-40"
              />
            </div>
            <Button
              data-testid="apply-filter-btn"
              onClick={handleFilter}
              className="btn btn-primary"
            >
              تطبيق
            </Button>
            {(startDate || endDate) && (
              <Button
                data-testid="clear-filter-btn"
                variant="outline"
                onClick={handleClearFilter}
                className="btn btn-secondary"
              >
                مسح
              </Button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-2xl border border-[hsl(var(--border))] p-6">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp size={24} className="text-[hsl(var(--primary))]" />
            </div>
            <div
              className="text-2xl font-bold text-[hsl(var(--primary))]"
              data-testid="report-total-sales"
            >
              {formatCurrency(report?.total_sales || 0)}
            </div>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">إجمالي المبيعات</p>
          </div>

          <div className="bg-white rounded-2xl border border-[hsl(var(--border))] p-6">
            <div className="flex items-center justify-between mb-4">
              <FileText size={24} className="text-[hsl(var(--accent))]" />
            </div>
            <div
              className="text-2xl font-bold"
              data-testid="report-invoice-count"
            >
              {report?.invoice_count || 0}
            </div>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">عدد الفواتير</p>
          </div>

          <div className="bg-white rounded-2xl border border-[hsl(var(--border))] p-6">
            <div className="flex items-center justify-between mb-4">
              <BarChart3 size={24} className="text-[hsl(var(--chart-3))]" />
            </div>
            <div
              className="text-2xl font-bold"
              data-testid="report-total-vat"
            >
              {formatCurrency(report?.total_vat || 0)}
            </div>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">إجمالي الضريبة</p>
          </div>

          <div className="bg-white rounded-2xl border border-[hsl(var(--border))] p-6">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp size={24} className="text-[hsl(var(--chart-5))]" />
            </div>
            <div className="text-2xl font-bold" data-testid="report-average">
              {formatCurrency(
                report?.invoice_count > 0
                  ? report.total_sales / report.invoice_count
                  : 0
              )}
            </div>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">متوسط الفاتورة</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Daily Sales Chart */}
          <div className="bg-white rounded-2xl border border-[hsl(var(--border))] p-6">
            <h3
              className="font-semibold mb-6"
              style={{ fontFamily: "'Tajawal', sans-serif" }}
            >
              المبيعات اليومية (آخر 7 أيام)
            </h3>
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) =>
                      new Date(value).toLocaleDateString("ar-SA", {
                        month: "short",
                        day: "numeric",
                      })
                    }
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) => [formatCurrency(value), "المبيعات"]}
                    labelFormatter={(label) => formatDate(label)}
                  />
                  <Bar
                    dataKey="total"
                    fill="hsl(144, 69%, 19%)"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-[hsl(var(--muted-foreground))]">
                لا توجد بيانات
              </div>
            )}
          </div>

          {/* Payment Methods Chart */}
          <div className="bg-white rounded-2xl border border-[hsl(var(--border))] p-6">
            <h3
              className="font-semibold mb-6"
              style={{ fontFamily: "'Tajawal', sans-serif" }}
            >
              توزيع طرق الدفع
            </h3>
            {paymentData.some((d) => d.value > 0) ? (
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={paymentData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {paymentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-[hsl(var(--muted-foreground))]">
                لا توجد بيانات
              </div>
            )}
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <Banknote size={18} className="text-[hsl(var(--primary))]" />
                <span className="text-sm">نقدي: {formatCurrency(report?.payment_breakdown?.cash || 0)}</span>
              </div>
              <div className="flex items-center gap-2">
                <CreditCard size={18} className="text-[hsl(var(--accent))]" />
                <span className="text-sm">شبكة: {formatCurrency(report?.payment_breakdown?.card || 0)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Invoices */}
        {report?.invoices?.length > 0 && (
          <div className="bg-white rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
            <div className="p-6 border-b border-[hsl(var(--border))]">
              <h3
                className="font-semibold"
                style={{ fontFamily: "'Tajawal', sans-serif" }}
              >
                تفاصيل الفواتير
              </h3>
            </div>
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
                      الضريبة
                    </th>
                    <th className="text-right p-4 font-medium text-[hsl(var(--muted-foreground))] text-sm">
                      الإجمالي
                    </th>
                    <th className="text-right p-4 font-medium text-[hsl(var(--muted-foreground))] text-sm">
                      التاريخ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.invoices.slice(0, 10).map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="border-t border-[hsl(var(--border))] hover:bg-[hsl(var(--muted)/0.3)]"
                    >
                      <td className="p-4 font-mono text-sm">{invoice.invoice_number}</td>
                      <td className="p-4">{invoice.customer_name}</td>
                      <td className="p-4">{formatCurrency(invoice.subtotal)}</td>
                      <td className="p-4">{formatCurrency(invoice.vat_amount)}</td>
                      <td className="p-4 font-semibold">{formatCurrency(invoice.total)}</td>
                      <td className="p-4 text-sm text-[hsl(var(--muted-foreground))]">
                        {formatDate(invoice.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
