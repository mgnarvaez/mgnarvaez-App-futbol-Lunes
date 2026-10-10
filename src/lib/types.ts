export type Sede = "CANTON" | "PUERTOS" | "SM" | "PUERTOS 2";

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

export interface Inscripcion extends InscripcionLocal {}

export interface Jugador {
  id: string;
  nombre: string;
  apodo: string;
  email: string;
  emailAlternativo?: string;
  telefono?: string;
  barrio?: string;
  lote?: string;
  puesto?: string;
  estadoPago: EstadoPago;
  vip: boolean;
}

export interface Convocatoria {
  sede: Sede;
  titulares: InscripcionLocal[];
  suplentes: InscripcionLocal[];
}

export const SEDES: Sede[] = ["CANTON", "PUERTOS", "SM", "PUERTOS 2"];

export const SEDE_LABELS: Record<Sede, string> = {
  CANTON: "📍 Cantón (20 hs)",
  PUERTOS: "📍 Puertos (21:15 hs)",
  SM: "📍 San Matías (20 hs)",
  "PUERTOS 2": "📍 Puertos 2 (21:15 hs)",
};
