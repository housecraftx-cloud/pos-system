import { useState } from "react";
import { useAuth } from "../App";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { FileText, Eye, EyeOff } from "lucide-react";

export default function Login() {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    name: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      await login(formData.username, formData.password);
    } else {
      await register(formData.username, formData.password, formData.name);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-white mb-4 shadow-lg">
            <FileText size={32} />
          </div>
          <h1
            className="text-3xl font-bold text-[hsl(var(--foreground))]"
            style={{ fontFamily: "'Tajawal', sans-serif" }}
          >
            نظام المبيعات
          </h1>
          <p className="text-[hsl(var(--muted-foreground))] mt-2">
            متوافق مع الفوترة الإلكترونية ZATCA
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-[hsl(var(--border))] p-8 animate-fade-in-up stagger-1">
          <h2
            className="text-xl font-bold mb-6 text-center"
            style={{ fontFamily: "'Tajawal', sans-serif" }}
          >
            {isLogin ? "تسجيل الدخول" : "إنشاء حساب جديد"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="form-group">
                <Label htmlFor="name" className="form-label">
                  الاسم الكامل
                </Label>
                <Input
                  id="name"
                  data-testid="register-name-input"
                  type="text"
                  placeholder="أدخل اسمك"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="form-input"
                  required={!isLogin}
                />
              </div>
            )}

            <div className="form-group">
              <Label htmlFor="username" className="form-label">
                اسم المستخدم
              </Label>
              <Input
                id="username"
                data-testid="login-username-input"
                type="text"
                placeholder="أدخل اسم المستخدم"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <Label htmlFor="password" className="form-label">
                كلمة المرور
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  data-testid="login-password-input"
                  type={showPassword ? "text" : "password"}
                  placeholder="أدخل كلمة المرور"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="form-input pe-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              data-testid="login-submit-btn"
              className="w-full btn btn-primary h-12 text-base"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span>
                  جاري التحميل...
                </span>
              ) : isLogin ? (
                "تسجيل الدخول"
              ) : (
                "إنشاء الحساب"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              data-testid="toggle-auth-mode-btn"
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-[hsl(var(--primary))] hover:underline font-medium"
            >
              {isLogin ? "ليس لديك حساب؟ إنشاء حساب جديد" : "لديك حساب؟ تسجيل الدخول"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-[hsl(var(--muted-foreground))] mt-6 animate-fade-in-up stagger-2">
          نظام الفوترة الإلكترونية متوافق مع هيئة الزكاة والضريبة والجمارك
        </p>
      </div>
    </div>
  );
}
