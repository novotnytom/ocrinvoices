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
  
  export interface Profile {
    name: string;
    created: string;
    updated: string;
  }
  
  interface InvoiceProfileTableProps {
    profiles: Profile[];
    onDelete: (name: string) => void;
  }
  
  export default function InvoiceProfileTable({ profiles, onDelete }: InvoiceProfileTableProps) {
    const navigate = useNavigate();
  
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-left">Name</TableHead>
            <TableHead className="text-left">Created</TableHead>
            <TableHead className="text-left">Updated</TableHead>
            <TableHead className="text-left">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {profiles.map((profile) => (
            <TableRow key={profile.name}>
              <TableCell className="font-mono text-left">{profile.name}</TableCell>
              <TableCell className="text-gray-500 text-left">{profile.created?.slice(0, 10)}</TableCell>
              <TableCell className="text-gray-500 text-left">{profile.updated?.slice(0, 10)}</TableCell>
              <TableCell className="text-left">
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => navigate(`/setup-profile/${profile.name}`)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(profile.name)}
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
  