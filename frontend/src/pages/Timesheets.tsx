import { useState, useEffect } from 'react';
import axios from 'axios';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, startOfWeek, endOfWeek, isSameDay } from 'date-fns';
import { WorkLogForm, WorkLogFormData } from '../components/WorkLogForm';
import { AbsenceForm, AbsenceFormData } from './AbsenceForm';
import { BookingBar } from '../components/BookingBar';
import { useAuth } from '../contexts/AuthContext';
import './Timesheets.css';

interface WorkLog {
  id: string;
  date: string;
  start: string;
  end: string;
  projectId: string | null;
  note: string | null;
  isPastDue: boolean;
  project?: {
    id: string;
    name: string;
  } | null;
}

interface Project {
  id: string;
  name: string;
}

interface Absence {
  id: string;
  type: 'vacation' | 'sick_leave' | 'day_off';
  from: string;
  to: string;
  status: 'pending' | 'approved' | 'rejected';
  files?: { id: string; originalName: string }[];
}

export default function Timesheets() {
  const { user } = useAuth();
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [editingLog, setEditingLog] = useState<WorkLog | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedAbsence, setSelectedAbsence] = useState<Absence | null>(null);
  const [initialAbsenceValues, setInitialAbsenceValues] = useState<Partial<AbsenceFormData> | undefined>(undefined);
  const [canDeleteAbsenceFiles, setCanDeleteAbsenceFiles] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkLogs();
    fetchAbsences();
    fetchProjects();
  }, [currentMonth]);

  const fetchWorkLogs = async () => {
    try {
      setLoading(true);
      const month = format(currentMonth, 'yyyy-MM');
      const response = await axios.get(`/api/worklogs/me?month=${month}`);
      setWorkLogs(response.data);
    } catch (error) {
      console.error('Error fetching work logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAbsences = async () => {
    try {
      const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);
      
      const response = await axios.get('/api/absences', {
        params: {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        },
      });
      setAbsences(response.data);
    } catch (error) {
      console.error('Error fetching absences:', error);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await axios.get('/api/admin/projects');
      setProjects(response.data);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const handleCreateOrUpdate = async (data: WorkLogFormData) => {
    setIsSaving(true);
    try {
      if (editingLog) {
        await axios.put(`/api/worklogs/${editingLog.id}`, data);
      } else {
        await axios.post('/api/worklogs', data);
      }
      setShowModal(false);
      setEditingLog(null);
      setSelectedDate(null);
      fetchWorkLogs();
    } catch (error: any) {
      console.error('Error saving work log:', error);
      alert(error.response?.data?.error || 'Failed to save work log');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadAbsenceFiles = async (data: AbsenceFormData) => {
    if (!selectedAbsence) {
      return;
    }

    if (selectedAbsence.type !== 'sick_leave') {
      alert('Files can only be added to Sick Leave absences.');
      return;
    }

    if (!data.files || data.files.length === 0) {
      alert('Please attach at least one file.');
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      data.files.forEach((file) => {
        formData.append('files', file);
      });

      await axios.post(`/api/absences/${selectedAbsence.id}/files`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setShowAbsenceModal(false);
      setSelectedAbsence(null);
      setInitialAbsenceValues(undefined);
      setCanDeleteAbsenceFiles(false);
      fetchAbsences();
    } catch (error: any) {
      console.error('Error uploading absence files:', error);
      alert(error.response?.data?.error || 'Failed to upload files');
    } finally {
      setIsSaving(false);
    }
  };


  const calculateHours = (log: WorkLog): number => {
    const start = new Date(log.start);
    const end = new Date(log.end);
    const totalMs = end.getTime() - start.getTime();
    return totalMs / (1000 * 60 * 60);
  };

  const getWorkLogsForDate = (date: Date): WorkLog[] => {
    // Normalize date to local date (ignore time)
    const dateStr = format(date, 'yyyy-MM-dd');
    return workLogs.filter((log) => {
      const logDate = new Date(log.date);
      const logDateStr = format(logDate, 'yyyy-MM-dd');
      return logDateStr === dateStr;
    });
  };

  const getAbsencesForDate = (date: Date): Absence[] => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return absences.filter((absence: Absence) => {
      // Exclude rejected absences
      if (absence.status === 'rejected') {
        return false;
      }
      const from = new Date(absence.from);
      const to = new Date(absence.to);
      const fromStr = format(from, 'yyyy-MM-dd');
      const toStr = format(to, 'yyyy-MM-dd');
      return dateStr >= fromStr && dateStr <= toStr;
    });
  };

  const handleAbsenceClick = (absence: Absence) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const absenceStart = new Date(absence.from);
    absenceStart.setHours(0, 0, 0, 0);
    const canDeleteFiles = absenceStart >= today && absence.status !== 'approved';

    setSelectedAbsence(absence);
    setInitialAbsenceValues({
      type: absence.type,
      dateRange: {
        from: new Date(absence.from).toISOString(),
        to: new Date(absence.to).toISOString(),
      },
      existingFiles: absence.files?.map((file) => ({
        id: file.id,
        originalName: file.originalName,
      })),
    });
    setCanDeleteAbsenceFiles(canDeleteFiles);
    setShowAbsenceModal(true);
  };

  const handleDayClick = (date: Date) => {
    const logs = getWorkLogsForDate(date);
    if (logs.length > 0) {
      // Show list of logs for this date
      setSelectedDate(date);
      setShowNoteModal(true);
    } else {
      // Create new log for this date
      setSelectedDate(date);
      setEditingLog(null);
      setShowModal(true);
    }
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    const today = new Date();
    if (nextMonth <= today) {
      setCurrentMonth(nextMonth);
    }
  };

  const totalHours = workLogs.reduce((sum, log) => sum + calculateHours(log), 0);

  return (
    <div className="timesheets-page">
      <div className="page-header">
        <h1>Timesheets</h1>
        <button className="btn-primary" onClick={() => {
          setEditingLog(null);
          setSelectedDate(null);
          setShowModal(true);
        }}>
          Log Work Time
        </button>
      </div>

      <div className="timesheets-controls">
        <div className="month-selector">
          <button onClick={goToPreviousMonth} className="month-nav-button">
            ← Prev
          </button>
          <h2>{format(currentMonth, 'MMMM yyyy')}</h2>
          <button
            onClick={goToNextMonth}
            className="month-nav-button"
            disabled={format(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1), 'yyyy-MM') > format(new Date(), 'yyyy-MM')}
          >
            Next →
          </button>
        </div>
        <div className="summary">
          <span className="summary-label">Total Hours:</span>
          <span className="summary-value">{totalHours.toFixed(2)}</span>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <div className="timesheets-calendar-container">
          <div className="calendar-grid">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
              <div key={day} className={`calendar-day-header ${index === 0 || index === 6 ? 'weekend-header' : ''}`}>
                {day}
              </div>
            ))}
            
            {(() => {
              const monthStart = startOfMonth(currentMonth);
              const monthEnd = endOfMonth(currentMonth);
              const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
              const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
              const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

              return calendarDays.map((date) => {
                const logs = getWorkLogsForDate(date);
                const dayAbsences = getAbsencesForDate(date);
                const isCurrentMonth = isSameMonth(date, currentMonth);
                const dayOfWeek = date.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const totalHours = logs.reduce((sum, log) => sum + calculateHours(log), 0);
                const isToday = isSameDay(date, new Date());
                const hasPastDue = logs.some(log => log.isPastDue);

                return (
                  <div
                    key={date.toISOString()}
                    className={`calendar-day-cell ${isWeekend ? 'weekend' : ''} ${!isCurrentMonth ? 'other-month' : ''} ${logs.length > 0 ? 'has-log' : ''} ${dayAbsences.length > 0 ? 'has-absence' : ''} ${isToday ? 'today' : ''} ${hasPastDue ? 'past-due' : ''}`}
                    onClick={() => handleDayClick(date)}
                  >
                    <div className="calendar-day-number">{format(date, 'd')}</div>
                    {logs.length > 0 && (
                      <div className="calendar-day-content">
                        <div className="calendar-day-hours">{totalHours.toFixed(1)}h</div>
                        {logs.length > 1 && (
                          <div className="calendar-day-projects">{logs.length} projects</div>
                        )}
                        {hasPastDue && (
                          <div className="calendar-day-past-due">Past Due</div>
                        )}
                      </div>
                    )}
                    {dayAbsences.length > 0 && (
                      <div className="calendar-day-bookings">
                        {dayAbsences.map((absence: Absence) => (
                          <BookingBar
                            key={absence.id}
                            firstName={user?.firstName || ''}
                            lastName={user?.lastName || ''}
                            userId={user?.id || ''}
                            type={absence.type}
                            compact={true}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleAbsenceClick(absence);
                            }}
                          />
                        ))}
                      </div>
                    )}
                    {logs.length === 0 && !dayAbsences.length && isCurrentMonth && (
                      <div className="calendar-day-empty">Click to log</div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {showNoteModal && selectedDate && (
        <div className="modal-overlay" onClick={() => {
          setShowNoteModal(false);
          setSelectedDate(null);
        }}>
          <div className="modal-content note-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-with-action">
              <h2>Work Logs - {format(selectedDate, 'MMM dd, yyyy')}</h2>
              <button
                className="btn-primary btn-sm"
                onClick={() => {
                  setShowNoteModal(false);
                  setEditingLog(null);
                  setShowModal(true);
                }}
              >
                + Add Log
              </button>
            </div>
            {(() => {
              const logs = getWorkLogsForDate(selectedDate);
              if (logs.length === 0) {
                return (
                  <div className="work-log-list-empty">
                    <p>No work logs for this date</p>
                    <button
                      className="btn-primary"
                      onClick={() => {
                        setShowNoteModal(false);
                        setEditingLog(null);
                        setShowModal(true);
                      }}
                    >
                      Add First Log
                    </button>
                  </div>
                );
              }
              return (
                <div className="work-log-list">
                  {logs.map((log) => (
                    <div key={log.id} className="work-log-item">
                      <div className="work-log-details">
                        <div className="detail-row">
                          <span className="detail-label">Hours:</span>
                          <span className="detail-value">{calculateHours(log).toFixed(2)}h</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Project:</span>
                          <span className="detail-value">{log.project?.name || '-'}</span>
                        </div>
                        {log.isPastDue && (
                          <div className="detail-row">
                            <span className="detail-label"></span>
                            <span className="detail-value past-due-badge">⚠️ Past Due</span>
                          </div>
                        )}
                        {log.note && (
                          <div className="detail-row note-row">
                            <span className="detail-label">Note:</span>
                            <div className="detail-note">{log.note}</div>
                          </div>
                        )}
                      </div>
                      <div className="work-log-item-actions">
                        <button
                          onClick={() => {
                            setEditingLog(log);
                            setShowNoteModal(false);
                            setSelectedDate(null);
                            setShowModal(true);
                          }}
                          className="btn-secondary btn-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm('Are you sure you want to delete this work log?')) {
                              try {
                                await axios.delete(`/api/worklogs/${log.id}`);
                                fetchWorkLogs();
                                if (logs.length === 1) {
                                  setShowNoteModal(false);
                                  setSelectedDate(null);
                                }
                              } catch (error: any) {
                                console.error('Error deleting work log:', error);
                                alert(error.response?.data?.error || 'Failed to delete work log');
                              }
                            }
                          }}
                          className="btn-danger btn-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
            <div className="modal-actions">
              <button
                onClick={() => {
                  setShowNoteModal(false);
                  setSelectedDate(null);
                }}
                className="btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showAbsenceModal && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Upload Sick Leave Files</h2>
            <AbsenceForm
              onSubmit={handleUploadAbsenceFiles}
              onCancel={() => {
                setShowAbsenceModal(false);
                setSelectedAbsence(null);
                setInitialAbsenceValues(undefined);
                setCanDeleteAbsenceFiles(false);
              }}
              initialValues={initialAbsenceValues}
              loading={isSaving}
              disableType={Boolean(selectedAbsence)}
              disableDateRange={Boolean(selectedAbsence)}
              canDeleteExistingFiles={canDeleteAbsenceFiles}
              submitLabel="Upload Files"
              submittingLabel="Uploading..."
            />
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingLog ? 'Edit Work Log' : 'Log Work Time'}</h2>
            <WorkLogForm
              onSubmit={handleCreateOrUpdate}
              onCancel={() => {
                setShowModal(false);
                setEditingLog(null);
                setSelectedDate(null);
              }}
              initialValues={editingLog ? {
                date: editingLog.date,
                start: editingLog.start,
                end: editingLog.end,
                projectId: editingLog.projectId || undefined,
                note: editingLog.note || undefined,
              } : selectedDate ? {
                date: format(selectedDate, 'yyyy-MM-dd'),
              } : undefined}
              loading={isSaving}
              projects={projects}
            />
          </div>
        </div>
      )}
    </div>
  );
}
