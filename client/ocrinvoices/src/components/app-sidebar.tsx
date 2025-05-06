import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton
} from "@/components/ui/sidebar";
import {
  PlusCircle,
  ListOrdered,
  FolderOpen,
  FileUp,
  FileText,
  Files,
  X,
  DatabaseBackup
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

interface Profile {
  name: string;
}

interface QueueMeta {
  name: string;
}

export function AppSidebar() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [queues, setQueues] = useState<QueueMeta[]>([]);
  const [search, setSearch] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    fetch("http://localhost:8000/profiles").then(res => res.json()).then(setProfiles);
    fetch("http://localhost:8000/queues").then(res => res.json()).then(setQueues);
  }, []);

  const filteredItems = [...profiles.map(p => ({ ...p, type: "profile" })), ...queues.map(q => ({ ...q, type: "queue" }))]
    .filter(item => item.name.toLowerCase().includes(search.toLowerCase()));

  const visibleItems = search ? filteredItems : [...profiles.slice(0, 3).map(p => ({ ...p, type: "profile" })), ...queues.slice(0, 2).map(q => ({ ...q, type: "queue" }))];

  const handleBackup = async () => {
    try {
      const response = await fetch('http://localhost:8000/backup', { method: 'POST' });
      const data = await response.json();
      alert(`Backup created: ${data.file}`);
    } catch (err) {
      console.error(err);
      alert('Failed to create backup');
    }
  };
  

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-border">
        <div className="text-xl font-bold">UCTO: rpm_mob</div>
      </SidebarHeader>

      <SidebarContent className="flex flex-col p-4 gap-6 overflow-auto">

        <SidebarGroup>
          <SidebarGroupLabel>General Setup</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="/general-invc">
                    <FileText className="w-4 h-4 mr-1" />
                    <span>Export Template (FLEXI)</span>
                  </a>
                </SidebarMenuButton>
                <SidebarMenuButton asChild>
                  <a onClick={handleBackup}>
                    <DatabaseBackup className="w-4 h-4 mr-1" />
                    <span>Start Backup Now</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>


        <SidebarGroup>
          <SidebarGroupLabel>OCR INVOICE TOOL</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="/setup-profile">
                    <PlusCircle className="w-4 h-4 mr-1" />
                    <span>Create a new Template</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="/profiles">
                    <FolderOpen className="w-4 h-4 mr-1" />
                    <span>Manage Templates</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="/workflow">
                    <FileUp className="w-4 h-4 mr-1" />
                    <span>Upload Batch (*.zip)</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="/invcqueue">
                    <ListOrdered className="w-4 h-4 mr-1" />
                    <span>Invoice Queue</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>WORKSPACE</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="relative">
              <Input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="h-8 text-xs pr-8 mb-2"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1.5 p-1 rounded-full bg-muted-foreground/30 text-foreground hover:bg-muted-foreground/50 transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const isProfile = item.type === "profile";
                const icon = isProfile ? <FileText className="w-3 h-3 mr-1" /> : <Files className="w-3 h-3 mr-1" />;
                const onClick = () => {
                  if (isProfile) navigate(`/setup-profile/${item.name}`);
                  else navigate(`/workflow?queue=${item.name}`);
                };

                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton onClick={onClick} className="text-sm text-muted-foreground cursor-pointer">
                      {icon}
                      <span>{item.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              {(!search && (profiles.length > 3 || queues.length > 2)) && (
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => navigate('/workspace')} className="text-sm text-muted-foreground cursor-pointer">
                    <span>More...</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>FINAL EXPORT</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="/general-overview">
                    <ListOrdered className="w-4 h-4 mr-1" />
                    <span>All Invoices to Export</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>



      </SidebarContent>

      <SidebarFooter className="text-xs text-muted-foreground p-4 border-t border-border space-y-1">
        <div>Version: 0.1.1</div>
        <div>RPM-mobility s.r.o.</div>
        <div>Revoluční třída 232</div>
        <div>Nový Bydžov 504 01</div>
        <div>IČO: 09144561</div>
      </SidebarFooter>
    </Sidebar>
  );
}