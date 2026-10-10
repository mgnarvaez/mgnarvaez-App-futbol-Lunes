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
  general?: number;
  puesto?: number | string;
  ataque?: number;
  defensa?: number;
  equipo?: number;
  individual?: number;
  velocidad?: number;
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

    const procesarJugadores = (lista: any[], esVip: boolean) => {
      for (const p of lista) {
        const email = (p.email || "").toString().toLowerCase().trim();
        const apodo = (p.apodo || p.rawNombre || "").toString().trim();
        if ((apodo || email) && esNombreJugadorValido(apodo)) {
          const rawTs = (p.rawTimestamp || "").toString();
          const parts = rawTs.split(" ");
          const f = parts[0] || rawTs;
          const h = parts[1] || "";
          const pref = (p.rawPref || p.turno || "").toString().trim();

          filas.push({
            timestamp: rawTs,
            fecha: f,
            hora: h,
            email,
            turno: pref,
            sede: detectarSede(pref),
            flexible: Boolean(p.rawFlex),
            apodo,
            juega_con_lluvia: Boolean(p.rawPlayIfRains),
            vip: esVip,
          });
        }
      }
    };

    procesarJugadores(solapas.respuestas_vip?.players || solapas["Ingresos VIP"]?.players || [], true);
    procesarJugadores(solapas.respuestas_4?.players || solapas["Ingresos General"]?.players || [], false);

    return filas;
  } catch (error) {
    console.error("Error al leer inscriptos:", error);
    return [];
  }
}

export async function obtenerInscriptosSheet(): Promise<InscriptoSheet[]> {
  return leerInscriptos();
}

export interface ConvocadosOrganizadosResult {
  canton: { apodo: string; email?: string }[];
  sm: { apodo: string; email?: string }[];
  puertos: { apodo: string; email?: string }[];
  puertos2?: { apodo: string; email?: string }[];
  suplentes?: { apodo: string; email?: string }[];
}

