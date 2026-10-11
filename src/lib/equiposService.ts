import type { InscripcionLocal } from "@/lib/types";

export interface JugadorPuestoPuntaje extends InscripcionLocal {
  puestoNum: number; // 0: ARQ, 1: DEF, 2: MED, 3: DEL
  puestoLabel: string;
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
  general?: number | string;
  puesto?: number | string;
  ataque?: number | string;
  defensa?: number | string;
  equipo?: number | string;
  velocidad?: number | string;
  individual?: number | string;
}

function normalizarTexto(t?: string): string {
  if (!t) return "";
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

function parsearPuesto(puestoRaw?: string | number): number {
  if (puestoRaw === undefined || puestoRaw === null) return 2;
  if (typeof puestoRaw === "number") {
    return [0, 1, 2, 3].includes(puestoRaw) ? puestoRaw : 2;
  }
  const p = normalizarTexto(puestoRaw.toString());
  if (p === "0" || p.includes("arq") || p.includes("portero") || p.includes("goalk")) return 0;
  if (p === "1" || p.includes("def") || p.includes("lat") || p.includes("zaguero")) return 1;
  if (p === "3" || p.includes("del") || p.includes("ataq") || p.includes("puntero") || p.includes("fwd")) return 3;
  if (p === "2" || p.includes("med") || p.includes("vol") || p.includes("mid")) return 2;
  return 2;
}

export function dividirEnEquipos(
  convocados: InscripcionLocal[],
  bdPuntajes: Record<string, number | PuntajeDetalle | any> = {},
  infoPlantel: Record<string, { puesto?: string; email?: string; apodo?: string }> = {}
): EquiposPartido {
  if (!convocados || convocados.length === 0) {
    return {
      blancos: [],
      negros: [],
      promedioBlancos: 0,
      promedioNegros: 0,
      puntajeTotalBlancos: 0,
      puntajeTotalNegros: 0,
    };
  }

  // Pre-normalizar claves de bdPuntajes para búsqueda rápida
  const bdNormalizada: Record<string, any> = {};
  Object.keys(bdPuntajes).forEach((key) => {
    const normKey = normalizarTexto(key);
    if (normKey) {
      bdNormalizada[normKey] = bdPuntajes[key];
    }
  });

  const jugadoresEnriquecidos: JugadorPuestoPuntaje[] = convocados.map((j) => {
    const emailKey = normalizarTexto(j.email);
    const apodoKey = normalizarTexto(j.apodo);

    // Búsqueda jerárquica de datos de BD Puntajes
    let datosBd = bdNormalizada[emailKey] || bdNormalizada[apodoKey];
    if (datosBd === undefined && apodoKey) {
      const foundKey = Object.keys(bdNormalizada).find(
        (k) => k.includes(apodoKey) || apodoKey.includes(k)
      );
      if (foundKey) {
        datosBd = bdNormalizada[foundKey];
      }
    }

    const datosPlantel = infoPlantel[emailKey] || infoPlantel[apodoKey];

    // Mapeo de puesto
    let puestoNum = 2;
    if (typeof datosBd === "object" && datosBd !== null && datosBd.puesto !== undefined) {
      puestoNum = parsearPuesto(datosBd.puesto);
    } else if ((j as any).puesto !== undefined) {
      puestoNum = parsearPuesto((j as any).puesto);
    } else if (datosPlantel?.puesto) {
      puestoNum = parsearPuesto(datosPlantel.puesto);
    }

    // Cálculo del Puntaje V19
    let puntaje = 50;

    if (typeof datosBd === "number") {
      puntaje = datosBd > 10 ? datosBd : datosBd * 10;
    } else if (typeof datosBd === "string") {
      const parsed = parseFloat(datosBd.replace(",", "."));
      if (!isNaN(parsed)) {
        puntaje = parsed > 10 ? parsed : parsed * 10;
      }
    } else if (typeof datosBd === "object" && datosBd !== null) {
      const vAt = parseFloat((datosBd.ataque ?? datosBd.vAt ?? 50).toString().replace(",", "."));
      const vDef = parseFloat((datosBd.defensa ?? datosBd.vDef ?? 50).toString().replace(",", "."));
      const vEq = parseFloat((datosBd.equipo ?? datosBd.vEq ?? 50).toString().replace(",", "."));
      const vIn = parseFloat((datosBd.individual ?? datosBd.vIn ?? 50).toString().replace(",", "."));
      const vVel = parseFloat((datosBd.velocidad ?? datosBd.vVel ?? 50).toString().replace(",", "."));

      const hasSkills = !isNaN(vAt) || !isNaN(vDef) || !isNaN(vEq);

      if (hasSkills) {
        const valAt = isNaN(vAt) ? 50 : vAt;
        const valDef = isNaN(vDef) ? 50 : vDef;
        const valEq = isNaN(vEq) ? 50 : vEq;
        const valIn = isNaN(vIn) ? 50 : vIn;
        const valVel = isNaN(vVel) ? 50 : vVel;

        let pAt = 1.0, pDef = 1.0, pEq = 1.2, pIn = 0.8, pVel = 1.3;
        if (puestoNum === 3) { pAt = 2.0; pDef = 0.3; }
        else if (puestoNum === 1 || puestoNum === 0) { pAt = 0.3; pDef = 2.0; }
        else { pAt = 1.2; pDef = 1.2; }

        puntaje = (valAt * pAt + valDef * pDef + valEq * pEq + valIn * pIn + valVel * pVel) / (pAt + pDef + pEq + pIn + pVel);
      } else if (datosBd.general !== undefined) {
        const val = parseFloat(datosBd.general.toString().replace(",", "."));
        if (!isNaN(val)) puntaje = val > 10 ? val : val * 10;
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

  // Agrupar por Puesto (0: ARQ, 1: DEF, 2: MED, 3: DEL)
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

  // Algoritmo V19: Distribución balanceada por Puesto + Puntaje
  [0, 1, 2, 3].forEach((puesto) => {
    const listaGrupo = porPuesto[puesto];
    listaGrupo.sort((a, b) => b.puntaje - a.puntaje);

    listaGrupo.forEach((jugador) => {
      const cantPosB = eqB.filter((x) => x.puestoNum === puesto).length;
      const cantPosN = eqN.filter((x) => x.puestoNum === puesto).length;

      // Prioridad 1: Balancear cantidad TOTAL
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
          // Prioridad 3: Balancear por PUNTAJE
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
