import { useForm, FormProvider } from 'react-hook-form';
import { format } from 'date-fns';
import './WorkLogForm.css';

export interface WorkLogFormData {
  date: string;
  start: string;
  end: string;
  projectId: string;
  note?: string;
}

interface WorkLogFormProps {
  onSubmit: (data: WorkLogFormData) => Promise<void>;
  onCancel: () => void;
  initialValues?: Partial<WorkLogFormData>;
  loading?: boolean;
  projects?: Array<{ id: string; name: string }>;
}

export function WorkLogForm({
  onSubmit,
  onCancel,
  initialValues,
  loading = false,
  projects = [],
}: WorkLogFormProps) {
  const methods = useForm<{
    date: string;
    hours: number;
    projectId: string;
    note: string;
  }>({
    defaultValues: {
      date: initialValues?.date
        ? format(new Date(initialValues.date), 'yyyy-MM-dd')
        : format(new Date(), 'yyyy-MM-dd'),
      hours: initialValues?.start && initialValues?.end
        ? Math.round((new Date(initialValues.end).getTime() - new Date(initialValues.start).getTime()) / (1000 * 60 * 60))
        : 8,
      projectId: initialValues?.projectId || '',
      note: initialValues?.note || '',
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = methods;

  const handleFormSubmit = async (data: any) => {
    // Create date from the date input (local date, no time)
    const dateStr = data.date; // format: YYYY-MM-DD
    const hours = Number(data.hours);
    
    // Default start time is 9:00, end is calculated based on hours
    const startHour = 9;
    const endHour = startHour + hours;

    // Create date objects at midnight local time, then set hours
    const date = new Date(dateStr + 'T00:00:00');
    const start = new Date(dateStr + `T${String(startHour).padStart(2, '0')}:00:00`);
    const end = new Date(dateStr + `T${String(endHour).padStart(2, '0')}:00:00`);

    const formData: WorkLogFormData = {
      date: date.toISOString(),
      start: start.toISOString(),
      end: end.toISOString(),
      projectId: data.projectId,
      note: data.note || undefined,
    };

    await onSubmit(formData);
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(handleFormSubmit)} className="work-log-form">
        <div className="form-group">
          <label htmlFor="date">Date *</label>
          <input
            type="date"
            id="date"
            {...register('date', {
              required: 'Date is required',
            })}
            className={errors.date ? 'error' : ''}
          />
          {errors.date && (
            <span className="form-error">{errors.date.message as string}</span>
          )}
          <span className={`form-error form-error-empty ${errors.date ? '' : 'form-error-empty'}`}>
            {errors.date?.message || '\u00A0'}
          </span>
        </div>

        <div className="form-group">
          <label htmlFor="hours">Hours Worked *</label>
          <select
            id="hours"
            {...register('hours', {
              required: 'Hours worked is required',
              valueAsNumber: true,
              min: { value: 1, message: 'At least 1 hour is required' },
              max: { value: 24, message: 'Maximum 24 hours per day' },
            })}
            className={errors.hours ? 'error' : ''}
          >
            {Array.from({ length: 24 }, (_, i) => i + 1).map((hour) => (
              <option key={hour} value={hour}>
                {hour} {hour === 1 ? 'hour' : 'hours'}
              </option>
            ))}
          </select>
          {errors.hours && (
            <span className="form-error">{errors.hours.message as string}</span>
          )}
          <span className={`form-error form-error-empty ${errors.hours ? '' : 'form-error-empty'}`}>
            {errors.hours?.message || '\u00A0'}
          </span>
        </div>

        <div className="form-group">
          <label htmlFor="projectId">Project *</label>
          <select
            id="projectId"
            {...register('projectId', {
              required: 'Project is required',
            })}
            className={errors.projectId ? 'error' : ''}
          >
            <option value="">Select a project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          {errors.projectId && (
            <span className="form-error">{errors.projectId.message as string}</span>
          )}
          <span className={`form-error form-error-empty ${errors.projectId ? '' : 'form-error-empty'}`}>
            {errors.projectId?.message || '\u00A0'}
          </span>
        </div>

        <div className="form-group">
          <label htmlFor="note">Note</label>
          <textarea
            id="note"
            rows={3}
            {...register('note')}
            className={errors.note ? 'error' : ''}
            placeholder="Optional notes about your work..."
          />
          {errors.note && (
            <span className="form-error">{errors.note.message as string}</span>
          )}
          <span className={`form-error form-error-empty ${errors.note ? '' : 'form-error-empty'}`}>
            {errors.note?.message || '\u00A0'}
          </span>
        </div>

        <div className="form-actions">
          <button type="button" onClick={onCancel} className="btn-secondary" disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </FormProvider>
  );
}
