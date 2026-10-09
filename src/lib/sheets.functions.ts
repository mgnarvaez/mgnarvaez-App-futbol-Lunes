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
  velocidad?: number;
  individual?: number;
}

export interface ConvocadosOrganizadosResult {
  canton: InscriptoSheet[];
  puertos: InscriptoSheet[];
  sm: InscriptoSheet[];
  puertos2: InscriptoSheet[];
  suplentes: InscriptoSheet[];
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

export export async export function leerInscriptos(options?: { solapas?: any }): Promise<InscriptoSheet[]> {
  try {
    let data = options?.solapas;
    if (!data) {
      const res = await fetch(APPS_SCRIPT_INSCRIPTOS_URL);
      if (!res.ok) return [];
      data = await res.json();
    }
    const solapas = data?.solapas || data || {};
    const bajasSet = new Set(
      (solapas.bajas || []).map((b: string) => b.toLowerCase().trim())
    );

    const filas: InscriptoSheet[] = [];

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

export export async export function obtenerInscriptosSheet(): Promise<InscriptoSheet[]> {
  return leerInscriptos();
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

export export async export function leerPlantel(): Promise<JugadorPlantelSheet[]> {
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

export export async export function obtenerPlantelSheet(): Promise<JugadorPlantelSheet[]> {
  return leerPlantel();
}

export export async export function leerEquiposArmados(): Promise<EquipoSede[]> {
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

export export async export function obtenerEquiposArmadosSheet(): Promise<EquipoSede[]> {
  return leerEquiposArmados();
}

export export async export function registrarBajaSheet(
  apodo: string,
  motivo: string = "Baja desde App Web"
): Promise<{ ok: boolean; mensaje: string }> {
  try {
    const res = await fetch(APPS_SCRIPT_POST_URL, {
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
      return { ok: true, mensaje: `Baja de ${apodo} registrada con éxito en la planilla.` };
    } else {
      return { ok: false, mensaje: data.error || data.message || "Error al registrar la baja en la planilla." };
    }
  } catch (error) {
    console.error("Error al registrar baja:", error);
    return { ok: false, mensaje: "Error de conexión al intentar registrar la baja." };
  }
}

export export async export function ejecutarOrganizarConvocadosSheet(): Promise<{ ok: boolean; mensaje: string; solapas?: any }> {
  try {
    const res = await fetch(APPS_SCRIPT_POST_URL, {
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

export export async export function obtenerConvocadosOrganizadosSheet(): Promise<ConvocadosOrganizadosResult> {
  try {
    const res = await fetch(APPS_SCRIPT_INSCRIPTOS_URL);
    if (!res.ok) return { canton: [], puertos: [], sm: [], puertos2: [], suplentes: [] };
    const data = await res.json();
    const solapas = data?.solapas || {};

    const parsePlayers = (arr: any[]): InscriptoSheet[] => {
      if (!Array.isArray(arr)) return [];
      return arr.map((p) => ({
        timestamp: (p.rawTimestamp || p.timestamp || "").toString(),
        fecha: (p.fecha || "").toString(),
        hora: (p.hora || "").toString(),
        email: (p.email || "").toString().toLowerCase().trim(),
        turno: (p.rawPref || p.turno || "").toString().trim(),
        sede: detectarSede(p.rawPref || p.turno || ""),
        flexible: Boolean(p.rawFlex || p.flexible),
        apodo: (p.apodo || p.rawNombre || p.nombre || p.email || "").toString().trim(),
        juega_con_lluvia: Boolean(p.rawPlayIfRains || p.juega_con_lluvia),
        vip: Boolean(p.vip),
      })).filter((p) => p.apodo || p.email);
    };

    return {
      canton: parsePlayers(solapas.canton?.players || solapas.canton || []),
      puertos: parsePlayers(solapas.puertos?.players || solapas.puertos || []),
      sm: parsePlayers(solapas.sm?.players || solapas.sm || []),
      puertos2: parsePlayers(solapas.puertos2?.players || solapas.puertos2 || []),
      suplentes: parsePlayers(solapas.suplentes?.players || solapas.suplentes || []),
    };
  } catch (err) {
    console.error("Error al leer convocados de solapas:", err);
    return { canton: [], puertos: [], sm: [], puertos2: [], suplentes: [] };
  }
}

export export async export function obtenerPuntajesBdSheet(): Promise<Record<string, PuntajeDetalle>> {
  try {
    const res = await fetch(`${APPS_SCRIPT_ARMADO_URL}?action=read_puntajes`);
    if (res.ok) {
      const data = await res.json();
      if (data?.puntajes && Object.keys(data.puntajes).length > 0) {
        return data.puntajes;
      }
    }
  } catch (e) {
    console.warn("Fallo endpoint Apps Script para puntajes, probando GViz fallback...");
  }

  try {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${SHEET_EQUIPOS_ID}/gviz/tq?tqx=out:json`;
    const res = await fetch(gvizUrl);
    const text = await res.text();
    const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\((.*)\);/s);
    if (!jsonMatch) return {};

    const parsed = JSON.parse(jsonMatch[1]);
    const rows = parsed?.table?.rows || [];
    const resObj: Record<string, PuntajeDetalle> = {};

    rows.forEach((r: any) => {
      const c = r.c || [];
      const email = (c[0]?.v || "").toString().toLowerCase().trim();
      const apodo = (c[1]?.v || "").toString().toLowerCase().trim();
      if (!email && !apodo) return;

      const obj: PuntajeDetalle = {
        general: Number(c[2]?.v || 50),
        puesto: (c[3]?.v || "MED").toString(),
        ataque: Number(c[4]?.v || 50),
        defensa: Number(c[5]?.v || 50),
        equipo: Number(c[6]?.v || 50),
        velocidad: Number(c[7]?.v || 50),
        individual: Number(c[8]?.v || 50),
      };

      if (email) resObj[email] = obj;
      if (apodo) resObj[apodo] = obj;
    });

    return resObj;
  } catch (err) {
    console.error("Error al leer puntajes de BD:", err);
    return {};
  }
}

export export async export function obtenerMaterialesSheet(): Promise<{
  historial: RegistroMaterialSheet[];
  ranking: RankingMaterialSheet[];
}> {
  try {
    const res = await fetch(`${APPS_SCRIPT_PLANTEL_URL}?action=read_materiales`);
    if (!res.ok) return { historial: [], ranking: [] };
    const data = await res.json();
    return {
      historial: Array.isArray(data?.historial)
        ? data.historial.map((h: any, idx: number) => ({
            id: h.id || idx,
            fecha: (h.fecha || "").toString(),
            jugador: (h.jugador || "").toString(),
            materiales: (h.materiales || "").toString(),
            lote: (h.lote || "").toString(),
            mail: (h.mail || "").toString(),
          }))
        : [],
      ranking: Array.isArray(data?.ranking) ? data.ranking : [],
    };
  } catch (error) {
    console.error("Error al leer materiales:", error);
    return { historial: [], ranking: [] };
  }
}

export export async export function registrarMaterialesSheet(
  jugador: string,
  materiales: string[]
): Promise<{ ok: boolean; mensaje: string }> {
  try {
    const materialesStr = Array.isArray(materiales) ? materiales.join(" + ") : (materiales || "").toString();
    const res = await fetch(APPS_SCRIPT_PLANTEL_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "registrar_materiales",
        jugador,
        materiales: materialesStr,
        params: {
          jugador,
          materiales: materialesStr,
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
