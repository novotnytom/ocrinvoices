import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export interface QueueMeta {
  name: string;
  profile: string;
  created: string;
  updated: string;
  pages: string[];
}

interface InvoiceQueueTableProps {
  queues: QueueMeta[];
  onDelete: (name: string) => void;
}

export default function InvoiceQueueTable({ queues, onDelete }: InvoiceQueueTableProps) {
  const navigate = useNavigate();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-left">Name</TableHead>
          <TableHead className="text-left">Profile</TableHead>
          <TableHead className="text-left">Invoices</TableHead> {/* Changed */}
          <TableHead className="text-left">Updated</TableHead>
          <TableHead className="text-left">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {queues.map((queue) => (
          <TableRow key={queue.name}>
            <TableCell className="font-mono text-left">{queue.name}</TableCell>
            <TableCell className="text-left">{queue.profile}</TableCell>
            <TableCell className="text-left">{queue.pages.length}</TableCell> {/* NEW */}
            <TableCell className="text-xs text-left">{new Date(queue.updated).toLocaleString()}</TableCell>
            <TableCell className="text-left">
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => navigate(`/workflow?queue=${queue.name}`)}
                >
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(queue.name)}
                >
                  Delete
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>

    </Table>
  );
}
