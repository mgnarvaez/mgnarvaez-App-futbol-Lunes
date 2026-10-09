import type { Sede } from "@/lib/types";

export const APPS_SCRIPT_INSCRIPTOS_URL =
  "https://script.google.com/macros/s/AKfycbxrnsy5Nnc3NhuaiMDQttchV96qtNqVuS8DVP8gZePhdt8FJ0V5AD9aAO-MSVIPkGVT/exec?action=read_solapas";
export const APPS_SCRIPT_POST_URL =
  "https://script.google.com/macros/s/AKfycbxrnsy5Nnc3NhuaiMDQttchV96qtNqVuS8DVP8gZePhdt8FJ0V5AD9aAO-MSVIPkGVT/exec";
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

export interface JugadorEquipo {
  nombre: string;
  puesto: string;
}

export interface EquipoSede {
  sede: Sede;
  puntajeBlancos: string;
  puntajeNegros: string;
  blancos: JugadorEquipo[];
  negros: JugadorEquipo[];
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

export interface PuntajeDetalle {
  general: number;
  puesto: string;
  ataque: number;
  defensa: number;
  equipo: number;
  individual: number;
  velocidad: number;
}

export interface ConvocadosOrganizadosResult {
  canton: { apodo: string; email?: string }[];
  puertos: { apodo: string; email?: string }[];
  sm: { apodo: string; email?: string }[];
  puertos2: { apodo: string; email?: string }[];
  suplentes: { apodo: string; email?: string }[];
  solapasOriginales?: any;
}

const texto = (row: any, i: number) => (row?.[i] ?? "").toString().trim();

function detectarSede(turno: string): Sede | null {
  if (!turno) return null;
  const t = turno.toUpperCase();
  if (t.includes("CANTON") || t.includes("CANTÓN")) return "CANTON";
  if (t.includes("PUERTOS 2") || t.includes("PUERTOS2")) return "PUERTOS 2";
  if (t.includes("PUERTOS")) return "PUERTOS";
  if (t.includes("SM") || t.includes("MATIAS") || t.includes("MATÍAS")) return "SM";
  return null;
}

export async function leerInscriptos(options?: { solapas?: any }): Promise<InscriptoSheet[]> {
  try {
    let data = options?.solapas;
    if (!data) {
      const res = await fetch(APPS_SCRIPT_INSCRIPTOS_URL);
      if (!res.ok) return [];
      data = await res.json();
    }

    const filas: InscriptoSheet[] = [];
    const solapas = data?.solapas || data || {};
    const bajasSet = new Set(
      (solapas.bajas || []).map((b: any) => (typeof b === "string" ? b : b?.apodo || "").toLowerCase().trim())
    );

    // 1. Inscriptos VIP
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

    // 2. Inscriptos General
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

function parsearFecha(valor: string): Date | null {
  if (!valor) return null;
  const v = valor.trim();
  const dIso = new Date(v);
  if (!Number.isNaN(dIso.getTime())) return dIso;

  const [fechaParte] = v.split(" ");
  const partes = (fechaParte ?? "").split(/[/-]/).map((p) => Number(p));
  const [d, m, a] = partes;
  if (!d || !m || !a) return null;
  const anio = a < 100 ? 2000 + a : a;
  const fecha = new Date(anio, m - 1, d);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function edadActual(edadDeclarada: string, fechaInscripcion: string): string {
  const base = Number(edadDeclarada.replace(/\D/g, ""));
  const fecha = parsearFecha(fechaInscripcion);
  if (!base || !fecha) return edadDeclarada;

  const hoy = new Date();
  let anios = hoy.getFullYear() - fecha.getFullYear();
  const antesDelAniversario =
    hoy.getMonth() < fecha.getMonth() ||
    (hoy.getMonth() === fecha.getMonth() && hoy.getDate() < fecha.getDate());
  if (antesDelAniversario) anios -= 1;

  return String(base + Math.max(0, anios));
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
      .map((row: any) => {
        const fecha_inscripcion = texto(row, 0);
        const edad_declarada = texto(row, 5);
        return {
          email: texto(row, 1).toLowerCase(),
          email_alternativo: texto(row, 11).toLowerCase(),
          nombre: texto(row, 2),
          apodo: texto(row, 3),
          telefono: texto(row, 4),
          edad: edadActual(edad_declarada, fecha_inscripcion),
          edad_declarada,
          fecha_inscripcion,
          barrio: texto(row, 6),
          lote: texto(row, 7),
          puesto: texto(row, 8),
          pago: texto(row, 16).toLowerCase().startsWith("x"),
        };
      })
      .filter((j: JugadorPlantelSheet) => j.nombre || j.apodo || j.email)
      .sort((a: JugadorPlantelSheet, b: JugadorPlantelSheet) =>
        (a.apodo || a.nombre).localeCompare(b.apodo || b.nombre, "es")
      );
  } catch (error) {
    console.error("Error al leer plantel:", error);
    return [];
  }
}

export async function obtenerPlantelSheet(): Promise<JugadorPlantelSheet[]> {
  return leerPlantel();
}

export async function leerEquiposArmados(): Promise<EquipoSede[]> {
  try {
    const res = await fetch(`${APPS_SCRIPT_ARMADO_URL}?action=read_equipos`);
    if (!res.ok) return [];
    const data = await res.json();
    return data?.equipos || [];
  } catch (error) {
    console.error("Error al leer equipos armados:", error);
    return [];
  }
}

export async function obtenerEquiposArmadosSheet(): Promise<EquipoSede[]> {
  return leerEquiposArmados();
}

export async function ejecutarArmadoEquipos(params?: any): Promise<{ ok: boolean; mensaje: string }> {
  try {
    const res = await fetch(APPS_SCRIPT_ARMADO_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "balance_teams", params: params || {} }),
    });

    const data = await res.json();
    if (data.status === "success" || data.success) {
      return { ok: true, mensaje: "¡Equipos armados con éxito en la planilla!" };
    } else {
      return { ok: false, mensaje: data.message || "Error al ejecutar el armado." };
    }
  } catch (error) {
    console.error("Error al ejecutar armado de equipos:", error);
    return { ok: false, mensaje: "Error de conexión con la planilla de armado." };
  }
}

