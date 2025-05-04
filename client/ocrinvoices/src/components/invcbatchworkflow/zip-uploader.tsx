// components/ZipUploader.tsx
import React, { useCallback, useRef } from 'react';

interface ZipUploaderProps {
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  fileName?: string;
}

export default function ZipUploader({ onUpload, disabled, fileName }: ZipUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (disabled) return;

    const file = e.dataTransfer.files?.[0];
    if (file?.type === 'application/zip' || file?.name.endsWith('.zip')) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      const input = document.createElement('input');
      input.type = 'file';
      input.files = dataTransfer.files;

      const event = {
        target: input
      } as unknown as React.ChangeEvent<HTMLInputElement>;

      onUpload(event);
    }
  }, [onUpload, disabled]);

  const preventDefault = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();

  if (fileName) {
    return (
      <div className="p-4 bg-green-50 border border-green-300 rounded text-sm">
        <strong>Uploaded ZIP:</strong> {fileName}
      </div>
    );
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={preventDefault}
      onDragEnter={preventDefault}
      className={`border-2 border-dashed rounded p-6 text-center cursor-pointer ${
        disabled ? 'bg-gray-100 text-gray-400' : 'hover:bg-blue-50'
      }`}
      onClick={() => !disabled && fileInputRef.current?.click()}
    >
      <p className="mb-2">Drag and drop your .zip file here, or click to upload</p>
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        disabled={disabled}
        onChange={onUpload}
        className="hidden"
      />
    </div>
  );
}
