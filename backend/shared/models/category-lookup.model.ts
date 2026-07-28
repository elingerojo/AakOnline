/**
 * Category name lookup table.
 * Provides a human-readable name for each categoryId.
 */
export const CATEGORY_NAMES: Record<number, string> = {
  1: 'Salas',
  2: 'Comedores',
  3: 'Recibidores',
  4: 'Sillones',
  5: 'Mecedoras',
  6: 'Sillas',
  7: 'Columpios',
  8: 'Pantallas',
  9: 'Marcos',
  10: 'Accesorios',
};

export function getCategoryName(id: number): string {
  return CATEGORY_NAMES[id] ?? `Categoria ${id}`;
}
