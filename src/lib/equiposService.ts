import type { InscripcionLocal } from "@/lib/types";

export interface JugadorPuestoPuntaje extends InscripcionLocal {
  puestoNum: number; // 0: Arquero, 1: Defensor, 2: Mediocampista, 3: Delantero
  puestoLabel: string; // "ARQ" | "DEF" | "MED" | "DEL"
  puntaje: number;
}

export interface EquiposPartido {
  blancos: JugadorPuestoPuntaje[];
  negros: JugadorPuestoPuntaje[];
  promedioBlancos: number;
  promedioNegros: number;
  puntajeTotalBlancos: number;
  puntajeTotalNegros: number;
}

export interface PuntajeDetalle {
  puesto?: number | string;
  ataque?: number;
  defensa?: number;
  equipo?: number;
  individual?: number;
  velocidad?: number;
  general?: number;
}

function parsearPuesto(puestoRaw?: string | number): number {
  if (puestoRaw === undefined || puestoRaw === null) return 2; // MED por defecto
  if (typeof puestoRaw === "number") {
    return [0, 1, 2, 3].includes(puestoRaw) ? puestoRaw : 2;
  }
  const p = puestoRaw.toString().toLowerCase().trim();
  if (p === "0" || p.includes("arq")) return 0;
  if (p === "1" || p.includes("def")) return 1;
  if (p === "3" || p.includes("del") || p.includes("atack") || p.includes("ataq")) return 3;
  if (p === "2" || p.includes("med") || p.includes("mitad")) return 2;
  return 2;
}

function calcularPuntajeV19(
  vAt: number,
  vDef: number,
  vEq: number,
  vIn: number,
  vVel: number,
  puestoNum: number
): number {
  let pAt = 1.0, pDef = 1.0, pEq = 1.2, pIn = 0.8, pVel = 1.3;
  if (puestoNum === 3) {
    pAt = 2.0;
    pDef = 0.3;
  } else if (puestoNum === 1 || puestoNum === 0) {
    pAt = 0.3;
    pDef = 2.0;
  } else {
    pAt = 1.2;
    pDef = 1.2;
  }
  return (vAt * pAt + vDef * pDef + vEq * pEq + vIn * pIn + vVel * pVel) / (pAt + pDef + pEq + pIn + pVel);
}

/**
 * Divide a los titulares convocados en Blancos vs. Negros de forma idéntica
 * al script de Google Sheets V19:
 * 1. Agrupa por puesto (0: Arq, 1: Def, 2: Med, 3: Del).
 * 2. Ordena de mayor a menor puntaje dentro de cada puesto.
 * 3. Distribuye puesto por puesto equilibrando:
 *    - Prioridad 1: Cantidad total de jugadores.
 *    - Prioridad 2: Cantidad de jugadores por puesto.
 *    - Prioridad 3: Puntaje acumulado.
 * 4. Asigna arquero si algún equipo carece de arquero natural (evitando a Obi).
 */
