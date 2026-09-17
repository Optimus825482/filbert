"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";

export function ConfirmDialog({
  open, onOpenChange, title, description, confirmLabel = "Onayla", cancelLabel = "İptal", destructive = false, onConfirm,
}: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string;
  confirmLabel?: string; cancelLabel?: string; destructive?: boolean; onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {destructive && <AlertTriangle className="h-5 w-5 text-red-400" />}
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className="saha-btn border border-slate-600 bg-slate-800 px-4 text-white">{cancelLabel}</button>
          <button type="button" onClick={() => { onOpenChange(false); onConfirm(); }} className={`saha-btn px-4 ${destructive ? "bg-red-700 text-white" : "bg-filbert-600 text-white"}`}>{confirmLabel}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useConfirm() {
  const [state, setState] = useState<{ resolve: (v: boolean) => void; title: string; description: string; destructive: boolean } | null>(null);
  const confirm = (title: string, description: string, destructive = false): Promise<boolean> =>
    new Promise((resolve) => setState({ resolve, title, description, destructive }));
  const handleClose = (result: boolean) => { state?.resolve(result); setState(null); };
  const dialog = state ? (
    <ConfirmDialog open onOpenChange={(o) => !o && handleClose(false)} title={state.title} description={state.description} destructive={state.destructive} onConfirm={() => handleClose(true)} confirmLabel={state.destructive ? "Evet, Devam Et" : "Tamam"} cancelLabel="Vazgeç" />
  ) : null;
  return { confirm, dialog };
}