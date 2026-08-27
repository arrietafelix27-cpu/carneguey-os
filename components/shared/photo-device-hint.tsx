import { Smartphone } from "lucide-react";

/**
 * Aviso que solo se ve en computador, junto a los campos de foto.
 *
 * El computador del negocio normalmente no tiene cámara usable para fotografiar
 * un recibo de papel, así que la cajera puede llenar todo aquí y terminar desde
 * el celular. Antes estos flujos simplemente no aparecían en el menú del
 * computador, y eso la dejaba sin poder trabajar.
 */
export function PhotoDeviceHint({ required }: { required: boolean }) {
  return (
    <p className="hidden items-start gap-2 rounded-xl bg-secondary px-3 py-2 text-[13px] leading-snug text-secondary-foreground lg:flex">
      <Smartphone className="mt-0.5 size-4 shrink-0" />
      <span>
        {required
          ? "Desde el computador puedes elegir un archivo, pero para tomar la foto del comprobante es más fácil hacerlo desde el celular."
          : "La foto es opcional. Si la quieres tomar con la cámara, hazlo desde el celular."}
      </span>
    </p>
  );
}
