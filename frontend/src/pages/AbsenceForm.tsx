import { useEffect, useRef, useState, type ChangeEvent } from 'react';
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
}

interface AbsenceFormProps {
  onSubmit: (data: AbsenceFormData) => void;
  onCancel: () => void;
  initialValues?: Partial<AbsenceFormData>;
  loading?: boolean;
}

export function AbsenceForm({
  onSubmit,
  onCancel,
  initialValues,
  loading = false,
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
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </FormProvider>
  );
}
