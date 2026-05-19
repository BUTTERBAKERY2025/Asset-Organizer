export const COMPANY_INFO = {
  name: "شركة الزبد الأفضل التجارية",
  nameEn: "Best Butter Trading Company",
  cr: "7026155296",
  logo: "/company-logo.png",
  address: "المملكة العربية السعودية",
  addressEn: "Kingdom of Saudi Arabia",
};

export function CompanyHeader({ templateTitle, templateTitleEn }: { templateTitle?: string; templateTitleEn?: string }) {
  return (
    <div className="mb-2 relative">
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none z-0"
        style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "280px", height: "280px" }}
      >
        <img src={COMPANY_INFO.logo} alt="" className="w-full h-full object-contain" style={{ opacity: 0.04 }} />
      </div>

      <div className="w-full h-1 mb-1 relative z-10" style={{ background: "linear-gradient(90deg, #1a3a2f 0%, #2d5a47 50%, #1a3a2f 100%)" }} />

      <div className="flex items-center justify-between pb-1 relative z-10">
        <div className="flex-shrink-0">
          <img
            src={COMPANY_INFO.logo}
            alt="Company Logo"
            className="h-24 w-auto object-contain"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
        <div className="flex-1 text-center px-3">
          <h1 className="text-lg font-bold text-[#1a3a2f]">{COMPANY_INFO.name}</h1>
          <h2 className="text-sm font-semibold text-[#1a3a2f]">{COMPANY_INFO.nameEn}</h2>
          <span className="text-xs text-slate-600">سجل تجاري / C.R: {COMPANY_INFO.cr}</span>
        </div>
      </div>

      <div className="w-full h-0.5 mb-1 relative z-10" style={{ background: "linear-gradient(90deg, transparent 0%, #1a3a2f 20%, #1a3a2f 80%, transparent 100%)" }} />

      {templateTitle && (
        <div className="text-center border border-[#1a3a2f] rounded py-1 px-2 bg-slate-50 relative z-10">
          <h2 className="text-sm font-bold text-[#1a3a2f]">{templateTitle}</h2>
          {templateTitleEn && <p className="text-xs font-medium text-slate-600">{templateTitleEn}</p>}
        </div>
      )}
    </div>
  );
}
