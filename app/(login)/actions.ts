'use server';

import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  users,
  companyMembers,
  type NewUser,
  type NewCompanyMember,
  ActivityType,
  invitations
} from '@/lib/db/schema';
import { logActivity } from '@/lib/db/activity';
import { comparePasswords, hashPassword, setSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createCheckoutSession } from '@/lib/payments/stripe';
import { getUser, getCompaniesForUser } from '@/lib/db/queries';
import {
  validatedAction,
  validatedActionWithUser,
} from '@/lib/auth/middleware';

async function getFirstCompanyId(userId: number): Promise<number | null> {
  const memberships = await getCompaniesForUser(userId);
  return memberships[0]?.company?.id ?? null;
}

const signInSchema = z.object({
  email: z.string().email().min(3).max(255),
  password: z.string().min(8).max(100)
});

export const signIn = validatedAction(signInSchema, async (data, formData) => {
  const { email, password } = data;

  const [foundUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!foundUser) {
    return {
      error: 'Invalid email or password. Please try again.',
      email,
      password
    };
  }

  const isPasswordValid = await comparePasswords(
    password,
    foundUser.passwordHash
  );

  if (!isPasswordValid) {
    return {
      error: 'Invalid email or password. Please try again.',
      email,
      password
    };
  }

  const companyId = await getFirstCompanyId(foundUser.id);

  await Promise.all([
    setSession(foundUser),
    logActivity(companyId, foundUser.id, ActivityType.SIGN_IN)
  ]);

  const rawRedirect = formData.get('redirect');
  const redirectTo = typeof rawRedirect === 'string' ? rawRedirect : null;
  if (redirectTo === 'checkout') {
    const rawPriceId = formData.get('priceId');
    if (typeof rawPriceId !== 'string') return { error: 'Missing price ID.' };
    await createCheckoutSession({ user: foundUser, priceId: rawPriceId });
    return {};
  }

  redirect('/dashboard');
});

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  inviteId: z.string().optional()
});

export const signUp = validatedAction(signUpSchema, async (data, formData) => {
  const { email, password, inviteId } = data;

  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser.length > 0) {
    return {
      error: 'Failed to create user. Please try again.',
      email,
      password
    };
  }

  const passwordHash = await hashPassword(password);

  let companyId: number | null = null;
  let memberRole: string = 'owner';

  if (inviteId) {
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.id, parseInt(inviteId)),
          eq(invitations.email, email),
          eq(invitations.status, 'pending')
        )
      )
      .limit(1);

    if (invitation) {
      companyId = invitation.companyId;
      memberRole = invitation.role;
    } else {
      return { error: 'Invalid or expired invitation.', email, password };
    }
  }

  const newUser: NewUser = {
    email,
    passwordHash,
  };

  const [createdUser] = await db.insert(users).values(newUser).returning();

  if (!createdUser) {
    return {
      error: 'Failed to create user. Please try again.',
      email,
      password
    };
  }

  if (inviteId && companyId) {
    await db
      .update(invitations)
      .set({ status: 'accepted' })
      .where(eq(invitations.id, parseInt(inviteId)));

    await logActivity(companyId, createdUser.id, ActivityType.ACCEPT_INVITATION);
  }
  // NOTE: Company creation on sign-up is removed.
  // Users now create companies explicitly via the "Create Company" flow.
  // If there's no invitation, the user signs up without a company.

  if (companyId) {
    const newMember: NewCompanyMember = {
      userId: createdUser.id,
      companyId,
      role: memberRole
    };

    await db.insert(companyMembers).values(newMember);
  }

  await Promise.all([
    logActivity(companyId, createdUser.id, ActivityType.SIGN_UP),
    setSession(createdUser)
  ]);

  const rawRedirect = formData.get('redirect');
  const redirectTo = typeof rawRedirect === 'string' ? rawRedirect : null;
  if (redirectTo === 'checkout') {
    const rawPriceId = formData.get('priceId');
    if (typeof rawPriceId !== 'string') return { error: 'Missing price ID.' };
    await createCheckoutSession({ user: createdUser, priceId: rawPriceId });
    return {};
  }

  redirect('/dashboard');
});

export async function signOut() {
  const user = await getUser();
  if (!user) {
    (await cookies()).delete('session');
    return;
  }
  const companyId = await getFirstCompanyId(user.id);
  await logActivity(companyId, user.id, ActivityType.SIGN_OUT);
  (await cookies()).delete('session');
}

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(100),
  newPassword: z.string().min(8).max(100),
  confirmPassword: z.string().min(8).max(100)
});

export const updatePassword = validatedActionWithUser(
  updatePasswordSchema,
  async (data, _, user) => {
    const { currentPassword, newPassword, confirmPassword } = data;

    const isPasswordValid = await comparePasswords(
      currentPassword,
      user.passwordHash
    );

    if (!isPasswordValid) {
      return {
        currentPassword,
        newPassword,
        confirmPassword,
        error: 'Current password is incorrect.'
      };
    }

    if (currentPassword === newPassword) {
      return {
        currentPassword,
        newPassword,
        confirmPassword,
        error: 'New password must be different from the current password.'
      };
    }

    if (confirmPassword !== newPassword) {
      return {
        currentPassword,
        newPassword,
        confirmPassword,
        error: 'New password and confirmation password do not match.'
      };
    }

    const newPasswordHash = await hashPassword(newPassword);
    const companyId = await getFirstCompanyId(user.id);

    await Promise.all([
      db
        .update(users)
        .set({ passwordHash: newPasswordHash })
        .where(eq(users.id, user.id)),
      logActivity(companyId, user.id, ActivityType.UPDATE_PASSWORD)
    ]);

    return {
      success: 'Password updated successfully.'
    };
  }
);

const deleteAccountSchema = z.object({
  password: z.string().min(8).max(100)
});

export const deleteAccount = validatedActionWithUser(
  deleteAccountSchema,
  async (data, _, user) => {
    const { password } = data;

    const isPasswordValid = await comparePasswords(password, user.passwordHash);
    if (!isPasswordValid) {
      return {
        password,
        error: 'Incorrect password. Account deletion failed.'
      };
    }

    const companyId = await getFirstCompanyId(user.id);

    await logActivity(
      companyId,
      user.id,
      ActivityType.DELETE_ACCOUNT
    );

    await db
      .update(users)
      .set({
        deletedAt: sql`CURRENT_TIMESTAMP`,
        email: sql`CONCAT(email, '-', id, '-deleted')`
      })
      .where(eq(users.id, user.id));

    // Remove from all companies
    await db
      .delete(companyMembers)
      .where(eq(companyMembers.userId, user.id));

    (await cookies()).delete('session');
    redirect('/sign-in');
  }
);

const updateAccountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address')
});

export const updateAccount = validatedActionWithUser(
  updateAccountSchema,
  async (data, _, user) => {
    const { name, email } = data;
    const companyId = await getFirstCompanyId(user.id);

    await Promise.all([
      db.update(users).set({ name, email }).where(eq(users.id, user.id)),
      logActivity(companyId, user.id, ActivityType.UPDATE_ACCOUNT)
    ]);

    return { name, success: 'Account updated successfully.' };
  }
);

// removeCompanyMember + inviteCompanyMember moved to
// `src/features/invoicing/actions.ts` (N5 — keep auth flows in (login),
// company-feature actions in the invoicing feature).
