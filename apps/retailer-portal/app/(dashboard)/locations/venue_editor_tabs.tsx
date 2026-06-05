'use client';

import { TabbedPanel } from '@better-off-local/ui';
import type { TabDef } from '@better-off-local/ui';

interface VenueEditorTabsProps {
  locationName: string;
  reviewStatus: string;
  reviewNotes: string | null;
  isPrimary: boolean;
  detailsPanel: React.ReactNode;
  hoursPanel: React.ReactNode;
  imagesPanel: React.ReactNode;
}

export function VenueEditorTabs({
  locationName,
  reviewStatus,
  reviewNotes,
  isPrimary,
  detailsPanel,
  hoursPanel,
  imagesPanel,
}: VenueEditorTabsProps) {
  const tabs: TabDef[] = [
    { id: 'details',  label: 'Details' },
    { id: 'hours',    label: 'Opening Hours' },
    { id: 'images',   label: 'Images' },
    { id: 'preview',  label: 'Preview' },
    { id: 'status',   label: 'Status' },
  ];

  const previewPanel = (
    <div className="py-6 px-2">
      <p className="text-sm text-gray-500 mb-4">This is how your venue appears to members in the app.</p>
      <div className="max-w-xs mx-auto rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-green-800 to-green-600 flex items-end p-3">
          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-green-800 font-bold text-lg">
            {locationName ? locationName[0].toUpperCase() : '?'}
          </div>
        </div>
        <div className="p-3">
          <p className="font-semibold text-gray-900 text-sm">{locationName || 'Your venue name'}</p>
          <p className="text-xs text-gray-400 mt-0.5">Your description will appear here</p>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3 text-xs text-gray-500">
            <span>Opening hours</span>
            <span>•</span>
            <span>Offers</span>
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-400 text-center mt-4">Complete the Details and Images tabs to improve this preview.</p>
    </div>
  );

  const statusLabels: Record<string, { title: string; description: string; next: string; color: string }> = {
    draft:    {
      title: 'Draft',
      description: "Your venue details haven't been submitted yet.",
      next: 'Complete your details on the Details tab, then save to submit for review.',
      color: 'text-gray-700 bg-gray-50 border-gray-200',
    },
    pending:  {
      title: 'Pending review',
      description: 'Your venue has been submitted and is being reviewed by our team.',
      next: "This usually takes 1–2 business days. You'll be notified once approved.",
      color: 'text-amber-800 bg-amber-50 border-amber-200',
    },
    approved: {
      title: 'Approved — live',
      description: 'Your venue is live and visible to members.',
      next: 'Keep your details up to date. Any changes will go through a quick review.',
      color: 'text-green-800 bg-green-50 border-green-200',
    },
    rejected: {
      title: 'Changes requested',
      description: reviewNotes ? `Our team left a note: "${reviewNotes}"` : 'Our team has requested some changes.',
      next: 'Update your details on the Details tab, then save to resubmit.',
      color: 'text-red-800 bg-red-50 border-red-200',
    },
  };

  const statusInfo = statusLabels[reviewStatus] ?? statusLabels.draft;

  const statusPanel = (
    <div className="py-6 space-y-4">
      <div className={`rounded-lg border px-4 py-4 ${statusInfo.color}`}>
        <p className="font-semibold text-sm">{statusInfo.title}</p>
        <p className="text-sm mt-1">{statusInfo.description}</p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-4">
        <p className="text-sm font-medium text-gray-700">What to do next</p>
        <p className="text-sm text-gray-500 mt-1">{statusInfo.next}</p>
      </div>
      {isPrimary && (
        <div className="rounded-lg border border-green-100 bg-green-50 px-4 py-3">
          <p className="text-sm text-green-800 font-medium">Primary venue</p>
          <p className="text-sm text-green-700 mt-0.5">This is your main trading address shown on the map.</p>
        </div>
      )}
    </div>
  );

  const panels = [
    { id: 'details',  content: <div className="py-6">{detailsPanel}</div> },
    { id: 'hours',    content: <div className="py-6">{hoursPanel}</div> },
    { id: 'images',   content: <div className="py-6">{imagesPanel}</div> },
    { id: 'preview',  content: previewPanel },
    { id: 'status',   content: statusPanel },
  ];

  return (
    <TabbedPanel
      tabs={tabs}
      panels={panels}
      defaultTab={reviewStatus === 'rejected' ? 'status' : 'details'}
    />
  );
}
