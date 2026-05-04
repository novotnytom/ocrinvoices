import React, { useCallback, useRef, useState } from 'react';

interface ImageUploaderProps {
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => boolean | Promise<boolean>;
  disabled?: boolean;
}

export default function ImageUploader({ onUpload, disabled }: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [lastFileName, setLastFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const isSupportedFile = (file: File) =>
    file.type.startsWith('image/') ||
    file.type === 'application/pdf' ||
    /\.(jpg|jpeg|png|pdf)$/i.test(file.name);

  const selectFile = (file: File) => {
    if (isSupportedFile(file)) {
      setPendingFile(file);
      return;
    }

    alert('Unsupported file type. Upload JPG, JPEG, PNG, or PDF.');
  };

  const handleUploadClick = async () => {
    if (!pendingFile || disabled || isUploading) return;

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(pendingFile);

    const input = document.createElement('input');
    input.type = 'file';
    input.files = dataTransfer.files;

    const event = {
      target: input
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    setIsUploading(true);
    try {
      const success = await Promise.resolve(onUpload(event));
      if (success) {
        setLastFileName(pendingFile.name);
        setPendingFile(null);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (disabled) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      selectFile(file);
    }
  }, [disabled]);

  const preventDefault = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={preventDefault}
        onDragEnter={preventDefault}
        className={`border-2 border-dashed rounded p-6 text-center cursor-pointer ${
          disabled ? 'bg-gray-100 text-gray-400' : 'hover:bg-blue-50'
        }`}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <p className="mb-2">Drag and drop your invoice image or PDF here, then start upload</p>
        {pendingFile && (
          <p className="text-sm text-gray-700">Selected: {pendingFile.name}</p>
        )}
        {lastFileName && (
          <p className="text-xs text-gray-500">Last uploaded: {lastFileName}</p>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              selectFile(file);
            }
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
          }}
          className="hidden"
        />
      </div>
      <button
        type="button"
        onClick={handleUploadClick}
        disabled={disabled || !pendingFile || isUploading}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        {isUploading ? 'Uploading...' : 'Start Upload'}
      </button>
      {lastFileName && (
        <p className="text-xs text-gray-500">If nothing appears after selecting a file, click Start Upload.</p>
      )}
    </div>
  );
}
