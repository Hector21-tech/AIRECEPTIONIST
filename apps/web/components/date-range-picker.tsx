'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';

export type DateRange = {
  from: Date;
  to: Date;
};

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');

  const presets = [
    {
      label: 'Idag',
      days: 0
    },
    {
      label: 'Senaste 7 dagarna',
      days: 7
    },
    {
      label: 'Senaste 30 dagarna',
      days: 30
    },
    {
      label: 'Senaste 90 dagarna',
      days: 90
    }
  ];

  const handlePresetClick = (days: number) => {
    if (days === 0) {
      // For "Idag", fill in custom date fields with today's date
      const today = new Date();
      const todayString = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD

      // Set the custom date inputs to today
      setCustomFromDate(todayString);
      setCustomToDate(todayString);

      // Use exact same logic as custom date selection
      const from = new Date(todayString);
      const to = new Date(todayString);

      onChange({ from, to });
    } else {
      const to = new Date();
      const from = new Date();
      from.setDate(to.getDate() - days);

      onChange({ from, to });
    }

    setIsOpen(false);
  };

  const handleCustomDateChange = () => {
    if (customFromDate && customToDate) {
      const from = new Date(customFromDate);
      const to = new Date(customToDate);

      if (from <= to) {
        onChange({ from, to });
        setIsOpen(false);
      }
    }
  };

  const formatDateRange = (range: DateRange) => {
    return `${range.from.toLocaleDateString('sv-SE')} - ${range.to.toLocaleDateString('sv-SE')}`;
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2"
      >
        <Calendar className="h-4 w-4" />
        {formatDateRange(value)}
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-white border rounded-lg shadow-lg z-50 p-4 min-w-64">
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Förval</h4>
              <div className="space-y-1">
                {presets.map((preset) => (
                  <button
                    key={preset.days}
                    onClick={() => handlePresetClick(preset.days)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t pt-3">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Anpassat datum</h4>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-500">Från</label>
                  <input
                    type="date"
                    value={customFromDate}
                    onChange={(e) => setCustomFromDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Till</label>
                  <input
                    type="date"
                    value={customToDate}
                    onChange={(e) => setCustomToDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <Button
                  onClick={handleCustomDateChange}
                  disabled={!customFromDate || !customToDate}
                  className="w-full text-sm"
                  size="sm"
                >
                  Tillämpa
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}