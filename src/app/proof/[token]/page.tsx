import ProofViewer from './ProofViewer';
import { loadProofByToken } from './proof-data';
import styles from './proof.module.css';

export default async function ProofPage(props: PageProps<'/proof/[token]'>) {
  const { token } = await props.params;
  const proof = await loadProofByToken(token);

  if (!proof) {
    return (
      <div className={styles.centerState}>
        This proof link has expired or is no longer available.
      </div>
    );
  }

  return <ProofViewer initialProof={proof} />;
}
