import React from 'react';
import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState, primaryButtonClass } from '../components/ui';

export const NotFoundPage: React.FC = () => (
  <div className="bg-white rounded-2xl border border-slate-200">
    <EmptyState
      icon={Compass}
      title="Page not found"
      description="The page you are looking for does not exist or may have moved."
      action={
        <Link to="/" className={primaryButtonClass}>
          Back to overview
        </Link>
      }
    />
  </div>
);
