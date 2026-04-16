import { ImageUp } from 'lucide-react'
import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react'

import {
  ACCEPTED_IMAGE_EXTENSIONS_LABEL,
  ACCEPTED_IMAGE_MIME_TYPES,
  MAX_IMAGE_SIZE_MB,
} from '@/constants/app.constants'
import { cn } from '@/lib/cn'

type FileDropzoneProps = {
  disabled?: boolean
  selectedFile: File | null
  onFileSelected: (file: File) => void
  onValidationError: (message: string) => void
}

const maxImageSizeInBytes = MAX_IMAGE_SIZE_MB * 1024 * 1024

const getValidationError = (file: File): string | null => {
  if (!ACCEPTED_IMAGE_MIME_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_MIME_TYPES)[number])) {
    return `Unsupported file type. Use ${ACCEPTED_IMAGE_EXTENSIONS_LABEL}.`
  }

  if (file.size > maxImageSizeInBytes) {
    return `File is too large. Maximum size is ${MAX_IMAGE_SIZE_MB} MB.`
  }

  return null
}

export const FileDropzone = ({
  disabled = false,
  selectedFile,
  onFileSelected,
  onValidationError,
}: FileDropzoneProps) => {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFile = (candidateFile: File | null) => {
    if (!candidateFile) {
      return
    }

    const validationError = getValidationError(candidateFile)
    if (validationError) {
      onValidationError(validationError)
      return
    }

    onFileSelected(candidateFile)
  }

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFile(event.target.files?.[0] ?? null)
    event.target.value = ''
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragOver(false)
    handleFile(event.dataTransfer.files?.[0] ?? null)
  }

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()

    if (!disabled && !isDragOver) {
      setIsDragOver(true)
    }
  }

  const onDragLeave = () => {
    setIsDragOver(false)
  }

  return (
    <div className="space-y-3">
      <label htmlFor={id} className="sr-only">
        Upload image
      </label>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={ACCEPTED_IMAGE_MIME_TYPES.join(',')}
        className="hidden"
        disabled={disabled}
        onChange={onInputChange}
      />

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
        className={cn(
          'rounded-2xl border-2 border-dashed bg-[var(--color-bg-muted)] px-5 py-8 text-center transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-elevated)]',
          isDragOver
            ? 'border-[var(--color-border-accent)] bg-[var(--color-bg-overlay)]'
            : 'border-[var(--color-border-default)]',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-bg-elevated)] text-[var(--color-text-accent)] shadow-[var(--shadow-soft)]">
          <ImageUp size={20} />
        </div>
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
          Drop image here or click to browse
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          {ACCEPTED_IMAGE_EXTENSIONS_LABEL} up to {MAX_IMAGE_SIZE_MB} MB
        </p>
      </div>

      {selectedFile ? (
        <p className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">
          Selected: <span className="font-medium">{selectedFile.name}</span>
        </p>
      ) : null}
    </div>
  )
}
