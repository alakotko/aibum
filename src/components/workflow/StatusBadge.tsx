import { getWorkflowStatusMeta } from '@/types/workflow';
import styles from './StatusBadge.module.css';

export default function StatusBadge({ status }: { status: string | null | undefined }) {
  const meta = getWorkflowStatusMeta(status);
  return <span className={`${styles.badge} ${styles[meta.tone]}`}>{meta.label}</span>;
}
