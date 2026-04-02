import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);
const addMonths = (date, amount) => new Date(date.getFullYear(), date.getMonth() + amount, 1);
const isSameDay = (a, b) => (
  a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth()
  && a.getDate() === b.getDate()
);

const buildMonthGrid = (monthDate) => {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());

  const gridEnd = new Date(monthEnd);
  gridEnd.setDate(monthEnd.getDate() + (6 - monthEnd.getDay()));

  const days = [];
  for (let cursor = new Date(gridStart); cursor <= gridEnd; cursor.setDate(cursor.getDate() + 1)) {
    days.push(new Date(cursor));
  }
  return days;
};

export function Calendar({
  selected,
  onSelect,
  className,
  modifiers = {},
  modifiersStyles = {},
}) {
  const [currentMonth, setCurrentMonth] = useState(selected || new Date());

  const days = useMemo(() => buildMonthGrid(currentMonth), [currentMonth]);

  const getModifierStyle = (day) => {
    return Object.entries(modifiers).reduce((acc, [modifierName, matcher]) => {
      if (typeof matcher === 'function' && matcher(day)) {
        return { ...acc, ...(modifiersStyles[modifierName] || {}) };
      }
      return acc;
    }, {});
  };

  return (
    <div className={cn('w-full max-w-sm bg-card p-4 shadow-sm', className)}>
      <div className="mb-4 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth((prev) => addMonths(prev, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-lg font-semibold">
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-2">{label}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
          const isSelected = selected ? isSameDay(day, selected) : false;
          const customStyle = getModifierStyle(day);

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelect?.(day)}
              className={cn(
                'flex h-10 items-center justify-center rounded-xl text-sm transition-colors',
                isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/50',
                isSelected ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-secondary'
              )}
              style={customStyle}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
