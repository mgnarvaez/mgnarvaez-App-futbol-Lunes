import type { InscripcionLocal } from "@/App";

export interface SedeConvocatoria {
  nombre: string;
  capacidad: number;
  convocados: InscripcionLocal[];
  suplentes: InscripcionLocal[];
  activa: boolean;
  motivoSuspension?: string;
}

export function armarConvocatoriasPorSede(
  inscriptos: InscripcionLocal[],
  suspensionLluviaGeneral: boolean,
  sedesCanceladas: string[],
  canchaMojadaCanton: boolean,
  puertos10vs10: boolean
): Record<string, SedeConvocatoria> {
  
  // Capacidades estándar de las sedes
  const capacidades: Record<string, number> = {
    "CANTON": 14,
    "SM": 16,
    "PUERTOS": puertos10vs10 ? 20 : 14,
    "PUERTOS 2": 14
  };

  const sedesActivasList = ["CANTON", "SM", "PUERTOS"];
  if (canchaMojadaCanton) {
    sedesActivasList.push("PUERTOS 2");
  }

  // Inicializar estructura de sedes
  const resultado: Record<string, SedeConvocatoria> = {};
  sedesActivasList.forEach(sede => {
    let suspendida = sedesCanceladas.includes(sede);
    let motivo = suspendida ? "SEDE CANCELADA" : undefined;

    if (sede === "CANTON" && canchaMojadaCanton) {
      suspendida = true;
      motivo = "CANCHA MOJADA (Deriva a Puertos 2)";
    }

    resultado[sede] = {
      nombre: sede,
      capacidad: capacidades[sede] || 14,
      convocados: [],
      suplentes: [],
      activa: !suspendida,
      motivoSuspension: motivo
    };
  });

  if (canchaMojadaCanton) {
    resultado["PUERTOS 2"] = {
      nombre: "PUERTOS 2",
      capacidad: capacidades["PUERTOS 2"],
      convocados: [],
      suplentes: [],
      activa: true
    };
  }

  // Filtrar por lluvia general si aplica
  let poolJugadores = [...inscriptos];
  if (suspensionLluviaGeneral) {
    poolJugadores = poolJugadores.filter(j => j.juegaConLluvia);
  }

  // Si Cantón está suspendido por cancha mojada, los que tenían preferencia Cantón y son flexibles pasan a Puertos 2
  if (canchaMojadaCanton) {
    poolJugadores = poolJugadores.map(j => {
      if (j.sede.toUpperCase().includes("CANTON") && j.flexible) {
        return { ...j, sede: "PUERTOS 2" };
      }
      return j;
    });
  }

  // Orden de prioridad estricta: 1) Pago al día, 2) VIP, 3) Fecha/Antigüedad
  poolJugadores.sort((a, b) => {
    if (a.estadoPago !== b.estadoPago) return a.estadoPago === "AL_DÍA" ? -1 : 1;
    if (a.vip !== b.vip) return a.vip ? -1 : 1;
    return a.fecha.localeCompare(b.fecha);
  });

  // Reparto a sedes preferidas con lógica de flexibles
  poolJugadores.forEach(jugador => {
    let sedeDestino = jugador.sede.toUpperCase();
    if (!resultado[sedeDestino] || !resultado[sedeDestino].activa) {
      // Buscar primera sede activa disponible para flexibles
      const primeraActiva = sedesActivasList.find(s => resultado[s] && resultado[s].activa);
      sedeDestino = primeraActiva || "CANTON";
    }

    if (resultado[sedeDestino] && resultado[sedeDestino].activa) {
      if (resultado[sedeDestino].convocados.length < resultado[sedeDestino].capacidad) {
        resultado[sedeDestino].convocados.push(jugador);
      } else if (jugador.flexible) {
        // Intentar ubicar en otra sede activa que tenga lugar
        let ubicado = false;
        for (const s of sedesActivasList) {
          if (resultado[s] && resultado[s].activa && resultado[s].convocados.length < resultado[s].capacidad) {
            resultado[s].convocados.push(jugador);
            ubicado = true;
            break;
          }
        }
        if (!ubicado) {
          resultado[sedeDestino].suplentes.push(jugador);
        }
      } else {
        resultado[sedeDestino].suplentes.push(jugador);
      }
    }
  });

  return resultado;
}
