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

export const TAB_VIP = "Ingresos VIP";
export const TAB_GENERAL = "Ingresos General";
export const TAB_PLANTEL = "Respuestas de formulario 1";

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
  estado?: string;
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
  id?: number | string;
  fecha: string;
  jugador: string;
  materiales: string;
  lote: string;
  mail?: string;
  telefono?: string;
}

export interface RankingMaterialSheet {
  jugador: string;
  cantidad: number;
}

export interface PuntajeDetalle {
  general: number;
  ataque: number;
  defensa: number;
  equipo: number;
  individual: number;
  velocidad: number;
  puesto: string;
}

export interface ConvocadosOrganizadosResult {
  canton: { apodo: string }[];
  puertos: { apodo: string }[];
  sm: { apodo: string }[];
  puertos2: { apodo: string }[];
  suplentes: { apodo: string }[];
}

const texto = (row: any, i: number) => (row?.[i] ?? "").toString().trim();

function detectarSede(turno: string): Sede | null {
  if (!turno) return null;
  const t = turno.toUpperCase();
  if (t.includes("PUERTOS 2") || t.includes("PUERTOS2")) return "PUERTOS 2";
  if (t.includes("CANTON") || t.includes("CANTÓN")) return "CANTON";
  if (t.includes("PUERTOS")) return "PUERTOS";
  if (t.includes("SM") || t.includes("MATIAS") || t.includes("MATÍAS")) return "SM";
  return null;
}

function esNombreJugadorValido(nombre: string): boolean {
  if (!nombre) return false;
  const n = nombre.toUpperCase().trim();
  if (n === "" || n === "JUGADOR" || n === "ESTADO" || n === "EMAIL") return false;
  if (n.includes("CANCELAD") || n.includes("SUSPENDID") || n.includes("LLUVIA")) return false;
  if (n.startsWith("❌") || n.startsWith("🚫") || n.startsWith("⚠️")) return false;
  return true;
}

