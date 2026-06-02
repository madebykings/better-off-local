'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';
import { sendEmail, applyTemplateVars } from '@/lib/email/mailgun';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function logActivity(
  businessId: string,
  type: string,
  description: string,
  createdBy: string,
  metadata?: Record<string, unknown>,
) {
  const supabase = createServiceClient();
  await supabase.from('crm_activity_log').insert({
    business_id: businessId,
    type,
    description,
    created_by: createdBy,
    metadata: metadata ?? null,
  });
}

// ---------------------------------------------------------------------------
// Businesses
// ---------------------------------------------------------------------------

export async function createBusiness(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const supabase = createServiceClient();

  const name = (formData.get('name') as string | null)?.trim() ?? '';
  if (name.length < 2) return;

  const { data: biz, error } = await supabase
    .from('crm_businesses')
    .insert({
      name,
      contact_name: (formData.get('contact_name') as string | null)?.trim() || null,
      email: (formData.get('email') as string | null)?.trim() || null,
      phone: (formData.get('phone') as string | null)?.trim() || null,
      website: (formData.get('website') as string | null)?.trim() || null,
      region_id: (formData.get('region_id') as string | null) || null,
      category: (formData.get('category') as string | null)?.trim() || null,
      notes: (formData.get('notes') as string | null)?.trim() || null,
      assigned_to: (formData.get('assigned_to') as string | null) || null,
      stage: (formData.get('stage') as string | null) || 'lead',
      next_followup_at: (formData.get('next_followup_at') as string | null) || null,
    })
    .select('id')
    .single();

  if (error || !biz) {
    console.error('[createBusiness]', error?.message);
    return;
  }

  await logActivity(biz.id, 'business_created', `Business "${name}" added to CRM`, userId);
  revalidatePath('/crm');
  redirect(`/crm/businesses/${biz.id}`);
}

