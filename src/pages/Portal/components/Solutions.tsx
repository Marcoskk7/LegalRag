import { Check } from 'lucide-react';
import React from 'react';

export const Solutions: React.FC = () => {
  return (
    <div id="solutions" className="py-24 bg-white/5 backdrop-blur-sm relative z-10 border-y border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-2 gap-16 items-center">
          <div className="mb-12 lg:mb-0 relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-brand-600 to-blue-400 rounded-2xl transform rotate-3 opacity-10"></div>
            <img
              src="https://picsum.photos/800/600?grayscale"
              alt="Legal Team working"
              className="relative rounded-2xl shadow-2xl w-full object-cover h-[500px] border border-white/10"
            />
            <div className="absolute -bottom-8 -left-8 bg-slate-900/90 backdrop-blur-xl p-6 rounded-xl shadow-2xl border border-white/10 max-w-xs hidden md:block">
              <p className="text-white font-bold text-lg mb-2 leading-tight">
                &quot;LegalRag reduced our due diligence time by 70%.&quot;
              </p>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-brand-500/20 rounded-full"></div>
                <div>
                  <div className="text-sm font-semibold text-slate-200">Sarah Jenkins</div>
                  <div className="text-xs text-slate-400">General Counsel, TechCorp</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Tailored for Every Legal Professional
            </h2>
            <p className="text-lg text-slate-400 mb-8">
              Whether you are a solo practitioner, a mid-sized firm, or an enterprise legal
              department, LegalRag adapts to your workflow.
            </p>

            <div className="space-y-6">
              {[
                {
                  title: 'For Law Firms',
                  desc: 'Accelerate case research and discovery with semantic search across millions of precedents.',
                },
                {
                  title: 'For In-House Counsel',
                  desc: 'Standardize contract reviews and maintain playbook compliance effortlessly.',
                },
                {
                  title: 'For Compliance Officers',
                  desc: 'Real-time monitoring of regulatory changes mapped directly to your internal policies.',
                },
              ].map((item, idx) => (
                <div key={idx} className="flex group">
                  <div className="flex-shrink-0 mt-1">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 group-hover:bg-brand-500 group-hover:text-white transition-colors">
                      <Check size={18} strokeWidth={3} />
                    </div>
                  </div>
                  <div className="ml-4">
                    <h4 className="text-lg font-bold text-white group-hover:text-brand-400 transition-colors">{item.title}</h4>
                    <p className="mt-1 text-slate-400 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


