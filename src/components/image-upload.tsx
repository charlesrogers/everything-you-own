"use client"

import { useState, useRef, useCallback } from "react"
import { Upload, X, ImageIcon } from "lucide-react"
import { processProductImage } from "@/lib/image-utils"

interface ImageUploadProps {
  value?: string
  onChange: (dataUrl: string | undefined, thumbUrl?: string) => void
}

export function ImageUpload({ value, onChange }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return
      setIsProcessing(true)
      try {
        const { full, thumb } = await processProductImage(file)
        onChange(full, thumb)
      } catch (err) {
        console.error("Image processing failed:", err)
      } finally {
        setIsProcessing(false)
      }
    },
    [onChange]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative rounded-xl border overflow-hidden bg-muted">
          <img src={value} alt="Product" className="w-full aspect-square object-cover" />
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="absolute top-2 right-2 size-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/50"
          }`}
        >
          {isProcessing ? (
            <div className="text-[13px] text-muted-foreground">Processing...</div>
          ) : (
            <>
              <div className="size-10 rounded-full bg-muted flex items-center justify-center">
                {isDragging ? (
                  <ImageIcon className="size-5 text-primary" />
                ) : (
                  <Upload className="size-5 text-muted-foreground" />
                )}
              </div>
              <div className="text-center">
                <p className="text-[13px] font-medium">Drop an image or click to upload</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">JPEG, PNG, or WebP</p>
              </div>
            </>
          )}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
    </div>
  )
}
