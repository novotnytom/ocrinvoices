import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

interface Zone {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  propertyName: string;
  isItem?: boolean;
}

interface OCRField {
  name: string;
  label: string;
  isVat: boolean;
  active: boolean;
}

interface ZoneSidebarProps {
  zones: Zone[];
  ocrResults: Record<string, string>;
  onUpdateZone: (id: number, propertyName: string) => void;
  onTestOCR: (zone: Zone) => void;
  onDeleteZone: (id: number) => void;
  onToggleItem: (id: number) => void;
  onResizeZone: (id: number, direction: 'width' | 'height' | 'width-' | 'height-') => void;
}

export default function ZoneSidebar({
  zones,
  ocrResults,
  onUpdateZone,
  onTestOCR,
  onDeleteZone,
  onToggleItem,
  onResizeZone,
}: ZoneSidebarProps) {
  const [availableFields, setAvailableFields] = useState<OCRField[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchAvailableFields();
    return () => stopHold();
  }, []);

  async function fetchAvailableFields() {
    try {
      const res = await fetch("http://localhost:8000/export-template/load");
      const data = await res.json();
      const activeOnly = data.filter((field: OCRField) => field.active);
      setAvailableFields(activeOnly);
    } catch (error) {
      console.error("Failed to fetch OCR fields", error);
    }
  }

  const handleHold = (id: number, direction: 'width' | 'height' | 'width-' | 'height-') => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => onResizeZone(id, direction), 60);
  };

  const stopHold = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  };

  return (
    <div className="w-[300px] border-l border-border p-4 space-y-4 overflow-y-auto">
      <div>
        <h3 className="text-sm font-medium mb-2">Zones</h3>
        {zones.map((zone) => {
          const resultText = ocrResults[zone.propertyName];
          return (
            <div key={zone.id} className="bg-muted/30 border rounded px-3 py-2 text-sm mb-3">
              <div className="flex items-center justify-between mb-2">
                <ToggleGroup type="multiple" className="flex gap-1">
                  <ToggleGroupItem
                    value="width-"
                    onMouseDown={() => handleHold(zone.id, 'width-')}
                    onMouseUp={stopHold}
                    onMouseLeave={stopHold}
                    aria-label="Decrease Width"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="width+"
                    onMouseDown={() => handleHold(zone.id, 'width')}
                    onMouseUp={stopHold}
                    onMouseLeave={stopHold}
                    aria-label="Increase Width"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </ToggleGroupItem>
                </ToggleGroup>
                <div className="text-xs text-muted-foreground px-1">Zone {zone.id}</div>
                <ToggleGroup type="multiple" className="flex gap-1">
                  <ToggleGroupItem
                    value="height-"
                    onMouseDown={() => handleHold(zone.id, 'height-')}
                    onMouseUp={stopHold}
                    onMouseLeave={stopHold}
                    aria-label="Decrease Height"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="height+"
                    onMouseDown={() => handleHold(zone.id, 'height')}
                    onMouseUp={stopHold}
                    onMouseLeave={stopHold}
                    aria-label="Increase Height"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="delete"
                    onClick={() => onDeleteZone(zone.id)}
                    aria-label="Delete Zone"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <Select value={zone.propertyName} onValueChange={(value) => onUpdateZone(zone.id, value)}>
                <SelectTrigger className="h-8 text-xs mb-2">
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent>
                  {availableFields.map((field) => {
                    const isUsedByOtherZone = zones.some(z => z.propertyName === field.name && z.id !== zone.id);

                    return (
                      <SelectItem
                        key={field.name}
                        value={field.name}
                        disabled={isUsedByOtherZone}
                        className={isUsedByOtherZone ? "text-muted-foreground cursor-not-allowed" : ""}
                      >
                        {field.label || field.name} {isUsedByOtherZone && " (used)"}
                      </SelectItem>
                    );
                  })}


                </SelectContent>
              </Select>

              <div className="flex gap-2 mb-2">
                <Button size="sm" variant="outline" onClick={() => onTestOCR(zone)}>OCR</Button>
                <div className="flex items-center space-x-2">
                  <Switch
                    id={`item-${zone.id}`}
                    checked={zone.isItem || false}
                    onCheckedChange={() => onToggleItem(zone.id)}
                  />
                  <label htmlFor={`item-${zone.id}`} className="text-xs">Invoice Item</label>
                </div>
              </div>

              {resultText && (
                <div className="text-[10px] text-muted-foreground mt-2">Detected: {resultText}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
