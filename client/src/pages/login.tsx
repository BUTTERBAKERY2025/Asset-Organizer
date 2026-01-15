import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, User, Lock, Wheat, Heart, Award } from "lucide-react";
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
    <div className="min-h-screen flex bg-stone-100">
      <div className="hidden lg:flex lg:w-[55%] bg-gradient-to-br from-amber-500 via-amber-400 to-yellow-400 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-40 right-10 w-80 h-80 bg-orange-300/20 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/3 w-40 h-40 bg-yellow-200/20 rounded-full blur-2xl"></div>
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center w-full p-16">
          <div className="bg-white rounded-[3rem] p-10 shadow-2xl transform hover:scale-105 transition-transform duration-500">
            <img 
              src={logo} 
              alt="Butter Bakery" 
              className="h-44 w-auto"
            />
          </div>
          
          <div className="mt-12 text-center space-y-6">
            <div className="space-y-2">
              <p className="text-amber-900/80 text-xl font-medium tracking-wide">
                Specialty Coffee
              </p>
              <div className="w-32 h-0.5 bg-amber-900/30 mx-auto"></div>
            </div>
            
            <div className="text-white text-lg space-y-2 font-light">
              <p className="drop-shadow-sm">Mornings start with bakery aromas</p>
              <p className="drop-shadow-sm">Days flow with specialty coffee</p>
              <p className="drop-shadow-sm">Nights end with sweet desserts</p>
            </div>

            <p className="text-amber-900 font-bold text-2xl mt-6 italic">
              "This is Butter Bakery"
            </p>
          </div>

          <div className="flex items-center justify-center gap-12 mt-12">
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                <Wheat className="w-8 h-8 text-white" />
              </div>
              <span className="text-white text-sm font-medium">Freshly Baked</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                <Heart className="w-8 h-8 text-white" />
              </div>
              <span className="text-white text-sm font-medium">Healthy Options</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                <Award className="w-8 h-8 text-white" />
              </div>
              <span className="text-white text-sm font-medium">Quality Ingredients</span>
            </div>
          </div>

          <p className="absolute bottom-8 text-amber-900/60 text-sm tracking-widest">
            www.butterbakery.co
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 lg:p-16 bg-white">
        <div className="w-full max-w-md space-y-10">
          <div className="lg:hidden flex justify-center mb-8">
            <div className="bg-gradient-to-br from-amber-400 to-amber-500 p-6 rounded-3xl shadow-xl">
              <img src={logo} alt="Butter Bakery" className="h-24 w-auto" />
            </div>
          </div>

          <div className="text-center space-y-3" dir="rtl">
            <h1 className="text-4xl font-bold text-gray-800">
              أهلاً وسهلاً
            </h1>
            <p className="text-gray-500 text-lg">
              سجّل دخولك للوصول إلى لوحة التحكم
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" dir="rtl">
            <div className="space-y-3">
              <Label htmlFor="username" className="text-gray-600 font-medium text-base">
                اسم المستخدم
              </Label>
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-400 rounded-2xl blur opacity-0 group-focus-within:opacity-20 transition-opacity"></div>
                <div className="relative">
                  <User className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="أدخل اسم المستخدم"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pr-12 h-14 text-right text-base bg-gray-50 border-2 border-gray-100 focus:border-amber-400 focus:bg-white rounded-2xl transition-all"
                    data-testid="input-username"
                    required
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <Label htmlFor="password" className="text-gray-600 font-medium text-base">
                كلمة المرور
              </Label>
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-400 rounded-2xl blur opacity-0 group-focus-within:opacity-20 transition-opacity"></div>
                <div className="relative">
                  <Lock className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="أدخل كلمة المرور"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-12 h-14 text-right text-base bg-gray-50 border-2 border-gray-100 focus:border-amber-400 focus:bg-white rounded-2xl transition-all"
                    data-testid="input-password"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id="rememberMe"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
                className="h-5 w-5 border-2 border-gray-300 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500 rounded-md"
                data-testid="checkbox-remember-me"
              />
              <Label htmlFor="rememberMe" className="text-gray-600 cursor-pointer">
                تذكرني في المرة القادمة
              </Label>
            </div>

            {error && (
              <div className="flex items-center gap-3 text-red-600 p-4 bg-red-50 border border-red-100 rounded-2xl" data-testid="text-error">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span>{error}</span>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full h-14 text-lg font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-2xl shadow-lg shadow-amber-500/30 hover:shadow-xl hover:shadow-amber-500/40 transition-all duration-300 transform hover:-translate-y-0.5" 
              disabled={isLoggingIn}
              data-testid="button-login"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                  جاري تسجيل الدخول...
                </>
              ) : (
                "تسجيل الدخول"
              )}
            </Button>
          </form>

          <div className="text-center space-y-4 pt-6 border-t border-gray-100">
            <p className="text-gray-400 text-sm">
              نظام إدارة باتر بيكري
            </p>
            <div className="flex items-center justify-center gap-2">
              <div className="w-8 h-0.5 bg-amber-300 rounded-full"></div>
              <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
              <div className="w-8 h-0.5 bg-amber-300 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
