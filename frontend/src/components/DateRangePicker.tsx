import { useState } from 'react';
import { DayPicker, DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { Controller, useFormContext, FieldValues, Path } from 'react-hook-form';
import 'react-day-picker/dist/style.css';
import './DateRangePicker.css';

export interface DateRangePickerProps<T extends FieldValues = FieldValues> {
  name: Path<T>;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  disablePast?: boolean;
  maxRangeDays?: number;
  error?: string;
  className?: string;
}

export function DateRangePicker<T extends FieldValues = FieldValues>({
  name,
  label,
  required = false,
  disabled = false,
  disablePast = false,
  maxRangeDays,
  error,
  className = '',
}: DateRangePickerProps<T>) {
  const { control } = useFormContext<T>();
  const [isOpen, setIsOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const disabledDays = disablePast
    ? [{ before: today }]
    : [];

  return (
    <Controller
      name={name}
      control={control}
      rules={{
        required: required ? `${label || 'Date range'} is required` : false,
        validate: (value) => {
          if (!value || !value.from || !value.to) {
            return required ? `${label || 'Date range'} is required` : true;
          }

          const from = new Date(value.from);
          const to = new Date(value.to);

          if (to < from) {
            return 'End date must be equal to or after start date';
          }

          if (maxRangeDays) {
            const diffTime = Math.abs(to.getTime() - from.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            if (diffDays > maxRangeDays) {
              return `Maximum range is ${maxRangeDays} days`;
            }
          }

          return true;
        },
      }}
      render={({ field, fieldState }) => {
        const currentRangeValue = field.value;
        // Convert string dates back to Date objects for the picker
        let currentRange: DateRange | undefined;
        if (currentRangeValue?.from && currentRangeValue?.to) {
          currentRange = {
            from: new Date(currentRangeValue.from),
            to: new Date(currentRangeValue.to),
          };
        } else if (currentRangeValue?.from) {
          currentRange = {
            from: new Date(currentRangeValue.from),
            to: undefined,
          };
        } else if (range) {
          currentRange = range;
        }

        const startDate = currentRange?.from;
        const endDate = currentRange?.to;
        const displayError = error || fieldState.error?.message;

        return (
          <div className={`date-range-picker ${className}`}>
            {label && (
              <label className="date-range-picker-label">
                {label}
                {required && <span className="required-asterisk"> *</span>}
              </label>
            )}
            <div className="date-range-picker-input-container">
              <div
                className={`date-range-picker-input ${displayError ? 'error' : ''} ${disabled ? 'disabled' : ''}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                role="button"
                tabIndex={disabled ? -1 : 0}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
                    e.preventDefault();
                    setIsOpen(!isOpen);
                  }
                }}
                aria-label={`Select date range${label ? ` for ${label}` : ''}`}
                aria-expanded={isOpen}
                aria-haspopup="dialog"
              >
                <span className="date-range-picker-placeholder">
                  {startDate && endDate
                    ? `${format(startDate, 'MMM dd, yyyy')} - ${format(endDate, 'MMM dd, yyyy')}`
                    : startDate
                    ? `${format(startDate, 'MMM dd, yyyy')} - ...`
                    : 'Select date range'}
                </span>
                <svg
                  className="date-range-picker-icon"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </div>

              {isOpen && !disabled && (
                <>
                  <div
                    className="date-range-picker-overlay"
                    onClick={() => setIsOpen(false)}
                    aria-hidden="true"
                  />
                  <div
                    className="date-range-picker-popup"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Select date range"
                  >
                    <DayPicker
                      mode="range"
                      selected={currentRange}
                      onSelect={(selectedRange) => {
                        setRange(selectedRange);
                        const newValue = selectedRange
                          ? {
                              from: selectedRange.from ? selectedRange.from.toISOString() : null,
                              to: selectedRange.to ? selectedRange.to.toISOString() : null,
                            }
                          : null;
                        field.onChange(newValue);
                      }}
                      onDayClick={(day) => {
                        // Allow clicking on the start date to change it
                        // In range mode, clicking a date when only start is selected should reset and start new range
                        if (currentRange?.from && !currentRange?.to) {
                          const clickedDate = day.getTime();
                          const startDate = currentRange.from.getTime();
                          
                          // If clicking on the same start date or any date before it, reset start
                          if (clickedDate <= startDate) {
                            // Clear and set new start
                            setRange({ from: day, to: undefined });
                            field.onChange({ from: day.toISOString(), to: null });
                          }
                        }
                      }}
                      disabled={disabledDays}
                      numberOfMonths={1}
                      className="date-range-picker-calendar"
                      modifiersClassNames={{
                        selected: 'selected',
                        range_start: 'range-start',
                        range_end: 'range-end',
                        range_middle: 'range-middle',
                      }}
                    />
                    <div className="date-range-picker-actions">
                      <button
                        type="button"
                        className="date-range-picker-clear"
                        onClick={() => {
                          setRange(undefined);
                          field.onChange(null);
                        }}
                        disabled={!startDate && !endDate}
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        className="date-range-picker-close"
                        onClick={() => setIsOpen(false)}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            <span className={`date-range-picker-error ${displayError ? '' : 'date-range-picker-error-empty'}`}>
              {displayError || '\u00A0'}
            </span>
          </div>
        );
      }}
    />
  );
}
