import { Toaster as Sonner, type ToasterProps } from 'sonner'

import { useTheme } from '@/hooks/use-theme'

function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme()

  return (
    <Sonner
      theme={resolvedTheme}
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            'group rounded-lg border bg-popover text-popover-foreground shadow-md text-sm gap-2.5',
          description: 'text-muted-foreground',
          actionButton: 'bg-primary text-primary-foreground rounded-md text-xs px-2 h-7',
          cancelButton: 'bg-muted text-muted-foreground rounded-md text-xs px-2 h-7',
          error: 'border-destructive/40',
          success: 'border-success/40',
        },
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
