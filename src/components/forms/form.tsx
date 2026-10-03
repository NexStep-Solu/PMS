import { createContext, useContext, useId, type ReactNode } from 'react'
import { FormProvider, useFormContext } from 'react-hook-form'
import type { ChangeEventHandler, RefCallback } from 'react'

import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export const Form = FormProvider

interface FormFieldContextValue {
  name: string
  id: string
}

const FormFieldContext = createContext<FormFieldContextValue | null>(null)
const FormItemContext = createContext<{ id: string } | null>(null)

export interface FormControlProps {
  id: string
  name: string
  onChange: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>
  onBlur: (event: unknown) => void
  ref: RefCallback<HTMLInputElement | HTMLTextAreaElement>
  'aria-describedby'?: string
  'aria-invalid': boolean
}

/**
 * Wraps React Hook Form with consistent field wiring: the control receives
 * `name` / `onChange` / `onBlur` / `ref` from the form plus the accessibility
 * attributes it needs.
 *
 * ```tsx
 * <FormField name="title">
 *   <FormItem>
 *     <FormLabel>Title</FormLabel>
 *     <FormControl>{(props) => <Input {...props} />}</FormControl>
 *     <FormMessage />
 *   </FormItem>
 * </FormField>
 * ```
 */
export function useFormField() {
  const fieldContext = useContext(FormFieldContext)
  const itemContext = useContext(FormItemContext)
  const form = useFormContext()

  if (!fieldContext || !itemContext) {
    throw new Error('useFormField must be used inside <FormField> and <FormItem>')
  }

  const { id } = itemContext
  const fieldState = form.getFieldState(fieldContext.name, form.formState)

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-item`,
    formDescriptionId: `${id}-description`,
    formMessageId: `${id}-message`,
    ...fieldState,
    isInvalid: Boolean(fieldState.invalid),
  }
}

export function FormField({ name, children }: { name: string; children: ReactNode }) {
  const id = useId()
  return <FormFieldContext value={{ name, id }}>{children}</FormFieldContext>
}

export function FormItem({ children, className }: { children: ReactNode; className?: string }) {
  const id = useId()
  return (
    <FormItemContext value={{ id }}>
      <div className={cn('space-y-1.5', className)}>{children}</div>
    </FormItemContext>
  )
}

export function FormLabel({ children, className }: { children: ReactNode; className?: string }) {
  const { formItemId, isInvalid } = useFormField()
  return (
    <Label htmlFor={formItemId} className={className} data-invalid={isInvalid}>
      {children}
    </Label>
  )
}

export function FormControl({ children }: { children: (props: FormControlProps) => ReactNode }) {
  const { name, formItemId, formDescriptionId, formMessageId, isInvalid } = useFormField()
  const form = useFormContext()

  // `register` gives us the name/onChange/onBlur/ref triple the control needs.
  const field = form.register(name)

  return (
    <>
      {children({
        name: field.name,
        onChange: field.onChange as ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>,
        onBlur: field.onBlur as (event: unknown) => void,
        ref: field.ref as RefCallback<HTMLInputElement | HTMLTextAreaElement>,
        id: formItemId,
        'aria-describedby': [formDescriptionId, isInvalid ? formMessageId : null]
          .filter(Boolean)
          .join(' '),
        'aria-invalid': isInvalid,
      })}
    </>
  )
}

export function FormDescription({ children, className }: { children: ReactNode; className?: string }) {
  const { formDescriptionId } = useFormField()
  return (
    <p id={formDescriptionId} className={cn('text-xs text-muted-foreground', className)}>
      {children}
    </p>
  )
}

export function FormMessage({ className }: { className?: string }) {
  const { formMessageId, error } = useFormField()
  const message = typeof error?.message === 'string' ? error.message : undefined

  if (!message) return null

  return (
    <p id={formMessageId} role="alert" className={cn('text-xs font-medium text-destructive', className)}>
      {message}
    </p>
  )
}