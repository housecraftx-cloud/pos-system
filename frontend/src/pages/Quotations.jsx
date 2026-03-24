import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { API, useSettings } from "../App";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import {
  Search,
  FileText,
  Eye,
  Printer,
  X,
  Calendar,
  Plus,
  Trash2,
  Download,
  UserPlus,
  Tag,
  Pencil,
  ArrowLeftRight,
  Clock,
  CheckCircle,
  XCircle,
  Send,
} from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const STATUS_MAP = {
  draft: { label: "مسودة", color: "bg-gray-100 text-gray-700" },
  sent: { label: "مرسل", color: "bg-blue-100 text-blue-700" },
  accepted: { label: "مقبول", color: "bg-green-100 text-green-700" },
  rejected: { label: "مرفوض", color: "bg-red-100 text-red-700" },
  converted: { label: "تم التحويل", color: "bg-purple-100 text-purple-700" },
};

export default function Quotations() {
  const { settings } = useSettings();
  const [quotations, setQuotations] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingQuoteId, setEditingQuoteId] = useState(null);
  const printRef = useRef();

  const [newQuote, setNewQuote] = useState({
    customer_id: null,
    customer_name: "عميل نقدي",
    customer_phone: "",
    items: [],
    discount: 0,
    discount_type: "amount",
    notes: "",
    validity_days: 30,
  });
  const [customerSearch, setCustomerSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [quickCustomer, setQuickCustomer] = useState({ name: "", phone: "" });
  const [manualItem, setManualItem] = useState({ name: "", quantity: 1, price: 0 });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [customPrice, setCustomPrice] = useState("");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [quotesRes, productsRes, customersRes] = await Promise.all([
        axios.get(`${API}/quotations`),
        axios.get(`${API}/products`),
        axios.get(`${API}/customers`),
      ]);
      setQuotations(quotesRes.data);
      setProducts(productsRes.data);
      setCustomers(customersRes.data);
    } catch (error) {
      toast.error("فشل تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSearch = async (query) => {
    setCustomerSearch(query);
    if (query.length >= 2) {
      try {
        const response = await axios.get(`${API}/customers/search?q=${query}`);
        setSearchResults(response.data);
        setShowCustomerDropdown(true);
      } catch (error) { console.error(error); }
    } else {
      setSearchResults([]);
      setShowCustomerDropdown(false);
    }
  };

  const selectCustomer = (customer) => {
    setNewQuote({ ...newQuote, customer_id: customer.id, customer_name: customer.name, customer_phone: customer.phone });
    setCustomerSearch(customer.name);
    setShowCustomerDropdown(false);
  };

  const handleQuickCustomerCreate = async () => {
    if (!quickCustomer.name || !quickCustomer.phone) { toast.error("يرجى إدخال الاسم ورقم الجوال"); return; }
    try {
      const response = await axios.post(`${API}/customers/quick`, quickCustomer);
      setNewQuote({ ...newQuote, customer_id: response.data.id, customer_name: response.data.name, customer_phone: response.data.phone });
      setCustomerSearch(response.data.name);
      setShowQuickCustomer(false);
      setQuickCustomer({ name: "", phone: "" });
      toast.success("تم إضافة العميل بنجاح");
    } catch (error) { toast.error("فشل إضافة العميل"); }
  };

  const addProductToQuote = () => {
    if (!selectedProduct) return;
    if (newQuote.items.find((item) => item.product_id === selectedProduct.id && !item.is_manual)) {
      toast.error("المنتج موجود مسبقاً"); return;
    }
    const price = customPrice ? parseFloat(customPrice) : selectedProduct.price;
    setNewQuote({
      ...newQuote,
      items: [...newQuote.items, { product_id: selectedProduct.id, product_name: selectedProduct.name, quantity: 1, price, total: price, is_manual: false }],
    });
    setSelectedProduct(null);
    setCustomPrice("");
  };

  const addManualItem = () => {
    if (!manualItem.name || manualItem.price <= 0) { toast.error("يرجى إدخال اسم المنتج والسعر"); return; }
    setNewQuote({
      ...newQuote,
      items: [...newQuote.items, { product_id: null, product_name: manualItem.name, quantity: manualItem.quantity, price: manualItem.price, total: manualItem.quantity * manualItem.price, is_manual: true }],
    });
    setManualItem({ name: "", quantity: 1, price: 0 });
  };

  const updateItemQuantity = (index, quantity) => {
    const items = [...newQuote.items];
    items[index].quantity = quantity;
    items[index].total = quantity * items[index].price;
    setNewQuote({ ...newQuote, items });
  };

  const updateItemPrice = (index, price) => {
    const items = [...newQuote.items];
    items[index].price = price;
    items[index].total = items[index].quantity * price;
    setNewQuote({ ...newQuote, items });
  };

  const removeItem = (index) => {
    setNewQuote({ ...newQuote, items: newQuote.items.filter((_, i) => i !== index) });
  };

  const subtotal = newQuote.items.reduce((sum, item) => sum + item.total, 0);
  const discountAmount = newQuote.discount_type === "percentage" ? subtotal * (newQuote.discount / 100) : newQuote.discount;
  const subtotalAfterDiscount = subtotal - discountAmount;
  const vatAmount = settings?.vat_enabled ? subtotalAfterDiscount * (settings.vat_rate / 100) : 0;
  const total = subtotalAfterDiscount + vatAmount;

  const handleSubmitQuote = async () => {
    if (newQuote.items.length === 0) { toast.error("يرجى إضافة منتج واحد على الأقل"); return; }
    try {
      let response;
      if (isEditMode && editingQuoteId) {
        response = await axios.put(`${API}/quotations/${editingQuoteId}`, newQuote);
        setQuotations(quotations.map((q) => (q.id === editingQuoteId ? response.data : q)));
        toast.success("تم تحديث عرض السعر بنجاح");
      } else {
        response = await axios.post(`${API}/quotations`, newQuote);
        setQuotations([response.data, ...quotations]);
        toast.success("تم إنشاء عرض السعر بنجاح");
      }
      setSelectedQuote(response.data);
      setIsCreateDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || "فشل حفظ عرض السعر");
    }
  };

  const handleEditQuote = (quote) => {
    setIsEditMode(true);
    setEditingQuoteId(quote.id);
    setNewQuote({
      customer_id: quote.customer_id,
      customer_name: quote.customer_name,
      customer_phone: quote.customer_phone || "",
      items: quote.items.map((item) => ({ ...item, is_manual: item.is_manual || !item.product_id })),
      discount: quote.discount || 0,
      discount_type: quote.discount_type || "amount",
      notes: quote.notes || "",
      validity_days: quote.validity_days || 30,
    });
    setCustomerSearch(quote.customer_name);
    setIsCreateDialogOpen(true);
    setSelectedQuote(null);
  };

  const handleConvertToInvoice = async (quoteId) => {
    try {
      const response = await axios.post(`${API}/quotations/${quoteId}/convert`);
      toast.success(`تم تحويل عرض السعر إلى فاتورة رقم ${response.data.invoice_number}`);
      setQuotations(quotations.map((q) => (q.id === quoteId ? { ...q, status: "converted" } : q)));
      setSelectedQuote(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || "فشل التحويل");
    }
  };

  const handleUpdateStatus = async (quoteId, status) => {
    try {
      const response = await axios.put(`${API}/quotations/${quoteId}`, { status });
      setQuotations(quotations.map((q) => (q.id === quoteId ? response.data : q)));
      if (selectedQuote?.id === quoteId) setSelectedQuote(response.data);
      toast.success("تم تحديث الحالة");
    } catch (error) { toast.error("فشل تحديث الحالة"); }
  };

  const handleDeleteQuote = async (quoteId) => {
    if (!window.confirm("هل أنت متأكد من حذف عرض السعر؟")) return;
    try {
      await axios.delete(`${API}/quotations/${quoteId}`);
      setQuotations(quotations.filter((q) => q.id !== quoteId));
      setSelectedQuote(null);
      toast.success("تم حذف عرض السعر");
    } catch (error) { toast.error("فشل الحذف"); }
  };

  const resetForm = () => {
    setNewQuote({ customer_id: null, customer_name: "عميل نقدي", customer_phone: "", items: [], discount: 0, discount_type: "amount", notes: "", validity_days: 30 });
    setCustomerSearch("");
    setIsEditMode(false);
    setEditingQuoteId(null);
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const printWindow = window.open("", "", "width=900,height=1200");
    printWindow.document.write(`
      <html dir="rtl"><head><title>عرض سعر ${selectedQuote?.quote_number}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap');
          @page { size: A4; margin: 8mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'IBM Plex Sans Arabic', sans-serif; direction: rtl; line-height: 1.6; color: #1f2937; }
          table { border-collapse: collapse; }
        </style>
      </head><body>${printContent.innerHTML}</body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  const handleDownloadPDF = async () => {
    const element = printRef.current;
    if (!element) return;
    try {
      const originalStyle = element.style.cssText;
      element.style.overflow = "visible";
      element.style.height = "auto";
      
      const canvas = await html2canvas(element, {
        scale: 2, useCORS: true, allowTaint: true, logging: false, backgroundColor: "#ffffff",
        width: element.scrollWidth, height: element.scrollHeight, windowWidth: element.scrollWidth, windowHeight: element.scrollHeight,
      });
      
      element.style.cssText = originalStyle;
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = 190;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pageHeight = 277;
      if (pdfHeight <= pageHeight) {
        pdf.addImage(imgData, "PNG", 10, 10, pdfWidth, pdfHeight);
      } else {
        let position = 0;
        let remaining = pdfHeight;
        while (remaining > 0) {
          pdf.addImage(imgData, "PNG", 10, 10 - position, pdfWidth, pdfHeight);
          remaining -= pageHeight;
          position += pageHeight;
          if (remaining > 0) pdf.addPage();
        }
      }
      pdf.save(`عرض-سعر-${selectedQuote.quote_number}.pdf`);
      toast.success("تم تحميل عرض السعر");
    } catch (error) { toast.error("فشل التحميل"); }
  };

  const formatCurrency = (amount) => new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(amount);
  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });

  const filteredQuotations = quotations.filter(
    (q) => q.quote_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
           q.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (q.customer_phone && q.customer_phone.includes(searchQuery))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-100px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[hsl(var(--primary))] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div data-testid="quotations-page">
      <header className="page-header">
        <h1 className="page-title">عروض الأسعار</h1>
        <Button data-testid="create-quote-btn" onClick={() => { resetForm(); setIsCreateDialogOpen(true); }} className="btn btn-primary">
          <Plus size={20} />
          إنشاء عرض سعر
        </Button>
      </header>

      <div className="page-content">
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search size={20} className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <Input data-testid="quote-search-input" type="text" placeholder="البحث برقم العرض أو اسم العميل..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="form-input pe-10" />
          </div>
        </div>

        {filteredQuotations.length > 0 ? (
          <div className="bg-white rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[hsl(var(--muted)/0.3)]">
                    <th className="text-right p-4 font-medium text-[hsl(var(--muted-foreground))] text-sm">رقم العرض</th>
                    <th className="text-right p-4 font-medium text-[hsl(var(--muted-foreground))] text-sm">العميل</th>
                    <th className="text-right p-4 font-medium text-[hsl(var(--muted-foreground))] text-sm">المبلغ</th>
                    <th className="text-right p-4 font-medium text-[hsl(var(--muted-foreground))] text-sm">الحالة</th>
                    <th className="text-right p-4 font-medium text-[hsl(var(--muted-foreground))] text-sm">صالح حتى</th>
                    <th className="text-right p-4 font-medium text-[hsl(var(--muted-foreground))] text-sm">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuotations.map((quote) => {
                    const statusInfo = STATUS_MAP[quote.status] || STATUS_MAP.draft;
                    return (
                      <tr key={quote.id} data-testid={`quote-row-${quote.id}`} className="border-t border-[hsl(var(--border))] hover:bg-[hsl(var(--muted)/0.3)]">
                        <td className="p-4 font-mono text-sm">{quote.quote_number}</td>
                        <td className="p-4">
                          <p>{quote.customer_name}</p>
                          {quote.customer_phone && <p className="text-xs text-[hsl(var(--muted-foreground))]" dir="ltr">{quote.customer_phone}</p>}
                        </td>
                        <td className="p-4 font-semibold">{formatCurrency(quote.total)}</td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
                        </td>
                        <td className="p-4 text-sm text-[hsl(var(--muted-foreground))]">{formatDate(quote.valid_until)}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            <Button data-testid={`view-quote-${quote.id}`} variant="ghost" size="sm" onClick={() => setSelectedQuote(quote)} className="h-8 w-8 p-0"><Eye size={16} /></Button>
                            {quote.status !== "converted" && (
                              <>
                                <Button data-testid={`edit-quote-${quote.id}`} variant="ghost" size="sm" onClick={() => handleEditQuote(quote)} className="h-8 w-8 p-0"><Pencil size={16} /></Button>
                                <Button data-testid={`convert-quote-${quote.id}`} variant="ghost" size="sm" onClick={() => handleConvertToInvoice(quote.id)} className="h-8 w-8 p-0 text-[hsl(var(--primary))]" title="تحويل لفاتورة"><ArrowLeftRight size={16} /></Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[hsl(var(--border))] p-12 text-center">
            <FileText size={48} className="mx-auto mb-4 text-[hsl(var(--muted-foreground))] opacity-50" />
            <p className="text-[hsl(var(--muted-foreground))]">{searchQuery ? "لا توجد عروض مطابقة" : "لا توجد عروض أسعار بعد"}</p>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsCreateDialogOpen(open); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Tajawal', sans-serif" }}>
              {isEditMode ? "تحرير عرض السعر" : "إنشاء عرض سعر جديد"}
            </DialogTitle>
            <DialogDescription className="sr-only">نموذج إنشاء أو تحرير عرض سعر</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
            {/* Left: Customer & Options */}
            <div className="space-y-4">
              <h3 className="font-semibold">معلومات العرض</h3>

              {/* Validity */}
              <div>
                <Label className="form-label flex items-center gap-2"><Clock size={16} />مدة الصلاحية (أيام)</Label>
                <Input data-testid="validity-days" type="number" min="1" value={newQuote.validity_days} onChange={(e) => setNewQuote({ ...newQuote, validity_days: parseInt(e.target.value) || 30 })} className="form-input" />
              </div>

              {/* Customer Search */}
              <div className="relative">
                <Label className="form-label">البحث عن عميل</Label>
                <Input data-testid="customer-search-quote" type="text" placeholder="ابحث بالاسم أو رقم الجوال..." value={customerSearch} onChange={(e) => handleCustomerSearch(e.target.value)} className="form-input" />
                {showCustomerDropdown && searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-[hsl(var(--border))] rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {searchResults.map((customer) => (
                      <button key={customer.id} onClick={() => selectCustomer(customer)} className="w-full p-3 text-right hover:bg-[hsl(var(--muted))] flex justify-between items-center">
                        <span>{customer.name}</span>
                        <span className="text-sm text-[hsl(var(--muted-foreground))]" dir="ltr">{customer.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Button type="button" variant="outline" onClick={() => setShowQuickCustomer(!showQuickCustomer)} className="w-full">
                <UserPlus size={18} className="me-2" />إضافة عميل جديد سريع
              </Button>

              {showQuickCustomer && (
                <div className="p-4 bg-[hsl(var(--muted)/0.3)] rounded-xl space-y-3">
                  <Input data-testid="quick-customer-name-quote" placeholder="اسم العميل" value={quickCustomer.name} onChange={(e) => setQuickCustomer({ ...quickCustomer, name: e.target.value })} className="form-input" />
                  <Input data-testid="quick-customer-phone-quote" placeholder="رقم الجوال" dir="ltr" value={quickCustomer.phone} onChange={(e) => setQuickCustomer({ ...quickCustomer, phone: e.target.value })} className="form-input text-left" />
                  <Button onClick={handleQuickCustomerCreate} className="w-full btn btn-primary">حفظ العميل</Button>
                </div>
              )}

              {newQuote.customer_name !== "عميل نقدي" && (
                <div className="p-3 bg-[hsl(var(--success)/0.1)] rounded-xl">
                  <p className="font-medium">{newQuote.customer_name}</p>
                  {newQuote.customer_phone && <p className="text-sm text-[hsl(var(--muted-foreground))]" dir="ltr">{newQuote.customer_phone}</p>}
                </div>
              )}

              {/* Discount */}
              <div>
                <Label className="form-label flex items-center gap-2"><Tag size={16} />الخصم</Label>
                <div className="flex gap-2">
                  <Input data-testid="quote-discount-value" type="number" min="0" step="0.01" placeholder="0" value={newQuote.discount || ""} onChange={(e) => setNewQuote({ ...newQuote, discount: parseFloat(e.target.value) || 0 })} className="form-input flex-1" />
                  <select data-testid="quote-discount-type" value={newQuote.discount_type} onChange={(e) => setNewQuote({ ...newQuote, discount_type: e.target.value })} className="form-input w-28">
                    <option value="amount">ر.س</option>
                    <option value="percentage">%</option>
                  </select>
                </div>
              </div>

              <div>
                <Label className="form-label">ملاحظات</Label>
                <Input data-testid="quote-notes" placeholder="ملاحظات (اختياري)" value={newQuote.notes} onChange={(e) => setNewQuote({ ...newQuote, notes: e.target.value })} className="form-input" />
              </div>
            </div>

            {/* Right: Items */}
            <div className="space-y-4">
              <h3 className="font-semibold">المنتجات والخدمات</h3>

              <div className="space-y-2">
                <div className="flex gap-2">
                  <select data-testid="quote-product-select" value={selectedProduct?.id || ""} onChange={(e) => { const p = products.find((pr) => pr.id === e.target.value); setSelectedProduct(p); setCustomPrice(p ? p.price.toString() : ""); }} className="form-input flex-1">
                    <option value="">اختر منتج...</option>
                    {products.map((product) => (<option key={product.id} value={product.id}>{product.name} - {formatCurrency(product.price)}</option>))}
                  </select>
                </div>
                {selectedProduct && (
                  <div className="flex gap-2 items-center">
                    <Input data-testid="quote-custom-price" type="number" min="0" step="0.01" placeholder="السعر" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} className="form-input flex-1" />
                    <Button onClick={addProductToQuote} className="btn btn-primary"><Plus size={18} className="me-1" />إضافة</Button>
                  </div>
                )}
              </div>

              <div className="p-4 bg-[hsl(var(--muted)/0.3)] rounded-xl space-y-3">
                <p className="text-sm font-medium">إضافة يدوي</p>
                <Input data-testid="quote-manual-item-name" placeholder="اسم المنتج أو الخدمة" value={manualItem.name} onChange={(e) => setManualItem({ ...manualItem, name: e.target.value })} className="form-input" />
                <div className="grid grid-cols-3 gap-2">
                  <Input data-testid="quote-manual-item-qty" type="number" min="1" placeholder="الكمية" value={manualItem.quantity} onChange={(e) => setManualItem({ ...manualItem, quantity: parseInt(e.target.value) || 1 })} className="form-input" />
                  <Input data-testid="quote-manual-item-price" type="number" min="0" step="0.01" placeholder="السعر" value={manualItem.price || ""} onChange={(e) => setManualItem({ ...manualItem, price: parseFloat(e.target.value) || 0 })} className="form-input" />
                  <Button onClick={addManualItem} variant="outline" className="h-10"><Plus size={18} /></Button>
                </div>
              </div>

              <div className="space-y-2 max-h-52 overflow-y-auto">
                {newQuote.items.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 bg-white border border-[hsl(var(--border))] rounded-xl">
                    <div className="flex-1 min-w-0"><p className="font-medium text-sm truncate">{item.product_name}</p></div>
                    <Input type="number" min="1" value={item.quantity} onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 1)} className="w-14 h-8 text-center text-sm" />
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">x</span>
                    <Input type="number" min="0" step="0.01" value={item.price} onChange={(e) => updateItemPrice(index, parseFloat(e.target.value) || 0)} className="w-20 h-8 text-center text-sm" />
                    <span className="font-semibold text-sm w-20 text-left">{formatCurrency(item.total)}</span>
                    <Button variant="ghost" size="sm" onClick={() => removeItem(index)} className="h-8 w-8 p-0 text-[hsl(var(--destructive))]"><Trash2 size={16} /></Button>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-[hsl(var(--muted)/0.3)] rounded-xl space-y-2 text-sm">
                <div className="flex justify-between"><span>المجموع:</span><span>{formatCurrency(subtotal)}</span></div>
                {newQuote.discount > 0 && (<div className="flex justify-between text-red-600"><span>الخصم:</span><span>- {formatCurrency(discountAmount)}</span></div>)}
                {settings?.vat_enabled && (<div className="flex justify-between"><span>الضريبة ({settings.vat_rate}%):</span><span>{formatCurrency(vatAmount)}</span></div>)}
                <div className="flex justify-between font-bold text-base pt-2 border-t border-[hsl(var(--border))]">
                  <span>الإجمالي:</span><span className="text-[hsl(var(--primary))]">{formatCurrency(total)}</span>
                </div>
              </div>

              <Button data-testid="submit-quote-btn" onClick={handleSubmitQuote} disabled={newQuote.items.length === 0} className="w-full btn btn-primary h-12">
                {isEditMode ? "حفظ التعديلات" : "إنشاء عرض السعر"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Quote Modal */}
      {selectedQuote && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto py-6 px-4" onClick={() => setSelectedQuote(null)}>
          <div className="bg-[hsl(var(--muted))] rounded-2xl shadow-2xl w-full max-w-[850px] my-auto" onClick={(e) => e.stopPropagation()}>
            {/* Action Bar */}
            <div className="sticky top-0 z-10 bg-white rounded-t-2xl border-b border-[hsl(var(--border))] px-6 py-3 flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ fontFamily: "'Tajawal', sans-serif" }}>معاينة عرض السعر</h2>
              <div className="flex items-center gap-2 flex-wrap">
                {selectedQuote.status !== "converted" && (
                  <>
                    <Button data-testid="edit-from-view-quote-btn" onClick={() => handleEditQuote(selectedQuote)} variant="outline" size="sm"><Pencil size={16} className="me-1" />تحرير</Button>
                    <Button data-testid="convert-from-view-btn" onClick={() => handleConvertToInvoice(selectedQuote.id)} className="bg-[hsl(var(--primary))] text-white" size="sm"><ArrowLeftRight size={16} className="me-1" />تحويل لفاتورة</Button>
                    {selectedQuote.status === "draft" && (
                      <Button onClick={() => handleUpdateStatus(selectedQuote.id, "sent")} variant="outline" size="sm"><Send size={16} className="me-1" />مرسل</Button>
                    )}
                    {selectedQuote.status === "sent" && (
                      <>
                        <Button onClick={() => handleUpdateStatus(selectedQuote.id, "accepted")} className="bg-green-600 hover:bg-green-700 text-white" size="sm"><CheckCircle size={16} className="me-1" />مقبول</Button>
                        <Button onClick={() => handleUpdateStatus(selectedQuote.id, "rejected")} variant="destructive" size="sm"><XCircle size={16} className="me-1" />مرفوض</Button>
                      </>
                    )}
                  </>
                )}
                <Button data-testid="download-quote-pdf-btn" onClick={handleDownloadPDF} variant="outline" size="sm"><Download size={16} className="me-1" />PDF</Button>
                <Button data-testid="print-quote-btn" onClick={handlePrint} className="btn btn-primary" size="sm"><Printer size={16} /></Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedQuote(null)}><X size={18} /></Button>
              </div>
            </div>

            {/* A4 Quote Template */}
            <div className="p-6 flex justify-center">
              <div ref={printRef} dir="rtl" className="bg-white shadow-lg w-full" style={{ maxWidth: "794px", minHeight: "600px", padding: "40px", fontFamily: "'IBM Plex Sans Arabic', sans-serif", fontSize: "14px", lineHeight: "1.8" }}>
                
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "30px", paddingBottom: "20px", borderBottom: `3px solid ${settings?.primary_color || "#0F5132"}` }}>
                  <div style={{ flex: "1" }}>
                    {settings?.show_logo && settings?.company_logo && (
                      <img src={settings.company_logo} alt="شعار الشركة" style={{ height: "70px", objectFit: "contain", marginBottom: "12px" }} onError={(e) => (e.target.style.display = "none")} />
                    )}
                    <h1 style={{ fontSize: "22px", fontWeight: "700", color: settings?.primary_color || "#0F5132", marginBottom: "6px" }}>{settings?.company_name}</h1>
                    {settings?.company_address && <p style={{ fontSize: "13px", color: "#6b7280", margin: "2px 0" }}>{settings.company_address}</p>}
                    {settings?.company_phone && <p style={{ fontSize: "13px", color: "#6b7280", margin: "2px 0", direction: "ltr", textAlign: "right" }}>{settings.company_phone}</p>}
                    {settings?.company_cr_number && <p style={{ fontSize: "13px", color: "#6b7280", margin: "2px 0" }}>س.ت: {settings.company_cr_number}</p>}
                    {settings?.vat_enabled && settings?.company_vat_number && <p style={{ fontSize: "13px", color: "#6b7280", margin: "2px 0" }}>الرقم الضريبي: {settings.company_vat_number}</p>}
                  </div>
                  <div style={{ textAlign: "left", minWidth: "220px" }}>
                    <h2 style={{ fontSize: "26px", fontWeight: "700", color: settings?.primary_color || "#0F5132", marginBottom: "10px" }}>عرض سعر</h2>
                    <table style={{ fontSize: "13px", marginLeft: "auto" }}>
                      <tbody>
                        <tr><td style={{ color: "#9ca3af", paddingLeft: "12px" }}>رقم العرض:</td><td style={{ fontWeight: "600" }}>{selectedQuote.quote_number}</td></tr>
                        <tr><td style={{ color: "#9ca3af", paddingLeft: "12px" }}>التاريخ:</td><td style={{ fontWeight: "600" }}>{formatDate(selectedQuote.created_at)}</td></tr>
                        <tr><td style={{ color: "#9ca3af", paddingLeft: "12px" }}>صالح حتى:</td><td style={{ fontWeight: "600" }}>{formatDate(selectedQuote.valid_until)}</td></tr>
                      </tbody>
                    </table>
                    <span style={{ display: "inline-block", marginTop: "8px", padding: "2px 12px", borderRadius: "9999px", fontSize: "12px", fontWeight: "500", backgroundColor: selectedQuote.status === "converted" ? "#f3e8ff" : selectedQuote.status === "accepted" ? "#dcfce7" : selectedQuote.status === "rejected" ? "#fee2e2" : selectedQuote.status === "sent" ? "#dbeafe" : "#f3f4f6", color: selectedQuote.status === "converted" ? "#7c3aed" : selectedQuote.status === "accepted" ? "#16a34a" : selectedQuote.status === "rejected" ? "#dc2626" : selectedQuote.status === "sent" ? "#2563eb" : "#374151" }}>
                      {(STATUS_MAP[selectedQuote.status] || STATUS_MAP.draft).label}
                    </span>
                  </div>
                </div>

                {/* Customer Box */}
                <div style={{ marginBottom: "24px", padding: "16px 20px", borderRadius: "8px", backgroundColor: `${settings?.primary_color || "#0F5132"}08`, border: `1px solid ${settings?.primary_color || "#0F5132"}20` }}>
                  <p style={{ fontSize: "11px", color: "#9ca3af", marginBottom: "4px" }}>معلومات العميل</p>
                  <p style={{ fontSize: "16px", fontWeight: "600" }}>{selectedQuote.customer_name}</p>
                  {selectedQuote.customer_phone && <p style={{ fontSize: "13px", color: "#6b7280", direction: "ltr", textAlign: "right" }}>{selectedQuote.customer_phone}</p>}
                </div>

                {/* Items Table */}
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "24px" }}>
                  <thead>
                    <tr style={{ backgroundColor: settings?.primary_color || "#0F5132", color: "white" }}>
                      <th style={{ padding: "10px 14px", textAlign: "right", fontSize: "13px", fontWeight: "600", borderRadius: "0 6px 0 0" }}>م</th>
                      <th style={{ padding: "10px 14px", textAlign: "right", fontSize: "13px", fontWeight: "600" }}>البيان</th>
                      <th style={{ padding: "10px 14px", textAlign: "center", fontSize: "13px", fontWeight: "600" }}>الكمية</th>
                      <th style={{ padding: "10px 14px", textAlign: "center", fontSize: "13px", fontWeight: "600" }}>سعر الوحدة</th>
                      <th style={{ padding: "10px 14px", textAlign: "left", fontSize: "13px", fontWeight: "600", borderRadius: "6px 0 0 0" }}>المجموع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedQuote.items.map((item, index) => (
                      <tr key={index} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "12px 14px", fontSize: "13px", color: "#9ca3af" }}>{index + 1}</td>
                        <td style={{ padding: "12px 14px", fontWeight: "500" }}>{item.product_name}</td>
                        <td style={{ padding: "12px 14px", textAlign: "center" }}>{item.quantity}</td>
                        <td style={{ padding: "12px 14px", textAlign: "center" }}>{formatCurrency(item.price)}</td>
                        <td style={{ padding: "12px 14px", textAlign: "left", fontWeight: "600" }}>{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "24px" }}>
                  <div style={{ width: "300px" }}>
                    <div style={{ padding: "4px 0", display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f3f4f6" }}>
                      <span style={{ color: "#6b7280" }}>المجموع الفرعي:</span>
                      <span style={{ fontWeight: "500" }}>{formatCurrency(selectedQuote.subtotal)}</span>
                    </div>
                    {selectedQuote.discount > 0 && (
                      <div style={{ padding: "4px 0", display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f3f4f6", color: "#dc2626" }}>
                        <span>الخصم:</span><span>- {formatCurrency(selectedQuote.discount)}</span>
                      </div>
                    )}
                    {settings?.vat_enabled && selectedQuote.vat_amount > 0 && (
                      <div style={{ padding: "4px 0", display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f3f4f6" }}>
                        <span style={{ color: "#6b7280" }}>ضريبة القيمة المضافة ({settings.vat_rate}%):</span>
                        <span style={{ fontWeight: "500" }}>{formatCurrency(selectedQuote.vat_amount)}</span>
                      </div>
                    )}
                    <div style={{ padding: "10px 0", display: "flex", justifyContent: "space-between", fontSize: "18px", fontWeight: "700", color: settings?.primary_color || "#0F5132", borderTop: "2px solid " + (settings?.primary_color || "#0F5132"), marginTop: "6px" }}>
                      <span>الإجمالي:</span><span>{formatCurrency(selectedQuote.total)}</span>
                    </div>
                  </div>
                </div>

                {selectedQuote.notes && (
                  <div style={{ marginBottom: "16px", padding: "12px 16px", backgroundColor: "#fefce8", borderRadius: "8px", fontSize: "13px" }}>
                    <span style={{ fontWeight: "600" }}>ملاحظات: </span>{selectedQuote.notes}
                  </div>
                )}

                {settings?.invoice_terms && (
                  <div style={{ marginBottom: "16px", padding: "12px 16px", backgroundColor: "#f9fafb", borderRadius: "8px", fontSize: "12px", color: "#6b7280" }}>
                    <p style={{ fontWeight: "600", color: "#374151", marginBottom: "4px" }}>الشروط والأحكام:</p>
                    <p style={{ whiteSpace: "pre-line" }}>{settings.invoice_terms}</p>
                  </div>
                )}

                <div style={{ textAlign: "center", paddingTop: "16px", borderTop: "1px solid #e5e7eb" }}>
                  <p style={{ fontSize: "13px", color: "#9ca3af" }}>{settings?.invoice_footer || "شكراً لتعاملكم معنا"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
