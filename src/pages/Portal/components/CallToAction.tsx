import { history } from '@umijs/max';
import { ArrowRight } from 'lucide-react';
import React from 'react';

export const CallToAction: React.FC = () => {
  const handleGetStarted = () => {
    history.push('/upload');
  };

  return (
    <div className="py-24 relative overflow-hidden z-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <div className="sexy-card p-12 md:p-16 overflow-hidden relative">
          {/* Decorative background for the CTA card */}
          <div className="absolute inset-0 bg-gradient-to-br from-brand-600/20 to-blue-600/20 pointer-events-none"></div>
          
          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 tracking-tight">
              Ready to modernize your legal workflow?
            </h2>
            <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">
              Join thousands of legal professionals who trust LegalRag for accurate, fast, and secure
              document intelligence.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
              <button 
                onClick={handleGetStarted}
                className="w-full sm:w-auto px-10 py-4 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-500 transition-all shadow-xl shadow-brand-500/25"
              >
                Get Started for Free
              </button>
              <button className="w-full sm:w-auto px-10 py-4 bg-white/5 border border-white/10 text-white rounded-xl font-bold hover:bg-white/10 transition-all flex items-center justify-center backdrop-blur-sm">
                Contact Sales
                <ArrowRight className="ml-2 h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


