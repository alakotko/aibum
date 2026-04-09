create policy "Studio owners can delete photos from their projects." 
  on public.photos for delete 
  using (
    exists (
      select 1 from public.projects p 
      where p.id = photos.project_id and p.studio_id = auth.uid()
    )
  );
