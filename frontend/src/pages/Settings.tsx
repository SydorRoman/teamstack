import { useEffect, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import './Settings.css';

interface SettingsData {
  vacationFutureAccrueDays: number;
  sickLeaveFutureAccrueDays: number;
  updatedAt: string;
}

interface SettingsLog {
  id: string;
  createdAt: string;
  previousVacationFutureAccrue: number;
  newVacationFutureAccrue: number;
  previousSickLeaveFutureAccrue: number;
  newSickLeaveFutureAccrue: number;
  admin: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export default function Settings() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [logs, setLogs] = useState<SettingsLog[]>([]);
  const [vacationFutureAccrueDays, setVacationFutureAccrueDays] = useState('');
  const [sickLeaveFutureAccrueDays, setSickLeaveFutureAccrueDays] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchLogs();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get('/api/admin/settings');
      setSettings(response.data);
      setVacationFutureAccrueDays(response.data.vacationFutureAccrueDays.toString());
      setSickLeaveFutureAccrueDays(response.data.sickLeaveFutureAccrueDays.toString());
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await axios.get('/api/admin/settings/logs');
      setLogs(response.data);
    } catch (error) {
      console.error('Error fetching settings logs:', error);
    }
  };

  const handleSave = async () => {
    const vacationValue = Number(vacationFutureAccrueDays);
    const sickLeaveValue = Number(sickLeaveFutureAccrueDays);

    if (Number.isNaN(vacationValue) || Number.isNaN(sickLeaveValue)) {
      alert('Please enter valid numbers for accrual values.');
      return;
    }

    if (vacationValue < 0 || sickLeaveValue < 0) {
      alert('Accrual values must be zero or positive.');
      return;
    }

    setSaving(true);
    try {
      const response = await axios.put('/api/admin/settings', {
        vacationFutureAccrueDays: vacationValue,
        sickLeaveFutureAccrueDays: sickLeaveValue,
      });
      setSettings(response.data);
      await fetchLogs();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Settings</h1>
      </div>

      <div className="settings-section">
        <h2>Accrual Settings</h2>
        <div className="settings-grid">
          <div className="settings-field">
            <label>Vacation Future Accrue (days)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={vacationFutureAccrueDays}
              onChange={(e) => setVacationFutureAccrueDays(e.target.value)}
            />
          </div>
          <div className="settings-field">
            <label>Sick Leave Future Accrue (days)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={sickLeaveFutureAccrueDays}
              onChange={(e) => setSickLeaveFutureAccrueDays(e.target.value)}
            />
          </div>
        </div>
        <div className="settings-actions">
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          {settings?.updatedAt && (
            <span className="settings-updated">
              Last updated: {format(new Date(settings.updatedAt), 'MMM dd, yyyy HH:mm')}
            </span>
          )}
        </div>
      </div>

      <div className="settings-section">
        <h2>Change Log</h2>
        {logs.length === 0 ? (
          <p className="no-data">No changes yet</p>
        ) : (
          <div className="settings-log">
            {logs.map((log) => (
              <div key={log.id} className="settings-log-item">
                <div className="log-header">
                  <div className="log-admin">
                    {log.admin.firstName} {log.admin.lastName} ({log.admin.email})
                  </div>
                  <div className="log-date">
                    {format(new Date(log.createdAt), 'MMM dd, yyyy HH:mm')}
                  </div>
                </div>
                <div className="log-details">
                  <div>
                    Vacation: {log.previousVacationFutureAccrue.toFixed(2)} →{' '}
                    {log.newVacationFutureAccrue.toFixed(2)}
                  </div>
                  <div>
                    Sick Leave: {log.previousSickLeaveFutureAccrue.toFixed(2)} →{' '}
                    {log.newSickLeaveFutureAccrue.toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
