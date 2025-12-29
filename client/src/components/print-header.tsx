interface PrintHeaderProps {
  title: string;
  subtitle?: string;
  showDate?: boolean;
}

export function PrintHeader({ title, subtitle, showDate = true }: PrintHeaderProps) {
  const logoUrl = '/attached_assets/logo_-5_1765206843638.png';
  const currentDate = new Date().toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });

  return (
    <div className="print-header hidden print:block mb-8 text-center border-b-2 border-[#d4a853] pb-6">
      <img 
        src={logoUrl} 
        alt="باتر بيكري" 
        className="h-20 mx-auto mb-4"
      />
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
      {subtitle && <p className="text-gray-600 text-sm mb-2">{subtitle}</p>}
      {showDate && <p className="text-gray-500 text-xs">{currentDate}</p>}
    </div>
  );
}

export function PrintFooter() {
  const currentDateTime = new Date().toLocaleString('en-GB');
  
  return (
    <div className="print-footer hidden print:block mt-8 pt-4 border-t border-gray-300 text-center text-xs text-gray-500">
      <p>تم إنشاء هذا التقرير بواسطة نظام إدارة المشروعات والأصول - باتر بيكري</p>
      <p>{currentDateTime}</p>
    </div>
  );
}
