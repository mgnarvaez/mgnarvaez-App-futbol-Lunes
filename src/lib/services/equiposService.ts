import type { InscripcionLocal } from "@/lib/types";

export interface EquiposPartido {
  blancos: InscripcionLocal[];
  negros: InscripcionLocal[];
  promedioBlancos: number;
  promedioNegros: number;
}

export function dividirEnEquipos(
  convocados: InscripcionLocal[],
  bdPuntajes: Record<string, number> = {} 
): EquiposPartido {
  
  // 1. Enriquecer jugadores con su puntaje (Si no existe en la BD, se asigna 5 por defecto)
  const jugadoresConPuntos = convocados.map(j => ({
    ...j,
    puntaje: bdPuntajes[j.email.toLowerCase().trim()] || 5
  }));

  // 2. Ordenar de mayor a menor nivel
  jugadoresConPuntos.sort((a, b) => b.puntaje - a.puntaje);

  const blancos: typeof jugadoresConPuntos = [];
  const negros: typeof jugadoresConPuntos = [];
  let sumaBlancos = 0;
  let sumaNegros = 0;

  // 3. Repartir equilibrando el peso total
  jugadoresConPuntos.forEach((jugador) => {
    if (sumaBlancos <= sumaNegros) {
      blancos.push(jugador);
      sumaBlancos += jugador.puntaje;
    } else {
      negros.push(jugador);
      sumaNegros += jugador.puntaje;
    }
  });

  const promedioBlancos = blancos.length > 0 ? (sumaBlancos / blancos.length) : 0;
  const promedioNegros = negros.length > 0 ? (sumaNegros / negros.length) : 0;

  return { 
    blancos, 
    negros,
    promedioBlancos: Number(promedioBlancos.toFixed(2)),
    promedioNegros: Number(promedioNegros.toFixed(2))
  };
}
