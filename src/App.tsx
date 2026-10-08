import React, { useEffect, useState } from "react";
import { CloudRain, ExternalLink, Loader2, RefreshCw, UserMinus, ShieldAlert, CheckCircle2, AlertCircle } from "lucide-react";
import { obtenerInscriptosSheet, obtenerPlantelSheet, registrarBajaSheet, type InscriptoSheet, type JugadorPlantelSheet } from "@/lib/sheets.functions";
import { SEDES, SEDE_LABELS, type Sede } from "@/lib/types";

interface InscripcionLocal {
  id: string;
  apodo: string;
  email: string;
  sede: string;
  flexible: boolean;
  juegaConLluvia: boolean;
  vip: boolean;
  estadoPago: "AL_DÍA" | "DEBE";
  fecha: string;
}

export default function App() {
  const [inscriptosSheet, setInscriptosSheet] = useState<InscriptoSheet[]>([]);
  const [plantel, setPlantel] = useState<JugadorPlantelSheet[]>([]);
  const [inscripciones, setInscripciones] = useState<InscripcionLocal[]>([]);
  
  const [cargando, setCargando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [bajando, setBajando] = useState<string | null>(null);

  // Estados de control local (Lluvia y Sedes canceladas)
  const [suspensionLluvia, setSuspensionLluvia] = useState(false);
  const [sedesCanceladas, setSedesCanceladas] = useState<Sede[]>([]);

  const hoy = new Date().toISOString().slice(0, 10);
  const FORM_URL = "https://forms.gle/18-6FV5tk7gjSssBNUWCojRMrI4CYR18rfz3BmVUAZ3A";

  const cargarDatosIniciales = async () => {
    setCargando(true);
    try {
      const [sheetData, plantelData] = await Promise.all([
        obtenerInscriptosSheet(),
        obtenerPlantelSheet()
      ]);
      setInscriptosSheet(sheetData);
      setPlantel(plantelData);
    } catch (err) {
      console.error("Error al cargar datos:", err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void cargarDatosIniciales();
  }, []);

  // MOTOR DE SINCRONIZACIÓN (Paso 1)
  const sincronizarPlanilla = async () => {
    setSincronizando(true);
    try {
      const [sheetData, plantelData] = await Promise.all([
        obtenerInscriptosSheet(),
        obtenerPlantelSheet()
      ]);
      
      setInscriptosSheet(sheetData);
      setPlantel(plantelData);

      // Mapear pagos desde el plantel por email
      const pagosMap = new Map<string, boolean>();
      plantelData.forEach(p => {
        if (p.email) pagosMap.set(p.email.toLowerCase().trim(), p.pago);
        if (p.email_alternativo) pagosMap.set(p.email_alternativo.toLowerCase().trim(), p.pago);
      });

      // Construir la lista oficial de inscriptos de hoy
      const consolidadas: InscripcionLocal[] = sheetData.map((item, idx) => {
        const mail = item.email.toLowerCase().trim();
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
          fecha: `${item.fecha} ${item.hora}`
        };
      });

      setInscripciones(consolidadas);
      alert(`✅ Sincronización exitosa: ${consolidadas.length} inscripto(s) procesado(s).`);
    } catch (err) {
      alert("❌ Error al sincronizar la planilla.");
      console.error(err);
    } finally {
      setSincronizando(false);
    }
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
        alert(`Baja de ${apodo} registrada con éxito en el Google Sheet.`);
        setInscripciones(inscripciones.filter(i => i.apodo !== apodo));
      } else {
        alert(`Error al registrar baja: ${res.mensaje}`);
      }
    } catch (err) {
      alert("Error de conexión al registrar la baja.");
    } finally {
      setBajando(null);
    }
  };

  const toggleEstadoPagoLocal = (id: string) => {
    setInscripciones(inscripciones.map(i => {
      if (i.id === id) {
        return { ...i, estadoPago: i.estadoPago === "AL_DÍA" ? "DEBE" : "AL_DÍA" };
      }
      return i;
    }));
  };

  return (
    <div className="min-h-screen bg-zinc-50 p-4 sm:p-6 text-zinc-900">
      <div className="mx-auto max-w-4xl space-y-6">
        
        {/* Cabecera */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-zinc-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-100 pb-4">
            <h1 className="text-xl font-bold flex items-center gap-2">
              ⚽ Panel de Convocatorias · <span className="text-zinc-500 font-normal text-base">{hoy}</span>
            </h1>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 w-fit">
              🟢 Sincronización V18 Activa
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
            
            {/* BOTÓN PRINCIPAL DE SINCRONIZACIÓN (PASO 1) */}
            <button
              onClick={() => void sincronizarPlanilla()}
              disabled={sincronizando}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition disabled:opacity-50 shadow-sm"
            >
              {sincronizando ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Traer / Sincronizar Inscriptos
            </button>
          </div>
        </div>

        {/* Panel de Controles (Lluvia y Sedes con San Matías y Puertos 2) */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-zinc-200 space-y-4">
          <h2 className="text-base font-semibold text-zinc-800 flex items-center gap-2">
            <ShieldAlert className="size-5 text-amber-600" />
            Controles de Cancha y Clima
          </h2>

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

          <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Sedes Habilitadas y Cancelaciones (San Matías y Puertos 2)
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

        {/* 1. INCRIPTOS CRUDOS EN LA PLANILLA */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-zinc-200">
          <h2 className="text-base font-semibold text-zinc-800 mb-3">
            Inscriptos en el Formulario ({inscriptosSheet.length})
          </h2>
          {cargando ? (
            <p className="text-sm text-zinc-500 py-4 flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Leyendo Google Sheets...
            </p>
          ) : inscriptosSheet.length === 0 ? (
            <p className="text-sm text-zinc-500">No hay respuestas nuevas en el formulario.</p>
          ) : (
            <div className="divide-y divide-zinc-100 max-h-60 overflow-y-auto">
              {inscriptosSheet.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 text-xs sm:text-sm">
                  <span className="font-medium">{item.apodo || item.email}</span>
                  <div className="flex items-center gap-2">
                    {item.vip && <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px] font-bold">VIP</span>}
                    <span className="bg-zinc-100 px-2 py-0.5 rounded font-semibold text-zinc-700">{item.sede ?? item.turno}</span>
                    {item.flexible && <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[10px] font-bold">FLEX</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. ANOTADOS DE HOY (CONSOLIDADOS TRAS SINCRONIZAR) */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-zinc-200">
          <h2 className="text-base font-semibold text-zinc-800 mb-3">
            Anotados y Sincronizados de Hoy ({inscripciones.length})
          </h2>
          {inscripciones.length === 0 ? (
            <p className="text-sm text-zinc-500 py-4 text-center">
              Todavía no sincronizaste la planilla. Hacé clic en <span className="font-semibold text-emerald-600">&quot;Traer / Sincronizar Inscriptos&quot;</span> arriba.
            </p>
          ) : (
            <div className="space-y-2">
              {inscripciones.map((i) => (
                <div key={i.id} className="flex flex-wrap items-center justify-between rounded-lg bg-zinc-50 border border-zinc-200 px-3 py-2 text-sm gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold truncate">{i.apodo}</span>
                    {i.vip && <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px] font-bold">VIP</span>}
                    <span className="text-xs bg-white border border-zinc-200 px-2 py-0.5 rounded font-medium">{i.sede}</span>
                    {i.flexible && <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[10px] font-bold">FLEX</span>}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Botón de pago */}
                    <button
                      onClick={() => toggleEstadoPagoLocal(i.id)}
                      className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                        i.estadoPago === "AL_DÍA"
                          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                          : "bg-red-100 text-red-800 hover:bg-red-200"
                      }`}
                    >
                      {i.estadoPago === "AL_DÍA" ? "✅ Al día" : "❌ Debe"}
                    </button>

                    {/* Botón de baja */}
                    <button
                      onClick={() => void handleDarDeBaja(i.apodo)}
                      disabled={bajando === i.apodo}
                      className="inline-flex items-center gap-1 rounded bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 transition disabled:opacity-50"
                    >
                      {bajando === i.apodo ? <Loader2 className="size-3 animate-spin" /> : <UserMinus className="size-3" />}
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
