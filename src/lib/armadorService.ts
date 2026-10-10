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

function parsearFechaMs(fStr?: string): number {
  if (!fStr) return 0;
  const tIso = Date.parse(fStr);
  if (!Number.isNaN(tIso)) return tIso;

  const [fPart = "", hPart = ""] = fStr.trim().split(" ");
  const partes = fPart.split(/[/-]/).map((p) => Number(p));
  if (partes.length < 3) return 0;
  const [d, m, a] = partes;
  const anio = a < 100 ? 2000 + a : a;
  const [hh = 0, mm = 0, ss = 0] = hPart.split(":").map((p) => Number(p));
  const dateObj = new Date(anio, m - 1, d, hh, mm, ss);
  return Number.isNaN(dateObj.getTime()) ? 0 : dateObj.getTime();
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

  const bajasSet = new Set(bajasManuales.map((b) => b.toLowerCase().trim()));
  let pool = inscriptos.filter(
    (j) => (j.apodo || j.email) && !bajasSet.has((j.apodo || j.email).toLowerCase().trim())
  );

  if (suspensionLluviaGeneral) {
    pool = pool.filter((j) => j.juegaConLluvia);
  }

  if (canchaMojadaCanton) {
    pool = pool.map((j) => {
      const sedeNorm = normalizarSedeKey(j.sede || "");
      if (sedeNorm === "CANTON" && j.flexible) {
        return { ...j, sede: "PUERTOS 2" };
      }
      return j;
    });
  }

  // Strict Priority Order: Pago AL_DÍA > VIP > Timestamp
  const comparadorPrioridad = (a: InscripcionLocal, b: InscripcionLocal) => {
    if (a.estadoPago !== b.estadoPago) {
      return a.estadoPago === "AL_DÍA" ? -1 : 1;
    }
    if (a.vip !== b.vip) {
      return a.vip ? -1 : 1;
    }
    const tA = parsearFechaMs(a.fecha);
    const tB = parsearFechaMs(b.fecha);
    if (tA !== tB) return tA - tB;
    return (a.apodo || "").localeCompare(b.apodo || "");
  };

  pool.sort(comparadorPrioridad);

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

  // Reorder visual list by priority
  Object.keys(resultado).forEach((s) => {
    resultado[s].convocados.sort(comparadorPrioridad);
    resultado[s].suplentes.sort(comparadorPrioridad);
  });

  return resultado;
}

export function armarConvocatorias(
  inscriptos: any[],
  config: ConfigArmador
): ResultadoArmado {
  const sedesCanceladas: string[] = [];
  if (!config.cantonActivo) sedesCanceladas.push("CANTON");
  if (!config.puertosActivo) sedesCanceladas.push("PUERTOS");
  if (!config.smActivo) sedesCanceladas.push("SM");
  if (!config.puertos2Activo) sedesCanceladas.push("PUERTOS 2");

  const consolidadas: InscripcionLocal[] = (inscriptos || []).map((j, idx) => ({
    id: ,
    apodo: j.apodo || j.email || "",
    email: j.email || "",
    sede: j.sede || j.turno || "CANTON",
    flexible: Boolean(j.flexible),
    juegaConLluvia: Boolean(j.juega_con_lluvia),
    vip: Boolean(j.vip),
    estadoPago: j.pago ? "AL_DÍA" : "DEBE",
    fecha: j.timestamp || j.fecha || "",
  }));

  const resSedes = armarConvocatoriasPorSede(
    consolidadas,
    false,
    sedesCanceladas,
    config.cantonCanchaMojada,
    config.modoPuertos10v10
  );

  return {
    canton: (resSedes["CANTON"]?.convocados || []).map((x) => ({ apodo: x.apodo, email: x.email })),
    puertos: (resSedes["PUERTOS"]?.convocados || []).map((x) => ({ apodo: x.apodo, email: x.email })),
    sm: (resSedes["SM"]?.convocados || []).map((x) => ({ apodo: x.apodo, email: x.email })),
    puertos2: (resSedes["PUERTOS 2"]?.convocados || []).map((x) => ({ apodo: x.apodo, email: x.email })),
    suplentes: [
      ...(resSedes["CANTON"]?.suplentes || []),
      ...(resSedes["PUERTOS"]?.suplentes || []),
      ...(resSedes["SM"]?.suplentes || []),
      ...(resSedes["PUERTOS 2"]?.suplentes || []),
    ].map((x) => ({ apodo: x.apodo, email: x.email })),
  };
}
