import { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import './Admin.css';

interface PendingRequest {
  id: string;
  type: 'sick_leave' | 'day_off' | 'vacation';
  from: string;
  to: string;
  status: 'pending';
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface Project {
  id: string;
  name: string;
}

interface Position {
  id: string;
  name: string;
}

export default function Admin() {
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [newPositionName, setNewPositionName] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [newUser, setNewUser] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    telegram: '',
    birthDate: '',
    positionId: '',
    gender: '',
    city: '',
    country: '',
    isAdmin: false,
    projectIds: [] as string[],
  });
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    fetchPendingRequests();
    fetchProjects();
    fetchUsers();
    fetchPositions();
  }, []);

  const fetchPendingRequests = async () => {
    try {
      const response = await axios.get('/api/admin/pending-requests');
      setPendingRequests(response.data);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
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

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/admin/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchPositions = async () => {
    try {
      const response = await axios.get('/api/positions');
      setPositions(response.data);
    } catch (error) {
      console.error('Error fetching positions:', error);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await axios.patch(`/api/admin/requests/${id}/approve`);
      fetchPendingRequests();
    } catch (error) {
      alert('Failed to approve request');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await axios.patch(`/api/admin/requests/${id}/reject`);
      fetchPendingRequests();
    } catch (error) {
      alert('Failed to reject request');
    }
  };

  const handleCreateUser = async () => {
    try {
      await axios.post('/api/admin/users', newUser);
      setShowCreateModal(false);
      setNewUser({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        phone: '',
        telegram: '',
        birthDate: '',
        positionId: '',
        gender: '',
        city: '',
        country: '',
        isAdmin: false,
        projectIds: [],
      });
      fetchUsers();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create user');
    }
  };

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setNewUser({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      password: '',
      phone: user.phone || '',
      telegram: user.telegram || '',
      birthDate: user.birthDate ? new Date(user.birthDate).toISOString().split('T')[0] : '',
      positionId: user.positionId || '',
      gender: user.gender || '',
      city: user.city || '',
      country: user.country || '',
      isAdmin: user.isAdmin || false,
      projectIds: user.projects?.map((p: any) => p.id) || [],
    });
    setShowCreateModal(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      await axios.put(`/api/admin/users/${editingUser.id}`, {
        ...newUser,
        password: newUser.password || undefined, // Don't send empty password
      });
      setShowCreateModal(false);
      setEditingUser(null);
      setNewUser({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        phone: '',
        telegram: '',
        birthDate: '',
        positionId: '',
        gender: '',
        city: '',
        country: '',
        isAdmin: false,
        projectIds: [],
      });
      fetchUsers();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update user');
    }
  };

  const handleCreatePosition = async () => {
    if (!newPositionName.trim()) {
      alert('Position name is required');
      return;
    }
    try {
      await axios.post('/api/positions', { name: newPositionName });
      setNewPositionName('');
      setShowPositionModal(false);
      fetchPositions();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create position');
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUserId) return;
    try {
      await axios.delete(`/api/admin/users/${selectedUserId}`);
      setShowDeleteModal(false);
      setSelectedUserId(null);
      fetchUsers();
    } catch (error) {
      alert('Failed to delete user');
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
      default:
        return type;
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Admin Panel - StellarTech</h1>
        <div className="admin-actions">
          <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
            Create User
          </button>
        </div>
      </div>

      <div className="admin-section">
        <h2>Pending Requests</h2>
        {pendingRequests.length === 0 ? (
          <p className="no-data">No pending requests</p>
        ) : (
          <div className="requests-list">
            {pendingRequests.map((request) => (
              <div key={request.id} className="request-item">
                <div className="request-info">
                  <div className="request-user">
                    {request.user.firstName} {request.user.lastName}
                  </div>
                  <div className="request-type">{getTypeLabel(request.type)}</div>
                  <div className="request-dates">
                    {format(new Date(request.from), 'MMM dd, yyyy')} -{' '}
                    {format(new Date(request.to), 'MMM dd, yyyy')}
                  </div>
                </div>
                <div className="request-actions">
                  <button
                    className="btn-approve"
                    onClick={() => handleApprove(request.id)}
                  >
                    Approve
                  </button>
                  <button
                    className="btn-reject"
                    onClick={() => handleReject(request.id)}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="admin-section">
        <h2>Users</h2>
        <div className="users-list">
          {users.map((user) => (
            <div key={user.id} className="user-item">
              <div className="user-info">
                <span className="user-name">
                  {user.firstName} {user.lastName}
                </span>
                <span className="user-email">{user.email}</span>
                {user.position && (
                  <span className="user-position">{user.position.name}</span>
                )}
              </div>
              <div className="user-actions">
                <button
                  className="btn-edit"
                  onClick={() => handleEditUser(user)}
                >
                  Edit
                </button>
                <button
                  className="btn-delete"
                  onClick={() => {
                    setSelectedUserId(user.id);
                    setShowDeleteModal(true);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => {
          setShowCreateModal(false);
          setEditingUser(null);
        }}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <h2>{editingUser ? 'Edit User' : 'Create User'}</h2>
            <div className="form-grid">
              <div className="form-group">
                <label>First Name *</label>
                <input
                  type="text"
                  value={newUser.firstName}
                  onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Last Name *</label>
                <input
                  type="text"
                  value={newUser.lastName}
                  onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  required
                />
              </div>
              {!editingUser && (
                <div className="form-group">
                  <label>Password *</label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    required
                  />
                </div>
              )}
              {editingUser && (
                <div className="form-group">
                  <label>Password (leave empty to keep current)</label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="Leave empty to keep current password"
                  />
                </div>
              )}
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="text"
                  value={newUser.phone}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Telegram</label>
                <input
                  type="text"
                  value={newUser.telegram}
                  onChange={(e) => setNewUser({ ...newUser, telegram: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Birth Date</label>
                <input
                  type="date"
                  value={newUser.birthDate}
                  onChange={(e) => setNewUser({ ...newUser, birthDate: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Position</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={newUser.positionId}
                    onChange={(e) => setNewUser({ ...newUser, positionId: e.target.value })}
                    style={{ flex: 1 }}
                  >
                    <option value="">Select Position</option>
                    {positions.map((position) => (
                      <option key={position.id} value={position.id}>
                        {position.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowPositionModal(true)}
                    style={{ padding: '8px 16px', fontSize: '14px' }}
                  >
                    + New
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Gender</label>
                <select
                  value={newUser.gender}
                  onChange={(e) => setNewUser({ ...newUser, gender: e.target.value })}
                >
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>City</label>
                <input
                  type="text"
                  value={newUser.city}
                  onChange={(e) => setNewUser({ ...newUser, city: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Country</label>
                <input
                  type="text"
                  value={newUser.country}
                  onChange={(e) => setNewUser({ ...newUser, country: e.target.value })}
                />
              </div>
              <div className="form-group admin-checkbox">
                <label className="checkbox-pill">
                  <input
                    type="checkbox"
                    checked={newUser.isAdmin}
                    onChange={(e) => setNewUser({ ...newUser, isAdmin: e.target.checked })}
                  />
                  <span>Is Admin</span>
                </label>
              </div>
              <div className="form-group full-width">
                <label>Projects</label>
                <div className="checkbox-list">
                  {projects.map((project) => (
                    <label key={project.id} className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={newUser.projectIds.includes(project.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewUser({
                              ...newUser,
                              projectIds: [...newUser.projectIds, project.id],
                            });
                          } else {
                            setNewUser({
                              ...newUser,
                              projectIds: newUser.projectIds.filter((id) => id !== project.id),
                            });
                          }
                        }}
                      />
                      {project.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => {
                setShowCreateModal(false);
                setEditingUser(null);
              }}>
                Cancel
              </button>
              <button className="btn-primary" onClick={editingUser ? handleUpdateUser : handleCreateUser}>
                {editingUser ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Delete User</h2>
            <p>Are you sure you want to delete this user? This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </button>
              <button className="btn-delete" onClick={handleDeleteUser}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showPositionModal && (
        <div className="modal-overlay" onClick={() => setShowPositionModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Position</h2>
            <div className="form-group">
              <label>Position Name *</label>
              <input
                type="text"
                value={newPositionName}
                onChange={(e) => setNewPositionName(e.target.value)}
                placeholder="e.g., Senior Developer"
                required
              />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowPositionModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleCreatePosition}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
