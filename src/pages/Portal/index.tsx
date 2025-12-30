import DottedGlowBackground from '@/components/DottedGlowBackground';
import React from 'react';
import { CallToAction } from './components/CallToAction';
import { Features } from './components/Features';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { Navbar } from './components/Navbar';
import { Solutions } from './components/Solutions';
import { Statistics } from './components/Statistics';

const PortalPage: React.FC = () => {
  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: '#09090b', overflowX: 'hidden' }}>
      <DottedGlowBackground />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Navbar />
        <main>
          <Hero />
          <Statistics />
          <Features />
          <Solutions />
          <CallToAction />
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default PortalPage;


