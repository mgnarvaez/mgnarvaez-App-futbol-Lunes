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
  telefono?: string;
  estado_pago: EstadoPago;
  fecha_inscripcion?: string;
  edad?: string;
  barrio?: string;
  puesto?: string;
}

export interface Inscripcion {
  id: string;
  jugador_id: string;
  convocatoria_id: string;
  sede_preferida: Sede | string;
  flexible: boolean;
  juega_con_lluvia: boolean;
  estado: "CONVOCADO" | "SUPLENTE" | "BAJA" | string;
  jugador?: Jugador;
  creado_en?: string;
}

export interface Convocatoria {
  id: string;
  fecha: string;
  estado: "PLANIFICADA" | "ABIERTA" | "CERRADA" | "CANCELADA" | string;
  suspension_lluvia: boolean;
  sedes_canceladas: Sede[] | string[];
}
