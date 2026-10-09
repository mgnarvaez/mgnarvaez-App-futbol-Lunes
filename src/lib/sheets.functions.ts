import type { Sede } from "@/lib/types";

export const APPS_SCRIPT_INSCRIPTOS_URL =
  "https://script.google.com/macros/s/AKfycbxrnsy5Nnc3NhuaiMDQttchV96qtNqVuS8DVP8gZePhdt8FJ0V5AD9aAO-MSVIPkGVT/exec?action=read_solapas";
export const APPS_SCRIPT_PLANTEL_URL =
  "https://script.google.com/macros/s/AKfycbwTwlu5T0iMo9JvMMfT9cXZFCq4wnUzhUlHDr-_48UKtU-P8Ap3NpMovNs_pQI_eexxZw/exec";
export const APPS_SCRIPT_ARMADO_URL =
  "https://script.google.com/macros/s/AKfycbyS0-0mcap121rUXakFIa1vqmeL2MfHPefWV6KRwxRLfz_YGuDqFjwv9IZD7zJUVNoM/exec";

export const SHEET_INSCRIPTOS_ID = "1b_JOQKHe6mz_9aVka90hKhEM3Gqaw9U6dR6iK_80TkU";
export const SHEET_PLANTEL_ID = "13_t_cbzP3F7Pbt1Apzto8i7WB2-QCLICP7D5fIUHaf0";
export const SHEET_EQUIPOS_ID = "1vAkjAgb7A7glehP2N2IUhph4ILCHEtELdv9_Ckic8to";

export interface InscriptoSheet {
  timestamp: string;
  fecha: string;
  hora: string;
  email: string;
  turno: string;
  sede: Sede | null;
  flexible: boolean;
  apodo: string;
  juega_con_lluvia: boolean;
  vip: boolean;
}

export interface JugadorPlantelSheet {
  email: string;
  email_alternativo: string;
  nombre: string;
  apodo: string;
  telefono: string;
  edad: string;
  edad_declarada: string;
  fecha_inscripcion: string;
  barrio: string;
  lote: string;
  puesto: string;
  pago: boolean;
}

export interface PuntajeDetalle {
  general: number;
  puesto?: string;
  ataque?: number;
  defensa?: number;
  equipo?: number;
  velocidad?: number;
  individual?: number;
}

export interface ConvocadosOrganizadosResult {
  canton: { apodo: string }[];
  puertos: { apodo: string }[];
  sm: { apodo: string }[];
  puertos2: { apodo: string }[];
  suplentes: { apodo: string }[];
}

export interface RegistroMaterialSheet {
  id: number;
  fecha: string;
  jugador: string;
  materiales: string;
  lote: string;
  mail: string;
}

export interface RankingMaterialSheet {
  jugador: string;
  cantidad: number;
}

const texto = (row: any, i: number) => (row?.[i] ?? "").toString().trim();

function detectarSede(turno: string): Sede | null {
  if (!turno) return null;
  const t = turno.toUpperCase();
  if (t.includes("CANTON") || t.includes("CANTÓN")) return "CANTON";
  if (t.includes("PUERTOS")) return "PUERTOS";
  if (t.includes("SM") || t.includes("MATIAS") || t.includes("MATÍAS")) return "SM";
  return null;
}

export async function leerInscriptos(options?: { solapas?: any }): Promise<InscriptoSheet[]> {
  try {
    let solapas = options?.solapas;
    if (!solapas) {
      const res = await fetch(APPS_SCRIPT_INSCRIPTOS_URL);
      if (res.ok) {
        const data = await res.json();
        solapas = data?.solapas || {};
      }
    }
    if (!solapas) return [];

    const filas: InscriptoSheet[] = [];
    const bajasSet = new Set(
      (solapas.bajas || []).map((b: any) => (typeof b === "string" ? b : b?.apodo || "").toLowerCase().trim())
    );

    // VIP
    const vipPlayers = solapas.respuestas_vip?.players || solapas["Ingresos VIP"]?.players || [];
    for (const p of vipPlayers) {
      const email = (p.email || "").toString().toLowerCase().trim();
      const apodo = (p.apodo || p.rawNombre || "").toString().trim();

      if ((apodo || email) && !bajasSet.has(apodo.toLowerCase())) {
        const rawTs = (p.rawTimestamp || "").toString();
        const [f = "", h = ""] = rawTs.split(" ");
        const pref = (p.rawPref || p.turno || "").toString().trim();

        filas.push({
          timestamp: rawTs,
          fecha: f || rawTs,
          hora: h,
          email,
          turno: pref,
          sede: detectarSede(pref),
          flexible: Boolean(p.rawFlex),
          apodo,
          juega_con_lluvia: Boolean(p.rawPlayIfRains),
          vip: true,
        });
      }
    }

    // General
    const genPlayers = solapas.respuestas_4?.players || solapas["Ingresos General"]?.players || [];
    for (const p of genPlayers) {
      const email = (p.email || "").toString().toLowerCase().trim();
      const apodo = (p.apodo || p.rawNombre || "").toString().trim();

      if ((apodo || email) && !bajasSet.has(apodo.toLowerCase())) {
        const rawTs = (p.rawTimestamp || "").toString();
        const [f = "", h = ""] = rawTs.split(" ");
        const pref = (p.rawPref || p.turno || "").toString().trim();

        filas.push({
          timestamp: rawTs,
          fecha: f || rawTs,
          hora: h,
          email,
          turno: pref,
          sede: detectarSede(pref),
          flexible: Boolean(p.rawFlex),
          apodo,
          juega_con_lluvia: Boolean(p.rawPlayIfRains),
          vip: false,
        });
      }
    }

    return filas;
  } catch (error) {
    console.error("Error al leer inscriptos:", error);
    return [];
  }
}

