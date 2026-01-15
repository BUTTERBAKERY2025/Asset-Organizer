import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Link } from "wouter";
import { 
  Package, Hammer, Settings, Users, Building2, 
  LayoutDashboard, Factory, CheckCircle, Megaphone, UserCheck, Calendar, 
  Target, UsersRound, ClipboardList, Receipt, TrendingUp, Brain,
  FileBarChart, PieChart, Shield, BarChart3, Briefcase
} from "lucide-react";
import type { SystemModule } from "@shared/schema";

interface ModuleIconProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  gradient: string;
}

function ModuleIcon({ title, icon: Icon, href, gradient }: ModuleIconProps) {
  return (
    <Link href={href}>
      <div className="flex flex-col items-center gap-3 group cursor-pointer" data-testid={`module-icon-${href.replace('/', '')}`}>
        <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl ${gradient} flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300`}>
          <Icon className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
        </div>
        <span className="text-sm sm:text-base font-medium text-slate-700 group-hover:text-slate-900 transition-colors">
          {title}
        </span>
      </div>
    </Link>
  );
}

export default function PlatformHomePage() {
  const { user, isAuthenticated } = useAuth();
  const { canView } = usePermissions();

  const modules: { title: string; icon: React.ComponentType<{ className?: string }>; href: string; gradient: string; module?: SystemModule }[] = [
    // Operations
    { title: "Production", icon: ClipboardList, href: "/production-dashboard", gradient: "bg-gradient-to-br from-blue-400 to-blue-600", module: "production" },
    { title: "Operations", icon: Factory, href: "/operations", gradient: "bg-gradient-to-br from-indigo-400 to-indigo-600", module: "operations" },
    { title: "Quality Control", icon: CheckCircle, href: "/quality-control", gradient: "bg-gradient-to-br from-green-400 to-green-600", module: "operations" },
    { title: "Daily Production", icon: Calendar, href: "/daily-production", gradient: "bg-gradient-to-br from-cyan-400 to-cyan-600", module: "production" },
    { title: "Products", icon: Package, href: "/products", gradient: "bg-gradient-to-br from-teal-400 to-teal-600", module: "operations" },
    { title: "Targets", icon: Target, href: "/targets-dashboard", gradient: "bg-gradient-to-br from-violet-400 to-violet-600", module: "cashier_journal" },
    
    // Analytics
    { title: "Sales Analytics", icon: PieChart, href: "/sales-analytics", gradient: "bg-gradient-to-br from-rose-400 to-rose-600", module: "cashier_journal" },
    { title: "P&L Dashboard", icon: TrendingUp, href: "/pnl-dashboard", gradient: "bg-gradient-to-br from-emerald-400 to-emerald-600", module: "cashier_journal" },
    { title: "Reports", icon: FileBarChart, href: "/reports", gradient: "bg-gradient-to-br from-amber-400 to-amber-600", module: "reports" },
    { title: "Production Reports", icon: BarChart3, href: "/production-reports", gradient: "bg-gradient-to-br from-orange-400 to-orange-600", module: "production" },
    { title: "Cashier Journal", icon: Receipt, href: "/cashier-journals", gradient: "bg-gradient-to-br from-lime-400 to-lime-600", module: "cashier_journal" },
    { title: "Command Center", icon: Brain, href: "/production-dashboard", gradient: "bg-gradient-to-br from-purple-400 to-purple-600", module: "production" },
    
    // Admin
    { title: "Employees", icon: UsersRound, href: "/branch-employees", gradient: "bg-gradient-to-br from-sky-400 to-sky-600", module: "branch_employees" },
    { title: "Attendance", icon: UserCheck, href: "/attendance-dashboard", gradient: "bg-gradient-to-br from-fuchsia-400 to-fuchsia-600", module: "shifts" },
    { title: "Branches", icon: Building2, href: "/branches", gradient: "bg-gradient-to-br from-yellow-400 to-yellow-600", module: "branches" },
    { title: "Users", icon: Users, href: "/users", gradient: "bg-gradient-to-br from-pink-400 to-pink-600", module: "users" },
    { title: "Security", icon: Shield, href: "/security-management", gradient: "bg-gradient-to-br from-red-400 to-red-600", module: "settings" },
    { title: "Settings", icon: Settings, href: "/settings", gradient: "bg-gradient-to-br from-slate-400 to-slate-600", module: "settings" },
    
    // CEO Command
    { title: "Marketing", icon: Megaphone, href: "/marketing", gradient: "bg-gradient-to-br from-pink-400 to-rose-600", module: "marketing" },
    { title: "Projects", icon: Hammer, href: "/construction-projects", gradient: "bg-gradient-to-br from-orange-400 to-red-600", module: "construction_projects" },
    { title: "Contractors", icon: Briefcase, href: "/contractors", gradient: "bg-gradient-to-br from-stone-400 to-stone-600", module: "construction_projects" },
    { title: "Assets", icon: Package, href: "/inventory", gradient: "bg-gradient-to-br from-amber-400 to-yellow-600", module: "inventory" },
    { title: "Dashboard", icon: LayoutDashboard, href: "/dashboard", gradient: "bg-gradient-to-br from-blue-500 to-indigo-600", module: "dashboard" },
  ];

  const accessibleModules = modules.filter(module => {
    if (!module.module) return true;
    return canView(module.module);
  });

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        {/* Hero Section */}
        <div className="text-center py-12 sm:py-16 px-4">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-800 mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>
            All your business on{" "}
            <span className="relative inline-block">
              <span className="relative z-10 text-amber-600">one platform</span>
              <span className="absolute bottom-1 left-0 w-full h-3 bg-amber-200/60 -z-0 rounded"></span>
            </span>
          </h1>
          <p className="text-xl sm:text-2xl text-slate-600 font-light italic" style={{ fontFamily: "'Playfair Display', serif" }}>
            Simple, efficient, yet powerful!
          </p>
          
          {isAuthenticated && user && (
            <div className="mt-6 inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
                {user.firstName?.charAt(0) || user.username?.charAt(0) || "U"}
              </div>
              <span className="text-slate-700 font-medium">
                Welcome, {user.firstName || user.username}
              </span>
            </div>
          )}
        </div>

        {/* Category Labels */}
        <div className="max-w-6xl mx-auto px-4 pb-16">
          {/* Operations Section */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
              <h2 className="text-lg font-semibold text-slate-700 uppercase tracking-wide">Operations</h2>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-6 sm:gap-8">
              {accessibleModules.slice(0, 6).map((module, index) => (
                <ModuleIcon key={index} {...module} />
              ))}
            </div>
          </div>

          {/* Analytics Section */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-6 bg-emerald-500 rounded-full"></div>
              <h2 className="text-lg font-semibold text-slate-700 uppercase tracking-wide">Analytics</h2>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-6 sm:gap-8">
              {accessibleModules.slice(6, 12).map((module, index) => (
                <ModuleIcon key={index} {...module} />
              ))}
            </div>
          </div>

          {/* Admin Section */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-6 bg-purple-500 rounded-full"></div>
              <h2 className="text-lg font-semibold text-slate-700 uppercase tracking-wide">Admin</h2>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-6 sm:gap-8">
              {accessibleModules.slice(12, 18).map((module, index) => (
                <ModuleIcon key={index} {...module} />
              ))}
            </div>
          </div>

          {/* CEO Command Section */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-6 bg-amber-500 rounded-full"></div>
              <h2 className="text-lg font-semibold text-slate-700 uppercase tracking-wide">CEO Command</h2>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-6 sm:gap-8">
              {accessibleModules.slice(18).map((module, index) => (
                <ModuleIcon key={index} {...module} />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-8 text-slate-400 text-sm">
          <p>Butter Bakery Management Platform</p>
        </div>
      </div>
    </Layout>
  );
}
