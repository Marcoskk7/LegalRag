import { history } from '@umijs/max';
import { ArrowRight, CheckCircle, FileText, Search } from 'lucide-react';
import React from 'react';

export const Hero: React.FC = () => {
  const handleGetStarted = () => {
    history.push('/upload');
  };

  return (
    <div className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden bg-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="lg:grid lg:grid-cols-12 lg:gap-16 items-center">
          {/* Text Content */}
          <div className="lg:col-span-6 text-center lg:text-left mb-12 lg:mb-0">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-sm font-medium mb-6 backdrop-blur-sm">
              <span className="flex h-2 w-2 rounded-full bg-brand-500 mr-2 animate-pulse"></span>
              New Generation Legal AI
            </div>
            <h1 className="text-4xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.1] mb-6">
              Intelligent Legal <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-blue-400">
                Risk Management
              </span>
            </h1>
            <p className="text-lg text-slate-400 mb-8 leading-relaxed max-w-2xl mx-auto lg:mx-0">
              LegalRag empowers enterprises with AI-driven document analysis, compliance verification, and instant legal retrieval (RAG) capabilities. Secure, fast, and accurate.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start space-y-3 sm:space-y-0 sm:space-x-4">
              <button 
                onClick={handleGetStarted}
                className="w-full sm:w-auto px-8 py-4 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-500 transition-all shadow-lg shadow-brand-500/25 flex items-center justify-center group"
              >
                Get Started
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="w-full sm:w-auto px-8 py-4 bg-white/5 text-white border border-white/10 rounded-xl font-semibold hover:bg-white/10 transition-colors flex items-center justify-center backdrop-blur-sm">
                Book Demo
              </button>
            </div>

            <div className="mt-8 flex items-center justify-center lg:justify-start space-x-6 text-sm text-slate-500">
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-brand-500 mr-2" />
                <span>No Credit Card</span>
              </div>
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-brand-500 mr-2" />
                <span>GDPR Compliant</span>
              </div>
            </div>
          </div>

          {/* Hero Visual / Dashboard Mockup */}
          <div className="lg:col-span-6 relative">
            <div className="sexy-card relative p-2 transform lg:rotate-2 hover:rotate-0 transition-transform duration-500">
              <div className="bg-[#0c0c0e] rounded-xl overflow-hidden border border-white/5 aspect-[4/3] relative">
                {/* Simulated Dashboard UI */}
                <div className="absolute top-0 left-0 right-0 h-10 bg-white/5 border-b border-white/5 flex items-center px-4 space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
                  <div className="ml-4 h-4 w-64 bg-white/5 rounded-full"></div>
                </div>
                <div className="p-6 grid grid-cols-3 gap-4 mt-10">
                  <div className="col-span-2 space-y-4">
                    <div className="h-24 rounded-lg bg-white/5 animate-pulse shimmer-loading"></div>
                    <div className="h-24 rounded-lg bg-white/5 animate-pulse delay-75 shimmer-loading"></div>
                    <div className="h-24 rounded-lg bg-white/5 animate-pulse delay-150 shimmer-loading"></div>
                  </div>
                  <div className="col-span-1 space-y-4">
                    <div className="h-full rounded-lg bg-brand-500/5 border border-brand-500/20 p-4">
                      <div className="w-10 h-10 bg-brand-500/20 rounded-full flex items-center justify-center mb-3">
                        <Search className="text-brand-400 w-5 h-5" />
                      </div>
                      <div className="h-2 w-12 bg-white/10 rounded mb-2"></div>
                      <div className="h-2 w-20 bg-white/10 rounded"></div>
                    </div>
                  </div>
                </div>

                {/* Floating Cards */}
                <div className="absolute bottom-6 left-6 right-6 bg-slate-900/80 backdrop-blur-md p-4 rounded-lg border border-white/10 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-500/20 rounded-lg">
                      <FileText className="text-green-400 h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-slate-200 text-sm font-medium">Contract Scan Complete</div>
                      <div className="text-slate-400 text-xs">No critical risks found</div>
                    </div>
                  </div>
                  <div className="px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded-full font-medium">
                    100% Safe
                  </div>
                </div>
              </div>
            </div>

            {/* Decorative Elements behind dashboard */}
            <div className="absolute -z-10 -bottom-10 -right-10 w-40 h-40 bg-brand-500/10 rounded-full blur-3xl"></div>
          </div>
        </div>
      </div>
    </div>
  );
};


