import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import './EmployeeProfile.css';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  telegram: string | null;
  birthDate: string | null;
  hireDate: string | null;
  position: { id: string; name: string } | string | null;
  gender: string | null;
  city: string | null;
  country: string | null;
  projects: Array<{ id: string; name: string }>;
  technologies: Array<{ id: string; name: string }>;
}

interface Technology {
  id: string;
  name: string;
}

export default function EmployeeProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [allTechnologies, setAllTechnologies] = useState<Technology[]>([]);
  const [selectedTechnologyIds, setSelectedTechnologyIds] = useState<string[]>([]);
  const [isTechnologiesModalOpen, setIsTechnologiesModalOpen] = useState(false);
  const [technologySearch, setTechnologySearch] = useState('');
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    telegram: '',
    birthDate: '',
    hireDate: '',
    gender: '',
    city: '',
    country: '',
  });

  const normalizeEmployee = (data: Employee) => ({
    ...data,
    projects: data.projects ?? [],
    technologies: data.technologies ?? [],
  });

  useEffect(() => {
    if (id) {
      fetchEmployee();
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchAllTechnologies();
    }
  }, [id]);

  useEffect(() => {
    if (employee && !isEditing) {
      setFormData({
        firstName: employee.firstName || '',
        lastName: employee.lastName || '',
        email: employee.email || '',
        phone: employee.phone || '',
        telegram: employee.telegram || '',
        birthDate: employee.birthDate ? format(new Date(employee.birthDate), 'yyyy-MM-dd') : '',
        hireDate: employee.hireDate ? format(new Date(employee.hireDate), 'yyyy-MM-dd') : '',
        gender: employee.gender || '',
        city: employee.city || '',
        country: employee.country || '',
      });
      setSelectedTechnologyIds((employee.technologies ?? []).map((tech) => tech.id));
    }
  }, [employee, isEditing]);

  const fetchEmployee = async () => {
    try {
      const response = await axios.get(`/api/employees/${id}`);
      setEmployee(normalizeEmployee(response.data));
    } catch (error) {
      console.error('Error fetching employee:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllTechnologies = async () => {
    try {
      const response = await axios.get('/api/user-technologies/all');
      setAllTechnologies(response.data);
    } catch (error) {
      console.error('Error fetching technologies:', error);
    }
  };

  const canEdit = Boolean(user?.isAdmin || (user?.id && user.id === id));
  const isSelf = Boolean(user?.id && user.id === id);

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!id) return;
    setIsSaving(true);
    try {
      const basePayload = { ...formData };
      const payload = user?.isAdmin
        ? basePayload
        : (({ hireDate, ...rest }) => rest)(basePayload);
      const response = await axios.put(`/api/employees/${id}`, payload);
      setEmployee((prev) => {
        const base = prev ?? (response.data as Employee);
        return normalizeEmployee({
          ...base,
          ...response.data,
          projects: response.data.projects ?? base.projects ?? [],
          technologies: response.data.technologies ?? base.technologies ?? [],
          position: response.data.position ?? base.position ?? null,
        });
      });
      setIsEditing(false);
      if (user?.id === id) {
        updateUser({
          firstName: response.data.firstName,
          lastName: response.data.lastName,
          email: response.data.email,
        });
      }
    } catch (error: any) {
      console.error('Error updating employee:', error);
      alert(error.response?.data?.error || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const saveTechnologies = async (technologyIds: string[]) => {
    if (!id) return;
    try {
      const response = await axios.put(`/api/user-technologies/${id}`, {
        technologyIds,
      });
      setEmployee((prev) => (prev ? { ...prev, technologies: response.data } : prev));
    } catch (error: any) {
      console.error('Error updating technologies:', error);
      alert(error.response?.data?.error || 'Failed to update technologies');
    }
  };

  const toggleTechnology = (techId: string) => {
    if (!canEdit) return;
    setSelectedTechnologyIds((prev) => {
      const next = prev.includes(techId) ? prev.filter((id) => id !== techId) : [...prev, techId];
      void saveTechnologies(next);
      return next;
    });
  };

  const handleTechnologyAdd = (techId: string) => {
    if (!canEdit || selectedTechnologyIds.includes(techId)) return;
    setSelectedTechnologyIds((prev) => {
      const next = [...prev, techId];
      void saveTechnologies(next);
      return next;
    });
  };

  const selectedTechnologies = allTechnologies.filter((tech) =>
    selectedTechnologyIds.includes(tech.id)
  );

  const filteredTechnologies = allTechnologies.filter((tech) =>
    tech.name.toLowerCase().includes(technologySearch.trim().toLowerCase())
  );

  const handlePasswordSave = async () => {
    if (!id) return;
    if (passwordData.newPassword.length < 6) {
      alert('New password must be at least 6 characters long');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('New password and confirmation do not match');
      return;
    }
    setIsPasswordSaving(true);
    try {
      await axios.put(`/api/employees/${id}/password`, {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      alert('Password updated successfully');
    } catch (error: any) {
      console.error('Error updating password:', error);
      alert(error.response?.data?.error || 'Failed to update password');
    } finally {
      setIsPasswordSaving(false);
    }
  };

  const getPositionName = () => {
    if (!employee?.position) return '-';
    if (typeof employee.position === 'string') return employee.position;
    return employee.position.name || '-';
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!employee) {
    return <div className="error">Employee not found</div>;
  }

  return (
    <div className="employee-profile">
      <button className="back-button" onClick={() => navigate('/employees')}>
        ← Back to Employees
      </button>
      <div className="profile-header">
        <div className="profile-avatar">
          {employee.firstName[0]}
          {employee.lastName[0]}
        </div>
        <div className="profile-name">
          <h1>
            {employee.firstName} {employee.lastName}
          </h1>
          <p className="profile-email">{employee.email}</p>
        </div>
      </div>

      <div className="profile-content">
        <div className="profile-section">
          <div className="profile-section-header">
            <h2>Personal Information</h2>
            {canEdit && !isEditing && (
              <button
                type="button"
                className="profile-edit-button"
                onClick={() => setIsEditing(true)}
              >
                Edit
              </button>
            )}
          </div>
          <div className="info-grid">
            <div className="info-item">
              <label>First Name</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                />
              ) : (
                <span>{employee.firstName}</span>
              )}
            </div>
            <div className="info-item">
              <label>Last Name</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                />
              ) : (
                <span>{employee.lastName}</span>
              )}
            </div>
            <div className="info-item">
              <label>Email</label>
              {isEditing ? (
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                />
              ) : (
                <span>{employee.email}</span>
              )}
            </div>
            <div className="info-item">
              <label>Phone</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                />
              ) : (
                <span>{employee.phone || '-'}</span>
              )}
            </div>
            <div className="info-item">
              <label>Telegram</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.telegram}
                  onChange={(e) => handleInputChange('telegram', e.target.value)}
                />
              ) : (
                <span>{employee.telegram || '-'}</span>
              )}
            </div>
            <div className="info-item">
              <label>Date of Birth</label>
              {isEditing ? (
                <input
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => handleInputChange('birthDate', e.target.value)}
                />
              ) : (
                <span>
                  {employee.birthDate ? format(new Date(employee.birthDate), 'MMM dd, yyyy') : '-'}
                </span>
              )}
            </div>
            <div className="info-item">
              <label>Hire Date</label>
              {isEditing && user?.isAdmin ? (
                <input
                  type="date"
                  value={formData.hireDate}
                  onChange={(e) => handleInputChange('hireDate', e.target.value)}
                />
              ) : (
                <span>
                  {employee.hireDate ? format(new Date(employee.hireDate), 'MMM dd, yyyy') : '-'}
                </span>
              )}
            </div>
            <div className="info-item">
              <label>Position</label>
              <span>{getPositionName()}</span>
            </div>
            <div className="info-item">
              <label>Gender</label>
              {isEditing ? (
                <select
                  value={formData.gender}
                  onChange={(e) => handleInputChange('gender', e.target.value)}
                >
                  <option value="">Not set</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              ) : (
                <span>{employee.gender || '-'}</span>
              )}
            </div>
            <div className="info-item">
              <label>City</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                />
              ) : (
                <span>{employee.city || '-'}</span>
              )}
            </div>
            <div className="info-item">
              <label>Country</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => handleInputChange('country', e.target.value)}
                />
              ) : (
                <span>{employee.country || '-'}</span>
              )}
            </div>
          </div>
          {isEditing && (
            <div className="profile-actions">
              <button
                type="button"
                className="profile-cancel-button"
                onClick={() => setIsEditing(false)}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="profile-save-button"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>

        <div className="profile-section">
          <div className="profile-section-header">
            <h2>Technologies</h2>
          </div>
          {allTechnologies.length === 0 ? (
            <p className="no-projects">No technologies available</p>
          ) : (
            <>
              <div className="technology-actions">
                <button
                  type="button"
                  className="profile-save-button"
                  onClick={() => setIsTechnologiesModalOpen(true)}
                  disabled={!canEdit}
                >
                  Add technologies
                </button>
              </div>
              {selectedTechnologies.length === 0 ? (
                <p className="no-projects">No technologies selected</p>
              ) : (
                <div className="technologies-list">
                  {selectedTechnologies.map((tech) => (
                    <label key={tech.id} className="technology-option">
                      <input
                        type="checkbox"
                        checked={selectedTechnologyIds.includes(tech.id)}
                        onChange={() => toggleTechnology(tech.id)}
                        disabled={!canEdit}
                      />
                      <span>{tech.name}</span>
                    </label>
                  ))}
                </div>
              )}
              {isTechnologiesModalOpen && (
                <div className="technology-modal-backdrop">
                  <div className="technology-modal">
                    <div className="technology-modal-header">
                      <h3>Technologies</h3>
                      <button
                        type="button"
                        className="technology-modal-close"
                        onClick={() => {
                          setIsTechnologiesModalOpen(false);
                          setTechnologySearch('');
                        }}
                      >
                        ×
                      </button>
                    </div>
                    <div className="technology-modal-search">
                      <input
                        type="text"
                        value={technologySearch}
                        onChange={(e) => setTechnologySearch(e.target.value)}
                        placeholder="Search technologies..."
                        autoFocus
                      />
                    </div>
                    <div className="technology-modal-list">
                      {filteredTechnologies.length === 0 ? (
                        <p className="no-projects">No technologies found</p>
                      ) : (
                        filteredTechnologies.map((tech) => {
                          const isSelected = selectedTechnologyIds.includes(tech.id);
                          return (
                            <button
                              type="button"
                              key={tech.id}
                              className={`technology-modal-item${isSelected ? ' selected' : ''}`}
                              onClick={() => handleTechnologyAdd(tech.id)}
                              disabled={isSelected || !canEdit}
                            >
                              <span>{tech.name}</span>
                              {isSelected && <span className="technology-modal-tag">Added</span>}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {isSelf && (
          <div className="profile-section">
            <div className="profile-section-header">
              <h2>Security</h2>
            </div>
            <div className="info-grid">
              <div className="info-item">
                <label>Current Password</label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) =>
                    setPasswordData((prev) => ({ ...prev, currentPassword: e.target.value }))
                  }
                  autoComplete="current-password"
                />
              </div>
              <div className="info-item">
                <label>New Password</label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) =>
                    setPasswordData((prev) => ({ ...prev, newPassword: e.target.value }))
                  }
                  autoComplete="new-password"
                />
              </div>
              <div className="info-item">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) =>
                    setPasswordData((prev) => ({ ...prev, confirmPassword: e.target.value }))
                  }
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div className="profile-actions">
              <button
                type="button"
                className="profile-save-button"
                onClick={handlePasswordSave}
                disabled={isPasswordSaving}
              >
                {isPasswordSaving ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </div>
        )}

        <div className="profile-section">
          <div className="profile-section-header">
            <h2>Projects</h2>
          </div>
          {employee.projects.length === 0 ? (
            <p className="no-projects">No projects assigned</p>
          ) : (
            <div className="projects-list">
              {employee.projects.map((project) => (
                <div key={project.id} className="project-tag">
                  {project.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
