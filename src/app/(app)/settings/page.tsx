"use client";

import { useState } from "react";
import { User, Bell, Bot, Calendar, Upload, Shield, Info } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto animate-fade-in">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* Profile */}
      <div className="card mb-6">
        <div className="flex items-center gap-4 mb-4"><User className="w-5 h-5 text-muted" /><h2 className="text-lg font-semibold">Profile</h2></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="form-label">Full Name</label><input className="form-input" defaultValue="Head of Department" /></div>
          <div><label className="form-label">Email</label><input className="form-input" defaultValue="hod@school.edu" disabled /></div>
          <div><label className="form-label">Role</label><input className="form-input" defaultValue="Head of Department" disabled /></div>
          <div><label className="form-label">Department</label><input className="form-input" defaultValue="English Department" disabled /></div>
        </div>
      </div>

      {/* Notifications */}
      <div className="card mb-6">
        <div className="flex items-center gap-4 mb-4"><Bell className="w-5 h-5 text-muted" /><h2 className="text-lg font-semibold">Notifications</h2></div>
        <div className="space-y-3">
          {["In-app notifications", "Email notifications", "Push notifications"].map((label, i) => (
            <div key={i} className="flex-between py-2"><span className="text-sm">{label}</span><div className="w-10 h-6 rounded-full bg-border relative cursor-pointer"><div className={`w-5 h-5 rounded-full bg-surface absolute top-0.5 transition-all ${i === 0 ? "left-[18px] bg-primary" : "left-0.5"}`} /></div></div>
          ))}
        </div>
      </div>

      {/* AI Provider */}
      <div className="card mb-6">
        <div className="flex items-center gap-4 mb-4"><Bot className="w-5 h-5 text-muted" /><h2 className="text-lg font-semibold">AI Provider</h2></div>
        <select className="form-select w-full max-w-xs" defaultValue="mock">
          <option value="mock">Mock AI Mode</option>
          <option value="openai" disabled>OpenAI (requires API key)</option>
        </select>
        <p className="text-xs text-muted mt-2">Add OPENAI_API_KEY to your environment to enable OpenAI.</p>
      </div>

      {/* Integrations */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-4">Integrations</h2>
        <div className="space-y-4">
          {[
            { name: "Google Calendar", desc: "Sync meetings and events", icon: Calendar },
            { name: "Microsoft Outlook", desc: "Sync calendar and email", icon: Calendar },
            { name: "Timetable Upload", desc: "CSV / XLSX import", icon: Upload },
          ].map((int, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-md border border-border bg-surface-alt">
              <int.icon className="w-5 h-5 text-muted shrink-0" />
              <div className="flex-1"><p className="text-sm font-medium">{int.name}</p><p className="text-xs text-muted">{int.desc}</p></div>
              <span className="badge badge-low text-xs shrink-0">Coming soon</span>
              <button className="btn btn-secondary btn-sm" disabled>Connect</button>
            </div>
          ))}
        </div>
      </div>

      {/* Privacy */}
      <div className="card p-4 border-l-4 border-l-warning bg-warning-bg/10">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-warning mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">Privacy & Data Protection</p>
            <p className="text-xs text-muted mt-1">This is a prototype. A production deployment requires formal school privacy approval, data retention policies, and compliance with local education authority data protection rules. Staff consent is required for observations and performance data.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
