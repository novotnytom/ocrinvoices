interface ImageDropzoneProps {
    onFileSelect: (file: File) => void;
  }
  
  export default function ImageDropzone({ onFileSelect }: ImageDropzoneProps) {
    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        onFileSelect(e.dataTransfer.files[0]);
      }
    };
  
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelect(file);
    };
  
    return (
      <label
        className="border border-dashed border-muted rounded-md p-10 text-muted-foreground cursor-pointer"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <input type="file" accept="image/*" onChange={handleChange} className="hidden" />
        <div>Drop image here or click to upload</div>
      </label>
    );
  }
  