import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, User, Lock, Croissant, Coffee, Cake, Cookie } from "lucide-react";
import logo from "@assets/logo_-5_1765206843638.png";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login, isLoggingIn, isAuthenticated } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");

  if (isAuthenticated) {
    setLocation("/");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    try {
      await login({ username, password, rememberMe });
      setLocation("/");
    } catch (err: any) {
      setError(err.message || "فشل تسجيل الدخول");
    }
  };

  return (
    <div className="min-h-screen flex bg-amber-50/50">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.08%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-30"></div>
        
        <div className="relative z-10 flex flex-col items-center justify-center w-full p-12">
          <div className="text-center space-y-8">
            <div className="flex items-center justify-center gap-6 mb-8">
              <Croissant className="w-16 h-16 text-white/90 animate-pulse" />
              <Coffee className="w-14 h-14 text-white/80" />
              <Cake className="w-16 h-16 text-white/90 animate-pulse" style={{ animationDelay: "0.5s" }} />
            </div>
            
            <div className="bg-white/20 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border border-white/30">
              <img 
                src={logo} 
                alt="Butter Bakery" 
                className="h-32 w-auto mx-auto drop-shadow-lg"
              />
            </div>
            
            <div className="space-y-4 mt-8">
              <h2 className="text-3xl font-bold text-white drop-shadow-md">
                نظام إدارة باتر بيكري
              </h2>
              <p className="text-white/90 text-lg max-w-sm mx-auto">
                إدارة شاملة للمشروعات والأصول والصيانة
              </p>
            </div>

            <div className="flex items-center justify-center gap-4 mt-8">
              <Cookie className="w-8 h-8 text-white/70" />
              <div className="h-1 w-16 bg-white/30 rounded-full"></div>
              <Croissant className="w-8 h-8 text-white/70" />
              <div className="h-1 w-16 bg-white/30 rounded-full"></div>
              <Cake className="w-8 h-8 text-white/70" />
            </div>
          </div>
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-amber-600/50 to-transparent"></div>
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
        <div className="absolute -top-10 -right-10 w-60 h-60 bg-white/10 rounded-full blur-3xl"></div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex justify-center mb-6">
            <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-4 rounded-2xl shadow-lg">
              <img src={logo} alt="Butter Bakery" className="h-20 w-auto" />
            </div>
          </div>

          <div className="text-center lg:text-right space-y-2" dir="rtl">
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900">
              مرحباً بك 👋
            </h1>
            <p className="text-gray-500 text-lg">
              قم بتسجيل الدخول للوصول إلى لوحة التحكم
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" dir="rtl">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-gray-700 font-medium">
                اسم المستخدم
              </Label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="username"
                  type="text"
                  placeholder="أدخل اسم المستخدم"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pr-10 h-12 text-right border-gray-200 focus:border-amber-500 focus:ring-amber-500 rounded-xl"
                  data-testid="input-username"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-700 font-medium">
                كلمة المرور
              </Label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="أدخل كلمة المرور"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10 h-12 text-right border-gray-200 focus:border-amber-500 focus:ring-amber-500 rounded-xl"
                  data-testid="input-password"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="rememberMe"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                  className="border-gray-300 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                  data-testid="checkbox-remember-me"
                />
                <Label htmlFor="rememberMe" className="text-sm text-gray-600 cursor-pointer">
                  تذكرني
                </Label>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 text-center p-3 bg-red-50 border border-red-200 rounded-xl" data-testid="text-error">
                {error}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full h-12 text-lg font-semibold bg-gray-900 hover:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200" 
              disabled={isLoggingIn}
              data-testid="button-login"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                  جاري الدخول...
                </>
              ) : (
                "تسجيل الدخول"
              )}
            </Button>
          </form>

          <div className="text-center pt-4">
            <p className="text-gray-500 text-sm">
              نظام باتر بيكري لإدارة المخابز
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
