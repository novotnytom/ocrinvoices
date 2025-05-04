import { useRef, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Stage, Layer, Rect, Text, Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import DashboardLayout from '../dashboard/layout';
import TemplateNameInput from '@/components/invctemplates/template-name-input';
import ImageDropzone from '@/components/invctemplates/image-dropzone';
import CanvasToolbar from '@/components/invctemplates/canvas-toolbar';
import ZoneSidebar from '@/components/invctemplates/zone-sidebar';
import { Button } from '@/components/ui/button';

interface Zone {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  propertyName: string;
  isItem?: boolean;
}

export default function ProfileSetupPage() {
  const { name: paramName } = useParams();
  const navigate = useNavigate();

  const [profileName, setProfileName] = useState(paramName || '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageURL, setImageURL] = useState<string | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [ocrResults, setOcrResults] = useState<Record<string, string>>({});

  const [zoneIdCounter, setZoneIdCounter] = useState(1);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPos, setLastPanPos] = useState<{ x: number; y: number } | null>(null);
  const [drawingMode, setDrawingMode] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [tempRect, setTempRect] = useState<Zone | null>(null);
  const [hoveredZoneId, setHoveredZoneId] = useState<number | null>(null);

  const stageRef = useRef<any>(null);
  const [image] = useImage(imageURL || '', 'anonymous');

  useEffect(() => {
    if (!paramName) return;

    const loadProfile = async () => {
      try {
        const res = await fetch(`http://localhost:8000/profiles/${paramName}`);
        const data = await res.json();

        setZones(data.zones || []);
        const maxId = (data.zones || []).reduce((max: number, z: Zone) => Math.max(max, z.id), 0);
        setZoneIdCounter(maxId + 1);
        setProfileName(data.name || paramName);

        const imgRes = await fetch(`http://localhost:8000${data.image_url}`);
        const blob = await imgRes.blob();
        const file = new File([blob], `${paramName}.jpg`, { type: blob.type });
        setImageFile(file);
        setImageURL(URL.createObjectURL(blob));
      } catch (err) {
        console.error("Failed to load profile", err);
        alert("Error loading profile");
      }
    };

    loadProfile();
  }, [paramName]);

  const handleImageUpload = (file: File) => {
    setImageFile(file);
    setImageURL(URL.createObjectURL(file));
  };

  const handleAddZone = () => {
    setDrawingMode(true);
  };

  const handleUpdateZone = (id: number, propertyName: string) => {
    setZones((prev) => prev.map(z => z.id === id ? { ...z, propertyName } : z));
  };

  const handleResizeZone = (id: number, direction: 'width' | 'height' | 'width-' | 'height-') => {
    setZones((prev) =>
      prev.map((zone) => {
        if (zone.id !== id) return zone;
        const min = 5;
        return {
          ...zone,
          width:
            direction === 'width'
              ? zone.width + 1
              : direction === 'width-'
                ? Math.max(min, zone.width - 1)
                : zone.width,
          height:
            direction === 'height'
              ? zone.height + 1
              : direction === 'height-'
                ? Math.max(min, zone.height - 1)
                : zone.height,
        };
      })
    );
  };

  const handleTestOCR = async (zone: Zone) => {
    if (!imageFile) return;

    if (!zone.propertyName.trim()) {
      alert("Please name the zone before testing OCR.");
      return;
    }

    const formData = new FormData();
    formData.append("image", imageFile);
    formData.append("zones", JSON.stringify([zone]));

    try {
      const response = await fetch("http://localhost:8000/ocr/test", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("OCR failed");

      const data = await response.json();
      const result = data.results[0];
      setOcrResults((prev) => ({ ...prev, [result.propertyName]: result.text }));
    } catch (err) {
      console.error("OCR failed", err);
      alert("OCR failed.");
    }
  };


  const handleDeleteZone = (id: number) => {
    setZones((prev) => prev.filter(z => z.id !== id));
  };

  const handleToggleItem = (id: number) => {
    setZones((prev) =>
      prev.map((zone) =>
        zone.id === id ? { ...zone, isItem: !zone.isItem } : zone
      )
    );
  };

  const handleSave = async () => {
    if (!profileName || !imageFile) return alert("Missing profile name or image");
    const formData = new FormData();
    formData.append("name", profileName);
    formData.append("image", imageFile);
    formData.append("zones", JSON.stringify(zones));

    try {
      const res = await fetch("http://localhost:8000/profiles/", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to save");
      alert("Saved");
      navigate("/profiles");
    } catch (err) {
      alert("Error saving profile");
    }
  };

  const handleMouseDown = (e: any) => {
    if (e.evt.button === 1) {
      setIsPanning(true);
      setLastPanPos({ x: e.evt.clientX, y: e.evt.clientY });
      return;
    }
    if (!drawingMode) return;
    const pointer = stageRef.current.getPointerPosition();
    if (pointer) setStartPoint(pointer);
  };

  const handleMouseMove = (e: any) => {
    if (isPanning && lastPanPos) {
      const dx = e.evt.clientX - lastPanPos.x;
      const dy = e.evt.clientY - lastPanPos.y;
      setPosition((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastPanPos({ x: e.evt.clientX, y: e.evt.clientY });
      return;
    }
    if (!drawingMode || !startPoint) return;
    const pointer = stageRef.current.getPointerPosition();
    if (!pointer) return;
    setTempRect({
      id: -1,
      x: Math.round((Math.min(startPoint.x, pointer.x) - position.x) / scale),
      y: Math.round((Math.min(startPoint.y, pointer.y) - position.y) / scale),
      width: Math.round(Math.abs(pointer.x - startPoint.x) / scale),
      height: Math.round(Math.abs(pointer.y - startPoint.y) / scale),
      propertyName: '',
    });
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      setLastPanPos(null);
      return;
    }
    if (!drawingMode || !startPoint || !tempRect) return;
    const newZone: Zone = { ...tempRect, id: zoneIdCounter };
    setZones((prev) => [...prev, newZone]);
    setZoneIdCounter((id) => id + 1);
    setStartPoint(null);
    setTempRect(null);
    setDrawingMode(false);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-screen">
        <div className="bg-muted px-6 py-4 border-b border-border">
          <h1 className="text-lg font-semibold">{paramName ? 'Edit Invoice Template' : 'Add a New Invoice Template'}</h1>
          <TemplateNameInput value={profileName} onChange={setProfileName} />
          <Button onClick={handleSave}>Save Template</Button>
        </div>

        {imageURL && (
          <CanvasToolbar
            onChangeImage={() => setImageURL(null)}
            onGlobalOCR={() => alert('TODO: Global OCR')}
            onAddZone={() => setDrawingMode(true)}
            drawingMode={drawingMode}
          />
        )}

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 flex items-center justify-center bg-background">
            {!imageURL ? (
              <ImageDropzone onFileSelect={handleImageUpload} />
            ) : (
              <Stage
                ref={stageRef}
                width={800}
                height={600}
                scaleX={scale}
                scaleY={scale}
                x={position.x}
                y={position.y}
                onWheel={(e) => {
                  e.evt.preventDefault();
                  const scaleBy = 1.05;
                  const stage = stageRef.current;
                  const pointer = stage.getPointerPosition();
                  if (!pointer) return;
                  const mousePointTo = {
                    x: (pointer.x - position.x) / scale,
                    y: (pointer.y - position.y) / scale,
                  };
                  const direction = e.evt.deltaY > 0 ? -1 : 1;
                  const newScale = scale * (direction > 0 ? scaleBy : 1 / scaleBy);
                  setScale(newScale);
                  setPosition({
                    x: pointer.x - mousePointTo.x * newScale,
                    y: pointer.y - mousePointTo.y * newScale,
                  });
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                style={{ cursor: drawingMode ? 'crosshair' : hoveredZoneId ? 'grab' : 'default' }}
              >
                <Layer>
                  {image && <KonvaImage image={image} />}
                  {zones.map(zone => (
                    <>
                      <Text
                        key={`text-${zone.id}`}
                        x={zone.x}
                        y={zone.y - 12}
                        text={zone.propertyName || `Zone ${zone.id}`}
                        fontSize={14}
                        fill={zone.isItem ? "orange" : "red"}
                      />
                      <Rect
                        key={`rect-${zone.id}`}
                        x={zone.x}
                        y={zone.y}
                        width={zone.width}
                        height={zone.height}
                        stroke={zone.isItem ? "orange" : "red"}
                        strokeWidth={2}
                        draggable={!drawingMode}
                        onDragEnd={(e) => {
                          const updated = zones.map((z) =>
                            z.id === zone.id
                              ? {
                                ...z,
                                x: Math.round(e.target.x()),
                                y: Math.round(e.target.y()),
                              }
                              : z
                          );
                          setZones(updated);
                        }}
                        onMouseEnter={() => setHoveredZoneId(zone.id)}
                        onMouseLeave={() => setHoveredZoneId(null)}
                      />
                    </>
                  ))}
                  {tempRect && (
                    <Rect
                      x={tempRect.x}
                      y={tempRect.y}
                      width={tempRect.width}
                      height={tempRect.height}
                      stroke="blue"
                      dash={[4, 4]}
                    />
                  )}
                </Layer>
              </Stage>
            )}
          </div>

          <ZoneSidebar
            zones={zones}
            ocrResults={ocrResults}
            onUpdateZone={handleUpdateZone}
            onTestOCR={handleTestOCR}
            onDeleteZone={handleDeleteZone}
            onToggleItem={handleToggleItem}
            onResizeZone={handleResizeZone}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}

