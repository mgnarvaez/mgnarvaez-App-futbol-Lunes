import type { InscripcionLocal } from "@/lib/types";

export interface JugadorPuestoPuntaje extends InscripcionLocal {
  puestoNum: number;
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
  general?: number;
  puesto?: number | string;
  ataque?: number;
  defensa?: number;
  equipo?: number;
  velocidad?: number;
  individual?: number;
}

function parsearPuesto(puestoRaw?: string | number): number {
  if (puestoRaw === undefined || puestoRaw === null) return 2;
  if (typeof puestoRaw === "number") {
    return [0, 1, 2, 3].includes(puestoRaw) ? puestoRaw : 2;
  }
  const p = puestoRaw.toString().toLowerCase().trim();
  if (p === "0" || p.includes("arq") || p.includes("portero")) return 0;
  if (p === "1" || p.includes("def") || p.includes("lat")) return 1;
  if (p === "3" || p.includes("del") || p.includes("ataq")) return 3;
  if (p === "2" || p.includes("med") || p.includes("vol")) return 2;
  return 2;
}

export function dividirEnEquipos(
  convocados: InscripcionLocal[],
  bdPuntajes: Record<string, number | PuntajeDetalle> = {},
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

  const jugadoresEnriquecidos: JugadorPuestoPuntaje[] = convocados.map((j) => {
    const emailKey = (j.email || "").toLowerCase().trim();
    const apodoKey = (j.apodo || "").toLowerCase().trim();

    const datosBd = bdPuntajes[emailKey] || bdPuntajes[apodoKey];
    const datosPlantel = infoPlantel[emailKey] || infoPlantel[apodoKey];

    let puestoNum = 2;
    if (typeof datosBd === "object" && datosBd !== null && datosBd.puesto !== undefined) {
      puestoNum = parsearPuesto(datosBd.puesto);
    } else if (datosPlantel?.puesto) {
      puestoNum = parsearPuesto(datosPlantel.puesto);
    }

    let puntaje = 50;
    if (typeof datosBd === "number") {
      puntaje = datosBd > 10 ? datosBd : datosBd * 10;
    } else if (typeof datosBd === "object" && datosBd !== null) {
      if (datosBd.general !== undefined) {
        const val = Number(datosBd.general);
        puntaje = val > 10 ? val : val * 10;
      } else if (datosBd.ataque !== undefined || datosBd.defensa !== undefined) {
        const vAt = Number(datosBd.ataque || 50);
        const vDef = Number(datosBd.defensa || 50);
        const vEq = Number(datosBd.equipo || 50);
        const vIn = Number(datosBd.individual || 50);
        const vVel = Number(datosBd.velocidad || 50);

        let pAt = 1.2, pDef = 1.2, pEq = 1.2, pIn = 0.8, pVel = 1.3;
        if (puestoNum === 3) { pAt = 2.0; pDef = 0.3; }
        else if (puestoNum === 1 || puestoNum === 0) { pAt = 0.3; pDef = 2.0; }

        puntaje = (vAt * pAt + vDef * pDef + vEq * pEq + vIn * pIn + vVel * pVel) / (pAt + pDef + pEq + pIn + pVel);
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
      puntaje: Number(puntaje.toFixed(1)),
    };
  });

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

  [0, 1, 2, 3].forEach((puesto) => {
    const listaGrupo = porPuesto[puesto];
    listaGrupo.sort((a, b) => b.puntaje - a.puntaje);

    listaGrupo.forEach((jugador) => {
      const cantPosB = eqB.filter((x) => x.puestoNum === puesto).length;
      const cantPosN = eqN.filter((x) => x.puestoNum === puesto).length;

      if (eqB.length < eqN.length) {
        eqB.push(jugador);
        ptsB += jugador.puntaje;
      } else if (eqN.length < eqB.length) {
        eqN.push(jugador);
        ptsN += jugador.puntaje;
      } else {
        if (cantPosB < cantPosN) {
          eqB.push(jugador);
          ptsB += jugador.puntaje;
        } else if (cantPosN < cantPosB) {
          eqN.push(jugador);
          ptsN += jugador.puntaje;
        } else {
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
