'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { useGalleryStore } from '@/store/useGalleryStore';
import { useUploadStore } from '@/store/useUploadStore';
import type {
  AlbumVersionSummary,
  OfferSummary,
  OrderSummary,
  ProjectWorkspaceTab,
  ProofLinkSummary,
  WorkflowStatus,
} from '@/types/workflow';
import {
  PROJECT_WORKSPACE_TABS,
  formatMoney,
  getWorkflowStatusMeta,
} from '@/types/workflow';
import type { ProofCommentRecord } from '@/types/proof';
import { createProofToken } from '@/utils/proofToken';
import { generateAutoLayout, type LayoutSpread } from '@/utils/autoLayout';
import StatusBadge from '@/components/workflow/StatusBadge';
import GalleryImage from './gallery/GalleryImage';
import styles from './workspace.module.css';

type ProjectRecord = {
  id: string;
  title: string;
  status: WorkflowStatus;
  event_date?: string | null;
};

type BrandingState = {
  studioName: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  supportEmail: string;
  proofHeadline: string;
  proofSubheadline: string;
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

type OfferRow = {
  id: string;
  title: string;
  status: OfferSummary['status'];
  total_cents: number;
  currency: string;
  updated_at: string;
};

type OrderRow = {
  id: string;
  status: OrderSummary['status'];
  payment_status: string;
  fulfillment_status: string;
  total_cents: number;
  currency: string;
  updated_at: string;
  operator_notes: string | null;
};

type BrandingRow = {
  studio_name: string | null;
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  support_email: string | null;
  proof_headline: string | null;
  proof_subheadline: string | null;
};

type InsertedSpreadRow = {
  id: string;
};

type VersionSpreadRow = {
  id: string;
  album_version_id: string;
  page_number: number;
};

type ProofCommentRow = {
  id: string;
  proof_link_id: string;
  comment_scope: ProofCommentRecord['commentScope'];
  version_spread_id: string | null;
  author_name: string;
  content: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

type ProofCommentSummary = ProofCommentRecord & {
  spreadPageNumber?: number | null;
};

const TAB_LABELS: Record<ProjectWorkspaceTab, string> = {
  photos: 'Photos',
  drafts: 'Drafts',
  proof: 'Proof',
  offers: 'Offers',
  orders: 'Orders',
};

function proofUrl(origin: string, token: string) {
  return `${origin}/proof/${token}`;
}

function toDateTimeLocalValue(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function toIsoFromLocalDateTime(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function getProofAccessState(link: ProofLinkSummary) {
  if (link.status === 'archived' || !link.isPublic) return 'Archived';
  if (link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now()) return 'Expired';
  return 'Active';
}

function inferProjectStatusFromOrder(status: OrderSummary['status']): WorkflowStatus {
  if (status === 'paid') return 'paid';
  if (status === 'fulfillment_pending') return 'fulfillment_pending';
  if (status === 'shipped') return 'shipped';
  if (status === 'delivered') return 'delivered';
  return 'payment_pending';
}

function getProofCommentStats(comments: ProofCommentSummary[]) {
  return comments.reduce(
    (stats, comment) => {
      if (!comment.resolvedAt) stats.unresolved += 1;
      if (comment.commentScope === 'general') stats.general += 1;
      return stats;
    },
    { unresolved: 0, general: 0 }
  );
}

export default function ProjectWorkspace({ projectId }: { projectId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const {
    photos,
    selectedPhotoIds,
    toggleSelection,
    deleteSelected,
    fetchProjectPhotos,
    updateSelectionStatus,
  } = useGalleryStore();
  const { addFiles, processQueue } = useUploadStore();

  const [activeTab, setActiveTab] = useState<ProjectWorkspaceTab>('photos');
  const [thumbSize, setThumbSize] = useState(220);
  const [spreads, setSpreads] = useState<LayoutSpread[]>([]);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [versions, setVersions] = useState<AlbumVersionSummary[]>([]);
  const [proofLinks, setProofLinks] = useState<ProofLinkSummary[]>([]);
  const [offers, setOffers] = useState<OfferSummary[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [proofCommentsByLink, setProofCommentsByLink] = useState<Record<string, ProofCommentSummary[]>>({});
  const [studioId, setStudioId] = useState<string | null>(null);
  const [branding, setBranding] = useState<BrandingState>({
    studioName: '',
    logoUrl: '',
    primaryColor: '#cc785c',
    accentColor: '#f3e6d4',
    supportEmail: '',
    proofHeadline: '',
    proofSubheadline: '',
  });
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');
  const [proofExpiryDrafts, setProofExpiryDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const saved = localStorage.getItem('workflow-thumb-size');
    if (saved) setThumbSize(Number(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('workflow-thumb-size', String(thumbSize));
  }, [thumbSize]);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    setProofExpiryDrafts(
      Object.fromEntries(proofLinks.map((link) => [link.id, toDateTimeLocalValue(link.expiresAt)]))
    );
  }, [proofLinks]);

  const loadWorkspaceData = useCallback(async () => {
    const { data: authData } = await supabase.auth.getSession();
    const currentStudioId = authData.session?.user.id ?? null;
    setStudioId(currentStudioId);

    const versionIdsQuery = await supabase.from('album_versions').select('id').eq('project_id', projectId);
    const versionIds = versionIdsQuery.data?.map((row: { id: string }) => row.id) ?? [];

    const [
      projectRes,
      versionsRes,
      proofLinksRes,
      offersRes,
      ordersRes,
      brandingRes,
    ] = await Promise.all([
      supabase.from('projects').select('id,title,status,event_date').eq('id', projectId).single(),
      supabase
        .from('album_versions')
        .select('id,version_number,title,status,created_at,updated_at')
        .eq('project_id', projectId)
        .order('version_number', { ascending: false }),
      versionIds.length > 0
        ? supabase
            .from('proof_links')
            .select('id,slug,title,status,created_at,approved_at,expires_at,is_public,album_version_id')
            .in('album_version_id', versionIds)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('offers')
        .select('id,title,status,total_cents,currency,updated_at')
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false }),
      supabase
        .from('orders')
        .select('id,status,payment_status,fulfillment_status,total_cents,currency,updated_at,operator_notes')
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false }),
      currentStudioId
        ? supabase
            .from('studio_branding')
            .select('*')
            .eq('studio_id', currentStudioId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (projectRes.data) {
      setProject(projectRes.data as ProjectRecord);
    }

    const versionRows = (versionsRes.data ?? []) as VersionRow[];
    const spreadCountMap: Record<string, number> = {};
    const spreadPageMap: Record<string, number> = {};
    if (versionIds.length > 0) {
      const { data: spreadRows } = await supabase
        .from('version_spreads')
        .select('id,album_version_id,page_number')
        .in('album_version_id', versionIds);

      for (const row of (spreadRows ?? []) as VersionSpreadRow[]) {
        spreadCountMap[row.album_version_id] = (spreadCountMap[row.album_version_id] ?? 0) + 1;
        spreadPageMap[row.id] = row.page_number;
      }
    }

    setVersions(
      versionRows.map((row) => ({
        id: row.id,
        versionNumber: row.version_number,
        title: row.title,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        spreadCount: spreadCountMap[row.id] ?? 0,
      }))
    );

    const proofRows = (proofLinksRes.data ?? []) as ProofLinkRow[];
    setProofLinks(
      proofRows.map((row) => ({
        id: row.id,
        token: row.slug,
        title: row.title,
        status: row.status,
        createdAt: row.created_at,
        approvedAt: row.approved_at,
        expiresAt: row.expires_at,
        isPublic: row.is_public,
        albumVersionId: row.album_version_id,
      }))
    );

    if (proofRows.length > 0) {
      const { data: comments } = await supabase
        .from('proof_comments')
        .select('id,proof_link_id,comment_scope,version_spread_id,author_name,content,created_at,resolved_at,resolved_by')
        .in('proof_link_id', proofRows.map((row) => row.id));

      const groupedComments: Record<string, ProofCommentSummary[]> = {};
      for (const comment of (comments ?? []) as ProofCommentRow[]) {
        groupedComments[comment.proof_link_id] ??= [];
        groupedComments[comment.proof_link_id].push({
          id: comment.id,
          proofLinkId: comment.proof_link_id,
          commentScope: comment.comment_scope,
          versionSpreadId: comment.version_spread_id,
          authorName: comment.author_name,
          content: comment.content,
          createdAt: comment.created_at,
          resolvedAt: comment.resolved_at,
          resolvedBy: comment.resolved_by,
          spreadPageNumber: comment.version_spread_id ? spreadPageMap[comment.version_spread_id] ?? null : null,
        });
      }

      for (const proofRow of proofRows) {
        groupedComments[proofRow.id] = (groupedComments[proofRow.id] ?? []).sort(
          (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
        );
      }

      setProofCommentsByLink(groupedComments);
    } else {
      setProofCommentsByLink({});
    }

    setOffers(
      ((offersRes.data ?? []) as OfferRow[]).map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        totalCents: row.total_cents,
        currency: row.currency,
        updatedAt: row.updated_at,
      }))
    );

    setOrders(
      ((ordersRes.data ?? []) as OrderRow[]).map((row) => ({
        id: row.id,
        status: row.status,
        paymentStatus: row.payment_status,
        fulfillmentStatus: row.fulfillment_status,
        totalCents: row.total_cents,
        currency: row.currency,
        updatedAt: row.updated_at,
        operatorNotes: row.operator_notes,
      }))
    );

    const brandingData = brandingRes?.data as BrandingRow | null;
    if (brandingData) {
      setBranding({
        studioName: brandingData.studio_name ?? '',
        logoUrl: brandingData.logo_url ?? '',
        primaryColor: brandingData.primary_color ?? '#cc785c',
        accentColor: brandingData.accent_color ?? '#f3e6d4',
        supportEmail: brandingData.support_email ?? '',
        proofHeadline: brandingData.proof_headline ?? '',
        proofSubheadline: brandingData.proof_subheadline ?? '',
      });
    }
  }, [projectId, supabase]);

  useEffect(() => {
    fetchProjectPhotos(projectId);
    void loadWorkspaceData();
  }, [projectId, fetchProjectPhotos, loadWorkspaceData]);

  useEffect(() => {
    const shortlisted = photos.filter((photo) => photo.selectionStatus === 'shortlisted');
    const source = shortlisted.length > 0 ? shortlisted : photos;
    setSpreads(source.length > 0 ? generateAutoLayout(source) : []);
  }, [photos]);

  async function updateProjectStatus(status: WorkflowStatus) {
    await supabase.from('projects').update({ status }).eq('id', projectId);
    setProject((current) => (current ? { ...current, status } : current));
  }

  async function ensureClientId() {
    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .eq('project_id', projectId)
      .limit(1)
      .maybeSingle();

    if (existing?.id) return existing.id;

    const { data: created, error } = await supabase
      .from('clients')
      .insert({
        project_id: projectId,
        name: `${project?.title ?? 'Project'} Client`,
        email: null,
      })
      .select('id')
      .single();

    if (error) throw error;
    return created.id as string;
  }

  function setUserFeedback(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 3000);
  }

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;
    await addFiles(files);
    processQueue(projectId).catch(console.error);
  }

  async function handleSaveDraft() {
    const shortlisted = photos.filter((photo) => photo.selectionStatus === 'shortlisted');
    const source = shortlisted.length > 0 ? shortlisted : photos;
    if (source.length === 0) return;

    setIsSavingDraft(true);
    try {
      const nextVersion = (versions[0]?.versionNumber ?? 0) + 1;
      const layout = spreads.length > 0 ? spreads : generateAutoLayout(source);

      const { data: version, error: versionError } = await supabase
        .from('album_versions')
        .insert({
          project_id: projectId,
          version_number: nextVersion,
          title: `Version ${nextVersion}`,
          status: 'client_review',
        })
        .select()
        .single();

      if (versionError) throw versionError;

      const { data: insertedSpreads, error: spreadsError } = await supabase
        .from('version_spreads')
        .insert(
          layout.map((spread, index) => ({
            album_version_id: version.id,
            page_number: index + 1,
            layout_type: spread.layoutType,
            background_color: spread.backgroundColor,
          }))
        )
        .select();

      if (spreadsError) throw spreadsError;

      const versionImages = ((insertedSpreads ?? []) as InsertedSpreadRow[]).flatMap((spread, index: number) =>
        layout[index].images.map((image, imageIndex) => ({
          version_spread_id: spread.id,
          album_input_id: image.id,
          z_index: imageIndex,
        }))
      );

      if (versionImages.length > 0) {
        const { error: imagesError } = await supabase
          .from('version_spread_images')
          .insert(versionImages);
        if (imagesError) throw imagesError;
      }

      const { error: proofError } = await supabase.from('proof_links').insert({
        album_version_id: version.id,
        slug: createProofToken(),
        title: `${project?.title ?? 'Project'} proof v${nextVersion}`,
        status: 'active',
      });
      if (proofError) throw proofError;

      await updateProjectStatus('client_review');
      setActiveTab('proof');
      setUserFeedback(`Version ${nextVersion} saved and proof link published.`);
      await loadWorkspaceData();
    } catch (error: unknown) {
      console.error(error);
      alert(`Failed to save draft: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSavingDraft(false);
    }
  }

  async function createOffer() {
    try {
      const clientId = await ensureClientId();
      const latestVersion = versions[0];
      const { data: offer, error: offerError } = await supabase
        .from('offers')
        .insert({
          project_id: projectId,
          client_id: clientId,
          album_version_id: latestVersion?.id ?? null,
          title: latestVersion ? `Album Offer v${latestVersion.versionNumber}` : 'Album Offer',
          status: 'sent',
          currency: 'USD',
          total_cents: 149900,
          notes: 'Manual payment and print handoff handled by studio.',
        })
        .select()
        .single();

      if (offerError) throw offerError;

      const { error: itemsError } = await supabase.from('offer_items').insert([
        {
          offer_id: offer.id,
          title: '12x12 Signature Album',
          description: 'Flush-mount album with linen wrap.',
          quantity: 1,
          unit_price_cents: 129900,
          line_total_cents: 129900,
        },
        {
          offer_id: offer.id,
          title: 'Parent Book Pair',
          description: 'Two duplicate 8x8 albums.',
          quantity: 1,
          unit_price_cents: 20000,
          line_total_cents: 20000,
        },
      ]);

      if (itemsError) throw itemsError;
      setUserFeedback('Starter offer created.');
      await loadWorkspaceData();
    } catch (error: unknown) {
      console.error(error);
      alert(`Failed to create offer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function createOrderFromOffer(offerId: string) {
    try {
      const clientId = await ensureClientId();
      const offer = offers.find((item) => item.id === offerId);
      if (!offer) return;

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          project_id: projectId,
          client_id: clientId,
          offer_id: offerId,
          status: 'payment_pending',
          payment_status: 'payment_pending',
          fulfillment_status: 'fulfillment_pending',
          currency: offer.currency,
          total_cents: offer.totalCents,
          operator_notes: 'Client approved package. Awaiting manual payment confirmation.',
        })
        .select()
        .single();
      if (orderError) throw orderError;

      const { data: items, error: itemsError } = await supabase
        .from('offer_items')
        .select('title,description,quantity,unit_price_cents,line_total_cents')
        .eq('offer_id', offerId);
      if (itemsError) throw itemsError;

      if ((items ?? []).length > 0) {
        const { error: orderItemsError } = await supabase.from('order_items').insert(
          items.map((item) => ({
            order_id: order.id,
            title: item.title,
            description: item.description,
            quantity: item.quantity,
            unit_price_cents: item.unit_price_cents,
            line_total_cents: item.line_total_cents,
          }))
        );
        if (orderItemsError) throw orderItemsError;
      }

      await updateProjectStatus('payment_pending');
      setActiveTab('orders');
      setUserFeedback('Manual order created from offer.');
      await loadWorkspaceData();
    } catch (error: unknown) {
      console.error(error);
      alert(`Failed to create order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function advanceOrder(order: OrderSummary, nextStatus: OrderSummary['status']) {
    const nextValues =
      nextStatus === 'paid'
        ? { status: nextStatus, payment_status: 'paid', fulfillment_status: 'fulfillment_pending' }
        : nextStatus === 'fulfillment_pending'
          ? { status: nextStatus, payment_status: 'paid', fulfillment_status: 'fulfillment_pending' }
          : nextStatus === 'shipped'
            ? { status: nextStatus, payment_status: 'paid', fulfillment_status: 'shipped' }
            : { status: nextStatus, payment_status: 'paid', fulfillment_status: 'delivered' };

    await supabase
      .from('orders')
      .update(nextValues)
      .eq('id', order.id);
    await updateProjectStatus(inferProjectStatusFromOrder(nextStatus));
    await loadWorkspaceData();
  }

  async function saveBranding() {
    if (!studioId) return;
    setIsSavingBranding(true);
    const { error } = await supabase.from('studio_branding').upsert({
      studio_id: studioId,
      studio_name: branding.studioName,
      logo_url: branding.logoUrl,
      primary_color: branding.primaryColor,
      accent_color: branding.accentColor,
      support_email: branding.supportEmail,
      proof_headline: branding.proofHeadline,
      proof_subheadline: branding.proofSubheadline,
    });
    setIsSavingBranding(false);

    if (error) {
      alert(`Failed to save branding: ${error.message}`);
      return;
    }

    setUserFeedback('Studio branding saved.');
  }

  async function copyProofLink(link: ProofLinkSummary) {
    try {
      await navigator.clipboard.writeText(proofUrl(window.location.origin, link.token));
      setUserFeedback('Proof URL copied.');
    } catch (error: unknown) {
      alert(`Failed to copy proof URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function updateProofLink(linkId: string, updates: Partial<ProofLinkRow>, successMessage: string) {
    try {
      const { error } = await supabase.from('proof_links').update(updates).eq('id', linkId);
      if (error) {
        alert(`Failed to update proof link: ${error.message}`);
        return;
      }

      setUserFeedback(successMessage);
      await loadWorkspaceData();
    } catch (error: unknown) {
      alert(`Failed to update proof link: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function saveProofExpiry(linkId: string) {
    try {
      const expiresAt = toIsoFromLocalDateTime(proofExpiryDrafts[linkId] ?? '');
      await updateProofLink(
        linkId,
        { expires_at: expiresAt },
        expiresAt ? 'Proof expiration updated.' : 'Proof expiration cleared.'
      );
    } catch (error: unknown) {
      alert(`Failed to update proof expiration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function toggleProofCommentResolved(commentId: string, resolved: boolean) {
    try {
      const { error } = await supabase
        .from('proof_comments')
        .update({
          resolved_at: resolved ? new Date().toISOString() : null,
          resolved_by: resolved ? studioId : null,
        })
        .eq('id', commentId);

      if (error) {
        alert(`Failed to update comment status: ${error.message}`);
        return;
      }

      setUserFeedback(resolved ? 'Comment resolved.' : 'Comment reopened.');
      await loadWorkspaceData();
    } catch (error: unknown) {
      alert(`Failed to update comment status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  const statusTone = project ? getWorkflowStatusMeta(project.status).label : 'Loading';

  return (
    <div className={styles.container}>
      <section className={styles.hero}>
        <div className={styles.heroMeta}>
          <div className={styles.eyebrow}>Albumin workflow</div>
          <div className={styles.heroTitleRow}>
            <h1>{project?.title ?? 'Loading project...'}</h1>
            {project ? <StatusBadge status={project.status} /> : null}
          </div>
          <p className={styles.heroSummary}>
            Drive each project from photo intake through proofing, package selection, manual payment,
            and fulfillment without switching into prototype-only gallery flows.
          </p>
          {feedback ? <span className={styles.pill}>{feedback}</span> : null}
        </div>

        <div className={styles.heroStats}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Inputs</div>
            <div className={styles.statValue}>{photos.length}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Drafts</div>
            <div className={styles.statValue}>{versions.length}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Proof Links</div>
            <div className={styles.statValue}>{proofLinks.length}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Workflow</div>
            <div className={styles.statValue}>{statusTone}</div>
          </div>
        </div>
      </section>

      <nav className={styles.tabNav}>
        {PROJECT_WORKSPACE_TABS.map((tab) => (
          <button
            key={tab}
            className={`${styles.tabButton} ${activeTab === tab ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </nav>

      {activeTab === 'photos' ? (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>
              <h2>Photo intake and curation</h2>
              <p>Upload source files, shortlist the album set, and exclude non-starters before drafting.</p>
            </div>
            <div className={styles.toolbar}>
              <div className={styles.scaleControl}>
                <span>Thumbs</span>
                <input
                  type="range"
                  min={120}
                  max={360}
                  step={10}
                  value={thumbSize}
                  onChange={(event) => setThumbSize(Number(event.target.value))}
                />
              </div>
              <label className={styles.button}>
                Upload Inputs
                <input
                  type="file"
                  hidden
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => handleFiles(Array.from(event.target.files ?? []))}
                />
              </label>
              <button
                className={styles.buttonGhost}
                disabled={selectedPhotoIds.length === 0}
                onClick={() => updateSelectionStatus(selectedPhotoIds, 'shortlisted')}
              >
                Shortlist
              </button>
              <button
                className={styles.buttonGhost}
                disabled={selectedPhotoIds.length === 0}
                onClick={() => updateSelectionStatus(selectedPhotoIds, 'excluded')}
              >
                Exclude
              </button>
              <button
                className={styles.buttonGhost}
                disabled={selectedPhotoIds.length === 0}
                onClick={() => updateSelectionStatus(selectedPhotoIds, 'unreviewed')}
              >
                Reset
              </button>
              <button
                className={styles.buttonDanger}
                disabled={selectedPhotoIds.length === 0}
                onClick={() => deleteSelected()}
              >
                Delete
              </button>
            </div>
          </div>

          {photos.length === 0 ? (
            <div className={styles.emptyState}>
              <h3>No album inputs yet</h3>
              <p>Upload the project’s source photos to begin the workflow.</p>
            </div>
          ) : (
            <div className={styles.grid}>
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className={`${styles.gridItem} ${selectedPhotoIds.includes(photo.id) ? styles.gridSelected : ''}`}
                  style={{ minHeight: thumbSize }}
                  onClick={(event) => toggleSelection(photo.id, event.shiftKey)}
                >
                  <GalleryImage src={photo.thumbnailUrl ?? photo.url} alt={photo.filename ?? 'Album input'} />
                  {photo.aiFlags && photo.aiFlags.length > 0 ? (
                    <div className={styles.warn}>{photo.aiFlags[0]}</div>
                  ) : null}
                  <div className={styles.assetMeta}>
                    <span className={styles.assetName}>{photo.filename ?? 'Input asset'}</span>
                    <span className={styles.pill}>{photo.selectionStatus}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === 'drafts' ? (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>
              <h2>Draft versions</h2>
              <p>Generate a draft from shortlisted inputs, persist the version, and publish a client proof link.</p>
            </div>
            <div className={styles.toolbar}>
              <button className={styles.buttonGhost} onClick={() => setSpreads(generateAutoLayout(photos.filter((photo) => photo.selectionStatus === 'shortlisted').length > 0 ? photos.filter((photo) => photo.selectionStatus === 'shortlisted') : photos))}>
                Rebuild Draft
              </button>
              <button className={styles.button} disabled={photos.length === 0 || isSavingDraft} onClick={handleSaveDraft}>
                {isSavingDraft ? 'Saving…' : 'Save and Share Proof'}
              </button>
            </div>
          </div>

          <div className={styles.twoColumn}>
            <div className={styles.stack}>
              {spreads.length === 0 ? (
                <div className={styles.emptyState}>
                  <h3>No draft yet</h3>
                  <p>Shortlist photos in the Photos tab, then generate the first album version.</p>
                </div>
              ) : (
                <div className={styles.albumCanvas}>
                  {spreads.map((spread, index) => (
                    <article key={spread.id} className={styles.spreadCard}>
                      <div className={styles.spreadHeader}>
                        <span>Spread {index + 1}</span>
                        <span>{spread.layoutType}</span>
                      </div>
                      <div
                        className={`${styles.spreadPreview} ${styles[`layout_${spread.layoutType}`] ?? styles.layout_auto}`}
                        style={{ backgroundColor: spread.backgroundColor }}
                      >
                        {spread.images.map((image) => (
                          <div key={image.id} className={styles.spreadSlot}>
                            <GalleryImage src={image.thumbnailUrl ?? image.url} alt={image.filename ?? 'Draft spread image'} />
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <aside className={styles.cardList}>
              <div className={styles.dataCard}>
                <div className={styles.cardTitleRow}>
                  <h3>Version history</h3>
                  <span className={styles.commentBadge}>{versions.length} saved</span>
                </div>
                {versions.length === 0 ? (
                  <p className={styles.metaText}>No persisted versions yet.</p>
                ) : (
                  versions.map((version) => (
                    <div key={version.id} className={styles.dataCard}>
                      <div className={styles.cardTitleRow}>
                        <h3>{version.title}</h3>
                        <StatusBadge status={version.status} />
                      </div>
                      <div className={styles.metaRow}>
                        <span>Version {version.versionNumber}</span>
                        <span>{version.spreadCount} spreads</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </aside>
          </div>
        </section>
      ) : null}

      {activeTab === 'proof' ? (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>
              <h2>Proof links</h2>
              <p>Send white-label proofs, monitor feedback, and steer the project into approval.</p>
            </div>
            <div className={styles.toolbar}>
              {proofLinks[0] ? (
                <button
                  className={styles.buttonGhost}
                  onClick={() => copyProofLink(proofLinks[0])}
                >
                  Copy Latest Proof
                </button>
              ) : null}
            </div>
          </div>

          {proofLinks.length === 0 ? (
            <div className={styles.emptyState}>
              <h3>No public proof yet</h3>
              <p>Save a draft version to create the first proof link.</p>
            </div>
          ) : (
            <div className={styles.proofList}>
              {proofLinks.map((link) => (
                <div key={link.id} className={styles.dataCard}>
                  <div className={styles.cardTitleRow}>
                    <h3>{link.title || 'Client proof link'}</h3>
                    <div className={styles.badgeRow}>
                      <span className={styles.pill}>{getProofAccessState(link)}</span>
                      <span className={styles.pill}>{link.status}</span>
                    </div>
                  </div>
                  <div className={styles.proofUrl}>{proofUrl(origin, link.token)}</div>
                  <div className={styles.metaRow}>
                    <span>{getProofCommentStats(proofCommentsByLink[link.id] ?? []).unresolved} unresolved</span>
                    <span>{getProofCommentStats(proofCommentsByLink[link.id] ?? []).general} general notes</span>
                    <span>{new Date(link.createdAt).toLocaleDateString()}</span>
                    <span>
                      {link.expiresAt ? `Expires ${new Date(link.expiresAt).toLocaleString()}` : 'No expiry'}
                    </span>
                  </div>
                  {(proofCommentsByLink[link.id] ?? []).length > 0 ? (
                    <div className={styles.commentStream}>
                      {(proofCommentsByLink[link.id] ?? []).map((comment) => (
                        <article key={comment.id} className={`${styles.commentItem} ${comment.resolvedAt ? styles.commentItemResolved : ''}`}>
                          <div className={styles.commentItemHeader}>
                            <div>
                              <div className={styles.commentItemAuthor}>{comment.authorName}</div>
                              <div className={styles.commentItemMeta}>
                                <span>{comment.commentScope === 'general' ? 'General note' : `Spread ${comment.spreadPageNumber ?? 'Unknown'}`}</span>
                                <span>{new Date(comment.createdAt).toLocaleString()}</span>
                              </div>
                            </div>
                            <span className={styles.pill}>{comment.resolvedAt ? 'Resolved' : 'Open'}</span>
                          </div>
                          <p className={styles.commentItemBody}>{comment.content}</p>
                          <div className={styles.actionRow}>
                            <button
                              className={styles.buttonGhost}
                              onClick={() => toggleProofCommentResolved(comment.id, !comment.resolvedAt)}
                            >
                              {comment.resolvedAt ? 'Reopen Comment' : 'Resolve Comment'}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.metaText}>No client feedback on this proof yet.</p>
                  )}
                  <div className={styles.expiryControls}>
                    <div className={styles.field}>
                      <label htmlFor={`proof-expires-${link.id}`}>Access expires</label>
                      <input
                        id={`proof-expires-${link.id}`}
                        type="datetime-local"
                        value={proofExpiryDrafts[link.id] ?? ''}
                        onChange={(event) =>
                          setProofExpiryDrafts((current) => ({ ...current, [link.id]: event.target.value }))
                        }
                      />
                    </div>
                    <div className={styles.actionRow}>
                      <button className={styles.buttonGhost} onClick={() => saveProofExpiry(link.id)}>
                        Save Expiry
                      </button>
                      <button
                        className={styles.buttonGhost}
                        onClick={() => {
                          setProofExpiryDrafts((current) => ({ ...current, [link.id]: '' }));
                          void updateProofLink(link.id, { expires_at: null }, 'Proof expiration cleared.');
                        }}
                      >
                        Clear Expiry
                      </button>
                    </div>
                  </div>
                  <div className={styles.actionRow}>
                    <Link className={styles.linkText} href={`/proof/${link.token}`} target="_blank">
                      Open proof
                    </Link>
                    <button className={styles.buttonGhost} onClick={() => copyProofLink(link)}>
                      Copy URL
                    </button>
                    <button
                      className={styles.buttonGhost}
                      onClick={async () => {
                        await supabase
                          .from('proof_links')
                          .update({ status: 'approved', approved_at: new Date().toISOString() })
                          .eq('id', link.id);
                        await updateProjectStatus('approved');
                        await loadWorkspaceData();
                      }}
                    >
                      Mark Approved
                    </button>
                    <button
                      className={styles.buttonGhost}
                      onClick={async () => {
                        await supabase
                          .from('proof_links')
                          .update({ status: 'changes_requested' })
                          .eq('id', link.id);
                        await updateProjectStatus('changes_requested');
                        await loadWorkspaceData();
                      }}
                    >
                      Mark Changes Requested
                    </button>
                    {link.status === 'archived' || !link.isPublic ? (
                      <button
                        className={styles.buttonGhost}
                        onClick={() => updateProofLink(link.id, { status: 'active', is_public: true }, 'Proof link restored.')}
                      >
                        Restore Link
                      </button>
                    ) : (
                      <button
                        className={styles.buttonDanger}
                        onClick={() => updateProofLink(link.id, { status: 'archived', is_public: false }, 'Proof link archived.')}
                      >
                        Archive Link
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === 'offers' ? (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>
              <h2>Offers and package selection</h2>
              <p>Create a commercial package after proofing and move approved offers into manual orders.</p>
            </div>
            <div className={styles.toolbar}>
              <button className={styles.button} onClick={createOffer}>
                Create Starter Offer
              </button>
            </div>
          </div>

          {offers.length === 0 ? (
            <div className={styles.emptyState}>
              <h3>No offers yet</h3>
              <p>Start with a package proposal once the proof direction is stable.</p>
            </div>
          ) : (
            <div className={styles.cardList}>
              {offers.map((offer) => (
                <article key={offer.id} className={styles.dataCard}>
                  <div className={styles.cardTitleRow}>
                    <h3>{offer.title}</h3>
                    <span className={styles.pill}>{offer.status}</span>
                  </div>
                  <div className={styles.metaRow}>
                    <span>{formatMoney(offer.totalCents, offer.currency)}</span>
                    <span>Updated {new Date(offer.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <div className={styles.actionRow}>
                    <button className={styles.buttonGhost} onClick={() => createOrderFromOffer(offer.id)}>
                      Create Manual Order
                    </button>
                    <button
                      className={styles.buttonGhost}
                      onClick={async () => {
                        await supabase.from('offers').update({ status: 'accepted' }).eq('id', offer.id);
                        await loadWorkspaceData();
                      }}
                    >
                      Mark Accepted
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === 'orders' ? (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>
              <h2>Manual order tracking</h2>
              <p>Track payment and fulfillment milestones until the album is delivered.</p>
            </div>
          </div>

          {orders.length === 0 ? (
            <div className={styles.emptyState}>
              <h3>No orders yet</h3>
              <p>Create a manual order from an offer to track payment and fulfillment here.</p>
            </div>
          ) : (
            <div className={styles.cardList}>
              {orders.map((order) => (
                <article key={order.id} className={styles.dataCard}>
                  <div className={styles.cardTitleRow}>
                    <h3>{formatMoney(order.totalCents, order.currency)}</h3>
                    <StatusBadge status={inferProjectStatusFromOrder(order.status)} />
                  </div>
                  <div className={styles.metaRow}>
                    <span>Payment: {order.paymentStatus}</span>
                    <span>Fulfillment: {order.fulfillmentStatus}</span>
                    <span>Updated {new Date(order.updatedAt).toLocaleDateString()}</span>
                  </div>
                  {order.operatorNotes ? <p className={styles.metaText}>{order.operatorNotes}</p> : null}
                  <div className={styles.actionRow}>
                    {order.status === 'payment_pending' ? (
                      <button className={styles.buttonGhost} onClick={() => advanceOrder(order, 'paid')}>
                        Mark Paid
                      </button>
                    ) : null}
                    {order.status === 'paid' ? (
                      <button className={styles.buttonGhost} onClick={() => advanceOrder(order, 'fulfillment_pending')}>
                        Move to Fulfillment
                      </button>
                    ) : null}
                    {order.status === 'fulfillment_pending' ? (
                      <button className={styles.buttonGhost} onClick={() => advanceOrder(order, 'shipped')}>
                        Mark Shipped
                      </button>
                    ) : null}
                    {order.status === 'shipped' ? (
                      <button className={styles.buttonGhost} onClick={() => advanceOrder(order, 'delivered')}>
                        Mark Delivered
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === 'orders' ? null : (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>
              <h2>Studio branding</h2>
              <p>Configure the proof presentation that clients see on the public proof link.</p>
            </div>
            <div className={styles.toolbar}>
              <button className={styles.button} disabled={isSavingBranding || !studioId} onClick={saveBranding}>
                {isSavingBranding ? 'Saving…' : 'Save Branding'}
              </button>
            </div>
          </div>

          <div className={styles.brandingForm}>
            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label htmlFor="studio-name">Studio name</label>
                <input id="studio-name" value={branding.studioName} onChange={(event) => setBranding((current) => ({ ...current, studioName: event.target.value }))} />
              </div>
              <div className={styles.field}>
                <label htmlFor="support-email">Support email</label>
                <input id="support-email" value={branding.supportEmail} onChange={(event) => setBranding((current) => ({ ...current, supportEmail: event.target.value }))} />
              </div>
              <div className={styles.field}>
                <label htmlFor="primary-color">Primary color</label>
                <input id="primary-color" value={branding.primaryColor} onChange={(event) => setBranding((current) => ({ ...current, primaryColor: event.target.value }))} />
              </div>
              <div className={styles.field}>
                <label htmlFor="accent-color">Accent color</label>
                <input id="accent-color" value={branding.accentColor} onChange={(event) => setBranding((current) => ({ ...current, accentColor: event.target.value }))} />
              </div>
              <div className={styles.field}>
                <label htmlFor="logo-url">Logo URL</label>
                <input id="logo-url" value={branding.logoUrl} onChange={(event) => setBranding((current) => ({ ...current, logoUrl: event.target.value }))} />
              </div>
              <div className={styles.field}>
                <label htmlFor="proof-headline">Proof headline</label>
                <input id="proof-headline" value={branding.proofHeadline} onChange={(event) => setBranding((current) => ({ ...current, proofHeadline: event.target.value }))} />
              </div>
            </div>
            <div className={styles.field}>
              <label htmlFor="proof-subheadline">Proof subheadline</label>
              <textarea id="proof-subheadline" value={branding.proofSubheadline} onChange={(event) => setBranding((current) => ({ ...current, proofSubheadline: event.target.value }))} />
            </div>
          </div>
        </section>
      )}

      <div className={styles.metaText}>
        {project?.event_date ? `Event date: ${new Date(project.event_date).toLocaleDateString()}` : 'Event date not set.'}
        {' '}Project id: {projectId}
      </div>
    </div>
  );
}
