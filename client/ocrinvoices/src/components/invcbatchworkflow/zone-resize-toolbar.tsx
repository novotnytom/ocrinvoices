import { Button } from "@/components/ui/button";

export default function ZoneResizeToolbar({
  selectedProperty,
  onResize,
}: {
  selectedProperty: string | null;
  onResize: (direction: "width" | "width-" | "height" | "height-") => void;
}) {
  if (!selectedProperty) return null;

  return (
    <div className="flex gap-2 mb-2 bg-muted px-4 py-2 border rounded items-center">
      <span className="text-sm font-medium">
        Resize zone: <code>{selectedProperty}</code>
      </span>
      <Button size="sm" onClick={() => onResize("width-")}>⬅ Shrink Width</Button>
      <Button size="sm" onClick={() => onResize("width")}>➡ Grow Width</Button>
      <Button size="sm" onClick={() => onResize("height-")}>⬆ Shrink Height</Button>
      <Button size="sm" onClick={() => onResize("height")}>⬇ Grow Height</Button>
    </div>
  );
}