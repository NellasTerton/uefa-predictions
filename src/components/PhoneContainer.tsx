/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface PhoneContainerProps {
  children: React.ReactNode;
}

export default function PhoneContainer({ children }: PhoneContainerProps) {
  return (
    <div className="min-h-screen bg-[#060c1d] bg-radial-at-t from-[#0e1b38] via-[#060c1d] to-[#040814] flex items-center justify-center p-0 md:p-6 text-white overflow-x-hidden antialiased font-sans">
      
      {/* Decorative Golden Stadium Beam Lights in Background (only visible on desktop wrapper) */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none hidden md:block"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[80px] pointer-events-none hidden md:block"></div>

      {/* Main Smartphone Shell Wrapper */}
      <div className="relative w-full max-w-sm md:max-w-[412px] h-screen md:h-[830px] bg-[#0c142b] md:rounded-[48px] md:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),_0_0_0_12px_#1e293b] overflow-hidden flex flex-col border-0 md:border-4 border-slate-700/50">
        
        {/* Dynamic Notch / Island on Desktop */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-full z-50 flex items-center justify-between px-4 pointer-events-none hidden md:flex">
          <div className="w-2.5 h-2.5 rounded-full bg-[#101010]"></div>
          <div className="w-10 h-1 bg-neutral-900 rounded-sm"></div>
          <div className="w-2 h-2 rounded-full bg-[#121212]"></div>
        </div>

        {/* Content Container */}
        <div className="flex-1 flex flex-col overflow-hidden relative mt-4 md:mt-8">
          {children}
        </div>

        {/* Bottom Hardware Pill Indicator on Smartphone view */}
        <div className="h-4 bg-[#0c142b] w-full flex justify-center items-center pb-1.5 z-40 select-none">
          <div className="w-28 h-[5px] bg-slate-600 rounded-full"></div>
        </div>
        
      </div>
    </div>
  );
}
