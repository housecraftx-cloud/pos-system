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
import { QRCodeSVG } from "qrcode.react";
import {
  Search,
  FileText,
  Eye,
  Printer,
  X,
  CreditCard,
  Banknote,
  Calendar,
  Plus,
  Trash2,
  MessageCircle,
  Download,
  UserPlus,
  Tag,
  Pencil,
} from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function Invoices() {
  const { settings } = useSettings();
  const [invoices, setInvoices] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);
  const printRef = useRef();

  // New invoice state
  const [newInvoice, setNewInvoice] = useState({
    customer_id: null,
    customer_name: "عميل نقدي",
    customer_phone: "",
    items: [],
    payment_method: "cash",
    discount: 0,
    discount_type: "amount",
    invoice_date: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [customerSearch, setCustomerSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [quickCustomer, setQuickCustomer] = useState({ name: "", phone: "" });

  // Manual item state
  const [manualItem, setManualItem] = useState({
    name: "",
    quantity: 1,
    price: 0,
  });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [customPrice, setCustomPrice] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [invoicesRes, productsRes, customersRes] = await Promise.all([
        axios.get(`${API}/invoices`),
        axios.get(`${API}/products`),
        axios.get(`${API}/customers`),
      ]);
      setInvoices(invoicesRes.data);
      setProducts(productsRes.data);
      setCustomers(customersRes.data);
    } catch (error) {
      toast.error("فشل تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  // Search customers
  const handleCustomerSearch = async (query) => {
    setCustomerSearch(query);
    if (query.length >= 2) {
      try {
        const response = await axios.get(`${API}/customers/search?q=${query}`);
        setSearchResults(response.data);
        setShowCustomerDropdown(true);
      } catch (error) {
        console.error("Error searching customers:", error);
      }
    } else {
      setSearchResults([]);
      setShowCustomerDropdown(false);
    }
  };

  const selectCustomer = (customer) => {
    setNewInvoice({
      ...newInvoice,
      customer_id: customer.id,
      customer_name: customer.name,
      customer_phone: customer.phone,
    });
    setCustomerSearch(customer.name);
    setShowCustomerDropdown(false);
  };

  // Quick customer creation
  const handleQuickCustomerCreate = async () => {
    if (!quickCustomer.name || !quickCustomer.phone) {
      toast.error("يرجى إدخال الاسم ورقم الجوال");
      return;
    }
    try {
      const response = await axios.post(`${API}/customers/quick`, quickCustomer);
      setNewInvoice({
        ...newInvoice,
        customer_id: response.data.id,
        customer_name: response.data.name,
        customer_phone: response.data.phone,
      });
      setCustomerSearch(response.data.name);
      setShowQuickCustomer(false);
      setQuickCustomer({ name: "", phone: "" });
      toast.success("تم إضافة العميل بنجاح");
    } catch (error) {
      toast.error("فشل إضافة العميل");
    }
  };

  // Add product to invoice with custom price
  const addProductToInvoice = () => {
    if (!selectedProduct) return;
    const existingItem = newInvoice.items.find(
      (item) => item.product_id === selectedProduct.id && !item.is_manual
    );
    if (existingItem) {
      toast.error("المنتج موجود بالفاتورة مسبقاً");
      return;
    }
    const price = customPrice ? parseFloat(customPrice) : selectedProduct.price;
    setNewInvoice({
      ...newInvoice,
      items: [
        ...newInvoice.items,
        {
          product_id: selectedProduct.id,
          product_name: selectedProduct.name,
          quantity: 1,
          price: price,
          total: price,
          is_manual: false,
        },
      ],
    });
    setSelectedProduct(null);
    setCustomPrice("");
  };

  // Add manual item
  const addManualItem = () => {
    if (!manualItem.name || manualItem.price <= 0) {
      toast.error("يرجى إدخال اسم المنتج والسعر");
      return;
    }
    setNewInvoice({
      ...newInvoice,
      items: [
        ...newInvoice.items,
        {
          product_id: null,
          product_name: manualItem.name,
          quantity: manualItem.quantity,
          price: manualItem.price,
          total: manualItem.quantity * manualItem.price,
          is_manual: true,
        },
      ],
    });
    setManualItem({ name: "", quantity: 1, price: 0 });
  };

  // Update item quantity
  const updateItemQuantity = (index, quantity) => {
    const items = [...newInvoice.items];
    items[index].quantity = quantity;
    items[index].total = quantity * items[index].price;
    setNewInvoice({ ...newInvoice, items });
  };

  // Update item price
  const updateItemPrice = (index, price) => {
    const items = [...newInvoice.items];
    items[index].price = price;
    items[index].total = items[index].quantity * price;
    setNewInvoice({ ...newInvoice, items });
  };

  // Remove item
  const removeItem = (index) => {
    const items = newInvoice.items.filter((_, i) => i !== index);
    setNewInvoice({ ...newInvoice, items });
  };

  // Calculate totals
  const subtotal = newInvoice.items.reduce((sum, item) => sum + item.total, 0);
  const discountAmount = newInvoice.discount_type === "percentage" 
    ? subtotal * (newInvoice.discount / 100) 
    : newInvoice.discount;
  const subtotalAfterDiscount = subtotal - discountAmount;
  const vatAmount = settings?.vat_enabled ? subtotalAfterDiscount * (settings.vat_rate / 100) : 0;
  const total = subtotalAfterDiscount + vatAmount;

  // Create or Update invoice
  const handleSubmitInvoice = async () => {
    if (newInvoice.items.length === 0) {
      toast.error("يرجى إضافة منتج واحد على الأقل");
      return;
    }
    try {
      const invoiceData = {
        ...newInvoice,
        invoice_date: newInvoice.invoice_date ? new Date(newInvoice.invoice_date).toISOString() : null,
      };
      
      let response;
      if (isEditMode && editingInvoiceId) {
        response = await axios.put(`${API}/invoices/${editingInvoiceId}`, invoiceData);
        setInvoices(invoices.map(inv => inv.id === editingInvoiceId ? response.data : inv));
        toast.success("تم تحديث الفاتورة بنجاح");
      } else {
        response = await axios.post(`${API}/invoices`, invoiceData);
        setInvoices([response.data, ...invoices]);
        toast.success("تم إنشاء الفاتورة بنجاح");
      }
      
      setSelectedInvoice(response.data);
      setIsCreateDialogOpen(false);
      resetNewInvoice();
    } catch (error) {
      toast.error(error.response?.data?.detail || "فشل حفظ الفاتورة");
    }
  };

  // Edit invoice
  const handleEditInvoice = (invoice) => {
    setIsEditMode(true);
    setEditingInvoiceId(invoice.id);
    setNewInvoice({
      customer_id: invoice.customer_id,
      customer_name: invoice.customer_name,
      customer_phone: invoice.customer_phone || "",
      items: invoice.items.map(item => ({
        ...item,
        is_manual: item.is_manual || !item.product_id,
      })),
      payment_method: invoice.payment_method,
      discount: invoice.discount || 0,
      discount_type: invoice.discount_type || "amount",
      invoice_date: invoice.created_at ? invoice.created_at.split("T")[0] : new Date().toISOString().split("T")[0],
      notes: invoice.notes || "",
    });
    setCustomerSearch(invoice.customer_name);
    setIsCreateDialogOpen(true);
    setSelectedInvoice(null);
  };

  const resetNewInvoice = () => {
    setNewInvoice({
      customer_id: null,
      customer_name: "عميل نقدي",
      customer_phone: "",
      items: [],
      payment_method: "cash",
      discount: 0,
      discount_type: "amount",
      invoice_date: new Date().toISOString().split("T")[0],
      notes: "",
    });
    setCustomerSearch("");
    setIsEditMode(false);
    setEditingInvoiceId(null);
  };

  // Print invoice
  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const printWindow = window.open("", "", "width=900,height=1200");
    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>فاتورة ${selectedInvoice?.invoice_number}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap');
            @page { size: A4; margin: 8mm; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'IBM Plex Sans Arabic', sans-serif; direction: rtl; line-height: 1.6; color: #1f2937; }
            img { max-width: 100%; }
            table { border-collapse: collapse; }
          </style>
        </head>
        <body>${printContent.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  // Download PDF
  const handleDownloadPDF = async () => {
    const element = printRef.current;
    if (!element) return;

    try {
      // Temporarily expand element to full height for capture
      const originalStyle = element.style.cssText;
      element.style.overflow = "visible";
      element.style.height = "auto";
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#ffffff",
        width: element.scrollWidth,
        height: element.scrollHeight,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      });
      
      element.style.cssText = originalStyle;
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = 190;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      // Handle multi-page if content is taller than A4
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
      
      pdf.save(`فاتورة-${selectedInvoice.invoice_number}.pdf`);
      toast.success("تم تحميل الفاتورة بنجاح");
    } catch (error) {
      console.error("PDF error:", error);
      toast.error("فشل تحميل الفاتورة");
    }
  };

  // Send via WhatsApp
  const handleWhatsApp = () => {
    if (!selectedInvoice.customer_phone) {
      toast.error("لا يوجد رقم هاتف للعميل");
      return;
    }
    const phone = selectedInvoice.customer_phone.replace(/[^0-9]/g, "");
    const message = encodeURIComponent(
      `مرحباً ${selectedInvoice.customer_name},\n\n` +
      `فاتورة رقم: ${selectedInvoice.invoice_number}\n` +
      `المبلغ: ${formatCurrency(selectedInvoice.total)}\n\n` +
      `شكراً لتعاملكم معنا\n${settings?.company_name || ""}`
    );
    window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
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

  const filteredInvoices = invoices.filter(
    (invoice) =>
      invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (invoice.customer_phone && invoice.customer_phone.includes(searchQuery))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-100px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[hsl(var(--primary))] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div data-testid="invoices-page">
      <header className="page-header">
        <h1 className="page-title">الفواتير</h1>
        <Button
          data-testid="create-invoice-btn"
          onClick={() => {
            resetNewInvoice();
            setIsCreateDialogOpen(true);
          }}
          className="btn btn-primary"
        >
          <Plus size={20} />
          إنشاء فاتورة
        </Button>
      </header>

      <div className="page-content">
        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search
              size={20}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
            />
            <Input
              data-testid="invoice-search-input"
              type="text"
              placeholder="البحث برقم الفاتورة أو اسم العميل أو رقم الجوال..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input pe-10"
            />
          </div>
        </div>

        {/* Invoices Table */}
        {filteredInvoices.length > 0 ? (
          <div className="bg-white rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
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
                      الدفع
                    </th>
                    <th className="text-right p-4 font-medium text-[hsl(var(--muted-foreground))] text-sm">
                      التاريخ
                    </th>
                    <th className="text-right p-4 font-medium text-[hsl(var(--muted-foreground))] text-sm">
                      الإجراءات
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      data-testid={`invoice-row-${invoice.id}`}
                      className="border-t border-[hsl(var(--border))] hover:bg-[hsl(var(--muted)/0.3)]"
                    >
                      <td className="p-4 font-mono text-sm">{invoice.invoice_number}</td>
                      <td className="p-4">
                        <div>
                          <p>{invoice.customer_name}</p>
                          {invoice.customer_phone && (
                            <p className="text-xs text-[hsl(var(--muted-foreground))]" dir="ltr">
                              {invoice.customer_phone}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-4 font-semibold">{formatCurrency(invoice.total)}</td>
                      <td className="p-4">
                        {invoice.payment_method === "cash" ? (
                          <Banknote size={18} className="text-[hsl(var(--success))]" />
                        ) : (
                          <CreditCard size={18} className="text-[hsl(var(--primary))]" />
                        )}
                      </td>
                      <td className="p-4 text-sm text-[hsl(var(--muted-foreground))]">
                        {formatDate(invoice.created_at)}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <Button
                            data-testid={`view-invoice-${invoice.id}`}
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedInvoice(invoice)}
                            className="h-8 w-8 p-0"
                          >
                            <Eye size={16} />
                          </Button>
                          <Button
                            data-testid={`edit-invoice-${invoice.id}`}
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditInvoice(invoice)}
                            className="h-8 w-8 p-0"
                          >
                            <Pencil size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[hsl(var(--border))] p-12 text-center">
            <FileText
              size={48}
              className="mx-auto mb-4 text-[hsl(var(--muted-foreground))] opacity-50"
            />
            <p className="text-[hsl(var(--muted-foreground))]">
              {searchQuery ? "لا توجد فواتير مطابقة للبحث" : "لا توجد فواتير بعد"}
            </p>
          </div>
        )}
      </div>

      {/* Create/Edit Invoice Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        if (!open) resetNewInvoice();
        setIsCreateDialogOpen(open);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Tajawal', sans-serif" }}>
              {isEditMode ? "تحرير الفاتورة" : "إنشاء فاتورة جديدة"}
            </DialogTitle>
            <DialogDescription className="sr-only">نموذج إنشاء أو تحرير فاتورة</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
            {/* Customer Section */}
            <div className="space-y-4">
              <h3 className="font-semibold">معلومات الفاتورة</h3>
              
              {/* Invoice Date */}
              <div>
                <Label className="form-label flex items-center gap-2">
                  <Calendar size={16} />
                  تاريخ الفاتورة
                </Label>
                <Input
                  data-testid="invoice-date"
                  type="date"
                  value={newInvoice.invoice_date}
                  onChange={(e) => setNewInvoice({ ...newInvoice, invoice_date: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="relative">
                <Label className="form-label">البحث عن عميل</Label>
                <Input
                  data-testid="customer-search-invoice"
                  type="text"
                  placeholder="ابحث بالاسم أو رقم الجوال..."
                  value={customerSearch}
                  onChange={(e) => handleCustomerSearch(e.target.value)}
                  className="form-input"
                />
                {showCustomerDropdown && searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-[hsl(var(--border))] rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {searchResults.map((customer) => (
                      <button
                        key={customer.id}
                        onClick={() => selectCustomer(customer)}
                        className="w-full p-3 text-right hover:bg-[hsl(var(--muted))] flex justify-between items-center"
                      >
                        <span>{customer.name}</span>
                        <span className="text-sm text-[hsl(var(--muted-foreground))]" dir="ltr">
                          {customer.phone}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => setShowQuickCustomer(!showQuickCustomer)}
                className="w-full"
              >
                <UserPlus size={18} className="me-2" />
                إضافة عميل جديد سريع
              </Button>

              {showQuickCustomer && (
                <div className="p-4 bg-[hsl(var(--muted)/0.3)] rounded-xl space-y-3">
                  <Input
                    data-testid="quick-customer-name"
                    placeholder="اسم العميل"
                    value={quickCustomer.name}
                    onChange={(e) => setQuickCustomer({ ...quickCustomer, name: e.target.value })}
                    className="form-input"
                  />
                  <Input
                    data-testid="quick-customer-phone"
                    placeholder="رقم الجوال"
                    dir="ltr"
                    value={quickCustomer.phone}
                    onChange={(e) => setQuickCustomer({ ...quickCustomer, phone: e.target.value })}
                    className="form-input text-left"
                  />
                  <Button onClick={handleQuickCustomerCreate} className="w-full btn btn-primary">
                    حفظ العميل
                  </Button>
                </div>
              )}

              {newInvoice.customer_name !== "عميل نقدي" && (
                <div className="p-3 bg-[hsl(var(--success)/0.1)] rounded-xl">
                  <p className="font-medium">{newInvoice.customer_name}</p>
                  {newInvoice.customer_phone && (
                    <p className="text-sm text-[hsl(var(--muted-foreground))]" dir="ltr">
                      {newInvoice.customer_phone}
                    </p>
                  )}
                </div>
              )}

              {/* Payment Method */}
              <div>
                <Label className="form-label">طريقة الدفع</Label>
                <div className="flex gap-2">
                  <button
                    data-testid="payment-cash"
                    onClick={() => setNewInvoice({ ...newInvoice, payment_method: "cash" })}
                    className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-colors ${
                      newInvoice.payment_method === "cash"
                        ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)]"
                        : "border-[hsl(var(--border))]"
                    }`}
                  >
                    <Banknote size={20} />
                    <span>نقدي</span>
                  </button>
                  <button
                    data-testid="payment-card"
                    onClick={() => setNewInvoice({ ...newInvoice, payment_method: "card" })}
                    className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-colors ${
                      newInvoice.payment_method === "card"
                        ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)]"
                        : "border-[hsl(var(--border))]"
                    }`}
                  >
                    <CreditCard size={20} />
                    <span>شبكة</span>
                  </button>
                </div>
              </div>

              {/* Discount */}
              <div>
                <Label className="form-label flex items-center gap-2">
                  <Tag size={16} />
                  الخصم
                </Label>
                <div className="flex gap-2">
                  <Input
                    data-testid="discount-value"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={newInvoice.discount || ""}
                    onChange={(e) => setNewInvoice({ ...newInvoice, discount: parseFloat(e.target.value) || 0 })}
                    className="form-input flex-1"
                  />
                  <select
                    data-testid="discount-type"
                    value={newInvoice.discount_type}
                    onChange={(e) => setNewInvoice({ ...newInvoice, discount_type: e.target.value })}
                    className="form-input w-28"
                  >
                    <option value="amount">ر.س</option>
                    <option value="percentage">%</option>
                  </select>
                </div>
              </div>

              <div>
                <Label className="form-label">ملاحظات</Label>
                <Input
                  data-testid="invoice-notes"
                  placeholder="ملاحظات الفاتورة (اختياري)"
                  value={newInvoice.notes}
                  onChange={(e) => setNewInvoice({ ...newInvoice, notes: e.target.value })}
                  className="form-input"
                />
              </div>
            </div>

            {/* Items Section */}
            <div className="space-y-4">
              <h3 className="font-semibold">المنتجات والخدمات</h3>

              {/* Add from products with custom price */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <select
                    data-testid="product-select"
                    value={selectedProduct?.id || ""}
                    onChange={(e) => {
                      const product = products.find((p) => p.id === e.target.value);
                      setSelectedProduct(product);
                      setCustomPrice(product ? product.price.toString() : "");
                    }}
                    className="form-input flex-1"
                  >
                    <option value="">اختر منتج...</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} - {formatCurrency(product.price)}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedProduct && (
                  <div className="flex gap-2 items-center">
                    <Input
                      data-testid="custom-price"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="السعر"
                      value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value)}
                      className="form-input flex-1"
                    />
                    <Button onClick={addProductToInvoice} className="btn btn-primary">
                      <Plus size={18} className="me-1" />
                      إضافة
                    </Button>
                  </div>
                )}
              </div>

              {/* Manual item */}
              <div className="p-4 bg-[hsl(var(--muted)/0.3)] rounded-xl space-y-3">
                <p className="text-sm font-medium">إضافة يدوي</p>
                <Input
                  data-testid="manual-item-name"
                  placeholder="اسم المنتج أو الخدمة"
                  value={manualItem.name}
                  onChange={(e) => setManualItem({ ...manualItem, name: e.target.value })}
                  className="form-input"
                />
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    data-testid="manual-item-qty"
                    type="number"
                    min="1"
                    placeholder="الكمية"
                    value={manualItem.quantity}
                    onChange={(e) => setManualItem({ ...manualItem, quantity: parseInt(e.target.value) || 1 })}
                    className="form-input"
                  />
                  <Input
                    data-testid="manual-item-price"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="السعر"
                    value={manualItem.price || ""}
                    onChange={(e) => setManualItem({ ...manualItem, price: parseFloat(e.target.value) || 0 })}
                    className="form-input"
                  />
                  <Button onClick={addManualItem} variant="outline" className="h-10">
                    <Plus size={18} />
                  </Button>
                </div>
              </div>

              {/* Items list with editable price */}
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {newInvoice.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-3 bg-white border border-[hsl(var(--border))] rounded-xl"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.product_name}</p>
                    </div>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 1)}
                      className="w-14 h-8 text-center text-sm"
                    />
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">×</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.price}
                      onChange={(e) => updateItemPrice(index, parseFloat(e.target.value) || 0)}
                      className="w-20 h-8 text-center text-sm"
                    />
                    <span className="font-semibold text-sm w-20 text-left">{formatCurrency(item.total)}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(index)}
                      className="h-8 w-8 p-0 text-[hsl(var(--destructive))]"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="p-4 bg-[hsl(var(--muted)/0.3)] rounded-xl space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>المجموع:</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {newInvoice.discount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>الخصم:</span>
                    <span>- {formatCurrency(discountAmount)}</span>
                  </div>
                )}
                {settings?.vat_enabled && (
                  <div className="flex justify-between">
                    <span>الضريبة ({settings.vat_rate}%):</span>
                    <span>{formatCurrency(vatAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base pt-2 border-t border-[hsl(var(--border))]">
                  <span>الإجمالي:</span>
                  <span className="text-[hsl(var(--primary))]">{formatCurrency(total)}</span>
                </div>
              </div>

              <Button
                data-testid="submit-invoice-btn"
                onClick={handleSubmitInvoice}
                disabled={newInvoice.items.length === 0}
                className="w-full btn btn-primary h-12"
              >
                {isEditMode ? "حفظ التعديلات" : "إنشاء الفاتورة"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto py-6 px-4" onClick={() => setSelectedInvoice(null)}>
          <div
            className="bg-[hsl(var(--muted))] rounded-2xl shadow-2xl w-full max-w-[850px] my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Action Bar */}
            <div className="sticky top-0 z-10 bg-white rounded-t-2xl border-b border-[hsl(var(--border))] px-6 py-3 flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ fontFamily: "'Tajawal', sans-serif" }}>معاينة الفاتورة</h2>
              <div className="flex items-center gap-2">
                <Button data-testid="edit-from-view-btn" onClick={() => handleEditInvoice(selectedInvoice)} variant="outline" size="sm">
                  <Pencil size={16} className="me-1" />تحرير
                </Button>
                <Button data-testid="download-pdf-btn" onClick={handleDownloadPDF} variant="outline" size="sm">
                  <Download size={16} className="me-1" />PDF
                </Button>
                {selectedInvoice.customer_phone && (
                  <Button data-testid="whatsapp-btn" onClick={handleWhatsApp} className="bg-green-600 hover:bg-green-700 text-white" size="sm">
                    <MessageCircle size={16} className="me-1" />واتساب
                  </Button>
                )}
                <Button data-testid="print-invoice-btn" onClick={handlePrint} className="btn btn-primary" size="sm">
                  <Printer size={16} className="me-1" />طباعة
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedInvoice(null)}><X size={18} /></Button>
              </div>
            </div>

            {/* A4 Invoice Template */}
            <div className="p-6 flex justify-center">
              <div ref={printRef} dir="rtl" className="bg-white shadow-lg w-full" style={{ maxWidth: "794px", minHeight: "600px", padding: "40px", fontFamily: "'IBM Plex Sans Arabic', sans-serif", fontSize: "14px", lineHeight: "1.8" }}>
                
                {/* Header Row: Company Info + Invoice Info */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "30px", paddingBottom: "20px", borderBottom: `3px solid ${settings?.primary_color || "#0F5132"}` }}>
                  {/* Right: Company */}
                  <div style={{ flex: "1" }}>
                    {settings?.show_logo && settings?.company_logo && (
                      <img
                        src={settings.company_logo}
                        alt="شعار الشركة"
                        style={{ height: "70px", objectFit: "contain", marginBottom: "12px" }}
                        onError={(e) => (e.target.style.display = "none")}
                      />
                    )}
                    <h1 style={{ fontSize: "22px", fontWeight: "700", color: settings?.primary_color || "#0F5132", marginBottom: "6px" }}>
                      {settings?.company_name}
                    </h1>
                    {settings?.company_address && <p style={{ fontSize: "13px", color: "#6b7280", margin: "2px 0" }}>{settings.company_address}</p>}
                    {settings?.company_phone && <p style={{ fontSize: "13px", color: "#6b7280", margin: "2px 0", direction: "ltr", textAlign: "right" }}>{settings.company_phone}</p>}
                    {settings?.company_cr_number && <p style={{ fontSize: "13px", color: "#6b7280", margin: "2px 0" }}>س.ت: {settings.company_cr_number}</p>}
                    {settings?.vat_enabled && settings?.company_vat_number && <p style={{ fontSize: "13px", color: "#6b7280", margin: "2px 0" }}>الرقم الضريبي: {settings.company_vat_number}</p>}
                  </div>
                  {/* Left: Invoice Details */}
                  <div style={{ textAlign: "left", minWidth: "220px" }}>
                    <h2 style={{ fontSize: "26px", fontWeight: "700", color: settings?.primary_color || "#0F5132", marginBottom: "10px" }}>
                      {settings?.invoice_header || "فاتورة"}
                    </h2>
                    <table style={{ fontSize: "13px", marginLeft: "auto" }}>
                      <tbody>
                        <tr><td style={{ color: "#9ca3af", paddingLeft: "12px" }}>رقم الفاتورة:</td><td style={{ fontWeight: "600" }}>{selectedInvoice.invoice_number}</td></tr>
                        <tr><td style={{ color: "#9ca3af", paddingLeft: "12px" }}>التاريخ:</td><td style={{ fontWeight: "600" }}>{formatDate(selectedInvoice.created_at)}</td></tr>
                        <tr><td style={{ color: "#9ca3af", paddingLeft: "12px" }}>طريقة الدفع:</td><td style={{ fontWeight: "600" }}>{selectedInvoice.payment_method === "cash" ? "نقدي" : "شبكة"}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Customer Box */}
                <div style={{ marginBottom: "24px", padding: "16px 20px", borderRadius: "8px", backgroundColor: `${settings?.primary_color || "#0F5132"}08`, border: `1px solid ${settings?.primary_color || "#0F5132"}20` }}>
                  <p style={{ fontSize: "11px", color: "#9ca3af", marginBottom: "4px" }}>معلومات العميل</p>
                  <p style={{ fontSize: "16px", fontWeight: "600" }}>{selectedInvoice.customer_name}</p>
                  {selectedInvoice.customer_phone && <p style={{ fontSize: "13px", color: "#6b7280", direction: "ltr", textAlign: "right" }}>{selectedInvoice.customer_phone}</p>}
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
                    {selectedInvoice.items.map((item, index) => (
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

                {/* Totals + QR Section */}
                <div style={{ display: "flex", gap: "30px", marginBottom: "24px", alignItems: "flex-start" }}>
                  {/* QR Code */}
                  <div style={{ flexShrink: 0, padding: "16px", backgroundColor: "#f9fafb", borderRadius: "8px", textAlign: "center" }}>
                    <QRCodeSVG value={selectedInvoice.qr_data} size={120} />
                  </div>

                  {/* Totals */}
                  <div style={{ flex: 1, minWidth: "250px" }}>
                    <div style={{ padding: "4px 0", display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f3f4f6" }}>
                      <span style={{ color: "#6b7280" }}>المجموع الفرعي:</span>
                      <span style={{ fontWeight: "500" }}>{formatCurrency(selectedInvoice.subtotal)}</span>
                    </div>
                    {selectedInvoice.discount > 0 && (
                      <div style={{ padding: "4px 0", display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f3f4f6", color: "#dc2626" }}>
                        <span>الخصم:</span>
                        <span>- {formatCurrency(selectedInvoice.discount)}</span>
                      </div>
                    )}
                    {settings?.vat_enabled && selectedInvoice.vat_amount > 0 && (
                      <div style={{ padding: "4px 0", display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f3f4f6" }}>
                        <span style={{ color: "#6b7280" }}>ضريبة القيمة المضافة ({settings.vat_rate}%):</span>
                        <span style={{ fontWeight: "500" }}>{formatCurrency(selectedInvoice.vat_amount)}</span>
                      </div>
                    )}
                    <div style={{ padding: "10px 0", display: "flex", justifyContent: "space-between", fontSize: "18px", fontWeight: "700", color: settings?.primary_color || "#0F5132", borderTop: "2px solid " + (settings?.primary_color || "#0F5132"), marginTop: "6px" }}>
                      <span>الإجمالي:</span>
                      <span>{formatCurrency(selectedInvoice.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {selectedInvoice.notes && (
                  <div style={{ marginBottom: "16px", padding: "12px 16px", backgroundColor: "#fefce8", borderRadius: "8px", fontSize: "13px" }}>
                    <span style={{ fontWeight: "600" }}>ملاحظات: </span>{selectedInvoice.notes}
                  </div>
                )}

                {/* Terms */}
                {settings?.invoice_terms && (
                  <div style={{ marginBottom: "16px", padding: "12px 16px", backgroundColor: "#f9fafb", borderRadius: "8px", fontSize: "12px", color: "#6b7280" }}>
                    <p style={{ fontWeight: "600", color: "#374151", marginBottom: "4px" }}>الشروط والأحكام:</p>
                    <p style={{ whiteSpace: "pre-line" }}>{settings.invoice_terms}</p>
                  </div>
                )}

                {/* Footer */}
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
