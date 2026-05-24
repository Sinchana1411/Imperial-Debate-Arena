import React from 'react';

interface VintageCardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
  accentColor?: string; // e.g. gold, bronze, charcoal
  id?: string;
}

export default function VintageCard({ children, title, subtitle, className = '', accentColor = 'charcoal', id }: VintageCardProps) {
  return (
    <div 
      id={id}
      className={`parchment border-vintage shadow-vintage-lg rounded-sm relative overflow-hidden p-6 ${className}`}
    >
      {/* Decorative Corner Ornaments */}
      <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-amber-900 opacity-60 pointer-events-none" />
      <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-amber-900 opacity-60 pointer-events-none" />
      <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-amber-900 opacity-60 pointer-events-none" />
      <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-amber-900 opacity-60 pointer-events-none" />

      {/* Title block */}
      {(title || subtitle) && (
        <div className="text-center mb-6 pt-2 border-b border-amber-900/20 pb-4">
          {title && (
            <h3 className="font-display text-2xl font-bold tracking-tight text-amber-950 uppercase">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="font-serif italic text-sm text-amber-900/75 mt-1">
              — {subtitle} —
            </p>
          )}
          {/* Ornate Divider */}
          <div className="flex items-center justify-center gap-2 mt-2">
            <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-amber-900/60" />
            <span className="text-xs text-amber-900">❖</span>
            <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-amber-900/60" />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="relative z-10 font-serif leading-relaxed text-amber-950">
        {children}
      </div>
    </div>
  );
}
