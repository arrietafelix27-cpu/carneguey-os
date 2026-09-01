"use client";

import { MessageCircle } from "lucide-react";
import { formatCOP } from "@/lib/format";
import { BUSINESS_NAME } from "@/lib/config";

/**
 * Cobro por WhatsApp.
 *
 * En Colombia un carnicero no manda correos ni cartas de cobro: manda un
 * WhatsApp. Los teléfonos de los clientes ya estaban guardados y no se usaban
 * para nada.
 *
 * No manda nada solo: abre WhatsApp con el mensaje escrito para que el dueño
 * lo revise y decida si lo envía. Cobrarle a un cliente es una conversación
 * delicada — la app no debería hacerlo a sus espaldas.
 */

/** Deja el teléfono como lo espera WhatsApp: solo dígitos, con indicativo. */
function toWhatsAppNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return null;
  // Colombia: los celulares son 10 dígitos y empiezan por 3.
  if (digits.length === 10 && digits.startsWith("3")) return `57${digits}`;
  if (digits.startsWith("57") && digits.length >= 12) return digits;
  return digits;
}

export function WhatsAppReminder({
  name,
  phone,
  balance,
  className,
}: {
  name: string;
  phone: string | null;
  balance: number;
  className?: string;
}) {
  if (!phone || balance <= 0) return null;
  const number = toWhatsAppNumber(phone);
  if (!number) return null;

  const firstName = name.split(" ")[0];
  const message =
    `Hola ${firstName}, le escribo de ${BUSINESS_NAME}. ` +
    `Le recuerdo que tiene un saldo pendiente de ${formatCOP(balance)}. ` +
    `Cualquier cosa me avisa. ¡Gracias!`;

  return (
    <a
      href={`https://wa.me/${number}?text=${encodeURIComponent(message)}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-[12px] font-semibold text-success transition-opacity active:opacity-70 ${className ?? ""}`}
    >
      <MessageCircle className="size-3.5" strokeWidth={2.5} />
      Cobrar
    </a>
  );
}
