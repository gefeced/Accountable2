import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function sameDay(a, b) {
  return a && b
    && a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function Calendar({
  className,
  selected,
  onSelect,
  modifiers = {},
  modifiersStyles = {},
}) {
  const initialMonth = selected ? startOfMonth(selected) : startOfMonth(new Date());
  const [visibleMonth, setVisibleMonth] = React.useState(initialMonth);

  React.useEffect(() => {
    if (selected) {
      setVisibleMonth(startOfMonth(selected));
    }
  }, [selected]);

  const monthStart = startOfMonth(visibleMonth);
  const monthEnd = endOfMonth(visibleMonth);
  const startWeekday = monthStart.getDay();
  const totalDays = monthEnd.getDate();
  const cells = [];

  for (let i = 0; i < startWeekday; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    cells.push(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  const weekdayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div className={cn('w-full max-w-sm rounded-xl border p-3', className)}>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}
          className={cn(buttonVariants({ variant: 'outline' }), 'h-8 w-8 p-0')}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-sm font-medium">
          {visibleMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
        <button
          type="button"
          onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}
          className={cn(buttonVariants({ variant: 'outline' }), 'h-8 w-8 p-0')}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {weekdayLabels.map((label) => (
          <div key={label} className="py-1">{label}</div>
        ))}
      </div>

      <div className="mt-1 grid gap-1">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 gap-1">
            {week.map((date, dayIndex) => {
              if (!date) {
                return <div key={`${weekIndex}-${dayIndex}`} className="h-9" />;
              }

              const isSelected = sameDay(date, selected);
              const inlineStyle = {};
              Object.entries(modifiers).forEach(([name, matcher]) => {
                if (typeof matcher === 'function' && matcher(date)) {
                  Object.assign(inlineStyle, modifiersStyles[name] || {});
                }
              });

              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => onSelect?.(date)}
                  style={inlineStyle}
                  className={cn(
                    buttonVariants({ variant: 'ghost' }),
                    'h-9 w-full p-0 text-sm font-normal',
                    isSelected && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
                  )}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

Calendar.displayName = 'Calendar';

export { Calendar };
