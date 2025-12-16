import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Wifi, WifiOff, RefreshCw, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function OfflineIndicator() {
  const { isOnline, pendingCount, isSyncing, syncPendingOperations } = useOfflineSync();

  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 z-50 flex items-center gap-2 px-3 py-2 rounded-full shadow-lg text-sm",
        isOnline 
          ? "bg-amber-100 text-amber-800 border border-amber-200" 
          : "bg-red-100 text-red-800 border border-red-200"
      )}
    >
      {isOnline ? (
        <>
          <Cloud className="w-4 h-4" />
          <span>جاري المزامنة...</span>
          {pendingCount > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5">
              {pendingCount}
            </Badge>
          )}
          {isSyncing ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={syncPendingOperations}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          )}
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4" />
          <span>غير متصل</span>
          {pendingCount > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5">
              {pendingCount} عملية معلقة
            </Badge>
          )}
        </>
      )}
    </div>
  );
}

export function ConnectionStatus({ className }: { className?: string }) {
  const { isOnline } = useOfflineSync();

  return (
    <div className={cn("flex items-center gap-1.5 text-xs", className)}>
      {isOnline ? (
        <>
          <Wifi className="w-3.5 h-3.5 text-green-500" />
          <span className="text-green-600">متصل</span>
        </>
      ) : (
        <>
          <WifiOff className="w-3.5 h-3.5 text-red-500" />
          <span className="text-red-600">غير متصل</span>
        </>
      )}
    </div>
  );
}
