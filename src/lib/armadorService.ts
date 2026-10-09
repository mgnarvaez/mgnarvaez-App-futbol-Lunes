import type { InscripcionLocal } from "@/lib/types";

export interface SedeConvocatoria {
  nombre: string;
  capacidad: number;
  convocados: InscripcionLocal[];
  suplentes: InscripcionLocal[];
  activa: boolean;
  motivoSuspension?: string;
}

export interface EngineConfig {
  suspensionLluviaGeneral: boolean;
  sedesCanceladas: string[];
  canchaMojadaCanton: boolean;
  puertos10vs10: boolean;
  bajasManuales?: string[];
}

export function normalizarSedeKey(cadena: string): string {
  if (!cadena) return "";
  const c = cadena.toUpperCase().trim();
  if (c.includes("CANTON") || c.includes("CANTÓN")) return "CANTON";
  if (c.includes("SM") || c.includes("MATIAS") || c.includes("MATÍAS")) return "SM";
  if (c.includes("PUERTOS 2") || c.includes("PUERTOS2")) return "PUERTOS 2";
  if (c.includes("PUERTOS")) return "PUERTOS";
  return c;
}

function parsearTimestampMilisegundos(cadenaFecha?: string): number {
  if (!cadenaFecha) return Date.now();
  const raw = cadenaFecha.trim();
  const isoDate = new Date(raw);
  if (!Number.isNaN(isoDate.getTime())) return isoDate.getTime();

  // Mapear formatos como "19/8/2025 20:02:02" o "19/8/2025"
  const partes = raw.split(/[\s/:]+/);
  if (partes.length >= 3) {
    const d = parseInt(partes[0], 10);
    const m = parseInt(partes[1], 10);
    const a = parseInt(partes[2], 10);
    const anio = a < 100 ? 2000 + a : a;
    if (d > 0 && m > 0 && anio >= 2000) {
      const h = partes[3] ? parseInt(partes[3], 10) : 0;
      const min = partes[4] ? parseInt(partes[4], 10) : 0;
      const seg = partes[5] ? parseInt(partes[5], 10) : 0;
      return new Date(anio, m - 1, d, h, min, seg).getTime();
    }
  }
  return Date.now();
}

