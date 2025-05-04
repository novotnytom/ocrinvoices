import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../dashboard/layout';
import InvoiceProfileTable, { Profile } from '../components/invcprofiles/invcprofiletable';

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

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold">Invoice Profiles</h1>
          <button
            onClick={() => navigate('/setup-profile')}
            className="px-4 py-2 bg-green-600 text-white rounded shadow"
          >
            + New Profile
          </button>
        </div>
        <InvoiceProfileTable profiles={profiles} onDelete={deleteProfile} />
      </div>
    </DashboardLayout>
  );
}
