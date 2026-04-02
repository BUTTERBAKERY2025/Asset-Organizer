import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  retryCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    retryCount: 0
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const msg = error?.message || '';
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      msg.includes('dynamically imported module') ||
      msg.includes('Loading chunk') ||
      msg.includes('error loading dynamically imported');

    if (isChunkError) {
      const alreadyReloaded = sessionStorage.getItem('__chunk_reload');
      if (!alreadyReloaded) {
        sessionStorage.setItem('__chunk_reload', '1');
        window.location.reload();
        return;
      }
    }

    console.error('Application error:', error);
    console.error('Error stack:', error.stack);
    console.error('Component stack:', errorInfo.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleRetry = () => {
    this.setState(prev => ({ 
      hasError: false, 
      error: undefined,
      retryCount: prev.retryCount + 1 
    }));
  };

  public render() {
    if (this.state.hasError) {
      const canRetry = this.state.retryCount < 3;
      
      return (
        <div 
          className="min-h-screen flex flex-col items-center justify-center bg-[#F5F0E6] p-4"
          dir="rtl"
          style={{ fontFamily: "'Cairo', sans-serif" }}
        >
          <div className="bg-white rounded-2xl p-8 shadow-xl max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-xl font-bold text-[#1a3a2f] mb-2">
              حدث خطأ غير متوقع
            </h1>
            <p className="text-[#1a3a2f]/70 text-sm mb-4">
              نعتذر عن هذا الخطأ. يرجى المحاولة مرة أخرى.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-left text-xs max-h-32 overflow-auto">
                <p className="font-mono text-red-700">{this.state.error.message}</p>
                <pre className="text-red-600 mt-1 whitespace-pre-wrap">{this.state.error.stack?.split('\n').slice(0, 5).join('\n')}</pre>
              </div>
            )}
            <div className="flex gap-3 justify-center">
              {canRetry && (
                <Button 
                  onClick={this.handleRetry}
                  variant="outline"
                  className="border-[#e67e22] text-[#e67e22] hover:bg-[#e67e22]/10"
                >
                  <RotateCcw className="w-4 h-4 ml-2" />
                  إعادة المحاولة
                </Button>
              )}
              <Button 
                onClick={this.handleReload}
                className="bg-[#e67e22] hover:bg-[#d35400] text-white"
              >
                <RefreshCw className="w-4 h-4 ml-2" />
                تحديث الصفحة
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
