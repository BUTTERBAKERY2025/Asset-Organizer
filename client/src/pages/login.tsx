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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-neutral-600 via-stone-400 to-orange-400">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[300px] sm:w-[400px] lg:w-[600px] h-[300px] sm:h-[400px] lg:h-[600px] bg-orange-300/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
        <div className="absolute bottom-0 left-0 w-[200px] sm:w-[300px] lg:w-[400px] h-[200px] sm:h-[300px] lg:h-[400px] bg-amber-200/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4"></div>
        <div className="absolute top-1/2 left-1/2 w-[150px] sm:w-[200px] lg:w-[300px] h-[150px] sm:h-[200px] lg:h-[300px] bg-orange-400/10 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2"></div>
      </div>

      <div className="flex-1 relative z-10 flex flex-col xl:flex-row items-center justify-center xl:justify-between gap-6 sm:gap-8 lg:gap-12 p-4 sm:p-6 md:p-8 lg:p-12">
        
        <div className="hidden xl:flex flex-1 flex-col items-center justify-center max-w-xl">
          <div className="text-center space-y-6">
            <div className="space-y-1">
              <div className="inline-block">
                <img src={logo} alt="Butter Bakery" className="h-48 2xl:h-56 w-auto drop-shadow-2xl mx-auto" />
              </div>
              <h1 className="text-4xl 2xl:text-5xl font-bold text-white leading-tight">
                <span className="text-amber-400">Butter</span> Bakery
              </h1>
            </div>
            
            <div className="space-y-3">
              <h2 className="text-2xl 2xl:text-3xl text-amber-200/90 font-light tracking-wide">
                Specialty Coffee
              </h2>
              <div className="w-24 h-0.5 bg-amber-500/50 mx-auto rounded-full"></div>
            </div>

            <div className="bg-stone-800/30 backdrop-blur-sm rounded-2xl px-8 py-6 border border-stone-700/30">
              <div className="flex items-center justify-center gap-8 text-stone-200">
                <div className="text-center">
                  <p className="text-amber-400 text-2xl mb-1">☀</p>
                  <p className="text-sm font-medium">Mornings</p>
                  <p className="text-xs text-stone-400">bakery aromas</p>
                </div>
                <div className="w-px h-12 bg-amber-500/30"></div>
                <div className="text-center">
                  <p className="text-amber-400 text-2xl mb-1">☕</p>
                  <p className="text-sm font-medium">Days</p>
                  <p className="text-xs text-stone-400">specialty coffee</p>
                </div>
                <div className="w-px h-12 bg-amber-500/30"></div>
                <div className="text-center">
                  <p className="text-amber-400 text-2xl mb-1">🌙</p>
                  <p className="text-sm font-medium">Nights</p>
                  <p className="text-xs text-stone-400">sweet desserts</p>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <p className="text-amber-400 text-xl 2xl:text-2xl font-semibold tracking-wider uppercase">
                This is Butter Bakery
              </p>
            </div>

            <a href="https://www.butterbakery.co" target="_blank" rel="noopener noreferrer" className="text-neutral-700 text-sm tracking-[0.3em] pt-2 hover:text-orange-600 transition-colors">
              www.butterbakery.co
            </a>
          </div>
        </div>

        <div className="w-full max-w-[360px] sm:max-w-md xl:max-w-sm 2xl:max-w-md">
          <div className="xl:hidden flex flex-col items-center mb-6 sm:mb-8">
            <img src={logo} alt="Butter Bakery" className="h-24 sm:h-32 md:h-36 w-auto drop-shadow-2xl mb-4" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white text-center">
              <span className="text-amber-400">Butter</span> Bakery
            </h1>
            <p className="text-amber-200/80 text-sm sm:text-base mt-1">Specialty Coffee</p>
          </div>

          <div className="bg-stone-800/90 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-5 sm:p-6 md:p-8 shadow-2xl border border-stone-700/50">
            <div className="text-center mb-5 sm:mb-6 md:mb-8">
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-1.5 sm:mb-2">Login</h3>
              <p className="text-amber-400/80 text-xs sm:text-sm font-medium tracking-wide">Our Smart Portal For Managing Our Business</p>
              <p className="text-stone-500 text-[10px] sm:text-xs mt-0.5 sm:mt-1">Only Authorized Persons</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5" dir="rtl">
              <div>
                <Input
                  id="username"
                  type="text"
                  placeholder="اسم المستخدم"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-11 sm:h-12 bg-stone-700/50 border-stone-600 text-white placeholder:text-stone-400 focus:border-amber-500 focus:ring-amber-500/20 rounded-lg sm:rounded-xl text-right text-sm sm:text-base"
                  data-testid="input-username"
                  required
                />
              </div>
              
              <div>
                <Input
                  id="password"
                  type="password"
                  placeholder="كلمة المرور"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 sm:h-12 bg-stone-700/50 border-stone-600 text-white placeholder:text-stone-400 focus:border-amber-500 focus:ring-amber-500/20 rounded-lg sm:rounded-xl text-right text-sm sm:text-base"
                  data-testid="input-password"
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="rememberMe"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                  className="h-4 w-4 sm:h-5 sm:w-5 border-stone-500 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                  data-testid="checkbox-remember-me"
                />
                <Label htmlFor="rememberMe" className="text-stone-400 cursor-pointer text-xs sm:text-sm">
                  تذكرني
                </Label>
              </div>

              {error && (
                <div className="text-red-400 text-xs sm:text-sm text-center p-2.5 sm:p-3 bg-red-500/10 border border-red-500/20 rounded-lg" data-testid="text-error">
                  {error}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full h-11 sm:h-12 text-base sm:text-lg font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg sm:rounded-xl shadow-lg shadow-amber-500/25 transition-all duration-300" 
                disabled={isLoggingIn}
                data-testid="button-login"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  "Login"
                )}
              </Button>
            </form>
          </div>

          <a href="https://www.butterbakery.co" target="_blank" rel="noopener noreferrer" className="xl:hidden text-neutral-700 text-xs text-center mt-4 tracking-widest hover:text-orange-600 transition-colors block">
            www.butterbakery.co
          </a>
        </div>
      </div>

      <div className="relative z-10 bg-neutral-800/95 backdrop-blur-sm border-t border-neutral-700">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 md:py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
            <div className="text-center space-y-1.5 sm:space-y-2 md:space-y-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
                <Wheat className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-amber-500" />
              </div>
              <h4 className="text-white font-semibold text-xs sm:text-sm md:text-base">Freshly Baked</h4>
              <p className="text-stone-500 text-[10px] sm:text-xs md:text-sm hidden sm:block">خبز طازج يومياً</p>
            </div>
            <div className="text-center space-y-1.5 sm:space-y-2 md:space-y-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
                <Heart className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-amber-500" />
              </div>
              <h4 className="text-white font-semibold text-xs sm:text-sm md:text-base">Healthy Options</h4>
              <p className="text-stone-500 text-[10px] sm:text-xs md:text-sm hidden sm:block">خيارات صحية</p>
            </div>
            <div className="text-center space-y-1.5 sm:space-y-2 md:space-y-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
                <Award className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-amber-500" />
              </div>
              <h4 className="text-white font-semibold text-xs sm:text-sm md:text-base">Quality Ingredients</h4>
              <p className="text-stone-500 text-[10px] sm:text-xs md:text-sm hidden sm:block">مكونات عالية الجودة</p>
            </div>
            <div className="text-center space-y-1.5 sm:space-y-2 md:space-y-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
                <Coffee className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-amber-500" />
              </div>
              <h4 className="text-white font-semibold text-xs sm:text-sm md:text-base">Specialty Coffee</h4>
              <p className="text-stone-500 text-[10px] sm:text-xs md:text-sm hidden sm:block">قهوة مختصة</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
