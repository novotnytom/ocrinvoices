import { useEffect, useState } from 'react';
import DashboardLayout from '../dashboard/layout';
import ImageUploader from '@/components/invcbatchworkflow/image-uploader';
import ZipUploader from '@/components/invcbatchworkflow/zip-uploader';
import PageViewer from '@/components/invcbatchworkflow/invcpage-viewer';
import Toolbox from '@/components/invcbatchworkflow/toolbox';
import { v4 as uuidv4 } from 'uuid';

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
  profile: string;
  batchName: string;
  propertyNames: string[];
  invoiceDateField: string;
  invoiceNumberField: string;
  totalValueField: string;
  systemValues: Record<string, string>;
  isLocked?: boolean;
  documentWidth: number;
  templateWidth: number | null;
  pageScaleMultiplier: number;
}

export default function VatModulePage() {
  const [profiles, setProfiles] = useState<string[]>([]);
  const [nextProfile, setNextProfile] = useState('');
  const [nextBatchName, setNextBatchName] = useState('');
  const [nextPropertyNames, setNextPropertyNames] = useState<string[]>([]);
  const [nextInvoiceDateField, setNextInvoiceDateField] = useState('');
  const [nextInvoiceNumberField, setNextInvoiceNumberField] = useState('');
  const [nextTotalValueField, setNextTotalValueField] = useState('');
  const [nextSystemValuesTemplate, setNextSystemValuesTemplate] = useState<Record<string, string>>({});
  const [pages, setPages] = useState<PageData[]>([]);
  const [highlightedZone, setHighlightedZone] = useState<{ pageIndex: number; property: string } | null>(null);
  const [systemFieldNames, setSystemFieldNames] = useState<string[]>([]);
  const [existingQueueNames, setExistingQueueNames] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadProfiles = async () => {
      const res = await fetch('http://localhost:8000/profiles');
      const data = await res.json();
      setProfiles(data.map((p: any) => p.name));
    };
    loadProfiles();
  }, []);

  useEffect(() => {
    const loadQueues = async () => {
      const res = await fetch('http://localhost:8000/queues');
      if (!res.ok) return;
      const data = await res.json();
      setExistingQueueNames(new Set((data || []).map((q: any) => q.name)));
    };
    loadQueues();
  }, []);

  useEffect(() => {
    const loadSystemFields = async () => {
      const templateRes = await fetch('http://localhost:8000/export-template/load');
      const templateFields = await templateRes.json();
      const systemFields = templateFields
        .filter((f: any) => f.system === true)
        .map((f: any) => f.name);
      setSystemFieldNames(systemFields);
    };
    loadSystemFields();
  }, []);

  useEffect(() => {
    if (!nextProfile) return;

    const loadProfileFields = async () => {
      const res = await fetch(`http://localhost:8000/profiles/${nextProfile}`);
      const data = await res.json();

      if (data && data.zones) {
        const names = data.zones.map((z: any) => z.propertyName);
        setNextPropertyNames(names);

        const matchDate = names.find((p: string) => p.toLowerCase().includes('dat')) || '';
        const matchNumber = names.find((p: string) => p.toLowerCase().includes('cis')) || '';
        const matchTotal = names.find((p: string) => p.toLowerCase().includes('celk')) || '';

        setNextInvoiceDateField(matchDate);
        setNextInvoiceNumberField(matchNumber);
        setNextTotalValueField(matchTotal);
        setNextSystemValuesTemplate(data.systemValues || {});
      }
    };

    loadProfileFields();
  }, [nextProfile]);

  useEffect(() => {
    if (nextProfile) return;
    setNextPropertyNames([]);
    setNextInvoiceDateField('');
    setNextInvoiceNumberField('');
    setNextTotalValueField('');
    setNextSystemValuesTemplate({});
  }, [nextProfile]);

  const createEmptySystemValues = () => {
    return Object.fromEntries(systemFieldNames.map((name) => [name, '']));
  };

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
    profile: string,
    batchName: string,
    propertyNames: string[],
    invoiceDateField: string,
    invoiceNumberField: string,
    totalValueField: string,
    baseSystemValues: Record<string, string>
  ): PageData => {
    const baseZones = normalizeZones(rawPage.zones || []);
    const documentWidth = Number(rawPage.documentWidth || 0);
    const templateWidth = rawPage.templateWidth != null ? Number(rawPage.templateWidth) : null;
    const pageScaleMultiplier = Number(rawPage.pageScaleMultiplier ?? 1);

    return {
      ...rawPage,
      baseZones,
      zones: scaleZonesForPage(baseZones, documentWidth, templateWidth, pageScaleMultiplier),
      isLocked: false,
      profile,
      batchName,
      propertyNames,
      invoiceDateField,
      invoiceNumberField,
      totalValueField,
      systemValues: { ...baseSystemValues },
      documentWidth,
      templateWidth,
      pageScaleMultiplier,
    };
  };

  const buildPageFromTemplate = (
    currentPage: PageData,
    profile: string,
    baseZones: Zone[],
    templateWidth: number | null,
    propertyNames: string[],
    invoiceDateField: string,
    invoiceNumberField: string,
    totalValueField: string,
    systemValuesTemplate: Record<string, string>
  ): PageData => {
    const pageScaleMultiplier = currentPage.pageScaleMultiplier ?? 1;

    return {
      ...currentPage,
      profile,
      baseZones,
      zones: scaleZonesForPage(baseZones, currentPage.documentWidth, templateWidth, pageScaleMultiplier),
      values: {},
      propertyNames,
      invoiceDateField,
      invoiceNumberField,
      totalValueField,
      templateWidth,
      pageScaleMultiplier,
      systemValues: Object.keys(systemValuesTemplate).length > 0
        ? { ...systemValuesTemplate }
        : createEmptySystemValues(),
    };
  };

  useEffect(() => {
    if (systemFieldNames.length === 0) return;
    setPages((prev) =>
      prev.map((page) =>
        page.systemValues && Object.keys(page.systemValues).length > 0
          ? page
          : { ...page, systemValues: createEmptySystemValues() }
      )
    );
  }, [systemFieldNames]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !nextProfile) return false;
    if (!nextBatchName.trim()) {
      alert('Please enter a batch name for this invoice.');
      return false;
    }

    const formData = new FormData();
    formData.append('image', file);
    formData.append('profile', nextProfile);

    const res = await fetch('http://localhost:8000/process-image', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => null);
      alert(error?.detail || 'Error processing uploaded file.');
      return false;
    }

    const data = await res.json();
    const baseSystemValues = Object.keys(nextSystemValuesTemplate).length > 0
      ? nextSystemValuesTemplate
      : createEmptySystemValues();
    const newPages = data.pages.map((p: any) =>
      buildPageState(
        p,
        nextProfile,
        nextBatchName,
        nextPropertyNames,
        nextInvoiceDateField,
        nextInvoiceNumberField,
        nextTotalValueField,
        baseSystemValues
      )
    );
    setPages((prev) => [...prev, ...newPages]);
    setNextProfile('');
    setNextBatchName('');
    setNextPropertyNames([]);
    setNextInvoiceDateField('');
    setNextInvoiceNumberField('');
    setNextTotalValueField('');
    return true;
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !nextProfile) return;
    if (!nextBatchName.trim()) {
      alert('Please enter a batch name for this invoice.');
      return;
    }

    const formData = new FormData();
    formData.append('zip', file);
    formData.append('profile', nextProfile);

    const res = await fetch('http://localhost:8000/process-zip', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    const baseSystemValues = Object.keys(nextSystemValuesTemplate).length > 0
      ? nextSystemValuesTemplate
      : createEmptySystemValues();
    const newPages = data.pages.map((p: any) =>
      buildPageState(
        p,
        nextProfile,
        nextBatchName,
        nextPropertyNames,
        nextInvoiceDateField,
        nextInvoiceNumberField,
        nextTotalValueField,
        baseSystemValues
      )
    );

    setPages((prev) => [...prev, ...newPages]);
    setNextProfile('');
    setNextBatchName('');
    setNextPropertyNames([]);
    setNextInvoiceDateField('');
    setNextInvoiceNumberField('');
    setNextTotalValueField('');
  };

  const updateZonePosition = (pageIndex: number, zoneId: number, x: number, y: number) => {
    setPages((prev) => {
      const updated = [...prev];
      updated[pageIndex].zones = updated[pageIndex].zones.map((z) =>
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

    setPages((prev) => {
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

  const handleSaveSingle = async (pageIndex: number) => {
    const page = pages[pageIndex];
    if (!page.batchName || !page.profile) {
      alert('Please enter a batch name and select a profile.');
      return;
    }

    if (existingQueueNames.has(page.batchName)) {
      const proceed = window.confirm(
        `Batch name "${page.batchName}" already exists and will be overwritten. Continue?`
      );
      if (!proceed) return;
    }

    const formData = new FormData();
    formData.append('name', page.batchName);
    formData.append('profile', page.profile);
    formData.append('systemValues', JSON.stringify(page.systemValues || {}));
    formData.append('fieldMapping', JSON.stringify({
      invoiceDateField: page.invoiceDateField,
      invoiceNumberField: page.invoiceNumberField,
      totalValueField: page.totalValueField
    }));

    const valuesToSave = [{
      filename: page.filename,
      zones: page.zones,
      values: page.values
    }];
    formData.append('values', JSON.stringify(valuesToSave));

    const res = await fetch(`http://localhost:8000${page.imageUrl}`);
    const blob = await res.blob();
    formData.append('files', blob, page.filename);

    const saveRes = await fetch('http://localhost:8000/queues', {
      method: 'POST',
      body: formData
    });

    if (saveRes.ok) {
      setExistingQueueNames((prev) => new Set(prev).add(page.batchName));
      alert(`Invoice saved as batch "${page.batchName}".`);
    } else {
      alert('Error saving invoice');
    }
  };

  const handleSavePageAsTemplateVersion = async (pageIndex: number) => {
    const page = pages[pageIndex];
    if (!page.profile) {
      alert('Please select a template before saving a new template version.');
      return;
    }

    const newTemplateName = getNextTemplateVersionName(page.profile);
    const formData = new FormData();
    formData.append('name', newTemplateName);
    formData.append('zones', JSON.stringify(page.zones));
    formData.append('systemValues', JSON.stringify(page.systemValues || {}));

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

    await handleApplyTemplateToAllPages(newTemplateName);
    alert(`Template saved as "${newTemplateName}".`);
  };

  const handlePropagateSingle = async (pageIndex: number) => {
    const page = pages[pageIndex];
    const normalizeDate = (input: string): string => {
      const parts = input.match(/(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{2,4})/);
      if (!parts) return input;
      const [, day, month, year] = parts;
      return `${year.length === 2 ? '20' + year : year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    };

    const normalizeDecimal = (val: string): string => val.replace(',', '.');

    const invoiceItemKeys = ['nazev', 'cenaMj', 'mnozMj', 'szbDph', 'slevaMnoz', 'slevaPol', 'slevaDokl'];

    const itemZones = (page.zones ?? []).filter(z => z.isItem);
    const grouped: Record<number, Record<string, string>> = {};

    for (const zone of itemZones) {
      const row = zone.rowId ?? 0;
      if (!grouped[row]) grouped[row] = {};
      grouped[row][zone.propertyName.replace(/_r\d+$/, '')] =
        page.values?.[zone.propertyName] || '';
    }

    const invoiceItems = Object.values(grouped);

    invoiceItems.forEach(item => {
      invoiceItemKeys.forEach(key => {
        if (item[key]) {
          item[key] = normalizeDecimal(item[key]);
        }
      });
    });

    const nonItemValues = Object.fromEntries(
      Object.entries(page.values ?? {}).filter(
        ([key]) => !invoiceItemKeys.some(k => key.startsWith(k))
      )
    );

    const values = { ...(page.systemValues || {}), ...nonItemValues };

    ['datVyst', 'datSplat'].forEach((key) => {
      if (values[key]) {
        values[key] = normalizeDate(values[key]);
      }
    });

    const osvRaw = values.osv || '0';
    const total_value = parseFloat(osvRaw.replace(/\s/g, '').replace(',', '.'));

    const fullInvoice = {
      id: uuidv4(),
      batch_name: page.batchName,
      order: pageIndex,
      selected: true,
      values,
      invoiceItems,
      systemValues: page.systemValues || {},
      accounting_info: '',
      company_id: '',
      imageFilename: page.filename,
      template_used: page.profile,
      invoice_date: normalizeDate(page.values[page.invoiceDateField] || ''),
      invoice_number: page.values[page.invoiceNumberField] || '',
      total_value: total_value,
    };

    await fetch('http://localhost:8000/overview/save_invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullInvoice),
    });

    alert(`Propagation to overview completed for "${page.batchName}".`);
  };

  const handleUpdatePageProfile = async (pageIndex: number, profile: string) => {
    if (!profile) return;
    const res = await fetch(`http://localhost:8000/profiles/${profile}`);
    const data = await res.json();
    const baseZones = normalizeZones(data?.zones || []);
    const names = baseZones.map((z: any) => z.propertyName);
    const matchDate = names.find((p: string) => p.toLowerCase().includes('dat')) || '';
    const matchNumber = names.find((p: string) => p.toLowerCase().includes('cis')) || '';
    const matchTotal = names.find((p: string) => p.toLowerCase().includes('celk')) || '';
    const systemValuesTemplate = data?.systemValues || {};

    setPages((prev) => {
      const updated = [...prev];
      const currentPage = updated[pageIndex];
      const templateWidth = data?.templateWidth != null ? Number(data.templateWidth) : null;
      updated[pageIndex] = buildPageFromTemplate(
        currentPage,
        profile,
        baseZones,
        templateWidth,
        names,
        matchDate,
        matchNumber,
        matchTotal,
        systemValuesTemplate
      );
      return updated;
    });
  };

  const handleApplyTemplateToAllPages = async (profile: string) => {
    if (!profile || pages.length === 0) return;

    const res = await fetch(`http://localhost:8000/profiles/${profile}`);
    const data = await res.json();
    const baseZones = normalizeZones(data?.zones || []);
    const names = baseZones.map((z: any) => z.propertyName);
    const matchDate = names.find((p: string) => p.toLowerCase().includes('dat')) || '';
    const matchNumber = names.find((p: string) => p.toLowerCase().includes('cis')) || '';
    const matchTotal = names.find((p: string) => p.toLowerCase().includes('celk')) || '';
    const systemValuesTemplate = data?.systemValues || {};
    const templateWidth = data?.templateWidth != null ? Number(data.templateWidth) : null;

    setPages((prev) =>
      prev.map((page) =>
        buildPageFromTemplate(
          page,
          profile,
          baseZones,
          templateWidth,
          names,
          matchDate,
          matchNumber,
          matchTotal,
          systemValuesTemplate
        )
      )
    );
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        {pages.length > 0 && (
          <Toolbox
            onOCRAll={handleOCRAll}
            disabled={pages.length === 0}
          />
        )}

        {pages.map((page, i) => (
          <div key={`${page.filename}-${i}`} className="space-y-3">
            <div className="bg-gray-100 p-4 rounded space-y-3">
              <div className="flex items-center gap-3">
                <select
                  value={page.profile}
                  onChange={(e) => handleUpdatePageProfile(i, e.target.value)}
                  className="border p-2 w-48"
                >
                  <option value="">-- Select Profile --</option>
                  {profiles.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={page.batchName}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPages((prev) => {
                      const updated = [...prev];
                      updated[i] = { ...updated[i], batchName: value };
                      return updated;
                    });
                  }}
                  placeholder="Batch name"
                  className="border p-2 flex-1"
                />
                <button
                  onClick={() => handleSaveSingle(i)}
                  className="bg-purple-600 text-white px-3 py-1 rounded text-sm"
                >
                  Save This Image as Batch
                </button>
                <button
                  onClick={() => handleApplyTemplateToAllPages(page.profile)}
                  className="bg-slate-600 text-white px-3 py-1 rounded text-sm"
                >
                  Reload Template to All Pages
                </button>
                <button
                  onClick={() => handleSavePageAsTemplateVersion(i)}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
                >
                  Save as Template Version
                </button>
              </div>

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
              </div>

              <div className="flex gap-4">
                <select
                  value={page.invoiceDateField}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPages((prev) => {
                      const updated = [...prev];
                      updated[i] = { ...updated[i], invoiceDateField: value };
                      return updated;
                    });
                  }}
                  className={`border p-2 ${!page.invoiceDateField ? 'border-red-400' : ''}`}
                >
                  <option value="">-- Invoice Date --</option>
                  {page.propertyNames.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select
                  value={page.invoiceNumberField}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPages((prev) => {
                      const updated = [...prev];
                      updated[i] = { ...updated[i], invoiceNumberField: value };
                      return updated;
                    });
                  }}
                  className={`border p-2 ${!page.invoiceNumberField ? 'border-red-400' : ''}`}
                >
                  <option value="">-- Invoice Number --</option>
                  {page.propertyNames.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select
                  value={page.totalValueField}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPages((prev) => {
                      const updated = [...prev];
                      updated[i] = { ...updated[i], totalValueField: value };
                      return updated;
                    });
                  }}
                  className={`border p-2 ${!page.totalValueField ? 'border-red-400' : ''}`}
                >
                  <option value="">-- Total Value --</option>
                  {page.propertyNames.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <button
                  onClick={() => handlePropagateSingle(i)}
                  className="px-4 py-2 rounded text-white bg-green-600"
                >
                  Propagate to Overview
                </button>
              </div>
            </div>

            {systemFieldNames.length > 0 && (
              <div className="bg-gray-100 p-3 rounded">
                <h3 className="font-medium text-sm mb-2">System Fields (XML)</h3>
                <div className="grid grid-cols-2 gap-3">
                  {systemFieldNames.map((key) => (
                    <div key={key} className="flex items-center gap-2">
                      <label className="text-sm w-32">{key}</label>
                      <input
                        type="text"
                        className="border p-1 text-sm flex-1"
                        value={page.systemValues?.[key] || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          setPages((prev) => {
                            const updated = [...prev];
                            updated[i] = {
                              ...updated[i],
                              systemValues: {
                                ...(updated[i].systemValues || {}),
                                [key]: value
                              }
                            };
                            return updated;
                          });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <PageViewer
              imageUrl={page.imageUrl}
              zones={page.zones}
              values={page.values}
              referenceValues={i === 0 ? undefined : pages[0].values}
              highlightProperty={highlightedZone?.pageIndex === i ? highlightedZone.property : null}
              onZoneMove={(id, x, y) => updateZonePosition(i, id, x, y)}
              onValueChange={(property, value) => {
                setPages((prev) => {
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
                setPages((prev) => {
                  const updated = [...prev];
                  const page = updated[i];

                  page.zones = page.zones.filter(z => z.rowId !== rowId);
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
                setPages((prev) => {
                  const updated = [...prev];
                  updated[i] = {
                    ...updated[i],
                    isLocked: !updated[i].isLocked,
                  };
                  return updated;
                });
              }}
              onZoneChange={(newZones) => {
                setPages((prev) => {
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

        <div className="bg-gray-100 p-4 rounded space-y-3">
          <h2 className="text-lg font-semibold">Creating New Invoice Batch</h2>
          <div className="flex items-center gap-3">
            <select
              value={nextProfile}
              onChange={(e) => setNextProfile(e.target.value)}
              className="border p-2 w-48"
            >
              <option value="">-- Select Profile --</option>
              {profiles.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <input
              type="text"
              value={nextBatchName}
              onChange={(e) => setNextBatchName(e.target.value)}
              placeholder="Batch name"
              className="border p-2 flex-1"
            />
          </div>
          <div className="flex gap-4">
            <select
              value={nextInvoiceDateField}
              onChange={(e) => setNextInvoiceDateField(e.target.value)}
              className={`border p-2 ${!nextInvoiceDateField ? 'border-red-400' : ''}`}
            >
              <option value="">-- Invoice Date --</option>
              {nextPropertyNames.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select
              value={nextInvoiceNumberField}
              onChange={(e) => setNextInvoiceNumberField(e.target.value)}
              className={`border p-2 ${!nextInvoiceNumberField ? 'border-red-400' : ''}`}
            >
              <option value="">-- Invoice Number --</option>
              {nextPropertyNames.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select
              value={nextTotalValueField}
              onChange={(e) => setNextTotalValueField(e.target.value)}
              className={`border p-2 ${!nextTotalValueField ? 'border-red-400' : ''}`}
            >
              <option value="">-- Total Value --</option>
              {nextPropertyNames.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <ImageUploader
              onUpload={handleImageUpload}
              disabled={!nextProfile}
            />
            <ZipUploader
              onUpload={handleZipUpload}
              disabled={!nextProfile}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
