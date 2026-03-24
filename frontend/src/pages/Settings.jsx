import { useState, useEffect } from "react";
import { useSettings } from "../App";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { QRCodeSVG } from "qrcode.react";
import {
  Building2,
  Phone,
  MapPin,
  FileText,
  Percent,
  Save,
  Palette,
  Eye,
  Image,
  ScrollText,
} from "lucide-react";

export default function Settings() {
  const { settings, updateSettings } = useSettings();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("company");
  const [formData, setFormData] = useState({
    company_name: "",
    company_vat_number: "",
    company_cr_number: "",
    company_address: "",
    company_phone: "",
    company_logo: "",
    vat_enabled: false,
    vat_rate: 15,
    invoice_header: "فاتورة",
    invoice_footer: "شكراً لتعاملكم معنا",
    invoice_notes: "",
    invoice_terms: "",
    show_logo: true,
    primary_color: "#0F5132",
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        company_name: settings.company_name || "",
        company_vat_number: settings.company_vat_number || "",
        company_cr_number: settings.company_cr_number || "",
        company_address: settings.company_address || "",
        company_phone: settings.company_phone || "",
        company_logo: settings.company_logo || "",
        vat_enabled: settings.vat_enabled ?? false,
        vat_rate: settings.vat_rate || 15,
        invoice_header: settings.invoice_header || "فاتورة",
        invoice_footer: settings.invoice_footer || "شكراً لتعاملكم معنا",
        invoice_notes: settings.invoice_notes || "",
        invoice_terms: settings.invoice_terms || "",
        show_logo: settings.show_logo ?? true,
        primary_color: settings.primary_color || "#0F5132",
      });
    }
  }, [settings]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await updateSettings({
      ...formData,
      vat_rate: parseFloat(formData.vat_rate),
    });
    setLoading(false);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("ar-SA", {
      style: "currency",
      currency: "SAR",
    }).format(amount);
  };

  // Sample invoice data for preview
  const sampleInvoice = {
    invoice_number: "INV-20260115-ABC12345",
    customer_name: "محمد أحمد",
    customer_phone: "+966501234567",
    items: [
      { product_name: "خدمة صيانة", quantity: 1, price: 200, total: 200 },
      { product_name: "قطع غيار", quantity: 2, price: 75, total: 150 },
    ],
    subtotal: 350,
    vat_amount: formData.vat_enabled ? 350 * (formData.vat_rate / 100) : 0,
    total: 350 + (formData.vat_enabled ? 350 * (formData.vat_rate / 100) : 0),
    payment_method: "cash",
    created_at: new Date().toISOString(),
    qr_data: btoa("Sample QR Data"),
  };

  const colorPresets = [
    { name: "أخضر داكن", value: "#0F5132" },
    { name: "أزرق", value: "#1E40AF" },
    { name: "أحمر", value: "#991B1B" },
    { name: "بنفسجي", value: "#6B21A8" },
    { name: "برتقالي", value: "#C2410C" },
    { name: "أسود", value: "#171717" },
  ];

  return (
    <div data-testid="settings-page">
      <header className="page-header">
        <h1 className="page-title">الإعدادات</h1>
      </header>

      <div className="page-content">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6 bg-white border border-[hsl(var(--border))] p-1 rounded-xl flex-wrap">
            <TabsTrigger
              value="company"
              data-testid="tab-company"
              className="rounded-lg px-4 data-[state=active]:bg-[hsl(var(--primary))] data-[state=active]:text-white"
            >
              <Building2 size={18} className="me-2" />
              معلومات الشركة
            </TabsTrigger>
            <TabsTrigger
              value="vat"
              data-testid="tab-vat"
              className="rounded-lg px-4 data-[state=active]:bg-[hsl(var(--primary))] data-[state=active]:text-white"
            >
              <Percent size={18} className="me-2" />
              الضريبة
            </TabsTrigger>
            <TabsTrigger
              value="invoice"
              data-testid="tab-invoice"
              className="rounded-lg px-4 data-[state=active]:bg-[hsl(var(--primary))] data-[state=active]:text-white"
            >
              <Palette size={18} className="me-2" />
              تصميم الفاتورة
            </TabsTrigger>
            <TabsTrigger
              value="terms"
              data-testid="tab-terms"
              className="rounded-lg px-4 data-[state=active]:bg-[hsl(var(--primary))] data-[state=active]:text-white"
            >
              <ScrollText size={18} className="me-2" />
              الشروط والأحكام
            </TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit}>
            {/* Company Information Tab */}
            <TabsContent value="company">
              <div className="bg-white rounded-2xl border border-[hsl(var(--border))] p-6 max-w-2xl">
                <h2
                  className="text-lg font-bold mb-6 flex items-center gap-2"
                  style={{ fontFamily: "'Tajawal', sans-serif" }}
                >
                  <Building2 size={20} className="text-[hsl(var(--primary))]" />
                  معلومات الشركة
                </h2>

                <div className="space-y-5">
                  <div className="form-group">
                    <Label htmlFor="company_name" className="form-label">
                      اسم الشركة / المؤسسة
                    </Label>
                    <Input
                      id="company_name"
                      data-testid="company-name-input"
                      value={formData.company_name}
                      onChange={(e) =>
                        setFormData({ ...formData, company_name: e.target.value })
                      }
                      className="form-input"
                      placeholder="اسم الشركة كما يظهر في الفواتير"
                    />
                  </div>

                  <div className="form-group">
                    <Label htmlFor="company_cr_number" className="form-label flex items-center gap-2">
                      <FileText size={16} />
                      رقم السجل التجاري
                    </Label>
                    <Input
                      id="company_cr_number"
                      data-testid="company-cr-input"
                      dir="ltr"
                      value={formData.company_cr_number}
                      onChange={(e) =>
                        setFormData({ ...formData, company_cr_number: e.target.value })
                      }
                      className="form-input text-left"
                      placeholder="1010000000"
                    />
                  </div>

                  <div className="form-group">
                    <Label htmlFor="company_vat_number" className="form-label flex items-center gap-2">
                      <FileText size={16} />
                      الرقم الضريبي (اختياري)
                    </Label>
                    <Input
                      id="company_vat_number"
                      data-testid="company-vat-input"
                      dir="ltr"
                      value={formData.company_vat_number}
                      onChange={(e) =>
                        setFormData({ ...formData, company_vat_number: e.target.value })
                      }
                      className="form-input text-left"
                      placeholder="300000000000003"
                    />
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                      يظهر في الفاتورة فقط عند تفعيل الضريبة
                    </p>
                  </div>

                  <div className="form-group">
                    <Label htmlFor="company_phone" className="form-label flex items-center gap-2">
                      <Phone size={16} />
                      رقم الهاتف
                    </Label>
                    <Input
                      id="company_phone"
                      data-testid="company-phone-input"
                      dir="ltr"
                      value={formData.company_phone}
                      onChange={(e) =>
                        setFormData({ ...formData, company_phone: e.target.value })
                      }
                      className="form-input text-left"
                      placeholder="+966500000000"
                    />
                  </div>

                  <div className="form-group">
                    <Label htmlFor="company_address" className="form-label flex items-center gap-2">
                      <MapPin size={16} />
                      العنوان
                    </Label>
                    <textarea
                      id="company_address"
                      data-testid="company-address-input"
                      value={formData.company_address}
                      onChange={(e) =>
                        setFormData({ ...formData, company_address: e.target.value })
                      }
                      className="form-input min-h-[80px] resize-none"
                      placeholder="عنوان الشركة كما يظهر في الفواتير"
                    />
                  </div>

                  <div className="form-group">
                    <Label htmlFor="company_logo" className="form-label flex items-center gap-2">
                      <Image size={16} />
                      رابط شعار الشركة (اختياري)
                    </Label>
                    <Input
                      id="company_logo"
                      data-testid="company-logo-input"
                      dir="ltr"
                      value={formData.company_logo}
                      onChange={(e) =>
                        setFormData({ ...formData, company_logo: e.target.value })
                      }
                      className="form-input text-left"
                      placeholder="https://example.com/logo.png"
                    />
                    {formData.company_logo && (
                      <div className="mt-2 p-3 bg-[hsl(var(--muted)/0.3)] rounded-xl">
                        <img
                          src={formData.company_logo}
                          alt="شعار الشركة"
                          className="h-16 object-contain"
                          onError={(e) => (e.target.style.display = "none")}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* VAT Settings Tab */}
            <TabsContent value="vat">
              <div className="bg-white rounded-2xl border border-[hsl(var(--border))] p-6 max-w-2xl">
                <h2
                  className="text-lg font-bold mb-6 flex items-center gap-2"
                  style={{ fontFamily: "'Tajawal', sans-serif" }}
                >
                  <Percent size={20} className="text-[hsl(var(--primary))]" />
                  إعدادات ضريبة القيمة المضافة
                </h2>

                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-[hsl(var(--muted)/0.3)] rounded-xl">
                    <div>
                      <Label htmlFor="vat_enabled" className="font-medium">
                        تفعيل ضريبة القيمة المضافة
                      </Label>
                      <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                        عند التفعيل، سيتم إضافة الضريبة لجميع الفواتير وإظهار الرقم الضريبي
                      </p>
                    </div>
                    <Switch
                      id="vat_enabled"
                      data-testid="vat-toggle"
                      checked={formData.vat_enabled}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, vat_enabled: checked })
                      }
                    />
                  </div>

                  {formData.vat_enabled && (
                    <div className="form-group animate-fade-in-up">
                      <Label htmlFor="vat_rate" className="form-label">
                        نسبة الضريبة (%)
                      </Label>
                      <Input
                        id="vat_rate"
                        data-testid="vat-rate-input"
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={formData.vat_rate}
                        onChange={(e) =>
                          setFormData({ ...formData, vat_rate: e.target.value })
                        }
                        className="form-input w-32"
                      />
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                        النسبة الحالية في المملكة العربية السعودية هي 15%
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-6 p-4 bg-blue-50 rounded-xl text-sm">
                  <p className="font-medium text-blue-800 mb-2">ملاحظة:</p>
                  <p className="text-blue-700">
                    إذا كانت مؤسستك غير مسجلة في ضريبة القيمة المضافة، يمكنك إيقاف هذا الخيار ولن يظهر الرقم الضريبي في الفواتير.
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Invoice Design Tab */}
            <TabsContent value="invoice">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Design Options */}
                <div className="bg-white rounded-2xl border border-[hsl(var(--border))] p-6">
                  <h2
                    className="text-lg font-bold mb-6 flex items-center gap-2"
                    style={{ fontFamily: "'Tajawal', sans-serif" }}
                  >
                    <Palette size={20} className="text-[hsl(var(--primary))]" />
                    تصميم الفاتورة
                  </h2>

                  <div className="space-y-5">
                    {/* Show Logo Toggle */}
                    <div className="flex items-center justify-between p-4 bg-[hsl(var(--muted)/0.3)] rounded-xl">
                      <div>
                        <Label htmlFor="show_logo" className="font-medium">
                          عرض الشعار في الفاتورة
                        </Label>
                      </div>
                      <Switch
                        id="show_logo"
                        data-testid="show-logo-toggle"
                        checked={formData.show_logo}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, show_logo: checked })
                        }
                      />
                    </div>

                    {/* Primary Color */}
                    <div className="form-group">
                      <Label className="form-label">اللون الرئيسي</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {colorPresets.map((color) => (
                          <button
                            key={color.value}
                            type="button"
                            data-testid={`color-${color.value}`}
                            onClick={() => setFormData({ ...formData, primary_color: color.value })}
                            className={`w-10 h-10 rounded-xl border-2 transition-transform ${
                              formData.primary_color === color.value
                                ? "border-[hsl(var(--foreground))] scale-110"
                                : "border-transparent"
                            }`}
                            style={{ backgroundColor: color.value }}
                            title={color.name}
                          />
                        ))}
                        <input
                          type="color"
                          data-testid="custom-color-input"
                          value={formData.primary_color}
                          onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                          className="w-10 h-10 rounded-xl cursor-pointer border-2 border-[hsl(var(--border))]"
                        />
                      </div>
                    </div>

                    {/* Invoice Header */}
                    <div className="form-group">
                      <Label htmlFor="invoice_header" className="form-label">
                        عنوان الفاتورة
                      </Label>
                      <Input
                        id="invoice_header"
                        data-testid="invoice-header-input"
                        value={formData.invoice_header}
                        onChange={(e) =>
                          setFormData({ ...formData, invoice_header: e.target.value })
                        }
                        className="form-input"
                        placeholder="فاتورة"
                      />
                    </div>

                    {/* Invoice Footer */}
                    <div className="form-group">
                      <Label htmlFor="invoice_footer" className="form-label">
                        نص أسفل الفاتورة
                      </Label>
                      <Input
                        id="invoice_footer"
                        data-testid="invoice-footer-input"
                        value={formData.invoice_footer}
                        onChange={(e) =>
                          setFormData({ ...formData, invoice_footer: e.target.value })
                        }
                        className="form-input"
                        placeholder="شكراً لتعاملكم معنا"
                      />
                    </div>
                  </div>
                </div>

                {/* Invoice Preview */}
                <div className="bg-white rounded-2xl border border-[hsl(var(--border))] p-6">
                  <h2
                    className="text-lg font-bold mb-6 flex items-center gap-2"
                    style={{ fontFamily: "'Tajawal', sans-serif" }}
                  >
                    <Eye size={20} className="text-[hsl(var(--primary))]" />
                    معاينة الفاتورة (A4)
                  </h2>

                  {/* Invoice Preview */}
                  <div
                    className="border border-[hsl(var(--border))] rounded-xl p-6 bg-white text-sm overflow-auto"
                    style={{ maxHeight: "500px" }}
                  >
                    {/* Header */}
                    <div className="text-center mb-6 pb-4 border-b-2 border-gray-200">
                      {formData.show_logo && formData.company_logo && (
                        <img
                          src={formData.company_logo}
                          alt="شعار"
                          className="h-12 mx-auto mb-2 object-contain"
                          onError={(e) => (e.target.style.display = "none")}
                        />
                      )}
                      <h3
                        className="text-lg font-bold mb-1"
                        style={{ color: formData.primary_color }}
                      >
                        {formData.company_name || "اسم الشركة"}
                      </h3>
                      <p className="text-xs text-gray-500">{formData.company_address}</p>
                      <p className="text-xs text-gray-500">{formData.company_phone}</p>
                      {formData.company_cr_number && (
                        <p className="text-xs text-gray-500">السجل التجاري: {formData.company_cr_number}</p>
                      )}
                      {formData.vat_enabled && formData.company_vat_number && (
                        <p className="text-xs text-gray-500">الرقم الضريبي: {formData.company_vat_number}</p>
                      )}
                      <p
                        className="mt-3 font-semibold text-base"
                        style={{ color: formData.primary_color }}
                      >
                        {formData.invoice_header}
                      </p>
                    </div>

                    {/* Customer Info */}
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg text-xs">
                      <p className="font-semibold">{sampleInvoice.customer_name}</p>
                      <p className="text-gray-500" dir="ltr">{sampleInvoice.customer_phone}</p>
                    </div>

                    {/* Items */}
                    <table className="w-full text-xs mb-4">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="text-right p-2">م</th>
                          <th className="text-right p-2">تفاصيل السلع أو الخدمات</th>
                          <th className="text-center p-2">الكمية</th>
                          <th className="text-left p-2">السعر</th>
                          <th className="text-left p-2">المجموع</th>
                          {formData.vat_enabled && <th className="text-left p-2">الضريبة</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {sampleInvoice.items.map((item, i) => (
                          <tr key={i} className="border-b border-gray-100">
                            <td className="p-2">{i + 1}</td>
                            <td className="p-2">{item.product_name}</td>
                            <td className="text-center p-2">{item.quantity}</td>
                            <td className="text-left p-2">{formatCurrency(item.price)}</td>
                            <td className="text-left p-2">{formatCurrency(item.total)}</td>
                            {formData.vat_enabled && (
                              <td className="text-left p-2">
                                {formatCurrency(item.total * (formData.vat_rate / 100))}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Totals */}
                    <div className="text-xs space-y-1 mb-4">
                      <div className="flex justify-between">
                        <span>المجموع الفرعي:</span>
                        <span>{formatCurrency(sampleInvoice.subtotal)}</span>
                      </div>
                      {formData.vat_enabled && (
                        <div className="flex justify-between">
                          <span>ضريبة القيمة المضافة ({formData.vat_rate}%):</span>
                          <span>{formatCurrency(sampleInvoice.vat_amount)}</span>
                        </div>
                      )}
                      <div
                        className="flex justify-between font-bold pt-2 border-t border-gray-200"
                        style={{ color: formData.primary_color }}
                      >
                        <span>الإجمالي:</span>
                        <span>{formatCurrency(sampleInvoice.total)}</span>
                      </div>
                    </div>

                    {/* QR Code */}
                    <div className="text-center my-4">
                      <QRCodeSVG value={sampleInvoice.qr_data} size={80} className="mx-auto" />
                    </div>

                    {/* Terms */}
                    {formData.invoice_terms && (
                      <div className="text-xs p-3 bg-gray-50 rounded-lg mb-4">
                        <p className="font-semibold mb-1">الشروط والأحكام:</p>
                        <p className="text-gray-600 whitespace-pre-line">{formData.invoice_terms}</p>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="text-center pt-3 border-t border-gray-200 text-xs text-gray-500">
                      <p>{formData.invoice_footer}</p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Terms Tab */}
            <TabsContent value="terms">
              <div className="bg-white rounded-2xl border border-[hsl(var(--border))] p-6 max-w-2xl">
                <h2
                  className="text-lg font-bold mb-6 flex items-center gap-2"
                  style={{ fontFamily: "'Tajawal', sans-serif" }}
                >
                  <ScrollText size={20} className="text-[hsl(var(--primary))]" />
                  الشروط والأحكام
                </h2>

                <div className="space-y-5">
                  <div className="form-group">
                    <Label htmlFor="invoice_terms" className="form-label">
                      الشروط والأحكام (تظهر في الفاتورة)
                    </Label>
                    <textarea
                      id="invoice_terms"
                      data-testid="invoice-terms-input"
                      value={formData.invoice_terms}
                      onChange={(e) =>
                        setFormData({ ...formData, invoice_terms: e.target.value })
                      }
                      className="form-input min-h-[200px] resize-none"
                      placeholder="أدخل الشروط والأحكام التي ستظهر في أسفل الفاتورة..."
                    />
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
                      مثال: البضاعة المباعة لا ترد ولا تستبدل / مدة الضمان 30 يوم / الأسعار شاملة الضريبة
                    </p>
                  </div>

                  <div className="form-group">
                    <Label htmlFor="invoice_notes" className="form-label">
                      ملاحظات افتراضية (اختياري)
                    </Label>
                    <textarea
                      id="invoice_notes"
                      data-testid="invoice-notes-settings"
                      value={formData.invoice_notes}
                      onChange={(e) =>
                        setFormData({ ...formData, invoice_notes: e.target.value })
                      }
                      className="form-input min-h-[100px] resize-none"
                      placeholder="ملاحظات تظهر تلقائياً في كل فاتورة جديدة"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Save Button */}
            <div className="mt-6 max-w-2xl">
              <Button
                type="submit"
                data-testid="save-settings-btn"
                className="btn btn-primary w-full h-12 text-base"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span>
                    جاري الحفظ...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Save size={20} />
                    حفظ الإعدادات
                  </span>
                )}
              </Button>
            </div>
          </form>
        </Tabs>
      </div>
    </div>
  );
}
