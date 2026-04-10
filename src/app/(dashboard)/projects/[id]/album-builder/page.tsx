import { redirect } from 'next/navigation';

// The album builder has been merged into the gallery page.
// Redirect any deep-links here to the unified page.
export default function AlbumBuilderRedirect({ params }: { params: { id: string } }) {
  redirect(`/projects/${params.id}/gallery`);
}
