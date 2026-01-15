import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Wheat, Heart, Award, Coffee } from "lucide-react";
import logo from "@assets/logo_butter_bakery__1768502624540.png";

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
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 relative bg-gradient-to-br from-stone-900 via-stone-800 to-amber-900 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-amber-600/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4"></div>
          <div className="absolute top-1/2 left-1/2 w-[300px] h-[300px] bg-orange-500/5 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2"></div>
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between h-full p-6 lg:p-12 gap-8">
          <div className="flex-1 text-center lg:text-right space-y-8 max-w-2xl" dir="rtl">
            <div className="flex items-center justify-center lg:justify-start">
              <img src={logo} alt="Butter Bakery" className="h-40 lg:h-52 w-auto drop-shadow-2xl" />
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold text-white leading-tight">
                <span className="text-amber-400">Butter</span> Bakery
              </h1>
              <h2 className="text-2xl lg:text-3xl text-amber-200/90 font-light">
                Specialty Coffee
              </h2>
            </div>

            <div className="space-y-2 text-stone-300 text-lg lg:text-xl font-light">
              <p>Mornings start with bakery aromas</p>
              <p>Days flow with specialty coffee</p>
              <p>Nights end with sweet desserts</p>
            </div>

            <p className="text-amber-400 text-xl font-semibold italic border-b-2 border-amber-400/50 inline-block pb-1">
              This is Butter Bakery.
            </p>

            <p className="text-stone-400 text-sm tracking-widest pt-4">
              www.butterbakery.co
            </p>
          </div>

          <div className="w-full max-w-md">
            <div className="bg-stone-800/80 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-stone-700/50">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-white mb-2">Login</h3>
                <p className="text-amber-400/80 text-sm font-medium tracking-wide">Your Gateway to Butter Bakery</p>
                <p className="text-stone-500 text-xs mt-1">Only Authorized Persons</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5" dir="rtl">
                <div className="space-y-2">
                  <Input
                    id="username"
                    type="text"
                    placeholder="اسم المستخدم"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-12 bg-stone-700/50 border-stone-600 text-white placeholder:text-stone-400 focus:border-amber-500 focus:ring-amber-500/20 rounded-lg text-right"
                    data-testid="input-username"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Input
                    id="password"
                    type="password"
                    placeholder="كلمة المرور"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 bg-stone-700/50 border-stone-600 text-white placeholder:text-stone-400 focus:border-amber-500 focus:ring-amber-500/20 rounded-lg text-right"
                    data-testid="input-password"
                    required
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="rememberMe"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                    className="border-stone-500 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                    data-testid="checkbox-remember-me"
                  />
                  <Label htmlFor="rememberMe" className="text-stone-400 cursor-pointer text-sm">
                    تذكرني
                  </Label>
                </div>

                {error && (
                  <div className="text-red-400 text-sm text-center p-3 bg-red-500/10 border border-red-500/20 rounded-lg" data-testid="text-error">
                    {error}
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full h-12 text-lg font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg shadow-lg shadow-amber-500/25 transition-all duration-300" 
                  disabled={isLoggingIn}
                  data-testid="button-login"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    "Login"
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-stone-900 border-t border-stone-800">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
                <Wheat className="w-7 h-7 text-amber-500" />
              </div>
              <h4 className="text-white font-semibold">Freshly Baked</h4>
              <p className="text-stone-500 text-sm">خبز طازج يومياً</p>
            </div>
            <div className="text-center space-y-3">
              <div className="w-14 h-14 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
                <Heart className="w-7 h-7 text-amber-500" />
              </div>
              <h4 className="text-white font-semibold">Healthy Options</h4>
              <p className="text-stone-500 text-sm">خيارات صحية</p>
            </div>
            <div className="text-center space-y-3">
              <div className="w-14 h-14 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
                <Award className="w-7 h-7 text-amber-500" />
              </div>
              <h4 className="text-white font-semibold">Quality Ingredients</h4>
              <p className="text-stone-500 text-sm">مكونات عالية الجودة</p>
            </div>
            <div className="text-center space-y-3">
              <div className="w-14 h-14 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
                <Coffee className="w-7 h-7 text-amber-500" />
              </div>
              <h4 className="text-white font-semibold">Specialty Coffee</h4>
              <p className="text-stone-500 text-sm">قهوة مختصة</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
