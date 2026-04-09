import styles from './layout.module.css';
import Link from 'next/link';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>Album AI</div>
        <nav className={styles.nav}>
          <Link href="/projects" className={styles.navLink}>Projects</Link>
          <Link href="/galleries" className={styles.navLink}>Galleries</Link>
          <Link href="/settings" className={styles.navLink}>Settings</Link>
        </nav>
        <div className={styles.footer}>
          <button className={styles.logoutBtn}>Log out</button>
        </div>
      </aside>
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
