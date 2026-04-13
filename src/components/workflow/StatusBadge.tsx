import { WORKFLOW_STATUS_META, type WorkflowStatus } from '@/types/workflow';
import styles from './StatusBadge.module.css';

export default function StatusBadge({ status }: { status: WorkflowStatus }) {
  const meta = WORKFLOW_STATUS_META[status];
  return <span className={`${styles.badge} ${styles[meta.tone]}`}>{meta.label}</span>;
}
