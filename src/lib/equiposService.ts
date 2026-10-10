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
  general?: number;
  puesto?: string | number;
  ataque?: number;
  defensa?: number;
  equipo?: number;
  velocidad?: number;
  individual?: number;
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

export function dividirEnEquipos(
  convocados: InscripcionLocal[],
  bdPuntajes: Record<string, PuntajeDetalle | number> = {},
  infoPlantel: Record<string, { puesto?: string; email?: string; apodo?: string }> = {}
): EquiposPartido {
  const norm = (s: string) => (s || "").toLowerCase().trim().replace(/\s+/g, " ");

  const buscarPuntaje = (j: InscripcionLocal): { puntaje: number; puestoNum: number } => {
    const mail = norm(j.email);
    const apodo = norm(j.apodo);

    let datosBd: PuntajeDetalle | number | undefined = bdPuntajes[mail] || bdPuntajes[apodo];
    if (!datosBd) {
      const keys = Object.keys(bdPuntajes);
      const matchedKey = keys.find(
        (k) => (mail && k.includes(mail)) || (apodo && k.includes(apodo)) || (apodo && apodo.includes(k))
      );
      if (matchedKey) datosBd = bdPuntajes[matchedKey];
    }

    let datosPlantel = infoPlantel[mail] || infoPlantel[apodo];

    let puestoNum = 2; // MED por defecto
    if (typeof datosBd === "object" && datosBd?.puesto !== undefined) {
      puestoNum = parsearPuesto(datosBd.puesto);
    } else if (datosPlantel?.puesto) {
      puestoNum = parsearPuesto(datosPlantel.puesto);
    }

    let puntaje = 50;
    if (typeof datosBd === "number") {
      puntaje = datosBd > 10 ? datosBd : datosBd * 10;
    } else if (typeof datosBd === "object" && datosBd !== null) {
      if (datosBd.general !== undefined && datosBd.general > 0) {
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

    return { puntaje: Number(puntaje.toFixed(1)), puestoNum };
  };

  const jugadoresEnriquecidos: JugadorPuestoPuntaje[] = convocados.map((j) => {
    const { puntaje, puestoNum } = buscarPuntaje(j);
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
      puntaje,
    };
  });

  const porPuesto: Record<number, JugadorPuestoPuntaje[]> = { 0: [], 1: [], 2: [], 3: [] };
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
