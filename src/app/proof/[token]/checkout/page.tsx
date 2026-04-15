import CheckoutExperience from './CheckoutExperience';
import { loadPublicCheckoutContext } from '../checkout-data';
import styles from './checkout.module.css';

export default async function ProofCheckoutPage(props: PageProps<'/proof/[token]/checkout'>) {
  const { token } = await props.params;
  const checkout = await loadPublicCheckoutContext(token);

  if (!checkout) {
    return (
      <div className={styles.centerState}>
        Checkout is not available for this proof yet. The album must be approved and the studio must
        publish at least one package offer first.
      </div>
    );
  }

  return <CheckoutExperience initialContext={checkout} />;
}
