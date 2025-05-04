import React, { useState } from 'react';

interface TopPanelProps {
  profiles: string[];
  selectedProfile: string;
  setSelectedProfile: (v: string) => void;
  batchName: string;
  setBatchName: (v: string) => void;
  onSave: () => void;
  isEditing: boolean;
  propertyNames: string[];
  invoices: any[];
  systemValues: Record<string, string>;
  setSystemValues: (v: Record<string, string>) => void;
  invoiceDateField: string;
  setInvoiceDateField: (v: string) => void;
  invoiceNumberField: string;
  setInvoiceNumberField: (v: string) => void;
  totalValueField: string;
  setTotalValueField: (v: string) => void;
  onPropagate: (fields: {
    invoiceDateField: string;
    invoiceNumberField: string;
    totalValueField: string;
  }) => void;
}

export default function TopPanel({
  profiles,
  selectedProfile,
  setSelectedProfile,
  batchName,
  setBatchName,
  onSave,
  isEditing,
  propertyNames,
  invoices,
  onPropagate,
  systemValues,
  setSystemValues,
  invoiceDateField,
  setInvoiceDateField,
  invoiceNumberField,
  setInvoiceNumberField,
  totalValueField,
  setTotalValueField
}: TopPanelProps) {

  const canPropagate = Boolean(
    invoiceDateField && invoiceDateField.trim() &&
    invoiceNumberField && invoiceNumberField.trim() &&
    totalValueField && totalValueField.trim()
  );




  const handlePropagate = () => {
    onPropagate({
      invoiceDateField,
      invoiceNumberField,
      totalValueField
    });
  };



  return (
    <div className="bg-gray-100 p-4 rounded space-y-4">
      <div>
        <h1 className="text-lg font-semibold">
          {isEditing ? 'Editing Invoice Batch' : 'Creating New Invoice Batch'}
        </h1>
        <div className="flex gap-4 items-center mt-2">
          <select
            value={selectedProfile}
            onChange={e => setSelectedProfile(e.target.value)}
            className="border p-2 w-48"
          >
            <option value="">-- Select Profile --</option>
            {profiles.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <input
            type="text"
            value={batchName}
            onChange={e => setBatchName(e.target.value)}
            placeholder="Batch name"
            className="border p-2 flex-1"
          />
          <button
            onClick={onSave}
            className="bg-purple-600 text-white px-4 py-2 rounded"
          >
            Save
          </button>
        </div>
      </div>

      <div>
        <h2 className="font-medium">Map Fields to Extracted Properties</h2>
        <div className="flex gap-4 mt-2">
          <select
            value={invoiceDateField}
            onChange={e => setInvoiceDateField(e.target.value)}
            className={`border p-2 ${!invoiceDateField ? 'border-red-400' : ''}`}
          >
            <option value="">-- Invoice Date --</option>
            {propertyNames.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={invoiceNumberField}
            onChange={e => setInvoiceNumberField(e.target.value)}
            className={`border p-2 ${!invoiceDateField ? 'border-red-400' : ''}`}
          >
            <option value="">-- Invoice Number --</option>
            {propertyNames.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={totalValueField}
            onChange={e => setTotalValueField(e.target.value)}
            className={`border p-2 ${!invoiceDateField ? 'border-red-400' : ''}`}
          >
            <option value="">-- Total Value --</option>
            {propertyNames.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          <button
            disabled={!canPropagate}
            onClick={handlePropagate}
            className={`px-4 py-2 rounded text-white ${canPropagate ? 'bg-green-600' : 'bg-gray-400 cursor-not-allowed'}`}
          >
            Propagate to Overview
          </button>
        </div>
      </div>

      {Object.keys(systemValues).length > 0 && (
        <div>
          <h2 className="font-medium">System Fields</h2>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {Object.entries(systemValues).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <label className="text-sm w-32">{key}</label>
                <input
                  type="text"
                  className="border p-1 text-sm flex-1"
                  value={value}
                  onChange={e => setSystemValues({ ...systemValues, [key]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>
      )}


    </div>
  );
}