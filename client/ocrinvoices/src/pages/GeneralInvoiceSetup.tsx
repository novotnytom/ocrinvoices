// Refactored GeneralInvoiceSetup.tsx without VAT, now includes 'type' field
import { useState, useEffect } from "react";
import DashboardLayout from '../dashboard/layout';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DndContext, useSensor, useSensors, PointerSensor, closestCenter } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function GeneralInvoiceSetup() {
  const [fields, setFields] = useState([]);
  const [originalFields, setOriginalFields] = useState([]);
  const [activeFields, setActiveFields] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sortByXmlOrder, setSortByXmlOrder] = useState(true);

  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    loadInitialFields();
  }, []);

  async function loadInitialFields() {
    try {
      const res = await fetch("http://localhost:8000/export-template/load");
      const data = await res.json();
      if (data.length === 0) {
        setFields([]);
        setOriginalFields([]);
        updateActiveFields([]);
      } else {
        setFields(data);
        setOriginalFields(data);
        updateActiveFields(data);
      }
    } catch (err) {
      console.error("Failed to load export template", err);
    }
  }

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const saveRes = await fetch("http://localhost:8000/export-template/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!saveRes.ok) throw new Error("Failed to save uploaded template to backend");
      setFields(data);
      setOriginalFields(data);
      updateActiveFields(data);
      console.log("Uploaded template imported and saved to backend");
    } catch (err) {
      console.error("Error uploading template", err);
    }
  }

  function toggleFieldActive(index) {
    const newFields = [...fields];
    newFields[index].active = !newFields[index].active;
    setFields(newFields);
    updateActiveFields(newFields);
  }

  function toggleFieldSystem(index) {
    const newFields = [...fields];
    newFields[index].system = !newFields[index].system;
    setFields(newFields);
  }

  function changeLabel(index, value) {
    const newFields = [...fields];
    newFields[index].label = value;
    setFields(newFields);
    updateActiveFields(newFields);
  }

  function updateActiveFields(allFields) {
    const active = allFields.filter(f => f.active);
    setActiveFields(active);
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = activeFields.findIndex(f => f.name === active.id);
      const newIndex = activeFields.findIndex(f => f.name === over?.id);
      setActiveFields(arrayMove(activeFields, oldIndex, newIndex));
    }
  }

  async function confirmSaveTemplate() {
    setShowConfirm(true);
  }

  async function saveTemplate() {
    try {
      const payload = fields.map(f => ({
        name: f.name,
        active: f.active ?? false,
        system: f.system ?? false,
        label: f.label,
        info: f.info ?? "",
        example: f.example ?? "",
        type: f.type ?? "string"
      }));
      const res = await fetch("http://localhost:8000/export-template/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Save failed");
      console.log("Export template saved successfully");
      setShowConfirm(false);
    } catch (err) {
      console.error("Failed to save export template", err);
    }
  }

  function DraggableRow({ field }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field.name });
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };
    return (
      <TableRow ref={setNodeRef} style={style} {...attributes} {...listeners} className="hover:bg-muted cursor-move">
        <TableCell className="w-4 text-muted-foreground">
          <GripVertical className="h-4 w-4 opacity-50" />
        </TableCell>
        <TableCell className="text-left">{field.label || field.name}</TableCell>
        <TableCell className="text-left">{field.name}</TableCell>
      </TableRow>
    );
  }

  function toggleSortOrder() {
    if (sortByXmlOrder) {
      setFields([...originalFields].sort((a, b) => a.name.localeCompare(b.name)));
    } else {
      setFields([...originalFields]);
    }
    setSortByXmlOrder(!sortByXmlOrder);
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-screen">
        <div className="bg-muted px-6 py-4 border-b border-border">
          <h1 className="text-lg font-semibold">Export Template for ABBRA FLEXIBEE</h1>
        </div>
        <div className="p-4 space-y-6">
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={toggleSortOrder}>
              {sortByXmlOrder ? "Sort A-Z" : "Sort by XML Order"}
            </Button>
            <Button variant="outline" size="sm" onClick={loadInitialFields}>
              Reload Template from Backend
            </Button>
            <label className="flex items-center gap-2">
              <span className="text-sm">Import Template:</span>
              <input type="file" accept="application/json" onChange={handleFileUpload} className="hidden" />
              <Button variant="outline" size="sm" asChild>
                <span>Choose File</span>
              </Button>
            </label>
            <Button variant="default" size="sm" onClick={confirmSaveTemplate}>
              Save Current Template
            </Button>
          </div>

          {fields.length === 0 ? (
            <div className="text-center text-muted-foreground mt-10">
              No Template Loaded Yet
            </div>
          ) : (
            <div className="flex gap-6">
              <div className="flex-1 overflow-auto max-h-[80vh] rounded-xl border bg-background p-2 shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-background">
                      <TableHead>XML Field</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>OCR</TableHead>
                      <TableHead>System</TableHead>                      
                      <TableHead>Example</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, idx) => (
                      <TableRow key={field.name} className={field.active ? "bg-muted/50 border-l-4 border-primary" : ""}>
                        <TableCell className="text-left">
                          {field.info ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help underline decoration-dotted underline-offset-4">
                                    {field.name}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-[300px] text-sm">{field.info}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            field.name
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            className="w-44 text-xs"
                            value={field.label}
                            onChange={(e) => changeLabel(idx, e.target.value)}
                            disabled={!field.active}
                          />
                        </TableCell>
                        <TableCell>
                          <Checkbox checked={field.active} onCheckedChange={() => toggleFieldActive(idx)} />
                        </TableCell>
                        <TableCell>
                          <Checkbox checked={field.system} onCheckedChange={() => toggleFieldSystem(idx)} />
                        </TableCell>                        
                        <TableCell className="text-xs text-muted-foreground text-left">
                          {field.example}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="w-80 sticky top-4 h-fit border rounded-xl bg-muted/10 p-4 shadow-md">
                <h2 className="text-xl font-semibold mb-2">Active OCR Fields</h2>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={activeFields.map(f => f.name)} strategy={verticalListSortingStrategy}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-4"></TableHead>
                          <TableHead>Friendly Name</TableHead>
                          <TableHead>XML Field</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeFields.map((field) => (
                          <DraggableRow key={field.name} field={field} />
                        ))}
                      </TableBody>
                    </Table>
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          )}

          <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
            <DialogTrigger asChild>
              <span />
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>Save Export Template</DialogTitle>
              <p>Are you sure you want to save the current Export Template configuration?</p>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setShowConfirm(false)}>Cancel</Button>
                <Button onClick={saveTemplate}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </DashboardLayout>
  );
}
