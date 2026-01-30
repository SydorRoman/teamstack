import { useForm, FormProvider } from 'react-hook-form';
import { DateRangePicker } from '../components/DateRangePicker';
import './AbsenceForm.css';

export interface AbsenceFormData {
  type: 'sick_leave' | 'day_off' | 'vacation';
  dateRange: {
    from: string | null;
    to: string | null;
  };
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
  const hasValidDateRange = dateRange?.from && dateRange?.to;

  const handleFormSubmit = (data: AbsenceFormData) => {
    if (data.dateRange?.from && data.dateRange?.to) {
      onSubmit({
        ...data,
        dateRange: {
          from: data.dateRange.from,
          to: data.dateRange.to,
        },
      });
    }
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
