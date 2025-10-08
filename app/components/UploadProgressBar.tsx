"use client";

import React from 'react';
import { Check } from 'lucide-react';

interface UploadProgressBarProps {
  progress: number; // 0-100
  isComplete: boolean;
  fileName?: string;
  fileSize?: number;
  show: boolean;
}

const UploadProgressBar: React.FC<UploadProgressBarProps> = ({
  progress,
  isComplete,
  fileName,
  fileSize,
  show
}) => {
  if (!show) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-2xl border border-gray-200 p-4 min-w-[300px] z-50 animate-slide-up">
      <div className="space-y-2">
        {fileName && (
          <div className="text-sm font-medium text-gray-700 truncate">
            {fileName}
            {fileSize && (
              <span className="text-xs text-gray-500 ml-2">
                ({(fileSize / 1024).toFixed(1)} KB)
              </span>
            )}
          </div>
        )}
        
        <div className="relative">
          {!isComplete ? (
            // Loading bar
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600">Uploading...</span>
                <span className="text-xs font-semibold text-green-600">{Math.round(progress)}%</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                >
                  <div className="h-full w-full bg-white/30 animate-shimmer"></div>
                </div>
              </div>
            </div>
          ) : (
            // Success state with green checkmark
            <div className="flex items-center space-x-2 text-green-600 animate-fade-in">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="w-5 h-5 animate-check-pop" />
              </div>
              <span className="text-sm font-semibold">Upload complete!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadProgressBar;

