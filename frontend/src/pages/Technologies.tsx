import { useState, useEffect } from 'react';
import axios from 'axios';
import './Technologies.css';

interface Technology {
  id: string;
  name: string;
}

export default function Technologies() {
  const [technologies, setTechnologies] = useState<Technology[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTech, setEditingTech] = useState<Technology | null>(null);
  const [techName, setTechName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchTechnologies();
  }, []);

  const fetchTechnologies = async () => {
    try {
      const response = await axios.get('/api/technologies');
      setTechnologies(response.data);
    } catch (error) {
      console.error('Error fetching technologies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingTech(null);
    setTechName('');
    setShowModal(true);
  };

  const handleEdit = (tech: Technology) => {
    setEditingTech(tech);
    setTechName(tech.name);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (editingTech) {
        await axios.put(`/api/technologies/${editingTech.id}`, { name: techName });
      } else {
        await axios.post('/api/technologies', { name: techName });
      }
      setShowModal(false);
      fetchTechnologies();
    } catch (error: any) {
      console.error('Error saving technology:', error);
      alert(error.response?.data?.error || 'Failed to save technology');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this technology?')) {
      return;
    }

    try {
      await axios.delete(`/api/technologies/${id}`);
      fetchTechnologies();
    } catch (error: any) {
      console.error('Error deleting technology:', error);
      alert(error.response?.data?.error || 'Failed to delete technology');
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="technologies-page">
      <div className="page-header">
        <h1>Technologies</h1>
        <button className="btn-primary" onClick={handleCreate}>
          Create Technology
        </button>
      </div>

      <div className="search-section">
        <input
          type="text"
          placeholder="Search technologies..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="technologies-list">
        {(() => {
          const filteredTechnologies = technologies.filter((tech) =>
            tech.name.toLowerCase().includes(searchQuery.toLowerCase())
          );

          if (filteredTechnologies.length === 0) {
            return <p className="no-data">No technologies found</p>;
          }

          return filteredTechnologies.map((tech) => (
            <div key={tech.id} className="technology-item">
              <span className="tech-name">{tech.name}</span>
              <div className="tech-actions">
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => handleEdit(tech)}
                >
                  Edit
                </button>
                <button
                  className="btn-danger btn-sm"
                  onClick={() => handleDelete(tech.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ));
        })()}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingTech ? 'Edit Technology' : 'Create Technology'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">Technology Name *</label>
                <input
                  type="text"
                  id="name"
                  value={techName}
                  onChange={(e) => setTechName(e.target.value)}
                  required
                />
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
                  {isSaving ? 'Saving...' : editingTech ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

