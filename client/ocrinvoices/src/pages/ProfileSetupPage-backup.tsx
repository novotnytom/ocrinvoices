import { useRef, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Stage, Layer, Rect, Text, Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import DashboardLayout from '../dashboard/layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ProfileSetupPage() {
  const { name: paramName } = useParams();
  const navigate = useNavigate();

  const [profileName, setProfileName] = useState(paramName || '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageURL, setImageURL] = useState<string | null>(null);
  const [replaceImageMode, setReplaceImageMode] = useState(false);

  const [zones, setZones] = useState<any[]>([]);
  const [ocrResults, setOcrResults] = useState<Record<string, string>>({});

  const stageRef = useRef<any>(null);
  const [image] = useImage(imageURL || '', 'anonymous');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImageURL(url);
  };

  useEffect(() => {
    if (!paramName) return;
    const loadProfile = async () => {
      try {
        const res = await fetch(`http://localhost:8000/profiles/${paramName}`);
        const data = await res.json();
        setZones(data.zones);
        setProfileName(paramName);

        const imgRes = await fetch(`http://localhost:8000${data.image_url}`);
        const blob = await imgRes.blob();
        const file = new File([blob], `${paramName}.jpg`, { type: blob.type });
        setImageFile(file);
        setImageURL(URL.createObjectURL(blob));
      } catch (err) {
        console.error("Failed to load profile", err);
      }
    };
    loadProfile();
  }, [paramName]);

  return (
    <DashboardLayout>
      <div className="flex flex-col h-screen">
        {/* Top gray panel */}
        <div className="bg-muted px-6 py-4 border-b border-border">
          <h1 className="text-lg font-semibold">{paramName ? 'Edit Invoice Template' : 'Add a New Invoice Template'}</h1>
          <div className="mt-2 max-w-md">
            <Input
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="Template name"
            />
          </div>
        </div>

        {/* Toolbar */}
        {imageURL && (
          <div className="bg-background border-b border-border px-6 py-2 flex gap-2 items-center">
            <Button variant="outline" onClick={() => setReplaceImageMode(true)}>Change Image</Button>
            <Button onClick={() => console.log('TODO: OCR ALL')}>Global OCR</Button>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel: Image or dropzone */}
          <div className="flex-1 flex items-center justify-center bg-background">
            {!imageURL ? (
              <label className="border border-dashed border-muted rounded-md p-10 text-muted-foreground cursor-pointer">
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                <div>Drop image here or click to upload</div>
              </label>
            ) : (
              <Stage
                ref={stageRef}
                width={800}
                height={600}
                className="border"
              >
                <Layer>
                  {image && <KonvaImage image={image} />}
                </Layer>
              </Stage>
            )}
          </div>

          {/* Right Panel: Zone Editor */}
          <div className="w-[300px] border-l border-border p-4 space-y-4 overflow-y-auto">
            <Button>Add Zone</Button>
            <Button variant="secondary">Save Template</Button>

            <div>
              <h3 className="text-sm font-medium mb-2">Zones</h3>
              {zones.map((zone, i) => (
                <div key={i} className="border rounded px-2 py-1 text-sm mb-2">
                  <div>{zone.propertyName || `Zone ${i + 1}`}</div>
                  <Input
                    value={zone.propertyName}
                    onChange={(e) => {
                      const newZones = [...zones];
                      newZones[i].propertyName = e.target.value;
                      setZones(newZones);
                    }}
                    placeholder="Property name"
                    className="mt-1"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
