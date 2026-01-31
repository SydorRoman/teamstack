import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import axios from 'axios';
import { useForm, FormProvider } from 'react-hook-form';
import { DateRangePicker } from '../components/DateRangePicker';
import './AbsenceForm.css';

export interface AbsenceFormData {
  type: 'sick_leave' | 'day_off' | 'vacation';
  dateRange: {
    from: string | null;
    to: string | null;
  };
  files?: File[];
  existingFiles?: { id: string; originalName: string }[];
}

interface AbsenceFormProps {
  onSubmit: (data: AbsenceFormData) => void;
  onCancel: () => void;
  initialValues?: Partial<AbsenceFormData>;
  loading?: boolean;
  disableType?: boolean;
  disableDateRange?: boolean;
  canDeleteExistingFiles?: boolean;
  submitLabel?: string;
  submittingLabel?: string;
}

export function AbsenceForm({
  onSubmit,
  onCancel,
  initialValues,
  loading = false,
  disableType = false,
  disableDateRange = false,
  canDeleteExistingFiles = false,
  submitLabel = 'Create',
  submittingLabel = 'Creating...',
}: AbsenceFormProps) {
  const methods = useForm<AbsenceFormData>({
    defaultValues: {
      type: initialValues?.type || 'vacation',
      dateRange: initialValues?.dateRange || { from: null, to: null },
    },
    mode: 'onChange',
  });

  const {
    handleSubmit,
    formState: { errors },
    watch,
  } = methods;

  // Past dates are allowed for all types
  const disablePast = false;

  const dateRange = watch('dateRange');
  const selectedType = watch('type');
  const hasValidDateRange = dateRange?.from && dateRange?.to;
  const [existingFiles, setExistingFiles] = useState(
    initialValues?.existingFiles ?? []
  );

  useEffect(() => {
    setExistingFiles(initialValues?.existingFiles ?? []);
  }, [initialValues?.existingFiles]);

  const handleDownloadFile = async (fileId: string, fileName: string) => {
    try {
      const response = await axios.get(`/api/absences/files/${fileId}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Failed to download file');
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      await axios.delete(`/api/absences/files/${fileId}`);
      setExistingFiles((prev) => prev.filter((file) => file.id !== fileId));
    } catch (error) {
      alert('Failed to delete file');
    }
  };
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (selectedType !== 'sick_leave') {
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [selectedType]);

  const handleFormSubmit = (data: AbsenceFormData) => {
    if (data.dateRange?.from && data.dateRange?.to) {
      onSubmit({
        ...data,
        dateRange: {
          from: data.dateRange.from,
          to: data.dateRange.to,
        },
        files: selectedFiles,
      });
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(event.target.files ?? []);
    if (incoming.length > 0) {
      setSelectedFiles((prev) => [...prev, ...incoming]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(handleFormSubmit)} className="absence-form">
        <div className="form-group">
          <label htmlFor="type">Type</label>
          <select
            id="type"
            {...methods.register('type', { required: 'Type is required' })}
            disabled={disableType}
          >
            <option value="vacation">Vacation</option>
            <option value="sick_leave">Sick Leave</option>
            <option value="day_off">Day Off</option>
          </select>
          <span className={`form-error ${errors.type ? '' : 'form-error-empty'}`}>
            {errors.type?.message || '\u00A0'}
          </span>
        </div>

        <DateRangePicker<AbsenceFormData>
          name="dateRange"
          label="Date Range"
          required
          disablePast={disablePast}
          maxRangeDays={30}
          disabled={disableDateRange}
        />

        {selectedType === 'sick_leave' && (
          <div className="form-group">
            <label htmlFor="files">Upload certificate</label>
            <input
              id="files"
              type="file"
              multiple
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            {existingFiles.length > 0 && (
              <div className="file-list">
                {existingFiles.map((file) => (
                  <div key={file.id} className="file-list-item">
                    <button
                      type="button"
                      className="file-download-button"
                      onClick={() => handleDownloadFile(file.id, file.originalName)}
                    >
                      Download
                    </button>
                    {canDeleteExistingFiles && (
                      <button
                        type="button"
                        className="file-delete-button"
                        onClick={() => handleDeleteFile(file.id)}
                      >
                        Delete
                      </button>
                    )}
                    <span className="file-name">{file.originalName}</span>
                  </div>
                ))}
              </div>
            )}
            {selectedFiles.length > 0 && (
              <div className="file-list">
                {selectedFiles.map((file, index) => (
                  <div key={`${file.name}-${file.lastModified}-${index}`} className="file-list-item">
                    <button
                      type="button"
                      className="file-remove-button"
                      onClick={() => handleRemoveFile(index)}
                      aria-label={`Remove ${file.name}`}
                    >
                      X
                    </button>
                    <span className="file-name">{file.name}</span>
                  </div>
                ))}
              </div>
            )}
            <span className="form-hint">
              Optional for 1 day. Required for 2+ consecutive days.
            </span>
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !hasValidDateRange}
          >
            {loading ? submittingLabel : submitLabel}
          </button>
        </div>
      </form>
    </FormProvider>
  );
}
