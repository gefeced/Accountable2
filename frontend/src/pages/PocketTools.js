import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Calendar as CalendarIcon, Flame, Plus, Trash2 } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';

export default function PocketTools() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPlayful = theme === 'playful';
  const [activeTool, setActiveTool] = useState(searchParams.get('tab') || 'calendar');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTool(tab);
  }, [searchParams]);

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Button
            onClick={() => navigate('/')}
            variant="ghost"
            className={isPlayful ? 'rounded-full' : 'rounded-md'}
            data-testid="back-button"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-3xl font-bold">🛠️ Pocket Tools</h1>
          <div className="w-10"></div>
        </div>

        <div className={`bg-card p-6 border ${isPlayful ? 'playful-border playful-shadow rounded-[1.5rem]' : 'clean-border clean-shadow rounded-lg'}`}>
          <Tabs value={activeTool} onValueChange={setActiveTool} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="calendar">
                <CalendarIcon className="w-4 h-4 mr-2" />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="calculator">
                📊 Calculator
              </TabsTrigger>
              <TabsTrigger value="calories">
                <Flame className="w-4 h-4 mr-2" />
                Calories
              </TabsTrigger>
            </TabsList>

            <TabsContent value="calendar">
              <CalendarTool isPlayful={isPlayful} />
            </TabsContent>

            <TabsContent value="calculator">
              <CalculatorTool isPlayful={isPlayful} />
            </TabsContent>

            <TabsContent value="calories">
              <CalorieTrackerTool isPlayful={isPlayful} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

