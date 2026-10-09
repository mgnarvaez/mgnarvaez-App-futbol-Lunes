import type { Sede } from "@/lib/types";

export const APPS_SCRIPT_INSCRIPTOS_URL =
  "https://script.google.com/macros/s/AKfycbxrnsy5Nnc3NhuaiMDQttchV96qtNqVuS8DVP8gZePhdt8FJ0V5AD9aAO-MSVIPkGVT/exec?action=read_solapas";
export const APPS_SCRIPT_PLANTEL_URL =
  "https://script.google.com/macros/s/AKfycbwTwlu5T0iMo9JvMMfT9cXZFCq4wnUzhUlHDr-_48UKtU-P8Ap3NpMovNs_pQI_eexxZw/exec";
export const APPS_SCRIPT_ARMADO_URL =
  "https://script.google.com/macros/s/AKfycbyS0-0mcap121rUXakFIa1vqmeL2MfHPefWV6KRwxRLfz_YGuDqFjwv9IZD7zJUVNoM/exec";

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

export interface JugadorConvocadoSolapa {
  apodo: string;
  email: string;
  puesto?: string;
  condicion?: "TITULAR" | "SUPLENTE" | "FLEX";
}

export interface ConvocadosOrganizadosResult {
  canton: JugadorConvocadoSolapa[];
  puertos: JugadorConvocadoSolapa[];
  sm: JugadorConvocadoSolapa[];
  puertos2: JugadorConvocadoSolapa[];
  suplentes: JugadorConvocadoSolapa[];
}

const texto = (row: any, i: number) => (row?.[i] ?? "").toString().trim();

function detectarSede(turno: string): Sede | null {
  if (!turno) return null;
  const t = turno.toUpperCase();
  if (t.includes("CANTON") || t.includes("CANTÓN")) return "CANTON";
  if (t.includes("PUERTOS")) return "PUERTOS";
  if (t.includes("SM") || t.includes("MATIAS") || t.includes("MATÍAS") || t.includes("MARTÍN")) return "SM";
  return null;
}

function esJugadorValido(p: any): boolean {
  if (!p) return false;
  const apodo = (p.apodo || p.rawNombre || p.nombre || "").toString().trim().toUpperCase();
  if (!apodo) return false;
  if (
    apodo.includes("SEDE CANCELADA") ||
    apodo.includes("SUSPENDIDA") ||
    apodo.includes("TIMESTAMP") ||
    apodo.includes("APO DO") ||
    apodo.startsWith("❌")
  ) {
    return false;
  }
  return true;
}

export async function leerInscriptos(): Promise<InscriptoSheet[]> {
  try {
    const res = await fetch(APPS_SCRIPT_INSCRIPTOS_URL);
    if (!res.ok) return [];
    const data = await res.json();
    const filas: InscriptoSheet[] = [];

    const solapas = data?.solapas || {};
    const bajasSet = new Set(
      (solapas.bajas || []).map((b: string) => b.toLowerCase().trim())
    );

    // 1. Inscriptos VIP
    const vipPlayers = solapas.respuestas_vip?.players || solapas["Ingresos VIP"]?.players || [];
    for (const p of vipPlayers) {
      if (!esJugadorValido(p)) continue;
      const email = (p.email || "").toString().toLowerCase().trim();
      const apodo = (p.apodo || p.rawNombre || "").toString().trim();

      if (!bajasSet.has(apodo.toLowerCase())) {
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
      if (!esJugadorValido(p)) continue;
      const email = (p.email || "").toString().toLowerCase().trim();
      const apodo = (p.apodo || p.rawNombre || "").toString().trim();

      if (!bajasSet.has(apodo.toLowerCase())) {
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

/**
 * Pone 'true' en la celda B14 de la planilla para ejecutar el script de convocados en Google Apps Script
 */
export async function ejecutarOrganizarConvocadosSheet(): Promise<{ ok: boolean; mensaje: string }> {
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
      return { ok: true, mensaje: "¡Ejecutado con éxito! Se marcó B14 = true y se organizaron las solapas en Google Sheets." };
    } else {
      return { ok: false, mensaje: data.error || data.message || "Error al ejecutar el script en Google Sheets." };
    }
  } catch (error) {
    console.error("Error al ejecutar organizar convocados:", error);
    return { ok: false, mensaje: "Error de conexión con la planilla." };
  }
}

/**
 * Lee directamente los resultados procesados en las solapas del Google Sheet
 */
export async function obtenerConvocadosOrganizadosSheet(): Promise<ConvocadosOrganizadosResult> {
  try {
    const res = await fetch(APPS_SCRIPT_INSCRIPTOS_URL);
    if (!res.ok) return { canton: [], puertos: [], sm: [], puertos2: [], suplentes: [] };
    const data = await res.json();
    const solapas = data?.solapas || {};

    const MapearJugadores = (arr: any[]): JugadorConvocadoSolapa[] => {
      if (!Array.isArray(arr)) return [];
      return arr
        .filter(esJugadorValido)
        .map((p: any) => ({
          apodo: (p.apodo || p.rawNombre || p.nombre || "").toString().trim(),
          email: (p.email || "").toString().toLowerCase().trim(),
          puesto: p.puesto || "",
          condicion: p.condicion || "TITULAR",
        }));
    };

    return {
      canton: MapearJugadores(solapas.canton?.players || solapas["CANTON"]?.players || solapas["Cantón"]?.players || []),
      puertos: MapearJugadores(solapas.puertos?.players || solapas["PUERTOS"]?.players || solapas["Puertos"]?.players || []),
      sm: MapearJugadores(solapas.sm?.players || solapas["SM"]?.players || solapas["San Martin"]?.players || []),
      puertos2: MapearJugadores(solapas.puertos2?.players || solapas["PUERTOS 2"]?.players || solapas["Puertos 2"]?.players || []),
      suplentes: MapearJugadores(solapas.suplentes?.players || solapas["SUPLENTES"]?.players || []),
    };
  } catch (error) {
    console.error("Error al obtener convocados organizados de las solapas:", error);
    return { canton: [], puertos: [], sm: [], puertos2: [], suplentes: [] };
  }
}
