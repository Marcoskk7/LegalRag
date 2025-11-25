import { Check } from 'lucide-react';
import React from 'react';

export const Solutions: React.FC = () => {
  return (
    <div id="solutions" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-2 gap-16 items-center">
          <div className="mb-12 lg:mb-0 relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-brand-600 to-blue-400 rounded-2xl transform rotate-3 opacity-20"></div>
            <img
              src="https://picsum.photos/800/600?grayscale"
              alt="Legal Team working"
              className="relative rounded-2xl shadow-xl w-full object-cover h-[500px]"
            />
            <div className="absolute -bottom-8 -left-8 bg-white p-6 rounded-xl shadow-lg border border-slate-100 max-w-xs hidden md:block">
              <p className="text-slate-900 font-bold text-lg mb-2">
                &quot;LegalRag reduced our due diligence time by 70%.&quot;
              </p>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-slate-200 rounded-full"></div>
                <div>
                  <div className="text-sm font-semibold text-slate-800">Sarah Jenkins</div>
                  <div className="text-xs text-slate-500">General Counsel, TechCorp</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
              Tailored for Every Legal Professional
            </h2>
            <p className="text-lg text-slate-600 mb-8">
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
                <div key={idx} className="flex">
                  <div className="flex-shrink-0 mt-1">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-brand-100 text-brand-600">
                      <Check size={18} strokeWidth={3} />
                    </div>
                  </div>
                  <div className="ml-4">
                    <h4 className="text-lg font-bold text-slate-900">{item.title}</h4>
                    <p className="mt-1 text-slate-600">{item.desc}</p>
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


