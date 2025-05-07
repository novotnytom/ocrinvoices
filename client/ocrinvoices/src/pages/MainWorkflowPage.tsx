import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '../dashboard/layout';
import TopPanel from '@/components/invcbatchworkflow/top-panel';
import ZipUploader from '@/components/invcbatchworkflow/zip-uploader';
import PageViewer from '@/components/invcbatchworkflow/invcpage-viewer';
import Toolbox from '@/components/invcbatchworkflow/toolbox';
import axios from "axios";
import { v4 as uuidv4 } from "uuid";


interface Zone {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  propertyName: string;
}

interface PageData {
  filename: string;
  imageUrl: string;
  zones: Zone[];
  values: Record<string, string>;
  isLocked?: boolean;
  invoiceDateField?: string;
  invoiceNumberField?: string;
  totalValueField?: string;
}


export default function MainWorkflowPage() {
  const [zipFileName, setZipFileName] = useState('');
  const [profiles, setProfiles] = useState<string[]>([]);
  const [selectedProfile, setSelectedProfile] = useState('');
  const [batchName, setBatchName] = useState('');
  const [propertyNames, setPropertyNames] = useState<string[]>([]);
  const [systemValues, setSystemValues] = useState<Record<string, string>>({});
  const [invoiceDateField, setInvoiceDateField] = useState("");
  const [invoiceNumberField, setInvoiceNumberField] = useState("");
  const [totalValueField, setTotalValueField] = useState("");
  const [pages, setPages] = useState<PageData[]>([]);
  const [highlightedZone, setHighlightedZone] = useState<{ pageIndex: number; property: string } | null>(null);
  const [searchParams] = useSearchParams();
  const queueName = searchParams.get('queue');
  const isEditing = !!queueName;

  useEffect(() => {
    const loadProfiles = async () => {
      const res = await fetch('http://localhost:8000/profiles');
      const data = await res.json();
      setProfiles(data.map((p: any) => p.name));
    };
    loadProfiles();
  }, []);

  useEffect(() => {
    if (!selectedProfile) return;

    const loadProfileFields = async () => {
      const res = await fetch(`http://localhost:8000/profiles/${selectedProfile}`);
      const data = await res.json();

      if (data && data.zones) {
        setPropertyNames(data.zones.map((z: any) => z.propertyName));
      }

      // Suggest common mappings only if not already selected
      if (!invoiceDateField) {
        const match = propertyNames.find(p => p.toLowerCase().includes("dat"));
        if (match) setInvoiceDateField(match);
      }
      if (!invoiceNumberField) {
        const match = propertyNames.find(p => p.toLowerCase().includes("cis"));
        if (match) setInvoiceNumberField(match);
      }
      if (!totalValueField) {
        const match = propertyNames.find(p => p.toLowerCase().includes("celk"));
        if (match) setTotalValueField(match);
      }

      // load system fields from export-template
      const templateRes = await fetch("http://localhost:8000/export-template/load");
      const templateFields = await templateRes.json();
      const systemFields = templateFields.filter((f: any) => f.system === true);
      setSystemValues(prev => {
        if (Object.keys(prev).length > 0) return prev; // preserve already loaded values
        return Object.fromEntries(systemFields.map((f: any) => [f.name, ""]));
      });
    };

    loadProfileFields();
  }, [selectedProfile]);


  useEffect(() => {
    if (!queueName) return;

    const loadQueue = async () => {
      const res = await fetch(`http://localhost:8000/queues/${queueName}`);
      const data = await res.json();

      setSelectedProfile(data.profile);
      setBatchName(data.name || queueName);
      setPages(data.pages.map((p: any) => ({
        filename: p.filename,
        imageUrl: `/queues/${queueName}/${p.filename}`,
        zones: p.zones,
        values: p.values || {},
        isLocked: false
      })));
      setSystemValues(data.systemValues || {});
      if (data.fieldMapping) {
        setInvoiceDateField(data.fieldMapping.invoiceDateField || "");
        setInvoiceNumberField(data.fieldMapping.invoiceNumberField || "");
        setTotalValueField(data.fieldMapping.totalValueField || "");
      }

    };
    loadQueue();
  }, [queueName]);

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProfile) return;

    setZipFileName(file.name); // <--- Track the file name

    const formData = new FormData();
    formData.append('zip', file);
    formData.append('profile', selectedProfile);

    const res = await fetch('http://localhost:8000/process-zip', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    setPages(data.pages.map((p: any) => ({
      ...p,
      isLocked: false
    })));
  };


  const updateZonePosition = (pageIndex: number, zoneId: number, x: number, y: number) => {
    setPages(prev => {
      const updated = [...prev];
      updated[pageIndex].zones = updated[pageIndex].zones.map(z =>
        z.id === zoneId ? { ...z, x: Math.round(x), y: Math.round(y) } : z
      );
      return updated;
    });
  };

  const handleOCRPage = async (pageIndex: number) => {
    const page = pages[pageIndex];
    const formData = new FormData();
    const res = await fetch(`http://localhost:8000${page.imageUrl}`);
    const blob = await res.blob();
    formData.append('image', blob, page.filename);
    formData.append('zones', JSON.stringify(page.zones));

    const response = await fetch('http://localhost:8000/ocr/test', {
      method: 'POST',
      body: formData
    });
    const data = await response.json();
    const resultMap: Record<string, string> = {};
    data.results.forEach((r: any) => resultMap[r.propertyName] = r.text);

    setPages(prev => {
      const updated = [...prev];
      updated[pageIndex].values = resultMap;
      return updated;
    });
  };

  const handleOCRAll = async () => {
    for (let i = 0; i < pages.length; i++) {
      if (!pages[i].isLocked) {
        await handleOCRPage(i);
      }
    }
  };

  const handleSaveQueue = async () => {
    if (!batchName || !selectedProfile || pages.length === 0) return;

    const formData = new FormData();
    formData.append("name", batchName);
    formData.append("profile", selectedProfile);
    formData.append("systemValues", JSON.stringify(systemValues));
    formData.append("fieldMapping", JSON.stringify({
      invoiceDateField,
      invoiceNumberField,
      totalValueField
    }));


    const valuesToSave = pages.map(p => ({
      filename: p.filename,
      zones: p.zones,
      values: p.values
    }));
    formData.append("values", JSON.stringify(valuesToSave));

    for (const page of pages) {
      const res = await fetch(`http://localhost:8000${page.imageUrl}`);
      const blob = await res.blob();
      formData.append("files", blob, page.filename);
    }

    const res = await fetch("http://localhost:8000/queues", {
      method: "POST",
      body: formData
    });

    if (res.ok) {
      alert("Invoice queue saved!");
    } else {
      alert("Error saving queue");
    }
  };

  const handleExportJson = () => {
    const exportData = {
      name: batchName,
      profile: selectedProfile,
      systemValues,
      pages: pages.map(p => {
        // Extract invoice items by rowId
        const itemZones = p.zones.filter(z => z.isItem);
        const grouped: Record<number, Record<string, string>> = {};

        for (const zone of itemZones) {
          const row = zone.rowId ?? 0;
          if (!grouped[row]) grouped[row] = {};
          grouped[row][zone.propertyName.replace(/_r\d+$/, '')] = p.values[zone.propertyName] || '';
        }

        const invoiceItems = Object.values(grouped);

        return {
          filename: p.filename,
          values: { ...systemValues, ...p.values },  // merged p.values(before)
          zones: p.zones,
          invoiceItems
        };
      })
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${batchName || 'invoices'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePropagateToOverview = async ({
    invoiceDateField,
    invoiceNumberField,
    totalValueField,
  }: {
    invoiceDateField: string;
    invoiceNumberField: string;
    totalValueField: string;
  }) => {
    const normalizeDate = (input: string): string => {
      const parts = input.match(/(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{2,4})/);
      if (!parts) return input;
      const [, day, month, year] = parts;
      return `${year.length === 2 ? '20' + year : year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    };
  
    const normalizeDecimal = (val: string): string => val.replace(',', '.');
  
    const invoiceItemKeys = ["nazev", "cenaMj", "mnozMj", "szbDph", "slevaMnoz", "slevaPol", "slevaDokl"];
  
    for (const [idx, page] of pages.entries()) {
      // Extract invoice items from zones (same logic as in export)
      const itemZones = (page.zones ?? []).filter(z => z.isItem);
      const grouped: Record<number, Record<string, string>> = {};
  
      for (const zone of itemZones) {
        const row = zone.rowId ?? 0;
        if (!grouped[row]) grouped[row] = {};
        grouped[row][zone.propertyName.replace(/_r\d+$/, "")] =
          page.values?.[zone.propertyName] || "";
      }
  
      const invoiceItems = Object.values(grouped);
  
      // ✅ Normalize decimal values in invoice items
      invoiceItems.forEach(item => {
        invoiceItemKeys.forEach(key => {
          if (item[key]) {
            item[key] = normalizeDecimal(item[key]);
          }
        });
      });
  
      // ✅ Filter values: exclude invoice item keys
      const nonItemValues = Object.fromEntries(
        Object.entries(page.values ?? {}).filter(
          ([key]) => !invoiceItemKeys.some(k => key.startsWith(k))
        )
      );
  
      const values = { ...systemValues, ...nonItemValues };
  
      // ✅ Normalize date fields in values
      ["datVyst", "datSplat"].forEach((key) => {
        if (values[key]) {
          values[key] = normalizeDate(values[key]);
        }
      });
  
      // ✅ Calculate total_value from invoiceItems
      const total_value = invoiceItems.reduce((sum, item) => {
        const cena = parseFloat(item.cenaMj || "0");
        const mnoz = parseFloat(item.mnozMj || "0");
        const dph = parseFloat(item.szbDph || "0");
        return sum + cena * mnoz * (1 + dph / 100);
      }, 0);
  
      // Final payload
      const fullInvoice = {
        id: uuidv4(),
        batch_name: batchName,
        order: idx,
        selected: true,
        values,
        invoiceItems,
        systemValues,
        accounting_info: "",
        company_id: "",
        imageFilename: page.filename,
        template_used: selectedProfile,
        invoice_date: normalizeDate(page.values[invoiceDateField] || ""),
        invoice_number: page.values[invoiceNumberField] || "",
        total_value: total_value,
      };
  
      // Send to backend
      await fetch("http://localhost:8000/overview/save_invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fullInvoice),
      });
    }
  
    alert("Propagation to overview completed!");
  };
 

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <TopPanel
          profiles={profiles}
          selectedProfile={selectedProfile}
          setSelectedProfile={setSelectedProfile}
          // Dropdown mappings for overview export
          invoiceDateField={invoiceDateField}
          setInvoiceDateField={setInvoiceDateField}
          invoiceNumberField={invoiceNumberField}
          setInvoiceNumberField={setInvoiceNumberField}
          totalValueField={totalValueField}
          setTotalValueField={setTotalValueField}
          systemValues={systemValues}
          setSystemValues={setSystemValues}
          batchName={batchName}
          setBatchName={setBatchName}
          onSave={handleSaveQueue}
          isEditing={isEditing}
          propertyNames={propertyNames}
          invoices={pages.map(page => ({ ...page.values, template: selectedProfile }))}
          onPropagate={() =>
            handlePropagateToOverview({ invoiceDateField, invoiceNumberField, totalValueField })
          }
        />



        {!isEditing && (
          <ZipUploader
            onUpload={handleZipUpload}
            disabled={!selectedProfile}
            fileName={zipFileName}
          />
        )}


        {pages.length > 0 && (
          <Toolbox
            onOCRAll={handleOCRAll}
            disabled={pages.length === 0}
          />
        )}

        {pages.length > 0 && (
          <div className="flex justify-end">
            <button
              onClick={handleExportJson}
              className="text-xs bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded"
            >
              💾 Export Batch as JSON
            </button>
          </div>
        )}



        {pages.map((page, i) => (
          <PageViewer
            key={i}
            pageIndex={i}
            imageUrl={page.imageUrl}
            zones={page.zones}
            values={page.values}
            referenceValues={i === 0 ? undefined : pages[0].values}
            highlightProperty={highlightedZone?.pageIndex === i ? highlightedZone.property : null}
            onZoneMove={(id, x, y) => updateZonePosition(i, id, x, y)}
            onValueChange={(property, value) => {
              setPages(prev => {
                const updated = [...prev];
                updated[i].values[property] = value;
                return updated;
              });
            }}
            onFocusZone={(property) => {
              if (property) setHighlightedZone({ pageIndex: i, property });
              else setHighlightedZone(null);
            }}
            onOCRPage={() => handleOCRPage(i)}
            onAddItemRow={() => {
              setPages(prev => {
                const updated = [...prev];
                const page = updated[i];

                // Use only base template zones (rowId === 0 or undefined)
                const baseItemZones = page.zones.filter(z => z.isItem && (!z.rowId || z.rowId === 0));

                const existingRowIds = page.zones
                  .filter(z => z.isItem && typeof z.rowId === 'number')
                  .map(z => z.rowId!);
                const maxRowId = existingRowIds.length > 0 ? Math.max(...existingRowIds) : 0;
                const nextRowId = maxRowId + 1;

                const maxId = Math.max(0, ...page.zones.map(z => z.id));
                const deltaY = 40;
                let nextId = maxId + 1;

                const newZones = baseItemZones.map(z => ({
                  ...z,
                  id: nextId++,
                  y: z.y + deltaY * nextRowId,
                  rowId: nextRowId,
                  propertyName: `${z.propertyName}_r${nextRowId}`
                }));

                page.zones = [...page.zones, ...newZones];
                updated[i] = page;
                return updated;
              });
            }}
            onDeleteItemRow={(rowId) => {
              setPages(prev => {
                const updated = [...prev];
                const page = updated[i];

                page.zones = page.zones.filter(z => z.rowId !== rowId);
                // Optionally also delete corresponding values
                const remainingValues = { ...page.values };
                page.zones.forEach(z => {
                  if (!(z.propertyName in remainingValues)) {
                    delete remainingValues[z.propertyName];
                  }
                });
                page.values = remainingValues;

                updated[i] = page;
                return updated;
              });
            }}
            isLocked={page.isLocked ?? false}
            onToggleLock={() => {
              setPages(prev => {
                const updated = [...prev];
                updated[i] = {
                  ...updated[i],
                  isLocked: !updated[i].isLocked,
                };
                return updated;
              });
            }}
            onZoneChange={(newZones) => {
              setPages(prev => {
                const updated = [...prev];
                updated[i] = {
                  ...updated[i],
                  zones: newZones,
                };
                return updated;
              });
            }}
          />
        ))}

      </div>
    </DashboardLayout>
  );
}