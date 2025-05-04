import { useEffect, useState } from "react";
import DashboardLayout from '../dashboard/layout';
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import axios from "axios";
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableItem } from "../components/invcgeneraloverview/SortableItem";

interface OverviewInvoice {
    id: string;
    batch_name: string;
    invoice_date: string;
    invoice_number: string;
    template_used: string;
    total_value: number;
    selected: boolean;
    order: number;
    imageFilename?: string;
    values: Record<string, string>;
    systemValues: Record<string, string>;
}

export function GeneralOverviewPage() {
    const [invoices, setInvoices] = useState<OverviewInvoice[]>([]);
    const [selectAll, setSelectAll] = useState(false);

    const [dateFrom, setDateFrom] = useState<Date | null>(null);
    const [dateTo, setDateTo] = useState<Date | null>(null);
    const [sortOption, setSortOption] = useState("date_asc");
    const [originalInvoices, setOriginalInvoices] = useState<OverviewInvoice[]>([]);



    const sensors = useSensors(
        useSensor(PointerSensor),
    );

    useEffect(() => {
        fetchInvoices();
    }, []);

    const fetchInvoices = async () => {
        const response = await axios.get("http://localhost:8000/overview/list_invoices");
        setOriginalInvoices(response.data);
        setInvoices(response.data);
    };

    const toggleSelectAll = () => {
        const newSelectAll = !selectAll;
        setSelectAll(newSelectAll);
        setInvoices((prev) =>
            prev.map((inv) => ({ ...inv, selected: newSelectAll }))
        );
    };

    const handleCheckboxChange = (id: string) => {
        setInvoices((prev) =>
            prev.map((inv) =>
                inv.id === id ? { ...inv, selected: !inv.selected } : inv
            )
        );
    };

    const handleDragEnd = async (event: any) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            setInvoices((prev) => {
                const oldIndex = prev.findIndex((i) => i.id === active.id);
                const newIndex = prev.findIndex((i) => i.id === over.id);
                const newInvoices = arrayMove(prev, oldIndex, newIndex);
                newInvoices.forEach((inv, idx) => (inv.order = idx));
                newInvoices.forEach(async (inv) => {
                    await axios.patch(`http://localhost:8000/overview/update_invoice/${inv.id}`, { order: inv.order });
                });
                return newInvoices;
            });
        }
    };

    const handleDeleteRow = async (id: string) => {
        await fetch(`http://localhost:8000/overview/delete/${id}`, { method: 'DELETE' });
        await fetchInvoices();
    };

    const handleDeleteAll = async () => {
        if (!confirm("Are you sure you want to delete ALL invoices?")) return;
        await fetch(`http://localhost:8000/overview/delete_all`, { method: 'DELETE' });
        await fetchInvoices();
    };

    const handleExportFlexibee = async () => {
        const selected = invoices.filter(inv => inv.selected).map(inv => inv.id);
        if (selected.length === 0) {
            alert("No invoices selected.");
            return;
        }

        const response = await fetch("http://localhost:8000/overview/export_flexibee", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(selected),
        });

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `flexibee_export_${Date.now()}.xml`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    };

    const applyFilters = () => {
        let filtered = [...originalInvoices];

        if (dateFrom) {
            filtered = filtered.filter(i => new Date(i.invoice_date) >= dateFrom);
        }
        if (dateTo) {
            filtered = filtered.filter(i => new Date(i.invoice_date) <= dateTo);
        }

        switch (sortOption) {
            case "date_asc":
                filtered.sort((a, b) => new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime());
                break;
            case "date_desc":
                filtered.sort((a, b) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime());
                break;
            case "template_asc":
                filtered.sort((a, b) => a.template_used.localeCompare(b.template_used));
                break;
            case "template_desc":
                filtered.sort((a, b) => b.template_used.localeCompare(a.template_used));
                break;
        }

        setInvoices(filtered);
    };

    const resetFilters = () => {
        setDateFrom(null);
        setDateTo(null);
        setSortOption("date_asc");
        setInvoices([...originalInvoices]);
    };



    return (
        <DashboardLayout>
            <div className="p-6">
                <h1 className="text-2xl font-bold mb-4">General Overview</h1>

                <div className="mb-6">
                    <button
                        onClick={handleDeleteAll}
                        className="bg-red-600 text-white px-4 py-2 rounded text-sm"
                    >
                        🗑 Delete All Invoices
                    </button>
                </div>

                <div className="flex gap-4 mb-4 items-end">
                    <div>
                        <label className="text-sm">From Date</label>
                        <input
                            type="date"
                            className="border px-2 py-1 rounded"
                            value={dateFrom ? dateFrom.toISOString().slice(0, 10) : ""}
                            onChange={(e) => setDateFrom(e.target.value ? new Date(e.target.value) : null)}
                        />
                    </div>
                    <div>
                        <label className="text-sm">To Date</label>
                        <input
                            type="date"
                            className="border px-2 py-1 rounded"
                            value={dateTo ? dateTo.toISOString().slice(0, 10) : ""}
                            onChange={(e) => setDateTo(e.target.value ? new Date(e.target.value) : null)}
                        />
                    </div>
                    <div>
                        <label className="text-sm">Sort by</label>
                        <select
                            className="border px-2 py-1 rounded"
                            value={sortOption}
                            onChange={(e) => setSortOption(e.target.value)}
                        >
                            <option value="date_asc">Date ↑</option>
                            <option value="date_desc">Date ↓</option>
                            <option value="template_asc">Template A–Z</option>
                            <option value="template_desc">Template Z–A</option>
                        </select>
                    </div>
                    <Button onClick={applyFilters}>Apply Filters</Button>
                    <Button variant="outline" onClick={resetFilters}>Reset Filters</Button>
                </div>


                <div className="border rounded-md">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
                        <SortableContext items={invoices.map((inv) => inv.id)} strategy={verticalListSortingStrategy}>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>#</TableHead>
                                        <TableHead>
                                            <Checkbox checked={selectAll} onCheckedChange={toggleSelectAll} />
                                        </TableHead>
                                        <TableHead>Invoice Number</TableHead>
                                        <TableHead>Template</TableHead>
                                        <TableHead>Batch</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Total Value</TableHead>
                                        <TableHead>Currency</TableHead>
                                        <TableHead>Country</TableHead>
                                        <TableHead>Acc. Type</TableHead>
                                        <TableHead>Bookkeeping</TableHead>
                                        <TableHead>Posted</TableHead>
                                        <TableHead>Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {invoices.map((invoice, i) => (
                                        <TableRow key={invoice.id}>
                                            <TableCell>{i + 1}</TableCell>
                                            <TableCell>
                                                <Checkbox
                                                    checked={invoice.selected}
                                                    onCheckedChange={() => handleCheckboxChange(invoice.id)}
                                                />
                                            </TableCell>
                                            <TableCell>{invoice.invoice_number}</TableCell>
                                            <TableCell>{invoice.template_used}</TableCell>
                                            <TableCell>{invoice.batch_name}</TableCell>
                                            <TableCell>{invoice.invoice_date}</TableCell>
                                            <TableCell>{invoice.total_value.toFixed(2)}</TableCell>
                                            <TableCell>{invoice.systemValues?.mena || ""}</TableCell>
                                            <TableCell>{invoice.systemValues?.stat || ""}</TableCell>
                                            <TableCell>{invoice.systemValues?.typUcOp || ""}</TableCell>
                                            <TableCell>{invoice.systemValues?.ucetni === "true" ? "●" : ""}</TableCell>
                                            <TableCell>{invoice.systemValues?.zuctovano === "true" ? "●" : ""}</TableCell>
                                            <TableCell>
                                                <button
                                                    onClick={() => handleDeleteRow(invoice.id)}
                                                    className="text-red-500 hover:underline text-xs"
                                                >
                                                    🗑 Delete
                                                </button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </SortableContext>
                    </DndContext>
                </div>

                <div className="mt-6">
                    <Button onClick={handleExportFlexibee}>
                        Export Selected to FlexiBee
                    </Button>
                </div>
            </div>
        </DashboardLayout>
    );
}

export default GeneralOverviewPage;
