import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

export default function BasesTab({ formData, addBase, removeBase, setFormData }) {
  return (
    <div className="space-y-3 text-xs">
      <div className="flex justify-between items-center">
        <h4 className="font-bold text-slate-200">Dispatch Base Yards</h4>
        <button
          type="button"
          onClick={addBase}
          className="flex items-center gap-1 text-[11px] bg-blue-600/20 text-blue-400 px-2.5 py-1 rounded-lg border border-blue-500/30"
        >
          <Plus className="w-3 h-3" /> Add Yard
        </button>
      </div>
      {(formData.bases || []).map((base, idx) => (
        <div key={base.id} className="flex flex-col sm:flex-row gap-2 bg-[#080c14] p-3 rounded-xl border border-slate-800">
          <input
            type="text"
            placeholder="Yard Name"
            value={base.name}
            onChange={(e) => {
              const updated = [...formData.bases];
              updated[idx].name = e.target.value;
              setFormData((prev) => ({ ...prev, bases: updated }));
            }}
            className="bg-[#121824] border border-slate-700 rounded px-2.5 py-1.5 text-white flex-1"
          />
          <input
            type="text"
            placeholder="Physical Address"
            value={base.address}
            onChange={(e) => {
              const updated = [...formData.bases];
              updated[idx].address = e.target.value;
              setFormData((prev) => ({ ...prev, bases: updated }));
            }}
            className="bg-[#121824] border border-slate-700 rounded px-2.5 py-1.5 text-white flex-1"
          />
          <button
            type="button"
            onClick={() => removeBase(base.id)}
            className="p-1.5 text-slate-500 hover:text-red-400 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
