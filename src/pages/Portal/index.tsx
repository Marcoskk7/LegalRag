import React from 'react';
import { CallToAction } from './components/CallToAction';
import { Features } from './components/Features';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { Solutions } from './components/Solutions';
import { Statistics } from './components/Statistics';

const PortalPage: React.FC = () => {
  return (
    <div className="bg-white text-slate-900 selection:bg-brand-100 selection:text-brand-900">
      <main>
        <Hero />
        <Statistics />
        <Features />
        <Solutions />
        <CallToAction />
      </main>
      <Footer />
    </div>
  );
};

export default PortalPage;


