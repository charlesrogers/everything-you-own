"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useStore } from "@/hooks/use-store"

export default function ScanRedirectPage() {
  const params = useParams()
  const router = useRouter()
  const store = useStore()
  const shortId = params.shortId as string
  const [error, setError] = useState(false)

  useEffect(() => {
    store.getLocationByShortId(shortId).then((loc) => {
      if (loc) {
        router.replace(`/storage/${loc.id}`)
      } else {
        setError(true)
      }
    })
  }, [shortId, router])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h1 className="text-[20px] font-bold mb-2">Location Not Found</h1>
        <p className="text-[13px] text-muted-foreground">
          The scanned code &quot;{shortId}&quot; doesn&apos;t match any storage location.
        </p>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center py-24 text-muted-foreground text-[13px]">
      Looking up location...
    </div>
  )
}
