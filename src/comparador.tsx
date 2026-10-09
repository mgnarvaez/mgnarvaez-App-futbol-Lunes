import React, { useState, useEffect } from "react";
import {
  obtenerInscriptosSheet,
  obtenerConvocadosOrganizadosSheet,
  ejecutarOrganizarConvocadosSheet,
  obtenerPlantelSheet,
  InscriptoSheet,
  ConvocadosOrganizadosResult,
} from "@/lib/sheets.functions";
import {
  armarConvocatoriasPorSede,
  EngineConfig,
  SedeConvocatoria,
} from "@/lib/armadorService";
import { InscripcionLocal } from "@/lib/types";

export default function ComparadorConvocados() {
  const [loading, setLoading] = useState<boolean>(false);
  const [ejecutandoScript, setEjecutandoScript] = useState<boolean>(false);
  const [mensajeScript, setMensajeScript] = useState<string | null>(null);

  const [inscriptos, setInscriptos] = useState<InscriptoSheet[]>([]);
  const [resultadoScript, setResultadoScript] = useState<ConvocadosOrganizadosResult | null>(null);
  const [resultadoApp, setResultadoApp] = useState<Record<string, SedeConvocatoria> | null>(null);

  // Configuración para el motor local de la app
  const [config, setConfig] = useState<EngineConfig>({
    suspensionLluviaGeneral: false,
    sedesCanceladas: [],
    canchaMojadaCanton: false,
    puertos10vs10: false,
  });

  const cargarYComparar = async () => {
    setLoading(true);
    setMensajeScript(null);
    try {
      // 1. Obtener inscriptos y datos del plantel
      const [rawInscriptos, plantelData] = await Promise.all([
        obtenerInscriptosSheet(),
        obtenerPlantelSheet().catch(() => []),
      ]);
      setInscriptos(rawInscriptos);

      const pagosMap = new Map<string, boolean>();
      plantelData.forEach((p) => {
        if (p.email) pagosMap.set(p.email.toLowerCase().trim(), p.pago);
        if (p.email_alternativo) pagosMap.set(p.email_alternativo.toLowerCase().trim(), p.pago);
      });

      const consolidadas: InscripcionLocal[] = rawInscriptos.map((item, idx) => {
        const mail = (item.email || "").toLowerCase().trim();
        const estaPagado = pagosMap.get(mail) ?? false;
        return {
          id: `${mail}-${idx}`,
          apodo: item.apodo || item.email,
          email: item.email,
          sede: item.sede ?? item.turno ?? "CANTON",
          flexible: item.flexible,
          juegaConLluvia: item.juega_con_lluvia,
          vip: item.vip,
          estadoPago: estaPagado ? "AL_DÍA" : "DEBE",
          fecha: `${item.fecha} ${item.hora}`,
        };
      });

      // 2. Ejecutar motor local de la app
      const resApp = armarConvocatoriasPorSede(consolidadas, config);
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
    setMensajeScript("Ejecutando script de Google Sheets...");
    try {
      const res = await ejecutarOrganizarConvocadosSheet();
      if (res.ok) {
        setMensajeScript("¡Script ejecutado con éxito! Recargando datos...");
        await cargarYComparar();
      } else {
        setMensajeScript(`Error al ejecutar script: ${res.mensaje}`);
      }
    } catch (err) {
      setMensajeScript("Error de conexión al ejecutar el script.");
    } finally {
      setEjecutandoScript(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white rounded-2xl p-6 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">📊 Cotejo de Convocatorias (Motor Local vs Script Google)</h2>
            <p className="text-xs text-emerald-200 mt-1">
              Verifica coincidencia del algoritmo nativo con la planilla oficial B14.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={cargarYComparar}
              disabled={loading}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm"
            >
              {loading ? "🔄 Comparando..." : "🔄 Recargar Comparación"}
            </button>
            <button
              onClick={handleCorrerScriptB14}
              disabled={ejecutandoScript}
              className="bg-amber-500 hover:bg-amber-600 text-zinc-900 px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm"
            >
              {ejecutandoScript ? "⚡ Ejecutando B14..." : "⚡ Correr Script en Sheet (B14)"}
            </button>
          </div>
        </div>

        {mensajeScript && (
          <div className="mt-3 bg-white/10 p-2.5 rounded-lg text-xs font-medium border border-white/20">
            {mensajeScript}
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-8 text-center text-zinc-500 text-sm font-medium">
          Cargando datos y procesando motores de comparación...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* COLUMNA APP LOCAL */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
            <h3 className="font-bold text-zinc-900 text-base border-b pb-2 flex items-center gap-2">
              📱 Motor Nativo App (Local)
            </h3>
            {resultadoApp &&
              Object.values(resultadoApp).map((sede) => (
                <div key={sede.nombre} className="border border-zinc-200 rounded-xl p-3 bg-zinc-50 space-y-2">
                  <div className="flex justify-between items-center border-b pb-1">
                    <span className="font-bold text-xs text-zinc-800">{sede.nombre}</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                      {sede.convocados.length} Titulares
                    </span>
                  </div>
                  <ul className="text-xs space-y-1">
                    {sede.convocados.map((j, i) => (
                      <li key={i} className="flex justify-between items-center bg-white px-2 py-1 rounded border border-zinc-100">
                        <span>{j.apodo}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                          j.estadoPago === "AL_DÍA" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                        }`}>
                          {j.estadoPago}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>

          {/* COLUMNA SCRIPT GOOGLE */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
            <h3 className="font-bold text-zinc-900 text-base border-b pb-2 flex items-center gap-2">
              📄 Script Google Sheet (Planilla B14)
            </h3>
            {resultadoScript?.solapas ? (
              ["canton", "puertos", "sm", "puertos2"].map((sKey) => {
                const solapaData = resultadoScript.solapas[sKey];
                const players = solapaData?.players || [];
                return (
                  <div key={sKey} className="border border-zinc-200 rounded-xl p-3 bg-zinc-50 space-y-2">
                    <div className="flex justify-between items-center border-b pb-1">
                      <span className="font-bold text-xs text-zinc-800 uppercase">{sKey}</span>
                      <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold">
                        {players.length} En Solapa
                      </span>
                    </div>
                    <ul className="text-xs space-y-1">
                      {players.map((p: any, idx: number) => (
                        <li key={idx} className="flex justify-between items-center bg-white px-2 py-1 rounded border border-zinc-100">
                          <span>{p.apodo || p.email}</span>
                          <span className="text-[9px] bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded">
                            {p.estado || "CONVOCADO"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-zinc-500 py-4 text-center">
                Presiona "⚡ Correr Script en Sheet (B14)" para refrescar las solapas en Google.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
