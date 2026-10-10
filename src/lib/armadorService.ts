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

export interface ConfigArmador {
  cantonActivo: boolean;
  puertosActivo: boolean;
  smActivo: boolean;
  puertos2Activo: boolean;
  cantonCanchaMojada: boolean;
  modoPuertos10v10: boolean;
  bajasManuales?: string[];
}

export interface ResultadoArmado {
  canton: { apodo: string; email?: string }[];
  puertos: { apodo: string; email?: string }[];
  sm: { apodo: string; email?: string }[];
  puertos2: { apodo: string; email?: string }[];
  suplentes: { apodo: string; email?: string }[];
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
    (j) => (j.apodo || j.nombre || j.email) && !bajasSet.has((j.apodo || j.nombre || j.email).toLowerCase().trim())
  );

  // 2. Filtro general de lluvia
  if (suspensionLluviaGeneral) {
    pool = pool.filter((j) => j.juegaConLluvia);
  }

  // 3. Cantón -> Puertos 2 por cancha mojada
  if (canchaMojadaCanton) {
    pool = pool.map((j) => {
      const sedeNorm = normalizarSedeKey(j.sede || "");
      if (sedeNorm === "CANTON" && j.flexible) {
        return { ...j, sede: "PUERTOS 2" };
      }
      return j;
    });
  }

  // 4. Prioridad Estricta: Pago AL_DÍA > VIP > Timestamp
  const comparadorPrioridad = (a: InscripcionLocal, b: InscripcionLocal) => {
    if (a.estadoPago !== b.estadoPago) {
      return a.estadoPago === "AL_DÍA" ? -1 : 1;
    }
    if (a.vip !== b.vip) {
      return a.vip ? -1 : 1;
    }
    const fechaA = a.fecha || "";
    const fechaB = b.fecha || "";
    return fechaA.localeCompare(fechaB);
  };

  pool.sort(comparadorPrioridad);

  // 5. Inicializar Estado de Sedes
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

  const demandaSedes: Record<string, number> = {};
  ordenSedes.forEach((s) => (demandaSedes[s] = 0));
  pool.forEach((j) => {
    const sKey = normalizarSedeKey(j.sede || "CANTON");
    if (demandaSedes[sKey] !== undefined) demandaSedes[sKey]++;
  });
  const sedesOrdenadasPorDemanda = [...ordenSedes].sort(
    (a, b) => demandaSedes[b] - demandaSedes[a]
  );

  // 6. Asignación
  pool.forEach((jugador) => {
    let sedeDestino = normalizarSedeKey(jugador.sede || "CANTON");
    let asignado = false;

    if (
      resultado[sedeDestino] &&
      resultado[sedeDestino].activa &&
      resultado[sedeDestino].convocados.length < resultado[sedeDestino].capacidad
    ) {
      resultado[sedeDestino].convocados.push(jugador);
      asignado = true;
    }

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

  // 7. Trueques para rebalancear sedes incompletas
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

  Object.keys(resultado).forEach((s) => {
    resultado[s].convocados.sort(comparadorPrioridad);
    resultado[s].suplentes.sort(comparadorPrioridad);
  });

  return resultado;
}

export function armarConvocatorias(
  inscriptosRaw: any[],
  config: ConfigArmador
): ResultadoArmado {
  const inscriptosLocales: InscripcionLocal[] = (inscriptosRaw || []).map((i, idx) => ({
    id: `${i.email || "mail"}-${idx}`,
    apodo: i.apodo || i.email || "Jugador",
    email: i.email || "",
    sede: i.sede || i.turno || "CANTON",
    flexible: Boolean(i.flexible),
    juegaConLluvia: Boolean(i.juega_con_lluvia ?? true),
    vip: Boolean(i.vip),
    estadoPago: i.pago ? "AL_DÍA" : "DEBE",
    fecha: i.timestamp || i.fecha || "",
  }));

  const sedesCanceladas: string[] = [];
  if (!config.cantonActivo) sedesCanceladas.push("CANTON");
  if (!config.puertosActivo) sedesCanceladas.push("PUERTOS");
  if (!config.smActivo) sedesCanceladas.push("SM");
  if (!config.puertos2Activo) sedesCanceladas.push("PUERTOS 2");

  const resMap = armarConvocatoriasPorSede(inscriptosLocales, {
    suspensionLluviaGeneral: false,
    sedesCanceladas,
    canchaMojadaCanton: Boolean(config.cantonCanchaMojada),
    puertos10vs10: Boolean(config.modoPuertos10v10),
    bajasManuales: config.bajasManuales || [],
  });

  return {
    canton: (resMap["CANTON"]?.convocados || []).map((j) => ({ apodo: j.apodo, email: j.email })),
    puertos: (resMap["PUERTOS"]?.convocados || []).map((j) => ({ apodo: j.apodo, email: j.email })),
    sm: (resMap["SM"]?.convocados || []).map((j) => ({ apodo: j.apodo, email: j.email })),
    puertos2: (resMap["PUERTOS 2"]?.convocados || []).map((j) => ({ apodo: j.apodo, email: j.email })),
    suplentes: [
      ...(resMap["CANTON"]?.suplentes || []),
      ...(resMap["PUERTOS"]?.suplentes || []),
      ...(resMap["SM"]?.suplentes || []),
      ...(resMap["PUERTOS 2"]?.suplentes || []),
    ].map((j) => ({ apodo: j.apodo, email: j.email })),
  };
}
