import React from 'react';

export const Statistics: React.FC = () => {
  const stats = [
    { value: '500+', label: 'Enterprise Clients' },
    { value: '1M+', label: 'Documents Analyzed' },
    { value: '99.9%', label: 'Accuracy Rate' },
    { value: '24/7', label: 'AI Availability' },
  ];

  return (
    <div className="bg-white/5 backdrop-blur-md py-12 border-y border-white/5 relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-3xl lg:text-4xl font-bold text-white mb-1">
                {stat.value}
              </div>
              <div className="text-sm font-medium text-slate-400 uppercase tracking-wide">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};


