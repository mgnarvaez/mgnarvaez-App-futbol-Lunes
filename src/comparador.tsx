import React, { useState, useEffect } from "react";
import {
  obtenerInscriptosSheet,
  obtenerConvocadosOrganizadosSheet,
  ejecutarOrganizarConvocadosSheet,
  InscriptoSheet,
  ConvocadosOrganizadosResult,
} from "@/lib/sheets.functions";
import { armarConvocatoriasPorSede, SedeConvocatoria } from "@/lib/services/armadorService";
import { InscripcionLocal } from "@/lib/types";

interface ComparadorProps {
  sedesCanceladas?: string[];
  canchaMojadaCanton?: boolean;
  modoPuertos10v10?: boolean;
}

export function ComparadorConvocados(props: ComparadorProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [ejecutandoScript, setEjecutandoScript] = useState<boolean>(false);
  const [mensajeScript, setMensajeScript] = useState<string | null>(null);

  const [inscriptos, setInscriptos] = useState<InscriptoSheet[]>([]);
  const [resultadoScript, setResultadoScript] = useState<ConvocadosOrganizadosResult | null>(null);
  const [resultadoApp, setResultadoApp] = useState<Record<string, SedeConvocatoria>>({});

  const [canchaMojada, setCanchaMojada] = useState<boolean>(props.canchaMojadaCanton ?? false);
  const [puertos10v10, setPuertos10v10] = useState<boolean>(props.modoPuertos10v10 ?? false);
  const [canceladas, setCanceladas] = useState<string[]>(props.sedesCanceladas ?? []);

  useEffect(() => {
    if (props.canchaMojadaCanton !== undefined) setCanchaMojada(props.canchaMojadaCanton);
    if (props.modoPuertos10v10 !== undefined) setPuertos10v10(props.modoPuertos10v10);
    if (props.sedesCanceladas !== undefined) setCanceladas(props.sedesCanceladas);
  }, [props.canchaMojadaCanton, props.modoPuertos10v10, props.sedesCanceladas]);

  const cargarYComparar = async () => {
    setLoading(true);
    setMensajeScript(null);
    try {
      const rawInscriptos = await obtenerInscriptosSheet();
      setInscriptos(rawInscriptos);

      const inscriptosLocales: InscripcionLocal[] = rawInscriptos.map((i, idx) => ({
        id: `${i.email || "mail"}-${idx}`,
        apodo: i.apodo || i.email || "Jugador",
        email: i.email || "",
        sede: i.sede || i.turno || "CANTON",
        flexible: Boolean(i.flexible),
        juegaConLluvia: Boolean(i.juega_con_lluvia),
        vip: Boolean(i.vip),
        estadoPago: "AL_DÍA",
        fecha: i.timestamp || i.fecha || "",
      }));

      const resApp = armarConvocatoriasPorSede(inscriptosLocales, {
        suspensionLluviaGeneral: false,
        sedesCanceladas: canceladas,
        canchaMojadaCanton: canchaMojada,
        puertos10vs10: puertos10v10,
      });
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
    void cargarYComparar();
  }, [canchaMojada, puertos10v10, canceladas]);

  const handleCorrerScriptB14 = async () => {
    setEjecutandoScript(true);
    setMensajeScript("Ejecutando script de Google Sheets (marcando B14 = true)...");
    try {
      const res = await ejecutarOrganizarConvocadosSheet();
      setMensajeScript(res.mensaje);
      if (res.ok) {
        setTimeout(() => {
          void cargarYComparar();
        }, 2000);
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
      <div className="bg-white rounded-xl shadow-md border border-zinc-200 p-5 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-100 pb-3 mb-4 gap-2">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold text-zinc-800">{nombreSede}</h3>
            {esIdentico ? (
              <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
                ✓ 100% Coincidencia ({coinciden.length} jugadores)
              </span>
            ) : (
              <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                ⚠️ Diferencias encontradas ({soloEnApp.length + soloEnScript.length} dispares)
              </span>
            )}
          </div>
          <div className="text-sm text-zinc-500">
            App: <span className="font-bold text-zinc-700">{listaApp.length}</span> | Sheet:{" "}
            <span className="font-bold text-zinc-700">{listaScript.length}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    className={"flex justify-between items-center px-2 py-1 rounded " + (dif ? "bg-amber-100 text-amber-900 font-semibold" : "bg-white text-zinc-700")}
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
                <p className="text-zinc-400 italic text-xs">Sin convocados en esta sede.</p>
              )}
            </ul>
          </div>

          <div className="bg-emerald-50/50 rounded-lg p-4 border border-emerald-100">
            <h4 className="font-semibold text-emerald-900 mb-2 flex items-center justify-between">
              <span>📊 Script Google Sheet (Solapa)</span>
              <span className="text-xs bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded">
                {listaScript.length}
              </span>
            </h4>
            <ul className="space-y-1.5 text-sm">
              {listaScript.map((j, i) => {
                const dif = !setApp.has(norm(j.apodo));
                return (
                  <li
                    key={i}
                    className={"flex justify-between items-center px-2 py-1 rounded " + (dif ? "bg-amber-100 text-amber-900 font-semibold" : "bg-white text-zinc-700")}
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
                <p className="text-zinc-400 italic text-xs">Sin convocados en esta sede.</p>
              )}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white rounded-2xl p-6 shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              📊 Cotejo de Convocatorias (B14)
            </h1>
            <p className="text-emerald-100 text-sm mt-1">
              Comparador entre el Motor Nativo de la App y las solapas del Script de Google Sheets.
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
              onClick={() => void cargarYComparar()}
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

      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-4">
        <h2 className="text-sm font-bold text-zinc-700 uppercase tracking-wider mb-3">
          Controles del Motor App
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={canchaMojada}
              onChange={(e) => setCanchaMojada(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded"
            />
            <span className="text-zinc-700 font-medium">☔ Cancha Mojada Cantón</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={puertos10v10}
              onChange={(e) => setPuertos10v10(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded"
            />
            <span className="text-zinc-700 font-medium">🏟️ Puertos 10v10 (20 cupos)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={canceladas.includes("SM")}
              onChange={(e) => {
                if (e.target.checked) setCanceladas([...canceladas, "SM"]);
                else setCanceladas(canceladas.filter((s) => s !== "SM"));
              }}
              className="w-4 h-4 text-red-600 rounded"
            />
            <span className="text-zinc-700 font-medium">🚫 Desactivar San Matías</span>
          </label>

          <div className="col-span-2 md:col-span-1 text-right text-xs text-zinc-500 self-center">
            Inscriptos leídos: <span className="font-bold text-zinc-800">{inscriptos.length}</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 bg-white rounded-xl border border-zinc-200">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent mb-2"></div>
          <p className="text-zinc-500 font-medium">Cotejando motores de convocatoria...</p>
        </div>
      ) : (
        <div>
          {compararSede(
            "📍 Cantón",
            resultadoApp["CANTON"]?.convocados || [],
            resultadoScript?.canton || []
          )}

          {compararSede(
            "📍 Puertos",
            resultadoApp["PUERTOS"]?.convocados || [],
            resultadoScript?.puertos || []
          )}

          {compararSede(
            "📍 San Matías",
            resultadoApp["SM"]?.convocados || [],
            resultadoScript?.sm || []
          )}

          {compararSede(
            "📍 Puertos 2",
            resultadoApp["PUERTOS 2"]?.convocados || [],
            resultadoScript?.puertos2 || []
          )}

          {compararSede(
            "⏳ Suplentes",
            resultadoApp["CANTON"]?.suplentes || [],
            resultadoScript?.suplentes || []
          )}
        </div>
      )}
    </div>
  );
}

export default ComparadorConvocados;