export async function obtenerInscriptosSheet(options?: { solapas?: any }): Promise<InscriptoSheet[]> {
  return leerInscriptos(options);
}

export async function leerPlantel(): Promise<JugadorPlantelSheet[]> {
  try {
    const res = await fetch(APPS_SCRIPT_PLANTEL_URL);
    if (!res.ok) return [];
    const data = await res.json();

    const rawValues = data?.values || (Array.isArray(data) ? data : []);
    if (!Array.isArray(rawValues) || rawValues.length === 0) return [];

    const primerElem = rawValues[0]?.[0]?.toString().toLowerCase() || "";
    const filas = (primerElem.includes("marca") || primerElem.includes("timestamp") || primerElem.includes("correo"))
      ? rawValues.slice(1)
      : rawValues;

    return filas
      .map((row: any) => ({
        email: texto(row, 1).toLowerCase(),
        email_alternativo: texto(row, 11).toLowerCase(),
        nombre: texto(row, 2),
        apodo: texto(row, 3),
        telefono: texto(row, 4),
        edad: texto(row, 5),
        edad_declarada: texto(row, 5),
        fecha_inscripcion: texto(row, 0),
        barrio: texto(row, 6),
        lote: texto(row, 7),
        puesto: texto(row, 8),
        pago: texto(row, 16).toLowerCase().startsWith("x"),
      }))
      .filter((j: JugadorPlantelSheet) => j.nombre || j.apodo || j.email);
  } catch (error) {
    console.error("Error al leer plantel:", error);
    return [];
  }
}

export async function obtenerPlantelSheet(): Promise<JugadorPlantelSheet[]> {
  return leerPlantel();
}

export async function obtenerPuntajesBdSheet(): Promise<Record<string, PuntajeDetalle>> {
  try {
    const resScript = await fetch();
    if (resScript.ok) {
      const data = await resScript.json();
      if (data && data.puntajes && Object.keys(data.puntajes).length > 0) {
        return data.puntajes;
      }
    }
  } catch (e) {
    // ignore
  }

  try {
    const gvizUrl = ;
    const resGviz = await fetch(gvizUrl);
    if (resGviz.ok) {
      const text = await resGviz.text();
      const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);/);
      if (match && match[1]) {
        const json = JSON.parse(match[1]);
        const rows = json?.table?.rows || [];
        const cols = (json?.table?.cols || []).map((c: any) => (c?.label || "").toLowerCase());
        
        const map: Record<string, PuntajeDetalle> = {};
        rows.forEach((r: any) => {
          const cells = r?.c || [];
          const getVal = (idx: number) => cells[idx]?.v ?? cells[idx]?.f ?? "";
          const emailOrName = String(getVal(0)).toLowerCase().trim();
          if (!emailOrName) return;

          let general = 50, ataq = 50, def = 50, eq = 50, vel = 50, ind = 50, puesto = "MED";
          cells.forEach((cell: any, idx: number) => {
            const label = cols[idx] || "";
            const val = cell?.v;
            if (val !== undefined && val !== null) {
              if (label.includes("gen") || label.includes("punt")) general = Number(val) || general;
              else if (label.includes("ataq") || label.includes("atack")) ataq = Number(val) || ataq;
              else if (label.includes("def")) def = Number(val) || def;
              else if (label.includes("eq") || label.includes("equipo")) eq = Number(val) || eq;
              else if (label.includes("vel")) vel = Number(val) || vel;
              else if (label.includes("ind")) ind = Number(val) || ind;
              else if (label.includes("puesto") || label.includes("pos")) puesto = String(val);
            }
          });

          if (general === 50 && (ataq !== 50 || def !== 50)) {
            general = Number(((ataq + def + eq) / 3).toFixed(1));
          }

          map[emailOrName] = {
            general: general > 10 ? general : general * 10,
            puesto,
            ataque: ataq > 10 ? ataq : ataq * 10,
            defensa: def > 10 ? def : def * 10,
            equipo: eq > 10 ? eq : eq * 10,
            velocidad: vel > 10 ? vel : vel * 10,
            individual: ind > 10 ? ind : ind * 10,
          };
        });
        if (Object.keys(map).length > 0) return map;
      }
    }
  } catch (err) {
    console.error("Error leyendo puntajes BD:", err);
  }

  return {};
}

