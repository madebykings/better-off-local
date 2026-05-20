import { createServiceClient } from '@/lib/supabase/service';

/**
 * Server component — fetches the pending review count and renders a badge.
 * Rendered inside the sidebar's Review nav item via React Suspense.
 */
export async function ReviewCountBadge() {
  const supabase = createServiceClient();
  const { count } = await supabase
    .from('retailers')
    .select('id', { count: 'exact', head: true })
    .eq('onboarding_step', 'submitted')
    .in('approval_status', ['pending', 'changes_requested']);

  if (!count || count === 0) return null;

  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-white tabular-nums">
      {count > 99 ? '99+' : count}
    </span>
  );
}
