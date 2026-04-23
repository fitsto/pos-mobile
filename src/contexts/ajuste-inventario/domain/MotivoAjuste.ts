export const MotivoAjuste = {
  CORRECCION: 'CORRECCION',
  MERMA: 'MERMA',
  CONTEO_FISICO: 'CONTEO_FISICO',
  STOCK_INICIAL: 'STOCK_INICIAL',
  ROBO: 'ROBO',
  REGALO: 'REGALO',
  SORTEO: 'SORTEO',
  ROTURA: 'ROTURA',
  VENCIMIENTO: 'VENCIMIENTO',
  DEVOLUCION_CLIENTE: 'DEVOLUCION_CLIENTE',
  OTRO: 'OTRO',
} as const;
export type MotivoAjuste = (typeof MotivoAjuste)[keyof typeof MotivoAjuste];

export const MOTIVOS_AJUSTE: MotivoAjuste[] = Object.values(MotivoAjuste);

export const etiquetaMotivo: Record<MotivoAjuste, string> = {
  CORRECCION: 'Corrección',
  MERMA: 'Merma',
  CONTEO_FISICO: 'Conteo físico',
  STOCK_INICIAL: 'Stock inicial',
  ROBO: 'Robo',
  REGALO: 'Regalo',
  SORTEO: 'Sorteo',
  ROTURA: 'Rotura',
  VENCIMIENTO: 'Vencimiento',
  DEVOLUCION_CLIENTE: 'Devolución cliente',
  OTRO: 'Otro',
};