export async function obtenerConvocadosOrganizadosSheet(): Promise<ConvocadosOrganizadosResult> {
  try {
    const res = await fetch(APPS_SCRIPT_INSCRIPTOS_URL);
    if (!res.ok) return { canton: [], puertos: [], sm: [], puertos2: [], suplentes: [] };
    const data = await res.json();
    const solapas = data?.solapas || {};

    const parseSolapa = (rawList: any): { apodo: string }[] => {
      if (!Array.isArray(rawList)) return [];
      return rawList
        .map((item: any) => {
          if (typeof item === "string") return { apodo: item };
          if (item && typeof item === "object") {
            return { apodo: item.apodo || item.nombre || item.rawNombre || item.email || "" };
          }
          return { apodo: "" };
        })
        .filter((j) => j.apodo.trim().length > 0);
    };

    return {
      canton: parseSolapa(solapas.canton || solapas.Canton || solapas["EL CANTON"] || solapas["El Cantón"]),
      puertos: parseSolapa(solapas.puertos || solapas.Puertos),
      sm: parseSolapa(solapas.sm || solapas.SM || solapas["SAN MATIAS"] || solapas["San Matías"]),
      puertos2: parseSolapa(solapas.puertos2 || solapas.Puertos2 || solapas["PUERTOS 2"] || solapas["Puertos 2"]),
      suplentes: parseSolapa(solapas.suplentes || solapas.Suplentes),
    };
  } catch (error) {
    console.error("Error al obtener convocados organizados de Sheet:", error);
    return { canton: [], puertos: [], sm: [], puertos2: [], suplentes: [] };
  }
}

export async function ejecutarOrganizarConvocadosSheet(): Promise<{ ok: boolean; mensaje: string; solapas?: any }> {
  try {
    const baseUrl = APPS_SCRIPT_INSCRIPTOS_URL.replace("?action=read_solapas", "");
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({ action: "ejecutar_organizar" }),
    });

    const data = await res.json();
    if (data.success || data.status === "success") {
      return { ok: true, mensaje: "¡Convocatorias reorganizadas en la planilla de Google!", solapas: data.solapas };
    } else {
      return { ok: false, mensaje: data.error || data.message || "Error al organizar convocados." };
    }
  } catch (error) {
    console.error("Error al ejecutar organizar convocados:", error);
    return { ok: false, mensaje: "Error de conexión con la planilla." };
  }
}

export const ejecutarOrganizarSheet = ejecutarOrganizarConvocadosSheet;

export async function registrarBajaSheet(
  apodo: string,
  motivo: string = "Baja desde App Web"
): Promise<{ ok: boolean; mensaje: string }> {
  try {
    const baseUrl = APPS_SCRIPT_INSCRIPTOS_URL.replace("?action=read_solapas", "");
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({
        action: "registrar_baja",
        params: { apodo, motivo },
      }),
    });

    const data = await res.json();
    if (data.success || data.status === "success") {
      return { ok: true, mensaje:  };
    } else {
      return { ok: false, mensaje: data.error || data.message || "Error al registrar la baja en la planilla." };
    }
  } catch (error) {
    console.error("Error al registrar baja:", error);
    return { ok: false, mensaje: "Error de conexión al intentar registrar la baja." };
  }
}

export async function obtenerMaterialesSheet(): Promise<{
  historial: RegistroMaterialSheet[];
  ranking: RankingMaterialSheet[];
}> {
  try {
    const res = await fetch();
    if (!res.ok) return { historial: [], ranking: [] };
    const data = await res.json();
    return {
      historial: (data?.historial || []).map((item: any) => ({
        id: item.id || 0,
        fecha: (item.fecha || "").toString(),
        jugador: (item.jugador || "").toString(),
        materiales: (item.materiales || "").toString(),
        lote: (item.lote || "").toString(),
        mail: (item.mail || "").toString(),
      })),
      ranking: data?.ranking || [],
    };
  } catch (error) {
    console.error("Error al leer materiales:", error);
    return { historial: [], ranking: [] };
  }
}

export async function registrarMaterialesSheet(
  jugador: string,
  materiales: string[]
): Promise<{ ok: boolean; mensaje: string }> {
  try {
    const res = await fetch(APPS_SCRIPT_PLANTEL_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        jugador,
        materiales,
        params: {
          jugador,
          materiales,
        },
      }),
    });
    const data = await res.json();
    if (data.success) {
      return { ok: true, mensaje: "Materiales registrados con éxito." };
    } else {
      return { ok: false, mensaje: data.error || "Error al registrar materiales." };
    }
  } catch (error) {
    console.error("Error al registrar materiales:", error);
    return { ok: false, mensaje: "Error de conexión al registrar materiales." };
  }
}
