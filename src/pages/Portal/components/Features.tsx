import { FileCheck, Lock, Scale, Search, Shield, Zap } from 'lucide-react';
import React from 'react';

const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({
  icon,
  title,
  description,
}) => (
  <div className="sexy-card p-8 group">
    <div className="w-14 h-14 bg-brand-500/10 rounded-xl border border-brand-500/20 flex items-center justify-center text-brand-400 mb-6 group-hover:bg-brand-500 group-hover:text-white transition-colors">
      {icon}
    </div>
    <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
    <p className="text-slate-400 leading-relaxed">{description}</p>
  </div>
);

export const Features: React.FC = () => {
  const features = [
    // ... same features ...
  ];

  return (
    <div id="features" className="py-24 bg-transparent relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-base font-semibold text-brand-400 tracking-wide uppercase mb-2">
            Why LegalRag?
          </h2>
          <p className="text-3xl md:text-4xl font-bold text-white mb-4">
            Comprehensive Legal Intelligence
          </p>
          <p className="text-lg text-slate-400">
            Replace manual checks with automated precision. The platform designed for modern legal
            teams.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <FeatureCard key={index} {...feature} />
          ))}
        </div>
      </div>
    </div>
  );
};


