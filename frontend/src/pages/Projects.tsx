import { useState, useEffect } from 'react';
import axios from 'axios';
import './Projects.css';

interface Project {
  id: string;
  name: string;
  users: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  }>;
  technologies: Array<{
    id: string;
    name: string;
  }>;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Technology {
  id: string;
  name: string;
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [technologies, setTechnologies] = useState<Technology[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    userIds: [] as string[],
    technologyIds: [] as string[],
  });
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [techSearchQuery, setTechSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchProjects();
    fetchUsers();
    fetchTechnologies();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await axios.get('/api/projects');
      setProjects(response.data);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
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

  const fetchTechnologies = async () => {
    try {
      const response = await axios.get('/api/technologies');
      setTechnologies(response.data);
    } catch (error) {
      console.error('Error fetching technologies:', error);
    }
  };

  const handleCreate = () => {
    setEditingProject(null);
    setFormData({
      name: '',
      userIds: [],
      technologyIds: [],
    });
    setUserSearchQuery('');
    setTechSearchQuery('');
    setShowModal(true);
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setFormData({
      name: project.name,
      userIds: project.users.map((u) => u.id),
      technologyIds: project.technologies.map((t) => t.id),
    });
    setUserSearchQuery('');
    setTechSearchQuery('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (editingProject) {
        await axios.put(`/api/projects/${editingProject.id}`, formData);
      } else {
        await axios.post('/api/projects', formData);
      }
      setShowModal(false);
      fetchProjects();
    } catch (error: any) {
      console.error('Error saving project:', error);
      alert(error.response?.data?.error || 'Failed to save project');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) {
      return;
    }

    try {
      await axios.delete(`/api/projects/${id}`);
      fetchProjects();
    } catch (error: any) {
      console.error('Error deleting project:', error);
      alert(error.response?.data?.error || 'Failed to delete project');
    }
  };

  const toggleUser = (userId: string) => {
    setFormData((prev) => ({
      ...prev,
      userIds: prev.userIds.includes(userId)
        ? prev.userIds.filter((id) => id !== userId)
        : [...prev.userIds, userId],
    }));
  };

  const toggleTechnology = (techId: string) => {
    setFormData((prev) => ({
      ...prev,
      technologyIds: prev.technologyIds.includes(techId)
        ? prev.technologyIds.filter((id) => id !== techId)
        : [...prev.technologyIds, techId],
    }));
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="projects-page">
      <div className="page-header">
        <h1>Projects</h1>
        <button className="btn-primary" onClick={handleCreate}>
          Create Project
        </button>
      </div>

      <div className="projects-list">
        {projects.length === 0 ? (
          <p className="no-data">No projects found</p>
        ) : (
          projects.map((project) => (
            <div key={project.id} className="project-card">
              <div className="project-header">
                <h2>{project.name}</h2>
                <div className="project-actions">
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => handleEdit(project)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn-danger btn-sm"
                    onClick={() => handleDelete(project.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="project-content">
                <div className="project-section">
                  <h3>People ({project.users.length})</h3>
                  {project.users.length === 0 ? (
                    <p className="empty-section">No people assigned</p>
                  ) : (
                    <div className="project-users">
                      {project.users.map((user) => (
                        <span key={user.id} className="user-badge">
                          {user.firstName} {user.lastName}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="project-section">
                  <h3>Technologies ({project.technologies.length})</h3>
                  {project.technologies.length === 0 ? (
                    <p className="empty-section">No technologies assigned</p>
                  ) : (
                    <div className="project-technologies">
                      {project.technologies.map((tech) => (
                        <span key={tech.id} className="tech-badge">
                          {tech.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content project-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingProject ? 'Edit Project' : 'Create Project'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">Project Name *</label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>People</label>
                <input
                  type="text"
                  placeholder="Search people..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="search-input-inline"
                />
                <div className="multi-select-list">
                  {users
                    .filter((user) => {
                      const searchLower = userSearchQuery.toLowerCase();
                      return (
                        user.firstName.toLowerCase().includes(searchLower) ||
                        user.lastName.toLowerCase().includes(searchLower) ||
                        user.email.toLowerCase().includes(searchLower)
                      );
                    })
                    .map((user) => (
                      <label key={user.id} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={formData.userIds.includes(user.id)}
                          onChange={() => toggleUser(user.id)}
                        />
                        <span>
                          {user.firstName} {user.lastName} ({user.email})
                        </span>
                      </label>
                    ))}
                </div>
              </div>

              <div className="form-group">
                <label>Technologies</label>
                <input
                  type="text"
                  placeholder="Search technologies..."
                  value={techSearchQuery}
                  onChange={(e) => setTechSearchQuery(e.target.value)}
                  className="search-input-inline"
                />
                <div className="multi-select-list">
                  {technologies
                    .filter((tech) =>
                      tech.name.toLowerCase().includes(techSearchQuery.toLowerCase())
                    )
                    .map((tech) => (
                      <label key={tech.id} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={formData.technologyIds.includes(tech.id)}
                          onChange={() => toggleTechnology(tech.id)}
                        />
                        <span>{tech.name}</span>
                      </label>
                    ))}
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowModal(false)}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSaving}>
                  {isSaving ? 'Saving...' : editingProject ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

