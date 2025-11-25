import { FileCheck, Lock, Scale, Search, Shield, Zap } from 'lucide-react';
import React from 'react';

const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({
  icon,
  title,
  description,
}) => (
  <div className="bg-slate-50 rounded-2xl p-8 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:bg-white border border-transparent hover:border-slate-100 group">
    <div className="w-14 h-14 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-brand-600 mb-6 group-hover:bg-brand-600 group-hover:text-white transition-colors">
      {icon}
    </div>
    <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
    <p className="text-slate-600 leading-relaxed">{description}</p>
  </div>
);

export const Features: React.FC = () => {
  const features = [
    {
      icon: <Shield size={28} />,
      title: 'Smart Risk Detection',
      description:
        'Automatically identify potential legal risks in contracts and agreements using advanced NLP models trained on legal datasets.',
    },
    {
      icon: <Search size={28} />,
      title: 'Deep Legal RAG',
      description:
        'Retrieve precise case laws, statutes, and internal precedents instantly. Our RAG engine understands legal context, not just keywords.',
    },
    {
      icon: <FileCheck size={28} />,
      title: 'Contract Review Automation',
      description:
        'Accelerate your review process by 10x. LegalRag suggests redlines and highlights clauses that deviate from your playbook.',
    },
    {
      icon: <Scale size={28} />,
      title: 'Compliance Monitoring',
      description:
        'Stay up-to-date with changing regulations. LegalRag continuously monitors your documents against new compliance standards.',
    },
    {
      icon: <Lock size={28} />,
      title: 'Enterprise Grade Security',
      description:
        'Your data is encrypted and isolated. We adhere to SOC2 and GDPR standards to ensure client confidentiality.',
    },
    {
      icon: <Zap size={28} />,
      title: 'Instant Summarization',
      description:
        'Turn 100-page briefs into executive summaries in seconds. Extract key dates, obligations, and liabilities automatically.',
    },
  ];

  return (
    <div id="features" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-base font-semibold text-brand-600 tracking-wide uppercase mb-2">
            Why LegalRag?
          </h2>
          <p className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Comprehensive Legal Intelligence
          </p>
          <p className="text-lg text-slate-600">
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


