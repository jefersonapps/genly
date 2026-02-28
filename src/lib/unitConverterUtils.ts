export type Category = 
  | "Comprimento" 
  | "Peso" 
  | "Temperatura" 
  | "Tempo" 
  | "Armazenamento" 
  | "Taxa de Transferência" 
  | "Moedas";

export const CATEGORIES: Category[] = [
  "Comprimento",
  "Peso",
  "Temperatura",
  "Tempo",
  "Armazenamento",
  "Taxa de Transferência",
  "Moedas"
];

export type UnitDefinition = {
  id: string;
  name: string;
  symbol: string;
  factor?: number; // Multiply by this to get the base unit
};

export const UNITS: Record<Category, UnitDefinition[]> = {
  "Comprimento": [
    { id: "mm", name: "Milímetro", symbol: "mm", factor: 0.001 },
    { id: "cm", name: "Centímetro", symbol: "cm", factor: 0.01 },
    { id: "m", name: "Metro", symbol: "m", factor: 1 },
    { id: "km", name: "Quilômetro", symbol: "km", factor: 1000 },
    { id: "in", name: "Polegada", symbol: "in", factor: 0.0254 },
    { id: "ft", name: "Pé", symbol: "ft", factor: 0.3048 },
    { id: "yd", name: "Jarda", symbol: "yd", factor: 0.9144 },
    { id: "mi", name: "Milha", symbol: "mi", factor: 1609.344 },
  ],
  "Peso": [
    { id: "mg", name: "Miligrama", symbol: "mg", factor: 0.001 },
    { id: "g", name: "Grama", symbol: "g", factor: 1 },
    { id: "kg", name: "Quilograma", symbol: "kg", factor: 1000 },
    { id: "oz", name: "Onça", symbol: "oz", factor: 28.34952 },
    { id: "lb", name: "Libra", symbol: "lb", factor: 453.59237 },
  ],
  "Temperatura": [
    { id: "c", name: "Graus Celsius", symbol: "°C" },
    { id: "f", name: "Graus Fahrenheit", symbol: "°F" },
    { id: "k", name: "Kelvin", symbol: "K" },
  ],
  "Tempo": [
    { id: "ms", name: "Milissegundo", symbol: "ms", factor: 0.001 },
    { id: "s", name: "Segundo", symbol: "s", factor: 1 },
    { id: "min", name: "Minuto", symbol: "min", factor: 60 },
    { id: "h", name: "Hora", symbol: "h", factor: 3600 },
    { id: "d", name: "Dia", symbol: "d", factor: 86400 },
    { id: "wk", name: "Semana", symbol: "wk", factor: 604800 },
    { id: "mo", name: "Mês (30 dias)", symbol: "mo", factor: 2592000 },
    { id: "yr", name: "Ano (365 dias)", symbol: "yr", factor: 31536000 },
  ],
  "Armazenamento": [
    { id: "b", name: "Byte", symbol: "B", factor: 1 },
    { id: "kb", name: "Kilobyte", symbol: "KB", factor: 1024 },
    { id: "mb", name: "Megabyte", symbol: "MB", factor: 1024 * 1024 },
    { id: "gb", name: "Gigabyte", symbol: "GB", factor: 1024 * 1024 * 1024 },
    { id: "tb", name: "Terabyte", symbol: "TB", factor: 1024 * 1024 * 1024 * 1024 },
  ],
  "Taxa de Transferência": [
    { id: "bps", name: "Bits por segundo", symbol: "bps", factor: 1 },
    { id: "kbps", name: "Kilobits por segundo", symbol: "Kbps", factor: 1000 },
    { id: "mbps", name: "Megabits por segundo", symbol: "Mbps", factor: 1000000 },
    { id: "gbps", name: "Gigabits por segundo", symbol: "Gbps", factor: 1000000000 },
    { id: "Bps", name: "Bytes por segundo", symbol: "B/s", factor: 8 },
    { id: "KBps", name: "Kilobytes por segundo", symbol: "KB/s", factor: 8000 },
    { id: "MBps", name: "Megabytes por segundo", symbol: "MB/s", factor: 8000000 },
  ],
  "Moedas": [
    // We use USD as base 1 factor natively here as fallback, though API rates will override
    { id: "USD", name: "Dólar Americano", symbol: "$" },
    { id: "BRL", name: "Real Brasileiro", symbol: "R$" },
    { id: "EUR", name: "Euro", symbol: "€" },
    { id: "GBP", name: "Libra Esterlina", symbol: "£" },
    { id: "JPY", name: "Iene Japonês", symbol: "¥" },
    { id: "CAD", name: "Dólar Canadense", symbol: "C$" },
    { id: "AUD", name: "Dólar Australiano", symbol: "A$" },
    { id: "CHF", name: "Franco Suíço", symbol: "Fr" },
    { id: "CNY", name: "Yuan Chinês", symbol: "¥" },
    { id: "ARS", name: "Peso Argentino", symbol: "$" },
  ]
};

export function convertUnit(value: number, fromId: string, toId: string, category: Category, rates?: Record<string, number>): number | null {
  if (value === undefined || value === null || isNaN(value)) return null;
  if (fromId === toId) return value;

  if (category === "Moedas") {
    if (!rates || !rates[fromId] || !rates[toId]) return null;
    // rates are relative to base USD
    const valueInBase = value / rates[fromId];
    return valueInBase * rates[toId];
  }

  if (category === "Temperatura") {
    let valueInCelsius = value;
    if (fromId === "f") valueInCelsius = (value - 32) * 5/9;
    if (fromId === "k") valueInCelsius = value - 273.15;

    if (toId === "c") return valueInCelsius;
    if (toId === "f") return (valueInCelsius * 9/5) + 32;
    if (toId === "k") return valueInCelsius + 273.15;
    return null;
  }

  const units = UNITS[category];
  const fromUnit = units.find(u => u.id === fromId);
  const toUnit = units.find(u => u.id === toId);

  if (!fromUnit?.factor || !toUnit?.factor) return null;

  const baseValue = value * fromUnit.factor;
  return baseValue / toUnit.factor;
}
