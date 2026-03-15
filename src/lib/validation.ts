import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const signUpSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  fullName: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be under 100 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Name contains invalid characters'),
})

export const profileUpdateSchema = z.object({
  full_name: z
    .string()
    .max(100, 'Name must be under 100 characters')
    .nullable()
    .optional(),
  username: z
    .string()
    .max(30, 'Username must be under 30 characters')
    .regex(/^[a-zA-Z0-9_]*$/, 'Username can only contain letters, numbers, and underscores')
    .nullable()
    .optional(),
  native_language: z.string().min(1).max(50).optional(),
  daily_goal_xp: z.number().int().min(10).max(500).optional(),
})

export const chatMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message is too long (max 2000 characters)'),
})

export const writingSubmissionSchema = z.object({
  content: z
    .string()
    .min(10, 'Please write at least a few sentences')
    .max(5000, 'Submission is too long (max 5000 characters)'),
  language: z.string().min(1).max(50),
  prompt: z.string().min(1).max(1000),
})

export const onboardingSchema = z.object({
  target_language: z.string().min(1, 'Please select a language'),
  daily_goal_xp: z.number().int().min(10).max(500),
})

export type LoginInput = z.infer<typeof loginSchema>
export type SignUpInput = z.infer<typeof signUpSchema>
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>
export type ChatMessageInput = z.infer<typeof chatMessageSchema>
export type WritingSubmissionInput = z.infer<typeof writingSubmissionSchema>
export type OnboardingInput = z.infer<typeof onboardingSchema>
