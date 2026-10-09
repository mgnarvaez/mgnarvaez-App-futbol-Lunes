import type { Sede } from "@/lib/types";

export const APPS_SCRIPT_INSCRIPTOS_URL = "https://script.google.com/macros/s/AKfycbxrnsy5Nnc3NhuaiMDQttchV96qtNqVuS8DVP8gZePhdt8FJ0V5AD9aAO-MSVIPkGVT/exec?action=read_solapas";
export const APPS_SCRIPT_POST_URL = "https://script.google.com/macros/s/AKfycbxrnsy5Nnc3NhuaiMDQttchV96qtNqVuS8DVP8gZePhdt8FJ0V5AD9aAO-MSVIPkGVT/exec";
export const APPS_SCRIPT_PLANTEL_URL = "https://script.google.com/macros/s/AKfycbwTwlu5T0iMo9JvMMfT9cXZFCq4wnUzhUlHDr-_48UKtU-P8Ap3NpMovNs_pQI_eexxZw/exec";

export const SHEET_INSCRIPTOS_ID = "1b_JOQKHe6mz_9aVka90hKhEM3Gqaw9U6dR6iK_80TkU";
export const SHEET_PLANTEL_ID = "13_t_cbzP3F7Pbt1Apzto8i7WB2-QCLICP7D5fIUHaf0";

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

export interface RegistroMaterialSheet {
  id?: string;
  fecha: string;
  jugador: string;
  materiales: string;
  lote: string;
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
        if (apodo || email) {
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

export async function ejecutarOrganizarSheet(): Promise<{ ok: boolean; solapas?: any; mensaje?: string }> {
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

export async function registrarBajaSheet(apodo: string, motivo: string = "Baja registrada desde App Web"): Promise<{ ok: boolean; mensaje: string }> {
  try {
    const res = await fetch(APPS_SCRIPT_POST_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "registrar_baja", params: { apodo, motivo } }),
    });
    if (!res.ok) return { ok: false, mensaje: "Error HTTP " + res.status };
    const data = await res.json();
    return { ok: data.success !== false, mensaje: data.error || "OK" };
  } catch (error) {
    return { ok: false, mensaje: error instanceof Error ? error.message : "Error desconocido" };
  }
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
          edad: edad_declarada,
          edad_declarada,
          fecha_inscripcion,
          barrio: texto(row, 6),
          lote: texto(row, 7),
          puesto: texto(row, 8),
          pago: texto(row, 16).toLowerCase().startsWith("x"),
        };
      })
      .filter((j: JugadorPlantelSheet) => j.nombre || j.apodo || j.email);
  } catch (error) {
    console.error("Error al leer plantel:", error);
    return [];
  }
}

export async function obtenerPlantelSheet(): Promise<JugadorPlantelSheet[]> {
  return leerPlantel();
}

export async function obtenerMaterialesSheet(): Promise<{ historial: RegistroMaterialSheet[] }> {
  try {
    const res = await fetch(`${APPS_SCRIPT_PLANTEL_URL}?action=read_materiales`);
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("Error al leer materiales:", error);
    return { historial: [] };
  }
}

export async function registrarMaterialesSheet(jugador: string, materiales: string[]) {
  try {
    const materialesTexto = Array.isArray(materiales) ? materiales.join(", ") : materiales;
    const payload = {
      action: "registrar_materiales",
      jugador,
      materiales: materialesTexto,
      params: {
        jugador,
        materiales: materialesTexto
      }
    };

    const res = await fetch(APPS_SCRIPT_PLANTEL_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.status === "success" || data.success || data.ok) {
      return { ok: true, mensaje: "Materiales registrados con éxito." };
    }
    return { ok: false, mensaje: data.error || data.message || "Error al registrar materiales." };
  } catch (error) {
    console.error("Error al registrar materiales:", error);
    return { ok: false, mensaje: "Error de conexión." };
  }
}