export async function updateBusiness(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const supabase = createServiceClient();
  const id = formData.get('id') as string;

  await supabase
    .from('crm_businesses')
    .update({
      name: (formData.get('name') as string)?.trim(),
      contact_name: (formData.get('contact_name') as string | null)?.trim() || null,
      email: (formData.get('email') as string | null)?.trim() || null,
      phone: (formData.get('phone') as string | null)?.trim() || null,
      website: (formData.get('website') as string | null)?.trim() || null,
      region_id: (formData.get('region_id') as string | null) || null,
      category: (formData.get('category') as string | null)?.trim() || null,
      notes: (formData.get('notes') as string | null)?.trim() || null,
      assigned_to: (formData.get('assigned_to') as string | null) || null,
      next_followup_at: (formData.get('next_followup_at') as string | null) || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  await logActivity(id, 'business_updated', 'Business details updated', userId);
  revalidatePath(`/crm/businesses/${id}`);
  revalidatePath('/crm/pipeline');
}

export async function updateBusinessStage(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const supabase = createServiceClient();
  const id = formData.get('id') as string;
  const stage = formData.get('stage') as string;

  await supabase
    .from('crm_businesses')
    .update({ stage, updated_at: new Date().toISOString() })
    .eq('id', id);

  await logActivity(id, 'stage_changed', `Stage manually set to "${stage}"`, userId, { stage });
  revalidatePath('/crm/pipeline');
  revalidatePath(`/crm/businesses/${id}`);
}

export async function linkRetailer(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const supabase = createServiceClient();
  const businessId = formData.get('business_id') as string;
  const retailerId = formData.get('retailer_id') as string;

  await supabase
    .from('crm_businesses')
    .update({ retailer_id: retailerId || null, updated_at: new Date().toISOString() })
    .eq('id', businessId);

  await logActivity(
    businessId,
    'retailer_linked',
    retailerId ? `Linked to retailer ID ${retailerId}` : 'Retailer link removed',
    userId,
    { retailer_id: retailerId || null },
  );
  revalidatePath(`/crm/businesses/${businessId}`);
}

export async function deleteBusiness(formData: FormData): Promise<void> {
  await requireAdmin();
  const supabase = createServiceClient();
  const id = formData.get('id') as string;

  await supabase.from('crm_businesses').delete().eq('id', id);
  revalidatePath('/crm/pipeline');
  redirect('/crm/pipeline');
}

// ---------------------------------------------------------------------------
// Meetings
// ---------------------------------------------------------------------------

export async function createMeeting(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const supabase = createServiceClient();
  const businessId = formData.get('business_id') as string;

  const { data: meeting } = await supabase
    .from('crm_meetings')
    .insert({
      business_id: businessId,
      scheduled_at: formData.get('scheduled_at') as string,
      notes: (formData.get('notes') as string | null)?.trim() || null,
      follow_up_date: (formData.get('follow_up_date') as string | null) || null,
      assigned_to: (formData.get('assigned_to') as string | null) || userId,
      created_by: userId,
    })
    .select('id')
    .single();

  if (meeting) {
    // Advance stage to meeting_booked if still at lead/contacted/interested.
    const { data: biz } = await supabase
      .from('crm_businesses')
      .select('stage')
      .eq('id', businessId)
      .single();

    if (biz && ['lead', 'contacted', 'interested'].includes(biz.stage)) {
      await supabase
        .from('crm_businesses')
        .update({ stage: 'meeting_booked', updated_at: new Date().toISOString() })
        .eq('id', businessId);
    }

    // Update last contact.
    await supabase
      .from('crm_businesses')
      .update({ last_contact_at: new Date().toISOString() })
      .eq('id', businessId);
  }

  await logActivity(businessId, 'meeting_created', 'Meeting scheduled', userId);
  revalidatePath(`/crm/businesses/${businessId}`);
}

export async function updateMeetingOutcome(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const supabase = createServiceClient();
  const meetingId = formData.get('meeting_id') as string;
  const businessId = formData.get('business_id') as string;
  const outcome = formData.get('outcome') as string;
  const notes = (formData.get('notes') as string | null)?.trim() || null;
  const followUpDate = (formData.get('follow_up_date') as string | null) || null;

  await supabase
    .from('crm_meetings')
    .update({ outcome, notes, follow_up_date: followUpDate, updated_at: new Date().toISOString() })
    .eq('id', meetingId);

  // Auto-advance stage based on outcome.
  if (outcome === 'interested' || outcome === 'ready_to_join') {
    const { data: biz } = await supabase
      .from('crm_businesses')
      .select('stage')
      .eq('id', businessId)
      .single();
    if (biz && ['lead', 'contacted', 'meeting_booked'].includes(biz.stage)) {
      const newStage = outcome === 'ready_to_join' ? 'interested' : 'interested';
      await supabase
        .from('crm_businesses')
        .update({ stage: newStage, updated_at: new Date().toISOString() })
        .eq('id', businessId);
    }
  }

  if (followUpDate) {
    await supabase
      .from('crm_businesses')
      .update({ next_followup_at: new Date(followUpDate).toISOString() })
      .eq('id', businessId);
  }

  await logActivity(
    businessId,
    'meeting_outcome',
    `Meeting outcome recorded: ${outcome.replace(/_/g, ' ')}`,
    userId,
    { outcome, meeting_id: meetingId },
  );
  revalidatePath(`/crm/businesses/${businessId}`);
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function createTask(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const supabase = createServiceClient();
  const businessId = (formData.get('business_id') as string | null) || null;

  const { data: task } = await supabase
    .from('crm_tasks')
    .insert({
      business_id: businessId,
      title: (formData.get('title') as string).trim(),
      description: (formData.get('description') as string | null)?.trim() || null,
      due_at: (formData.get('due_at') as string | null) || null,
      assigned_to: (formData.get('assigned_to') as string | null) || userId,
      created_by: userId,
    })
    .select('id')
    .single();

  if (businessId && task) {
    await logActivity(businessId, 'task_created', `Task created: "${formData.get('title')}"`, userId);
  }
  revalidatePath('/crm/tasks');
  if (businessId) revalidatePath(`/crm/businesses/${businessId}`);
}

export async function completeTask(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const supabase = createServiceClient();
  const taskId = formData.get('task_id') as string;

  const { data: task } = await supabase
    .from('crm_tasks')
    .update({ status: 'done', updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .select('business_id, title')
    .single();

  if (task?.business_id) {
    await logActivity(task.business_id, 'task_completed', `Task completed: "${task.title}"`, userId);
    revalidatePath(`/crm/businesses/${task.business_id}`);
  }
  revalidatePath('/crm/tasks');
}

export async function deleteTask(formData: FormData): Promise<void> {
  await requireAdmin();
  const supabase = createServiceClient();
  const taskId = formData.get('task_id') as string;

  const { data: task } = await supabase
    .from('crm_tasks')
    .delete()
    .eq('id', taskId)
    .select('business_id')
    .single();

  revalidatePath('/crm/tasks');
  if (task?.business_id) revalidatePath(`/crm/businesses/${task.business_id}`);
}

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

export async function createEmailTemplate(formData: FormData): Promise<void> {
  await requireAdmin();
  const supabase = createServiceClient();

  await supabase.from('crm_email_templates').insert({
    name: (formData.get('name') as string).trim(),
    subject: (formData.get('subject') as string).trim(),
    body_html: (formData.get('body_html') as string).trim(),
  });

  revalidatePath('/crm/templates');
}

export async function updateEmailTemplate(formData: FormData): Promise<void> {
  await requireAdmin();
  const supabase = createServiceClient();
  const id = formData.get('id') as string;

  await supabase
    .from('crm_email_templates')
    .update({
      name: (formData.get('name') as string).trim(),
      subject: (formData.get('subject') as string).trim(),
      body_html: (formData.get('body_html') as string).trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  revalidatePath('/crm/templates');
}

export async function deleteEmailTemplate(formData: FormData): Promise<void> {
  await requireAdmin();
  const supabase = createServiceClient();
  await supabase.from('crm_email_templates').delete().eq('id', formData.get('id') as string);
  revalidatePath('/crm/templates');
}

// ---------------------------------------------------------------------------
// Email sending
// ---------------------------------------------------------------------------

export async function sendCrmEmail(formData: FormData): Promise<{ error?: string }> {
  const { userId } = await requireAdmin();
  const supabase = createServiceClient();

  const businessId = formData.get('business_id') as string;
  const to = (formData.get('to') as string).trim();
  const subject = (formData.get('subject') as string).trim();
  const bodyHtml = (formData.get('body_html') as string).trim();
  const templateId = (formData.get('template_id') as string | null) || null;

  if (!to || !subject || !bodyHtml) return { error: 'Email recipient, subject, and body are required.' };

  // Load sender profile for "from" name.
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', userId)
    .single();

  let mailgunId: string | undefined;
  try {
    const result = await sendEmail({
      to,
      subject,
      html: bodyHtml,
      fromName: profile?.full_name ?? undefined,
      tags: ['crm'],
      referenceId: businessId,
    });
    mailgunId = result.id;
  } catch (err) {
    console.error('[sendCrmEmail] mailgun error:', err);
    return { error: 'Failed to send email. Check Mailgun configuration.' };
  }

  // Store email record.
  await supabase.from('crm_emails').insert({
    business_id: businessId,
    template_id: templateId,
    subject,
    body_html: bodyHtml,
    sent_to: to,
    sent_by: userId,
    mailgun_message_id: mailgunId ?? null,
    delivery_status: 'queued',
  });

  // Update last contact + advance stage to 'contacted' if still at 'lead'.
  await supabase
    .from('crm_businesses')
    .update({ last_contact_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', businessId);

  const { data: biz } = await supabase
    .from('crm_businesses')
    .select('stage')
    .eq('id', businessId)
    .single();

  if (biz?.stage === 'lead') {
    await supabase
      .from('crm_businesses')
      .update({ stage: 'contacted' })
      .eq('id', businessId);
  }

  await logActivity(businessId, 'email_sent', `Email sent to ${to}: "${subject}"`, userId, {
    to,
    subject,
    mailgun_id: mailgunId,
  });

  revalidatePath(`/crm/businesses/${businessId}`);
  revalidatePath('/crm/pipeline');
  return {};
}

// ---------------------------------------------------------------------------
// Mailgun webhook (tracks opens/clicks)
// Called from /api/crm/mailgun-webhook route handler.
// ---------------------------------------------------------------------------

export async function handleMailgunWebhook(
  eventType: string,
  messageId: string,
  timestamp: number,
) {
  const supabase = createServiceClient();
  const ts = new Date(timestamp * 1000).toISOString();

  if (eventType === 'opened') {
    await supabase
      .from('crm_emails')
      .update({ delivery_status: 'delivered', opened_at: ts })
      .eq('mailgun_message_id', messageId)
      .is('opened_at', null);
  } else if (eventType === 'clicked') {
    await supabase
      .from('crm_emails')
      .update({ clicked_at: ts })
      .eq('mailgun_message_id', messageId)
      .is('clicked_at', null);
  } else if (eventType === 'delivered') {
    await supabase
      .from('crm_emails')
      .update({ delivery_status: 'delivered' })
      .eq('mailgun_message_id', messageId);
  } else if (eventType === 'failed' || eventType === 'bounced') {
    await supabase
      .from('crm_emails')
      .update({ delivery_status: eventType })
      .eq('mailgun_message_id', messageId);
  }
}

// ---------------------------------------------------------------------------
// Tracked signup link click
// ---------------------------------------------------------------------------

export async function recordSignupLinkClick(token: string): Promise<void> {
  const supabase = createServiceClient();
  const { data: biz } = await supabase
    .from('crm_businesses')
    .select('id, stage')
    .eq('signup_link_token', token)
    .maybeSingle();

  if (!biz) return;

  await supabase
    .from('crm_businesses')
    .update({
      signup_link_clicked_at: new Date().toISOString(),
      stage: biz.stage === 'lead' || biz.stage === 'contacted' ? 'interested' : biz.stage,
    })
    .eq('id', biz.id);

  await supabase.from('crm_activity_log').insert({
    business_id: biz.id,
    type: 'signup_link_clicked',
    description: 'Tracked signup link clicked',
  });
}
