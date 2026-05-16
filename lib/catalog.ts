export const CATEGORY_LABELS = {
  beef: "Res",
  pork: "Cerdo",
  poultry: "Pollo",
  other: "Otros",
} as const;

export const UNIT_LABELS = {
  kg: "Kilogramos",
  unit: "Unidades",
} as const;

export const ORIGIN_LABELS = {
  from_processing: "Sale de desposte",
  direct_purchase: "Compra directa",
} as const;

export type Category = keyof typeof CATEGORY_LABELS;
export type Unit = keyof typeof UNIT_LABELS;
export type Origin = keyof typeof ORIGIN_LABELS;

export const CATEGORY_ORDER: Category[] = ["beef", "pork", "poultry", "other"];

export type Provider = {
  id: string;
  name: string;
  phone: string | null;
  active: boolean;
};

export type Product = {
  id: string;
  name: string;
  category: Category;
  unit: Unit;
  origin: Origin;
  pos_code: string | null;
  active: boolean;
};
