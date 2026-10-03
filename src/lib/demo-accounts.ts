/**
 * Demo credentials shown on the auth screens when Supabase is not configured.
 * Kept in one place so it can be deleted when the real backend is wired up.
 */
export const DEMO_ACCOUNTS = {
  password: 'password123',
  users: [
    { email: 'arkarmin@pms.dev', role: 'Owner · NextStep' },
    { email: 'min@pms.dev', role: 'Admin · NextStep' },
    { email: 'dana@pms.dev', role: 'Manager · NextStep' },
    { email: 'joe@pms.dev', role: 'Member · NextStep' },
    { email: 'sam@pms.dev', role: 'Viewer · NextStep' },
  ],
} as const