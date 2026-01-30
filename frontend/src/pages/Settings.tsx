import { useEffect, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import './Settings.css';

interface SettingsData {
  vacationFutureAccrueDays: number;
  sickLeaveWithoutCertificateLimit: number;
  sickLeaveWithCertificateLimit: number;
  vacationCarryoverLimit: number;
  updatedAt: string;
}

interface SettingsLog {
  id: string;
  createdAt: string;
  previousVacationFutureAccrue: number;
  newVacationFutureAccrue: number;
  previousSickLeaveWithoutCertificateLimit?: number | null;
  newSickLeaveWithoutCertificateLimit?: number | null;
  previousSickLeaveWithCertificateLimit?: number | null;
  newSickLeaveWithCertificateLimit?: number | null;
  previousVacationCarryoverLimit?: number | null;
  newVacationCarryoverLimit?: number | null;
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
  const [sickLeaveWithoutCertificateLimit, setSickLeaveWithoutCertificateLimit] = useState('');
  const [sickLeaveWithCertificateLimit, setSickLeaveWithCertificateLimit] = useState('');
  const [vacationCarryoverLimit, setVacationCarryoverLimit] = useState('');
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
      setSickLeaveWithoutCertificateLimit(
        response.data.sickLeaveWithoutCertificateLimit.toString()
      );
      setSickLeaveWithCertificateLimit(
        response.data.sickLeaveWithCertificateLimit.toString()
      );
      setVacationCarryoverLimit(response.data.vacationCarryoverLimit.toString());
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
    const withoutCertificateLimit = Number(sickLeaveWithoutCertificateLimit);
    const withCertificateLimit = Number(sickLeaveWithCertificateLimit);
    const carryoverLimit = Number(vacationCarryoverLimit);

    if (
      Number.isNaN(vacationValue) ||
      Number.isNaN(withoutCertificateLimit) ||
      Number.isNaN(withCertificateLimit) ||
      Number.isNaN(carryoverLimit)
    ) {
      alert('Please enter valid numbers for settings values.');
      return;
    }

    if (
      vacationValue < 0 ||
      withoutCertificateLimit < 0 ||
      withCertificateLimit < 0 ||
      carryoverLimit < 0
    ) {
      alert('Settings values must be zero or positive.');
      return;
    }

    setSaving(true);
    try {
      const response = await axios.put('/api/admin/settings', {
        vacationFutureAccrueDays: vacationValue,
        sickLeaveWithoutCertificateLimit: withoutCertificateLimit,
        sickLeaveWithCertificateLimit: withCertificateLimit,
        vacationCarryoverLimit: carryoverLimit,
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
            <label>Sick Leave Without Certificate (days per year)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={sickLeaveWithoutCertificateLimit}
              onChange={(e) => setSickLeaveWithoutCertificateLimit(e.target.value)}
            />
          </div>
          <div className="settings-field">
            <label>Sick Leave With Certificate (days per year)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={sickLeaveWithCertificateLimit}
              onChange={(e) => setSickLeaveWithCertificateLimit(e.target.value)}
            />
          </div>
          <div className="settings-field">
            <label>Vacation Carryover (days per year)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={vacationCarryoverLimit}
              onChange={(e) => setVacationCarryoverLimit(e.target.value)}
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
                  {(() => {
                    const changes: string[] = [];
                    if (log.previousVacationFutureAccrue !== log.newVacationFutureAccrue) {
                      changes.push(
                        `Vacation: ${log.previousVacationFutureAccrue.toFixed(2)} → ${log.newVacationFutureAccrue.toFixed(2)}`
                      );
                    }
                    if (
                      log.previousSickLeaveWithoutCertificateLimit !== undefined &&
                      log.newSickLeaveWithoutCertificateLimit !== undefined &&
                      log.previousSickLeaveWithoutCertificateLimit !== log.newSickLeaveWithoutCertificateLimit
                    ) {
                      changes.push(
                        `Sick Leave w/o Certificate: ${log.previousSickLeaveWithoutCertificateLimit} → ${log.newSickLeaveWithoutCertificateLimit}`
                      );
                    }
                    if (
                      log.previousSickLeaveWithCertificateLimit !== undefined &&
                      log.newSickLeaveWithCertificateLimit !== undefined &&
                      log.previousSickLeaveWithCertificateLimit !== log.newSickLeaveWithCertificateLimit
                    ) {
                      changes.push(
                        `Sick Leave w/ Certificate: ${log.previousSickLeaveWithCertificateLimit} → ${log.newSickLeaveWithCertificateLimit}`
                      );
                    }
                    if (
                      log.previousVacationCarryoverLimit !== undefined &&
                      log.newVacationCarryoverLimit !== undefined &&
                      log.previousVacationCarryoverLimit !== log.newVacationCarryoverLimit
                    ) {
                      changes.push(
                        `Vacation Carryover: ${log.previousVacationCarryoverLimit} → ${log.newVacationCarryoverLimit}`
                      );
                    }

                    if (changes.length === 0) {
                      return <div>No changes</div>;
                    }

                    return changes.map((change) => <div key={change}>{change}</div>);
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
