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
  Users,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    vat_number: "",
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const response = await axios.get(`${API}/customers`);
      setCustomers(response.data);
    } catch (error) {
      toast.error("فشل تحميل العملاء");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await axios.put(`${API}/customers/${editingCustomer.id}`, formData);
        toast.success("تم تحديث العميل بنجاح");
      } else {
        await axios.post(`${API}/customers`, formData);
        toast.success("تم إضافة العميل بنجاح");
      }

      setIsDialogOpen(false);
      resetForm();
      fetchCustomers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "حدث خطأ");
    }
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      vat_number: customer.vat_number,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (customerId) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا العميل؟")) return;

    try {
      await axios.delete(`${API}/customers/${customerId}`);
      toast.success("تم حذف العميل بنجاح");
      fetchCustomers();
    } catch (error) {
      toast.error("فشل حذف العميل");
    }
  };

  const resetForm = () => {
    setEditingCustomer(null);
    setFormData({
      name: "",
      phone: "",
      email: "",
      address: "",
      vat_number: "",
    });
  };

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.phone.includes(searchQuery) ||
      customer.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-100px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[hsl(var(--primary))] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div data-testid="customers-page">
      <header className="page-header">
        <h1 className="page-title">العملاء</h1>
        <Button
          data-testid="add-customer-btn"
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
          className="btn btn-primary"
        >
          <Plus size={20} />
          إضافة عميل
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
              data-testid="customer-search-input"
              type="text"
              placeholder="البحث عن عميل..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input pe-10"
            />
          </div>
        </div>

        {/* Customers Grid */}
        {filteredCustomers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                data-testid={`customer-card-${customer.id}`}
                className="bg-white rounded-2xl border border-[hsl(var(--border))] p-6 card-hover"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[hsl(var(--primary)/0.1)] flex items-center justify-center">
                      <span className="text-lg font-bold text-[hsl(var(--primary))]">
                        {customer.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold">{customer.name}</h3>
                      {customer.vat_number && (
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                          الرقم الضريبي: {customer.vat_number}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      data-testid={`edit-customer-${customer.id}`}
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(customer)}
                      className="h-8 w-8 p-0"
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      data-testid={`delete-customer-${customer.id}`}
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(customer.id)}
                      className="h-8 w-8 p-0 text-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.1)]"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {customer.phone && (
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                      <Phone size={14} />
                      <span dir="ltr">{customer.phone}</span>
                    </div>
                  )}
                  {customer.email && (
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                      <Mail size={14} />
                      <span>{customer.email}</span>
                    </div>
                  )}
                  {customer.address && (
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                      <MapPin size={14} />
                      <span className="truncate">{customer.address}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[hsl(var(--border))] p-12 text-center">
            <Users
              size={48}
              className="mx-auto mb-4 text-[hsl(var(--muted-foreground))] opacity-50"
            />
            <p className="text-[hsl(var(--muted-foreground))] mb-4">
              {searchQuery ? "لا يوجد عملاء مطابقين للبحث" : "لا يوجد عملاء بعد"}
            </p>
            {!searchQuery && (
              <Button
                data-testid="add-first-customer-btn"
                onClick={() => {
                  resetForm();
                  setIsDialogOpen(true);
                }}
                className="btn btn-primary"
              >
                <Plus size={20} />
                إضافة أول عميل
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
              {editingCustomer ? "تعديل العميل" : "إضافة عميل جديد"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="form-group">
              <Label htmlFor="name" className="form-label">
                اسم العميل *
              </Label>
              <Input
                id="name"
                data-testid="customer-name-input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="form-input"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <Label htmlFor="phone" className="form-label">
                  رقم الهاتف
                </Label>
                <Input
                  id="phone"
                  data-testid="customer-phone-input"
                  type="tel"
                  dir="ltr"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="form-input text-left"
                  placeholder="+966..."
                />
              </div>

              <div className="form-group">
                <Label htmlFor="email" className="form-label">
                  البريد الإلكتروني
                </Label>
                <Input
                  id="email"
                  data-testid="customer-email-input"
                  type="email"
                  dir="ltr"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="form-input text-left"
                />
              </div>
            </div>

            <div className="form-group">
              <Label htmlFor="vat_number" className="form-label">
                الرقم الضريبي
              </Label>
              <Input
                id="vat_number"
                data-testid="customer-vat-input"
                dir="ltr"
                value={formData.vat_number}
                onChange={(e) => setFormData({ ...formData, vat_number: e.target.value })}
                className="form-input text-left"
                placeholder="300000000000003"
              />
            </div>

            <div className="form-group">
              <Label htmlFor="address" className="form-label">
                العنوان
              </Label>
              <textarea
                id="address"
                data-testid="customer-address-input"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="form-input min-h-[80px] resize-none"
                placeholder="عنوان العميل"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                data-testid="save-customer-btn"
                className="btn btn-primary flex-1"
              >
                {editingCustomer ? "حفظ التعديلات" : "إضافة العميل"}
              </Button>
              <Button
                type="button"
                data-testid="cancel-customer-btn"
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
