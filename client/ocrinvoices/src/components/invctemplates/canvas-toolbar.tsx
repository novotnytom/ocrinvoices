import { Button } from "@/components/ui/button";

interface CanvasToolbarProps {
    onChangeImage: () => void;
    onGlobalOCR: () => void;
    onAddZone: () => void;
    drawingMode: boolean;
}

export default function CanvasToolbar({ onChangeImage, onGlobalOCR, onAddZone, drawingMode }: CanvasToolbarProps) {
    return (
        <div className="bg-background border-b border-border px-6 py-2 flex gap-2 items-center">
            <Button variant="outline" onClick={onChangeImage}>Change Image</Button>
            <Button onClick={onGlobalOCR}>Global OCR</Button>
            <Button
                variant={drawingMode ? "secondary" : "default"}
                onClick={onAddZone}
            >
                {drawingMode ? "Drawing Active" : "Add Zone"}
            </Button>
        </div>
    );
}
