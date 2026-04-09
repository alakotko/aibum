'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import styles from './projects.module.css';

export default function ProjectsDashboard() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setProjects(data);
    setLoading(false);
  };

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
          studio_id: session.user.id
        })
        .select()
        .single();

      if (projErr) throw projErr;

      // 2. SMART SEEDER: Auto-insert Unsplash Mock Photos!
      // This bypasses the need to upload gigabytes of real files for testing.
      const mockPhotos = [
        { project_id: project.id, storage_path: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?fm=jpg&w=800&q=80', filename: 'bride_prep.jpg', status: 'uploaded' },
        { project_id: project.id, storage_path: 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?fm=jpg&w=800&q=80', filename: 'ceremony.jpg', status: 'uploaded' },
        { project_id: project.id, storage_path: 'https://images.unsplash.com/photo-1519741497674-611481863552?fm=jpg&w=800&q=80', filename: 'reception.jpg', status: 'uploaded' },
      ];

      const { data: insertedPhotos, error: photoErr } = await supabase
        .from('photos')
        .insert(mockPhotos);

      if (photoErr) throw photoErr;

      router.push(`/projects/${project.id}/cull`);

    } catch (e: any) {
      console.error(e);
      alert('Failed to construct project tables natively: ' + e.message);
      setCreating(false);
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
          <p style={{ color: '#888' }}>Hit the New Project button above to auto-provision a mock Wedding utilizing Unsplash database seeds!</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {projects.map(p => (
            <Link key={p.id} href={`/projects/${p.id}/cull`} className={styles.card}>
              <div className={styles.cardTitle}>{p.title}</div>
              <div className={styles.cardMeta}>{new Date(p.created_at).toLocaleDateString()}</div>
              <div className={styles.status}>{p.status}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
