'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import StatusBadge from '@/components/workflow/StatusBadge';
import { useUploadStore } from '@/store/useUploadStore';
import type { WorkflowStatus } from '@/types/workflow';
import { createClient } from '@/utils/supabase/client';
import styles from './projects.module.css';

type ProjectCard = {
  id: string;
  title: string;
  created_at: string;
  status: WorkflowStatus;
};

type IntakeMode = 'new' | 'existing';

type IntakeState = {
  files: File[];
  mode: IntakeMode;
  selectedProjectId: string;
};

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function createEmptyIntakeState(): IntakeState {
  return {
    files: [],
    mode: 'new',
    selectedProjectId: '',
  };
}

function createRandomProjectTitle() {
  const token = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `Untitled Upload ${token}`;
}

export default function ProjectsDashboard() {
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [intakeError, setIntakeError] = useState<string | null>(null);
  const [intake, setIntake] = useState<IntakeState>(createEmptyIntakeState);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const dragDepthRef = useRef(0);
  const router = useRouter();
  const supabase = createClient();
  const { addFiles, processQueue } = useUploadStore();

  const fetchProjects = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }

    const { data } = await supabase
      .from('projects')
      .select('id,title,created_at,status')
      .order('created_at', { ascending: false });

    if (data) setProjects(data as ProjectCard[]);
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  function resetIntake() {
    setIntake(createEmptyIntakeState());
    setIntakeError(null);
    setIsDragActive(false);
    dragDepthRef.current = 0;
  }

  function closeIntake() {
    if (creating) return;
    setIsIntakeOpen(false);
    resetIntake();
  }

  function queueFilesForRouting(files: File[]) {
    const validFiles = files.filter((file) => ACCEPTED_IMAGE_TYPES.includes(file.type));
    if (validFiles.length === 0) {
      setIntakeError('Select at least one JPEG, PNG, or WebP image.');
      return;
    }

    setIntake({
      files: validFiles,
      mode: projects.length > 0 ? 'existing' : 'new',
      selectedProjectId: projects[0]?.id ?? '',
    });
    setIntakeError(
      validFiles.length !== files.length ? 'Some files were skipped because they are not supported.' : null
    );
    setIsIntakeOpen(true);
  }

  function handleDragEnter(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!event.dataTransfer.types.includes('Files')) return;
    dragDepthRef.current += 1;
    setIsDragActive(true);
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!event.dataTransfer.types.includes('Files')) return;
    event.dataTransfer.dropEffect = 'copy';
    setIsDragActive(true);
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!event.dataTransfer.types.includes('Files')) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragActive(false);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragActive(false);
    queueFilesForRouting(Array.from(event.dataTransfer.files ?? []));
  }

  function updateMode(mode: IntakeMode) {
    setIntake((current) => ({
      ...current,
      mode,
      selectedProjectId: mode === 'existing' ? current.selectedProjectId || projects[0]?.id || '' : '',
    }));
    setIntakeError(null);
  }

  function updateSelectedProject(selectedProjectId: string) {
    setIntake((current) => ({ ...current, selectedProjectId }));
    setIntakeError(null);
  }

  async function createProject() {
    setCreating(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setCreating(false);
        return;
      }

      await supabase.from('profiles').upsert({
        id: session.user.id,
        studio_name: 'Demo Studio',
      });

      const { data: project, error } = await supabase
        .from('projects')
        .insert({
          title: createRandomProjectTitle(),
          status: 'draft',
          studio_id: session.user.id,
        })
        .select('id')
        .single();

      if (error) throw error;

      router.push(`/projects/${project.id}`);
    } catch (error: unknown) {
      alert(`Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setCreating(false);
      return;
    }
  }

  async function routeFilesToExistingProject() {
    if (!intake.selectedProjectId) {
      setIntakeError('Choose an existing project before continuing.');
      return;
    }

    await addFiles(intake.files, { optimistic: false });
    processQueue(intake.selectedProjectId).catch(console.error);
    setCreating(false);
    setIsIntakeOpen(false);
    resetIntake();
    router.push(`/projects/${intake.selectedProjectId}`);
  }

  async function createNewProjectAndUpload() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setCreating(false);
      return;
    }

    await supabase.from('profiles').upsert({
      id: session.user.id,
      studio_name: 'Demo Studio',
    });

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        title: createRandomProjectTitle(),
        status: 'draft',
        studio_id: session.user.id,
      })
      .select('id')
      .single();

    if (projectError) throw projectError;

    await addFiles(intake.files, { optimistic: false });
    processQueue(project.id).catch(console.error);

    setCreating(false);
    setIsIntakeOpen(false);
    resetIntake();
    router.push(`/projects/${project.id}?setup=1`);
  }

  async function handleRouteFiles() {
    if (intake.files.length === 0) {
      setIntakeError('Choose at least one photo to route.');
      return;
    }

    setCreating(true);
    try {
      if (intake.mode === 'existing') {
        await routeFilesToExistingProject();
        return;
      }

      await createNewProjectAndUpload();
    } catch (error: unknown) {
      console.error(error);
      setIntakeError(
        `Failed to route upload: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      setCreating(false);
    }
  }

  const handleDeleteProject = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.rpc('soft_delete_project', {
        project_id: deleteTarget.id,
      });

      if (error) throw error;

      setProjects((prev) => prev.filter((project) => project.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e: unknown) {
      console.error(e);
      alert(
        'Failed to delete project: ' + (e instanceof Error ? e.message : 'Unknown error')
      );
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className={styles.container}>Loading Studio Projects...</div>;

  return (
    <div
      className={styles.container}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Studio Projects</h1>
          <p className={styles.subtitle}>
            Drop photos here or upload them first, then choose whether they belong in a new project
            or an existing one.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.secondaryBtn} onClick={() => void createProject()} disabled={creating}>
            {creating ? 'Creating...' : 'New Project'}
          </button>
        </div>
      </header>

      {projects.length === 0 ? (
        <div className={styles.emptyState}>
          <h3 style={{ marginBottom: '1rem' }}>Your Studio is Empty</h3>
          <p style={{ color: '#888' }}>
            Drop the first edited photos here to create a new project, or use the upload button.
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {projects.map((project) => (
            <div key={project.id} className={styles.cardWrapper}>
              <Link href={`/projects/${project.id}`} className={styles.card}>
                <div className={styles.cardTitle}>{project.title}</div>
                <div className={styles.cardMeta}>
                  {new Date(project.created_at).toLocaleDateString()}
                </div>
                <div className={styles.status}>
                  <StatusBadge status={project.status} />
                </div>
              </Link>
              <button
                id={`delete-project-${project.id}`}
                className={styles.deleteCardBtn}
                title="Delete project"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setDeleteTarget({ id: project.id, title: project.title });
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
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

      {isDragActive ? (
        <div className={styles.dropOverlay}>
          <div className={styles.dropCard}>
            <h2>Drop Photos to Route Them</h2>
            <p>Release to choose between a new project or an existing one.</p>
          </div>
        </div>
      ) : null}

      {isIntakeOpen ? (
        <div className={styles.modalOverlay} onClick={closeIntake}>
          <div className={styles.modalWide} onClick={(event) => event.stopPropagation()}>
            <div className={styles.wizardHeader}>
              <div>
                <div className={styles.wizardEyebrow}>Route Upload</div>
                <h2 className={styles.modalTitle}>Where should these photos go?</h2>
                <p className={styles.modalBody}>
                  When uploads start outside a project, choose whether to create something new or
                  attach them to an existing project. New projects get a temporary name first, then
                  the setup wizard opens while uploads continue in the background.
                </p>
              </div>
            </div>

            <div className={styles.modeSwitch}>
              <button
                type="button"
                className={intake.mode === 'existing' ? styles.modeButtonActive : styles.modeButton}
                onClick={() => updateMode('existing')}
                disabled={projects.length === 0}
              >
                Existing Project
              </button>
              <button
                type="button"
                className={intake.mode === 'new' ? styles.modeButtonActive : styles.modeButton}
                onClick={() => updateMode('new')}
              >
                New Project
              </button>
            </div>

            <div className={styles.wizardSingle}>
              {intake.mode === 'existing' ? (
                <div className={styles.field}>
                  <span>Existing Project</span>
                  <div className={styles.projectList}>
                    {projects.map((project) => (
                      <button
                        key={project.id}
                        type="button"
                        className={
                          intake.selectedProjectId === project.id
                            ? styles.projectListItemActive
                            : styles.projectListItem
                        }
                        onClick={() => updateSelectedProject(project.id)}
                      >
                        <div className={styles.projectListText}>
                          <strong>{project.title}</strong>
                          <span>{new Date(project.created_at).toLocaleDateString()}</span>
                        </div>
                        <StatusBadge status={project.status} />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className={styles.generatedNote}>
                  A new project will be created with a temporary random name, then you can edit it
                  from the project setup wizard while the first upload batch is running.
                </div>
              )}

              <div className={styles.fileList}>
                {intake.files.map((file) => (
                  <div key={`${file.name}-${file.lastModified}`} className={styles.fileRow}>
                    <span className={styles.fileName}>{file.name}</span>
                    <span className={styles.fileMeta}>{(file.size / (1024 * 1024)).toFixed(1)} MB</span>
                  </div>
                ))}
              </div>
            </div>

            {intakeError ? <p className={styles.errorText}>{intakeError}</p> : null}

            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={closeIntake} disabled={creating}>
                Cancel
              </button>
              <button className={styles.createBtn} onClick={handleRouteFiles} disabled={creating}>
                {creating
                  ? 'Routing Upload...'
                  : intake.mode === 'existing'
                    ? 'Add to Project'
                    : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className={styles.modalOverlay} onClick={() => !deleting && setDeleteTarget(null)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalIcon}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h2 className={styles.modalTitle}>Delete Project?</h2>
            <p className={styles.modalBody}>
              <strong>&ldquo;{deleteTarget.title}&rdquo;</strong> and all its photos and albums
              will be permanently deleted. This cannot be undone.
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
      ) : null}
    </div>
  );
}
