import React from 'react';
import { DollarSign, MapPin, Truck, Building2, Users } from 'lucide-react';

export default function SettingsTabsNav({ activeSubTab, setActiveSubTab, allGeofencesCount, hasUnsavedChanges }) {
  const tabs = [
    { id: 'pricing', label: 'Pricing', icon: DollarSign },
    { id: 'geofences', label: `Geofences (${allGeofencesCount})`, icon: MapPin },
    { id: 'bases', label: 'Bases', icon: Truck },
    { id: 'client_portal', label: 'Client Portal', icon: Building2 },
    { id: 'users', label: 'Users & Roles', icon: Users },
  ];

  return (
    <div className="z-30 grid flex-none grid-cols-3 gap-1 border-b border-slate-800 bg-[#0c1019] pb-1 shadow-md sm:grid-cols-6">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeSubTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            data-active={isActive}
            className={`settings-tab flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium rounded-t-lg transition cursor-pointer whitespace-nowrap ${
              isActive
                ? 'bg-[#1a2234] text-blue-400 border-b-2 border-blue-500 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#0f1522]'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        );
      })}
      <div className={`hidden items-center justify-center gap-1.5 rounded-t-lg px-2 py-2 text-[10px] font-bold uppercase tracking-wide sm:flex ${hasUnsavedChanges ? 'text-amber-400' : 'text-emerald-400'}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${hasUnsavedChanges ? 'bg-amber-400' : 'bg-emerald-400'}`} />
        {hasUnsavedChanges ? 'Unsaved' : 'Saved'}
      </div>
    </div>
  );
}
