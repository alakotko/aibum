import styles from '../surface.module.css';

export default function SettingsPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1>Settings</h1>
        <p>Core account and operator settings stay intentionally thin while the MVP centers on workflow, proofs, and order tracking.</p>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Current scope</h2>
            <p>Settings remain lightweight in this phase. Account security, billing, and integrations can be layered in after the workflow foundation stabilizes.</p>
          </div>
        </div>
        <div className={styles.empty}>
          Use the project workflow and branding surfaces for the current MVP. This page is reserved for future account-level controls.
        </div>
      </section>
    </div>
  );
}
