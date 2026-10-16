import React, { useState, useEffect } from "react";
import {
  obtenerConvocadosOrganizadosSheet,
  ejecutarOrganizarConvocadosSheet,
  ConvocadosOrganizadosResult,
} from "@/lib/sheets.functions";
import { type SedeConvocatoria, normalizarSedeKey } from "@/lib/armadorService";

interface ComparadorProps {
  sedesArmadas?: Record<string, SedeConvocatoria>;
}

export default function ComparadorConvocados({ sedesArmadas }: ComparadorProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [ejecutandoScript, setEjecutandoScript] = useState<boolean>(false);
  const [mensajeScript, setMensajeScript] = useState<string | null>(null);

  const [resultadoScript, setResultadoScript] = useState<ConvocadosOrganizadosResult | null>(null);

  const cargarDatosSheet = async () => {
    setLoading(true);
    setMensajeScript(null);
    try {
      const resSheet = await obtenerConvocadosOrganizadosSheet();
      setResultadoScript(resSheet);
    } catch (err) {
      console.error("Error al obtener convocados de Google Sheets:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargarDatosSheet();
  }, []);

  const handleCorrerScriptB14 = async () => {
    setEjecutandoScript(true);
    setMensajeScript("Ejecutando script de Google Sheets (marcando B14 = true en la planilla)...");
    try {
      const res = await ejecutarOrganizarConvocadosSheet();
      setMensajeScript(res.mensaje || "Script ejecutado en Google Sheets.");
      if (res.ok) {
        setTimeout(() => {
          void cargarDatosSheet();
        }, 3000);
      }
    } catch (error) {
      setMensajeScript("Error al conectar con la planilla para marcar B14.");
    } finally {
      setEjecutandoScript(false);
    }
  };

  const norm = (s: string) => (s || "").toLowerCase().trim();

  // Extrae la lista de jugadores ({ apodo: string }[]) desde sedesArmadas de la App
  const extraerListaApp = (sedes: Record<string, SedeConvocatoria> | undefined, sedeKey: string): { apodo: string }[] => {
    if (!sedes) return [];
    const claveBusqueda = sedeKey.toUpperCase() === "PUERTOS2" ? "PUERTOS 2" : sedeKey.toUpperCase();
    const sObj = sedes[claveBusqueda] || sedes[sedeKey] || sedes[normalizarSedeKey(sedeKey)];
    if (sObj && Array.isArray(sObj.convocados)) {
      return sObj.convocados.map((j) => ({
        apodo: j.apodo || j.nombre || j.email || "Jugador",
      }));
    }
    return [];
  };

  const extraerSuplentesApp = (sedes: Record<string, SedeConvocatoria> | undefined): { apodo: string }[] => {
    if (!sedes) return [];
    const list: { apodo: string }[] = [];
    Object.values(sedes).forEach((s) => {
      if (s && Array.isArray(s.suplentes)) {
        s.suplentes.forEach((j) => {
          list.push({
            apodo: j.apodo || j.nombre || j.email || "Jugador",
          });
        });
      }
    });
    return list;
  };

  const compararSede = (
    nombreSede: string,
    listaApp: { apodo: string }[],
    listaScript: { apodo: string }[]
  ) => {
    const apodosApp = listaApp.map((j) => norm(j.apodo));
    const apodosScript = listaScript.map((j) => norm(j.apodo));

    const setScript = new Set(apodosScript);
    const setApp = new Set(apodosApp);

    const soloEnApp = listaApp.filter((j) => !setScript.has(norm(j.apodo)));
    const soloEnScript = listaScript.filter((j) => !setApp.has(norm(j.apodo)));
    const coinciden = listaApp.filter((j) => setScript.has(norm(j.apodo)));

    const esIdentico = soloEnApp.length === 0 && soloEnScript.length === 0;

    return (
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-3 mb-4 gap-2">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold text-gray-800">{nombreSede}</h3>
            {esIdentico ? (
              <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
                ✓ 100% Coincidencia ({coinciden.length} jugadores)
              </span>
            ) : (
              <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                ⚠️ Diferencias encontradas ({soloEnApp.length + soloEnScript.length} dispares)
              </span>
            )}
          </div>
          <div className="text-sm text-gray-500">
            App: <span className="font-bold text-gray-700">{listaApp.length}</span> | Sheet:{" "}
            <span className="font-bold text-gray-700">{listaScript.length}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* LISTA MOTOR APP */}
          <div className="bg-emerald-50/50 rounded-lg p-3 border border-emerald-100">
            <h4 className="font-bold text-emerald-900 text-xs uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>📱 Motor Nativo App ({listaApp.length})</span>
            </h4>
            {listaApp.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Sin convocados en esta sede.</p>
            ) : (
              <ul className="space-y-1">
                {listaApp.map((j, idx) => {
                  const estaEnScript = setScript.has(norm(j.apodo));
                  return (
                    <li
                      key={idx}
                      className={`text-xs px-2 py-1 rounded flex items-center justify-between ${
                        estaEnScript
                          ? "bg-white text-gray-800 border border-emerald-200"
                          : "bg-amber-100 text-amber-900 font-bold border border-amber-300"
                      }`}
                    >
                      <span>{j.apodo}</span>
                      {!estaEnScript && (
                        <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-semibold">
                          Solo en App
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* LISTA SCRIPT SHEET */}
          <div className="bg-blue-50/50 rounded-lg p-3 border border-blue-100">
            <h4 className="font-bold text-blue-900 text-xs uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>📊 Script Google Sheets ({listaScript.length})</span>
            </h4>
            {listaScript.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Sin convocados leídos en Sheet.</p>
            ) : (
              <ul className="space-y-1">
                {listaScript.map((j, idx) => {
                  const estaEnApp = setApp.has(norm(j.apodo));
                  return (
                    <li
                      key={idx}
                      className={`text-xs px-2 py-1 rounded flex items-center justify-between ${
                        estaEnApp
                          ? "bg-white text-gray-800 border border-blue-200"
                          : "bg-red-100 text-red-900 font-bold border border-red-300"
                      }`}
                    >
                      <span>{j.apodo}</span>
                      {!estaEnApp && (
                        <span className="text-[10px] bg-red-200 text-red-900 px-1.5 py-0.5 rounded font-semibold">
                          Solo en Sheet
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  };

  const cantonApp = extraerListaApp(sedesArmadas, "CANTON");
  const puertosApp = extraerListaApp(sedesArmadas, "PUERTOS");
  const smApp = extraerListaApp(sedesArmadas, "SM");
  const puertos2App = extraerListaApp(sedesArmadas, "PUERTOS 2");
  const suplentesApp = extraerSuplentesApp(sedesArmadas);

  const hayDatosApp = Object.keys(sedesArmadas || {}).length > 0;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            🔍 Cotejo de Convocatorias (B14)
          </h1>
          <p className="text-emerald-100 text-sm mt-1">
            Comparador en tiempo real entre los datos armados por la App y las solapas de la planilla de Google Sheets.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => void handleCorrerScriptB14()}
            disabled={ejecutandoScript || loading}
            className="bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold px-4 py-2.5 rounded-xl transition shadow-md flex items-center gap-2 disabled:opacity-50"
          >
            {ejecutandoScript ? "⏳ Marcando B14..." : "⚡ Correr Script en Sheet (B14)"}
          </button>

          <button
            onClick={() => void cargarDatosSheet()}
            disabled={loading}
            className="bg-white/20 hover:bg-white/30 text-white font-semibold px-4 py-2.5 rounded-xl transition backdrop-blur-sm flex items-center gap-2"
          >
            🔄 Actualizar Sheet
          </button>
        </div>
      </div>

      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-lg text-amber-900 text-sm shadow-sm space-y-1">
        <p className="font-bold flex items-center gap-2">
          <span>💡 Recomendación para un cotejo 100% equivalente:</span>
        </p>
        <p className="text-xs text-amber-800">
          Asegurate de que las condiciones de cancelación de sedes (<i>Lluvia</i>, <i>Cancha Mojada</i>, etc.) estén configuradas de forma idéntica en las casillas de control de la planilla de Google Sheets antes de presionar <b>"⚡ Correr Script en Sheet (B14)"</b>. Los suplentes e indicados en rojo de la planilla son filtrados e identificados automáticamente en la lista de Suplentes.
        </p>
      </div>

      {mensajeScript && (
        <div className="p-3 bg-white rounded-lg border border-amber-200 text-sm text-amber-900 font-medium shadow-sm">
          {mensajeScript}
        </div>
      )}

      {!hayDatosApp && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg text-blue-900 text-sm">
          ℹ️ <b>Nota:</b> Todavía no hay convocatorias cargadas en la App. Vas a la pestaña <b>Convocatorias</b> y presioná <b>"Sincronizar Inscriptos"</b> para cargar el armado inicial.
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent mb-2"></div>
          <p className="text-gray-500 font-medium">Leyendo convocados de Google Sheets...</p>
        </div>
      ) : (
        <div>
          {compararSede("📍 Cantón", cantonApp, resultadoScript?.canton || [])}
          {compararSede("📍 Puertos", puertosApp, resultadoScript?.puertos || [])}
          {compararSede("📍 San Matías", smApp, resultadoScript?.sm || [])}
          {compararSede("📍 Puertos 2", puertos2App, resultadoScript?.puertos2 || [])}
          {compararSede("⏳ Suplentes", suplentesApp, resultadoScript?.suplentes || [])}
        </div>
      )}
    </div>
  );
}
