import { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import './Entitlement.css';

interface VacationEntitlement {
  type: 'vacation';
  currentlyAllowed: number;
  futureAccrue: number;
  pendingForApproval: number;
  approved: number;
}

interface SickLeaveEntitlement {
  type: 'sick_leave';
  currentlyAllowed: number;
  futureAccrue: number;
  pendingForApproval: number;
  approved: number;
}

interface DayOffEntitlement {
  type: 'day_off';
  currentlyAllowed: string; // "Unlimited"
}

interface WorkFromHomeEntitlement {
  type: 'work_from_home';
  currentlyAllowed: string; // "Unlimited"
}

type EntitlementDetails = VacationEntitlement | SickLeaveEntitlement | DayOffEntitlement | WorkFromHomeEntitlement;

interface Absence {
  id: string;
  type: 'sick_leave' | 'day_off' | 'vacation' | 'work_from_home';
  from: string;
  to: string;
  status: 'pending' | 'approved' | 'rejected';
}

export default function Entitlement() {
  const [entitlements, setEntitlements] = useState<EntitlementDetails[]>([]);
  const [history, setHistory] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEntitlements();
  }, []);

  const fetchEntitlements = async () => {
    try {
      const response = await axios.get('/api/entitlements/me');
      setEntitlements(response.data.entitlements);
      setHistory(response.data.history);
    } catch (error) {
      console.error('Error fetching entitlements:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'vacation':
        return 'Vacation';
      case 'sick_leave':
        return 'Sick Leave';
      case 'day_off':
        return 'Day Off';
      case 'work_from_home':
        return 'Work from Home';
      default:
        return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'vacation':
        return '#1976d2'; // Dark blue
      case 'sick_leave':
        return '#2e7d32'; // Green
      case 'day_off':
        return '#ec407a'; // Pink
      case 'work_from_home':
        return '#42a5f5'; // Light blue
      default:
        return '#7f8c8d';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return '#27ae60';
      case 'rejected':
        return '#e74c3c';
      case 'pending':
        return '#f39c12';
      default:
        return '#95a5a6';
    }
  };

  const renderProgressBar = (entitlement: EntitlementDetails) => {
    if (entitlement.type === 'day_off' || entitlement.type === 'work_from_home') {
      // Unlimited - show full bar
      return (
        <div className="progress-bar-container">
          <div
            className="progress-bar"
            style={{
              width: '100%',
              backgroundColor: getTypeColor(entitlement.type),
            }}
          />
        </div>
      );
    }

    const isVacation = entitlement.type === 'vacation';
    const maxDays = isVacation ? 18 : 10; // Max days per year
    const percentage = Math.min(100, (entitlement.currentlyAllowed / maxDays) * 100);

    return (
      <div className="progress-bar-container">
        <div
          className="progress-bar"
          style={{
            width: `${percentage}%`,
            backgroundColor: getTypeColor(entitlement.type),
          }}
        />
      </div>
    );
  };

  const renderEntitlementCard = (entitlement: EntitlementDetails) => {
    const isLimited = entitlement.type === 'vacation' || entitlement.type === 'sick_leave';
    const allowance = typeof entitlement.currentlyAllowed === 'number'
      ? `${entitlement.currentlyAllowed.toFixed(2)} Days`
      : entitlement.currentlyAllowed;

    return (
      <div key={entitlement.type} className="entitlement-card">
        <div className="entitlement-header">
          <h3>{getTypeLabel(entitlement.type)}</h3>
          <div className="entitlement-allowance">{allowance}</div>
        </div>

        {renderProgressBar(entitlement)}

        <div className="entitlement-details">
          <div className="detail-item">
            <span className="detail-label">Currently Allowed:</span>
            <span className="detail-value">
              {typeof entitlement.currentlyAllowed === 'number'
                ? `${entitlement.currentlyAllowed.toFixed(2)} Days`
                : entitlement.currentlyAllowed}
            </span>
          </div>

          {isLimited && (
            <>
              <div className="detail-item">
                <span className="detail-label">Future Accrue:</span>
                <span className="detail-value">
                  {typeof entitlement.futureAccrue === 'number'
                    ? `${entitlement.futureAccrue.toFixed(2)} Days`
                    : '-'}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Pending For Approval:</span>
                <span className="detail-value">
                  {typeof entitlement.pendingForApproval === 'number'
                    ? `${entitlement.pendingForApproval.toFixed(2)} Days`
                    : '0 Days'}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Approved:</span>
                <span className="detail-value">
                  {typeof entitlement.approved === 'number'
                    ? `${entitlement.approved.toFixed(2)} Days`
                    : '0 Days'}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="entitlement-page">
      <div className="page-header">
        <h1>Entitlement</h1>
        <button className="btn-secondary">Leave types</button>
      </div>

      <div className="entitlements-grid">
        {entitlements.map((entitlement) => renderEntitlementCard(entitlement))}
      </div>

      <div className="history-section">
        <h2>Requests History</h2>
        {history.length === 0 ? (
          <p className="no-history">No history available</p>
        ) : (
          <div className="history-list">
            {history.map((absence) => (
              <div key={absence.id} className="history-item">
                <div className="history-type">{getTypeLabel(absence.type)}</div>
                <div className="history-dates">
                  {format(new Date(absence.from), 'MMM dd, yyyy')} -{' '}
                  {format(new Date(absence.to), 'MMM dd, yyyy')}
                </div>
                <div
                  className="history-status"
                  style={{ color: getStatusColor(absence.status) }}
                >
                  {absence.status.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
