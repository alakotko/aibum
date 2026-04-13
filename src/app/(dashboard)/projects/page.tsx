'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import StatusBadge from '@/components/workflow/StatusBadge';
import type { WorkflowStatus } from '@/types/workflow';
import styles from './projects.module.css';

type ProjectCard = {
  id: string;
  title: string;
  created_at: string;
  status: WorkflowStatus;
};

export default function ProjectsDashboard() {
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const fetchProjects = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }

    const { data } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setProjects(data as ProjectCard[]);
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  const handleCreateProject = async () => {
    setCreating(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setCreating(false); return; }

    try {
      // 0. Safe-guard: Bypassing the faulty Supabase 'handle_new_user' Auth trigger 
      // by forcefully making sure the Profile foreign key is initialized for this user!
      await supabase.from('profiles').upsert({
        id: session.user.id,
        studio_name: 'Demo Studio'
      });

      // 1. Insert New Project
      const title = prompt('Enter Project Name:', 'Demo Wedding 2026');
      if (!title) { setCreating(false); return; }

      const { data: project, error: projErr } = await supabase
        .from('projects')
        .insert({
          title,
          status: 'draft',
          studio_id: session.user.id
        })
        .select()
        .single();

      if (projErr) throw projErr;

      router.push(`/projects/${project.id}`);

    } catch (e: unknown) {
      console.error(e);
      alert('Failed to construct project tables natively: ' + (e instanceof Error ? e.message : 'Unknown error'));
      setCreating(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      // Soft-delete via SECURITY DEFINER RPC.
      // Using .rpc() instead of .update() avoids the PostgREST RETURNING+RLS conflict:
      // PostgREST wraps every .update() in a CTE with RETURNING, and PostgreSQL then
      // enforces SELECT policies on the post-update row — which fails because
      // the updated row has deleted_at set and no longer passes `deleted_at is null`.
      const { error } = await supabase.rpc('soft_delete_project', {
        project_id: deleteTarget.id,
      });

      if (error) throw error;

      setProjects(prev => prev.filter(p => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e: unknown) {
      console.error(e);
      alert('Failed to delete project: ' + (e instanceof Error ? e.message : 'Unknown error'));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className={styles.container}>Loading Studio Projects...</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Studio Projects</h1>
        <button className={styles.createBtn} onClick={handleCreateProject} disabled={creating}>
          {creating ? 'Orchestrating DB...' : '+ New Project'}
        </button>
      </header>

      {projects.length === 0 ? (
        <div className={styles.emptyState}>
          <h3 style={{ marginBottom: '1rem' }}>Your Studio is Empty</h3>
          <p style={{ color: '#888' }}>Hit the New Project button above to create your first blank project and start uploading!</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {projects.map(p => (
            <div key={p.id} className={styles.cardWrapper}>
              <Link href={`/projects/${p.id}`} className={styles.card}>
                <div className={styles.cardTitle}>{p.title}</div>
                <div className={styles.cardMeta}>{new Date(p.created_at).toLocaleDateString()}</div>
                <div className={styles.status}>
                  <StatusBadge status={p.status as WorkflowStatus} />
                </div>
              </Link>
              <button
                id={`delete-project-${p.id}`}
                className={styles.deleteCardBtn}
                title="Delete project"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDeleteTarget({ id: p.id, title: p.title });
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className={styles.modalOverlay} onClick={() => !deleting && setDeleteTarget(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h2 className={styles.modalTitle}>Delete Project?</h2>
            <p className={styles.modalBody}>
              <strong>&ldquo;{deleteTarget.title}&rdquo;</strong> and all its photos and albums will be permanently deleted. This cannot be undone.
            </p>
            <div className={styles.modalActions}>
              <button
                id="cancel-delete-project"
                className={styles.cancelBtn}
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                id="confirm-delete-project"
                className={styles.confirmDeleteBtn}
                onClick={handleDeleteProject}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
