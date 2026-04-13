import styles from './layout.module.css';
import Link from 'next/link';
import UploadProgressTray from '@/components/Upload/UploadProgressTray';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>A</span>
          <div>
            <div>Albumin</div>
            <small>White-label album sales</small>
          </div>
        </div>
        <nav className={styles.nav}>
          <Link href="/projects" className={styles.navLink}>Projects</Link>
          <Link href="/orders" className={styles.navLink}>Orders</Link>
          <Link href="/branding" className={styles.navLink}>Branding</Link>
          <Link href="/settings" className={styles.navLink}>Settings</Link>
        </nav>
        <div className={styles.footer}>
          <div className={styles.footerNote}>Workflow-first foundation</div>
        </div>
      </aside>
      <main className={styles.main}>
        {children}
      </main>
      <UploadProgressTray />
    </div>
  );
}
