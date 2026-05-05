import { useRef, useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Konva from 'konva';
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

interface ExportTemplateField {
  name: string;
  system?: boolean;
}

const STAGE_WIDTH = 800;
const STAGE_HEIGHT = 600;
const ZOOM_STEP = 1.05;
const MIN_SCALE = 0.2;
const MAX_SCALE = 8;

export default function ProfileSetupPage() {
  const { name: paramName } = useParams();
  const navigate = useNavigate();

  const [profileName, setProfileName] = useState(paramName || '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageURL, setImageURL] = useState<string | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [ocrResults, setOcrResults] = useState<Record<string, string>>({});
  const [systemFieldNames, setSystemFieldNames] = useState<string[]>([]);
  const [systemValues, setSystemValues] = useState<Record<string, string>>({});

  const [zoneIdCounter, setZoneIdCounter] = useState(1);
  const [viewport, setViewport] = useState({ scale: 1, x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [drawingMode, setDrawingMode] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [tempRect, setTempRect] = useState<Zone | null>(null);
  const [hoveredZoneId, setHoveredZoneId] = useState<number | null>(null);

  const stageRef = useRef<Konva.Stage | null>(null);
  const [image] = useImage(imageURL || '', 'anonymous');

  const fitToStage = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || !image) return;

    const stageWidth = stage.width();
    const imageWidth = image.width;

    if (!imageWidth) return;

    const scale = stageWidth / imageWidth;

    setViewport({
      scale,
      x: 0,
      y: 0,
    });
  }, [image]);

  useEffect(() => {
    fitToStage();
  }, [fitToStage, imageURL]);

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
        setSystemValues(data.systemValues || {});

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

  useEffect(() => {
    const loadSystemFields = async () => {
      const templateRes = await fetch("http://localhost:8000/export-template/load");
      const templateFields = await templateRes.json();
      const systemFields = templateFields
        .filter((f: ExportTemplateField) => f.system === true)
        .map((f: ExportTemplateField) => f.name);
      setSystemFieldNames(systemFields);
    };
    loadSystemFields();
  }, []);

  useEffect(() => {
    if (systemFieldNames.length === 0) return;
    setSystemValues((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      return Object.fromEntries(systemFieldNames.map((name) => [name, ""]));
    });
  }, [systemFieldNames]);

  const handleImageUpload = (file: File) => {
    setImageFile(file);
    setImageURL(URL.createObjectURL(file));
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
    formData.append("systemValues", JSON.stringify(systemValues));

    try {
      const res = await fetch("http://localhost:8000/profiles/", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to save");
      alert("Saved");
      navigate("/profiles");
    } catch {
      alert("Error saving profile");
    }
  };

  const getCanvasPoint = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;

    const stagePosition = stage.position();
    const scale = stage.scaleX();

    return {
      x: (pointer.x - stagePosition.x) / scale,
      y: (pointer.y - stagePosition.y) / scale,
    };
  }, []);

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 1) {
      e.evt.preventDefault();
      setIsPanning(true);
      stageRef.current?.startDrag();
      return;
    }
    if (!drawingMode) return;
    const pointer = getCanvasPoint();
    if (pointer) setStartPoint(pointer);
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isPanning) {
      const stage = e.target.getStage();
      if (!stage) return;
      const stagePosition = stage.position();
      setViewport((prev) => ({
        ...prev,
        x: stagePosition.x,
        y: stagePosition.y,
      }));
      return;
    }
    if (!drawingMode || !startPoint) return;
    const pointer = getCanvasPoint();
    if (!pointer) return;
    setTempRect({
      id: -1,
      x: Math.round(Math.min(startPoint.x, pointer.x)),
      y: Math.round(Math.min(startPoint.y, pointer.y)),
      width: Math.round(Math.abs(pointer.x - startPoint.x)),
      height: Math.round(Math.abs(pointer.y - startPoint.y)),
      propertyName: '',
    });
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
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

        {systemFieldNames.length > 0 && (
          <div className="bg-muted px-6 py-4 border-b border-border">
            <h2 className="text-sm font-semibold mb-2">Optional System Fields (XML)</h2>
            <div className="grid grid-cols-2 gap-3">
              {systemFieldNames.map((key) => (
                <div key={key} className="flex items-center gap-2">
                  <label className="text-xs w-32">{key}</label>
                  <input
                    type="text"
                    className="border p-1 text-sm flex-1"
                    value={systemValues?.[key] || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSystemValues((prev) => ({ ...prev, [key]: value }));
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {imageURL && (
          <CanvasToolbar
            onChangeImage={() => setImageURL(null)}
            onGlobalOCR={() => alert('TODO: Global OCR')}
            onAddZone={() => setDrawingMode(true)}
            onFitImage={fitToStage}
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
                width={STAGE_WIDTH}
                height={STAGE_HEIGHT}
                scaleX={viewport.scale}
                scaleY={viewport.scale}
                x={viewport.x}
                y={viewport.y}
                draggable={isPanning}
                onWheel={(e) => {
                  e.evt.preventDefault();
                  const stage = stageRef.current;
                  if (!stage) return;
                  const oldScale = stage.scaleX();
                  const pointer = stage.getPointerPosition();
                  if (!pointer) return;
                  const stagePosition = stage.position();
                  const mousePointTo = {
                    x: (pointer.x - stagePosition.x) / oldScale,
                    y: (pointer.y - stagePosition.y) / oldScale,
                  };
                  const direction = e.evt.deltaY > 0 ? -1 : 1;
                  const unclampedScale = direction > 0 ? oldScale * ZOOM_STEP : oldScale / ZOOM_STEP;
                  const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, unclampedScale));
                  setViewport({
                    scale: newScale,
                    x: pointer.x - mousePointTo.x * newScale,
                    y: pointer.y - mousePointTo.y * newScale,
                  });
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => {
                  setIsPanning(false);
                }}
                onDragMove={(e) => {
                  if (!isPanning) return;
                  const stage = e.target;
                  const stagePosition = stage.position();
                  setViewport((prev) => ({
                    ...prev,
                    x: stagePosition.x,
                    y: stagePosition.y,
                  }));
                }}
                onDragEnd={(e) => {
                  const stage = e.target;
                  const stagePosition = stage.position();
                  setViewport((prev) => ({
                    ...prev,
                    x: stagePosition.x,
                    y: stagePosition.y,
                  }));
                  setIsPanning(false);
                }}
                style={{ cursor: drawingMode ? 'crosshair' : isPanning ? 'grabbing' : hoveredZoneId ? 'grab' : 'default' }}
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
