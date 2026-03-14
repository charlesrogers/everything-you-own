"use client"

import { useState, useRef } from "react"
import { Download, Upload, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { exportAllData, importAllData, clearAllData } from "@/lib/store"

export default function SettingsPage() {
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [importStatus, setImportStatus] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleExport() {
    const json = exportAllData()
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `everything-you-own-backup-${new Date().toISOString().split("T")[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        importAllData(ev.target?.result as string)
        setImportStatus("Data imported successfully. Refresh the page to see changes.")
      } catch {
        setImportStatus("Import failed. The file may be corrupted.")
      }
    }
    reader.readAsText(file)
  }

  function handleClear() {
    clearAllData()
    setShowClearDialog(false)
    window.location.reload()
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-[20px] font-bold mb-6">Settings</h1>

      <div className="space-y-6">
        {/* Data Management */}
        <div className="rounded-xl border bg-card p-4 space-y-4">
          <h2 className="text-[15px] font-semibold">Data Management</h2>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium">Export Data</p>
                <p className="text-[12px] text-muted-foreground">
                  Download all your products and categories as JSON.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="size-3.5" />
                Export
              </Button>
            </div>

            <div className="border-t" />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium">Import Data</p>
                <p className="text-[12px] text-muted-foreground">
                  Restore from a previously exported JSON file.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="size-3.5" />
                Import
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImport}
              />
            </div>

            {importStatus && (
              <p className="text-[12px] text-muted-foreground bg-muted/50 rounded-lg p-2">
                {importStatus}
              </p>
            )}

            <div className="border-t" />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-destructive">Clear All Data</p>
                <p className="text-[12px] text-muted-foreground">
                  Remove all products and categories. This cannot be undone.
                </p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setShowClearDialog(true)}>
                <Trash2 className="size-3.5" />
                Clear
              </Button>
            </div>
          </div>
        </div>

        {/* About */}
        <div className="rounded-xl border bg-card p-4 space-y-2">
          <h2 className="text-[15px] font-semibold">About</h2>
          <p className="text-[13px] text-muted-foreground">
            Everything You Own v0.1 — a personal product database for tracking purchases,
            wishlists, and collections. All data is stored locally in your browser.
          </p>
        </div>
      </div>

      {/* Clear Confirmation */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear All Data</DialogTitle>
            <DialogDescription>
              This will permanently delete all your products, categories, and settings.
              Consider exporting your data first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClear}>
              Clear Everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
