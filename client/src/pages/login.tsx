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
    <div className="min-h-screen flex flex-col bg-[#f8f6f1]">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-12 sm:h-14 bg-[#e67e22]"></div>
        <div className="absolute top-12 sm:top-14 left-0 right-0 h-8 sm:h-10 bg-[#f5e6d3]"></div>
        <svg className="absolute top-16 sm:top-20 left-0 w-full h-16 sm:h-20" viewBox="0 0 1440 80" preserveAspectRatio="none">
          <path d="M0,40 Q360,80 720,40 T1440,40 L1440,0 L0,0 Z" fill="#c9a961" opacity="0.6"/>
          <path d="M0,50 Q360,10 720,50 T1440,50 L1440,80 L0,80 Z" fill="#f5e6d3" opacity="0.4"/>
        </svg>
        <svg className="absolute bottom-12 sm:bottom-14 left-0 w-full h-16 sm:h-20" viewBox="0 0 1440 80" preserveAspectRatio="none">
          <path d="M0,40 Q360,0 720,40 T1440,40 L1440,80 L0,80 Z" fill="#c9a961" opacity="0.5"/>
          <path d="M0,30 Q360,70 720,30 T1440,30 L1440,0 L0,0 Z" fill="#f5e6d3" opacity="0.4"/>
        </svg>
        <div className="absolute bottom-0 left-0 right-0 h-12 sm:h-14 bg-[#e67e22]"></div>
      </div>

      <div className="flex-1 relative z-10 flex flex-col xl:flex-row items-center justify-center xl:justify-between gap-6 sm:gap-8 lg:gap-12 p-4 sm:p-6 md:p-8 lg:p-12">
        
        <div className="hidden xl:flex flex-1 flex-col items-center justify-center max-w-xl">
          <div className="text-center space-y-6">
            <div className="space-y-1">
              <div className="inline-block">
                <img src={logo} alt="Butter Bakery" className="h-48 2xl:h-56 w-auto drop-shadow-2xl mx-auto" />
              </div>
              <h1 className="text-4xl 2xl:text-5xl font-bold text-[#d35400] leading-tight">
                <span className="text-[#e67e22]">Butter</span> Bakery
              </h1>
            </div>
            
            <div className="space-y-3">
              <h2 className="text-2xl 2xl:text-3xl text-[#d35400]/80 font-light tracking-wide">
                Specialty Coffee
              </h2>
              <div className="w-24 h-0.5 bg-[#e67e22] mx-auto rounded-full"></div>
            </div>

            <div className="bg-[#e67e22]/90 backdrop-blur-sm rounded-2xl px-8 py-6 border border-[#f39c12]/30">
              <div className="flex items-center justify-center gap-8 text-white">
                <div className="text-center">
                  <p className="text-[#fff8e7] text-2xl mb-1">☀</p>
                  <p className="text-sm font-medium">Mornings</p>
                  <p className="text-xs text-[#fff8e7]/80">bakery aromas</p>
                </div>
                <div className="w-px h-12 bg-white/30"></div>
                <div className="text-center">
                  <p className="text-[#fff8e7] text-2xl mb-1">☕</p>
                  <p className="text-sm font-medium">Days</p>
                  <p className="text-xs text-[#fff8e7]/80">specialty coffee</p>
                </div>
                <div className="w-px h-12 bg-white/30"></div>
                <div className="text-center">
                  <p className="text-[#fff8e7] text-2xl mb-1">🌙</p>
                  <p className="text-sm font-medium">Nights</p>
                  <p className="text-xs text-[#fff8e7]/80">sweet desserts</p>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <p className="text-[#d35400] text-xl 2xl:text-2xl font-semibold tracking-wider uppercase">
                This is Butter Bakery
              </p>
            </div>

            <a href="https://www.butterbakery.co" target="_blank" rel="noopener noreferrer" className="text-[#d35400]/70 text-sm tracking-[0.3em] pt-2 hover:text-[#e67e22] transition-colors">
              www.butterbakery.co
            </a>
          </div>
        </div>

        <div className="w-full max-w-[360px] sm:max-w-md xl:max-w-sm 2xl:max-w-md">
          <div className="xl:hidden flex flex-col items-center mb-6 sm:mb-8">
            <img src={logo} alt="Butter Bakery" className="h-24 sm:h-32 md:h-36 w-auto drop-shadow-2xl mb-4" />
            <h1 className="text-2xl sm:text-3xl font-bold text-[#d35400] text-center">
              <span className="text-[#e67e22]">Butter</span> Bakery
            </h1>
            <p className="text-[#d35400]/80 text-sm sm:text-base mt-1">Specialty Coffee</p>
          </div>

          <div className="bg-[#e67e22]/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-5 sm:p-6 md:p-8 shadow-2xl border border-[#f39c12]/30">
            <div className="text-center mb-5 sm:mb-6 md:mb-8">
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-1.5 sm:mb-2">Login</h3>
              <p className="text-[#fff8e7] text-xs sm:text-sm font-medium tracking-wide">Our Smart Portal For Managing Our Business</p>
              <p className="text-white/70 text-[10px] sm:text-xs mt-0.5 sm:mt-1">Only Authorized Persons</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5" dir="rtl">
              <div>
                <Input
                  id="username"
                  type="text"
                  placeholder="اسم المستخدم"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-11 sm:h-12 bg-[#d35400] border-[#c9520a] text-white placeholder:text-white/60 focus:border-[#f39c12] focus:ring-[#f39c12]/20 rounded-lg sm:rounded-xl text-right text-sm sm:text-base"
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
                  className="h-11 sm:h-12 bg-[#d35400] border-[#c9520a] text-white placeholder:text-white/60 focus:border-[#f39c12] focus:ring-[#f39c12]/20 rounded-lg sm:rounded-xl text-right text-sm sm:text-base"
                  data-testid="input-password"
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="rememberMe"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                  className="h-4 w-4 sm:h-5 sm:w-5 border-white/50 data-[state=checked]:bg-[#f39c12] data-[state=checked]:border-[#f39c12]"
                  data-testid="checkbox-remember-me"
                />
                <Label htmlFor="rememberMe" className="text-white/80 cursor-pointer text-xs sm:text-sm">
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
                className="w-full h-11 sm:h-12 text-base sm:text-lg font-bold bg-white hover:bg-[#fff8e7] text-[#d35400] rounded-lg sm:rounded-xl shadow-lg shadow-white/25 transition-all duration-300" 
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

          <a href="https://www.butterbakery.co" target="_blank" rel="noopener noreferrer" className="xl:hidden text-[#d35400]/70 text-xs text-center mt-4 tracking-widest hover:text-[#e67e22] transition-colors block">
            www.butterbakery.co
          </a>
        </div>
      </div>

      <div className="relative z-10 bg-[#e67e22] border-t border-[#f39c12]/30">
        <div className="max-w-5xl mx-auto px-4 py-2.5 sm:py-3">
          <div className="flex items-center justify-center gap-6 sm:gap-10 md:gap-14">
            <div className="flex items-center gap-2">
              <Wheat className="w-4 h-4 text-white" />
              <span className="text-white text-[11px] sm:text-xs font-medium">Freshly Baked</span>
            </div>
            <div className="w-px h-4 bg-white/30 hidden sm:block"></div>
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-white" />
              <span className="text-white text-[11px] sm:text-xs font-medium">Healthy Options</span>
            </div>
            <div className="w-px h-4 bg-white/30 hidden sm:block"></div>
            <div className="flex items-center gap-2 hidden md:flex">
              <Award className="w-4 h-4 text-white" />
              <span className="text-white text-[11px] sm:text-xs font-medium">Quality Ingredients</span>
            </div>
            <div className="w-px h-4 bg-white/30 hidden md:block"></div>
            <div className="flex items-center gap-2 hidden sm:flex">
              <Coffee className="w-4 h-4 text-white" />
              <span className="text-white text-[11px] sm:text-xs font-medium">Specialty Coffee</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
