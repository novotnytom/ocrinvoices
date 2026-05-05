import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

type ResizeDirection = "width" | "width-" | "height" | "height-";
const HOLD_REPEAT_DELAY_MS = 150;
const HOLD_REPEAT_INTERVAL_MS = 60;

export default function ZoneResizeToolbar({
  selectedProperty,
  onResize,
}: {
  selectedProperty: string | null;
  onResize: (direction: ResizeDirection) => void;
}) {
  const holdTimeoutRef = useRef<number | null>(null);
  const holdIntervalRef = useRef<number | null>(null);
  const activeDirectionRef = useRef<ResizeDirection | null>(null);

  const stopHold = () => {
    activeDirectionRef.current = null;

    if (holdTimeoutRef.current !== null) {
      window.clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }

    if (holdIntervalRef.current !== null) {
      window.clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  };

  const startHold = (direction: ResizeDirection) => {
    stopHold();
    activeDirectionRef.current = direction;

    onResize(direction);

    holdTimeoutRef.current = window.setTimeout(() => {
      holdIntervalRef.current = window.setInterval(() => {
        if (activeDirectionRef.current !== direction) return;
        onResize(direction);
      }, HOLD_REPEAT_INTERVAL_MS);
    }, HOLD_REPEAT_DELAY_MS);
  };

  useEffect(() => {
    const handlePointerRelease = () => stopHold();

    window.addEventListener("mouseup", handlePointerRelease);
    window.addEventListener("touchend", handlePointerRelease);
    window.addEventListener("touchcancel", handlePointerRelease);

    return () => {
      stopHold();
      window.removeEventListener("mouseup", handlePointerRelease);
      window.removeEventListener("touchend", handlePointerRelease);
      window.removeEventListener("touchcancel", handlePointerRelease);
    };
  }, []);

  if (!selectedProperty) return null;

  return (
    <div className="flex gap-2 mb-2 bg-muted px-4 py-2 border rounded items-center">
      <span className="text-sm font-medium">
        Resize zone: <code>{selectedProperty}</code>
      </span>
      {([
        { label: "⬅ Shrink Width", direction: "width-" },
        { label: "➡ Grow Width", direction: "width" },
        { label: "⬆ Shrink Height", direction: "height-" },
        { label: "⬇ Grow Height", direction: "height" },
      ] as const).map(({ label, direction }) => (
        <Button
          key={direction}
          size="sm"
          onMouseDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            startHold(direction);
          }}
          onTouchStart={(event) => {
            event.preventDefault();
            startHold(direction);
          }}
          onTouchEnd={stopHold}
          onTouchCancel={stopHold}
          type="button"
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
