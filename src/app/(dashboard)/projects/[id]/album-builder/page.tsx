import { redirect } from 'next/navigation';

// The album builder now lives inside the workflow-first project route.
export default async function AlbumBuilderRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/projects/${id}`);
}
