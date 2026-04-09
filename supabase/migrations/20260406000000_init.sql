-- Create custom profiles table tied to auth.users
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  studio_name text,
  updated_at timestamp with time zone
);

alter table public.profiles enable row level security;

create policy "Users can view own profile." on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile." on public.profiles
  for update using (auth.uid() = id);

-- Trigger to create profile on signup
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, studio_name)
  values (new.id, new.raw_user_meta_data->>'studio_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Create projects table
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  title text not null,
  event_date date,
  status text default 'In Progress' check (status in ('In Progress', 'Pending Approval', 'Approved')),
  studio_id uuid references public.profiles(id) on delete cascade not null
);

alter table public.projects enable row level security;

create policy "Users can view own projects." on public.projects
  for select using (auth.uid() = studio_id);

create policy "Users can insert own projects." on public.projects
  for insert with check (auth.uid() = studio_id);

create policy "Users can update own projects." on public.projects
  for update using (auth.uid() = studio_id);

create policy "Users can delete own projects." on public.projects
  for delete using (auth.uid() = studio_id);