export async function obtenerConvocadosOrganizadosSheet(): Promise<ConvocadosOrganizadosResult> {
  try {
    const res = await fetch(APPS_SCRIPT_INSCRIPTOS_URL);
    if (!res.ok) return { canton: [], sm: [], puertos: [], puertos2: [], suplentes: [] };
    const data = await res.json();
    const solapas = data?.solapas || {};

    const procesarSolapa = (playersArr: any[]) => {
      if (!Array.isArray(playersArr)) return [];
      return playersArr
        .filter((p) => esNombreJugadorValido(p.apodo || p.nombre || p.email))
        .map((p) => ({
          apodo: (p.apodo || p.nombre || p.email || "").toString().trim(),
          email: (p.email || "").toString().trim(),
        }));
    };

    return {
      canton: procesarSolapa(solapas.canton?.players || solapas["20 hs CANTON"]?.players),
      sm: procesarSolapa(solapas.SM?.players || solapas.sm?.players || solapas["20:00 hs SM"]?.players),
      puertos: procesarSolapa(solapas.puertos?.players || solapas["21:15 hs PUERTOS"]?.players),
      puertos2: procesarSolapa(solapas.puertos2?.players || solapas["Puertos 2"]?.players),
      suplentes: [],
    };
  } catch (error) {
    console.error("Error al leer convocados organizados:", error);
    return { canton: [], sm: [], puertos: [], puertos2: [], suplentes: [] };
  }
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
    const filas =
      primerElem.includes("marca") ||
      primerElem.includes("timestamp") ||
      primerElem.includes("correo")
        ? rawValues.slice(1)
        : rawValues;

    return filas
      .map((row: any) => {
        const fecha_inscripcion = texto(row, 0);
        const edad_declarada = texto(row, 5);

        // Escanea las columnas de pago (cols 10 a 17) para ver si pagó la cuota más reciente
        let estaPagado = false;
        for (let colIdx = 17; colIdx >= 10; colIdx--) {
          const valCol = texto(row, colIdx).toLowerCase();
          if (valCol.startsWith("x")) {
            estaPagado = true;
            break;
          }
        }

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
          pago: estaPagado,
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

export async function obtenerPuntajesBdSheet(): Promise<Record<string, PuntajeDetalle>> {
  try {
    // 1. Intentar desde Apps Script de Inscriptos / Armado
    const res = await fetch(APPS_SCRIPT_ARMADO_URL + "?action=read_puntajes").catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      const map: Record<string, PuntajeDetalle> = {};
      const filas = data?.puntajes || data?.values || [];
      filas.forEach((r: any[]) => {
        const email = (r[0] || "").toString().toLowerCase().trim();
        if (email) {
          map[email] = {
            puesto: r[2],
            ataque: Number(r[3] ?? 50),
            defensa: Number(r[4] ?? 50),
            equipo: Number(r[5] ?? 50),
            individual: Number(r[6] ?? 50),
            velocidad: Number(r[7] ?? 50),
          };
        }
      });
      if (Object.keys(map).length > 0) return map;
    }

    // 2. Fallback: Consulta directa via Google Visualization API a la planilla de Equipos (1vAkjAgb7A7glehP2N2IUhph4ILCHEtELdv9_Ckic8to)
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${SHEET_EQUIPOS_ID}/gviz/tq?tqx=out:json`;
    const gvizRes = await fetch(gvizUrl).catch(() => null);
    if (gvizRes && gvizRes.ok) {
      const txt = await gvizRes.text();
      const jsonMatch = txt.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);/);
      if (jsonMatch && jsonMatch[1]) {
        const parsed = JSON.parse(jsonMatch[1]);
        const rows = parsed?.table?.rows || [];
        const map: Record<string, PuntajeDetalle> = {};

        rows.forEach((rowObj: any) => {
          const cells = rowObj?.c || [];
          const email = (cells[0]?.v || "").toString().toLowerCase().trim();
          const apodo = (cells[1]?.v || "").toString().toLowerCase().trim();
          const puestoVal = cells[2]?.v;
          const vAt = Number(cells[3]?.v ?? 50);
          const vDef = Number(cells[4]?.v ?? 50);
          const vEq = Number(cells[5]?.v ?? 50);
          const vIn = Number(cells[6]?.v ?? 50);
          const vVel = Number(cells[7]?.v ?? 50);
          const mailAlt = (cells[8]?.v || "").toString().toLowerCase().trim();

          const item: PuntajeDetalle = {
            puesto: puestoVal,
            ataque: vAt,
            defensa: vDef,
            equipo: vEq,
            individual: vIn,
            velocidad: vVel,
          };

          if (email) map[email] = item;
          if (mailAlt) map[mailAlt] = item;
          if (apodo) map[apodo] = item;
        });
        return map;
      }
    }
  } catch (err) {
    console.error("Error al obtener puntajes BD:", err);
  }
  return {};
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

export async function ejecutarArmadoEquipos(params?: {
  suspensionLluvia?: string;
  suspensionOtra?: string;
}): Promise<{ ok: boolean; mensaje: string }> {
  try {
    const res = await fetch(APPS_SCRIPT_ARMADO_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
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
      return {
        ok: true,
        mensaje: `Baja de ${apodo} registrada con éxito en la planilla.`,
      };
    } else {
      return {
        ok: false,
        mensaje: data.error || data.message || "Error al registrar la baja en la planilla.",
      };
    }
  } catch (error) {
    console.error("Error al registrar baja:", error);
    return { ok: false, mensaje: "Error de conexión al intentar registrar la baja." };
  }
}

export async function ejecutarOrganizarConvocadosSheet(): Promise<{
  ok: boolean;
  solapas?: any;
  mensaje: string;
}> {
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
      return { ok: true, solapas: data.solapas, mensaje: "¡Convocatorias reorganizadas en la planilla de Google!" };
    } else {
      return { ok: false, mensaje: data.error || data.message || "Error al organizar convocados." };
    }
  } catch (error) {
    console.error("Error al ejecutar organizar convocados:", error);
    return { ok: false, mensaje: "Error de conexión con la planilla." };
  }
}

export async function ejecutarOrganizarSheet(): Promise<{
  ok: boolean;
  solapas?: any;
  mensaje: string;
}> {
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
    return {
      historial: Array.isArray(data?.historial) ? data.historial : Array.isArray(data) ? data : [],
      ranking: Array.isArray(data?.ranking) ? data.ranking : [],
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
    const materialesTexto = Array.isArray(materiales) ? materiales.join(", ") : materiales;
    const payload = {
      action: "registrar_materiales",
      jugador,
      materiales: materialesTexto,
      params: {
        jugador,
        materiales: materialesTexto,
      },
    };

    const res = await fetch(APPS_SCRIPT_PLANTEL_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });

    const textRes = await res.text();
    if (!textRes) {
      return { ok: true, mensaje: "Materiales registrados con éxito." };
    }

    let data: any = {};
    try {
      data = JSON.parse(textRes);
    } catch {
      return { ok: true, mensaje: "Materiales registrados con éxito." };
    }

    if (data.status === "success" || data.success || data.ok) {
      return { ok: true, mensaje: "Materiales registrados con éxito." };
    }
    return { ok: false, mensaje: data.error || data.message || "Error al registrar materiales." };
  } catch (error) {
    console.error("Error al registrar materiales:", error);
    return { ok: false, mensaje: "Error de conexión al registrar materiales." };
  }
}
