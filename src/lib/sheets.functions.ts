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
  puesto?: number | string;
  ataque?: number;
  defensa?: number;
  equipo?: number;
  individual?: number;
  velocidad?: number;
  general?: number;
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

export async function leerInscriptos(options?: { solapas?: any }): Promise<InscriptoSheet[]> {
  try {
    let data = options?.solapas;
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

    const procesarJugadores = (lista: any[], esVip: boolean) => {
      if (!Array.isArray(lista)) return;
      for (const p of lista) {
        const email = (p.email || "").toString().toLowerCase().trim();
        const apodo = (p.apodo || p.rawNombre || p.nombre || "").toString().trim();

        if ((apodo || email) && !bajasSet.has(apodo.toLowerCase())) {
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
            flexible: Boolean(p.rawFlex || p.flexible),
            apodo,
            juega_con_lluvia: Boolean(p.rawPlayIfRains || p.juega_con_lluvia),
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

/**
 * Revisa el estado de pago del jugador en la planilla del Plantel.
 * Revisa las columnas de pago (desde el final hacia atrás, incluyendo Columna R / index 17
 * y Columna Q / index 16) para verificar si pagó en el último período.
 */
function evaluarEstadoPagoJugador(row: any[]): boolean {
  if (!Array.isArray(row) || row.length <= 10) return false;

  // Revisar desde las columnas más recientes hacia atrás (index 17, 16, 15, 14, 13, 12, 10)
  const indicesPagos = [17, 16, 15, 14, 13, 12, 10];
  for (const idx of indicesPagos) {
    if (idx < row.length) {
      const val = (row[idx] ?? "").toString().toLowerCase().trim();
      if (val.startsWith("x")) {
        return true;
      }
    }
  }
  return false;
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
          pago: evaluarEstadoPagoJugador(row),
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

/**
 * Obtiene la base de datos de puntajes e indicadores individuales de habilidad
 * desde la planilla de Puntajes / BD puntajes (ID: 1vAkjAgb7A7glehP2N2IUhph4ILCHEtELdv9_Ckic8to)
 */
export async function obtenerPuntajesBdSheet(): Promise<Record<string, PuntajeDetalle>> {
  const puntajesMap: Record<string, PuntajeDetalle> = {};

  try {
    // 1. Intento por consulta pública directa GViz a la planilla de Puntajes
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${SHEET_EQUIPOS_ID}/gviz/tq?tqx=out:json&sheet=Puntajes`;
    const resGviz = await fetch(gvizUrl);
    if (resGviz.ok) {
      const textGviz = await resGviz.text();
      const jsonStr = textGviz.substring(textGviz.indexOf("{"), textGviz.lastIndexOf("}") + 1);
      if (jsonStr) {
        const dataGviz = JSON.parse(jsonStr);
        const rows = dataGviz?.table?.rows || [];
        rows.forEach((r: any) => {
          const cells = r?.c || [];
          const mail = (cells[0]?.v ?? "").toString().toLowerCase().trim();
          const apodo = (cells[1]?.v ?? "").toString().trim();
          const puestoNum = cells[2]?.v !== undefined ? Number(cells[2].v) : 2;
          const ataque = Number(cells[3]?.v ?? 50);
          const defensa = Number(cells[4]?.v ?? 50);
          const equipo = Number(cells[5]?.v ?? 50);
          const individual = Number(cells[6]?.v ?? 50);
          const velocidad = Number(cells[7]?.v ?? 50);
          const mailAlt = (cells[8]?.v ?? "").toString().toLowerCase().trim();

          const detalle: PuntajeDetalle = {
            puesto: puestoNum,
            ataque,
            defensa,
            equipo,
            individual,
            velocidad,
          };

          if (mail && mail.includes("@")) puntajesMap[mail] = detalle;
          if (mailAlt && mailAlt.includes("@")) puntajesMap[mailAlt] = detalle;
          if (apodo) puntajesMap[apodo.toLowerCase()] = detalle;
        });

        if (Object.keys(puntajesMap).length > 0) {
          return puntajesMap;
        }
      }
    }
  } catch (e) {
    console.error("Nota: GViz fetch no devolvió datos, intentando por Apps Script:", e);
  }

  try {
    // 2. Intento mediante Apps Script API
    const resScript = await fetch(`${APPS_SCRIPT_ARMADO_URL}?action=read_puntajes`);
    if (resScript.ok) {
      const dataScript = await resScript.json();
      const filas = dataScript?.puntajes || dataScript?.values || [];
      filas.forEach((fila: any[]) => {
        if (!Array.isArray(fila)) return;
        const mail = (fila[0] || "").toString().toLowerCase().trim();
        const apodo = (fila[1] || "").toString().trim();
        const pNum = Number(fila[2] ?? 2);
        const vAt = Number(fila[3] ?? 50);
        const vDef = Number(fila[4] ?? 50);
        const vEq = Number(fila[5] ?? 50);
        const vIn = Number(fila[6] ?? 50);
        const vVel = Number(fila[7] ?? 50);

        const detalle: PuntajeDetalle = {
          puesto: pNum,
          ataque: vAt,
          defensa: vDef,
          equipo: vEq,
          individual: vIn,
          velocidad: vVel,
        };

        if (mail) puntajesMap[mail] = detalle;
        if (apodo) puntajesMap[apodo.toLowerCase()] = detalle;
      });
    }
  } catch (err) {
    console.error("Error al leer puntajes por Apps Script:", err);
  }

  return puntajesMap;
}

export interface ConvocadosOrganizadosResult {
  solapas?: any;
  canton?: InscriptoSheet[];
  sm?: InscriptoSheet[];
  puertos?: InscriptoSheet[];
  puertos2?: InscriptoSheet[];
}

export async function obtenerConvocadosOrganizadosSheet(): Promise<ConvocadosOrganizadosResult> {
  try {
    const res = await fetch(APPS_SCRIPT_INSCRIPTOS_URL);
    if (!res.ok) return {};
    const data = await res.json();
    return { solapas: data?.solapas };
  } catch (error) {
    console.error("Error al leer convocados organizados:", error);
    return {};
  }
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
      return { ok: true, mensaje: "¡Convocatorias reorganizadas en la planilla de Google!" };
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
  mensaje?: string;
}> {
  try {
    const res = await fetch(APPS_SCRIPT_POST_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "ejecutar_organizar" }),
    });
    if (!res.ok) return { ok: false, mensaje: "Error HTTP " + res.status };
    const data = await res.json();
    return { ok: data.success !== false, solapas: data.solapas, mensaje: data.error || "OK" };
  } catch (error) {
    return { ok: false, mensaje: error instanceof Error ? error.message : "Error desconocido" };
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
    return {
      historial: data?.historial || [],
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

    let data;
    try {
      data = JSON.parse(textRes);
    } catch {
      return { ok: true, mensaje: "Materiales registrados con éxito." };
    }

    if (data.status === "success" || data.success || data.ok || data.result === "success") {
      return { ok: true, mensaje: "Materiales registrados con éxito." };
    }
    return { ok: false, mensaje: data.error || data.message || "Error al registrar materiales." };
  } catch (error) {
    console.error("Error al registrar materiales:", error);
    return { ok: false, mensaje: "Error de conexión al registrar materiales." };
  }
}
