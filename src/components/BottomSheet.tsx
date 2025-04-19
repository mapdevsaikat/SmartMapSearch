import React, { useState } from 'react';
import { ChevronUp, X } from 'lucide-react';

interface BottomSheetProps {
  isOpen: boolean;
  children: React.ReactNode;
  title: string;
  resultsCount: number;
  onClose: () => void;
}

export default function BottomSheet({ isOpen, children, title, resultsCount, onClose }: BottomSheetProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-2xl shadow-lg transition-all duration-300 ease-in-out transform ${
        isOpen ? 'translate-y-0' : 'translate-y-full'
      }`}
      style={{ 
        height: isExpanded ? '50vh' : '200px',
        maxHeight: '50vh',
        zIndex: 9999,
        opacity: 0.95
      }}
    >
      <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
        <div 
          className="flex-1 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">{title}</h2>
            <ChevronUp 
              className={`w-5 h-5 ml-2 text-gray-500 dark:text-gray-400 transition-transform ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{resultsCount} results found</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
      </div>
      <div className="overflow-y-auto" style={{ height: 'calc(100% - 73px)' }}>
        {children}
      </div>
    </div>
  );
}