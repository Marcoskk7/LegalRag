import UploadBackground from '@/components/UploadBackground';
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
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 1, background: '#020617', overflow: 'hidden' }}>
      <UploadBackground />
      <div style={{ position: 'relative', zIndex: 1, height: '100%', overflowX: 'hidden', overflowY: 'auto' }}>
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


