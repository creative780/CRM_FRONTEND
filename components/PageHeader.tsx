"use client";

import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export default function PageHeader({ 
  title, 
  description, 
  children, 
  className = "" 
}: PageHeaderProps) {
  return (
    <div className={`flex items-center justify-between mb-6 ${className}`}>
      <div>
        <h1 className="text-3xl font-bold text-[#891F1A] mb-1">
          {title}
        </h1>
        {description && (
          <p className="text-gray-600 text-base">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2 flex-wrap">
          {children}
        </div>
      )}
    </div>
  );
}
