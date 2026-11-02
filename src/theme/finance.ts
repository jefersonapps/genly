const transactionColors = {
  income: {
    dark: { background: '#152A21', border: '#2C5C43', text: '#4ADE80' },
    light: { background: '#F0FDF4', border: '#BBF7D0', text: '#15803D' },
  },
  expense: {
    dark: { background: '#2D191D', border: '#653039', text: '#F87171' },
    light: { background: '#FEF2F2', border: '#FECACA', text: '#B91C1C' },
  },
} as const;

export function getTransactionColors(type: 'income' | 'expense', isDark: boolean) {
  return transactionColors[type][isDark ? 'dark' : 'light'];
}
