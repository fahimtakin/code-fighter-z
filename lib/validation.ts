import { z } from 'zod';

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, _ and -');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  // bcrypt silently ignores everything after 72 bytes, so reject longer passwords outright.
  .refine((p) => new TextEncoder().encode(p).length <= 72, 'Password must be at most 72 bytes');

export const signupSchema = z.object({ username: usernameSchema, password: passwordSchema });

// Login doesn't re-check the signup rules: it only needs to be bounded.
export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Enter your username').max(20),
  password: z.string().min(1, 'Enter your password').max(200),
});

export const matchIdSchema = z.uuid('Invalid match id');

export const submissionSchema = z.object({
  code: z.string().min(1, 'Write some code first').max(20_000, 'Code is too long (20,000 characters max)'),
  mode: z.enum(['run', 'submit']),
});
