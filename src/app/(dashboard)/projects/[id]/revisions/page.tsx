import { notFound } from 'next/navigation';
import { loadProjectProofData } from '../proof-data';
import RevisionHub from './RevisionHub';

export default async function ProjectRevisionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const projectProof = await loadProjectProofData(id);

  if (!projectProof) {
    notFound();
  }

  return <RevisionHub initialData={projectProof} />;
}
