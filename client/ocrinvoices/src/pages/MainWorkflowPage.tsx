import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '../dashboard/layout';
import TopPanel from '@/components/invcbatchworkflow/top-panel';
import ZipUploader from '@/components/invcbatchworkflow/zip-uploader';
import PageViewer from '@/components/invcbatchworkflow/invcpage-viewer';
import Toolbox from '@/components/invcbatchworkflow/toolbox';
import { v4 as uuidv4 } from "uuid";


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

interface PageData {
  filename: string;
  imageUrl: string;
  baseZones: Zone[];
  zones: Zone[];
  values: Record<string, string>;
  isLocked?: boolean;
  invoiceDateField?: string;
  invoiceNumberField?: string;
  totalValueField?: string;
  documentWidth: number;
  templateWidth: number | null;
  pageScaleMultiplier: number;
}


export default function MainWorkflowPage() {
  const [uploadedFileName, setUploadedFileName] = useState('');
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

  const normalizeZones = (zones: any[]): Zone[] => {
    return zones.map((zone) => ({
      ...zone,
      x: Number(zone.x),
      y: Number(zone.y),
      width: Number(zone.width),
      height: Number(zone.height),
    }));
  };

  const getEffectiveTemplateWidth = (documentWidth: number, templateWidth: number | null | undefined) => {
    if (templateWidth && templateWidth > 0) {
      return templateWidth;
    }
    return documentWidth > 0 ? documentWidth : 1;
  };

  const scaleZonesForPage = (
    baseZones: Zone[],
    documentWidth: number,
    templateWidth: number | null | undefined,
    pageScaleMultiplier: number
  ): Zone[] => {
    const safeTemplateWidth = getEffectiveTemplateWidth(documentWidth, templateWidth);
    const effectiveScale = (documentWidth / safeTemplateWidth) * pageScaleMultiplier;

    return baseZones.map((zone) => ({
      ...zone,
      x: Math.round(zone.x * effectiveScale),
      y: Math.round(zone.y * effectiveScale),
      width: Math.round(zone.width * effectiveScale),
      height: Math.round(zone.height * effectiveScale),
    }));
  };

  const getTemplateVersionBaseName = (profileName: string) => {
    return profileName.replace(/_v\d+$/, '');
  };

  const getNextTemplateVersionName = (profileName: string) => {
    const baseName = getTemplateVersionBaseName(profileName);
    const versionPattern = new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_v(\\d+)$`);
    let maxVersion = profiles.includes(baseName) ? 1 : 0;

    profiles.forEach((existingProfile) => {
      const match = existingProfile.match(versionPattern);
      if (!match) return;
      const version = Number(match[1]);
      if (Number.isFinite(version)) {
        maxVersion = Math.max(maxVersion, version);
      }
    });

    return `${baseName}_v${Math.max(2, maxVersion + 1)}`;
  };

  const buildPageState = (
    rawPage: any,
    templateWidthOverride?: number | null
  ): PageData => {
    const baseZones = normalizeZones(rawPage.zones || []);
    const documentWidth = Number(rawPage.documentWidth || 0);
    const templateWidth = templateWidthOverride ?? (rawPage.templateWidth != null ? Number(rawPage.templateWidth) : null);
    const pageScaleMultiplier = Number(rawPage.pageScaleMultiplier ?? 1);

    return {
      ...rawPage,
      baseZones,
      zones: scaleZonesForPage(baseZones, documentWidth, templateWidth, pageScaleMultiplier),
      isLocked: false,
      documentWidth,
      templateWidth,
      pageScaleMultiplier,
    };
  };

  const buildPageFromTemplate = (
    currentPage: PageData,
    baseZones: Zone[],
    templateWidth: number | null
  ): PageData => {
    const pageScaleMultiplier = currentPage.pageScaleMultiplier ?? 1;

    return {
      ...currentPage,
      baseZones,
      zones: scaleZonesForPage(baseZones, currentPage.documentWidth, templateWidth, pageScaleMultiplier),
      values: {},
      templateWidth,
      pageScaleMultiplier,
    };
  };

  const loadImageDimensions = (src: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const image = new window.Image();
      image.onload = () => resolve({ width: image.width, height: image.height });
      image.onerror = () => reject(new Error('Unable to load image dimensions'));
      image.src = src;
    });
  };

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
        const names = data.zones.map((z: any) => z.propertyName);
        setPropertyNames(names);

        if (!invoiceDateField) {
          const match = names.find((p: string) => p.toLowerCase().includes("dat"));
          if (match) setInvoiceDateField(match);
        }
        if (!invoiceNumberField) {
          const match = names.find((p: string) => p.toLowerCase().includes("cis"));
          if (match) setInvoiceNumberField(match);
        }
        if (!totalValueField) {
          const match = names.find((p: string) => p.toLowerCase().includes("celk"));
          if (match) setTotalValueField(match);
        }
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
      const profileRes = await fetch(`http://localhost:8000/profiles/${data.profile}`);
      const profileData = await profileRes.json();
      const templateWidth = profileData?.templateWidth != null ? Number(profileData.templateWidth) : null;

      setSelectedProfile(data.profile);
      setBatchName(data.name || queueName);
      setPropertyNames((profileData?.zones || []).map((z: any) => z.propertyName));
      const pagesWithDimensions = await Promise.all(data.pages.map(async (p: any) => {
        const imageUrl = `/queues/${queueName}/${p.filename}`;
        const dimensions = await loadImageDimensions(`http://localhost:8000${imageUrl}`);
        return buildPageState({
          filename: p.filename,
          imageUrl,
          zones: p.zones,
          values: p.values || {},
          documentWidth: dimensions.width,
          templateWidth,
          pageScaleMultiplier: 1,
        }, templateWidth);
      }));
      setPages(pagesWithDimensions);
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

    setUploadedFileName(file.name);

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    const formData = new FormData();
    formData.append(isPdf ? 'image' : 'zip', file);
    formData.append('profile', selectedProfile);

    const res = await fetch(`http://localhost:8000/${isPdf ? 'process-image' : 'process-zip'}`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => null);
      alert(error?.detail || 'Error processing uploaded file.');
      return;
    }

    const data = await res.json();
    setPages(data.pages.map((p: any) => buildPageState(p)));
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

  const handleDeletePage = (pageIndex: number) => {
    setPages((prev) => prev.filter((_, index) => index !== pageIndex));
    setHighlightedZone((prev) => {
      if (!prev) return null;
      if (prev.pageIndex === pageIndex) return null;
      if (prev.pageIndex > pageIndex) {
        return { ...prev, pageIndex: prev.pageIndex - 1 };
      }
      return prev;
    });
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

  const handleSavePageAsTemplateVersion = async (pageIndex: number) => {
    const page = pages[pageIndex];
    if (!selectedProfile) {
      alert('Please select a template before saving a new template version.');
      return;
    }

    const newTemplateName = getNextTemplateVersionName(selectedProfile);
    const formData = new FormData();
    formData.append('name', newTemplateName);
    formData.append('zones', JSON.stringify(page.zones));
    formData.append('systemValues', JSON.stringify(systemValues || {}));

    const imageRes = await fetch(`http://localhost:8000${page.imageUrl}`);
    if (!imageRes.ok) {
      alert('Unable to load page image for template save.');
      return;
    }

    const imageBlob = await imageRes.blob();
    formData.append('image', imageBlob, page.filename);

    const saveRes = await fetch('http://localhost:8000/profiles/', {
      method: 'POST',
      body: formData,
    });

    if (!saveRes.ok) {
      alert('Error saving new template version.');
      return;
    }

    setProfiles((prev) => {
      const nextProfiles = new Set(prev);
      nextProfiles.add(newTemplateName);
      return Array.from(nextProfiles).sort((a, b) => a.localeCompare(b));
    });
    setSelectedProfile(newTemplateName);
    await handleApplyTemplateToAllPages(newTemplateName);
    alert(`Template saved as "${newTemplateName}".`);
  };

  const handleApplyTemplateToAllPages = async (profile: string) => {
    if (!profile || pages.length === 0) return;

    const res = await fetch(`http://localhost:8000/profiles/${profile}`);
    const data = await res.json();
    const baseZones = normalizeZones(data?.zones || []);
    const templateWidth = data?.templateWidth != null ? Number(data.templateWidth) : null;

    setSelectedProfile(profile);
    setPropertyNames(baseZones.map((z: any) => z.propertyName));

    setPages((prev) =>
      prev.map((page) => buildPageFromTemplate(page, baseZones, templateWidth))
    );
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

      const osvRaw = values.osv || "0";
      const total_value = parseFloat(osvRaw.replace(/\s/g, "").replace(",", "."));



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
            fileName={uploadedFileName}
            allowPdf
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
          <div key={i} className="space-y-3">
            <div className="bg-gray-100 p-4 rounded space-y-3">
              <div className="flex items-center gap-4 text-sm">
                <div>
                  Auto width ratio:{' '}
                  <span className="font-medium">
                    {(
                      page.documentWidth /
                      getEffectiveTemplateWidth(page.documentWidth, page.templateWidth)
                    ).toFixed(3)}
                  </span>
                </div>
                <label className="flex items-center gap-2">
                  <span>Page scale multiplier</span>
                  <input
                    type="number"
                    min="0.1"
                    step="0.01"
                    value={page.pageScaleMultiplier}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      if (!Number.isFinite(value) || value <= 0) return;

                      setPages((prev) => {
                        const updated = [...prev];
                        const currentPage = updated[i];
                        updated[i] = {
                          ...currentPage,
                          pageScaleMultiplier: value,
                          zones: scaleZonesForPage(
                            currentPage.baseZones,
                            currentPage.documentWidth,
                            currentPage.templateWidth,
                            value
                          ),
                        };
                        return updated;
                      });
                    }}
                    className="w-24 border p-2"
                  />
                </label>
                <button
                  onClick={() => handleSavePageAsTemplateVersion(i)}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
                >
                  Save as Template Version
                </button>
                <button
                  onClick={() => handleApplyTemplateToAllPages(selectedProfile)}
                  className="bg-slate-600 text-white px-3 py-1 rounded text-sm"
                >
                  Reload Template to All Pages
                </button>
              </div>
            </div>

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
              onDeletePage={() => handleDeletePage(i)}
              onDeleteItemRow={(rowId) => {
                setPages(prev => {
                  const updated = [...prev];
                  const currentPage = updated[i];
                  const newZones = currentPage.zones.filter(z => z.rowId !== rowId);
                  const remainingValues = { ...currentPage.values };
                  newZones.forEach(z => {
                    if (!(z.propertyName in remainingValues)) {
                      delete remainingValues[z.propertyName];
                    }
                  });

                  updated[i] = {
                    ...currentPage,
                    zones: newZones,
                    values: remainingValues,
                  };
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
          </div>
        ))}

      </div>
    </DashboardLayout>
  );
}
