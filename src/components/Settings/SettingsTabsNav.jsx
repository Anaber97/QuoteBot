import React from 'react';
import { DollarSign, MapPin, Truck, Building2, Users } from 'lucide-react';

export default function SettingsTabsNav({ activeSubTab, setActiveSubTab, allGeofencesCount }) {
  const tabs = [
    { id: 'pricing', label: 'Pricing', icon: DollarSign },
    { id: 'geofences', label: `Geofences (${allGeofencesCount})`, icon: MapPin },
    { id: 'bases', label: 'Bases', icon: Truck },
    { id: 'client_portal', label: 'Client Portal', icon: Building2 },
    { id: 'users', label: 'Users & Roles', icon: Users },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 border-b border-slate-800 pb-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeSubTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium rounded-t-lg transition cursor-pointer whitespace-nowrap ${
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
    </div>
  );
}
