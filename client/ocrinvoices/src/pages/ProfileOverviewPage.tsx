import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../dashboard/layout';
import InvoiceProfileTable, { Profile } from '../components/invcprofiles/invcprofiletable';
import { Button } from '@/components/ui/button';

type ProfileSortOption = 'name-asc' | 'name-desc' | 'date-desc' | 'date-asc';

export default function ProfileOverviewPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [sortBy, setSortBy] = useState<ProfileSortOption>('date-desc');
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

  const sortedProfiles = [...profiles].sort((a, b) => {
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
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <span>Sort by</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as ProfileSortOption)}
                className="rounded border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="date-desc">Newest first</option>
                <option value="date-asc">Oldest first</option>
                <option value="name-asc">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
              </select>
            </label>
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
        <InvoiceProfileTable profiles={sortedProfiles} onDelete={deleteProfile} />
      </div>
    </DashboardLayout>
  );
}