export function dividirEnEquipos(
  convocados: InscripcionLocal[],
  bdPuntajes: Record<string, number | PuntajeDetalle> = {},
  infoPlantel: Record<string, { puesto?: string; email?: string; apodo?: string }> = {}
): EquiposPartido {
  // 1. Enriquecer cada jugador con su puesto (0..3) y puntaje V19
  const jugadoresEnriquecidos: JugadorPuestoPuntaje[] = convocados.map((j) => {
    const emailKey = (j.email || "").toLowerCase().trim();
    const apodoKey = (j.apodo || "").toLowerCase().trim();

    // Buscar coincidencia en BD de puntajes
    let datosBd = bdPuntajes[emailKey] || bdPuntajes[apodoKey];
    if (datosBd === undefined && apodoKey) {
      const foundKey = Object.keys(bdPuntajes).find(
        (k) => k.toLowerCase().includes(apodoKey) || apodoKey.includes(k.toLowerCase())
      );
      if (foundKey) datosBd = bdPuntajes[foundKey];
    }

    const datosPlantel = infoPlantel[emailKey] || infoPlantel[apodoKey];

    // Extraer Puesto (0: Arq, 1: Def, 2: Med, 3: Del)
    let puestoNum = 2;
    if (typeof datosBd === "object" && datosBd?.puesto !== undefined) {
      puestoNum = parsearPuesto(datosBd.puesto);
    } else if (datosPlantel?.puesto) {
      puestoNum = parsearPuesto(datosPlantel.puesto);
    }

    // Calcular Puntaje V19
    let puntaje = 50;
    if (typeof datosBd === "number") {
      puntaje = datosBd > 10 ? datosBd : datosBd * 10;
    } else if (typeof datosBd === "object" && datosBd !== null) {
      if (
        datosBd.ataque !== undefined ||
        datosBd.defensa !== undefined ||
        datosBd.equipo !== undefined
      ) {
        const vAt = Number(datosBd.ataque ?? 50);
        const vDef = Number(datosBd.defensa ?? 50);
        const vEq = Number(datosBd.equipo ?? 50);
        const vIn = Number(datosBd.individual ?? 50);
        const vVel = Number(datosBd.velocidad ?? 50);
        puntaje = calcularPuntajeV19(vAt, vDef, vEq, vIn, vVel, puestoNum);
      } else if (datosBd.general !== undefined) {
        const val = Number(datosBd.general);
        puntaje = val > 10 ? val : val * 10;
      }
    }

    const puestosLabels: Record<number, string> = {
      0: "🧤 ARQ",
      1: "🛡️ DEF",
      2: "👟 MED",
      3: "⚽ DEL",
    };

    return {
      ...j,
      puestoNum,
      puestoLabel: puestosLabels[puestoNum] || "👟 MED",
      puntaje: Number(puntaje.toFixed(2)),
    };
  });

  // 2. Agrupar por puesto
  const porPuesto: Record<number, JugadorPuestoPuntaje[]> = {
    0: [],
    1: [],
    2: [],
    3: [],
  };

  jugadoresEnriquecidos.forEach((j) => {
    const p = porPuesto[j.puestoNum] !== undefined ? j.puestoNum : 2;
    porPuesto[p].push(j);
  });

  const eqB: JugadorPuestoPuntaje[] = [];
  const eqN: JugadorPuestoPuntaje[] = [];
  let ptsB = 0;
  let ptsN = 0;

  // 3. Repartir puesto por puesto (0: Arq, 1: Def, 2: Med, 3: Del)
  [0, 1, 2, 3].forEach((puesto) => {
    const listaGrupo = porPuesto[puesto];
    listaGrupo.sort((a, b) => b.puntaje - a.puntaje);

    listaGrupo.forEach((jugador) => {
      const cantPosB = eqB.filter((x) => x.puestoNum === puesto).length;
      const cantPosN = eqN.filter((x) => x.puestoNum === puesto).length;

      // Prioridad 1: Balancear cantidad TOTAL de jugadores
      if (eqB.length < eqN.length) {
        eqB.push(jugador);
        ptsB += jugador.puntaje;
      } else if (eqN.length < eqB.length) {
        eqN.push(jugador);
        ptsN += jugador.puntaje;
      } else {
        // Prioridad 2: Balancear cantidad por PUESTO
        if (cantPosB < cantPosN) {
          eqB.push(jugador);
          ptsB += jugador.puntaje;
        } else if (cantPosN < cantPosB) {
          eqN.push(jugador);
          ptsN += jugador.puntaje;
        } else {
          // Prioridad 3: Balancear por PUNTAJE acumulado
          if (ptsB <= ptsN) {
            eqB.push(jugador);
            ptsB += jugador.puntaje;
          } else {
            eqN.push(jugador);
            ptsN += jugador.puntaje;
          }
        }
      }
    });
  });

  // 4. Asegurar Arquero (Puesto 0)
  const asegurarArquero = (equipo: JugadorPuestoPuntaje[]) => {
    if (equipo.length > 0 && !equipo.some((j) => j.puestoNum === 0)) {
      const candidatos = equipo.filter(
        (j) =>
          (j.email || "").toLowerCase() !== "mgnarvaez@gmail.com" &&
          !(j.apodo || "").toLowerCase().includes("obi")
      );
      if (candidatos.length > 0) {
        const elegido = candidatos[Math.floor(Math.random() * candidatos.length)];
        elegido.puestoNum = 0;
        elegido.puestoLabel = "🧤 ARQ";
      } else {
        const elegido = equipo[Math.floor(Math.random() * equipo.length)];
        elegido.puestoNum = 0;
        elegido.puestoLabel = "🧤 ARQ";
      }
    }
  };

  asegurarArquero(eqB);
  asegurarArquero(eqN);

  const promedioBlancos = eqB.length > 0 ? ptsB / eqB.length : 0;
  const promedioNegros = eqN.length > 0 ? ptsN / eqN.length : 0;

  return {
    blancos: eqB,
    negros: eqN,
    promedioBlancos: Number(promedioBlancos.toFixed(1)),
    promedioNegros: Number(promedioNegros.toFixed(1)),
    puntajeTotalBlancos: Number(ptsB.toFixed(1)),
    puntajeTotalNegros: Number(ptsN.toFixed(1)),
  };
}
