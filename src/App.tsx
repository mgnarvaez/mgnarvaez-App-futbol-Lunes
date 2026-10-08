import React, { useEffect, useState } from "react";
import { CloudRain, ExternalLink, Loader2, RefreshCw, UserMinus, ShieldAlert } from "lucide-react";
import { obtenerInscriptosSheet, registrarBajaSheet, type InscriptoSheet } from "@/lib/sheets.functions";
import { SEDES, SEDE_LABELS, type Sede } from "@/lib/types";

export default function App() {
  const [inscriptos, setInscriptos] = useState<InscriptoSheet[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [bajando, setBajando] = useState<string | null>(null);

  // Estados de control local (Lluvia y Sedes canceladas)
  const [suspensionLluvia, setSuspensionLluvia] = useState(false);
  const [sedesCanceladas, setSedesCanceladas] = useState<Sede[]>([]);

  const hoy = new Date().toISOString().slice(0, 10);
  const FORM_URL = "https://forms.gle/18-6FV5tk7gjSssBNUWCojRMrI4CYR18rfz3BmVUAZ3A"; // Reemplazá con tu link de form si difiere

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const data = await obtenerInscriptosSheet();
      setInscriptos(data);
    } catch (err) {
      console.error("Error al cargar planilla:", err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void cargarDatos();
  }, []);

  const handleSincronizar = async () => {
    setSincronizando(true);
    await cargarDatos();
    setSincronizando(false);
  };

  const toggleSedeCancelada = (sede: Sede) => {
    if (sedesCanceladas.includes(sede)) {
      setSedesCanceladas(sedesCanceladas.filter((s) => s !== sede));
    } else {
      setSedesCanceladas([...sedesCanceladas, sede]);
    }
  };

  const handleDarDeBaja = async (apodo: string) => {
    if (!confirm(`¿Confirmás dar de baja a "${apodo}"?`)) return;
    setBajando(apodo);
    try {
      const res = await registrarBajaSheet(apodo, "Baja desde Panel Web");
      if (res.ok) {
        alert(`Baja de ${apodo} registrada con éxito.`);
        await cargarDatos();
      } else {
        alert(`Error al registrar baja: ${res.mensaje}`);
      }
    } catch (err) {
      alert("Error de conexión al registrar la baja.");
    } finally {
      setBajando(null);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 p-4 sm:p-6 text-zinc-900">
      <div className="mx-auto max-w-3xl space-y-6">
        
        {/* Cabecera */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-zinc-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-100 pb-4">
            <h1 className="text-xl font-bold flex items-center gap-2">
              ⚽ Panel de Convocatorias · <span className="text-zinc-500 font-normal text-base">{hoy}</span>
            </h1>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 w-fit">
              🟢 Sistema Activo (Vite)
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition"
            >
              <ExternalLink className="size-4" />
              Abrir Formulario de Inscripción
            </a>
            <button
              onClick={() => void handleSincronizar()}
              disabled={sincronizando}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition disabled:opacity-50"
            >
              {sincronizando ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Actualizar Planilla
            </button>
          </div>
        </div>

        {/* Panel de Controles (Lluvia y Sedes) */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-zinc-200 space-y-4">
          <h2 className="text-base font-semibold text-zinc-800 flex items-center gap-2">
            <ShieldAlert className="size-5 text-amber-600" />
            Controles de Cancha y Clima
          </h2>

          {/* Suspensión por Lluvia */}
          <div className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 p-4">
            <div className="flex items-center gap-2">
              <CloudRain className="size-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Suspensión General por Lluvia</p>
                <p className="text-xs text-zinc-500">Filtra automáticamente a quienes no juegan con agua.</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={suspensionLluvia}
              onChange={(e) => setSuspensionLluvia(e.target.checked)}
              className="size-5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          </div>

          {/* Sedes Canceladas / Puertos 2 */}
          <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Sedes Habilitadas y Cancelaciones (Incluye Puertos 2)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SEDES.map((sede) => {
                const cancelada = sedesCanceladas.includes(sede);
                return (
                  <button
                    key={sede}
                    onClick={() => toggleSedeCancelada(sede)}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      cancelada
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"
                    }`}
                  >
                    <span>{SEDE_LABELS[sede]}</span>
                    <span className="text-xs px-2 py-0.5 rounded font-bold">
                      {cancelada ? "❌ Cancelada" : "✅ Activa"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Listado de Inscriptos */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-zinc-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-zinc-800">
              Inscriptos en la Planilla ({inscriptos.length})
            </h2>
          </div>

          {cargando ? (
            <div className="flex items-center justify-center py-8 text-zinc-500 gap-2">
              <Loader2 className="size-5 animate-spin" />
              Leyendo respuestas de Google Sheets...
            </div>
          ) : inscriptos.length === 0 ? (
            <p className="text-sm text-zinc-500 py-4 text-center">
              No se encontraron inscriptos cargados en este momento.
            </p>
          ) : (
            <div className="divide-y divide-zinc-100 overflow-x-auto">
              {inscriptos.map((item, idx) => (
                <div key={`${item.email}-${idx}`} className="flex items-center justify-between py-3 gap-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-zinc-900 truncate">
                      {item.apodo || item.email}
                    </span>
                    {item.vip && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                        VIP
                      </span>
                    )}
                    <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                      {item.sede ?? item.turno ?? "Sin Turno"}
                    </span>
                    {item.flexible && (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                        FLEX
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-zinc-400 hidden sm:inline">
                      {item.fecha} {item.hora}
                    </span>
                    <button
                      onClick={() => void handleDarDeBaja(item.apodo || item.email)}
                      disabled={bajando === (item.apodo || item.email)}
                      className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 transition disabled:opacity-50"
                    >
                      {bajando === (item.apodo || item.email) ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <UserMinus className="size-3" />
                      )}
                      Bajar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
