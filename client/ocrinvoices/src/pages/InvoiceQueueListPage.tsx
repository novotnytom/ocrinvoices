import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../dashboard/layout';
import InvoiceQueueTable, { QueueMeta } from '../components/invcqueuelist/invcqueuelisttable';

type QueueSortOption = 'name-asc' | 'name-desc' | 'date-desc' | 'date-asc';

export default function InvoiceQueueListPage() {
  const [queues, setQueues] = useState<QueueMeta[]>([]);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const [sortBy, setSortBy] = useState<QueueSortOption>('date-desc');
  const navigate = useNavigate();

  const loadQueues = async () => {
    const res = await fetch('http://localhost:8000/queues');
    const data = await res.json();
    setQueues(data);

    // Calculate total invoices from pages
    const total = data.reduce((sum: number, queue: QueueMeta) => sum + (queue.pages?.length || 0), 0);
    setTotalInvoices(total);
  };

  const deleteQueue = async (name: string) => {
    if (!confirm(`Delete queue "${name}"?`)) return;
    await fetch(`http://localhost:8000/queues/${name}`, { method: 'DELETE' });
    loadQueues();
  };

  useEffect(() => {
    loadQueues();
  }, []);

  const sortedQueues = [...queues].sort((a, b) => {
    if (sortBy === 'name-asc') {
      return a.name.localeCompare(b.name);
    }

    if (sortBy === 'name-desc') {
      return b.name.localeCompare(a.name);
    }

    const aTime = a.updated ? new Date(a.updated).getTime() : 0;
    const bTime = b.updated ? new Date(b.updated).getTime() : 0;

    return sortBy === 'date-asc' ? aTime - bTime : bTime - aTime;
  });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">Invoice Queues</h1>
            <p className="text-sm text-gray-600">Total invoices: {totalInvoices}</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <span>Sort by</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as QueueSortOption)}
                className="rounded border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="date-desc">Newest first</option>
                <option value="date-asc">Oldest first</option>
                <option value="name-asc">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
              </select>
            </label>
            <button
              onClick={() => navigate('/workflow')}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              + New Invoice Batch
            </button>
          </div>
        </div>
        <InvoiceQueueTable queues={sortedQueues} onDelete={deleteQueue} />
      </div>
    </DashboardLayout>
  );
}
