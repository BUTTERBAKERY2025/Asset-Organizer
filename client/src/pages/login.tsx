import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Wheat, Heart, Award, Coffee } from "lucide-react";
import logo from "@assets/logo_butter_bakery__1768502624540.png";
import welcomeGraphic from "@assets/generated_images/person_computer_transparent_bg.png";

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
    <div className="min-h-screen flex flex-col bg-[#EAE6DB]">
      <div className="flex-1 relative flex flex-col xl:flex-row items-center justify-center gap-8 lg:gap-16 p-4 sm:p-6 md:p-8 lg:p-12">
        
        <div className="hidden xl:flex flex-1 flex-col items-start justify-center max-w-2xl">
          <div className="relative">
            <img src={welcomeGraphic} alt="Welcome" className="w-full max-w-lg" />
            <div className="absolute top-4 left-4">
              <img src={logo} alt="Butter Bakery" className="h-20 w-auto drop-shadow-lg" />
            </div>
          </div>
          
          <div className="mt-8 space-y-4">
            <h1 className="text-4xl 2xl:text-5xl font-bold text-[#1a3a2f] leading-tight">
              <span className="text-[#e67e22]">Butter</span> Bakery
            </h1>
            <h2 className="text-xl 2xl:text-2xl text-[#1a3a2f]/80 font-light">
              Specialty Coffee
            </h2>
            <div className="w-16 h-1 bg-[#e67e22] rounded-full"></div>
            
            <div className="flex items-center gap-6 pt-4 text-[#1a3a2f]">
              <div className="text-center">
                <p className="text-[#e67e22] text-xl mb-1">☀</p>
                <p className="text-xs font-medium">Mornings</p>
                <p className="text-[10px] text-[#1a3a2f]/60">bakery aromas</p>
              </div>
              <div className="w-px h-10 bg-[#1a3a2f]/20"></div>
              <div className="text-center">
                <p className="text-[#e67e22] text-xl mb-1">☕</p>
                <p className="text-xs font-medium">Days</p>
                <p className="text-[10px] text-[#1a3a2f]/60">specialty coffee</p>
              </div>
              <div className="w-px h-10 bg-[#1a3a2f]/20"></div>
              <div className="text-center">
                <p className="text-[#e67e22] text-xl mb-1">🌙</p>
                <p className="text-xs font-medium">Nights</p>
                <p className="text-[10px] text-[#1a3a2f]/60">sweet desserts</p>
              </div>
            </div>
            
            <p className="text-[#1a3a2f] text-lg font-semibold tracking-wide uppercase pt-4">
              This is Butter Bakery
            </p>
            
            <a href="https://www.butterbakery.co" target="_blank" rel="noopener noreferrer" className="text-[#1a3a2f]/60 text-sm tracking-[0.2em] hover:text-[#e67e22] transition-colors inline-block">
              www.butterbakery.co
            </a>
          </div>
        </div>

        <div className="w-full max-w-[380px] sm:max-w-md">
          <div className="xl:hidden flex flex-col items-center mb-6 sm:mb-8">
            <img src={logo} alt="Butter Bakery" className="h-20 sm:h-24 w-auto drop-shadow-lg mb-3" />
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1a3a2f] text-center">
              <span className="text-[#e67e22]">Butter</span> Bakery
            </h1>
            <p className="text-[#1a3a2f]/70 text-sm mt-1">Specialty Coffee</p>
          </div>

          <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-xl border border-[#1a3a2f]/10">
            <div className="text-center mb-6 sm:mb-8">
              <h3 className="text-2xl sm:text-3xl font-bold text-[#1a3a2f] mb-2">Login</h3>
              <p className="text-[#e67e22] text-sm font-medium tracking-wide">Our Smart Portal For Managing Our Business</p>
              <p className="text-[#1a3a2f]/50 text-xs mt-1">Only Authorized Persons</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" dir="rtl">
              <div>
                <Input
                  id="username"
                  type="text"
                  placeholder="اسم المستخدم"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-12 bg-[#EAE6DB] border-[#1a3a2f]/20 text-[#1a3a2f] placeholder:text-[#1a3a2f]/40 focus:border-[#e67e22] focus:ring-[#e67e22]/20 rounded-xl text-right"
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
                  className="h-12 bg-[#EAE6DB] border-[#1a3a2f]/20 text-[#1a3a2f] placeholder:text-[#1a3a2f]/40 focus:border-[#e67e22] focus:ring-[#e67e22]/20 rounded-xl text-right"
                  data-testid="input-password"
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="rememberMe"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                  className="h-5 w-5 border-[#1a3a2f]/30 data-[state=checked]:bg-[#e67e22] data-[state=checked]:border-[#e67e22]"
                  data-testid="checkbox-remember-me"
                />
                <Label htmlFor="rememberMe" className="text-[#1a3a2f]/70 cursor-pointer text-sm">
                  تذكرني
                </Label>
              </div>

              {error && (
                <div className="text-red-600 text-sm text-center p-3 bg-red-50 border border-red-200 rounded-lg" data-testid="text-error">
                  {error}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full h-12 text-lg font-bold bg-[#e67e22] hover:bg-[#d35400] text-white rounded-xl shadow-lg shadow-[#e67e22]/30 transition-all duration-300" 
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

          <a href="https://www.butterbakery.co" target="_blank" rel="noopener noreferrer" className="xl:hidden text-[#1a3a2f]/50 text-xs text-center mt-4 tracking-widest hover:text-[#e67e22] transition-colors block">
            www.butterbakery.co
          </a>
        </div>
      </div>

      <div className="bg-[#1a3a2f] border-t border-[#1a3a2f]">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-center gap-8 sm:gap-12 md:gap-16">
            <div className="flex items-center gap-2">
              <Wheat className="w-4 h-4 text-[#e67e22]" />
              <span className="text-white text-xs font-medium">Freshly Baked</span>
            </div>
            <div className="w-px h-4 bg-white/20 hidden sm:block"></div>
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-[#e67e22]" />
              <span className="text-white text-xs font-medium">Healthy Options</span>
            </div>
            <div className="w-px h-4 bg-white/20 hidden sm:block"></div>
            <div className="flex items-center gap-2 hidden md:flex">
              <Award className="w-4 h-4 text-[#e67e22]" />
              <span className="text-white text-xs font-medium">Quality Ingredients</span>
            </div>
            <div className="w-px h-4 bg-white/20 hidden md:block"></div>
            <div className="flex items-center gap-2 hidden sm:flex">
              <Coffee className="w-4 h-4 text-[#e67e22]" />
              <span className="text-white text-xs font-medium">Specialty Coffee</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
