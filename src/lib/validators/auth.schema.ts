import { z } from "zod";

export const loginSchema = z.object({
  // Email or E.164 mobile number — patients may have signed up with
  // either; staff always uses email. Left as a loose non-empty string
  // rather than a strict email/phone format check, since the real
  // validation happens server-side against whichever channel Cognito has
  // on file.
  username: z.string().min(1, "Please enter your email or mobile number"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().optional(),
  role: z.enum(["patient", "doctor", "clinical_assistant"]),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
