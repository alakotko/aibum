import 'server-only';

import type { PublicCheckoutContext } from '@/types/checkout';
import { normalizePublicCheckoutContext } from '@/utils/commerce';
import { createClient } from '@/utils/supabase/server';

export async function loadPublicCheckoutContext(
  token: string
): Promise<PublicCheckoutContext | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_public_checkout_context', {
    proof_token: token,
  });

  if (error) {
    return null;
  }

  return normalizePublicCheckoutContext(data);
}