// Calendar Tool
function CalendarTool({ isPlayful }) {
  const [date, setDate] = useState(new Date());
  const [events, setEvents] = useState(() => {
    const saved = localStorage.getItem('accountable-events');
    return saved ? JSON.parse(saved) : [];
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    time: '09:00',
    priority: 'medium',
    tag: 'personal',
    color: '#3b82f6'
  });

  const tagColors = {
    personal: '#3b82f6',
    work: '#ef4444',
    health: '#10b981',
    learning: '#8b5cf6',
    other: '#f59e0b'
  };

  const addEvent = () => {
    if (!newEvent.title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    if (!date) {
      toast.error('Please select a date');
      return;
    }

    const event = {
      id: Date.now(),
      date: date.toISOString().split('T')[0],
      title: newEvent.title,
      time: newEvent.time,
      priority: newEvent.priority,
      tag: newEvent.tag,
      color: tagColors[newEvent.tag]
    };

    const updated = [...events, event];
    setEvents(updated);
    localStorage.setItem('accountable-events', JSON.stringify(updated));
    setNewEvent({ title: '', time: '09:00', priority: 'medium', tag: 'personal', color: '#3b82f6' });
    setShowAddForm(false);
    toast.success('Event added!');
  };

  const deleteEvent = (id) => {
    const updated = events.filter(e => e.id !== id);
    setEvents(updated);
    localStorage.setItem('accountable-events', JSON.stringify(updated));
    toast.success('Event deleted');
  };

  const getEventsForDate = (checkDate) => {
    if (!checkDate) return [];
    const dateStr = checkDate.toISOString().split('T')[0];
    return events.filter(e => e.date === dateStr);
  };

  const selectedDateEvents = date ? getEventsForDate(date) : [];

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return 'text-muted-foreground';
    }
  };

  const getPriorityLabel = (priority) => {
    switch(priority) {
      case 'high': return '🔴 High';
      case 'medium': return '🟡 Medium';
      case 'low': return '🟢 Low';
      default: return priority;
    }
  };

  return (
    <div className="py-6 space-y-6">
      <div className="flex justify-center">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(newDate) => {
            if (newDate) {
              setDate(newDate);
            }
          }}
          className="rounded-md border"
          modifiers={{
            hasEvents: (day) => getEventsForDate(day).length > 0
          }}
          modifiersStyles={{
            hasEvents: {
              fontWeight: 'bold',
              backgroundColor: 'hsl(var(--primary) / 0.2)'
            }
          }}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold">
            Events for {date ? date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Selected Date'}
          </h3>
          <Button
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
            className={isPlayful ? 'rounded-full' : 'rounded-md'}
            data-testid="toggle-add-form"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Event
          </Button>
        </div>

        {showAddForm && (
          <div className={`mb-4 p-4 border ${isPlayful ? 'rounded-2xl' : 'rounded-lg'} space-y-3`}>
            <div>
              <Label htmlFor="event-title">Title *</Label>
              <Input
                id="event-title"
                value={newEvent.title}
                onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                placeholder="Event title..."
                data-testid="event-title-input"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="event-time">Time</Label>
                <Input
                  id="event-time"
                  type="time"
                  value={newEvent.time}
                  onChange={(e) => setNewEvent({...newEvent, time: e.target.value})}
                  data-testid="event-time-input"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="event-priority">Priority</Label>
                <Select
                  value={newEvent.priority}
                  onValueChange={(value) => setNewEvent({...newEvent, priority: value})}
                >
                  <SelectTrigger className="mt-1" data-testid="event-priority-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">🔴 High</SelectItem>
                    <SelectItem value="medium">🟡 Medium</SelectItem>
                    <SelectItem value="low">🟢 Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="event-tag">Tag/Category</Label>
              <Select
                value={newEvent.tag}
                onValueChange={(value) => setNewEvent({...newEvent, tag: value, color: tagColors[value]})}
              >
                <SelectTrigger className="mt-1" data-testid="event-tag-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">🔵 Personal</SelectItem>
                  <SelectItem value="work">🔴 Work</SelectItem>
                  <SelectItem value="health">🟢 Health</SelectItem>
                  <SelectItem value="learning">🟣 Learning</SelectItem>
                  <SelectItem value="other">🟠 Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={addEvent}
                className={`flex-1 ${isPlayful ? 'rounded-full' : 'rounded-md'}`}
                data-testid="add-event-submit"
              >
                Add Event
              </Button>
              <Button
                onClick={() => setShowAddForm(false)}
                variant="outline"
                className={isPlayful ? 'rounded-full' : 'rounded-md'}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {selectedDateEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No events for this day. Click "Add Event" to create one!
            </p>
          ) : (
            selectedDateEvents
              .sort((a, b) => a.time.localeCompare(b.time))
              .map(event => (
                <div
                  key={event.id}
                  className={`flex items-start justify-between p-4 border-l-4 ${isPlayful ? 'rounded-r-2xl' : 'rounded-r-lg'} bg-card`}
                  style={{ borderLeftColor: event.color }}
                  data-testid={`event-${event.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold">{event.title}</span>
                      <span className={`text-xs ${getPriorityColor(event.priority)}`}>
                        {getPriorityLabel(event.priority)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>🕐 {event.time}</span>
                      <span className="capitalize">📁 {event.tag}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteEvent(event.id)}
                    data-testid={`delete-event-${event.id}`}
                    className="ml-2"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}

// Calculator Tool
function CalculatorTool({ isPlayful }) {
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState(null);
  const [operation, setOperation] = useState(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const handleNumber = (num) => {
    if (waitingForOperand) {
      setDisplay(num);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? num : display + num);
    }
  };

  const handleOperator = (nextOperator) => {
    const inputValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(inputValue);
    } else if (operation) {
      const currentValue = previousValue || 0;
      const newValue = performCalculation(currentValue, inputValue, operation);
      
      setDisplay(String(newValue));
      setPreviousValue(newValue);
    }

    setWaitingForOperand(true);
    setOperation(nextOperator);
  };

  const performCalculation = (firstValue, secondValue, op) => {
    switch (op) {
      case '+':
        return firstValue + secondValue;
      case '-':
        return firstValue - secondValue;
      case '*':
        return firstValue * secondValue;
      case '/':
        return firstValue / secondValue;
      default:
        return secondValue;
    }
  };

  const calculate = () => {
    const inputValue = parseFloat(display);

    if (previousValue !== null && operation) {
      const newValue = performCalculation(previousValue, inputValue, operation);
      setDisplay(String(newValue));
      setPreviousValue(null);
      setOperation(null);
      setWaitingForOperand(true);
    }
  };

  const clear = () => {
    setDisplay('0');
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(false);
  };

  const handleDecimal = () => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
    } else if (display.indexOf('.') === -1) {
      setDisplay(display + '.');
    }
  };

  const buttonClass = `h-16 text-lg font-semibold border ${isPlayful ? 'rounded-2xl' : 'rounded-lg'} hover:bg-secondary transition-colors`;

  return (
    <div className="py-6">
      <div className="max-w-sm mx-auto">
        <div className={`mb-4 p-4 border ${isPlayful ? 'rounded-2xl' : 'rounded-lg'} bg-secondary`}>
          <p className="text-3xl font-bold text-right break-all" data-testid="calculator-display">{display}</p>
          {previousValue !== null && operation && (
            <p className="text-sm text-muted-foreground text-right mt-1">
              {previousValue} {operation}
            </p>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2">
          <button onClick={clear} className={`${buttonClass} col-span-2 text-destructive`} data-testid="calc-clear">C</button>
          <button onClick={() => handleOperator('/')} className={buttonClass} data-testid="calc-divide">÷</button>
          <button onClick={() => handleOperator('*')} className={buttonClass} data-testid="calc-multiply">×</button>

          <button onClick={() => handleNumber('7')} className={buttonClass} data-testid="calc-7">7</button>
          <button onClick={() => handleNumber('8')} className={buttonClass} data-testid="calc-8">8</button>
          <button onClick={() => handleNumber('9')} className={buttonClass} data-testid="calc-9">9</button>
          <button onClick={() => handleOperator('-')} className={buttonClass} data-testid="calc-minus">-</button>

          <button onClick={() => handleNumber('4')} className={buttonClass} data-testid="calc-4">4</button>
          <button onClick={() => handleNumber('5')} className={buttonClass} data-testid="calc-5">5</button>
          <button onClick={() => handleNumber('6')} className={buttonClass} data-testid="calc-6">6</button>
          <button onClick={() => handleOperator('+')} className={buttonClass} data-testid="calc-plus">+</button>

          <button onClick={() => handleNumber('1')} className={buttonClass} data-testid="calc-1">1</button>
          <button onClick={() => handleNumber('2')} className={buttonClass} data-testid="calc-2">2</button>
          <button onClick={() => handleNumber('3')} className={buttonClass} data-testid="calc-3">3</button>
          <button onClick={calculate} className={`${buttonClass} row-span-2 bg-primary text-primary-foreground`} data-testid="calc-equals">=</button>

          <button onClick={() => handleNumber('0')} className={`${buttonClass} col-span-2`} data-testid="calc-0">0</button>
          <button onClick={handleDecimal} className={buttonClass} data-testid="calc-dot">.</button>
        </div>
      </div>
    </div>
  );
}

function CalorieTrackerTool({ isPlayful }) {
  const [selectedDay, setSelectedDay] = useState(() => new Date().toISOString().split('T')[0]);
  const [entries, setEntries] = useState(() => {
    const saved = localStorage.getItem('accountable-calorie-entries');
    return saved ? JSON.parse(saved) : [];
  });
  const [form, setForm] = useState({
    meal: 'breakfast',
    food: '',
    calories: '',
  });

  const saveEntries = (nextEntries) => {
    setEntries(nextEntries);
    localStorage.setItem('accountable-calorie-entries', JSON.stringify(nextEntries));
  };

  const addEntry = () => {
    const calories = parseInt(form.calories, 10);
    if (!form.food.trim()) {
      toast.error('Add a food item first');
      return;
    }
    if (!calories || calories <= 0) {
      toast.error('Enter a valid calorie amount');
      return;
    }

    const nextEntries = [
      ...entries,
      {
        id: Date.now(),
        date: selectedDay,
        meal: form.meal,
        food: form.food.trim(),
        calories,
      }
    ];

    saveEntries(nextEntries);
    setForm({ meal: 'breakfast', food: '', calories: '' });
    toast.success('Meal added to calorie tracker');
  };

  const deleteEntry = (entryId) => {
    saveEntries(entries.filter((entry) => entry.id !== entryId));
  };

  const groupedByDay = entries.reduce((acc, entry) => {
    if (!acc[entry.date]) {
      acc[entry.date] = [];
    }
    acc[entry.date].push(entry);
    return acc;
  }, {});

  const currentDayEntries = (groupedByDay[selectedDay] || []).sort((a, b) => a.meal.localeCompare(b.meal));
  const currentDayTotal = currentDayEntries.reduce((sum, entry) => sum + entry.calories, 0);
  const trackedDays = Object.keys(groupedByDay);
  const sortedTrackedDays = [...trackedDays].sort((a, b) => b.localeCompare(a));
  const averageDailyCalories = trackedDays.length > 0
    ? Math.round(
        trackedDays.reduce((sum, day) => (
          sum + groupedByDay[day].reduce((dayTotal, entry) => dayTotal + entry.calories, 0)
        ), 0) / trackedDays.length
      )
    : 0;

  const averageMealCalories = entries.length > 0
    ? Math.round(entries.reduce((sum, entry) => sum + entry.calories, 0) / entries.length)
    : 0;

  const highestDay = trackedDays.reduce((best, day) => {
    const total = groupedByDay[day].reduce((sum, entry) => sum + entry.calories, 0);
    if (!best || total > best.total) {
      return { day, total };
    }
    return best;
  }, null);

  return (
    <div className="py-6 space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={`border p-4 ${isPlayful ? 'rounded-2xl' : 'rounded-lg'}`}>
          <p className="text-sm text-muted-foreground">Average Daily Calories</p>
          <p className="mt-2 text-2xl font-bold">{averageDailyCalories}</p>
        </div>
        <div className={`border p-4 ${isPlayful ? 'rounded-2xl' : 'rounded-lg'}`}>
          <p className="text-sm text-muted-foreground">Average Meal Entry</p>
          <p className="mt-2 text-2xl font-bold">{averageMealCalories}</p>
        </div>
        <div className={`border p-4 ${isPlayful ? 'rounded-2xl' : 'rounded-lg'}`}>
          <p className="text-sm text-muted-foreground">Highest Tracked Day</p>
          <p className="mt-2 text-lg font-bold">{highestDay ? highestDay.total : 0}</p>
          <p className="text-xs text-muted-foreground">
            {highestDay ? new Date(`${highestDay.day}T00:00:00`).toLocaleDateString() : 'No data yet'}
          </p>
        </div>
      </div>

      <div className={`border p-4 ${isPlayful ? 'rounded-2xl' : 'rounded-lg'} space-y-4`}>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="calorie-date">Day</Label>
            <Input
              id="calorie-date"
              type="date"
              value={selectedDay}
              onChange={(event) => setSelectedDay(event.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Meal</Label>
            <Select value={form.meal} onValueChange={(value) => setForm((current) => ({ ...current, meal: value }))}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="breakfast">Breakfast</SelectItem>
                <SelectItem value="lunch">Lunch</SelectItem>
                <SelectItem value="dinner">Dinner</SelectItem>
                <SelectItem value="snack">Snack</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="calorie-value">Calories</Label>
            <Input
              id="calorie-value"
              type="number"
              min="1"
              value={form.calories}
              onChange={(event) => setForm((current) => ({ ...current, calories: event.target.value }))}
              className="mt-1"
              placeholder="350"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="food-name">Food Item</Label>
          <Input
            id="food-name"
            value={form.food}
            onChange={(event) => setForm((current) => ({ ...current, food: event.target.value }))}
            className="mt-1"
            placeholder="Chicken wrap"
          />
        </div>

        <Button onClick={addEntry} className={isPlayful ? 'rounded-full' : 'rounded-md'}>
          <Plus className="mr-2 h-4 w-4" />
          Add Meal
        </Button>
      </div>

      <div className={`border p-4 ${isPlayful ? 'rounded-2xl' : 'rounded-lg'}`}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">Daily Intake</h3>
            <p className="text-sm text-muted-foreground">
              {new Date(`${selectedDay}T00:00:00`).toLocaleDateString()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{currentDayTotal} cal</p>
          </div>
        </div>

        <div className="space-y-3">
          {currentDayEntries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No meals tracked for this day yet.
            </p>
          ) : currentDayEntries.map((entry) => (
            <div
              key={entry.id}
              className={`flex items-start justify-between border p-4 ${isPlayful ? 'rounded-2xl' : 'rounded-lg'}`}
            >
              <div>
                <p className="font-semibold">{entry.food}</p>
                <p className="text-sm text-muted-foreground capitalize">{entry.meal}</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="font-bold">{entry.calories} cal</p>
                <Button variant="ghost" size="icon" onClick={() => deleteEntry(entry.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`border p-4 ${isPlayful ? 'rounded-2xl' : 'rounded-lg'}`}>
        <div className="mb-4">
          <h3 className="text-lg font-bold">Past Records</h3>
          <p className="text-sm text-muted-foreground">All tracked calorie days, newest first.</p>
        </div>

        <div className="max-h-[28rem] space-y-4 overflow-y-auto pr-2">
          {sortedTrackedDays.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No calorie history yet.
            </p>
          ) : sortedTrackedDays.map((day) => {
            const dayEntries = [...groupedByDay[day]].sort((a, b) => a.meal.localeCompare(b.meal));
            const dayTotal = dayEntries.reduce((sum, entry) => sum + entry.calories, 0);

            return (
              <div
                key={day}
                className={`border p-4 ${isPlayful ? 'rounded-2xl' : 'rounded-lg'}`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{new Date(`${day}T00:00:00`).toLocaleDateString()}</p>
                    <p className="text-sm text-muted-foreground">{dayEntries.length} entries</p>
                  </div>
                  <p className="text-lg font-bold">{dayTotal} cal</p>
                </div>

                <div className="space-y-2">
                  {dayEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start justify-between rounded-xl bg-secondary/40 px-3 py-2"
                    >
                      <div>
                        <p className="font-medium">{entry.food}</p>
                        <p className="text-sm text-muted-foreground capitalize">{entry.meal}</p>
                      </div>
                      <p className="font-semibold">{entry.calories} cal</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
