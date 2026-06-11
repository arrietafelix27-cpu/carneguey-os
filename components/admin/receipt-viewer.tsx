"use client";

import { useState } from "react";
import { Camera, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ReceiptViewer({ urls }: { urls: string[] }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (urls.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm text-muted-foreground">
        <Camera className="size-4" />
        Sin foto del comprobante
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {urls.map((url, i) => (
          <button
            key={i}
            onClick={() => setSelectedIndex(i)}
            className="relative aspect-square overflow-hidden rounded-2xl bg-secondary transition-transform active:scale-[0.97]"
            aria-label={`Ver comprobante ${i + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Comprobante ${i + 1}`}
              className="size-full object-cover"
            />
          </button>
        ))}
      </div>

      <Dialog
        open={selectedIndex !== null}
        onOpenChange={(o) => {
          if (!o) setSelectedIndex(null);
        }}
      >
        <DialogContent className="max-w-4xl gap-0 overflow-hidden p-0">
          <DialogHeader className="flex flex-row items-center justify-between border-b border-border px-4 py-3">
            <DialogTitle className="text-sm">
              Comprobante{" "}
              {selectedIndex !== null ? `${selectedIndex + 1} de ${urls.length}` : ""}
            </DialogTitle>
            <button
              onClick={() => setSelectedIndex(null)}
              aria-label="Cerrar"
              className="text-muted-foreground"
            >
              <X className="size-4" />
            </button>
          </DialogHeader>
          {selectedIndex !== null && (
            <div className="grid place-items-center bg-black/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={urls[selectedIndex]}
                alt="Comprobante en pantalla completa"
                className="max-h-[80vh] w-full object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
