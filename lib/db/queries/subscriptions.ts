import { eq } from 'drizzle-orm';
import { db } from '../drizzle';
import { users } from '../schema';

// ─────────────────────────────────────────────
// STRIPE (PER-USER BILLING)
// ─────────────────────────────────────────────

export async function getUserByStripeCustomerId(customerId: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);

  return result[0] ?? null;
}

export async function updateUserSubscription(
  userId: number,
  subscriptionData: {
    stripeSubscriptionId: string | null;
    stripeProductId: string | null;
    planName: string | null;
    subscriptionStatus: string;
  }
) {
  await db
    .update(users)
    .set({
      ...subscriptionData,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}
