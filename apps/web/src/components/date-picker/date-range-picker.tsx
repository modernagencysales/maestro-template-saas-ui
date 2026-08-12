import * as React from "react";

// import { Button, useControllableState } from '@chakra-ui/react'
// import {
//   CalendarDate,
//   DateFormatter,
//   DatePickerDialog,
//   DatePickerTrigger,
//   DateRangePicker as DateRangePickerBase,
//   DateRangePickerProps as DateRangePickerBaseProps,
//   DateRangePickerCalendar,
//   getLocalTimeZone,
//   today,
// } from '@saas-ui/date-picker'
// import { LuCalendar } from 'react-icons/lu'
// import { useIntl } from 'react-intl'

export type DateRange = { start: Date; end: Date };
export type DateRangePresets = "1d" | "3d" | "7d" | "30d";

const presetDays: Record<DateRangePresets, number> = {
  "1d": 1,
  "3d": 3,
  "7d": 7,
  "30d": 30,
};

export const getRangeValue = (preset: DateRangePresets) => {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - presetDays[preset]);

  return { start, end };
};

export const getRangeDiff = (range: DateRange) => {
  return range.end.getTime() - range.start.getTime();
};

export const formatRange = ({ start, end }: DateRange) => {
  return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
};

export interface DatePickerProps {
  value?: DateRange;
  onChange?: (value: DateRange) => void;
}

export const DateRangePicker: React.FC<DatePickerProps> = () => {
  return null;
};
