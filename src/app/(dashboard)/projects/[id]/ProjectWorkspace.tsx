'use client';

import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { useGalleryStore, type Photo } from '@/store/useGalleryStore';
import { useUploadStore } from '@/store/useUploadStore';
import type {
  AlbumVersionSummary,
  OfferSummary,
  OrderSummary,
  ProjectWorkspaceTab,
  ProofLinkSummary,
  SelectionSetSummary,
  WorkflowStatus,
} from '@/types/workflow';
import {
  PROJECT_WORKSPACE_TABS,
  formatMoney,
  getWorkflowStatusMeta,
} from '@/types/workflow';
import {
  DRAFT_VARIANTS,
  buildLayoutSpread,
  generateAutoLayout,
  getAllowedLayoutTypes,
  getDraftVariantMeta,
  type DraftVariant,
  type LayoutSpread,
} from '@/utils/autoLayout';
import type { ProjectProofData, ProjectProofLinkSummary } from '@/types/project-proof';
import { createProofToken } from '@/utils/proofToken';
import { type ProjectProofCommentRow, type ProjectProofEventRow, buildProjectProofData } from '@/utils/projectProof';
import { isProofResendable } from '@/utils/proofEvents';
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
  variant_key: DraftVariant;
  is_active: boolean;
  selection_set_id: string | null;
  cover_title: string | null;
  created_at: string;
  updated_at: string;
};

type SelectionSetRow = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  cover_album_input_id: string | null;
  created_at: string;
  updated_at: string;
};

type SelectionSetItemRow = {
  selection_set_id: string;
  album_input_id: string;
  created_at: string;
};

