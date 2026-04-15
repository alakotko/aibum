'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { PublicCheckoutContext } from '@/types/checkout';
import { formatMoney } from '@/types/workflow';
import {
  calculateOfferSelectionTotal,
  getSelectedOfferItems,
  normalizePublicCheckoutSubmission,
} from '@/utils/commerce';
import styles from './checkout.module.css';

function buildInitialAddonSelection(context: PublicCheckoutContext, offerId: string) {
  const offer = context.offers.find((entry) => entry.id === offerId);
  return offer
    ? offer.items.filter((item) => item.isOptional && item.isSelectedByDefault).map((item) => item.id)
    : [];
}

export default function CheckoutExperience({
  initialContext,
}: {
  initialContext: PublicCheckoutContext;
}) {
  const [context, setContext] = useState(initialContext);
  const [selectedOfferId, setSelectedOfferId] = useState(initialContext.offers[0]?.id ?? '');
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>(
    buildInitialAddonSelection(initialContext, initialContext.offers[0]?.id ?? '')
  );
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [clientNote, setClientNote] = useState('');
  const [shippingName, setShippingName] = useState('');
  const [shippingAddressLine1, setShippingAddressLine1] = useState('');
  const [shippingAddressLine2, setShippingAddressLine2] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingState, setShippingState] = useState('');
  const [shippingPostalCode, setShippingPostalCode] = useState('');
  const [shippingCountry, setShippingCountry] = useState('USA');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedOffer = useMemo(
    () => context.offers.find((offer) => offer.id === selectedOfferId) ?? null,
    [context.offers, selectedOfferId]
  );
  const selectedItems = useMemo(
    () => (selectedOffer ? getSelectedOfferItems(selectedOffer.items, selectedAddonIds) : []),
    [selectedAddonIds, selectedOffer]
  );
  const orderTotal = useMemo(
    () => (selectedOffer ? calculateOfferSelectionTotal(selectedOffer.items, selectedAddonIds) : 0),
    [selectedAddonIds, selectedOffer]
  );

  useEffect(() => {
    if (!selectedOffer) return;
    setSelectedAddonIds(
      selectedOffer.items
        .filter((item) => item.isOptional && item.isSelectedByDefault)
        .map((item) => item.id)
    );
  }, [selectedOfferId, selectedOffer]);

  async function handleSubmit() {
    if (!selectedOffer) return;

    try {
      setIsSubmitting(true);
      setFeedback(null);
      const supabase = createClient();
      const { data, error } = await supabase.rpc('submit_public_checkout', {
        proof_token: context.proofToken,
        offer_row_id: selectedOffer.id,
        selected_addon_item_ids: selectedAddonIds,
        buyer_name: buyerName,
        buyer_email: buyerEmail,
        buyer_phone: buyerPhone || null,
        client_note: clientNote || null,
        shipping_name: shippingName || buyerName,
        shipping_address_line_1: shippingAddressLine1,
        shipping_address_line_2: shippingAddressLine2 || null,
        shipping_city: shippingCity,
        shipping_state: shippingState,
        shipping_postal_code: shippingPostalCode,
        shipping_country: shippingCountry,
      });

      const result = normalizePublicCheckoutSubmission(data);
      if (error || !result) {
        setFeedback(error?.message ?? 'Failed to submit checkout.');
        return;
      }

      setContext((current) => ({
        ...current,
        existingOrder: {
          id: result.orderId,
          status: result.orderStatus,
          totalCents: result.totalCents,
          currency: result.currency,
          buyerName,
          buyerEmail,
          createdAt: new Date().toISOString(),
        },
        offers: current.offers.map((offer) =>
          offer.id === selectedOffer.id ? { ...offer, status: 'accepted' } : offer
        ),
      }));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className={styles.page}
      style={
        {
          ['--checkout-primary' as string]: context.branding.primaryColor,
          ['--checkout-accent' as string]: context.branding.accentColor,
        } as CSSProperties
      }
    >
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>{context.branding.senderName}</div>
          <h1>Album package selection</h1>
          <p>
            Review the studio&apos;s prepared packages, choose optional add-ons, and submit your
            checkout details for manual payment follow-up.
          </p>
        </div>
        <div className={styles.headerMeta}>
          <strong>{context.projectTitle}</strong>
          <span>{context.versionTitle}</span>
          {context.branding.supportEmail ? <span>{context.branding.supportEmail}</span> : null}
          <Link className={styles.secondaryLink} href={`/proof/${context.proofToken}`}>
            Back to proof
          </Link>
        </div>
      </header>

      {context.existingOrder ? (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Order received</h2>
              <p>The studio has your package selection and will follow up for payment.</p>
            </div>
            <span className={styles.statusPill}>{context.existingOrder.status.replaceAll('_', ' ')}</span>
          </div>
          <div className={styles.confirmationGrid}>
            <div className={styles.confirmationCard}>
              <span>Total</span>
              <strong>
                {formatMoney(context.existingOrder.totalCents, context.existingOrder.currency)}
              </strong>
            </div>
            <div className={styles.confirmationCard}>
              <span>Buyer</span>
              <strong>{context.existingOrder.buyerName || 'Submitted'}</strong>
            </div>
            <div className={styles.confirmationCard}>
              <span>Reference</span>
              <strong>{context.existingOrder.id.slice(0, 8)}</strong>
            </div>
          </div>
        </section>
      ) : (
        <main className={styles.main}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Choose your package</h2>
                <p>Prepared package cards keep the album purchase within the studio&apos;s guardrails.</p>
              </div>
            </div>
            {context.offers.length === 0 ? (
              <div className={styles.emptyState}>No package offers are available for this proof yet.</div>
            ) : (
              <div className={styles.offerGrid}>
                {context.offers.map((offer) => {
                  const optionalCount = offer.items.filter((item) => item.isOptional).length;
                  const isActive = offer.id === selectedOfferId;
                  return (
                    <button
                      key={offer.id}
                      type="button"
                      className={`${styles.offerCard} ${isActive ? styles.offerCardActive : ''}`}
                      onClick={() => setSelectedOfferId(offer.id)}
                    >
                      <div className={styles.offerHeader}>
                        <h3>{offer.title}</h3>
                        <span>{formatMoney(offer.totalCents, offer.currency)}</span>
                      </div>
                      {offer.notes ? <p>{offer.notes}</p> : null}
                      <div className={styles.offerMeta}>
                        <span>{offer.items.filter((item) => !item.isOptional).length} included lines</span>
                        <span>{optionalCount} optional add-ons</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedOffer ? (
              <div className={styles.selectionBlock}>
                <div className={styles.panelHeader}>
                  <div>
                    <h2>Optional add-ons</h2>
                    <p>Only the prepared extras below can be added during checkout.</p>
                  </div>
                </div>
                {selectedOffer.items.some((item) => item.isOptional) ? (
                  <div className={styles.addonList}>
                    {selectedOffer.items
                      .filter((item) => item.isOptional)
                      .map((item) => {
                        const isChecked = selectedAddonIds.includes(item.id);
                        return (
                          <label key={item.id} className={styles.addonRow}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(event) =>
                                setSelectedAddonIds((current) =>
                                  event.target.checked
                                    ? [...current, item.id]
                                    : current.filter((entry) => entry !== item.id)
                                )
                              }
                            />
                            <div>
                              <strong>{item.title}</strong>
                              {item.description ? <p>{item.description}</p> : null}
                            </div>
                            <span>{formatMoney(item.lineTotalCents, selectedOffer.currency)}</span>
                          </label>
                        );
                      })}
                  </div>
                ) : (
                  <div className={styles.emptyState}>This package does not include optional add-ons.</div>
                )}
              </div>
            ) : null}
          </section>

          <aside className={styles.sidebar}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2>Order summary</h2>
                  <p>Your selected package and add-ons will be sent to the studio for manual payment.</p>
                </div>
              </div>
              {selectedOffer ? (
                <>
                  <div className={styles.summaryList}>
                    {selectedItems.map((item) => (
                      <div key={item.id} className={styles.summaryRow}>
                        <div>
                          <strong>{item.title}</strong>
                          {item.description ? <p>{item.description}</p> : null}
                        </div>
                        <span>{formatMoney(item.lineTotalCents, selectedOffer.currency)}</span>
                      </div>
                    ))}
                  </div>
                  <div className={styles.totalRow}>
                    <span>Total</span>
                    <strong>{formatMoney(orderTotal, selectedOffer.currency)}</strong>
                  </div>
                </>
              ) : (
                <div className={styles.emptyState}>Select a package to build your checkout summary.</div>
              )}
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2>Buyer details</h2>
                  <p>Shipping and contact details go straight to the studio&apos;s order ops view.</p>
                </div>
              </div>
              <div className={styles.fieldGrid}>
                <label className={styles.field}>
                  <span>Buyer name</span>
                  <input value={buyerName} onChange={(event) => setBuyerName(event.target.value)} />
                </label>
                <label className={styles.field}>
                  <span>Buyer email</span>
                  <input value={buyerEmail} onChange={(event) => setBuyerEmail(event.target.value)} />
                </label>
                <label className={styles.field}>
                  <span>Buyer phone</span>
                  <input value={buyerPhone} onChange={(event) => setBuyerPhone(event.target.value)} />
                </label>
                <label className={styles.field}>
                  <span>Shipping name</span>
                  <input value={shippingName} onChange={(event) => setShippingName(event.target.value)} />
                </label>
                <label className={styles.fieldWide}>
                  <span>Address line 1</span>
                  <input
                    value={shippingAddressLine1}
                    onChange={(event) => setShippingAddressLine1(event.target.value)}
                  />
                </label>
                <label className={styles.fieldWide}>
                  <span>Address line 2</span>
                  <input
                    value={shippingAddressLine2}
                    onChange={(event) => setShippingAddressLine2(event.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span>City</span>
                  <input value={shippingCity} onChange={(event) => setShippingCity(event.target.value)} />
                </label>
                <label className={styles.field}>
                  <span>State</span>
                  <input value={shippingState} onChange={(event) => setShippingState(event.target.value)} />
                </label>
                <label className={styles.field}>
                  <span>Postal code</span>
                  <input
                    value={shippingPostalCode}
                    onChange={(event) => setShippingPostalCode(event.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span>Country</span>
                  <input value={shippingCountry} onChange={(event) => setShippingCountry(event.target.value)} />
                </label>
                <label className={styles.fieldWide}>
                  <span>Note for the studio</span>
                  <textarea value={clientNote} onChange={(event) => setClientNote(event.target.value)} />
                </label>
              </div>
              {feedback ? <div className={styles.feedback}>{feedback}</div> : null}
              <button
                className={styles.submitButton}
                type="button"
                disabled={
                  isSubmitting ||
                  !selectedOffer ||
                  !buyerName ||
                  !buyerEmail ||
                  !shippingAddressLine1 ||
                  !shippingCity ||
                  !shippingState ||
                  !shippingPostalCode ||
                  !shippingCountry
                }
                onClick={handleSubmit}
              >
                {isSubmitting ? 'Submitting…' : 'Submit checkout'}
              </button>
            </section>
          </aside>
        </main>
      )}
    </div>
  );
}
