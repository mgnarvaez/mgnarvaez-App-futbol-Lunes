import React, { useState, useEffect } from "react";
import {
  obtenerInscriptosSheet,
  obtenerConvocadosOrganizadosSheet,
  ejecutarOrganizarConvocadosSheet,
  InscriptoSheet,
  ConvocadosOrganizadosResult,
} from "@/lib/sheets.functions";
import { armarConvocatorias, ConfigArmador, ResultadoArmado } from "@/lib/armadorService";

export default function ComparadorConvocados() {
  const [loading, setLoading] = useState<boolean>(false);
  const [ejecutandoScript, setEjecutandoScript] = useState<boolean>(false);
  const [mensajeScript, setMensajeScript] = useState<string | null>(null);

  const [inscriptos, setInscriptos] = useState<InscriptoSheet[]>([]);
  const [resultadoScript, setResultadoScript] = useState<ConvocadosOrganizadosResult | null>(null);
  const [resultadoApp, setResultadoApp] = useState<ResultadoArmado | null>(null);

  // Configuración para el motor local de la app
  const [config, setConfig] = useState<ConfigArmador>({
    cantonActivo: true,
    puertosActivo: true,
    smActivo: true,
    puertos2Activo: true,
    cantonCanchaMojada: false,
    modoPuertos10v10: false,
  });

  const cargarYComparar = async () => {
    setLoading(true);
    setMensajeScript(null);
    try {
      // 1. Obtener inscriptos brutos (Ingresos VIP + General)
      const rawInscriptos = await obtenerInscriptosSheet();
      setInscriptos(rawInscriptos);

      // 2. Ejecutar motor local de la app
      const resApp = armarConvocatorias(rawInscriptos, config);
      setResultadoApp(resApp);

      // 3. Leer solapas calculadas por el script de Google Sheet
      const resSheet = await obtenerConvocadosOrganizadosSheet();
      setResultadoScript(resSheet);
    } catch (err) {
      console.error("Error al cotejar datos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarYComparar();
  }, [config]);

  const handleCorrerScriptB14 = async () => {
    setEjecutandoScript(true);
    setMensajeScript("Ejecutando script de Google Sheets (marcando B14 = true)...");
    try {
      const res = await ejecutarOrganizarConvocadosSheet();
      setMensajeScript(res.mensaje);
      if (res.ok) {
        // Re-cargar las solapas luego de correr el script
        setTimeout(() => {
          cargarYComparar();
        }, 3000);
      }
    } catch (error) {
      setMensajeScript("Error al conectar con la planilla para marcar B14.");
    } finally {
      setEjecutandoScript(false);
    }
  };

  // Ayudante para normalizar nombres en la comparación
  const norm = (s: string) => (s || "").toLowerCase().trim();

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Columna Motor App */}
          <div className="bg-blue-50/50 rounded-lg p-4 border border-blue-100">
            <h4 className="font-semibold text-blue-900 mb-2 flex items-center justify-between">
              <span>⚡ Motor Nativo App</span>
              <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded">
                {listaApp.length}
              </span>
            </h4>
            <ul className="space-y-1.5 text-sm">
              {listaApp.map((j, i) => {
                const dif = !setScript.has(norm(j.apodo));
                return (
                  <li
                    key={i}
                    className={`flex justify-between items-center px-2 py-1 rounded ${
                      dif ? "bg-amber-100 text-amber-900 font-semibold" : "bg-white text-gray-700"
                    }`}
                  >
                    <span>
                      {i + 1}. {j.apodo}
                    </span>
                    {dif && (
                      <span className="text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded">
                        Solo en App
                      </span>
                    )}
                  </li>
                );
              })}
              {listaApp.length === 0 && (
                <p className="text-gray-400 italic text-xs">Sin convocados en esta sede.</p>
              )}
            </ul>
          </div>

          {/* Columna Script Google Sheet */}
          <div className="bg-green-50/50 rounded-lg p-4 border border-green-100">
            <h4 className="font-semibold text-green-900 mb-2 flex items-center justify-between">
              <span>📊 Script Google Sheet (Solapa)</span>
              <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded">
                {listaScript.length}
              </span>
            </h4>
            <ul className="space-y-1.5 text-sm">
              {listaScript.map((j, i) => {
                const dif = !setApp.has(norm(j.apodo));
                return (
                  <li
                    key={i}
                    className={`flex justify-between items-center px-2 py-1 rounded ${
                      dif ? "bg-amber-100 text-amber-900 font-semibold" : "bg-white text-gray-700"
                    }`}
                  >
                    <span>
                      {i + 1}. {j.apodo}
                    </span>
                    {dif && (
                      <span className="text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded">
                        Solo en Sheet
                      </span>
                    )}
                  </li>
                );
              })}
              {listaScript.length === 0 && (
                <p className="text-gray-400 italic text-xs">Sin convocados en esta sede.</p>
              )}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Cabecera y Controles principales */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white rounded-2xl p-6 shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              🔍 Cotejo de Convocatorias
            </h1>
            <p className="text-emerald-100 text-sm mt-1">
              Comparador en tiempo real entre el Motor Nativo de la App y el Script oficial de Google Sheets.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleCorrerScriptB14}
              disabled={ejecutandoScript || loading}
              className="bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold px-4 py-2.5 rounded-xl transition shadow-md flex items-center gap-2 disabled:opacity-50"
            >
              {ejecutandoScript ? "⏳ Marcando B14..." : "⚡ Correr Script en Sheet (B14)"}
            </button>

            <button
              onClick={cargarYComparar}
              disabled={loading}
              className="bg-white/20 hover:bg-white/30 text-white font-semibold px-4 py-2.5 rounded-xl transition backdrop-blur-sm flex items-center gap-2"
            >
              🔄 Actualizar
            </button>
          </div>
        </div>

        {mensajeScript && (
          <div className="mt-4 p-3 bg-white/10 rounded-lg backdrop-blur-md border border-white/20 text-sm text-amber-200">
            {mensajeScript}
          </div>
        )}
      </div>

      {/* Switches de configuración del Motor App */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">
          Configuración del Motor Nativo App
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.cantonCanchaMojada}
              onChange={(e) =>
                setConfig({ ...config, cantonCanchaMojada: e.target.checked })
              }
              className="w-4 h-4 text-emerald-600 rounded"
            />
            <span className="text-gray-700 font-medium">☔ Cancha Mojada Cantón</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.modoPuertos10v10}
              onChange={(e) => setConfig({ ...config, modoPuertos10v10: e.target.checked })}
              className="w-4 h-4 text-emerald-600 rounded"
            />
            <span className="text-gray-700 font-medium">🏟️ Puertos 10v10 (20 cupos)</span>
          </label>

          <div className="col-span-2 text-right text-xs text-gray-500 self-center">
            Inscriptos brutos leídos: <span className="font-bold text-gray-800">{inscriptos.length}</span>
          </div>
        </div>
      </div>

      {/* Carga o Resultados */}
      {loading ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent mb-2"></div>
          <p className="text-gray-500 font-medium">Cotejando motores de convocatoria...</p>
        </div>
      ) : (
        <div>
          {/* Cantón */}
          {compararSede(
            "📍 Cantón",
            resultadoApp?.canton || [],
            resultadoScript?.canton || []
          )}

          {/* Puertos */}
          {compararSede(
            "📍 Puertos",
            resultadoApp?.puertos || [],
            resultadoScript?.puertos || []
          )}

          {/* San Matías */}
          {compararSede(
            "📍 San Matías",
            resultadoApp?.sm || [],
            resultadoScript?.sm || []
          )}

          {/* Puertos 2 */}
          {compararSede(
            "📍 Puertos 2",
            resultadoApp?.puertos2 || [],
            resultadoScript?.puertos2 || []
          )}

          {/* Suplentes */}
          {compararSede(
            "⏳ Suplentes",
            resultadoApp?.suplentes || [],
            resultadoScript?.suplentes || []
          )}
        </div>
      )}
    </div>
  );
}
