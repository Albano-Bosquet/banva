/** Plantillas de hoja de cálculo originales (tablas con fórmulas). */
export interface SheetTemplate {
  id: string;
  label: string;
  description: string;
  accent: string;
  cells: string[][];
  colWidths?: number[];
}

export const SHEET_TEMPLATES: SheetTemplate[] = [
  {
    id: 'budget',
    label: 'Presupuesto mensual',
    description: 'Ingresos, gastos y saldo con fórmulas',
    accent: '#2bb3a3',
    colWidths: [2, 1],
    cells: [
      ['Concepto', 'Monto'],
      ['Sueldo', '850000'],
      ['Extras', '120000'],
      ['Alquiler', '-320000'],
      ['Comida', '-210000'],
      ['Transporte', '-60000'],
      ['Saldo', '=SUMA(B2:B6)'],
    ],
  },
  {
    id: 'expenses',
    label: 'Gastos compartidos',
    description: 'Total y parte de cada persona',
    accent: '#ff6b4a',
    colWidths: [2, 1, 1],
    cells: [
      ['Gasto', 'Ana', 'Leo'],
      ['Súper', '18500', '9200'],
      ['Nafta', '0', '24000'],
      ['Cena', '15600', '15600'],
      ['Total', '=SUMA(B2:B4)', '=SUMA(C2:C4)'],
      ['Promedio', '=PROMEDIO(B2:C4)', '=(B5+C5)/2'],
    ],
  },
  {
    id: 'contacts',
    label: 'Lista de contactos',
    description: 'Nombre, correo y estado',
    accent: '#5b6cff',
    colWidths: [1.4, 2, 1],
    cells: [
      ['Nombre', 'Correo', 'Estado'],
      ['Ana Ruiz', 'ana@ejemplo.com', 'Activo'],
      ['Leo Paz', 'leo@ejemplo.com', 'Pendiente'],
      ['Mía Sol', 'mia@ejemplo.com', 'Activo'],
    ],
  },
  {
    id: 'inventory',
    label: 'Inventario',
    description: 'Stock, precio y valor total',
    accent: '#8a5cff',
    colWidths: [2, 1, 1, 1.2],
    cells: [
      ['Producto', 'Stock', 'Precio', 'Valor'],
      ['Tazas', '24', '3500', '=B2*C2'],
      ['Remeras', '12', '9800', '=B3*C3'],
      ['Stickers', '150', '400', '=B4*C4'],
      ['Total', '=SUMA(B2:B4)', '', '=SUMA(D2:D4)'],
    ],
  },
  {
    id: 'schedule',
    label: 'Horario semanal',
    description: 'Grilla de días y franjas',
    accent: '#ffc145',
    cells: [
      ['Hora', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie'],
      ['9:00', 'Equipo', '', 'Equipo', '', 'Equipo'],
      ['11:00', '', 'Clientes', '', 'Clientes', ''],
      ['14:00', 'Diseño', 'Diseño', 'Diseño', 'Diseño', 'Revisión'],
    ],
  },
  {
    id: 'blank',
    label: 'Hoja en blanco',
    description: '5 × 4 celdas para empezar',
    accent: '#4a5263',
    cells: [
      ['A', 'B', 'C', 'D'],
      ['', '', '', ''],
      ['', '', '', ''],
      ['', '', '', ''],
      ['', '', '', ''],
    ],
  },
];
