export type Sede = "CANTON" | "PUERTOS" | "SM" | "PUERTOS 2";

export const SEDES: Sede[] = ["CANTON", "PUERTOS", "SM", "PUERTOS 2"];

export const SEDE_LABELS: Record<Sede, string> = {
  CANTON: "📍 El Cantón (20:00 hs)",
  PUERTOS: "📍 Puertos (21:15 hs)",
  SM: "📍 San Matías (20:00 hs)",
  "PUERTOS 2": "📍 Puertos 2 (21:15 hs)",
};

export type EstadoPago = "AL_DÍA" | "DEBE";

export interface InscripcionLocal {
  id: string;
  apodo: string;
  email: string;
  sede: string;
  flexible: boolean;
  juegaConLluvia: boolean;
  vip: boolean;
  estadoPago: EstadoPago;
  fecha: string;
}

export interface Jugador {
  id: string;
  nombre: string;
  apodo?: string;
  email?: string;
  barrio?: string;
  lote?: string;
  puesto?: string;
  pago?: boolean;
}

export interface Inscripcion {
  id: string;
  jugadorId: string;
  sede: Sede;
  flexible: boolean;
  juegaConLluvia: boolean;
  timestamp: string;
}

export interface Convocatoria {
  sede: Sede;
  titulares: Jugador[];
  suplentes: Jugador[];
}