// Soporta ambas firmas: objeto EngineConfig o parámetros individuales
export function armarConvocatoriasPorSede(
  inscriptos: InscripcionLocal[],
  param2: EngineConfig | boolean,
  sedesCanceladasParam?: string[],
  canchaMojadaCantonParam?: boolean,
  puertos10vs10Param?: boolean,
  bajasManualesParam?: string[]
): Record<string, SedeConvocatoria> {
  let config: EngineConfig;

  if (typeof param2 === "object" && param2 !== null) {
    config = param2;
  } else {
    config = {
      suspensionLluviaGeneral: Boolean(param2),
      sedesCanceladas: sedesCanceladasParam || [],
      canchaMojadaCanton: Boolean(canchaMojadaCantonParam),
      puertos10vs10: Boolean(puertos10vs10Param),
      bajasManuales: bajasManualesParam || [],
    };
  }

  const {
    suspensionLluviaGeneral,
    sedesCanceladas,
    canchaMojadaCanton,
    puertos10vs10,
    bajasManuales = [],
  } = config;

  const capacidades: Record<string, number> = {
    CANTON: 14,
    SM: 16,
    PUERTOS: puertos10vs10 ? 20 : 14,
    "PUERTOS 2": 14,
  };

  let ordenSedes = ["CANTON", "SM", "PUERTOS"];
  if (canchaMojadaCanton || sedesCanceladas.includes("PUERTOS 2")) {
    ordenSedes.push("PUERTOS 2");
  }

  // 1. Filtrado de bajas manuales
  const bajasSet = new Set(bajasManuales.map((b) => b.toLowerCase().trim()));
  let pool = inscriptos.filter(
    (j) => (j.apodo || j.email) && !bajasSet.has((j.apodo || j.email).toLowerCase().trim())
  );

  // 2. Filtro general de lluvia
  if (suspensionLluviaGeneral) {
    pool = pool.filter((j) => j.juegaConLluvia);
  }

  // 3. Mapeo de derivación Cantón -> Puertos 2 por cancha mojada
  if (canchaMojadaCanton) {
    pool = pool.map((j) => {
      const sedeNorm = normalizarSedeKey(j.sede || "");
      if (sedeNorm === "CANTON" && j.flexible) {
        return { ...j, sede: "PUERTOS 2" };
      }
      return j;
    });
  }

  // 4. Orden de Prioridad Estricto:
  //    1º Pago AL_DÍA vs DEBE (AL_DÍA SIEMPRE pasa primero!)
  //    2º VIP vs General
  //    3º Antigüedad cronológica (Timestamp en milisegundos)
  const comparadorPrioridad = (a: InscripcionLocal, b: InscripcionLocal) => {
    if (a.estadoPago !== b.estadoPago) {
      return a.estadoPago === "AL_DÍA" ? -1 : 1;
    }
    if (a.vip !== b.vip) {
      return a.vip ? -1 : 1;
    }
    const tA = parsearTimestampMilisegundos(a.fecha);
    const tB = parsearTimestampMilisegundos(b.fecha);
    return tA - tB;
  };

  pool.sort(comparadorPrioridad);

  // 5. Inicializar Estado de Sedes y Detección de Cancelaciones
  const resultado: Record<string, SedeConvocatoria> = {};
  ordenSedes.forEach((sede) => {
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
      motivoSuspension: motivo,
    };
  });

  // Reordenar preferencia de sedes activas según demanda
  const demandaSedes: Record<string, number> = {};
  ordenSedes.forEach((s) => (demandaSedes[s] = 0));
  pool.forEach((j) => {
    const sKey = normalizarSedeKey(j.sede || "CANTON");
    if (demandaSedes[sKey] !== undefined) demandaSedes[sKey]++;
  });
  const sedesOrdenadasPorDemanda = [...ordenSedes].sort(
    (a, b) => demandaSedes[b] - demandaSedes[a]
  );

  // 6. Asignación a Sedes
  pool.forEach((jugador) => {
    let sedeDestino = normalizarSedeKey(jugador.sede || "CANTON");
    let asignado = false;

    // A. Intento en sede preferida
    if (
      resultado[sedeDestino] &&
      resultado[sedeDestino].activa &&
      resultado[sedeDestino].convocados.length < resultado[sedeDestino].capacidad
    ) {
      resultado[sedeDestino].convocados.push(jugador);
      asignado = true;
    }

    // B. Si es flexible y no entró a su preferida
    if (!asignado && jugador.flexible) {
      for (const otraSede of sedesOrdenadasPorDemanda) {
        if (
          resultado[otraSede] &&
          resultado[otraSede].activa &&
          resultado[otraSede].convocados.length < resultado[otraSede].capacidad
        ) {
          resultado[otraSede].convocados.push(jugador);
          asignado = true;
          break;
        }
      }
    }

    // C. Si no quedó asignado -> Suplente
    if (!asignado) {
      if (resultado[sedeDestino] && resultado[sedeDestino].activa) {
        resultado[sedeDestino].suplentes.push(jugador);
      } else {
        const primeraActiva = sedesOrdenadasPorDemanda.find(
          (s) => resultado[s] && resultado[s].activa
        );
        if (primeraActiva) {
          resultado[primeraActiva].suplentes.push(jugador);
        } else if (resultado[sedeDestino]) {
          resultado[sedeDestino].suplentes.push(jugador);
        }
      }
    }
  });

  // 7. Trueque condicionado para llenar sedes incompletas
  sedesOrdenadasPorDemanda.forEach((sedeIncompleta) => {
    if (resultado[sedeIncompleta] && resultado[sedeIncompleta].activa) {
      const cupoTotal = resultado[sedeIncompleta].capacidad;
      const faltantes = cupoTotal - resultado[sedeIncompleta].convocados.length;

      if (faltantes > 0) {
        let truequesDisponibles = 0;
        sedesOrdenadasPorDemanda.forEach((otraSede) => {
          if (
            otraSede !== sedeIncompleta &&
            resultado[otraSede] &&
            resultado[otraSede].activa
          ) {
            const flexiblesEnConv = resultado[otraSede].convocados.filter((j) => j.flexible).length;
            const suplentesEsperando = resultado[otraSede].suplentes.length;
            truequesDisponibles += Math.min(flexiblesEnConv, suplentesEsperando);
          }
        });

        if (truequesDisponibles >= faltantes) {
          while (resultado[sedeIncompleta].convocados.length < cupoTotal) {
            let truequeRealizado = false;

            for (const sedeLlena of sedesOrdenadasPorDemanda) {
              if (
                sedeLlena !== sedeIncompleta &&
                resultado[sedeLlena] &&
                resultado[sedeLlena].activa &&
                resultado[sedeLlena].suplentes.length > 0
              ) {
                const indexFlexible = resultado[sedeLlena].convocados.findLastIndex(
                  (j) => j.flexible
                );

                if (indexFlexible !== -1) {
                  const jugadorFlexible = resultado[sedeLlena].convocados.splice(
                    indexFlexible,
                    1
                  )[0];
                  resultado[sedeIncompleta].convocados.push(jugadorFlexible);

                  const suplentePromovido = resultado[sedeLlena].suplentes.shift()!;
                  resultado[sedeLlena].convocados.push(suplentePromovido);

                  truequeRealizado = true;
                  break;
                }
              }
            }
            if (!truequeRealizado) break;
          }
        }
      }
    }
  });

  // 8. Reordenamiento visual por prioridad
  Object.keys(resultado).forEach((s) => {
    resultado[s].convocados.sort(comparadorPrioridad);
    resultado[s].suplentes.sort(comparadorPrioridad);
  });

  return resultado;
}

export function armarConvocatorias(
  inscriptos: InscripcionLocal[],
  config: EngineConfig
): Record<string, SedeConvocatoria> {
  return armarConvocatoriasPorSede(inscriptos, config);
}

export type ConfigArmador = EngineConfig;
export type ResultadoArmado = Record<string, SedeConvocatoria>;
