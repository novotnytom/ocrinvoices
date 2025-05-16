import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../dashboard/layout';
import InvoiceQueueTable, { QueueMeta } from '../components/invcqueuelist/invcqueuelisttable';

export default function InvoiceQueueListPage() {
  const [queues, setQueues] = useState<QueueMeta[]>([]);
  const [totalInvoices, setTotalInvoices] = useState(0);
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


  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">Invoice Queues</h1>
          {/* New line for total */}
          <p className="text-sm text-gray-600">Total invoices: {totalInvoices}</p>
          <button
            onClick={() => navigate('/workflow')}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            + New Invoice Batch
          </button>          
        </div>
        <InvoiceQueueTable queues={queues} onDelete={deleteQueue} />
      </div>
    </DashboardLayout>
  );
}
