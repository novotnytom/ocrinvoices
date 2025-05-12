import React, { useState } from "react";
import DashboardLayout from "@/dashboard/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UploadCloud } from "lucide-react";


const zasilkovnaHeaders = [
    "Váš e-shop", "Datum vložení", "Datum podání", "Vyzvednutí či vrácení", "Vaše obj. č.",
    "Jméno", "Příjmení", "Čárový kód", "Účtované služby", "DPH %",
    "Služby s DPH", "Měna účtovaných služeb", "Vybraná dobírka", "Měna dobírky", "SS", "Poznámka",
    "Stav", "Hmotnost", "Základní cena", "Dobírka", "Pojištění", "Pod.mimo depo", "Příplatek za vratku",
    "Ostatní", "Dopravné celkem bez DPH", "Palivový příplatek", "Mýtný příplatek", "Platba kartou",
    "Hodnota vybrané dobírky v místní měně", "Měna vybrané dobírky", "Cílová země", "Dopravce",
    "User note", "External tracking code"
];

function ConverterPage() {
    const [files, setFiles] = useState<File[]>([]);
    const [conversionType, setConversionType] = useState<
        "zasilkovna" | "stripe-bank" | "stripe-invoices" | "dph-cz"
    >("zasilkovna");
    const [isConverting, setIsConverting] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(prev => [...prev, ...Array.from(e.target.files)]);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files) {
            setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleConvert = async () => {
        if (files.length === 0) return;

        setIsConverting(true);
        const formData = new FormData();
        files.forEach(file => formData.append("files", file));

        try {
            const response = await fetch(`http://localhost:8000/convert/${conversionType}`, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) throw new Error("Conversion failed.");

            // 🔽 get invoice count BEFORE consuming blob
            const invoiceCount = response.headers.get("X-Invoice-Count");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;

            let filename = "converted_file.csv";
            const disposition = response.headers.get("Content-Disposition");
            if (disposition) {
                const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (match) filename = match[1].replace(/['"]/g, '');
            }

            link.download = filename;
            link.click();
            window.URL.revokeObjectURL(url);


            // ✅ show toast or alert
            if (invoiceCount) {
                alert(`✅ Úspěšně vygenerováno ${invoiceCount} dokladů`);
            }
        } catch (err) {
            console.error(err);
            alert("Error converting files.");
        } finally {
            setIsConverting(false);
        }
    };


    return (
        <DashboardLayout>
            <div className="p-6 space-y-6 max-w-3xl mx-auto">
                <h1 className="text-2xl font-bold">Invoice Converter</h1>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Select conversion type:</label>
                    <Select value={conversionType} onValueChange={(val: any) => setConversionType(val)}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select conversion type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="zasilkovna">Zásilkovna</SelectItem>
                            <SelectItem value="stripe-bank">Stripe Bank</SelectItem>
                            <SelectItem value="stripe-invoices">Stripe → Invoices (ISDOC)</SelectItem>
                            <SelectItem value="dph-cz">DPH IO (XML pracovní soubor)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {conversionType === "zasilkovna" && (
                    <div className="p-4 border rounded bg-muted/20 mb-4">
                        <h2 className="text-lg font-semibold mb-2">Formát Zásilkovna CSV souboru</h2>
                        <p className="text-sm mb-3">
                            Tento soubor obsahuje data o dobírkách exportovaná ze Zásilkovna portálu.
                            Formát musí být CSV formát V7 s oddělovačem středník <code>;</code>. Níže jsou uvedeny všechny požadované sloupce.
                            <span className="ml-1 font-semibold text-blue-600">Modré</span> označují pole, která se reálně používají při konverzi.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {zasilkovnaHeaders.map((field) => {
                                const isUsed = [
                                    "Datum podání",
                                    "Vaše obj. č.",
                                    "Jméno",
                                    "Příjmení",
                                    "Dobírka",
                                    "Stav",
                                    "Měna dobírky",
                                    "Cílová země"
                                ].includes(field);

                                return (
                                    <div
                                        key={field}
                                        className={`px-3 py-1 rounded-full text-xs border ${isUsed
                                            ? "bg-blue-100 text-blue-800 border-blue-300"
                                            : "bg-white border-gray-300"
                                            }`}
                                    >
                                        {field}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {conversionType === "stripe-bank" && (
                    <div className="p-4 border rounded bg-muted/20 mb-4">
                        <h2 className="text-lg font-semibold mb-2">Stripe – export plateb a pohybů</h2>
                        <p className="text-sm mb-3">
                            Nahrajte dva soubory ve formátu CSV:
                            <br />
                            <strong>1)</strong> <code>unified_payments.csv</code> – export úspěšných plateb
                            <br />
                            <strong>2)</strong> <code>balance_history.csv</code> – export historie zůstatku (pohyby)
                        </p>

                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-medium mb-2">
                                    unified_payments.csv – <a
                                        href="https://dashboard.stripe.com/payments?status[0]=successful"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 underline"
                                    >
                                        stáhnout zde
                                    </a>
                                </h3>
                                <p className="text-sm mb-2">
                                    Tento soubor obsahuje 23 sloupců. Zvýrazněné <span className="text-blue-600 font-semibold">modře</span> jsou skutečně používané při konverzi:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        "ID",
                                        "Created date (UTC)",
                                        "Amount",
                                        "Amount Refunded",
                                        "Currency",
                                        "Captured",
                                        "Converted Amount",
                                        "Converted Amount Refunded",
                                        "Converted Currency",
                                        "Decline Reason",
                                        "Description",
                                        "Fee",
                                        "Refunded date (UTC)",
                                        "Statement Descriptor",
                                        "Status",
                                        "Seller Message",
                                        "Taxes On Fee",
                                        "Card ID",
                                        "Customer ID",
                                        "Customer Description",
                                        "Customer Email",
                                        "Invoice ID",
                                        "Transfer"
                                    ].map((field) => {
                                        const isUsed = [
                                            "ID",
                                            "Status",
                                            "Customer ID",
                                            "Customer Email"
                                        ].includes(field);
                                        return (
                                            <div
                                                key={field}
                                                className={`px-3 py-1 rounded-full text-xs border ${isUsed
                                                    ? "bg-blue-100 text-blue-800 border-blue-300"
                                                    : "bg-white border-gray-300"
                                                    }`}
                                            >
                                                {field}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-medium mt-4 mb-2">
                                    balance_history.csv – <a
                                        href="https://dashboard.stripe.com/balance/all-activity"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 underline"
                                    >
                                        stáhnout zde
                                    </a>
                                </h3>
                                <p className="text-sm mb-2">
                                    Tento soubor by měl být ve svém základním formátu (9 sloupců). Zvýrazněné <span className="text-blue-600 font-semibold">modře</span> jsou použité při konverzi:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        "ID",
                                        "Type",
                                        "Source",
                                        "Amount",
                                        "Fee",
                                        "Net",
                                        "Currency",
                                        "Created (UTC)",
                                        "Available On (UTC)"
                                    ].map((field) => {
                                        const isUsed = [
                                            "ID",
                                            "Type",
                                            "Source",
                                            "Amount",
                                            "Fee",
                                            "Net",
                                            "Currency",
                                            "Created (UTC)"
                                        ].includes(field);
                                        return (
                                            <div
                                                key={field}
                                                className={`px-3 py-1 rounded-full text-xs border ${isUsed
                                                    ? "bg-blue-100 text-blue-800 border-blue-300"
                                                    : "bg-white border-gray-300"
                                                    }`}
                                            >
                                                {field}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {conversionType === "stripe-invoices" && (
                    <div className="p-4 border rounded bg-muted/20 mb-4">
                        <h2 className="text-lg font-semibold mb-2">Stripe – Paid Invoices to FlexiBee XML</h2>
                        <p className="text-sm mb-3">
                            This tool converts paid Stripe invoices to an <strong>ABRA FlexiBee-compatible</strong> XML format
                            (<code>invoice_export.xml</code>) that you can directly import.
                        </p>
                        <p className="text-sm mb-3">
                            Go to <a href="https://dashboard.stripe.com/invoices" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                                Stripe Invoices Dashboard
                            </a>, export as <strong>Paid Invoices (.csv)</strong>, and upload here.
                        </p>

                        <p className="text-sm font-medium mb-1">Required columns:</p>
                        <div className="flex flex-wrap gap-2">
                            {[
                                "id",
                                "Number",
                                "Date (UTC)",
                                "Amount Due",
                                "Currency",
                                "Status",
                                "Charge",
                                "Customer",
                                "Customer Email",
                                "Customer Address Country",
                                "Finalized At (UTC)",
                                "Tax Filing Amount",
                                "Tax Filing Currency"
                            ].map((field) => (
                                <div
                                    key={field}
                                    className="px-3 py-1 rounded-full text-xs border bg-blue-100 text-blue-800 border-blue-300"
                                >
                                    {field}
                                </div>
                            ))}
                        </div>

                        <p className="text-xs text-muted-foreground mt-3">
                            ✅ VAT tagging (e.g. EU/UK) is automatic based on country and tax data.
                            <br />
                            🌍 Currency is converted using official CZK/EUR exchange rates from kurzy.cz (per invoice date).
                        </p>
                    </div>
                )}

                {conversionType === "dph-cz" && (
                    <div className="p-4 border rounded bg-muted/20 mb-4">
                        <h2 className="text-lg font-semibold mb-2">DPH potvrzení (XML nebo .p7s)</h2>
                        <p className="text-sm mb-3">
                            Nahrajte pracovní XML nebo podepsané .p7s soubory přiznání k DPH.
                            Každý vstup bude převeden na <strong>interní doklad</strong> pro import do FlexiBee.
                        </p>
                        <ul className="text-sm list-disc list-inside text-muted-foreground">
                            <li>Generují se 2 soubory: bez a s přílohami</li>
                            <li>Přílohy jsou převáděny z hex na base64</li>
                            <li>Podporované přípony: <code>.xml</code>, <code>.p7s</code></li>
                        </ul>
                    </div>
                )}



                <Card
                    className="border-dashed border-2 border-gray-300 hover:border-blue-500 p-6 text-center cursor-pointer"
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                >
                    <CardContent className="space-y-2">
                        <UploadCloud className="mx-auto w-8 h-8 text-gray-400" />
                        <p className="text-sm text-gray-500">Drag and drop files here (.zip, .csv, .xml or .p7s)</p>
                        <Input type="file" multiple onChange={handleFileChange} accept=".csv,.zip,.xml,.p7s" />

                    </CardContent>
                </Card>

                {files.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-sm font-medium">Files to Convert:</p>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                            {files.map((file, index) => (
                                <li key={index} className="flex justify-between">
                                    <span>{file.name}</span>
                                    <button
                                        onClick={() => removeFile(index)}
                                        className="text-red-500 hover:underline text-xs"
                                    >
                                        Remove
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <Button disabled={isConverting || files.length === 0} onClick={handleConvert}>
                    {isConverting ? "Converting..." : "Convert and Download"}
                </Button>
            </div>
        </DashboardLayout>
    );
}

export default ConverterPage;
