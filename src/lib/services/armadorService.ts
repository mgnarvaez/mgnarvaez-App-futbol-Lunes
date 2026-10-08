import type { InscripcionLocal } from "@/lib/types";

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

  let poolJugadores = [...inscriptos];
  if (suspensionLluviaGeneral) {
    poolJugadores = poolJugadores.filter(j => j.juegaConLluvia);
  }

  if (canchaMojadaCanton) {
    poolJugadores = poolJugadores.map(j => {
      if (j.sede.toUpperCase().includes("CANTON") && j.flexible) {
        return { ...j, sede: "PUERTOS 2" };
      }
      return j;
    });
  }

  poolJugadores.sort((a, b) => {
    if (a.estadoPago !== b.estadoPago) return a.estadoPago === "AL_DÍA" ? -1 : 1;
    if (a.vip !== b.vip) return a.vip ? -1 : 1;
    return a.fecha.localeCompare(b.fecha);
  });

  poolJugadores.forEach(jugador => {
    let sedeDestino = jugador.sede.toUpperCase();
    if (!resultado[sedeDestino] || !resultado[sedeDestino].activa) {
      const primeraActiva = sedesActivasList.find(s => resultado[s] && resultado[s].activa);
      sedeDestino = primeraActiva || "CANTON";
    }

    if (resultado[sedeDestino] && resultado[sedeDestino].activa) {
      if (resultado[sedeDestino].convocados.length < resultado[sedeDestino].capacidad) {
        resultado[sedeDestino].convocados.push(jugador);
      } else if (jugador.flexible) {
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