type LoadedVersion = {
  summary: AlbumVersionSummary;
  spreads: LayoutSpread[];
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

const TAB_LABELS: Record<ProjectWorkspaceTab, string> = {
  photos: 'Photos',
  drafts: 'Drafts',
  proof: 'Proof',
  offers: 'Offers',
  orders: 'Orders',
};

const LIGHT_BACKGROUNDS = ['#ffffff', '#f6f0ea'];
const DARK_BACKGROUND = '#171515';

function createDraftSpreadId() {
  return `draft-${Math.random().toString(36).slice(2, 10)}`;
}

function proofUrl(origin: string, token: string) {
  return `${origin}/proof/${token}`;
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

function getSpreadSignature(spread: LayoutSpread) {
  return spread.images.map((image) => image.id).join('|');
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
  const [draftVariant, setDraftVariant] = useState<DraftVariant>('classic');
  const [coverTitle, setCoverTitle] = useState('');
  const [spreads, setSpreads] = useState<LayoutSpread[]>([]);
  const [selectionSets, setSelectionSets] = useState<SelectionSetSummary[]>([]);
  const [selectionSetItemsById, setSelectionSetItemsById] = useState<Record<string, string[]>>({});
  const [activeSelectionSetPhotos, setActiveSelectionSetPhotos] = useState<Photo[]>([]);
  const [selectionSetName, setSelectionSetName] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<{ spreadId: string; imageIndex: number } | null>(null);
  const [compareLeftId, setCompareLeftId] = useState<string>('');
  const [compareRightId, setCompareRightId] = useState<string>('');
  const [compareVersions, setCompareVersions] = useState<Record<string, LoadedVersion>>({});
  const [editorSeedVersionId, setEditorSeedVersionId] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [projectProof, setProjectProof] = useState<ProjectProofData | null>(null);
  const [offers, setOffers] = useState<OfferSummary[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
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
  const [isSavingSelectionSet, setIsSavingSelectionSet] = useState(false);
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');
  const versions = projectProof?.versions ?? [];
  const proofLinks = versions.flatMap((version) => version.proofLinks);
  const latestProofLink = projectProof?.latestProofLink ?? null;

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

  const shortlistedPhotos = useMemo(
    () => photos.filter((photo) => photo.selectionStatus === 'shortlisted'),
    [photos]
  );
  const photoMap = useMemo(() => new Map(photos.map((photo) => [photo.id, photo])), [photos]);

  const activeSelectionSet = useMemo(
    () => selectionSets.find((selectionSet) => selectionSet.isActive) ?? null,
    [selectionSets]
  );
  const draftSourcePhotos =
    activeSelectionSetPhotos.length > 0
      ? activeSelectionSetPhotos
      : shortlistedPhotos.length > 0
        ? shortlistedPhotos
        : photos;
  const draftVariantMeta = getDraftVariantMeta(draftVariant);
  const sourcePoolPhotos = draftSourcePhotos.length > 0 ? draftSourcePhotos : photos;
  const compareLeft = compareLeftId ? compareVersions[compareLeftId] : undefined;
  const compareRight = compareRightId ? compareVersions[compareRightId] : undefined;

  useEffect(() => {
    if (!activeSelectionSet) {
      setActiveSelectionSetPhotos([]);
      return;
    }

    const orderedPhotos = (selectionSetItemsById[activeSelectionSet.id] ?? [])
      .map((photoId) => photoMap.get(photoId))
      .filter((photo): photo is Photo => Boolean(photo));
    setActiveSelectionSetPhotos(orderedPhotos);
  }, [activeSelectionSet, photoMap, selectionSetItemsById]);

  const loadWorkspaceData = useCallback(async () => {
    const { data: authData } = await supabase.auth.getSession();
    const currentStudioId = authData.session?.user.id ?? null;
    setStudioId(currentStudioId);

    const [
      projectRes,
      versionsRes,
      selectionSetsRes,
      offersRes,
      ordersRes,
      brandingRes,
    ] = await Promise.all([
      supabase.from('projects').select('id,title,status,event_date').eq('id', projectId).single(),
      supabase
        .from('album_versions')
        .select('id,version_number,title,status,variant_key,is_active,selection_set_id,cover_title,created_at,updated_at')
        .eq('project_id', projectId)
        .order('version_number', { ascending: false }),
      supabase
        .from('selection_sets')
        .select('id,name,description,is_active,cover_album_input_id,created_at,updated_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false }),
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

    const versionRows = (versionsRes.data ?? []) as VersionRow[];
    const versionIds = versionRows.map((row) => row.id);

    const [proofLinksRes] = await Promise.all([
      versionIds.length > 0
        ? supabase
            .from('proof_links')
            .select('id,slug,title,status,created_at,approved_at,expires_at,is_public,album_version_id')
            .in('album_version_id', versionIds)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (projectRes.data) {
      setProject(projectRes.data as ProjectRecord);
    }

    const rawSelectionSetRows = (selectionSetsRes.data ?? []) as SelectionSetRow[];
    const selectionSetIds = rawSelectionSetRows.map((row) => row.id);
    const selectionSetItemsRes = selectionSetIds.length
      ? await supabase
          .from('selection_set_items')
          .select('selection_set_id,album_input_id,created_at')
          .in('selection_set_id', selectionSetIds)
      : { data: [], error: null };
    if (selectionSetItemsRes.error) {
      throw selectionSetItemsRes.error;
    }
    const flatSelectionItems = (selectionSetItemsRes.data ?? []) as SelectionSetItemRow[];
    const selectionItemsMap = new Map<string, SelectionSetItemRow[]>();
    for (const item of flatSelectionItems) {
      const currentItems = selectionItemsMap.get(item.selection_set_id) ?? [];
      currentItems.push(item);
      selectionItemsMap.set(item.selection_set_id, currentItems);
    }

    setSelectionSetItemsById(
      Object.fromEntries(
        Array.from(selectionItemsMap.entries()).map(([selectionSetId, items]) => [
          selectionSetId,
          items.map((item) => item.album_input_id),
        ])
      )
    );

    const nextSelectionSets: SelectionSetSummary[] = rawSelectionSetRows.map((row) => {
      const items = selectionItemsMap.get(row.id) ?? [];
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        itemCount: items.length,
        isActive: row.is_active,
        coverAlbumInputId: row.cover_album_input_id,
        coverFilename: null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
    setSelectionSets(nextSelectionSets);

    const activeSetRow = rawSelectionSetRows.find((row) => row.is_active) ?? null;
    setSelectionSetName(activeSetRow?.name ?? '');
    const proofRows = (proofLinksRes.data ?? []) as ProofLinkRow[];
    const mappedVersions = versionRows.map((row) => ({
      id: row.id,
      versionNumber: row.version_number,
      title: row.title,
      status: row.status,
      variantKey: row.variant_key,
      isActive: row.is_active,
      selectionSetId: row.selection_set_id,
      coverTitle: row.cover_title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      spreadCount: 0,
    }));
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
    const mappedProofLinks = proofRows.map((row) => ({
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

    const proofLinkIds = proofRows.map((row) => row.id);
    const [{ data: comments }, { data: events }] = await Promise.all([
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

    setProjectProof(
      buildProjectProofData({
        projectId,
        projectTitle: projectRes.data?.title ?? 'Project',
        projectStatus: projectRes.data?.status ?? null,
        versions: mappedVersions.map((version) => ({
          ...version,
          spreadCount: spreadCountMap[version.id] ?? 0,
        })),
        proofLinks: mappedProofLinks,
        comments: (comments ?? []) as ProjectProofCommentRow[],
        events: (events ?? []) as ProjectProofEventRow[],
        spreadPageMap,
      })
    );

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
    if (editorSeedVersionId) return;

    startTransition(() => {
      const nextSpreads =
        draftSourcePhotos.length > 0 ? generateAutoLayout(draftSourcePhotos, draftVariant) : [];
      setSpreads(nextSpreads);
      if (nextSpreads.length > 0 && !coverTitle) {
        setCoverTitle(`${draftVariantMeta.label} Album`);
      }
    });
  }, [coverTitle, draftSourcePhotos, draftVariant, draftVariantMeta.label, editorSeedVersionId]);

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

  function regenerateDraft(nextVariant = draftVariant) {
    setEditorSeedVersionId(null);
    setSelectedSlot(null);
    startTransition(() => {
      const nextSpreads =
        draftSourcePhotos.length > 0 ? generateAutoLayout(draftSourcePhotos, nextVariant) : [];
      setSpreads(nextSpreads);
      setCoverTitle(`${getDraftVariantMeta(nextVariant).label} Album`);
    });
  }

  function resetDraft() {
    regenerateDraft();
  }

  function updateSpread(spreadId: string, updater: (spread: LayoutSpread) => LayoutSpread) {
    startTransition(() => {
      setSpreads((current) =>
        current.map((spread) => (spread.id === spreadId ? updater(spread) : spread))
      );
    });
  }

  function moveSpread(spreadId: string, direction: -1 | 1) {
    startTransition(() => {
      setSpreads((current) => {
        const index = current.findIndex((spread) => spread.id === spreadId);
        const targetIndex = index + direction;
        if (index === -1 || targetIndex < 0 || targetIndex >= current.length) return current;

        const next = [...current];
        const [spread] = next.splice(index, 1);
        next.splice(targetIndex, 0, spread);
        return next;
      });
    });
  }

  function cycleSpreadLayout(spreadId: string) {
    updateSpread(spreadId, (spread) => {
      const allowedLayoutTypes = getAllowedLayoutTypes(spread.images.length);
      const currentIndex = allowedLayoutTypes.indexOf(spread.layoutType);
      const nextLayoutType = allowedLayoutTypes[(currentIndex + 1) % allowedLayoutTypes.length];

      return buildLayoutSpread({
        spreadRole: spread.spreadRole,
        layoutType: nextLayoutType,
        images: spread.images,
        backgroundColor: spread.backgroundColor,
        id: spread.id,
      });
    });
  }

  function toggleSpreadBackground(spreadId: string) {
    startTransition(() => {
      setSpreads((current) =>
        current.map((spread, index) => {
          if (spread.id !== spreadId) return spread;

          const isDark = spread.backgroundColor.toLowerCase() === DARK_BACKGROUND;
          const fallbackLight = LIGHT_BACKGROUNDS[index % LIGHT_BACKGROUNDS.length] ?? LIGHT_BACKGROUNDS[0];

          return buildLayoutSpread({
            spreadRole: spread.spreadRole,
            layoutType: spread.layoutType,
            images: spread.images,
            backgroundColor: isDark ? fallbackLight : DARK_BACKGROUND,
            id: spread.id,
          });
        })
      );
    });
  }

  function moveImageWithinSpread(spreadId: string, imageIndex: number, direction: -1 | 1) {
    updateSpread(spreadId, (spread) => {
      const targetIndex = imageIndex + direction;
      if (targetIndex < 0 || targetIndex >= spread.images.length) return spread;

      const images = [...spread.images];
      const [image] = images.splice(imageIndex, 1);
      images.splice(targetIndex, 0, image);

      return buildLayoutSpread({
        spreadRole: spread.spreadRole,
        layoutType: spread.layoutType,
        images,
        backgroundColor: spread.backgroundColor,
        id: spread.id,
      });
    });
  }

  function replaceImageInSelectedSlot(photo: Photo) {
    if (!selectedSlot) return;

    updateSpread(selectedSlot.spreadId, (spread) =>
      buildLayoutSpread({
        spreadRole: spread.spreadRole,
        layoutType: spread.layoutType,
        images: spread.images.map((image, index) =>
          index === selectedSlot.imageIndex ? photo : image
        ),
        backgroundColor: spread.backgroundColor,
        id: spread.id,
      })
    );
    setSelectedSlot(null);
  }

  function addSpread() {
    const fallbackPhoto =
      sourcePoolPhotos[0] ??
      photos[0];
    if (!fallbackPhoto) return;

    setEditorSeedVersionId(null);
    setSpreads((current) => [
      ...current,
      buildLayoutSpread({
        id: createDraftSpreadId(),
        spreadRole: 'interior',
        layoutType: 'single',
        images: [fallbackPhoto],
        backgroundColor: LIGHT_BACKGROUNDS[current.length % LIGHT_BACKGROUNDS.length] ?? LIGHT_BACKGROUNDS[0],
      }),
    ]);
  }

  function removeSpread(spreadId: string) {
    setEditorSeedVersionId(null);
    setSpreads((current) => current.filter((spread) => spread.id !== spreadId));
    setSelectedSlot((current) => (current?.spreadId === spreadId ? null : current));
  }

  async function saveSelectionSet(mode: 'create' | 'update_active') {
    const shortlistedDbIds = shortlistedPhotos
      .map((photo) => photo.id)
      .filter((id) => !id.startsWith('optimistic-'));

    if (shortlistedDbIds.length === 0) {
      alert('Shortlist at least one persisted photo before saving a selection set.');
      return;
    }

    setIsSavingSelectionSet(true);
    try {
      const coverAlbumInputId =
        selectedPhotoIds.find((id) => shortlistedDbIds.includes(id)) ??
        activeSelectionSet?.coverAlbumInputId ??
        shortlistedDbIds[0];

      let selectionSetId = activeSelectionSet?.id ?? null;

      if (mode === 'create' || !selectionSetId) {
        await supabase
          .from('selection_sets')
          .update({ is_active: false })
          .eq('project_id', projectId);

        const { data: createdSet, error } = await supabase
          .from('selection_sets')
          .insert({
            project_id: projectId,
            name: selectionSetName.trim() || `Shortlist ${new Date().toLocaleDateString()}`,
            is_active: true,
            cover_album_input_id: coverAlbumInputId,
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .single();
        if (error) throw error;
        selectionSetId = createdSet.id as string;
      } else {
        const activeSelectionSetName = activeSelectionSet?.name ?? `Shortlist ${new Date().toLocaleDateString()}`;
        await supabase
          .from('selection_sets')
          .update({ is_active: false })
          .eq('project_id', projectId);

        const { error } = await supabase
          .from('selection_sets')
          .update({
            name: selectionSetName.trim() || activeSelectionSetName,
            is_active: true,
            cover_album_input_id: coverAlbumInputId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectionSetId);
        if (error) throw error;

        const { error: deleteError } = await supabase
          .from('selection_set_items')
          .delete()
          .eq('selection_set_id', selectionSetId);
        if (deleteError) throw deleteError;
      }

      const { error: itemsError } = await supabase
        .from('selection_set_items')
        .insert(
          shortlistedDbIds.map((albumInputId) => ({
            selection_set_id: selectionSetId,
            album_input_id: albumInputId,
          }))
        );
      if (itemsError) throw itemsError;

      setSelectionSetName('');
      setUserFeedback(
        mode === 'create' ? 'Selection set saved and activated.' : 'Active selection set updated.'
      );
      await loadWorkspaceData();
    } catch (error: unknown) {
      console.error(error);
      alert(
        `Failed to save selection set: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsSavingSelectionSet(false);
    }
  }

  async function activateSelectionSet(selectionSetId: string) {
    try {
      await supabase
        .from('selection_sets')
        .update({ is_active: false })
        .eq('project_id', projectId);

      const { error } = await supabase
        .from('selection_sets')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', selectionSetId);
      if (error) throw error;

      const activatedSet = selectionSets.find((selectionSet) => selectionSet.id === selectionSetId);
      if (activatedSet) {
        setSelectionSetName(activatedSet.name);
      }
      setEditorSeedVersionId(null);
      await loadWorkspaceData();
      setUserFeedback('Selection set activated for draft generation.');
    } catch (error: unknown) {
      console.error(error);
      alert(
        `Failed to activate selection set: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async function updateSelectionSetCover() {
    if (!activeSelectionSet) {
      alert('Activate a selection set before choosing a cover candidate.');
      return;
    }

    const coverAlbumInputId = selectedPhotoIds.find((id) =>
      (selectionSetItemsById[activeSelectionSet.id] ?? []).includes(id)
    );
    if (!coverAlbumInputId) {
      alert('Select one photo from the active selection set to mark it as the cover candidate.');
      return;
    }

    try {
      const { error } = await supabase
        .from('selection_sets')
        .update({ cover_album_input_id: coverAlbumInputId, updated_at: new Date().toISOString() })
        .eq('id', activeSelectionSet.id);
      if (error) throw error;

      setUserFeedback('Cover candidate updated.');
      await loadWorkspaceData();
    } catch (error: unknown) {
      console.error(error);
      alert(
        `Failed to update cover candidate: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async function loadVersionDetails(versionId: string) {
    if (compareVersions[versionId]) return compareVersions[versionId];

    const { data: version, error: versionError } = await supabase
      .from('album_versions')
      .select('id,version_number,title,status,variant_key,is_active,selection_set_id,cover_title,created_at,updated_at')
      .eq('id', versionId)
      .single();
    if (versionError) throw versionError;

    const { data: spreadRows, error: spreadsError } = await supabase
      .from('version_spreads')
      .select('id,page_number,template_id,spread_role,spread_key,layout_type,background_color')
      .eq('album_version_id', versionId)
      .order('page_number', { ascending: true });
    if (spreadsError) throw spreadsError;

    const spreadIds = (spreadRows ?? []).map((spread) => spread.id);
    const { data: spreadImages, error: spreadImagesError } = spreadIds.length
      ? await supabase
          .from('version_spread_images')
          .select('id,version_spread_id,album_input_id,z_index')
          .in('version_spread_id', spreadIds)
          .order('z_index', { ascending: true })
      : { data: [], error: null };
    if (spreadImagesError) throw spreadImagesError;

    const albumInputIds = (spreadImages ?? []).map((image) => image.album_input_id);
    const { data: albumInputs, error: inputsError } = albumInputIds.length
      ? await supabase
          .from('album_inputs')
          .select('id,filename,storage_path,thumbnail_path,selection_status,ai_score,ai_flags')
          .in('id', albumInputIds)
      : { data: [], error: null };
    if (inputsError) throw inputsError;

    const inputMap = new Map(
      (albumInputs ?? []).map((input) => [
        input.id,
        {
          id: input.id,
          filename: input.filename,
          url: input.storage_path,
          thumbnailUrl: input.thumbnail_path ?? undefined,
          selectionStatus: input.selection_status,
          aiScore: input.ai_score ?? undefined,
          aiFlags: Array.isArray(input.ai_flags) ? input.ai_flags : [],
        } satisfies Photo,
      ])
    );

    const loadedVersion: LoadedVersion = {
      summary: {
        id: version.id,
        versionNumber: version.version_number,
        title: version.title,
        status: version.status,
        variantKey: version.variant_key,
        isActive: version.is_active,
        selectionSetId: version.selection_set_id,
        coverTitle: version.cover_title,
        createdAt: version.created_at,
        updatedAt: version.updated_at,
        spreadCount: spreadRows?.length ?? 0,
      },
      spreads: (spreadRows ?? []).map((spread) => {
        const images = (spreadImages ?? []).reduce<Photo[]>((result, image) => {
          if (image.version_spread_id !== spread.id) return result;

          const photo = inputMap.get(image.album_input_id);
          if (photo) {
            result.push(photo);
          }

          return result;
        }, []);

        return {
          ...buildLayoutSpread({
            spreadRole: spread.spread_role,
            layoutType: spread.layout_type,
            images,
            backgroundColor: spread.background_color,
            id: spread.id,
          }),
          templateId: spread.template_id,
          spreadKey: spread.spread_key,
          images,
        };
      }),
    };

    setCompareVersions((current) => ({ ...current, [versionId]: loadedVersion }));
    return loadedVersion;
  }

  async function openVersionInEditor(versionId: string) {
    try {
      const loadedVersion = await loadVersionDetails(versionId);
      setDraftVariant(loadedVersion.summary.variantKey);
      setCoverTitle(loadedVersion.summary.coverTitle ?? `${getDraftVariantMeta(loadedVersion.summary.variantKey).label} Album`);
      setSpreads(
        loadedVersion.spreads.map((spread) => ({
          ...spread,
          id: createDraftSpreadId(),
        }))
      );
      setEditorSeedVersionId(versionId);
      setSelectedSlot(null);
      setActiveTab('drafts');
      setUserFeedback(`Loaded ${loadedVersion.summary.title} into the editor.`);
    } catch (error: unknown) {
      console.error(error);
      alert(`Failed to load version: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function publishExistingVersion(version: AlbumVersionSummary) {
    try {
      await supabase
        .from('album_versions')
        .update({ is_active: false })
        .eq('project_id', projectId);

      const { error: versionError } = await supabase
        .from('album_versions')
        .update({ is_active: true, status: 'client_review' })
        .eq('id', version.id);
      if (versionError) throw versionError;

      const projectVersionIds = versions.map((entry) => entry.id);
      if (projectVersionIds.length > 0) {
        await supabase
          .from('proof_links')
          .update({ status: 'archived' })
          .in('album_version_id', projectVersionIds)
          .neq('status', 'archived');
      }

      const { error: proofError } = await supabase.from('proof_links').insert({
        album_version_id: version.id,
        slug: createProofToken(),
        title: `${project?.title ?? 'Project'} ${getDraftVariantMeta(version.variantKey).label} proof v${version.versionNumber}`,
        status: 'active',
      });
      if (proofError) throw proofError;

      await updateProjectStatus('client_review');
      await loadWorkspaceData();
      setActiveTab('proof');
      setUserFeedback(`${version.title} is now the active proofing draft.`);
    } catch (error: unknown) {
      console.error(error);
      alert(`Failed to publish version: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function handleCompareSelection(versionId: string, side: 'left' | 'right') {
    if (!versionId) return;
    try {
      await loadVersionDetails(versionId);
      if (side === 'left') {
        setCompareLeftId(versionId);
        if (!compareRightId) {
          const fallback = versions.find((version) => version.id !== versionId);
          if (fallback) {
            await loadVersionDetails(fallback.id);
            setCompareRightId(fallback.id);
          }
        }
      } else {
        setCompareRightId(versionId);
      }
    } catch (error: unknown) {
      console.error(error);
      alert(`Failed to load compare version: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function handleSaveDraft(mode: 'draft' | 'publish') {
    if (draftSourcePhotos.length === 0) return;

    setIsSavingDraft(true);
    let createdVersionId: string | null = null;
    try {
      const nextVersion = (versions[0]?.versionNumber ?? 0) + 1;
      const layout =
        spreads.length > 0 ? spreads : generateAutoLayout(draftSourcePhotos, draftVariant);
      const versionTitle = `${draftVariantMeta.label} v${nextVersion}`;
      const status: WorkflowStatus = mode === 'publish' ? 'client_review' : 'draft';

      const { data: version, error: versionError } = await supabase
        .from('album_versions')
        .insert({
          project_id: projectId,
          selection_set_id: activeSelectionSet?.id ?? null,
          version_number: nextVersion,
          title: versionTitle,
          status,
          variant_key: draftVariant,
          cover_title: coverTitle.trim() || null,
          is_active: false,
        })
        .select()
        .single();

      if (versionError) throw versionError;
      createdVersionId = version.id;

      if (mode === 'publish') {
        await supabase
          .from('album_versions')
          .update({ is_active: false })
          .eq('project_id', projectId)
          .neq('id', version.id);

        await supabase
          .from('album_versions')
          .update({ is_active: true })
          .eq('id', version.id);
      }

      const { data: insertedSpreads, error: spreadsError } = await supabase
        .from('version_spreads')
        .insert(
          layout.map((spread, index) => ({
            album_version_id: version.id,
            page_number: index + 1,
            template_id: spread.templateId,
            spread_role: spread.spreadRole,
            spread_key: spread.spreadKey,
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

      if (mode === 'publish') {
        const projectVersionIds = versions.map((entry) => entry.id);
        if (projectVersionIds.length > 0) {
          await supabase
            .from('proof_links')
            .update({ status: 'archived' })
            .in('album_version_id', projectVersionIds)
            .neq('status', 'archived');
        }

        const { error: proofError } = await supabase.from('proof_links').insert({
          album_version_id: version.id,
          slug: createProofToken(),
          title: `${project?.title ?? 'Project'} ${draftVariantMeta.label} proof v${nextVersion}`,
          status: 'active',
        });
        if (proofError) throw proofError;

        await updateProjectStatus('client_review');
        setActiveTab('proof');
        setUserFeedback(`${versionTitle} saved and proof link published.`);
      } else {
        setUserFeedback(`${versionTitle} saved as a draft version.`);
      }

      await loadWorkspaceData();
    } catch (error: unknown) {
      console.error(error);
      if (createdVersionId) {
        const { error: cleanupError } = await supabase
          .from('album_versions')
          .delete()
          .eq('id', createdVersionId);
        if (cleanupError) {
          console.error('Failed to clean up draft version after save error', cleanupError);
        }
      }
      alert(`Failed to save draft: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSavingDraft(false);
    }
  }

  async function createOffer() {
    try {
      const clientId = await ensureClientId();
      const latestVersion = versions.find((version) => version.isActive) ?? versions[0];
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

  async function copyProofLink(link: ProjectProofLinkSummary) {
    try {
      await navigator.clipboard.writeText(proofUrl(window.location.origin, link.token));
      setUserFeedback('Proof URL copied.');
    } catch (error: unknown) {
      alert(`Failed to copy proof URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function resendProofLink(link: ProjectProofLinkSummary) {
    if (!isProofResendable(link.status)) return;

    try {
      await navigator.clipboard.writeText(proofUrl(window.location.origin, link.token));
      const { error } = await supabase.from('proof_events').insert({
        proof_link_id: link.id,
        album_version_id: link.albumVersionId,
        project_id: projectId,
        event_type: 'proof_resent',
        actor_name: branding.studioName || 'Studio',
        note: link.title || 'Proof reminder sent',
      });

      if (error) {
        alert(`Failed to log proof reminder: ${error.message}`);
        return;
      }

      setUserFeedback('Proof URL copied and reminder logged.');
      await loadWorkspaceData();
    } catch (error: unknown) {
      alert(`Failed to send reminder: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

          <div className={styles.shortlistBar}>
            <div className={styles.shortlistCard}>
              <div className={styles.cardTitleRow}>
                <h3>Shortlist sets</h3>
                <span className={styles.commentBadge}>
                  {activeSelectionSet ? `Active: ${activeSelectionSet.name}` : 'No active set'}
                </span>
              </div>
              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label htmlFor="selection-set-name">Set name</label>
                  <input
                    id="selection-set-name"
                    value={selectionSetName}
                    placeholder="Ceremony favorites"
                    onChange={(event) => setSelectionSetName(event.target.value)}
                  />
                </div>
              </div>
              <div className={styles.actionRow}>
                <button
                  id="create-selection-set"
                  type="button"
                  className={styles.buttonGhost}
                  disabled={shortlistedPhotos.length === 0 || isSavingSelectionSet}
                  onClick={() => saveSelectionSet('create')}
                >
                  Save New Set
                </button>
                <button
                  id="update-active-selection-set"
                  type="button"
                  className={styles.buttonGhost}
                  disabled={!activeSelectionSet || shortlistedPhotos.length === 0 || isSavingSelectionSet}
                  onClick={() => saveSelectionSet('update_active')}
                >
                  Update Active Set
                </button>
                <button
                  id="selection-set-cover"
                  type="button"
                  className={styles.buttonGhost}
                  disabled={!activeSelectionSet || selectedPhotoIds.length === 0}
                  onClick={updateSelectionSetCover}
                >
                  Set Cover Candidate
                </button>
              </div>
              <div className={styles.metaRow}>
                <span>{shortlistedPhotos.length} currently shortlisted</span>
                <span>{selectionSets.length} saved sets</span>
              </div>
            </div>

            <div className={styles.cardList}>
              {selectionSets.length === 0 ? (
                <div className={styles.dataCard}>
                  <h3>No saved shortlist sets</h3>
                  <p className={styles.metaText}>Save the current shortlist to make it reusable for future drafts.</p>
                </div>
              ) : (
                selectionSets.map((selectionSet) => {
                  const coverPhoto = selectionSet.coverAlbumInputId
                    ? photoMap.get(selectionSet.coverAlbumInputId)
                    : undefined;

                  return (
                    <div key={selectionSet.id} className={styles.dataCard}>
                      <div className={styles.cardTitleRow}>
                        <h3>{selectionSet.name}</h3>
                        {selectionSet.isActive ? <span className={styles.pill}>Active</span> : null}
                      </div>
                      <div className={styles.metaRow}>
                        <span>{selectionSet.itemCount} photos</span>
                        <span>{new Date(selectionSet.updatedAt ?? selectionSet.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className={styles.metaText}>
                        Cover candidate: {coverPhoto?.filename ?? selectionSet.coverFilename ?? 'Not set'}
                      </p>
                      {!selectionSet.isActive ? (
                        <button
                          id={`activate-selection-set-${selectionSet.id}`}
                          type="button"
                          className={styles.buttonGhost}
                          onClick={() => activateSelectionSet(selectionSet.id)}
                        >
                          Activate Set
                        </button>
                      ) : null}
                    </div>
                  );
                })
              )}
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
              <p>Generate a deterministic draft from shortlisted inputs, make light edits, then persist and publish it.</p>
            </div>
            <div className={styles.toolbar}>
              <button className={styles.buttonGhost} disabled={draftSourcePhotos.length === 0} onClick={resetDraft}>
                Reset to Variant
              </button>
              <button
                className={styles.buttonGhost}
                disabled={sourcePoolPhotos.length === 0}
                onClick={addSpread}
              >
                Add Spread
              </button>
              <button
                className={styles.buttonGhost}
                disabled={photos.length === 0 || isSavingDraft}
                onClick={() => handleSaveDraft('draft')}
              >
                {isSavingDraft ? 'Saving…' : 'Save Draft'}
              </button>
              <button
                className={styles.button}
                disabled={photos.length === 0 || isSavingDraft}
                onClick={() => handleSaveDraft('publish')}
              >
                {isSavingDraft ? 'Saving…' : 'Save and Publish Proof'}
              </button>
            </div>
          </div>

          <div className={styles.twoColumn}>
            <div className={styles.stack}>
              <div className={styles.variantGrid}>
                {DRAFT_VARIANTS.map((variant) => {
                  const meta = getDraftVariantMeta(variant);
                  return (
                    <button
                      key={variant}
                      id={`draft-variant-${variant}`}
                      type="button"
                      className={`${styles.variantCard} ${draftVariant === variant ? styles.variantCardActive : ''}`}
                      onClick={() => {
                        setDraftVariant(variant);
                        regenerateDraft(variant);
                      }}
                    >
                      <span className={styles.variantTitle}>{meta.label}</span>
                      <span className={styles.variantDescription}>{meta.description}</span>
                    </button>
                  );
                })}
              </div>

              <div className={styles.dataCard}>
                <div className={styles.cardTitleRow}>
                  <h3>Draft source</h3>
                  {editorSeedVersionId ? <span className={styles.pill}>Loaded version</span> : null}
                </div>
                <div className={styles.metaRow}>
                  <span>{draftSourcePhotos.length} source images</span>
                  <span>{draftVariantMeta.label} sequence</span>
                  <span>{activeSelectionSet ? activeSelectionSet.name : 'No active set'}</span>
                </div>
                <div className={styles.field}>
                  <label htmlFor="cover-title">Cover title</label>
                  <input
                    id="cover-title"
                    value={coverTitle}
                    placeholder="Classic Album"
                    onChange={(event) => setCoverTitle(event.target.value)}
                  />
                </div>
                <div className={styles.metaText}>
                  Draft source order:
                  {' '}
                  {activeSelectionSet
                    ? `active set "${activeSelectionSet.name}"`
                    : shortlistedPhotos.length > 0
                      ? 'current shortlisted photos'
                      : 'all uploaded project photos'}
                </div>
              </div>

              <div className={styles.metaRow}>
                <span>{draftSourcePhotos.length} source images</span>
                <span>
                  {shortlistedPhotos.length > 0
                    ? `${shortlistedPhotos.length} shortlisted`
                    : 'Using all uploaded photos'}
                </span>
                <span>{draftVariantMeta.label} sequence</span>
              </div>

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
                        <div className={styles.stackTight}>
                          <span>Spread {index + 1}</span>
                          <span className={styles.metaText}>{spread.images.length} images</span>
                        </div>
                        <span>{spread.layoutType}</span>
                      </div>
                      <div className={styles.spreadActions}>
                        <button
                          id={`move-spread-up-${spread.id}`}
                          type="button"
                          className={styles.buttonGhost}
                          disabled={index === 0}
                          onClick={() => moveSpread(spread.id, -1)}
                        >
                          Move Up
                        </button>
                        <button
                          id={`move-spread-down-${spread.id}`}
                          type="button"
                          className={styles.buttonGhost}
                          disabled={index === spreads.length - 1}
                          onClick={() => moveSpread(spread.id, 1)}
                        >
                          Move Down
                        </button>
                        <button
                          id={`remove-spread-${spread.id}`}
                          type="button"
                          className={styles.buttonGhost}
                          disabled={spreads.length <= 1}
                          onClick={() => removeSpread(spread.id)}
                        >
                          Remove
                        </button>
                        <button
                          id={`cycle-layout-${spread.id}`}
                          type="button"
                          className={styles.buttonGhost}
                          onClick={() => cycleSpreadLayout(spread.id)}
                        >
                          Cycle Layout
                        </button>
                        <button
                          id={`toggle-background-${spread.id}`}
                          type="button"
                          className={styles.buttonGhost}
                          onClick={() => toggleSpreadBackground(spread.id)}
                        >
                          Toggle Background
                        </button>
                      </div>
                      <div
                        className={`${styles.spreadPreview} ${styles[`layout_${spread.layoutType}`] ?? styles.layout_auto}`}
                        style={{ backgroundColor: spread.backgroundColor }}
                      >
                        {spread.images.map((image, imageIndex) => (
                          <div
                            key={image.id}
                            className={`${styles.spreadSlot} ${
                              selectedSlot?.spreadId === spread.id && selectedSlot.imageIndex === imageIndex
                                ? styles.spreadSlotSelected
                                : ''
                            }`}
                            onClick={() => setSelectedSlot({ spreadId: spread.id, imageIndex })}
                          >
                            <GalleryImage src={image.thumbnailUrl ?? image.url} alt={image.filename ?? 'Draft spread image'} />
                            {spread.images.length > 1 ? (
                              <div className={styles.slotActions}>
                                <button
                                  id={`move-image-left-${spread.id}-${image.id}`}
                                  type="button"
                                  className={styles.slotButton}
                                  disabled={imageIndex === 0}
                                  onClick={() => moveImageWithinSpread(spread.id, imageIndex, -1)}
                                >
                                  ←
                                </button>
                                <button
                                  id={`move-image-right-${spread.id}-${image.id}`}
                                  type="button"
                                  className={styles.slotButton}
                                  disabled={imageIndex === spread.images.length - 1}
                                  onClick={() => moveImageWithinSpread(spread.id, imageIndex, 1)}
                                >
                                  →
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              )}

              <div className={styles.dataCard}>
                <div className={styles.cardTitleRow}>
                  <h3>Replace image slot</h3>
                  {selectedSlot ? <span className={styles.pill}>Slot selected</span> : null}
                </div>
                <p className={styles.metaText}>
                  {selectedSlot
                    ? 'Choose an image from the current draft source to swap into the selected slot.'
                    : 'Select any image slot in the draft preview, then choose a replacement here.'}
                </p>
                <div className={styles.photoPickerGrid}>
                  {sourcePoolPhotos.map((photo) => (
                    <button
                      key={`picker-${photo.id}`}
                      id={`replace-slot-with-${photo.id}`}
                      type="button"
                      className={styles.photoPickerButton}
                      disabled={!selectedSlot}
                      onClick={() => replaceImageInSelectedSlot(photo)}
                    >
                      <GalleryImage src={photo.thumbnailUrl ?? photo.url} alt={photo.filename ?? 'Replacement option'} />
                      <span className={styles.photoPickerLabel}>{photo.filename ?? 'Album input'}</span>
                    </button>
                  ))}
                </div>
              </div>
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
                        <div className={styles.actionCluster}>
                          {version.isActive ? <span className={styles.pill}>Active</span> : null}
                          <StatusBadge status={version.status} />
                        </div>
                      </div>
                      <div className={styles.metaRow}>
                        <span>Version {version.versionNumber}</span>
                        <span>{getDraftVariantMeta(version.variantKey).label}</span>
                        <span>{version.spreadCount} spreads</span>
                      </div>
                      {version.coverTitle ? <p className={styles.metaText}>Cover: {version.coverTitle}</p> : null}
                      <div className={styles.actionRow}>
                        <button
                          id={`open-version-${version.id}`}
                          type="button"
                          className={styles.buttonGhost}
                          onClick={() => openVersionInEditor(version.id)}
                        >
                          Open in Editor
                        </button>
                        {!version.isActive ? (
                          <button
                            id={`publish-version-${version.id}`}
                            type="button"
                            className={styles.buttonGhost}
                            onClick={() => publishExistingVersion(version)}
                          >
                            Publish as Active
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className={styles.dataCard}>
                <div className={styles.cardTitleRow}>
                  <h3>Compare versions</h3>
                  <span className={styles.commentBadge}>Read-only</span>
                </div>
                <div className={styles.fieldGrid}>
                  <div className={styles.field}>
                    <label htmlFor="compare-left-version">Left version</label>
                    <select
                      id="compare-left-version"
                      value={compareLeftId}
                      onChange={(event) => void handleCompareSelection(event.target.value, 'left')}
                    >
                      <option value="">Select version</option>
                      {versions.map((version) => (
                        <option key={`left-${version.id}`} value={version.id}>
                          {version.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="compare-right-version">Right version</label>
                    <select
                      id="compare-right-version"
                      value={compareRightId}
                      onChange={(event) => void handleCompareSelection(event.target.value, 'right')}
                    >
                      <option value="">Select version</option>
                      {versions.map((version) => (
                        <option key={`right-${version.id}`} value={version.id}>
                          {version.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {compareLeft && compareRight ? (
                  <div className={styles.compareGrid}>
                    {[compareLeft, compareRight].map((version, columnIndex, versionsInCompare) => {
                      const otherVersion = versionsInCompare[columnIndex === 0 ? 1 : 0];
                      const otherSignatures = new Set(otherVersion.spreads.map(getSpreadSignature));

                      return (
                        <div key={version.summary.id} className={styles.compareColumn}>
                          <div className={styles.cardTitleRow}>
                            <h3>{version.summary.title}</h3>
                            {version.summary.isActive ? <span className={styles.pill}>Active</span> : null}
                          </div>
                          <div className={styles.metaRow}>
                            <span>{getDraftVariantMeta(version.summary.variantKey).label}</span>
                            <span>{version.summary.spreadCount} spreads</span>
                            <span>{new Date(version.summary.createdAt).toLocaleDateString()}</span>
                          </div>
                          {version.summary.coverTitle ? (
                            <p className={styles.metaText}>Cover: {version.summary.coverTitle}</p>
                          ) : null}
                          <div className={styles.compareSpreads}>
                            {version.spreads.map((spread, spreadIndex) => {
                              const spreadSignature = getSpreadSignature(spread);
                              const badge = !otherSignatures.has(spreadSignature)
                                ? 'Added or changed'
                                : otherVersion.spreads[spreadIndex] &&
                                    getSpreadSignature(otherVersion.spreads[spreadIndex]) !== spreadSignature
                                  ? 'Reordered'
                                  : null;

                              return (
                                <div key={`${version.summary.id}-${spread.id}`} className={styles.compareSpreadCard}>
                                  <div className={styles.cardTitleRow}>
                                    <span>Spread {spreadIndex + 1}</span>
                                    {badge ? <span className={styles.pillMuted}>{badge}</span> : null}
                                  </div>
                                  <div
                                    className={`${styles.spreadPreview} ${styles[`layout_${spread.layoutType}`] ?? styles.layout_auto}`}
                                    style={{ backgroundColor: spread.backgroundColor }}
                                  >
                                    {spread.images.map((image) => (
                                      <div key={`${spread.id}-${image.id}`} className={styles.spreadSlot}>
                                        <GalleryImage src={image.thumbnailUrl ?? image.url} alt={image.filename ?? 'Compared spread image'} />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className={styles.metaText}>Select two saved versions to compare spread sequence and metadata.</p>
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
              <h2>Revision summary</h2>
              <p>Track the latest proof status here, then jump into the dedicated revision hub for full history.</p>
            </div>
            <div className={styles.toolbar}>
              <Link className={styles.buttonGhost} href={`/projects/${projectId}/revisions`}>
                Open Revision Hub
              </Link>
              {latestProofLink ? (
                <button className={styles.buttonGhost} onClick={() => copyProofLink(latestProofLink)}>
                  Copy Latest Proof
                </button>
              ) : null}
            </div>
          </div>

          {latestProofLink === null ? (
            <div className={styles.emptyState}>
              <h3>No proof history yet</h3>
              <p>Save a draft version to publish the first proof, then manage revisions from the hub.</p>
            </div>
          ) : (
            <div className={styles.revisionSummary}>
              <div className={styles.summaryStats}>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Versions</div>
                  <div className={styles.statValue}>{versions.length}</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Proof Links</div>
                  <div className={styles.statValue}>{proofLinks.length}</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Unresolved</div>
                  <div className={styles.statValue}>{projectProof?.totalCommentStats.unresolved ?? 0}</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Resolved</div>
                  <div className={styles.statValue}>{projectProof?.totalCommentStats.resolved ?? 0}</div>
                </div>
              </div>

              <div className={styles.dataCard}>
                <div className={styles.cardTitleRow}>
                  <h3>{latestProofLink.title || 'Latest client proof'}</h3>
                  <div className={styles.badgeRow}>
                    <span className={styles.pill}>{getProofAccessState(latestProofLink)}</span>
                    <span className={styles.pill}>{latestProofLink.status}</span>
                  </div>
                </div>
                <div className={styles.proofUrl}>{proofUrl(origin, latestProofLink.token)}</div>
                <div className={styles.metaRow}>
                  <span>{latestProofLink.commentStats.unresolved} unresolved</span>
                  <span>{latestProofLink.commentStats.general} general notes</span>
                  <span>{latestProofLink.commentStats.total} total comments</span>
                  <span>Sent {new Date(latestProofLink.createdAt).toLocaleString()}</span>
                  {latestProofLink.approvedAt ? (
                    <span>Approved {new Date(latestProofLink.approvedAt).toLocaleString()}</span>
                  ) : null}
                </div>
                <div className={styles.actionRow}>
                  <Link className={styles.linkText} href={`/proof/${latestProofLink.token}`} target="_blank">
                    Open proof
                  </Link>
                  <button className={styles.buttonGhost} onClick={() => copyProofLink(latestProofLink)}>
                    Copy URL
                  </button>
                  {isProofResendable(latestProofLink.status) ? (
                    <button className={styles.buttonGhost} onClick={() => resendProofLink(latestProofLink)}>
                      Send Reminder
                    </button>
                  ) : null}
                  <Link className={styles.buttonGhost} href={`/projects/${projectId}/revisions`}>
                    View Full History
                  </Link>
                </div>
              </div>
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
