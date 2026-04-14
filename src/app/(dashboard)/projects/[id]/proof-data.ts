import 'server-only';

import type { ProjectProofData } from '@/types/project-proof';
import type { AlbumVersionSummary, ProofLinkSummary, WorkflowStatus } from '@/types/workflow';
import { buildProjectProofData, type ProjectProofCommentRow, type ProjectProofEventRow } from '@/utils/projectProof';
import { createClient } from '@/utils/supabase/server';

type ProjectRow = {
  id: string;
  title: string;
  status: WorkflowStatus;
};

type VersionRow = {
  id: string;
  version_number: number;
  title: string;
  status: WorkflowStatus;
  created_at: string;
  updated_at: string;
};

type ProofLinkRow = {
  id: string;
  slug: string;
  title: string | null;
  status: ProofLinkSummary['status'];
  created_at: string;
  approved_at: string | null;
  expires_at: string | null;
  is_public: boolean;
  album_version_id: string;
};

type VersionSpreadRow = {
  id: string;
  album_version_id: string;
  page_number: number;
};

export async function loadProjectProofData(projectId: string): Promise<ProjectProofData | null> {
  const supabase = await createClient();

  const { data: project } = await supabase
    .from('projects')
    .select('id,title,status')
    .eq('id', projectId)
    .maybeSingle();

  if (!project) {
    return null;
  }

  const { data: versionRows } = await supabase
    .from('album_versions')
    .select('id,version_number,title,status,created_at,updated_at')
    .eq('project_id', projectId)
    .order('version_number', { ascending: false });

  const versions = ((versionRows ?? []) as VersionRow[]).map<AlbumVersionSummary>((row) => ({
    id: row.id,
    versionNumber: row.version_number,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    spreadCount: 0,
  }));

  const versionIds = versions.map((version) => version.id);
  const [proofLinksRes, spreadRowsRes] = await Promise.all([
    versionIds.length > 0
      ? supabase
          .from('proof_links')
          .select('id,slug,title,status,created_at,approved_at,expires_at,is_public,album_version_id')
          .in('album_version_id', versionIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    versionIds.length > 0
      ? supabase
          .from('version_spreads')
          .select('id,album_version_id,page_number')
          .in('album_version_id', versionIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const spreadCountMap: Record<string, number> = {};
  const spreadPageMap: Record<string, number> = {};
  for (const row of (spreadRowsRes.data ?? []) as VersionSpreadRow[]) {
    spreadCountMap[row.album_version_id] = (spreadCountMap[row.album_version_id] ?? 0) + 1;
    spreadPageMap[row.id] = row.page_number;
  }

  const versionsWithSpreads = versions.map((version) => ({
    ...version,
    spreadCount: spreadCountMap[version.id] ?? 0,
  }));

  const proofLinks = ((proofLinksRes.data ?? []) as ProofLinkRow[]).map<ProofLinkSummary>((row) => ({
    id: row.id,
    token: row.slug,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    expiresAt: row.expires_at,
    isPublic: row.is_public,
    albumVersionId: row.album_version_id,
  }));

  const proofLinkIds = proofLinks.map((link) => link.id);
  const [commentsRes, eventsRes] = await Promise.all([
    proofLinkIds.length > 0
      ? supabase
          .from('proof_comments')
          .select(
            'id,proof_link_id,comment_scope,version_spread_id,author_name,content,created_at,resolved_at,resolved_by'
          )
          .in('proof_link_id', proofLinkIds)
      : Promise.resolve({ data: [], error: null }),
    proofLinkIds.length > 0
      ? supabase
          .from('proof_events')
          .select('id,proof_link_id,album_version_id,project_id,event_type,actor_name,note,created_at')
          .in('proof_link_id', proofLinkIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  return buildProjectProofData({
    projectId: (project as ProjectRow).id,
    projectTitle: (project as ProjectRow).title,
    projectStatus: (project as ProjectRow).status,
    versions: versionsWithSpreads,
    proofLinks,
    comments: (commentsRes.data ?? []) as ProjectProofCommentRow[],
    events: (eventsRes.data ?? []) as ProjectProofEventRow[],
    spreadPageMap,
  });
}
