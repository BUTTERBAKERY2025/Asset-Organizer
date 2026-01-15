import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Settings, BarChart3, Building2, Briefcase } from "lucide-react";
import logo from "@assets/logo_butter_bakery__1768502624540.png";
import welcomeGraphic from "@assets/generated_images/man_beard_imac_facing_left.png";

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
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-[#F5F0E6]">
      <div className="flex-1 flex flex-col lg:flex-row">
        
        <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] bg-gradient-to-br from-[#F5F0E6] to-[#EDE5D8] relative overflow-hidden">
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-[#e67e22]"></div>
            <div className="absolute bottom-20 right-20 w-48 h-48 rounded-full bg-[#1a3a2f]"></div>
            <div className="absolute top-1/2 left-1/3 w-24 h-24 rounded-full bg-[#e67e22]"></div>
          </div>
          
          <div className="relative z-10 flex flex-col items-center justify-center w-full p-8 lg:p-12 xl:p-16">
            <div className="text-center space-y-6">
              <div className="inline-block rounded-2xl overflow-hidden shadow-2xl border-4 border-white/60 transform hover:scale-105 transition-transform duration-500">
                <img 
                  src={welcomeGraphic} 
                  alt="Welcome" 
                  className="w-[200px] lg:w-[240px] xl:w-[280px] 2xl:w-[320px]" 
                />
              </div>
              
              <div className="space-y-3">
                <h1 className="text-3xl lg:text-4xl xl:text-5xl 2xl:text-6xl font-bold text-[#1a3a2f] leading-tight">
                  <span className="text-[#e67e22]">Butter</span> Bakery
                </h1>
                <p className="text-xs lg:text-sm text-[#1a3a2f]/70 font-medium tracking-[0.3em] uppercase">
                  CEO COMMAND
                </p>
                <div className="w-20 h-1 bg-[#e67e22] rounded-full mx-auto"></div>
              </div>

              <div className="flex items-center justify-center gap-4 lg:gap-6 xl:gap-8 pt-4">
                <div className="text-center p-3 lg:p-4 rounded-xl bg-white/50 backdrop-blur-sm">
                  <p className="text-[#e67e22] text-2xl lg:text-3xl mb-1">☀</p>
                  <p className="text-xs lg:text-sm font-semibold text-[#1a3a2f]">Mornings</p>
                  <p className="text-[10px] lg:text-xs text-[#1a3a2f]/60">bakery aromas</p>
                </div>
                <div className="text-center p-3 lg:p-4 rounded-xl bg-white/50 backdrop-blur-sm">
                  <p className="text-[#e67e22] text-2xl lg:text-3xl mb-1">☕</p>
                  <p className="text-xs lg:text-sm font-semibold text-[#1a3a2f]">Days</p>
                  <p className="text-[10px] lg:text-xs text-[#1a3a2f]/60">specialty coffee</p>
                </div>
                <div className="text-center p-3 lg:p-4 rounded-xl bg-white/50 backdrop-blur-sm">
                  <p className="text-[#e67e22] text-2xl lg:text-3xl mb-1">🌙</p>
                  <p className="text-xs lg:text-sm font-semibold text-[#1a3a2f]">Nights</p>
                  <p className="text-[10px] lg:text-xs text-[#1a3a2f]/60">sweet desserts</p>
                </div>
              </div>

              <div className="pt-4 space-y-2">
                <p className="text-[#1a3a2f] text-base lg:text-lg font-bold tracking-wide">
                  This is Butter Bakery
                </p>
                <a 
                  href="https://www.butterbakery.co" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-[#1a3a2f]/50 text-xs lg:text-sm tracking-[0.2em] hover:text-[#e67e22] transition-colors inline-block"
                >
                  www.butterbakery.co
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 lg:w-1/2 xl:w-[45%] flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
          <div className="w-full max-w-[340px] sm:max-w-[380px] md:max-w-[420px]">
            
            <div className="lg:hidden flex flex-col items-center mb-6 sm:mb-8">
              <img 
                src={logo} 
                alt="Butter Bakery" 
                className="h-16 sm:h-20 md:h-24 w-auto drop-shadow-lg mb-3" 
              />
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#1a3a2f] text-center">
                <span className="text-[#e67e22]">Butter</span> Bakery
              </h1>
              <p className="text-[#1a3a2f]/60 text-xs sm:text-sm mt-1 tracking-widest">CEO COMMAND</p>
            </div>

            <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 md:p-8 shadow-xl border border-[#1a3a2f]/10">
              <div className="text-center mb-5 sm:mb-6 md:mb-8">
                <div className="hidden lg:block mb-4">
                  <img 
                    src={logo} 
                    alt="Butter Bakery" 
                    className="h-12 xl:h-16 w-auto mx-auto drop-shadow-md" 
                  />
                </div>
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#1a3a2f] mb-2">Login</h3>
                <p className="text-[#e67e22] text-xs sm:text-sm font-medium tracking-wide leading-relaxed">
                  Our Smart Portal For Managing Our Business
                </p>
                <p className="text-[#1a3a2f]/50 text-[10px] sm:text-xs mt-1">Only Authorized Persons</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5" dir="rtl">
                <div>
                  <Input
                    id="username"
                    type="text"
                    placeholder="اسم المستخدم"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-11 sm:h-12 bg-[#F5F0E6] border-[#1a3a2f]/20 text-[#1a3a2f] placeholder:text-[#1a3a2f]/40 focus:border-[#e67e22] focus:ring-[#e67e22]/20 rounded-xl text-right text-sm sm:text-base"
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
                    className="h-11 sm:h-12 bg-[#F5F0E6] border-[#1a3a2f]/20 text-[#1a3a2f] placeholder:text-[#1a3a2f]/40 focus:border-[#e67e22] focus:ring-[#e67e22]/20 rounded-xl text-right text-sm sm:text-base"
                    data-testid="input-password"
                    required
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="rememberMe"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                    className="h-4 w-4 sm:h-5 sm:w-5 border-[#1a3a2f]/30 data-[state=checked]:bg-[#e67e22] data-[state=checked]:border-[#e67e22]"
                    data-testid="checkbox-remember-me"
                  />
                  <Label htmlFor="rememberMe" className="text-[#1a3a2f]/70 cursor-pointer text-xs sm:text-sm">
                    تذكرني
                  </Label>
                </div>

                {error && (
                  <div className="text-red-600 text-xs sm:text-sm text-center p-2 sm:p-3 bg-red-50 border border-red-200 rounded-lg" data-testid="text-error">
                    {error}
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full h-11 sm:h-12 text-base sm:text-lg font-bold bg-[#e67e22] hover:bg-[#d35400] text-white rounded-xl shadow-lg shadow-[#e67e22]/30 transition-all duration-300 active:scale-[0.98]" 
                  disabled={isLoggingIn}
                  data-testid="button-login"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                      <span className="text-sm sm:text-base">Logging in...</span>
                    </>
                  ) : (
                    "Login"
                  )}
                </Button>
              </form>
            </div>

            <a 
              href="https://www.butterbakery.co" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="lg:hidden text-[#1a3a2f]/50 text-[10px] sm:text-xs text-center mt-4 tracking-widest hover:text-[#e67e22] transition-colors block"
            >
              www.butterbakery.co
            </a>
          </div>
        </div>
      </div>

      <div className="bg-[#1a3a2f] shrink-0">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3">
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 md:gap-8 lg:gap-12">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Settings className="w-3 h-3 sm:w-4 sm:h-4 text-[#e67e22]" />
              <span className="text-white text-[10px] sm:text-xs font-medium">Operations</span>
            </div>
            <div className="w-px h-3 sm:h-4 bg-white/20 hidden sm:block"></div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4 text-[#e67e22]" />
              <span className="text-white text-[10px] sm:text-xs font-medium">Analytics</span>
            </div>
            <div className="w-px h-3 sm:h-4 bg-white/20 hidden sm:block"></div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Building2 className="w-3 h-3 sm:w-4 sm:h-4 text-[#e67e22]" />
              <span className="text-white text-[10px] sm:text-xs font-medium">Admin</span>
            </div>
            <div className="w-px h-3 sm:h-4 bg-white/20 hidden md:block"></div>
            <div className="flex items-center gap-1.5 sm:gap-2 hidden md:flex">
              <Briefcase className="w-3 h-3 sm:w-4 sm:h-4 text-[#e67e22]" />
              <span className="text-white text-[10px] sm:text-xs font-medium">CEO Command</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
