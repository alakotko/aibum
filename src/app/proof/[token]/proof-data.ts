import 'server-only';

import { createClient } from '@/utils/supabase/server';
import type { LoadedProof } from '@/types/proof';

const PUBLIC_PROOF_STATUSES = ['active', 'changes_requested', 'approved'] as const;

function isLinkAccessible(link: { is_public: boolean; status: string; expires_at: string | null }) {
  const expiresAt = link.expires_at ? new Date(link.expires_at).getTime() : null;
  return (
    link.is_public &&
    PUBLIC_PROOF_STATUSES.includes(link.status as (typeof PUBLIC_PROOF_STATUSES)[number]) &&
    (expiresAt === null || expiresAt > Date.now())
  );
}

export async function loadProofByToken(token: string): Promise<LoadedProof | null> {
  const supabase = await createClient();

  const { data: proofLink } = await supabase
    .from('proof_links')
    .select('id, slug, album_version_id, title, status, expires_at, approved_at, is_public')
    .eq('slug', token)
    .maybeSingle();

  if (!proofLink || !isLinkAccessible(proofLink)) {
    return null;
  }

  const { data: version } = await supabase
    .from('album_versions')
    .select('id, project_id, title')
    .eq('id', proofLink.album_version_id)
    .maybeSingle();

  if (!version) {
    return null;
  }

  const [{ data: project }, { data: spreads }, { data: comments }] = await Promise.all([
    supabase.from('projects').select('title, studio_id').eq('id', version.project_id).maybeSingle(),
    supabase
      .from('version_spreads')
      .select('id, page_number, template_id, spread_role, spread_key, layout_type, background_color')
      .eq('album_version_id', version.id)
      .order('page_number', { ascending: true }),
    supabase
      .from('proof_comments')
      .select('id, proof_link_id, comment_scope, version_spread_id, author_name, content, created_at, resolved_at, resolved_by')
      .eq('proof_link_id', proofLink.id)
      .order('created_at', { ascending: true }),
  ]);

  const { data: events } = await supabase
    .from('proof_events')
    .select('id, proof_link_id, album_version_id, project_id, event_type, actor_name, note, created_at')
    .eq('proof_link_id', proofLink.id)
    .order('created_at', { ascending: false });

  const studioId = project?.studio_id ?? null;
  const { data: branding } = studioId
    ? await supabase
        .from('studio_branding')
        .select('studio_name, support_email, proof_headline, proof_subheadline, primary_color, accent_color')
        .eq('studio_id', studioId)
        .maybeSingle()
    : { data: null };

  const spreadRows = spreads ?? [];
  const spreadIds = spreadRows.map((spread) => spread.id);

  const { data: spreadImages } = spreadIds.length
    ? await supabase
        .from('version_spread_images')
        .select('id, version_spread_id, album_input_id, z_index')
        .in('version_spread_id', spreadIds)
        .order('z_index', { ascending: true })
    : { data: [] };

  const albumInputIds = (spreadImages ?? []).map((image) => image.album_input_id);
  const { data: albumInputs } = albumInputIds.length
    ? await supabase
        .from('album_inputs')
        .select('id, storage_path, thumbnail_path, filename')
        .in('id', albumInputIds)
    : { data: [] };

  const inputMap = new Map((albumInputs ?? []).map((input) => [input.id, input]));

  return {
    proofLinkId: proofLink.id,
    proofToken: proofLink.slug,
    albumVersionId: version.id,
    projectId: version.project_id,
    projectTitle: project?.title ?? 'Album proof',
    versionTitle: version.title,
    proofTitle: proofLink.title ?? 'Album proof',
    proofStatus: proofLink.status,
    approvedAt: proofLink.approved_at ?? null,
    studioName: branding?.studio_name ?? 'Albumin Studio',
    supportEmail: branding?.support_email ?? '',
    proofHeadline: branding?.proof_headline ?? 'Review your album proof',
    proofSubheadline:
      branding?.proof_subheadline ?? 'Leave comments directly on the spreads that need changes.',
    primaryColor: branding?.primary_color ?? '#cc785c',
    accentColor: branding?.accent_color ?? '#f3e6d4',
    spreads: spreadRows.map((spread) => ({
      id: spread.id,
      pageNumber: spread.page_number,
      templateId: spread.template_id,
      spreadRole: spread.spread_role,
      spreadKey: spread.spread_key,
      layoutType: spread.layout_type,
      backgroundColor: spread.background_color,
      images: (spreadImages ?? [])
        .filter((image) => image.version_spread_id === spread.id)
        .map((image) => {
          const input = inputMap.get(image.album_input_id);
          return {
            id: image.id,
            url: input?.storage_path ?? '',
            thumbnailUrl: input?.thumbnail_path ?? null,
            filename: input?.filename ?? null,
          };
        }),
    })),
    comments: (comments ?? []).map((entry) => ({
      id: entry.id,
      proofLinkId: entry.proof_link_id,
      commentScope: entry.comment_scope,
      versionSpreadId: entry.version_spread_id,
      authorName: entry.author_name,
      content: entry.content,
      createdAt: entry.created_at,
      resolvedAt: entry.resolved_at,
      resolvedBy: entry.resolved_by,
    })),
    events: (events ?? []).map((entry) => ({
      id: entry.id,
      proofLinkId: entry.proof_link_id,
      albumVersionId: entry.album_version_id,
      projectId: entry.project_id,
      eventType: entry.event_type,
      actorName: entry.actor_name,
      note: entry.note,
      createdAt: entry.created_at,
    })),
  };
}
