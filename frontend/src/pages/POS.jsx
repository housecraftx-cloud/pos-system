import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { API, useSettings } from "../App";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { QRCodeSVG } from "qrcode.react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CreditCard,
  Banknote,
  Printer,
  X,
  Package,
  Check,
} from "lucide-react";

export default function POS() {
  const { settings } = useSettings();
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [showInvoice, setShowInvoice] = useState(false);
  const [lastInvoice, setLastInvoice] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const printRef = useRef();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [productsRes, customersRes] = await Promise.all([
        axios.get(`${API}/products`),
        axios.get(`${API}/customers`),
      ]);
      setProducts(productsRes.data);
      setCustomers(customersRes.data);
    } catch (error) {
      toast.error("فشل تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product) => {
    if (product.stock === 0) {
      toast.error("المنتج غير متوفر في المخزون");
      return;
    }

    const existingItem = cart.find((item) => item.product_id === product.id);
    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        toast.error("لا يوجد كمية كافية في المخزون");
        return;
      }
      setCart(
        cart.map((item) =>
          item.product_id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                total: (item.quantity + 1) * item.price,
              }
            : item
        )
      );
    } else {
      setCart([
        ...cart,
        {
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          price: product.price,
          total: product.price,
          max_stock: product.stock,
        },
      ]);
    }
  };

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity < 1) {
      removeFromCart(productId);
      return;
    }

    const item = cart.find((i) => i.product_id === productId);
    if (item && newQuantity > item.max_stock) {
      toast.error("لا يوجد كمية كافية في المخزون");
      return;
    }

    setCart(
      cart.map((item) =>
        item.product_id === productId
          ? { ...item, quantity: newQuantity, total: newQuantity * item.price }
          : item
      )
    );
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter((item) => item.product_id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setNotes("");
  };

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const vatAmount = settings?.vat_enabled ? subtotal * (settings.vat_rate / 100) : 0;
  const total = subtotal + vatAmount;

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error("السلة فارغة");
      return;
    }

    setProcessingPayment(true);
    try {
      const invoiceData = {
        customer_id: selectedCustomer?.id || null,
        customer_name: selectedCustomer?.name || "عميل نقدي",
        items: cart.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
        })),
        payment_method: paymentMethod,
        notes: notes,
      };

      const response = await axios.post(`${API}/invoices`, invoiceData);
      setLastInvoice(response.data);
      setShowInvoice(true);
      toast.success("تم إنشاء الفاتورة بنجاح");
      clearCart();
      fetchData(); // Refresh product stock
    } catch (error) {
      toast.error(error.response?.data?.detail || "فشل إنشاء الفاتورة");
    } finally {
      setProcessingPayment(false);
    }
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    const printWindow = window.open("", "", "width=400,height=600");
    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>فاتورة ${lastInvoice?.invoice_number}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'IBM Plex Sans Arabic', sans-serif; padding: 20px; font-size: 12px; }
            .header { text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px dashed #ccc; }
            .company-name { font-size: 20px; font-weight: 700; margin-bottom: 5px; }
            .info { font-size: 11px; color: #666; }
            .invoice-info { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 11px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            th, td { padding: 8px 4px; text-align: right; font-size: 11px; }
            th { border-bottom: 1px solid #ccc; font-weight: 600; }
            .totals { border-top: 2px dashed #ccc; padding-top: 10px; }
            .total-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
            .grand-total { font-weight: 700; font-size: 14px; padding-top: 8px; border-top: 1px solid #ccc; }
            .qr { text-align: center; margin: 20px 0; }
            .footer { text-align: center; font-size: 10px; color: #666; padding-top: 15px; border-top: 2px dashed #ccc; }
          </style>
        </head>
        <body>${printContent.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
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

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-100px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[hsl(var(--primary))] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div data-testid="pos-page">
      <header className="page-header">
        <h1 className="page-title">نقطة البيع</h1>
        {settings?.vat_enabled && (
          <span className="badge badge-success">
            ضريبة القيمة المضافة {settings.vat_rate}%
          </span>
        )}
      </header>

      <div className="page-content">
        <div className="pos-container">
          {/* Products Section */}
          <div className="flex flex-col">
            {/* Search */}
            <div className="mb-4">
              <div className="relative">
                <Search
                  size={20}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
                />
                <Input
                  data-testid="pos-search-input"
                  type="text"
                  placeholder="البحث عن منتج..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input pe-10"
                />
              </div>
            </div>

            {/* Products Grid */}
            <div className="products-grid flex-1 overflow-y-auto">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    data-testid={`pos-product-${product.id}`}
                    onClick={() => addToCart(product)}
                    className={`product-card ${
                      product.stock === 0 ? "out-of-stock" : ""
                    }`}
                  >
                    <div className="w-full h-24 rounded-xl bg-[hsl(var(--muted))] mb-3 flex items-center justify-center">
                      <Package size={32} className="text-[hsl(var(--muted-foreground))]" />
                    </div>
                    <h3 className="font-semibold text-sm mb-1 truncate">
                      {product.name}
                    </h3>
                    <p className="text-[hsl(var(--primary))] font-bold">
                      {formatCurrency(product.price)}
                    </p>
                    <p
                      className={`text-xs mt-1 ${
                        product.stock < 10
                          ? "text-[hsl(var(--warning))]"
                          : "text-[hsl(var(--muted-foreground))]"
                      }`}
                    >
                      المخزون: {product.stock}
                    </p>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-12 text-[hsl(var(--muted-foreground))]">
                  <Package size={48} className="mx-auto mb-4 opacity-50" />
                  <p>لا توجد منتجات</p>
                </div>
              )}
            </div>
          </div>

          {/* Cart Section */}
          <div className="cart-panel">
            <div className="cart-header">
              <div className="flex items-center justify-between">
                <h2
                  className="font-bold text-lg flex items-center gap-2"
                  style={{ fontFamily: "'Tajawal', sans-serif" }}
                >
                  <ShoppingCart size={20} />
                  السلة
                  {cart.length > 0 && (
                    <span className="bg-[hsl(var(--primary))] text-white text-xs px-2 py-0.5 rounded-full">
                      {cart.length}
                    </span>
                  )}
                </h2>
                {cart.length > 0 && (
                  <Button
                    data-testid="clear-cart-btn"
                    variant="ghost"
                    size="sm"
                    onClick={clearCart}
                    className="text-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.1)]"
                  >
                    <Trash2 size={16} />
                  </Button>
                )}
              </div>

              {/* Customer Selection */}
              <div className="mt-3">
                <select
                  data-testid="customer-select"
                  value={selectedCustomer?.id || ""}
                  onChange={(e) => {
                    const customer = customers.find((c) => c.id === e.target.value);
                    setSelectedCustomer(customer || null);
                  }}
                  className="form-input text-sm"
                >
                  <option value="">عميل نقدي</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Cart Items */}
            <div className="cart-items">
              {cart.length > 0 ? (
                cart.map((item) => (
                  <div key={item.product_id} className="cart-item" data-testid={`cart-item-${item.product_id}`}>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.product_name}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        {formatCurrency(item.price)} × {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-white rounded-lg border border-[hsl(var(--border))]">
                        <button
                          data-testid={`decrease-qty-${item.product_id}`}
                          onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                          className="p-1.5 hover:bg-[hsl(var(--muted))] rounded-r-lg"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-8 text-center text-sm font-medium">
                          {item.quantity}
                        </span>
                        <button
                          data-testid={`increase-qty-${item.product_id}`}
                          onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                          className="p-1.5 hover:bg-[hsl(var(--muted))] rounded-l-lg"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <span className="font-semibold text-sm w-20 text-left">
                        {formatCurrency(item.total)}
                      </span>
                      <button
                        data-testid={`remove-item-${item.product_id}`}
                        onClick={() => removeFromCart(item.product_id)}
                        className="p-1.5 text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.1)] rounded-lg"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">
                  <ShoppingCart size={40} className="mx-auto mb-3 opacity-50" />
                  <p className="text-sm">السلة فارغة</p>
                  <p className="text-xs mt-1">اضغط على منتج لإضافته</p>
                </div>
              )}
            </div>

            {/* Cart Footer */}
            <div className="cart-footer">
              {/* Totals */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-[hsl(var(--muted-foreground))]">المجموع الفرعي</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {settings?.vat_enabled && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[hsl(var(--muted-foreground))]">
                      ضريبة القيمة المضافة ({settings.vat_rate}%)
                    </span>
                    <span>{formatCurrency(vatAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-2 border-t border-[hsl(var(--border))]">
                  <span>الإجمالي</span>
                  <span className="text-[hsl(var(--primary))]" data-testid="cart-total">
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>

              {/* Payment Method */}
              <div className="flex gap-2 mb-4">
                <button
                  data-testid="payment-cash-btn"
                  onClick={() => setPaymentMethod("cash")}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-colors ${
                    paymentMethod === "cash"
                      ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)]"
                      : "border-[hsl(var(--border))]"
                  }`}
                >
                  <Banknote size={20} />
                  <span className="font-medium">نقدي</span>
                </button>
                <button
                  data-testid="payment-card-btn"
                  onClick={() => setPaymentMethod("card")}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-colors ${
                    paymentMethod === "card"
                      ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)]"
                      : "border-[hsl(var(--border))]"
                  }`}
                >
                  <CreditCard size={20} />
                  <span className="font-medium">شبكة</span>
                </button>
              </div>

              {/* Notes */}
              <Input
                data-testid="invoice-notes-input"
                type="text"
                placeholder="ملاحظات (اختياري)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="form-input text-sm mb-4"
              />

              {/* Checkout Button */}
              <Button
                data-testid="checkout-btn"
                onClick={handleCheckout}
                disabled={cart.length === 0 || processingPayment}
                className="w-full btn btn-primary h-12 text-base"
              >
                {processingPayment ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span>
                    جاري المعالجة...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Check size={20} />
                    إتمام الدفع - {formatCurrency(total)}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Modal */}
      {showInvoice && lastInvoice && (
        <div className="modal-overlay" onClick={() => setShowInvoice(false)}>
          <div
            className="modal-content max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-xl font-bold"
                style={{ fontFamily: "'Tajawal', sans-serif" }}
              >
                الفاتورة
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  data-testid="print-invoice-btn"
                  onClick={handlePrint}
                  className="btn btn-primary"
                >
                  <Printer size={18} />
                  طباعة
                </Button>
                <Button
                  data-testid="close-invoice-btn"
                  variant="ghost"
                  onClick={() => setShowInvoice(false)}
                >
                  <X size={20} />
                </Button>
              </div>
            </div>

            {/* Printable Invoice */}
            <div ref={printRef} className="invoice-print bg-white">
              <div className="header">
                {settings?.show_logo && settings?.company_logo && (
                  <img
                    src={settings.company_logo}
                    alt="شعار"
                    className="h-12 mx-auto mb-2 object-contain"
                    onError={(e) => (e.target.style.display = "none")}
                  />
                )}
                <div className="company-name" style={{ color: settings?.primary_color || "#0F5132" }}>
                  {settings?.company_name}
                </div>
                <div className="info">{settings?.company_address}</div>
                <div className="info">{settings?.company_phone}</div>
                <div className="info">الرقم الضريبي: {settings?.company_vat_number}</div>
                <div className="mt-2 font-semibold" style={{ color: settings?.primary_color || "#0F5132" }}>
                  {settings?.invoice_header || "فاتورة ضريبية مبسطة"}
                </div>
              </div>

              <div className="invoice-info">
                <div>
                  <strong>رقم الفاتورة:</strong>
                  <br />
                  {lastInvoice.invoice_number}
                </div>
                <div>
                  <strong>التاريخ:</strong>
                  <br />
                  {formatDate(lastInvoice.created_at)}
                </div>
              </div>

              <div className="mb-2">
                <strong>العميل:</strong> {lastInvoice.customer_name}
              </div>

              <table className="invoice-items-table">
                <thead>
                  <tr>
                    <th>المنتج</th>
                    <th>الكمية</th>
                    <th>السعر</th>
                    <th>المجموع</th>
                  </tr>
                </thead>
                <tbody>
                  {lastInvoice.items.map((item, index) => (
                    <tr key={index}>
                      <td>{item.product_name}</td>
                      <td>{item.quantity}</td>
                      <td>{formatCurrency(item.price)}</td>
                      <td>{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="totals">
                <div className="total-row">
                  <span>المجموع الفرعي:</span>
                  <span>{formatCurrency(lastInvoice.subtotal)}</span>
                </div>
                {settings?.vat_enabled && (
                  <div className="total-row">
                    <span>ضريبة القيمة المضافة ({settings.vat_rate}%):</span>
                    <span>{formatCurrency(lastInvoice.vat_amount)}</span>
                  </div>
                )}
                <div className="total-row grand-total" style={{ color: settings?.primary_color || "#0F5132" }}>
                  <span>الإجمالي:</span>
                  <span>{formatCurrency(lastInvoice.total)}</span>
                </div>
              </div>

              <div className="mt-3 text-sm">
                <strong>طريقة الدفع:</strong>{" "}
                {lastInvoice.payment_method === "cash" ? "نقدي" : "شبكة"}
              </div>

              {lastInvoice.notes && (
                <div className="mt-2 text-sm">
                  <strong>ملاحظات:</strong> {lastInvoice.notes}
                </div>
              )}

              <div className="qr">
                <QRCodeSVG value={lastInvoice.qr_data} size={120} />
                <p className="text-xs mt-2 text-[hsl(var(--muted-foreground))]">
                  امسح للتحقق من الفاتورة
                </p>
              </div>

              <div className="footer">
                <p>{settings?.invoice_footer || "شكراً لتعاملكم معنا"}</p>
                <p>فاتورة إلكترونية متوافقة مع ZATCA</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
