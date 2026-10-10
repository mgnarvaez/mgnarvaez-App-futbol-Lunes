import React, { useState, useEffect } from "react";
import {
  obtenerInscriptosSheet,
  obtenerConvocadosOrganizadosSheet,
  ejecutarOrganizarConvocadosSheet,
  type InscriptoSheet,
  type ConvocadosOrganizadosResult,
} from "@/lib/sheets.functions";
import { armarConvocatorias, type ConfigArmador, type ResultadoArmado } from "@/lib/armadorService";

export default function ComparadorConvocados() {
  const [loading, setLoading] = useState<boolean>(false);
  const [ejecutandoScript, setEjecutandoScript] = useState<boolean>(false);
  const [mensajeScript, setMensajeScript] = useState<string | null>(null);

  const [inscriptos, setInscriptos] = useState<InscriptoSheet[]>([]);
  const [resultadoScript, setResultadoScript] = useState<ConvocadosOrganizadosResult | null>(null);
  const [resultadoApp, setResultadoApp] = useState<ResultadoArmado | null>(null);

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
      const rawInscriptos = await obtenerInscriptosSheet();
      setInscriptos(rawInscriptos);

      const resApp = armarConvocatorias(rawInscriptos, config);
      setResultadoApp(resApp);

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
          <div className="bg-blue-50/50 rounded-lg p-4 border border-blue-100">
            <h4 className="font-semibold text-blue-900 mb-2 flex items-center justify-between">
              <span>⚡ Motor Nativo App</span>
              <span className="text-xs font-normal bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                {listaApp.length} convocados
              </span>
            </h4>
            <ul className="divide-y divide-blue-100 text-sm">
              {listaApp.map((j, idx) => {
                const dif = !setScript.has(norm(j.apodo));
                return (
                  <li
                    key={idx}
                    className={"py-1.5 px-2 rounded flex justify-between items-center " + (dif ? "bg-amber-100 text-amber-900 font-semibold" : "bg-white text-gray-700")}
                  >
                    <span>{j.apodo}</span>
                    {dif && <span className="text-[10px] bg-amber-200 px-1.5 py-0.5 rounded">Solo en App</span>}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="bg-emerald-50/50 rounded-lg p-4 border border-emerald-100">
            <h4 className="font-semibold text-emerald-900 mb-2 flex items-center justify-between">
              <span>📊 Script Google Sheet (Solapas)</span>
              <span className="text-xs font-normal bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                {listaScript.length} convocados
              </span>
            </h4>
            <ul className="divide-y divide-emerald-100 text-sm">
              {listaScript.map((j, idx) => {
                const dif = !setApp.has(norm(j.apodo));
                return (
                  <li
                    key={idx}
                    className={"py-1.5 px-2 rounded flex justify-between items-center " + (dif ? "bg-amber-100 text-amber-900 font-semibold" : "bg-white text-gray-700")}
                  >
                    <span>{j.apodo}</span>
                    {dif && <span className="text-[10px] bg-amber-200 px-1.5 py-0.5 rounded">Solo en Sheet</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white rounded-2xl p-6 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">Cotejo B14 · Verificación de Armado</h2>
            <p className="text-emerald-100 text-sm mt-1">
              Compara el resultado del algoritmo local de la App contra las solapas oficiales generadas en Google Sheets.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={cargarYComparar}
              disabled={loading}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2 rounded-xl text-sm font-semibold transition backdrop-blur-sm flex items-center gap-2 disabled:opacity-50"
            >
              🔄 Actualizar Datos
            </button>
            <button
              onClick={handleCorrerScriptB14}
              disabled={ejecutandoScript}
              className="bg-amber-400 hover:bg-amber-500 text-amber-950 px-4 py-2 rounded-xl text-sm font-bold shadow-md transition flex items-center gap-2 disabled:opacity-50"
            >
              ⚡ Correr Script en Sheet (B14)
            </button>
          </div>
        </div>

        {mensajeScript && (
          <div className="mt-4 p-3 bg-black/20 border border-white/20 rounded-xl text-xs font-mono text-emerald-200">
            {mensajeScript}
          </div>
        )}
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap items-center justify-between gap-4 text-sm">
        <span className="font-bold text-gray-700">Configuración de Sedes en la App:</span>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.cantonActivo}
              onChange={(e) => setConfig({ ...config, cantonActivo: e.target.checked })}
              className="rounded text-emerald-600 focus:ring-emerald-500"
            />
            <span>Cantón (14)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.puertosActivo}
              onChange={(e) => setConfig({ ...config, puertosActivo: e.target.checked })}
              className="rounded text-emerald-600 focus:ring-emerald-500"
            />
            <span>Puertos ({config.modoPuertos10v10 ? "20" : "14"})</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.smActivo}
              onChange={(e) => setConfig({ ...config, smActivo: e.target.checked })}
              className="rounded text-emerald-600 focus:ring-emerald-500"
            />
            <span>San Matías (16)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.cantonCanchaMojada}
              onChange={(e) => setConfig({ ...config, cantonCanchaMojada: e.target.checked })}
              className="rounded text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-amber-700 font-semibold">🌧️ Cancha Mojada Cantón (Deriva a P2)</span>
          </label>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500 font-medium">Cotejando listas de convocados...</div>
      ) : (
        <div>
          {compararSede("📍 El Cantón (20:00 hs)", resultadoApp?.canton || [], resultadoScript?.canton || [])}
          {compararSede("📍 Puertos (21:15 hs)", resultadoApp?.puertos || [], resultadoScript?.puertos || [])}
          {compararSede("📍 San Matías (20:00 hs)", resultadoApp?.sm || [], resultadoScript?.sm || [])}
          {compararSede("📍 Puertos 2 (21:15 hs)", resultadoApp?.puertos2 || [], resultadoScript?.puertos2 || [])}
          {compararSede("📋 Lista de Suplentes", resultadoApp?.suplentes || [], resultadoScript?.suplentes || [])}
        </div>
      )}
    </div>
  );
}
