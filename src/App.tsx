import React, { useEffect, useState } from "react";
import { CloudRain, ExternalLink, Loader2, RefreshCw, UserMinus, ShieldAlert, Shuffle, Users, Copy, Check, Shield } from "lucide-react";
import { ejecutarOrganizarSheet, leerInscriptos, obtenerPlantelSheet, registrarBajaSheet, type InscriptoSheet, type JugadorPlantelSheet } from "@/lib/sheets.functions";
import { SEDES, SEDE_LABELS, type Sede, type InscripcionLocal } from "@/lib/types";
import { armarConvocatoriasPorSede, type SedeConvocatoria } from "@/lib/services/armadorService";
import { dividirEnEquipos } from "@/lib/services/equiposService";

export default function App() {
  const [inscriptosSheet, setInscriptosSheet] = useState<InscriptoSheet[]>([]);
  const [plantel, setPlantel] = useState<JugadorPlantelSheet[]>([]);
  const [inscripciones, setInscripciones] = useState<InscripcionLocal[]>([]);
  
  const [cargando, setCargando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [bajando, setBajando] = useState<string | null>(null);
  const [copiadoSede, setCopiadoSede] = useState<string | null>(null);

  const [suspensionLluvia, setSuspensionLluvia] = useState(false);
  const [sedesCanceladas, setSedesCanceladas] = useState<Sede[]>([]);
  const [canchaMojadaCanton, setCanchaMojadaCanton] = useState(false);
  const [puertos10vs10, setPuertos10vs10] = useState(false);

  const [sedesArmadas, setSedesArmadas] = useState<Record<string, SedeConvocatoria>>({});

  const hoy = new Date().toISOString().slice(0, 10);
  const FORM_URL = "https://docs.google.com/forms/d/18-6FV5tk7gjSssBNUWCojRMrI4CYR18rfz3BmVUAZ3A/viewform";

  const cargarDatosIniciales = async () => {
    setCargando(true);
    try {
      const resOrg = await ejecutarOrganizarSheet();
      const [sheetData, plantelData] = await Promise.all([
        leerInscriptos(resOrg.solapas ? { solapas: resOrg.solapas } : undefined),
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

  const sincronizarPlanilla = async () => {
    setSincronizando(true);
    try {
      const resOrg = await ejecutarOrganizarSheet();
      const [sheetData, plantelData] = await Promise.all([
        leerInscriptos(resOrg.solapas ? { solapas: resOrg.solapas } : undefined),
        obtenerPlantelSheet()
      ]);
      
      setInscriptosSheet(sheetData);
      setPlantel(plantelData);

      const pagosMap = new Map<string, boolean>();
      plantelData.forEach(p => {
        if (p.email) pagosMap.set(p.email.toLowerCase().trim(), p.pago);
        if (p.email_alternativo) pagosMap.set(p.email_alternativo.toLowerCase().trim(), p.pago);
      });

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

      const resultadoArmado = armarConvocatoriasPorSede(
        consolidadas,
        suspensionLluvia,
        sedesCanceladas,
        canchaMojadaCanton,
        puertos10vs10
      );
      setSedesArmadas(resultadoArmado);

      alert(`✅ Sincronización exitosa: ${consolidadas.length} inscripto(s) actualizados.`);
    } catch (err) {
      alert("❌ Error al sincronizar la planilla.");
      console.error(err);
    } finally {
      setSincronizando(false);
    }
  };

  const rearmarPartidos = () => {
    if (inscripciones.length === 0) return;
    const resultadoArmado = armarConvocatoriasPorSede(
      inscripciones,
      suspensionLluvia,
      sedesCanceladas,
      canchaMojadaCanton,
      puertos10vs10
    );
    setSedesArmadas(resultadoArmado);
  };

  useEffect(() => {
    rearmarPartidos();
  }, [suspensionLluvia, sedesCanceladas, canchaMojadaCanton, puertos10vs10]);

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
        const nuevas = inscripciones.filter(i => i.apodo !== apodo);
        setInscripciones(nuevas);
        setSedesArmadas(armarConvocatoriasPorSede(nuevas, suspensionLluvia, sedesCanceladas, canchaMojadaCanton, puertos10vs10));
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
    const nuevas = inscripciones.map(i => {
      if (i.id === id) {
        return { ...i, estadoPago: (i.estadoPago === "AL_DÍA" ? "DEBE" : "AL_DÍA") as "AL_DÍA" | "DEBE" };
      }
      return i;
    });
    setInscripciones(nuevas);
    setSedesArmadas(armarConvocatoriasPorSede(nuevas, suspensionLluvia, sedesCanceladas, canchaMojadaCanton, puertos10vs10));
  };

  const copiarParaWhatsApp = (sede: SedeConvocatoria) => {
    const nombreBonito = SEDE_LABELS[sede.nombre as Sede] || sede.nombre;
    let texto = `⚽ *CONVOCATORIA: ${nombreBonito}* ⚽\n📅 Fecha: ${hoy}\n\n`;

    if (!sede.activa) {
      texto += `❌ *SEDE SUSPENDIDA*: ${sede.motivoSuspension || "No disponible"}\n`;
    } else {
      const equipos = dividirEnEquipos(sede.convocados);
      
      texto += `✅ *TITULARES (${sede.convocados.length}/${sede.capacidad})*:\n`;
      sede.convocados.forEach((j, i) => {
        texto += `${i + 1}. ${j.apodo}${j.vip ? " ⭐" : ""}\n`;
      });

      texto += `\n⚪ *EQUIPO BLANCOS*:\n`;
      equipos.blancos.forEach((j, i) => {
        texto += `- ${j.apodo}\n`;
      });

      texto += `\n⬛ *EQUIPO NEGROS*:\n`;
      equipos.negros.forEach((j, i) => {
        texto += `- ${j.apodo}\n`;
      });

      if (sede.suplentes.length > 0) {
        texto += `\n⚠️ *SUPLENTES*:\n`;
        sede.suplentes.forEach((j, i) => {
          texto += `${i + 1}. ${j.apodo}\n`;
        });
      }
    }

    navigator.clipboard.writeText(texto);
    setCopiadoSede(sede.nombre);
    setTimeout(() => setCopiadoSede(null), 2500);
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
              🟢 Blancos vs. Negros Activo
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
              onClick={() => void sincronizarPlanilla()}
              disabled={sincronizando}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition disabled:opacity-50 shadow-sm"
            >
              {sincronizando ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Traer / Sincronizar Inscriptos
            </button>
          </div>
        </div>

        {/* Controles de Cancha y Clima */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-zinc-200 space-y-4">
          <h2 className="text-base font-semibold text-zinc-800 flex items-center gap-2">
            <ShieldAlert className="size-5 text-amber-600" />
            Controles de Cancha y Clima
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 p-3">
              <span className="text-sm font-medium flex items-center gap-2">
                <CloudRain className="size-4 text-blue-500" /> Lluvia (Suspende)
              </span>
              <input
                type="checkbox"
                checked={suspensionLluvia}
                onChange={(e) => setSuspensionLluvia(e.target.checked)}
                className="size-5 rounded border-zinc-300 text-blue-600 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 p-3">
              <span className="text-sm font-medium">💧 Cancha Mojada Cantón (➔ Puertos 2)</span>
              <input
                type="checkbox"
                checked={canchaMojadaCanton}
                onChange={(e) => setCanchaMojadaCanton(e.target.checked)}
                className="size-5 rounded border-zinc-300 text-blue-600 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 p-3 sm:col-span-2">
              <span className="text-sm font-medium">🏟️ Puertos 10vs10 (Capacidad 20)</span>
              <input
                type="checkbox"
                checked={puertos10vs10}
                onChange={(e) => setPuertos10vs10(e.target.checked)}
                className="size-5 rounded border-zinc-300 text-blue-600 cursor-pointer"
              />
            </div>
          </div>

          <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Sedes Habilitadas y Cancelaciones
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

        {/* EQUIPOS ARMADOS (BLANCOS VS NEGROS) */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-zinc-200 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <h2 className="text-base font-semibold text-zinc-800 flex items-center gap-2">
              <Users className="size-5 text-emerald-600" />
              Equipos Armados (Blancos vs. Negros)
            </h2>
            <button
              onClick={rearmarPartidos}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition"
            >
              <Shuffle className="size-3.5" /> Recalcular Reparto
            </button>
          </div>

          {Object.keys(sedesArmadas).length === 0 ? (
            <p className="text-sm text-zinc-500 py-4 text-center">
              Sincroniza la planilla para ver el armado automático de equipos.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.values(sedesArmadas).map((sede) => {
                const equipos = dividirEnEquipos(sede.convocados);
                return (
                  <div key={sede.nombre} className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-zinc-800">
                        {SEDE_LABELS[sede.nombre as Sede] || sede.nombre}
                      </h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copiarParaWhatsApp(sede)}
                          title="Copiar lista y equipos para WhatsApp"
                          className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium transition ${
                            copiadoSede === sede.nombre
                              ? "bg-emerald-600 text-white"
                              : "bg-zinc-200 hover:bg-zinc-300 text-zinc-800"
                          }`}
                        >
                          {copiadoSede === sede.nombre ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                          {copiadoSede === sede.nombre ? "¡Copiado!" : "WhatsApp"}
                        </button>
                        <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                          sede.activa ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                        }`}>
                          {sede.activa ? `${sede.convocados.length} / ${sede.capacidad}` : "SUSPENDIDA"}
                        </span>
                      </div>
                    </div>

                    {!sede.activa ? (
                      <p className="text-xs text-red-600 font-medium py-2">
                        ❌ {sede.motivoSuspension || "Sede suspendida"}
                      </p>
                    ) : (
                      <div className="space-y-3 text-xs">
                        {/* Division en Equipos Blancos y Negros */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg bg-white p-2.5 border border-zinc-200 space-y-1">
                            <p className="font-bold text-zinc-700 flex items-center gap-1 border-b pb-1">
                              <Shield className="size-3 text-zinc-400" /> Blancos ({equipos.blancos.length})
                            </p>
                            {equipos.blancos.map((j, i) => (
                              <p key={i} className="truncate text-zinc-600">• {j.apodo}</p>
                            ))}
                          </div>

                          <div className="rounded-lg bg-zinc-900 text-zinc-100 p-2.5 border border-zinc-800 space-y-1">
                            <p className="font-bold text-zinc-200 flex items-center gap-1 border-b border-zinc-800 pb-1">
                              <Shield className="size-3 text-zinc-400" /> Negros ({equipos.negros.length})
                            </p>
                            {equipos.negros.map((j, i) => (
                              <p key={i} className="truncate text-zinc-300">• {j.apodo}</p>
                            ))}
                          </div>
                        </div>

                        {sede.suplentes.length > 0 && (
                          <div>
                            <p className="font-semibold text-amber-600 uppercase tracking-wider mb-1">Suplentes ({sede.suplentes.length})</p>
                            <ul className="space-y-1">
                              {sede.suplentes.map((j, i) => (
                                <li key={i} className="flex items-center justify-between bg-amber-50/50 px-2.5 py-1 rounded border border-amber-200 text-amber-900">
                                  <span className="font-medium">{j.apodo}</span>
                                  <span className="text-[9px] bg-amber-200 text-amber-800 px-1 rounded font-bold">SUPLENTE</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* CONTROL GENERAL DE ANOTADOS */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-zinc-200">
          <h2 className="text-base font-semibold text-zinc-800 mb-3">
            Control General de Anotados ({inscripciones.length})
          </h2>
          {inscripciones.length === 0 ? (
            <p className="text-sm text-zinc-500 py-4 text-center">
              Todavía no sincronizaste la planilla.
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
