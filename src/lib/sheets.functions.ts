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
  id?: string | number;
  fecha: string;
  jugador: string;
  materiales: string;
  lote: string;
  mail?: string;
}

export interface RankingMaterialSheet {
  jugador: string;
  cantidad: number;
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
      if (!res.ok) return [];
      const data = await res.json();
      solapas = data?.solapas || {};
    }

    const filas: InscriptoSheet[] = [];
    const bajasSet = new Set(
      (solapas.bajas || []).map((b: string) => b.toLowerCase().trim())
    );

    const vistas = new Set<string>();

    const vipPlayers = solapas.respuestas_vip?.players || solapas["Ingresos VIP"]?.players || [];
    for (const p of vipPlayers) {
      const email = (p.email || "").toString().toLowerCase().trim();
      const apodo = (p.apodo || p.rawNombre || "").toString().trim();
      const key = email + "_" + apodo.toLowerCase();

      if ((apodo || email) && !bajasSet.has(apodo.toLowerCase()) && !vistas.has(key)) {
        vistas.add(key);
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
      const key = email + "_" + apodo.toLowerCase();

      if ((apodo || email) && !bajasSet.has(apodo.toLowerCase()) && !vistas.has(key)) {
        vistas.add(key);
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
        const pagoCelda = texto(row, 16).toLowerCase();
        const estaPagado = pagoCelda === "x" || pagoCelda.startsWith("x");

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

export async function leerEquiposArmados(): Promise<EquipoSede[]> {
  try {
    const res = await fetch(APPS_SCRIPT_ARMADO_URL + "?action=read_equipos");
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
  motivo: string = "Baja registrada desde App Web"
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
      return { ok: true, mensaje: "Baja de " + apodo + " registrada con éxito." };
    } else {
      return { ok: false, mensaje: data.error || data.message || "Error al registrar baja." };
    }
  } catch (error) {
    console.error("Error al registrar baja:", error);
    return { ok: false, mensaje: "Error de conexión al registrar la baja." };
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
    if (data.success || data.status === "success" || data.ok) {
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

export async function obtenerMaterialesSheet(): Promise<{
  historial: RegistroMaterialSheet[];
  ranking: RankingMaterialSheet[];
}> {
  try {
    const res = await fetch(APPS_SCRIPT_PLANTEL_URL + "?action=read_materiales");
    if (!res.ok) return { historial: [], ranking: [] };
    const data = await res.json();
    const rawHistorial = data?.historial || [];
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

export async function actualizarPagoSheet(
  email: string,
  apodo: string,
  nombre: string,
  esPago: boolean
): Promise<{ ok: boolean; mensaje: string }> {
  try {
    const valorPago = esPago ? "x" : "";
    const payload = {
      action: "actualizar_pago",
      jugador: apodo || nombre || email,
      apodo: apodo || "",
      nombre: nombre || "",
      email: email || "",
      mail: email || "",
      pago: valorPago,
      estado: valorPago,
      valor: valorPago,
      columna: "Q",
      params: {
        action: "actualizar_pago",
        jugador: apodo || nombre || email,
        apodo: apodo || "",
        nombre: nombre || "",
        email: email || "",
        mail: email || "",
        pago: valorPago,
        estado: valorPago,
        valor: valorPago,
        columna: "Q",
      },
    };

    const res = await fetch(APPS_SCRIPT_PLANTEL_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });

    const textRes = await res.text();
    if (!textRes) {
      return { ok: true, mensaje: "Pago actualizado en la planilla." };
    }

    let data: any = {};
    try {
      data = JSON.parse(textRes);
    } catch {
      return { ok: true, mensaje: "Pago actualizado en la planilla." };
    }

    if (data.status === "success" || data.success || data.ok || data.result === "success") {
      return { ok: true, mensaje: "Pago actualizado en la planilla." };
    }
    return { ok: false, mensaje: data.error || data.message || "Error al actualizar pago." };
  } catch (error) {
    console.error("Error al actualizar pago:", error);
    return { ok: false, mensaje: "Error de conexión al actualizar pago." };
  }
}

export async function obtenerPuntajesBdSheet(): Promise<Record<string, PuntajeDetalle>> {
  try {
    const res = await fetch(APPS_SCRIPT_ARMADO_URL + "?action=read_puntajes");
    if (res.ok) {
      const data = await res.json();
      if (data && data.puntajes && Object.keys(data.puntajes).length > 0) {
        return data.puntajes;
      }
    }
  } catch (error) {
    console.error("Error al leer puntajes de Apps Script:", error);
  }

  try {
    const gvizUrl = "https://docs.google.com/spreadsheets/d/" + SHEET_EQUIPOS_ID + "/gviz/tq?tqx=out:json&sheet=Puntajes";
    const resGviz = await fetch(gvizUrl);
    if (resGviz.ok) {
      const text = await resGviz.text();
      const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\((.*)\);?/s);
      if (jsonMatch && jsonMatch[1]) {
        const parsed = JSON.parse(jsonMatch[1]);
        const rows = parsed?.table?.rows || [];
        const result: Record<string, PuntajeDetalle> = {};

        rows.forEach((r: any) => {
          const cells = r.c || [];
          const mail = (cells[0]?.v || "").toString().toLowerCase().trim();
          const apodo = (cells[1]?.v || "").toString().trim();
          const puestoVal = cells[2]?.v;
          const vAt = Number(cells[3]?.v || 50);
          const vDef = Number(cells[4]?.v || 50);
          const vEq = Number(cells[5]?.v || 50);
          const vIn = Number(cells[6]?.v || 50);
          const vVel = Number(cells[7]?.v || 50);
          const mailAlt = (cells[8]?.v || "").toString().toLowerCase().trim();

          const detalle: PuntajeDetalle = {
            puesto: puestoVal !== undefined ? puestoVal : 2,
            ataque: vAt,
            defensa: vDef,
            equipo: vEq,
            individual: vIn,
            velocidad: vVel,
          };

          if (mail) result[mail] = detalle;
          if (mailAlt) result[mailAlt] = detalle;
          if (apodo) result[apodo.toLowerCase()] = detalle;
        });

        if (Object.keys(result).length > 0) {
          return result;
        }
      }
    }
  } catch (error) {
    console.error("Error en fallback GViz para puntajes:", error);
  }

  return {};
}

export async function obtenerConvocadosOrganizadosSheet(): Promise<ConvocadosOrganizadosResult> {
  try {
    const res = await fetch(APPS_SCRIPT_INSCRIPTOS_URL);
    if (!res.ok) return { canton: [], puertos: [], sm: [], puertos2: [], suplentes: [] };
    const data = await res.json();
    const solapas = data?.solapas || {};

    const getPlayersList = (solapaObj: any): { apodo: string }[] => {
      if (!solapaObj) return [];
      const rawArr = Array.isArray(solapaObj)
        ? solapaObj
        : Array.isArray(solapaObj.players)
        ? solapaObj.players
        : Array.isArray(solapaObj.convocados)
        ? solapaObj.convocados
        : [];

      return rawArr
        .map((j: any) => {
          if (typeof j === "string") return { apodo: j.trim() };
          const nombreClean = (j.apodo || j.nombre || j.email || "").toString().replace(/[❌🚫⚠️]/g, "").trim();
          return { apodo: nombreClean };
        })
        .filter((j: any) => Boolean(j.apodo));
    };

    return {
      canton: getPlayersList(solapas.canton || solapas.CANTON || solapas["20 hs CANTON"]),
      puertos: getPlayersList(solapas.puertos || solapas.PUERTOS || solapas["21:15 hs PUERTOS"]),
      sm: getPlayersList(solapas.sm || solapas.SM || solapas["20:00 hs SM"]),
      puertos2: getPlayersList(solapas.puertos2 || solapas["PUERTOS 2"] || solapas["Puertos 2"]),
      suplentes: getPlayersList(solapas.suplentes || solapas.SUPLENTES),
    };
  } catch (error) {
    console.error("Error al obtener convocados organizados de Sheet:", error);
    return { canton: [], puertos: [], sm: [], puertos2: [], suplentes: [] };
  }
}
