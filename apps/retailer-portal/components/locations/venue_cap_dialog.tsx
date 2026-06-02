'use client';

import { useState } from 'react';
import Link from 'next/link';

/**
 * Button shown on the Locations page when the retailer is at their venue cap.
 * Clicking opens an inline panel explaining the billing model rather than
 * silently disabling the CTA.
 */
export function VenueCapDialog() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm px-4 py-2 rounded-lg bg-green-800 text-white hover:bg-green-700 transition-colors"
      >
        Add location
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          {/* Panel */}
          <div className="absolute right-0 top-full mt-2 z-20 w-80 rounded-xl border border-gray-200 bg-white shadow-lg p-5 text-sm">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Add another venue</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 ml-2"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-gray-600">
              <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5">
                <p className="font-medium text-blue-900 text-xs uppercase tracking-wide mb-1">
                  Growth Region
                </p>
                <p className="text-xs text-blue-700">
                  Your first venue is currently <strong>free</strong> while Clackmannanshire grows.
                  No billing until the region reaches its activation threshold.
                </p>
              </div>

              <div>
                <p className="font-medium text-gray-800 mb-1">Additional venues</p>
                <p className="text-xs text-gray-500">
                  Each extra venue costs <strong>£9.99 per year</strong>. Billing begins once
                  the region reaches its activation threshold.
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100">
              <Link
                href="/locations/new"
                className="block w-full text-center rounded-lg bg-green-800 text-white text-sm font-semibold px-4 py-2 hover:bg-green-700 transition-colors"
              >
                Continue — add venue (£9.99/yr)
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
