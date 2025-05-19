import React from "react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react"
import { Dialog } from "@radix-ui/react-dialog"
import DashboardLayout from '../dashboard/layout';


interface BankOperation {
    id: string
    kod: string
    typPohybuK: string
    datVyst: string
    popis: string
    sumZklCelkem: string
    buc: string
    smerKod: string
    banka: string
    iban: string
    typDokl: string
    vypisCisDokl: string
    cisSouhrnne: string
    matched_invoice_id?: string
    initial_match?: string
    confirm_match?: boolean
}

interface InvoiceStub {
    id: string
    cisloDosle: string
    osv: string
    datVyst: string
    varSym: string
    nazFirmy?: string
}

function parseCzkAmount(value: string | number): number {
    if (typeof value === "number") return value
    return parseFloat(value.replace(/\s/g, "").replace(",", "."))
}

export default function BankMatchPage() {
    const [operations, setOperations] = useState<BankOperation[]>([])
    const [loading, setLoading] = useState(false)
    const [batchName, setBatchName] = useState("")
    const [savedBatches, setSavedBatches] = useState<string[]>([])
    const [selectedBatch, setSelectedBatch] = useState<string | null>(null)
    const [selectedRow, setSelectedRow] = useState<string | null>(null)
    const [selectedOps, setSelectedOps] = useState<Set<string>>(new Set())
    const [filterType, setFilterType] = useState<string>("all")
    const [fromDate, setFromDate] = useState<string>("")
    const [untilDate, setUntilDate] = useState<string>("")
    const [excludeText, setExcludeText] = useState("")
    const [includeText, setIncludeText] = useState("")
    const [minAmount, setMinAmount] = useState<number | null>(null)
    const [maxAmount, setMaxAmount] = useState<number | null>(null)
    const [sortDesc, setSortDesc] = useState(true)
    const [bankFilter, setBankFilter] = useState<string>("all")
    const [guesses, setGuesses] = useState<Record<string, InvoiceStub>>({})
    const [guessDone, setGuessDone] = useState(false)
    const [invoices, setInvoices] = useState<InvoiceStub[]>([])
    const [searchQuery, setSearchQuery] = useState<Record<string, string>>({})

    useEffect(() => {
        if (!selectedBatch) return

        const loadBatchAndInitialInvoices = async () => {
            const res = await fetch(`http://localhost:8000/bank/load_batch?name=${selectedBatch}`)
            const data = await res.json()
            const loadedOps: BankOperation[] = data.operations || []
            setOperations(loadedOps)

            const resInv = await fetch("http://localhost:8000/overview/list_invoices")
            const ids = await resInv.json()

            const loadedInvoices: InvoiceStub[] = []
            for (const { id } of ids) {
                const inv = await fetch(`http://localhost:8000/overview/get_invoice?id=${id}`)
                const data = await inv.json()
                const val = data.values
                loadedInvoices.push({
                    id,
                    cisloDosle: val.cisloDosle,
                    osv: val.osv,
                    datVyst: val.datVyst,
                    varSym: val.varSym,
                    nazFirmy: val.nazFirmy,
                })
            }
            setInvoices(loadedInvoices)

            // find invoice IDs we need to load (those in initial_match, not in guesses)
            const missingMatches = loadedOps
                .filter(op => op.initial_match && !guesses[op.id])
                .map(op => op.initial_match!)

            const updated: Record<string, InvoiceStub> = {}
            for (const id of missingMatches) {
                const res = await fetch(`http://localhost:8000/overview/get_invoice?id=${id}`)
                const inv = await res.json()
                const val = inv.values
                updated[id] = {
                    id,
                    cisloDosle: val.cisloDosle,
                    osv: val.osv,
                    datVyst: val.datVyst,
                    varSym: val.varSym,
                    nazFirmy: val.nazFirmy,
                }
            }

            // assign invoice stubs to their respective bank ops
            const reverse: Record<string, InvoiceStub> = {}
            loadedOps.forEach(op => {
                if (op.initial_match && updated[op.initial_match]) {
                    reverse[op.id] = updated[op.initial_match]
                }
            })

            setGuesses(prev => ({ ...prev, ...reverse }))
        }

        loadBatchAndInitialInvoices()
    }, [selectedBatch])

    useEffect(() => {
        fetch("http://localhost:8000/bank/list_batches")
            .then(res => res.json())
            .then(data => setSavedBatches(data.batches))
    }, [])  // ✅ only run once


    const uniqueBanks = Array.from(new Set(operations.map(op => op.banka))).filter(Boolean)

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const formData = new FormData()
        formData.append("file", file)

        setLoading(true)
        try {
            const res = await fetch("http://localhost:8000/bank/import_xml", {
                method: "POST",
                body: formData,
            })
            if (!res.ok) throw new Error("Failed to parse XML.")
            const data = await res.json()
            setOperations(data.operations || [])
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const handleSaveBatch = async () => {
        if (!batchName.trim() || operations.length === 0) return
        await fetch("http://localhost:8000/bank/save_batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: batchName, operations }),
        })
        setBatchName("")
    }

    const handleLoadBatch = async (name: string) => {
        const res = await fetch(`http://localhost:8000/bank/load_batch?name=${name}`)
        const data = await res.json()
        setOperations(data.operations || [])
        setSelectedBatch(name)
    }

    const handleDeleteBatch = async (name: string) => {
        await fetch(`http://localhost:8000/bank/delete_batch?name=${name}`, { method: "DELETE" })
        setSavedBatches(savedBatches.filter(b => b !== name))
        if (selectedBatch === name) setOperations([])
    }

    const handleInitialGuess = async () => {
        const res = await fetch("http://localhost:8000/overview/list_invoices")
        const ids = await res.json()
        const invoices: InvoiceStub[] = []

        for (const { id } of ids) {
            const inv = await fetch(`http://localhost:8000/overview/get_invoice?id=${id}`)
            const data = await inv.json()
            const val = data.values
            invoices.push({
                id,
                cisloDosle: val.cisloDosle,
                osv: val.osv,
                datVyst: val.datVyst,
                varSym: val.varSym,
                nazFirmy: val.nazFirmy
            })
        }

        const updatedGuesses: Record<string, InvoiceStub> = {}
        const matchMap: Record<string, string> = {}

        selectedOps.forEach(id => {
            const op = operations.find(o => o.id === id)
            if (!op) return
            const match = invoices.find(inv => {
                const approxAmount = Math.abs(parseFloat(op.sumZklCelkem) - parseCzkAmount(inv.osv)) < 0.1
                const vsMatch = inv.varSym && op.varSym && inv.varSym === op.varSym
                const invoiceInDesc = inv.cisloDosle && op.popis?.includes(inv.cisloDosle)
                return approxAmount || vsMatch || invoiceInDesc
            })
            if (match) {
                updatedGuesses[id] = match
                matchMap[id] = match.id
            }
        })

        setGuesses(updatedGuesses)
        setGuessDone(true)
        setInvoices(invoices)

        if (selectedBatch && Object.keys(matchMap).length > 0) {
            await fetch("http://localhost:8000/bank/save_initial_match", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ batch_name: selectedBatch, matches: matchMap })
            })
        }
    }

    const filteredOperations = operations
        .filter(op => {
            const type = op.typPohybuK?.replace("typPohybu.", "")
            const amount = parseFloat(op.sumZklCelkem || "0")
            const desc = op.popis?.toLowerCase() || ""
            const date = op.datVyst?.split("+")[0] || ""
            return (
                (filterType === "all" || type === filterType) &&
                (minAmount === null || amount >= minAmount) &&
                (maxAmount === null || amount <= maxAmount) &&
                (!excludeText || !desc.includes(excludeText.toLowerCase())) &&
                (!includeText || desc.includes(includeText.toLowerCase())) &&
                (bankFilter === "all" || op.banka === bankFilter) &&
                (!fromDate || date >= fromDate) &&
                (!untilDate || date <= untilDate)
            )
        })
        .sort((a, b) => {
            const dateA = new Date(a.datVyst)
            const dateB = new Date(b.datVyst)
            return sortDesc ? dateB.getTime() - dateA.getTime() : dateA.getTime() - dateB.getTime()
        })

    const totalVydej = filteredOperations
        .filter(op => op.typPohybuK === "typPohybu.vydej")
        .reduce((sum, op) => sum + parseFloat(op.sumZklCelkem || "0"), 0)
    const totalPrijem = filteredOperations
        .filter(op => op.typPohybuK === "typPohybu.prijem")
        .reduce((sum, op) => sum + parseFloat(op.sumZklCelkem || "0"), 0)


    const toggleRow = (id: string) => {
        setSelectedRow(prev => (prev === id ? null : id))
    }

    const toggleSelection = (id: string) => {
        setSelectedOps(prev => {
            const copy = new Set(prev)
            copy.has(id) ? copy.delete(id) : copy.add(id)
            return copy
        })
    }


    return (
        <DashboardLayout>
            <div className="p-6 space-y-6">
                <h1 className="text-2xl font-bold">Match Bank Payments with Invoices</h1>

                <div className="flex items-center space-x-4">
                    <Button disabled={selectedOps.size === 0} onClick={handleInitialGuess}>🔍 Initial Guess for Selected</Button>
                    <span className="text-sm text-gray-500">{selectedOps.size} selected</span>
                </div>

                <div className="flex items-center space-x-4">
                    <Input type="file" accept=".xml" onChange={handleFileUpload} />
                    {loading && <span>Uploading...</span>}
                </div>

                <div className="flex items-center space-x-4">
                    <Input
                        placeholder="Save batch as..."
                        value={batchName}
                        onChange={(e) => setBatchName(e.target.value)}
                        className="w-64"
                    />
                    <Button onClick={handleSaveBatch}>💾 Save</Button>

                    <Select onValueChange={handleLoadBatch}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Load saved batch..." />
                        </SelectTrigger>
                        <SelectContent>
                            {savedBatches.map((name) => (
                                <SelectItem key={name} value={name}>{name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {selectedBatch && (
                        <Button variant="destructive" onClick={() => handleDeleteBatch(selectedBatch)}>
                            🗑️ Delete "{selectedBatch}"
                        </Button>
                    )}

                    <div>
                        <label className="text-sm">From date:</label>
                        <Input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="w-40"
                        />
                        <label className="text-sm">Until date:</label>
                        <Input
                            type="date"
                            value={untilDate}
                            onChange={(e) => setUntilDate(e.target.value)}
                            className="w-40"
                        />
                    </div>

                </div>

                <div className="flex items-center space-x-4">
                    <label className="text-sm">Transaction type:</label>
                    <Select onValueChange={(val) => setFilterType(val)} defaultValue="all">
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="vydej">Výdej</SelectItem>
                            <SelectItem value="prijem">Příjem</SelectItem>
                        </SelectContent>
                    </Select>

                    <label className="text-sm">Min amount:</label>
                    <Input
                        type="number"
                        value={minAmount ?? ""}
                        onChange={(e) => setMinAmount(e.target.value ? Number(e.target.value) : null)}
                        placeholder="e.g. 10"
                        className="w-32"
                    />

                    <label className="text-sm">Max amount:</label>
                    <Input
                        type="number"
                        value={maxAmount ?? ""}
                        onChange={(e) => setMaxAmount(e.target.value ? Number(e.target.value) : null)}
                        placeholder="e.g. 1000"
                        className="w-32"
                    />

                    <label className="text-sm">Exclude text:</label>
                    <Input
                        value={excludeText}
                        onChange={(e) => setExcludeText(e.target.value)}
                        placeholder="e.g. stripe fee"
                        className="w-64"
                    />

                    <label className="text-sm">Include text:</label>
                    <Input
                        value={includeText}
                        onChange={(e) => setIncludeText(e.target.value)}
                        placeholder="e.g. invoice"
                        className="w-64"
                    />

                    <label className="text-sm">Bank account:</label>
                    <Select onValueChange={setBankFilter} defaultValue="all">
                        <SelectTrigger className="w-[120px]">
                            <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            {uniqueBanks.map(bank => (
                                <SelectItem key={bank} value={bank}>{bank.replace("code:", "")}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button variant="outline" onClick={() => setSortDesc(!sortDesc)}>
                        {sortDesc ? "⬇️ Newest first" : "⬆️ Oldest first"}
                    </Button>
                </div>
                <br />
                <div className="text-sm text-gray-600">
                    💸 <strong>Total Výdej:</strong> {totalVydej.toFixed(2)} CZK &nbsp;&nbsp;&nbsp; 💰 <strong>Total Příjem:</strong> {totalPrijem.toFixed(2)} CZK
                </div>

                {guessDone && (
                    <Dialog>
                        Initial guesses are now available below selected rows.
                    </Dialog>
                )}

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>
                                <Checkbox
                                    checked={
                                        filteredOperations.length > 0 &&
                                        filteredOperations.every((op) => selectedOps.has(op.id))
                                    }
                                    onCheckedChange={() => {
                                        const allSelected = filteredOperations.every((op) => selectedOps.has(op.id))
                                        const newSet = new Set(selectedOps)
                                        filteredOperations.forEach((op) =>
                                            allSelected ? newSet.delete(op.id) : newSet.add(op.id)
                                        )
                                        setSelectedOps(newSet)
                                    }}
                                />
                            </TableHead>

                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>VS</TableHead>
                            <TableHead>Counterparty</TableHead>
                            <TableHead>Account</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Match</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredOperations.map((op) => (
                            <React.Fragment key={op.id}>
                                <TableRow>
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedOps.has(op.id)}
                                            onCheckedChange={() => toggleSelection(op.id)}
                                        />
                                    </TableCell>
                                    <TableCell>{op.datVyst?.split("+")[0]}</TableCell>
                                    <TableCell>
                                        {op.typPohybuK?.includes("prijem") ? (
                                            <ArrowDownCircle className="text-green-600 w-5 h-5" />
                                        ) : op.typPohybuK?.includes("vydej") ? (
                                            <ArrowUpCircle className="text-red-600 w-5 h-5" />
                                        ) : null}
                                    </TableCell>
                                    <TableCell className={op.typPohybuK?.includes("prijem") ? "text-green-700 text-left" : op.typPohybuK?.includes("vydej") ? "text-red-700 text-left" : "text-left"}>
                                        {op.popis?.length > 50 ? op.popis.slice(0, 50) + "…" : op.popis}
                                    </TableCell>
                                    <TableCell>{op.varSym}</TableCell>
                                    <TableCell className="text-right">{op.buc}{op.smerKod ? "/" + op.smerKod.replace("code:", "") : ""}</TableCell>
                                    <TableCell>{op.banka?.replace("code:", "")}</TableCell>
                                    <TableCell className={op.typPohybuK?.includes("prijem") ? "text-green-700 text-right font-bold" : op.typPohybuK?.includes("vydej") ? "text-red-700 text-right font-bold" : ""}>
                                        {parseFloat(op.sumZklCelkem).toFixed(2)} Kč
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            onClick={() => toggleRow(op.id)}
                                            className={op.confirm_match ? "bg-yellow-400 hover:bg-yellow-500 text-black" : ""}
                                        >
                                            {selectedRow === op.id ? "Close" : guesses[op.id] || op.initial_match ? "Match (1)" : "Match"}
                                        </Button>

                                    </TableCell>
                                </TableRow>

                                {selectedRow === op.id && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="bg-gray-100">
                                            <div className="p-4 space-y-2">
                                                <p className="text-sm font-medium text-gray-700">💡 Suggested match:</p>
                                                {guesses[op.id] ? (
                                                    <div className="border p-2 rounded bg-white shadow-sm">
                                                        <div className="text-sm font-semibold">{guesses[op.id].cisloDosle} — {guesses[op.id].osv} Kč</div>
                                                        <div className="text-xs text-gray-500">{guesses[op.id].nazFirmy} — {guesses[op.id].datVyst}</div>
                                                        <Button size="sm" className="mt-2" onClick={async () => {
                                                            if (!selectedBatch || !guesses[op.id]) return;
                                                            await fetch("http://localhost:8000/bank/confirm_match", {
                                                                method: "POST",
                                                                headers: { "Content-Type": "application/json" },
                                                                body: JSON.stringify({
                                                                    batch_name: selectedBatch,
                                                                    bank_id: op.id,
                                                                    invoice_id: guesses[op.id].id
                                                                })
                                                            });
                                                            setOperations(prev => prev.map(o =>
                                                                o.id === op.id ? { ...o, confirm_match: true } : o
                                                            ));
                                                        }}>
                                                            Confirm match
                                                        </Button>
                                                        {op.confirm_match && (
                                                            <Button
                                                                size="sm"
                                                                variant="destructive"
                                                                onClick={async () => {
                                                                    if (!selectedBatch) return
                                                                    await fetch("http://localhost:8000/bank/delete_match", {
                                                                        method: "POST",
                                                                        headers: { "Content-Type": "application/json" },
                                                                        body: JSON.stringify({
                                                                            batch_name: selectedBatch,
                                                                            bank_id: op.id
                                                                        })
                                                                    })
                                                                    setOperations(prev =>
                                                                        prev.map(o =>
                                                                            o.id === op.id
                                                                                ? { ...o, confirm_match: false, initial_match: undefined }
                                                                                : o
                                                                        )
                                                                    )
                                                                    setGuesses(prev => {
                                                                        const updated = { ...prev }
                                                                        delete updated[op.id]
                                                                        return updated
                                                                    })
                                                                }}
                                                            >
                                                                🗑️ Delete match
                                                            </Button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm italic text-gray-500">No guess available. Try "Initial Guess for Selected" above.</p>
                                                )}

                                                <p className="text-sm font-medium text-gray-700 mt-4">🔍 Search manually:</p>
                                                <Input
                                                    placeholder="Invoice number, company name..."
                                                    value={searchQuery[op.id] || ""}
                                                    onChange={(e) =>
                                                        setSearchQuery((prev) => ({ ...prev, [op.id]: e.target.value }))
                                                    }
                                                />

                                                {searchQuery[op.id] && (
                                                    <div className="border rounded bg-white shadow-sm max-h-40 overflow-y-auto mt-2">
                                                        {invoices
                                                            .filter((inv) => {
                                                                const q = searchQuery[op.id].toLowerCase()
                                                                return (
                                                                    inv.cisloDosle?.toLowerCase().includes(q) ||
                                                                    inv.varSym?.toLowerCase().includes(q) ||
                                                                    inv.nazFirmy?.toLowerCase().includes(q)
                                                                )
                                                            })
                                                            .slice(0, 10)
                                                            .map((inv) => (
                                                                <div
                                                                    key={inv.id}
                                                                    className="px-2 py-1 border-b hover:bg-gray-100 text-sm flex justify-between items-center"
                                                                >
                                                                    <div>
                                                                        <div className="font-medium">
                                                                            {inv.cisloDosle} — {parseCzkAmount(inv.osv).toFixed(2)} Kč
                                                                        </div>
                                                                        <div className="text-xs text-gray-500">
                                                                            {inv.nazFirmy} — VS: {inv.varSym} — {inv.datVyst}
                                                                        </div>
                                                                    </div>
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={async () => {
                                                                            if (!selectedBatch) return
                                                                            await fetch("http://localhost:8000/bank/confirm_match", {
                                                                                method: "POST",
                                                                                headers: { "Content-Type": "application/json" },
                                                                                body: JSON.stringify({
                                                                                    batch_name: selectedBatch,
                                                                                    bank_id: op.id,
                                                                                    invoice_id: inv.id,
                                                                                }),
                                                                            })
                                                                            setOperations((prev) =>
                                                                                prev.map((o) =>
                                                                                    o.id === op.id
                                                                                        ? { ...o, confirm_match: true, initial_match: inv.id }
                                                                                        : o
                                                                                )
                                                                            )
                                                                            setGuesses((prev) => ({ ...prev, [op.id]: inv }))
                                                                        }}
                                                                    >
                                                                        Confirm
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                    </div>
                                                )}

                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </React.Fragment>
                        ))}
                    </TableBody>

                </Table>
            </div>
        </DashboardLayout>
    )
}
