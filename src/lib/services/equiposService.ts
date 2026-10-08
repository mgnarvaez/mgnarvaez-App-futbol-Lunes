import type { InscripcionLocal } from "@/lib/types";

export interface EquiposPartido {
  blancos: InscripcionLocal[];
  negros: InscripcionLocal[];
}

export function dividirEnEquipos(convocados: InscripcionLocal[]): EquiposPartido {
  const blancos: InscripcionLocal[] = [];
  const negros: InscripcionLocal[] = [];

  // Distribución alternada para armar equipos equilibrados
  convocados.forEach((jugador, index) => {
    if (index % 2 === 0) {
      blancos.push(jugador);
    } else {
      negros.push(jugador);
    }
  });

  return { blancos, negros };
}
