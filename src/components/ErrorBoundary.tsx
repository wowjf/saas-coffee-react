import { t } from "../shared/system-texts";
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends React.Component<Props, State> {
  public props: Props;
  public state: State;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: any): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: any, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = t("beklenmedik-bir-hata-olustu");
      
      try {
        // Check if it is a JSON-shaped backend error
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error && parsed.operationType) {
          errorMessage = `Veritabanı hatası: ${parsed.operationType} işlemi sırasında yetki sorunu oluştu.`;
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen bg-surface flex items-center justify-center p-6">
          <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-xl border border-border text-center space-y-6">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto">
              <span className="text-4xl">⚠️</span>
            </div>
            <h1 className="text-2xl font-display font-bold">{t("bir-seyler-ters-gitti")}</h1>
            <p className="text-text-secondary text-sm leading-relaxed">
              {errorMessage}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 rounded-2xl bg-black text-white font-bold text-sm shadow-lg shadow-black/10"
            >
              {t("sayfayi-yenile")}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
