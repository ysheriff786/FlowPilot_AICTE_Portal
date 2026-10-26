import React from 'react';
import { Construction } from 'lucide-react';

export const PlaceholderPage: React.FC<{ title: string }> = ({ title }) => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500">This module is part of the FlowPilot roadmap.</p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <div className="w-14 h-14 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Construction size={26} />
        </div>
        <h2 className="font-bold text-slate-900">{title} is coming soon</h2>
        <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
          The data model and API scaffolding are in place. This screen will be connected in the next iteration.
        </p>
      </div>
    </div>
  );
};
