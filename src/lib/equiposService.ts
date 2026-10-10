import type { InscripcionLocal } from "@/lib/types";

export interface JugadorPuestoPuntaje {
  apodo: string;
  email: string;
  puestoNum: number; // 0: Arquero, 1: Defensa, 2: Mediocampo, 3: Delantero
  puestoLabel: string;
  puntaje: number;
  vip: boolean;
}

export interface EquiposPartido {
  blancos: InscripcionLocal[];
  negros: InscripcionLocal[];
  promedioBlancos: number;
  promedioNegros: number;
  sumaBlancos: number;
  sumaNegros: number;
}

export interface PuntajeDetalle {
  general?: number;
  ataque?: number;
  defensa?: number;
  equipo?: number;
  individual?: number;
  velocidad?: number;
  puesto?: string;
}

function parsearPuesto(puestoStr?: string): number {
  if (!puestoStr) return 2; // Mediocampo por defecto
  const p = puestoStr.toLowerCase().trim();
  if (p.includes("arq") || p.includes("goalk") || p.includes("portero")) return 0;
  if (p.includes("def") || p.includes("zaguero") || p.includes("lat")) return 1;
  if (p.includes("med") || p.includes("vol") || p.includes("mid")) return 2;
  if (p.includes("del") || p.includes("ataq") || p.includes("puntero") || p.includes("fwd")) return 3;
  return 2;
}

export function dividirEnEquipos(
  convocados: InscripcionLocal[],
  bdPuntajes: Record<string, number | PuntajeDetalle> = {},
  infoPlantel: Record<string, { puesto?: string; apodo?: string; email?: string }> = {}
): EquiposPartido {
  if (!convocados || convocados.length === 0) {
    return {
      blancos: [],
      negros: [],
      promedioBlancos: 0,
      promedioNegros: 0,
      sumaBlancos: 0,
      sumaNegros: 0,
    };
  }

  // Convertir a estructura interna con puesto real y puntaje ponderado
  const listaJugadores: JugadorPuestoPuntaje[] = convocados.map((j) => {
    const emailKey = (j.email || "").toLowerCase().trim();
    const apodoKey = (j.apodo || "").toLowerCase().trim();

    const datosBd = bdPuntajes[emailKey] || bdPuntajes[apodoKey];
    const datosPlantel = infoPlantel[emailKey] || infoPlantel[apodoKey];

    let puestoStr = "";
    if (typeof datosBd === "object" && datosBd?.puesto) {
      puestoStr = String(datosBd.puesto);
    } else if (datosPlantel?.puesto) {
      puestoStr = String(datosPlantel.puesto);
    }
    const puestoNum = parsearPuesto(puestoStr);

    let pts = 50;
    if (typeof datosBd === "number") {
      pts = datosBd > 10 ? datosBd : datosBd * 10;
    } else if (typeof datosBd === "object" && datosBd !== null) {
      if (datosBd.general !== undefined && Number(datosBd.general) > 0) {
        const g = Number(datosBd.general);
        pts = g > 10 ? g : g * 10;
      } else if (datosBd.ataque !== undefined || datosBd.defensa !== undefined) {
        const at = Number(datosBd.ataque || 50);
        const def = Number(datosBd.defensa || 50);
        const eq = Number(datosBd.equipo || 50);
        const ind = Number(datosBd.individual || 50);
        const vel = Number(datosBd.velocidad || 50);

        let pAt = 1.2, pDef = 1.2, pEq = 1.2, pInd = 0.8, pVel = 1.3;
        if (puestoNum === 3) { pAt = 2.0; pDef = 0.3; }
        else if (puestoNum === 1 || puestoNum === 0) { pAt = 0.3; pDef = 2.0; }

        pts = (at * pAt + def * pDef + eq * pEq + ind * pInd + vel * pVel) / (pAt + pDef + pEq + pInd + pVel);
      }
    } else if (typeof bdPuntajes[emailKey] === "number") {
      pts = Number(bdPuntajes[emailKey]);
    } else if (typeof bdPuntajes[apodoKey] === "number") {
      pts = Number(bdPuntajes[apodoKey]);
    }

    const labels: Record<number, string> = { 0: "ARQ", 1: "DEF", 2: "MED", 3: "DEL" };

    return {
      apodo: j.apodo,
      email: j.email,
      puestoNum,
      puestoLabel: labels[puestoNum] || "MED",
      puntaje: Math.round(pts * 10) / 10,
      vip: j.vip,
    };
  });

  // Agrupar por puesto (0: Arqueros, 1: Defensas, 2: Medios, 3: Delanteros)
  const porPuesto: Record<number, JugadorPuestoPuntaje[]> = {
    0: [],
    1: [],
    2: [],
    3: [],
  };

  listaJugadores.forEach((j) => {
    const p = porPuesto[j.puestoNum] ? j.puestoNum : 2;
    porPuesto[p].push(j);
  });

  const blancos: JugadorPuestoPuntaje[] = [];
  const negros: JugadorPuestoPuntaje[] = [];

  let sumaB = 0;
  let sumaN = 0;

  // Repartir puesto por puesto (de mayor a menor puntaje dentro de cada puesto)
  [0, 1, 2, 3].forEach((puesto) => {
    const grupo = porPuesto[puesto].sort((a, b) => b.puntaje - a.puntaje);

    grupo.forEach((jugador) => {
      // Prioridad 1: Balancear cantidad de jugadores
      if (blancos.length < negros.length) {
        blancos.push(jugador);
        sumaB += jugador.puntaje;
      } else if (negros.length < blancos.length) {
        negros.push(jugador);
        sumaN += jugador.puntaje;
      } else {
        // Prioridad 2: Igualada la cantidad, asignar al equipo con menor puntaje acumulado
        if (sumaB <= sumaN) {
          blancos.push(jugador);
          sumaB += jugador.puntaje;
        } else {
          negros.push(jugador);
          sumaN += jugador.puntaje;
        }
      }
    });
  });

  // Mapear de vuelta a InscripcionLocal
  const mapInscripciones = new Map<string, InscripcionLocal>();
  convocados.forEach((c) => {
    mapInscripciones.set(c.apodo.toLowerCase().trim(), c);
  });

  const finalBlancos = blancos.map((b) => mapInscripciones.get(b.apodo.toLowerCase().trim()) || {
    id: b.email,
    apodo: b.apodo,
    email: b.email,
    sede: "CANTON",
    flexible: false,
    juegaConLluvia: true,
    vip: b.vip,
    estadoPago: "AL_DÍA",
    fecha: "",
  });

  const finalNegros = negros.map((n) => mapInscripciones.get(n.apodo.toLowerCase().trim()) || {
    id: n.email,
    apodo: n.apodo,
    email: n.email,
    sede: "CANTON",
    flexible: false,
    juegaConLluvia: true,
    vip: n.vip,
    estadoPago: "AL_DÍA",
    fecha: "",
  });

  const promB = blancos.length > 0 ? Math.round((sumaB / blancos.length) * 10) / 10 : 0;
  const promN = negros.length > 0 ? Math.round((sumaN / negros.length) * 10) / 10 : 0;

  return {
    blancos: finalBlancos,
    negros: finalNegros,
    promedioBlancos: promB,
    promedioNegros: promN,
    sumaBlancos: Math.round(sumaB),
    sumaNegros: Math.round(sumaN),
  };
}