// 1. LEER INGRESOS VIP E INGRESOS GENERAL
export async function leerInscriptos(datosDirectos?: any): Promise<InscriptoSheet[]> {
  try {
    let data = datosDirectos;
    if (!data) {
      const res = await fetch(APPS_SCRIPT_INSCRIPTOS_URL);
      if (!res.ok) return [];
      data = await res.json();
    }
    const filas: InscriptoSheet[] = [];
    const solapas = data?.solapas || {};
    const bajasSet = new Set(
      (solapas.bajas || []).map((b: string) => b.toLowerCase().trim())
    );

    const vipPlayers = solapas.respuestas_vip?.players || solapas["Ingresos VIP"]?.players || [];
    for (const p of vipPlayers) {
      const email = (p.email || "").toString().toLowerCase().trim();
      const apodo = (p.apodo || p.rawNombre || "").toString().trim();

      if (esNombreJugadorValido(apodo) && !bajasSet.has(apodo.toLowerCase())) {
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

    const genPlayers = solapas.respuestas_4?.players || solapas["Ingresos General"]?.players || [];
    for (const p of genPlayers) {
      const email = (p.email || "").toString().toLowerCase().trim();
      const apodo = (p.apodo || p.rawNombre || "").toString().trim();

      if (esNombreJugadorValido(apodo) && !bajasSet.has(apodo.toLowerCase())) {
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

export async function obtenerInscriptosSheet(): Promise<InscriptoSheet[]> {
  return leerInscriptos();
}

// 2. LEER PLANTEL OFICIAL
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
        
        // LECTURA DE PAGO DE COLUMNA Q (Índice 16 de la hoja Respuestas de formulario 1)
        const valorColumnaQ = texto(row, 16).toLowerCase();
        const estaAlDia = valorColumnaQ.startsWith("x") || valorColumnaQ.includes("x");

        return {
          email: texto(row, 1).toLowerCase().trim(),
          email_alternativo: texto(row, 11).toLowerCase().trim(),
          nombre: texto(row, 2).trim(),
          apodo: texto(row, 3).trim(),
          telefono: texto(row, 4).trim(),
          edad: edadActual(edad_declarada, fecha_inscripcion),
          edad_declarada,
          fecha_inscripcion,
          barrio: texto(row, 6).trim(),
          lote: texto(row, 7).trim(),
          puesto: texto(row, 8).trim(),
          pago: estaAlDia,
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

// ESCRITURA DE PAGO A COLUMNA Q DE GOOGLE SHEETS
export async function actualizarPagoSheet(
  emailOApodo: string,
  pago: boolean
): Promise<{ ok: boolean; mensaje: string }> {
  try {
    const payload = {
      action: "actualizar_pago",
      email: emailOApodo,
      apodo: emailOApodo,
      pago: pago ? "x" : "",
      columna: "Q",
      params: {
        email: emailOApodo,
        apodo: emailOApodo,
        pago: pago ? "x" : "",
        columna: "Q"
      }
    };

    const res = await fetch(APPS_SCRIPT_PLANTEL_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });

    const textRes = await res.text();
    if (!textRes) return { ok: true, mensaje: "Estado de pago actualizado en la planilla." };

    let data: any = {};
    try { data = JSON.parse(textRes); } catch { return { ok: true, mensaje: "Estado de pago actualizado." }; }

    if (data.status === "success" || data.success || data.ok) {
      return { ok: true, mensaje: "Estado de pago actualizado en la planilla." };
    }
    return { ok: false, mensaje: data.error || data.message || "Error al actualizar pago." };
  } catch (error) {
    console.error("Error al actualizar pago en la planilla:", error);
    return { ok: false, mensaje: "Error de conexión al actualizar pago." };
  }
}

// 3. OTRAS FUNCIONES REQUERIDAS
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

export async function ejecutarArmadoEquipos(params?: {
  suspensionLluvia?: string;
  suspensionOtra?: string;
}): Promise<{ ok: boolean; mensaje: string }> {
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

export async function correrArmadoEquipos(params?: {
  suspensionLluvia?: string;
  suspensionOtra?: string;
}): Promise<{ ok: boolean; mensaje: string }> {
  return ejecutarArmadoEquipos(params);
}

export async function registrarBajaSheet(
  apodo: string,
  motivo: string = "Baja desde App Web"
): Promise<{ ok: boolean; mensaje: string }> {
  try {
    const baseUrl = APPS_SCRIPT_INSCRIPTOS_URL.replace("?action=read_solapas", "");
    const res = await fetch(baseUrl, {
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
      return { ok: false, mensaje: data.error || data.message || "Error al registrar la baja." };
    }
  } catch (error) {
    console.error("Error al registrar baja:", error);
    return { ok: false, mensaje: "Error de conexión al intentar registrar la baja." };
  }
}

export async function ejecutarOrganizarConvocadosSheet(): Promise<{ ok: boolean; solapas?: any; mensaje: string }> {
  try {
    const res = await fetch(APPS_SCRIPT_POST_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "ejecutar_organizar" }),
    });

    const data = await res.json();
    if (data.success || data.status === "success" || data.ok) {
      return { ok: true, solapas: data.solapas, mensaje: "¡Convocatorias reorganizadas en la planilla de Google!" };
    } else {
      return { ok: false, mensaje: data.error || data.message || "Error al organizar convocados." };
    }
  } catch (error) {
    console.error("Error al ejecutar organizar convocados:", error);
    return { ok: false, mensaje: "Error de conexión con la planilla." };
  }
}

export async function ejecutarOrganizarSheet(): Promise<{ ok: boolean; solapas?: any; mensaje: string }> {
  return ejecutarOrganizarConvocadosSheet();
}

export async function obtenerMaterialesSheet(): Promise<{
  historial: RegistroMaterialSheet[];
  ranking: RankingMaterialSheet[];
}> {
  try {
    const res = await fetch(`${APPS_SCRIPT_PLANTEL_URL}?action=read_materiales`);
    if (!res.ok) return { historial: [], ranking: [] };
    const data = await res.json();
    const rawHistorial = Array.isArray(data?.historial) ? data.historial : (Array.isArray(data) ? data : []);
    const historialLimpio = rawHistorial.map((h: any, idx: number) => ({
      id: h.id || idx,
      fecha: (h.fecha || "").toString(),
      jugador: (h.jugador || "").toString(),
      materiales: (h.materiales || "").toString(),
      lote: (h.lote || "").toString(),
      mail: (h.mail || "").toString(),
    }));

    return {
      historial: historialLimpio,
      ranking: data?.ranking || [],
    };
  } catch (error) {
    console.error("Error al leer materiales:", error);
    return { historial: [], ranking: [] };
  }
}

export async function registrarMaterialesSheet(
  jugador: string,
  materiales: string[] | string
): Promise<{ ok: boolean; mensaje: string }> {
  try {
    const materialesArr = Array.isArray(materiales) ? materiales : [materiales];
    const res = await fetch(APPS_SCRIPT_PLANTEL_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "registrar_materiales",
        jugador,
        materiales: materialesArr.join(" + "),
        params: {
          jugador,
          materiales: materialesArr,
        },
      }),
    });
    const data = await res.json();
    if (data.success || data.status === "success") {
      return { ok: true, mensaje: "Materiales registrados con éxito." };
    } else {
      return { ok: false, mensaje: data.error || data.message || "Error al registrar materiales." };
    }
  } catch (error) {
    console.error("Error al registrar materiales:", error);
    return { ok: false, mensaje: "Error de conexión al registrar materiales." };
  }
}

export async function obtenerPuntajesBdSheet(): Promise<Record<string, PuntajeDetalle>> {
  try {
    const res = await fetch(`${APPS_SCRIPT_ARMADO_URL}?action=read_puntajes`);
    if (!res.ok) return {};
    const data = await res.json();
    return data?.puntajes || {};
  } catch (error) {
    console.error("Error al leer puntajes BD:", error);
    return {};
  }
}

export async function obtenerConvocadosOrganizadosSheet(): Promise<ConvocadosOrganizadosResult> {
  try {
    const res = await fetch(APPS_SCRIPT_INSCRIPTOS_URL);
    if (!res.ok) return { canton: [], puertos: [], sm: [], puertos2: [], suplentes: [] };
    const data = await res.json();
    const solapas = data?.solapas || {};

    const mapear = (arr: any[]) =>
      (arr || []).map((j: any) => ({ apodo: (j.apodo || j.nombre || j.email || "").toString().trim() }));

    return {
      canton: mapear(solapas.canton || []),
      puertos: mapear(solapas.puertos || []),
      sm: mapear(solapas.sm || []),
      puertos2: mapear(solapas.puertos2 || []),
      suplentes: mapear(solapas.suplentes || []),
    };
  } catch (error) {
    console.error("Error al obtener convocados organizados de Sheet:", error);
    return { canton: [], puertos: [], sm: [], puertos2: [], suplentes: [] };
  }
}
