import { ArrowRight } from 'lucide-react';
import React from 'react';

export const CallToAction: React.FC = () => {
  return (
    <div className="py-20 relative overflow-hidden">
      <div className="absolute inset-0 bg-brand-700"></div>
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
          Ready to modernize your legal workflow?
        </h2>
        <p className="text-xl text-brand-100 mb-10 max-w-2xl mx-auto">
          Join thousands of legal professionals who trust LegalRag for accurate, fast, and secure
          document intelligence.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
          <button className="w-full sm:w-auto px-8 py-4 bg-white text-brand-700 rounded-xl font-bold hover:bg-brand-50 transition-colors shadow-lg">
            Get Started for Free
          </button>
          <button className="w-full sm:w-auto px-8 py-4 bg-transparent border-2 border-brand-400 text-white rounded-xl font-bold hover:bg-brand-600/50 transition-colors flex items-center justify-center">
            Contact Sales
            <ArrowRight className="ml-2 h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};


