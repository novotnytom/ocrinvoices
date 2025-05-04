import React from 'react';

interface ToolboxProps {
  onOCRAll: () => void;
  disabled?: boolean;
}

export default function Toolbox({ onOCRAll, disabled }: ToolboxProps) {
  return (
    <div className="flex items-center gap-4 bg-gray-50 p-4 border rounded">
      <button
        onClick={onOCRAll}
        disabled={disabled}
        className="bg-green-600 text-white text-sm px-4 py-2 rounded disabled:opacity-50"
      >
        OCR All Pages
      </button>
      {/* Future buttons can go here */}
    </div>
  );
}
