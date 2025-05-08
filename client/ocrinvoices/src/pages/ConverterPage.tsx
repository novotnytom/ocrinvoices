import React, { useState } from "react";
import DashboardLayout from '../dashboard/layout';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { UploadCloud } from "lucide-react";

function ConverterPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [isConverting, setIsConverting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files)]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleConvert = async () => {
    if (files.length === 0) return;

    setIsConverting(true);
    const formData = new FormData();
    files.forEach(file => formData.append("files", file));

    try {
      const response = await fetch("http://localhost:8000/convert/zasilkovna", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Conversion failed.");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "converted_zasilkovna.zip";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Error converting files.");
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <DashboardLayout>
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">Convert Zásilkovna Files</h1>

      <Card
        className="border-dashed border-2 border-gray-300 hover:border-blue-500 p-6 text-center cursor-pointer"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <CardContent className="space-y-2">
          <UploadCloud className="mx-auto w-8 h-8 text-gray-400" />
          <p className="text-sm text-gray-500">Drag and drop CSV or ZIP files here</p>
          <Input type="file" multiple onChange={handleFileChange} accept=".csv,.zip" />
        </CardContent>
      </Card>

      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Files to Convert:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {files.map((file, index) => (
              <li key={index} className="flex justify-between">
                <span>{file.name}</span>
                <button
                  onClick={() => removeFile(index)}
                  className="text-red-500 hover:underline text-xs"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button disabled={isConverting || files.length === 0} onClick={handleConvert}>
        {isConverting ? "Converting..." : "Convert and Download ZIP"}
      </Button>
    </div>
    </DashboardLayout>
  );
}

export default ConverterPage;
