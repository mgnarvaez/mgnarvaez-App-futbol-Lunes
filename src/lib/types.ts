export type Sede = "CANTON" | "SM" | "PUERTOS" | "PUERTOS 2";

export const SEDES: Sede[] = ["CANTON", "SM", "PUERTOS", "PUERTOS 2"];

export const SEDE_LABELS: Record<Sede, string> = {
  CANTON: "El Cantón",
  SM: "San Matías",
  PUERTOS: "Puertos",
  "PUERTOS 2": "Puertos 2 (Lluvia)",
};

export type EstadoPago = "AL_DÍA" | "DEBE";

export interface Jugador {
  id: string;
  nombre: string;
  apodo: string;
  email: string;
  puesto: string;
  estadoPago: EstadoPago;
  vip: boolean;
}

export interface Inscripcion {
  id: string;
  jugadorId: string;
  sede: Sede;
  flexible: boolean;
  juegaConLluvia: boolean;
  timestamp: string;
}

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

export interface Convocatoria {
  sede: Sede;
  fecha: string;
  convocados: InscripcionLocal[];
  suplentes: InscripcionLocal[];
  comentarios?: string;
}
