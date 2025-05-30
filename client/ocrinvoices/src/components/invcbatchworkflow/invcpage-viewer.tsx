// Updated PageViewer.tsx with Move-All Delta Logic

import React, { useState, useRef } from 'react';
import { Stage, Layer, Rect, Text, Image as KonvaImage } from 'react-konva';
import { Button } from '@/components/ui/button';
import useImage from 'use-image';
import ZoneResizeToolbar from './zone-resize-toolbar';

interface Zone {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  propertyName: string;
  isItem?: boolean;
  rowId?: number;
}

interface PageViewerProps {
  pageIndex: number;
  imageUrl: string;
  zones: Zone[];
  values: Record<string, string>;
  highlightProperty: string | null;
  onZoneMove: (id: number, x: number, y: number) => void;
  onValueChange: (property: string, value: string) => void;
  onFocusZone: (property: string | null) => void;
  onOCRPage: () => void;  
  onDeleteItemRow: (rowId: number) => void;
  isLocked: boolean;
  onToggleLock: () => void;
  referenceValues?: Record<string, string>;
  onZoneChange?: (zones: Zone[]) => void;
}

export default function PageViewer({
  pageIndex,
  imageUrl,
  zones,
  values,
  highlightProperty,
  onZoneMove,
  onValueChange,
  onFocusZone,
  onOCRPage,  
  onDeleteItemRow,
  isLocked,
  onToggleLock,
  referenceValues,
  onZoneChange,
}: PageViewerProps) {
  const [image] = useImage(`http://localhost:8000${imageUrl}`, 'anonymous');
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [deltaMove, setDeltaMove] = useState<{ dx: number; dy: number; movedZoneId: number } | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const [itemRowYOffset, setItemRowYOffset] = useState(40); // default 40
  const stageRef = useRef<any>(null);

  const itemZones = zones.filter(z => z.isItem);
  const nonItemZones = zones.filter(zone => !zone.isItem);

  const groupedItemZones: Record<number, Zone[]> = {};
  itemZones.forEach(zone => {
    const row = zone.rowId ?? 0;
    if (!groupedItemZones[row]) groupedItemZones[row] = [];
    groupedItemZones[row].push(zone);
  });

  const rowIds = Object.keys(groupedItemZones).map(Number).sort();
  const uniqueHeaders = Array.from(
    new Set(itemZones.map(z => z.propertyName.replace(/_r\d+$/, '')))
  ).sort();

  const handleApplyMoveAll = () => {
    if (!deltaMove) return;
    zones.forEach(zone => {
      if (zone.id !== deltaMove.movedZoneId) {
        onZoneMove(zone.id, zone.x + deltaMove.dx, zone.y + deltaMove.dy);
      }
    });
    setDeltaMove(null);
  };

  const handleInputFocus = (propertyName: string | null) => {
    setSelectedProperty(propertyName);
    onFocusZone?.(propertyName);
  };

  const handleResizeZone = (direction: 'width' | 'width-' | 'height' | 'height-') => {
    if (!selectedProperty) return;

    const updatedZones = zones.map((z) =>
      z.propertyName === selectedProperty
        ? {
          ...z,
          width:
            direction === 'width' ? z.width + 1 :
              direction === 'width-' ? Math.max(5, z.width - 1) :
                z.width,
          height:
            direction === 'height' ? z.height + 1 :
              direction === 'height-' ? Math.max(5, z.height - 1) :
                z.height,
        }
        : z
    );

    onZoneChange?.(updatedZones);
  };

  const handleAddRow = () => {
    const baseItemZones = zones.filter(z => z.isItem && (!z.rowId || z.rowId === 0));
  
    const existingRowIds = zones
      .filter(z => z.isItem && typeof z.rowId === 'number')
      .map(z => z.rowId!);
    const maxRowId = existingRowIds.length > 0 ? Math.max(...existingRowIds) : 0;
    const nextRowId = maxRowId + 1;
  
    const maxId = Math.max(0, ...zones.map(z => z.id));
    let nextId = maxId + 1;
  
    const newZones = baseItemZones.map(z => ({
      ...z,
      id: nextId++,
      y: z.y + itemRowYOffset * nextRowId,
      rowId: nextRowId,
      propertyName: `${z.propertyName}_r${nextRowId}`
    }));
  
    onZoneChange?.([...zones, ...newZones]);
  };
  

  return (
    <div className="p-4 border rounded space-y-4">
      <div className="flex gap-4">
        <div className="w-[700px] bg-gray-100 p-4 rounded">
          <div>
            {selectedProperty && (
              <ZoneResizeToolbar
                selectedProperty={selectedProperty}
                onResize={handleResizeZone}
              />
            )}
          </div>
          <Stage
            ref={stageRef}
            width={650}
            height={800}
            scaleX={scale}
            scaleY={scale}
            x={position.x}
            y={position.y}
            onWheel={(e) => {
              e.evt.preventDefault();
              const stage = stageRef.current;
              const oldScale = stage.scaleX();
              const pointer = stage.getPointerPosition();
              if (!pointer) return;

              const scaleBy = 1.05;
              const direction = e.evt.deltaY > 0 ? -1 : 1;
              const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

              setScale(newScale);

              const mousePointTo = {
                x: (pointer.x - position.x) / oldScale,
                y: (pointer.y - position.y) / oldScale,
              };

              setPosition({
                x: pointer.x - mousePointTo.x * newScale,
                y: pointer.y - mousePointTo.y * newScale,
              });
            }}
            onMouseDown={(e) => {
              if (e.evt.button === 1) {
                stageRef.current.startDrag();
              }
            }}
            onDragMove={(e) => {
              const newX = e.target.x();
              const newY = e.target.y();
              const dx = newX - zone.x;
              const dy = newY - zone.y;

              setDeltaMove({ dx, dy, movedZoneId: zone.id });
            }}


            style={{ border: '1px solid #ccc', cursor: 'grab' }}
          >
            <Layer>
              {image && <KonvaImage image={image} />}
              {zones.map(zone => (
                <React.Fragment key={zone.id}>
                  <Text
                    x={zone.x}
                    y={zone.y - 12}
                    text={zone.propertyName}
                    fontSize={10}
                    fill={zone.isItem ? 'orange' : 'red'}
                  />
                  <Rect
                    x={zone.x}
                    y={zone.y}
                    width={zone.width}
                    height={zone.height}
                    stroke={zone.propertyName === highlightProperty ? 'green' : (zone.isItem ? 'orange' : 'red')}
                    strokeWidth={2}
                    draggable
                    onDragEnd={(e) => {
                      const newX = e.target.x();
                      const newY = e.target.y();
                      const dx = newX - zone.x;
                      const dy = newY - zone.y;
                      onZoneMove(zone.id, newX, newY);
                      if (!deltaMove) {
                        setDeltaMove({ dx, dy });
                      }
                    }}
                  />
                </React.Fragment>
              ))}
            </Layer>
          </Stage>
        </div>

        <div className="flex-1 bg-gray-200 p-4 rounded">
          <div className="flex items-center justify-between">
            <div>
              {deltaMove && (
                <button
                  onClick={handleApplyMoveAll}
                  className="text-xs bg-yellow-400 hover:bg-yellow-500 px-3 py-1 rounded"
                >
                  ➡️ Apply Move to All Zones
                </button>
              )}
              <button
                onClick={() => {
                  if (stageRef.current && image) {
                    const stageWidth = 800;
                    const stageHeight = 600;
                    const imageWidth = image.width;
                    const imageHeight = image.height;

                    const scaleX = stageWidth / imageWidth;
                    const scaleY = stageHeight / imageHeight;
                    const newScale = Math.min(scaleX, scaleY);

                    setScale(newScale);
                    setPosition({
                      x: (stageWidth - imageWidth * newScale) / 2,
                      y: (stageHeight - imageHeight * newScale) / 2,
                    });
                  }
                }}
                className="text-xs bg-gray-300 hover:bg-gray-400 px-3 py-1 rounded"
              >
                🔍 Fit Image
              </button>
            </div>
            <p className="font-semibold text-sm mb-1">Invoice Info</p>
            <label className="flex items-center text-xs gap-2">
              <input type="checkbox" checked={isLocked} onChange={onToggleLock} />
              Lock Page
            </label>
            <div>
              <button
                onClick={onOCRPage}
                className="bg-blue-500 text-white text-xs px-3 py-1 rounded"
                disabled={isLocked}
              >
                OCR This Page
              </button>
            </div>
          </div>

          {/* Non-item zones */}
          <div className="bg-muted/30 border rounded px-3 py-2 text-sm mb-3">
            <div className="space-y-3">
              {nonItemZones.map(zone => (
                <div key={zone.id} className="flex items-center gap-3">
                  <label className="min-w-[120px] text-xs font-medium text-right text-muted-foreground">{zone.propertyName}</label>
                  <input
                    type="text"
                    value={values[zone.propertyName] || ''}
                    className="flex-1 border border-input bg-background rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    onFocus={() => handleInputFocus(zone.propertyName)}
                    onBlur={() => onFocusZone(null)}
                    onChange={e => onValueChange(zone.propertyName, e.target.value)}
                  />
                  {referenceValues?.[zone.propertyName] !== undefined && (
                    <button
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => onValueChange(zone.propertyName, referenceValues[zone.propertyName])}
                    >
                      Copy
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>



      <div className="w-full p-4 rounded">
        {/* Item zones */}
        {itemZones.length > 0 && (
          <div>
            <p className="font-semibold text-sm mb-1">Invoice Items</p>
            <div className="overflow-auto border rounded">
              <table className="text-sm w-full table-auto">
                <thead className="bg-gray-100 text-xs font-semibold">
                  <tr>
                    {uniqueHeaders.map(h => (
                      <th key={h} className="p-2 border-b">{h}</th>
                    ))}
                    <th className="p-2 border-b">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rowIds.map(rowId => (
                    <tr key={rowId}>
                      {uniqueHeaders.map(header => {
                        const zone = groupedItemZones[rowId].find(z => z.propertyName.startsWith(header));
                        return (
                          <td key={header} className="p-2 border-b">
                            <input
                              type="text"
                              value={zone ? values[zone.propertyName] || '' : ''}
                              className="border p-1 w-full text-sm"
                              onFocus={() => handleInputFocus(zone?.propertyName ?? null)}
                              onBlur={() => onFocusZone(null)}
                              onChange={e => {
                                if (zone) {
                                  onValueChange(zone.propertyName, e.target.value);
                                }
                              }}
                            />
                          </td>
                        );
                      })}
                      <td className="p-2 border-b">
                        {rowId !== 0 && (
                          <button
                            onClick={() => onDeleteItemRow(rowId)}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-4 my-2">
              <button
                onClick={handleAddRow}
                className="text-xs bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded"
              >
                ➕ Add Row of Invoice Items
              </button>

              <label className="text-sm font-medium">Y Offset:</label>
              <input
                type="number"
                value={itemRowYOffset}
                onChange={(e) => setItemRowYOffset(Number(e.target.value))}
                className="w-20 border px-2 py-1 text-sm"
              />
            </div>
          </div>
        )}
      </div>

    </div>
  );
}