import { WifiOff } from 'lucide-react'

import { isDemoMode } from '@/lib/client'

/**
 * Shown when a request to Supabase never leaves the machine.
 *
 * In practice this means DNS worked but the TCP connection was refused, which
 * is almost always a network issue (VPN, corporate DNS filter, blocked CDN
 * edge) rather than a problem with the project. Saying that plainly saves a long
 * debugging detour.
 */
export function NetworkHint({ host }: { host?: string | null }) {
  return (
    <div
      role="alert"
      className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm"
    >
      <p className="flex items-start gap-2 font-medium">
        <WifiOff className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
        Can't reach Supabase
      </p>
      <p className="text-muted-foreground">
        The request never left your machine, so this is a network problem — not a wrong project URL.
        Your DNS resolved fine.
      </p>
      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
        <li>
          Try a different network (a phone hotspot is the quickest check). Supabase projects sit behind
          a CDN whose IPs some networks block.
        </li>
        <li>
          If you use a VPN or corporate DNS, switch exit node or disable filtering for the session.
        </li>
        <li>
          In Chrome, open <code className="font-mono text-xs">chrome://settings/security</code> and turn{' '}
          <strong className="text-foreground">off</strong> “Use secure DNS” — Chrome's own resolver can
          fail where your OS resolver succeeds.
        </li>
        {host ? (
          <li>
            Verify the ref resolves: <code className="font-mono text-xs">dig {host}</code> should return
            an address rather than <code className="font-mono text-xs">NXDOMAIN</code>.
          </li>
        ) : null}
      </ul>
      {isDemoMode ? null : (
        <p className="text-muted-foreground">
          Until it connects, you can keep working by removing the two{' '}
          <code className="font-mono text-xs">VITE_SUPABASE_*</code> values from{' '}
          <code className="font-mono text-xs">.env.local</code> and restarting — the app then runs
          against its in-memory backend.
        </p>
      )}
    </div>
  )
}
