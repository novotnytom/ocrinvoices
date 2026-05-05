import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../dashboard/layout';
import InvoiceProfileTable, { Profile } from '../components/invcprofiles/invcprofiletable';
import { Button } from '@/components/ui/button';

export default function ProfileOverviewPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const navigate = useNavigate();

  const loadProfiles = async () => {
    const res = await fetch('http://localhost:8000/profiles');
    const data = await res.json();
    setProfiles(data);
  };

  const deleteProfile = async (name: string) => {
    if (!confirm(`Really delete profile "${name}"?`)) return;
    await fetch(`http://localhost:8000/profiles/${name}`, {
      method: 'DELETE',
    });
    await loadProfiles();
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleExportFlexibeeExamples = async () => {
    const response = await fetch('http://localhost:8000/profiles/export/flexibee-examples');

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      alert(error?.detail || 'Failed to export FlexiBee XML examples.');
      return;
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flexibee_template_examples.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold">Invoice Profiles</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportFlexibeeExamples}>
              Export FlexiBee XML Examples
            </Button>
            <button
              onClick={() => navigate('/setup-profile')}
              className="px-4 py-2 bg-green-600 text-white rounded shadow"
            >
              + New Profile
            </button>
          </div>
        </div>
        <InvoiceProfileTable profiles={profiles} onDelete={deleteProfile} />
      </div>
    </DashboardLayout>
  );
}
