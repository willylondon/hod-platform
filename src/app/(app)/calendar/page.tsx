"use client";

import { useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Info } from "lucide-react";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const isToday = (d: number) => year === today.getFullYear() && month === today.getMonth() && d === today.getDate();

  // Mock events
  const events: Record<string, string[]> = {};
  if (year === 2026 && month === 7) {
    events["4"] = ["Dept Meeting 08:30"];
    events["7"] = ["NQT Review 15:30"];
    events["15"] = ["SLT Curriculum Review"];
    events["22"] = ["Year 11 Parent Evening"];
    events["25"] = ["Observation: J. McDonald"];
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex-between mb-6">
        <div><h1 className="text-2xl font-bold">Calendar</h1><p className="text-sm text-muted">{MONTHS[month]} {year}</p></div>
        <button className="btn btn-primary"><Plus className="w-4 h-4" /> New Event</button>
      </div>

      <div className="card mb-4 p-3 flex items-center justify-center gap-4">
        <button onClick={prevMonth} className="btn btn-ghost btn-icon"><ChevronLeft className="w-5 h-5" /></button>
        <span className="font-semibold text-lg min-w-[180px] text-center">{MONTHS[month]} {year}</span>
        <button onClick={nextMonth} className="btn btn-ghost btn-icon"><ChevronRight className="w-5 h-5" /></button>
      </div>

      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {DAYS.map(d => <div key={d} className="p-2 text-center text-xs font-semibold bg-surface text-muted">{d}</div>)}
        {Array.from({ length: startOffset }).map((_, i) => <div key={`empty-${i}`} className="p-2 min-h-[80px] bg-surface-alt" />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const key = String(day);
          const dayEvents = events[key] || [];
          return (
            <div key={day} className={`p-2 min-h-[80px] bg-surface border-t border-border text-sm ${isToday(day) ? "ring-2 ring-primary ring-inset" : ""}`}>
              <span className={`font-medium ${isToday(day) ? "text-primary" : ""}`}>{day}</span>
              {dayEvents.map((e, j) => <div key={j} className="text-xs mt-0.5 px-1 py-0.5 rounded bg-info-bg text-info truncate">{e}</div>)}
            </div>
          );
        })}
      </div>

      <div className="mt-6 card p-4 flex items-start gap-3 bg-surface-alt">
        <Info className="w-5 h-5 text-muted mt-0.5 shrink-0" />
        <p className="text-sm text-muted">External calendar synchronization (Google Calendar, Microsoft Outlook) is coming in a future update. Events are manually managed for now.</p>
      </div>
    </div>
  );
}