export async function correrArmadoEquipos(params?: any): Promise<{ ok: boolean; mensaje: string }> {
  return ejecutarArmadoEquipos(params);
}

export async function registrarBajaSheet(
  apodo: string,
  motivo: string = "Baja desde App Web"
): Promise<{ ok: boolean; mensaje: string }> {
  try {
    const res = await fetch(APPS_SCRIPT_POST_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "registrar_baja",
        params: { apodo, motivo },
      }),
    });

    const data = await res.json();
    if (data.success || data.status === "success") {
      return { ok: true, mensaje: `Baja de ${apodo} registrada con éxito en la planilla.` };
    } else {
      return { ok: false, mensaje: data.error || data.message || "Error al registrar la baja en la planilla." };
    }
  } catch (error) {
    console.error("Error al registrar baja:", error);
    return { ok: false, mensaje: "Error de conexión al intentar registrar la baja." };
  }
}

export async function ejecutarOrganizarConvocadosSheet(): Promise<{ ok: boolean; mensaje: string; solapas?: any }> {
  try {
    const res = await fetch(APPS_SCRIPT_POST_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
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

export async function ejecutarOrganizarSheet(): Promise<{ ok: boolean; mensaje: string; solapas?: any }> {
  return ejecutarOrganizarConvocadosSheet();
}

export async function obtenerConvocadosOrganizadosSheet(): Promise<ConvocadosOrganizadosResult> {
  try {
    const res = await fetch(APPS_SCRIPT_INSCRIPTOS_URL);
    if (!res.ok) return { canton: [], puertos: [], sm: [], puertos2: [], suplentes: [] };
    const data = await res.json();
    const solapas = data?.solapas || data || {};

    const parseSolapa = (arr: any[]) =>
      (arr || []).map((item: any) => ({
        apodo: (typeof item === "string" ? item : item?.apodo || item?.nombre || "").toString().trim(),
        email: item?.email ? item.email.toString().toLowerCase().trim() : "",
      })).filter((x: any) => x.apodo);

    return {
      canton: parseSolapa(solapas.canton || solapas["Canton"] || solapas["Cantón"]),
      puertos: parseSolapa(solapas.puertos || solapas["Puertos"]),
      sm: parseSolapa(solapas.sm || solapas["San Matias"] || solapas["San Matías"]),
      puertos2: parseSolapa(solapas.puertos2 || solapas["Puertos 2"]),
      suplentes: parseSolapa(solapas.suplentes || solapas["Suplentes"]),
      solapasOriginales: solapas,
    };
  } catch (error) {
    console.error("Error al obtener convocados organizados de la Sheet:", error);
    return { canton: [], puertos: [], sm: [], puertos2: [], suplentes: [] };
  }
}

export async function obtenerPuntajesBdSheet(): Promise<Record<string, PuntajeDetalle>> {
  try {
    // 1. Intento por Apps Script
    const res = await fetch(`${APPS_SCRIPT_ARMADO_URL}?action=read_puntajes`);
    if (res.ok) {
      const data = await res.json();
      if (data?.puntajes && typeof data.puntajes === "object") {
        return data.puntajes;
      }
    }

    // 2. Fallback por Google Visualization API (GViz)
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${SHEET_EQUIPOS_ID}/gviz/tq?tqx=out:json`;
    const resGviz = await fetch(gvizUrl);
    if (!resGviz.ok) return {};
    const textGviz = await resGviz.text();

    const jsonMatch = textGviz.match(/google\.visualization\.Query\.setResponse\((.*)\);/);
    if (!jsonMatch || !jsonMatch[1]) return {};

    const parsedGviz = JSON.parse(jsonMatch[1]);
    const rows = parsedGviz?.table?.rows || [];

    const resultado: Record<string, PuntajeDetalle> = {};
    for (const r of rows) {
      const c = r?.c || [];
      const mailVal = (c[0]?.v || "").toString().toLowerCase().trim();
      const apodoVal = (c[1]?.v || "").toString().toLowerCase().trim();

      const key = mailVal || apodoVal;
      if (!key) continue;

      const gen = Number(c[2]?.v || 50);
      const pst = (c[3]?.v || "MED").toString();
      const atq = Number(c[4]?.v || 50);
      const def = Number(c[5]?.v || 50);
      const eq = Number(c[6]?.v || 50);
      const ind = Number(c[7]?.v || 50);
      const vel = Number(c[8]?.v || 50);

      const detalle: PuntajeDetalle = {
        general: gen,
        puesto: pst,
        ataque: atq,
        defensa: def,
        equipo: eq,
        individual: ind,
        velocidad: vel,
      };

      if (mailVal) resultado[mailVal] = detalle;
      if (apodoVal) resultado[apodoVal] = detalle;
    }

    return resultado;
  } catch (error) {
    console.error("Error al obtener puntajes BD:", error);
    return {};
  }
}

export async function obtenerMaterialesSheet(): Promise<{
  historial: RegistroMaterialSheet[];
  ranking: RankingMaterialSheet[];
}> {
  try {
    const res = await fetch(`${APPS_SCRIPT_PLANTEL_URL}?action=read_materiales`);
    if (!res.ok) return { historial: [], ranking: [] };
    const data = await res.json();

    const rawHist = Array.isArray(data?.historial) ? data.historial : [];
    const rawRank = Array.isArray(data?.ranking) ? data.ranking : [];

    const historialSanitizado: RegistroMaterialSheet[] = rawHist.map((item: any, idx: number) => ({
      id: item?.id ?? idx + 1,
      fecha: (item?.fecha ?? "").toString().trim(),
      jugador: (item?.jugador ?? "").toString().trim(),
      materiales: (item?.materiales ?? "").toString().trim(),
      lote: (item?.lote ?? "").toString().trim(),
      mail: (item?.mail ?? "").toString().trim(),
    }));

    const rankingSanitizado: RankingMaterialSheet[] = rawRank.map((item: any) => ({
      jugador: (item?.jugador ?? "").toString().trim(),
      cantidad: Number(item?.cantidad ?? 0),
    }));

    return {
      historial: historialSanitizado,
      ranking: rankingSanitizado,
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
    if (data.success || data.ok) {
      return { ok: true, mensaje: "Materiales registrados con éxito." };
    } else {
      return { ok: false, mensaje: data.error || data.mensaje || "Error al registrar materiales." };
    }
  } catch (error) {
    console.error("Error al registrar materiales:", error);
    return { ok: false, mensaje: "Error de conexión al registrar materiales." };
  }
}
