import { useState, useEffect } from "react";
import axios from "axios";
import { API } from "../App";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Package,
  AlertTriangle,
  Wrench,
  RefreshCw,
} from "lucide-react";

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    price: "",
    stock: "",
    category: "",
    description: "",
    product_type: "product",
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API}/products`);
      setProducts(response.data);
    } catch (error) {
      toast.error("فشل تحميل المنتجات");
    } finally {
      setLoading(false);
    }
  };

  const generateSKU = async () => {
    try {
      const response = await axios.get(`${API}/products/generate-sku`);
      setFormData({ ...formData, sku: response.data.sku });
    } catch (error) {
      // Fallback to local generation
      const sku = `SKU-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      setFormData({ ...formData, sku });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const productData = {
        ...formData,
        price: parseFloat(formData.price),
        stock: formData.product_type === "service" ? 999999 : parseInt(formData.stock),
      };

      if (editingProduct) {
        await axios.put(`${API}/products/${editingProduct.id}`, productData);
        toast.success("تم تحديث المنتج بنجاح");
      } else {
        await axios.post(`${API}/products`, productData);
        toast.success("تم إضافة المنتج بنجاح");
      }

      setIsDialogOpen(false);
      resetForm();
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.detail || "حدث خطأ");
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku,
      price: product.price.toString(),
      stock: product.stock.toString(),
      category: product.category,
      description: product.description,
      product_type: product.product_type || "product",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (productId) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا المنتج؟")) return;

    try {
      await axios.delete(`${API}/products/${productId}`);
      toast.success("تم حذف المنتج بنجاح");
      fetchProducts();
    } catch (error) {
      toast.error("فشل حذف المنتج");
    }
  };

  const resetForm = () => {
    setEditingProduct(null);
    setFormData({
      name: "",
      sku: "",
      price: "",
      stock: "",
      category: "",
      description: "",
      product_type: "product",
    });
  };

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("ar-SA", {
      style: "currency",
      currency: "SAR",
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-100px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[hsl(var(--primary))] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div data-testid="products-page">
      <header className="page-header">
        <h1 className="page-title">المنتجات والخدمات</h1>
        <Button
          data-testid="add-product-btn"
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
          className="btn btn-primary"
        >
          <Plus size={20} />
          إضافة منتج/خدمة
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
              data-testid="product-search-input"
              type="text"
              placeholder="البحث عن منتج أو خدمة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input pe-10"
            />
          </div>
        </div>

        {/* Products Table */}
        {filteredProducts.length > 0 ? (
          <div className="bg-white rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[hsl(var(--muted)/0.3)]">
                    <th className="text-right p-4 font-medium text-[hsl(var(--muted-foreground))] text-sm">
                      المنتج/الخدمة
                    </th>
                    <th className="text-right p-4 font-medium text-[hsl(var(--muted-foreground))] text-sm">
                      الرمز
                    </th>
                    <th className="text-right p-4 font-medium text-[hsl(var(--muted-foreground))] text-sm">
                      النوع
                    </th>
                    <th className="text-right p-4 font-medium text-[hsl(var(--muted-foreground))] text-sm">
                      التصنيف
                    </th>
                    <th className="text-right p-4 font-medium text-[hsl(var(--muted-foreground))] text-sm">
                      السعر
                    </th>
                    <th className="text-right p-4 font-medium text-[hsl(var(--muted-foreground))] text-sm">
                      المخزون
                    </th>
                    <th className="text-right p-4 font-medium text-[hsl(var(--muted-foreground))] text-sm">
                      الإجراءات
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <tr
                      key={product.id}
                      data-testid={`product-row-${product.id}`}
                      className="border-t border-[hsl(var(--border))] hover:bg-[hsl(var(--muted)/0.3)]"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            product.product_type === "service" 
                              ? "bg-[hsl(var(--accent)/0.1)]" 
                              : "bg-[hsl(var(--muted))]"
                          }`}>
                            {product.product_type === "service" ? (
                              <Wrench size={20} className="text-[hsl(var(--accent))]" />
                            ) : (
                              <Package size={20} className="text-[hsl(var(--muted-foreground))]" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{product.name}</p>
                            {product.description && (
                              <p className="text-sm text-[hsl(var(--muted-foreground))] truncate max-w-[200px]">
                                {product.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-sm">{product.sku}</td>
                      <td className="p-4">
                        <span className={`badge ${
                          product.product_type === "service" 
                            ? "badge-success" 
                            : "bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]"
                        }`}>
                          {product.product_type === "service" ? "خدمة" : "منتج"}
                        </span>
                      </td>
                      <td className="p-4">
                        {product.category ? (
                          <span className="text-sm">{product.category}</span>
                        ) : (
                          <span className="text-[hsl(var(--muted-foreground))]">-</span>
                        )}
                      </td>
                      <td className="p-4 font-semibold">{formatCurrency(product.price)}</td>
                      <td className="p-4">
                        {product.product_type === "service" ? (
                          <span className="text-[hsl(var(--muted-foreground))]">-</span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1.5 ${
                              product.stock < 10
                                ? "text-[hsl(var(--warning))]"
                                : product.stock === 0
                                ? "text-[hsl(var(--destructive))]"
                                : "text-[hsl(var(--success))]"
                            }`}
                          >
                            {product.stock < 10 && product.stock > 0 && (
                              <AlertTriangle size={16} />
                            )}
                            {product.stock}
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Button
                            data-testid={`edit-product-${product.id}`}
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(product)}
                            className="h-9 w-9 p-0"
                          >
                            <Pencil size={16} />
                          </Button>
                          <Button
                            data-testid={`delete-product-${product.id}`}
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(product.id)}
                            className="h-9 w-9 p-0 text-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.1)]"
                          >
                            <Trash2 size={16} />
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
            <Package
              size={48}
              className="mx-auto mb-4 text-[hsl(var(--muted-foreground))] opacity-50"
            />
            <p className="text-[hsl(var(--muted-foreground))] mb-4">
              {searchQuery ? "لا توجد منتجات مطابقة للبحث" : "لا توجد منتجات بعد"}
            </p>
            {!searchQuery && (
              <Button
                data-testid="add-first-product-btn"
                onClick={() => {
                  resetForm();
                  setIsDialogOpen(true);
                }}
                className="btn btn-primary"
              >
                <Plus size={20} />
                إضافة أول منتج
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Tajawal', sans-serif" }}>
              {editingProduct ? "تعديل المنتج" : "إضافة منتج/خدمة جديد"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {/* Product Type */}
            <div className="form-group">
              <Label className="form-label">النوع</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  data-testid="type-product-btn"
                  onClick={() => setFormData({ ...formData, product_type: "product" })}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-colors ${
                    formData.product_type === "product"
                      ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)]"
                      : "border-[hsl(var(--border))]"
                  }`}
                >
                  <Package size={18} />
                  <span>منتج</span>
                </button>
                <button
                  type="button"
                  data-testid="type-service-btn"
                  onClick={() => setFormData({ ...formData, product_type: "service", stock: "999999" })}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-colors ${
                    formData.product_type === "service"
                      ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.05)]"
                      : "border-[hsl(var(--border))]"
                  }`}
                >
                  <Wrench size={18} />
                  <span>خدمة</span>
                </button>
              </div>
            </div>

            <div className="form-group">
              <Label htmlFor="name" className="form-label">
                {formData.product_type === "service" ? "اسم الخدمة" : "اسم المنتج"} *
              </Label>
              <Input
                id="name"
                data-testid="product-name-input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="form-input"
                placeholder={formData.product_type === "service" ? "مثال: صيانة دورية" : "مثال: هاتف آيفون"}
                required
              />
            </div>

            <div className="form-group">
              <Label htmlFor="sku" className="form-label">
                رمز المنتج (SKU)
              </Label>
              <div className="flex gap-2">
                <Input
                  id="sku"
                  data-testid="product-sku-input"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  className="form-input flex-1"
                  placeholder="اتركه فارغاً للتوليد التلقائي"
                  disabled={!!editingProduct}
                />
                {!editingProduct && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={generateSKU}
                    data-testid="generate-sku-btn"
                    className="px-3"
                  >
                    <RefreshCw size={18} />
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <Label htmlFor="price" className="form-label">
                  السعر (ر.س) *
                </Label>
                <Input
                  id="price"
                  data-testid="product-price-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="form-input"
                  required
                />
              </div>

              {formData.product_type === "product" && (
                <div className="form-group">
                  <Label htmlFor="stock" className="form-label">
                    المخزون *
                  </Label>
                  <Input
                    id="stock"
                    data-testid="product-stock-input"
                    type="number"
                    min="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>
              )}

              <div className={`form-group ${formData.product_type === "service" ? "col-span-1" : ""}`}>
                <Label htmlFor="category" className="form-label">
                  التصنيف
                </Label>
                <Input
                  id="category"
                  data-testid="product-category-input"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="form-input"
                  placeholder={formData.product_type === "service" ? "مثال: صيانة" : "مثال: إلكترونيات"}
                />
              </div>
            </div>

            <div className="form-group">
              <Label htmlFor="description" className="form-label">
                الوصف
              </Label>
              <textarea
                id="description"
                data-testid="product-description-input"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="form-input min-h-[80px] resize-none"
                placeholder="وصف المنتج أو الخدمة (اختياري)"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                data-testid="save-product-btn"
                className="btn btn-primary flex-1"
              >
                {editingProduct ? "حفظ التعديلات" : "إضافة"}
              </Button>
              <Button
                type="button"
                data-testid="cancel-product-btn"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="btn btn-secondary"
              >
                إلغاء
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
