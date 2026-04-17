import { cn } from '@/lib/cn'

export type SettingsSelectOption = {
  value: string
  label: string
  disabled?: boolean
}

type SettingsSelectProps = {
  id: string
  label: string
  value: string
  options: ReadonlyArray<SettingsSelectOption>
  disabled?: boolean
  helperText?: string
  className?: string
  onChange: (nextValue: string) => void
}

export const SettingsSelect = ({
  id,
  label,
  value,
  options,
  disabled = false,
  helperText,
  className,
  onChange,
}: SettingsSelectProps) => {
  return (
    <label className={cn('flex min-w-[220px] flex-col gap-1', className)} htmlFor={id}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
        {label}
      </span>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        className="h-10 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-3 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {helperText ? (
        <span className="text-xs leading-relaxed text-[var(--color-text-muted)]">{helperText}</span>
      ) : null}
    </label>
  )
}

type SettingsToggleProps = {
  id: string
  label: string
  checked: boolean
  disabled?: boolean
  helperText?: string
  className?: string
  onChange: (nextChecked: boolean) => void
}

export const SettingsToggle = ({
  id,
  label,
  checked,
  disabled = false,
  helperText,
  className,
  onChange,
}: SettingsToggleProps) => {
  return (
    <label className={cn('flex min-w-[220px] flex-col gap-1', className)} htmlFor={id}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
        {label}
      </span>
      <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-3 text-sm text-[var(--color-text-primary)]">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => {
            onChange(event.target.checked)
          }}
          className="h-4 w-4 accent-[var(--color-text-accent)]"
        />
        <span>{checked ? 'Enabled' : 'Disabled'}</span>
      </span>
      {helperText ? (
        <span className="text-xs leading-relaxed text-[var(--color-text-muted)]">{helperText}</span>
      ) : null}
    </label>
  )
}
