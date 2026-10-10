import type { Sede } from "@/lib/types";

export const APPS_SCRIPT_INSCRIPTOS_URL =
  "https://script.google.com/macros/s/AKfycbxrnsy5Nnc3NhuaiMDQttchV96qtNqVuS8DVP8gZePhdt8FJ0V5AD9aAO-MSVIPkGVT/exec?action=read_solapas";
export const APPS_SCRIPT_PLANTEL_URL =
  "https://script.google.com/macros/s/AKfycbwTwlu5T0iMo9JvMMfT9cXZFCq4wnUzhUlHDr-_48UKtU-P8Ap3NpMovNs_pQI_eexxZw/exec";
export const APPS_SCRIPT_ARMADO_URL =
  "https://script.google.com/macros/s/AKfycbyS0-0mcap121rUXakFIa1vqmeL2MfHPefWV6KRwxRLfz_YGuDqFjwv9IZD7zJUVNoM/exec";
export const APPS_SCRIPT_POST_URL = APPS_SCRIPT_INSCRIPTOS_URL.replace("?action=read_solapas", "");

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
  general?: number;
  puesto?: string | number;
  ataque?: number;
  defensa?: number;
  equipo?: number;
  velocidad?: number;
  individual?: number;
}

export interface ConvocadosOrganizadosResult {
  canton: { apodo: string; email?: string }[];
  puertos: { apodo: string; email?: string }[];
  sm: { apodo: string; email?: string }[];
  puertos2: { apodo: string; email?: string }[];
  suplentes: { apodo: string; email?: string }[];
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
      (solapas.bajas || []).map((b: string) => b.toLowerCase().trim())
    );

    // 1. VIP Form Responses
    const vipRaw = solapas.respuestas_vip?.players || solapas["Ingresos VIP"]?.players || [];
    for (const p of vipRaw) {
      const email = (p.email || "").toString().toLowerCase().trim();
      const apodo = (p.apodo || p.rawNombre || "").toString().trim();

      if ((apodo || email) && !bajasSet.has(apodo.toLowerCase())) {
        const rawTs = (p.rawTimestamp || "").toString();
        const [f = "", h = ""] = rawTs.split(" ");
        let pref = (p.rawPref || p.turno || "").toString().trim();

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

    // 2. General Form Responses
    const genRaw = solapas.respuestas_4?.players || solapas["Ingresos General"]?.players || [];
    for (const p of genRaw) {
      const email = (p.email || "").toString().toLowerCase().trim();
      const apodo = (p.apodo || p.rawNombre || "").toString().trim();

      if ((apodo || email) && !bajasSet.has(apodo.toLowerCase())) {
        const rawTs = (p.rawTimestamp || "").toString();
        const [f = "", h = ""] = rawTs.split(" ");
        let pref = (p.rawPref || p.turno || "").toString().trim();

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

    // Find the latest payment column dynamically from headers
    const headerRow = rawValues[0] || [];
    let paymentColIdx = 16; // Default to col 16
    for (let i = headerRow.length - 1; i >= 10; i--) {
      const hText = (headerRow[i] || "").toString().toLowerCase();
      if (hText.includes("pago")) {
        paymentColIdx = i;
        break;
      }
    }

    return filas
      .map((row: any) => {
        const fecha_inscripcion = texto(row, 0);
        const edad_declarada = texto(row, 5);
        
        // Evaluate payment: check if paymentColIdx has 'x' or if any recent payment column has 'x'
        let tienePago = texto(row, paymentColIdx).toLowerCase().startsWith("x");
        if (!tienePago && paymentColIdx > 10) {
          // Fallback: check previous payment column
          tienePago = texto(row, paymentColIdx - 1).toLowerCase().startsWith("x");
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
          pago: tienePago,
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
  const mapa: Record<string, PuntajeDetalle> = {};

  try {
    const res = await fetch();
    if (res.ok) {
      const data = await res.json();
      const items = data?.puntajes || data?.values || data || [];
      if (Array.isArray(items)) {
        items.forEach((row: any) => {
          if (!row) return;
          const email = (row.email || row.mail || row[1] || "").toString().toLowerCase().trim();
          const apodo = (row.apodo || row.nombre || row[2] || "").toString().toLowerCase().trim();

          const itemPuntaje: PuntajeDetalle = {
            general: Number(row.general || row.puntaje || row.nivel || row[9] || 50),
            puesto: row.puesto || row[8] || "MED",
            ataque: Number(row.ataque || row[3] || 50),
            defensa: Number(row.defensa || row[4] || 50),
            equipo: Number(row.equipo || row[5] || 50),
            velocidad: Number(row.velocidad || row[6] || 50),
            individual: Number(row.individual || row[7] || 50),
          };

          if (email) mapa[email] = itemPuntaje;
          if (apodo) mapa[apodo] = itemPuntaje;
        });
      }
    }
  } catch (e) {
    console.warn("Error reading puntajes via Apps Script:", e);
  }

  if (Object.keys(mapa).length === 0) {
    try {
      const gvizUrl = ;
      const res = await fetch(gvizUrl);
      if (res.ok) {
        const text = await res.text();
        const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);
        if (jsonMatch && jsonMatch[1]) {
          const gvizData = JSON.parse(jsonMatch[1]);
          const rows = gvizData?.table?.rows || [];
          rows.forEach((r: any) => {
            const cells = r?.c || [];
            const getVal = (idx: number) => cells[idx]?.v ?? cells[idx]?.f ?? "";
            const email = getVal(1).toString().toLowerCase().trim();
            const apodo = getVal(2).toString().toLowerCase().trim();
            if (!email && !apodo) return;

            const itemPuntaje: PuntajeDetalle = {
              puesto: getVal(8) || "MED",
              ataque: Number(getVal(3)) || 50,
              defensa: Number(getVal(4)) || 50,
              equipo: Number(getVal(5)) || 50,
              velocidad: Number(getVal(6)) || 50,
              individual: Number(getVal(7)) || 50,
              general: Number(getVal(9)) || 50,
            };

            if (email) mapa[email] = itemPuntaje;
            if (apodo) mapa[apodo] = itemPuntaje;
          });
        }
      }
    } catch (e) {
      console.warn("Error reading puntajes via GViz:", e);
    }
  }

  return mapa;
}

export async function obtenerConvocadosOrganizadosSheet(): Promise<ConvocadosOrganizadosResult> {
  const vacio: ConvocadosOrganizadosResult = {
    canton: [],
    puertos: [],
    sm: [],
    puertos2: [],
    suplentes: [],
  };

  try {
    const res = await fetch(APPS_SCRIPT_INSCRIPTOS_URL);
    if (!res.ok) return vacio;
    const data = await res.json();
    const solapas = data?.solapas || {};

    const ext = (arr: any[]) =>
      (arr || []).map((p: any) => ({
        apodo: (p.apodo || p.nombre || p.rawNombre || "").toString().trim(),
        email: (p.email || "").toString().toLowerCase().trim(),
      })).filter((x) => x.apodo || x.email);

    return {
      canton: ext(solapas.canton?.players || solapas["20 hs CANTON"]?.players),
      puertos: ext(solapas.puertos?.players || solapas["21:15 hs PUERTOS"]?.players),
      sm: ext(solapas.SM?.players || solapas.sm?.players || solapas["20:00 hs SM"]?.players),
      puertos2: ext(solapas.puertos2?.players || solapas["Puertos 2"]?.players),
      suplentes: ext(solapas.suplentes?.players || solapas.Suplentes?.players),
    };
  } catch (error) {
    console.error("Error al leer convocados organizados:", error);
    return vacio;
  }
}

export async function leerEquiposArmados(): Promise<EquipoSede[]> {
  try {
    const res = await fetch();
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
      return { ok: true, mensaje:  };
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

export async function obtenerMaterialesSheet(): Promise<{
  historial: RegistroMaterialSheet[];
  ranking: RankingMaterialSheet[];
}> {
  try {
    const res = await fetch();
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
    const res = await fetch(APPS_SCRIPT_PLANTEL_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        params: { jugador, materiales },
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
