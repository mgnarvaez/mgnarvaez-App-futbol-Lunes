import React, { useEffect, useState } from "react";
import {
  CloudRain,
  ExternalLink,
  Loader2,
  RefreshCw,
  UserMinus,
  ShieldAlert,
  Shuffle,
  Users,
  Copy,
  Check,
  Shield,
  MessageCircle,
  MapPin,
  Package,
  Search,
  Star,
  Send,
  History,
  AlertCircle,
  User,
  CheckCircle2,
} from "lucide-react";
import {
  ejecutarOrganizarSheet,
  leerInscriptos,
  obtenerPlantelSheet,
  registrarBajaSheet,
  obtenerMaterialesSheet,
  registrarMaterialesSheet,
  obtenerPuntajesBdSheet,
  type InscriptoSheet,
  type JugadorPlantelSheet,
  type RegistroMaterialSheet,
  type PuntajeDetalle,
} from "@/lib/sheets.functions";
import { SEDES, SEDE_LABELS, type Sede, type InscripcionLocal } from "@/lib/types";
import { armarConvocatoriasPorSede, type SedeConvocatoria } from "@/lib/armadorService";
import ComparadorConvocados from "./comparador";
import { dividirEnEquipos } from "@/lib/equiposService";

export default function App() {
  const [vistaActiva, setVistaActiva] = useState<"panel" | "plantel" | "materiales" | "cotejo">("panel");

  const [inscriptosSheet, setInscriptosSheet] = useState<InscriptoSheet[]>([]);
  const [plantel, setPlantel] = useState<JugadorPlantelSheet[]>([]);
  const [inscripciones, setInscripciones] = useState<InscripcionLocal[]>([]);
  const [bdPuntajes, setBdPuntajes] = useState<Record<string, PuntajeDetalle>>({});

  const [cargando, setCargando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [bajando, setBajando] = useState<string | null>(null);
  const [copiadoSede, setCopiadoSede] = useState<string | null>(null);

  const [busquedaPlantel, setBusquedaPlantel] = useState("");

  // Clima y Sedes
  const [suspensionLluvia, setSuspensionLluvia] = useState(false);
  const [sedesCanceladas, setSedesCanceladas] = useState<Sede[]>([]);
  const [canchaMojadaCanton, setCanchaMojadaCanton] = useState(false);
  const [puertos10vs10, setPuertos10vs10] = useState(false);

  // Armado
  const [sedesArmadas, setSedesArmadas] = useState<Record<string, SedeConvocatoria>>({});

  // ================= ESTADO MATERIALES =================
  const [historialMateriales, setHistorialMateriales] = useState<RegistroMaterialSheet[]>([]);
  const [jugadorMat, setJugadorMat] = useState("");
  const [jugadorSeleccionadoMat, setJugadorSeleccionadoMat] = useState<JugadorPlantelSheet | null>(null);
  const [materialesSeleccionados, setMaterialesSeleccionados] = useState<string[]>([]);
  const [mostrarSugerenciasMat, setMostrarSugerenciasMat] = useState(false);
  const [busquedaMat, setBusquedaMat] = useState("");
  const [loadingGuardarMat, setLoadingGuardarMat] = useState(false);
  const [mensajeMat, setMensajeMat] = useState<{ tipo: "error" | "exito"; texto: string } | null>(null);

  const OPCIONES_MATERIALES = [
    { id: "Amarillas", label: "🟨 Pecheras Amarillas" },
    { id: "Azules", label: "🟦 Pecheras Azules" },
    { id: "Rojas", label: "🟥 Pecheras Rojas" },
    { id: "Naranjas", label: "🟧 Pecheras Naranjas" },
    { id: "Verdes", label: "🟩 Pecheras Verdes" },
    { id: "Pelota", label: "⚽ Pelota" },
  ];
  const LINK_INSCRIPCION_VIP = "https://forms.gle/AvMwDfZ68FSVhACN8";

  const hoy = new Date().toISOString().slice(0, 10);
  const FORM_URL = "https://docs.google.com/forms/d/18-6FV5tk7gjSssBNUWCojRMrI4CYR18rfz3BmVUAZ3A/viewform";

  const cargarDatosIniciales = async () => {
    setCargando(true);
    try {
      const resOrg = await ejecutarOrganizarSheet();

      const [sheetData, plantelData, matData, puntajesData] = await Promise.all([
        leerInscriptos(resOrg?.solapas ? { solapas: resOrg.solapas } : undefined),
        obtenerPlantelSheet(),
        obtenerMaterialesSheet().catch(() => ({ historial: [] })),
        obtenerPuntajesBdSheet().catch(() => ({})),
      ]);

      setInscriptosSheet(sheetData || []);
      setPlantel(plantelData || []);
      setBdPuntajes(puntajesData || {});
      if (matData && Array.isArray(matData.historial)) {
        setHistorialMateriales(matData.historial);
      }
    } catch (err) {
      console.error("Error al cargar datos iniciales:", err);
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

      const [sheetData, plantelData, matData, puntajesData] = await Promise.all([
        leerInscriptos(resOrg?.solapas ? { solapas: resOrg.solapas } : undefined),
        obtenerPlantelSheet(),
        obtenerMaterialesSheet().catch(() => ({ historial: [] })),
        obtenerPuntajesBdSheet().catch(() => ({})),
      ]);

      setInscriptosSheet(sheetData || []);
      setPlantel(plantelData || []);
      setBdPuntajes(puntajesData || {});
      if (matData && Array.isArray(matData.historial)) {
        setHistorialMateriales(matData.historial);
      }

      const pagosMap = new Map<string, boolean>();
      plantelData.forEach((p) => {
        if (p.email) pagosMap.set(p.email.toLowerCase().trim(), p.pago);
        if (p.email_alternativo) pagosMap.set(p.email_alternativo.toLowerCase().trim(), p.pago);
      });

      const consolidadas: InscripcionLocal[] = (sheetData || []).map((item, idx) => {
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

      setInscripciones(consolidadas);
      const resultadoArmado = armarConvocatoriasPorSede(
        consolidadas,
        suspensionLluvia,
        sedesCanceladas,
        canchaMojadaCanton,
        puertos10vs10
      );
      setSedesArmadas(resultadoArmado);
      alert(`✅ Sincronización exitosa: ${consolidadas.length} inscripto(s) procesados.`);
    } catch (err) {
      alert("❌ Error al sincronizar la planilla.");
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
    setSedesCanceladas((prev) => (prev.includes(sede) ? prev.filter((s) => s !== sede) : [...prev, sede]));
  };

  const handleDarDeBaja = async (apodo: string) => {
    if (!confirm(`¿Confirmás dar de baja a "${apodo}"?`)) return;
    setBajando(apodo);
    try {
      const res = await registrarBajaSheet(apodo, "Baja desde Panel Web");
      if (res.ok) {
        alert(`Baja de ${apodo} registrada.`);
        const nuevas = inscripciones.filter((i) => i.apodo !== apodo);
        setInscripciones(nuevas);
        setSedesArmadas(
          armarConvocatoriasPorSede(nuevas, suspensionLluvia, sedesCanceladas, canchaMojadaCanton, puertos10vs10)
        );
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
    const nuevas = inscripciones.map((i) =>
      i.id === id ? { ...i, estadoPago: (i.estadoPago === "AL_DÍA" ? "DEBE" : "AL_DÍA") as "AL_DÍA" | "DEBE" } : i
    );
    setInscripciones(nuevas);
    setSedesArmadas(
      armarConvocatoriasPorSede(nuevas, suspensionLluvia, sedesCanceladas, canchaMojadaCanton, puertos10vs10)
    );
  };

  const copiarParaWhatsApp = (sede: SedeConvocatoria) => {
    const nombreBonito = SEDE_LABELS[sede.nombre as Sede] || sede.nombre;
    const puntajesGeneralesMap: Record<string, number> = {};
    Object.keys(bdPuntajes).forEach((k) => {
      puntajesGeneralesMap[k] = bdPuntajes[k].general || 50;
    });

    let texto = `⚽ *CONVOCATORIA: ${nombreBonito}* ⚽\n📅 Fecha: ${hoy}\n\n`;

    if (!sede.activa) {
      texto += `❌ *SEDE SUSPENDIDA*: ${sede.motivoSuspension || "No disponible"}\n`;
    } else {
      const equipos = dividirEnEquipos(sede.convocados, puntajesGeneralesMap);

      texto += `✅ *TITULARES (${sede.convocados.length}/${sede.capacidad})*:\n`;
      sede.convocados.forEach((j, i) => {
        texto += `${i + 1}. ${j.apodo}${j.vip ? " ⭐" : ""}\n`;
      });

      texto += `\n⚪ *EQUIPO BLANCOS* (Promedio: ${equipos.promedioBlancos}):\n`;
      equipos.blancos.forEach((j) => {
        texto += `- ${j.apodo}\n`;
      });

      texto += `\n⬛ *EQUIPO NEGROS* (Promedio: ${equipos.promedioNegros}):\n`;
      equipos.negros.forEach((j) => {
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

  const formatearLinkWhatsApp = (telefono: string) => {
    if (!telefono) return "#";
    const numeroLimpio = telefono.toString().replace(/\D/g, "");
    const numeroFinal = numeroLimpio.length === 10 ? `549${numeroLimpio}` : numeroLimpio;
    return `https://wa.me/${numeroFinal}`;
  };

  // ================= FUNCIONES DE MATERIALES =================
  const jugadoresFiltradosMat = (plantel || []).filter((p) => {
    if (!jugadorMat.trim()) return false;
    const q = jugadorMat.toLowerCase();
    const apodo = (p.apodo || "").toString().toLowerCase();
    const nombre = (p.nombre || "").toString().toLowerCase();
    const lote = (p.lote || "").toString().toLowerCase();
    return apodo.includes(q) || nombre.includes(q) || lote.includes(q);
  });

  const toggleMaterial = (item: string) => {
    setMaterialesSeleccionados((prev) => (prev.includes(item) ? prev.filter((m) => m !== item) : [...prev, item]));
  };

  const handleSubmitMat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jugadorMat.trim()) {
      setMensajeMat({ tipo: "error", texto: "Por favor seleccioná un jugador del plantel." });
      return;
    }
    if (materialesSeleccionados.length === 0) {
      setMensajeMat({ tipo: "error", texto: "Seleccioná al menos un material entregado." });
      return;
    }

    setLoadingGuardarMat(true);
    setMensajeMat(null);

    try {
      const nombreFinal = jugadorSeleccionadoMat
        ? jugadorSeleccionadoMat.apodo || jugadorSeleccionadoMat.nombre || ""
        : jugadorMat.trim();
      const res = await registrarMaterialesSheet(nombreFinal, materialesSeleccionados);

      if (res.ok) {
        setMensajeMat({ tipo: "exito", texto: `Materiales asignados a ${nombreFinal} con éxito.` });
        setJugadorMat("");
        setJugadorSeleccionadoMat(null);
        setMaterialesSeleccionados([]);
        const matData = await obtenerMaterialesSheet().catch(() => ({ historial: [] }));
        if (matData && Array.isArray(matData.historial)) {
          setHistorialMateriales(matData.historial);
        }
      } else {
        setMensajeMat({ tipo: "error", texto: res.mensaje });
      }
    } catch (err) {
      setMensajeMat({ tipo: "error", texto: "Error de comunicación con la base de datos." });
    } finally {
      setLoadingGuardarMat(false);
    }
  };

  const armarLinkWhatsappVIP = (item: RegistroMaterialSheet) => {
    const jugadorStr = (item.jugador || "").toString();
    const materialesStr = (item.materiales || "").toString();
    const msj = `Hola ${jugadorStr}! Recordá que tenés prestado: ${materialesStr}. Acordate de llevarlo al próximo partido. Aca tenes el link para anotarte en cualquier momento antes de lunes y asegurarte participacion: ${LINK_INSCRIPCION_VIP}`;

    const pEncontrado = (plantel || []).find(
      (p) =>
        (p.apodo && p.apodo.toString().toLowerCase() === jugadorStr.toLowerCase()) ||
        (p.nombre && p.nombre.toString().toLowerCase() === jugadorStr.toLowerCase())
    );
    const numTel = pEncontrado ? formatearLinkWhatsApp(pEncontrado.telefono).replace("https://wa.me/", "") : "";

    if (numTel && numTel !== "#") return `https://api.whatsapp.com/send?phone=${numTel}&text=${encodeURIComponent(msj)}`;
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(msj)}`;
  };

  const historialMatFiltrado = (historialMateriales || []).filter((h) => {
    const jugadorTexto = (h.jugador || "").toString().toLowerCase();
    const materialesTexto = (h.materiales || "").toString().toLowerCase();
    const loteTexto = (h.lote || "").toString().toLowerCase();
    const busquedaLimpa = busquedaMat.toLowerCase().trim();

    return (
      jugadorTexto.includes(busquedaLimpa) ||
      materialesTexto.includes(busquedaLimpa) ||
      loteTexto.includes(busquedaLimpa)
    );
  });

  const plantelFiltrado = (plantel || []).filter((j) => {
    if (!busquedaPlantel) return true;
    const termino = busquedaPlantel.toLowerCase();
    const n = (j.nombre || "").toString().toLowerCase();
    const a = (j.apodo || "").toString().toLowerCase();
    const b = (j.barrio || "").toString().toLowerCase();
    const p = (j.puesto || "").toString().toLowerCase();
    const e = (j.email || "").toString().toLowerCase();

    return n.includes(termino) || a.includes(termino) || b.includes(termino) || p.includes(termino) || e.includes(termino);
  });

  return (
    <div className="min-h-screen bg-zinc-50 p-4 sm:p-6 text-zinc-900">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* NAVEGACIÓN */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-zinc-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-100 pb-4">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                ⚽ Sistema de Fútbol · <span className="text-zinc-500 font-normal text-base">{hoy}</span>
              </h1>
            </div>
            <div className="flex items-center gap-2 bg-zinc-100 p-1 rounded-lg overflow-x-auto w-full sm:w-auto">
              <button
                onClick={() => setVistaActiva("panel")}
                className={`px-4 py-2 text-sm font-semibold rounded-md transition whitespace-nowrap ${
                  vistaActiva === "panel" ? "bg-white shadow-sm text-zinc-900" : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                Convocatorias
              </button>
              <button
                onClick={() => setVistaActiva("plantel")}
                className={`px-4 py-2 text-sm font-semibold rounded-md transition whitespace-nowrap ${
                  vistaActiva === "plantel" ? "bg-white shadow-sm text-zinc-900" : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                Base Jugadores
              </button>
              <button
                onClick={() => setVistaActiva("materiales")}
                className={`px-4 py-2 text-sm font-semibold rounded-md transition whitespace-nowrap ${
                  vistaActiva === "materiales" ? "bg-white shadow-sm text-zinc-900" : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                Materiales
              </button>
              <button
                onClick={() => setVistaActiva("cotejo")}
                className={}
              >
                📊 Cotejo B14
              </button>
            </div>
          </div>
        </div>

                {vistaActiva === "cotejo" && (
          <ComparadorConvocados
            sedesCanceladas={sedesCanceladas}
            canchaMojadaCanton={canchaMojadaCanton}
            puertos10vs10={puertos10vs10}
          />
        )}

        {/* VISTA 1: PANEL DE CONVOCATORIAS */}
        {vistaActiva === "panel" && (
          <div className="space-y-6">
            <div className="rounded-xl bg-white p-6 shadow-sm border border-zinc-200 flex flex-wrap gap-3">
              <a
                href={FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition"
              >
                <ExternalLink className="size-4" /> Abrir Formulario
              </a>
              <button
                onClick={() => void sincronizarPlanilla()}
                disabled={sincronizando}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition disabled:opacity-50 shadow-sm"
              >
                {sincronizando ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Sincronizar Inscriptos
              </button>
              <button
                onClick={() => setVistaActiva("cotejo")}
                className={}
              >
                📊 Cotejo B14
              </button>
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm border border-zinc-200 space-y-4">
              <h2 className="text-base font-semibold text-zinc-800 flex items-center gap-2">
                <ShieldAlert className="size-5 text-amber-600" /> Controles de Cancha y Clima
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {SEDES.map((sede) => {
                  const cancelada = sedesCanceladas.includes(sede);
                  return (
                    <button
                      key={sede}
                      onClick={() => toggleSedeCancelada(sede)}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium transition ${
                        cancelada ? "border-red-200 bg-red-50 text-red-700" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"
                      }`}
                    >
                      <span>{SEDE_LABELS[sede]}</span>
                      <span className="text-xs px-2 py-0.5 rounded font-bold">{cancelada ? "❌ Cancelada" : "✅ Activa"}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm border border-zinc-200 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <h2 className="text-base font-semibold text-zinc-800 flex items-center gap-2">
                  <Users className="size-5 text-emerald-600" /> Equipos Armados
                </h2>
                <button
                  onClick={rearmarPartidos}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition"
                >
                  <Shuffle className="size-3.5" /> Recalcular
                </button>
              </div>

              {Object.keys(sedesArmadas).length === 0 ? (
                <p className="text-sm text-zinc-500 py-4 text-center">Sincroniza la planilla para ver el armado.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Object.values(sedesArmadas).map((sede) => {
                    const puntajesGeneralesMap: Record<string, number> = {};
                    Object.keys(bdPuntajes).forEach((k) => {
                      puntajesGeneralesMap[k] = bdPuntajes[k].general || 50;
                    });
                    const equipos = dividirEnEquipos(sede.convocados, puntajesGeneralesMap);

                    return (
                      <div key={sede.nombre} className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-zinc-800 text-lg">{SEDE_LABELS[sede.nombre as Sede] || sede.nombre}</h3>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => copiarParaWhatsApp(sede)}
                              className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-bold transition ${
                                copiadoSede === sede.nombre ? "bg-emerald-600 text-white" : "bg-zinc-200 hover:bg-zinc-300 text-zinc-800"
                              }`}
                            >
                              {copiadoSede === sede.nombre ? <Check className="size-4" /> : <Copy className="size-4" />}{" "}
                              {copiadoSede === sede.nombre ? "¡Copiado!" : "WhatsApp"}
                            </button>
                            <span
                              className={`text-xs px-2 py-1 rounded font-bold ${
                                sede.activa ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                              }`}
                            >
                              {sede.activa ? `${sede.convocados.length} / ${sede.capacidad}` : "SUSPENDIDA"}
                            </span>
                          </div>
                        </div>

                        {sede.activa && (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg bg-white p-3 border border-zinc-200">
                              <p className="font-bold text-zinc-700 flex items-center justify-between border-b pb-2 mb-2">
                                <span className="flex items-center gap-1">
                                  <Shield className="size-4" /> Blancos
                                </span>
                                <span className="text-[10px] bg-zinc-100 px-1.5 py-0.5 rounded">Prom: {equipos.promedioBlancos}</span>
                              </p>
                              <div className="space-y-1">
                                {equipos.blancos.map((j, i) => (
                                  <p key={i} className="text-sm text-zinc-600">
                                    • {j.apodo}
                                  </p>
                                ))}
                              </div>
                            </div>
                            <div className="rounded-lg bg-zinc-900 text-zinc-100 p-3 border border-zinc-800">
                              <p className="font-bold text-zinc-200 flex items-center justify-between border-b border-zinc-700 pb-2 mb-2">
                                <span className="flex items-center gap-1">
                                  <Shield className="size-4" /> Negros
                                </span>
                                <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded">Prom: {equipos.promedioNegros}</span>
                              </p>
                              <div className="space-y-1">
                                {equipos.negros.map((j, i) => (
                                  <p key={i} className="text-sm text-zinc-300">
                                    • {j.apodo}
                                  </p>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Control de pagos y bajas */}
            <div className="rounded-xl bg-white p-6 shadow-sm border border-zinc-200">
              <h2 className="text-base font-semibold text-zinc-800 mb-3">Anotados y Pagos ({inscripciones.length})</h2>
              {inscripciones.map((i) => (
                <div key={i.id} className="flex flex-wrap items-center justify-between rounded-lg bg-zinc-50 border border-zinc-200 px-3 py-2 text-sm gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{i.apodo}</span>
                    <span className="text-xs bg-white border px-2 py-0.5 rounded">{i.sede}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => toggleEstadoPagoLocal(i.id)}
                      className={`px-2.5 py-1 rounded text-xs font-bold ${
                        i.estadoPago === "AL_DÍA" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                      }`}
                    >
                      {i.estadoPago === "AL_DÍA" ? "✅ Al día" : "❌ Debe"}
                    </button>
                    <button
                      onClick={() => void handleDarDeBaja(i.apodo)}
                      disabled={bajando === i.apodo}
                      className="inline-flex items-center gap-1 rounded bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700"
                    >
                      {bajando === i.apodo ? <Loader2 className="size-3 animate-spin" /> : <UserMinus className="size-3" />} Bajar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VISTA 2: BASE DE DATOS DEL PLANTEL */}
        {vistaActiva === "plantel" && (
          <div className="rounded-xl bg-white p-6 shadow-sm border border-zinc-200 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-100 pb-4">
              <h2 className="text-lg font-bold text-zinc-800 flex items-center gap-2">
                <Users className="size-5 text-blue-600" /> Directorio del Plantel ({plantelFiltrado.length}/{plantel.length})
              </h2>
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, apodo, barrio..."
                  value={busquedaPlantel}
                  onChange={(e) => setBusquedaPlantel(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>

            {cargando ? (
              <p className="text-sm text-zinc-500 py-8 text-center flex items-center justify-center gap-2">
                <Loader2 className="size-5 animate-spin" /> Cargando base de datos...
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {plantelFiltrado.map((j, i) => {
                  const emailKey = (j.email || "").toLowerCase().trim();
                  const emailAltKey = (j.email_alternativo || "").toLowerCase().trim();
                  const apodoKey = (j.apodo || "").toLowerCase().trim();
                  const nombreKey = (j.nombre || "").toLowerCase().trim();

                  let datosPuntaje = bdPuntajes[emailKey] || bdPuntajes[emailAltKey];
                  if (!datosPuntaje) {
                    const foundKey = Object.keys(bdPuntajes).find(
                      (k) => k.includes(apodoKey) || (apodoKey && apodoKey.includes(k)) || k.includes(nombreKey)
                    );
                    if (foundKey) datosPuntaje = bdPuntajes[foundKey];
                  }

                  return (
                    <div key={i} className="flex flex-col p-4 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-white transition shadow-sm space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-zinc-900 truncate">{j.nombre}</h3>
                          {j.apodo && <p className="text-sm font-medium text-zinc-600">"{j.apodo}"</p>}
                        </div>
                        <span className={`text-[10px] px-2 py-1 rounded font-bold shrink-0 ${j.pago ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                          {j.pago ? "✅ AL DÍA" : "❌ DEBE"}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs text-zinc-600">
                        <p className="flex items-center gap-1.5">
                          <MapPin className="size-3.5 text-zinc-400" />
                          <span className="font-medium text-zinc-800">Barrio:</span> {j.barrio || "-"} {j.lote ? `(Lote ${j.lote})` : ""}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Shield className="size-3.5 text-zinc-400" />
                          <span className="font-medium text-zinc-800">Puesto:</span> {j.puesto || "-"}
                        </p>

                        {datosPuntaje && (
                          <div className="mt-2 pt-2 border-t border-zinc-200 space-y-1 bg-emerald-50/60 p-2 rounded-lg">
                            <p className="font-bold text-emerald-800 flex items-center gap-1">
                              <Star className="size-3.5" /> Puntajes BD:
                            </p>
                            <div className="grid grid-cols-3 gap-1 text-[11px] text-zinc-700 text-center font-medium">
                              <span className="bg-white p-1 rounded border">
                                ⚔️ Ataq: <b>{datosPuntaje.ataque}</b>
                              </span>
                              <span className="bg-white p-1 rounded border">
                                🛡️ Def: <b>{datosPuntaje.defensa}</b>
                              </span>
                              <span className="bg-white p-1 rounded border">
                                🤝 Eq: <b>{datosPuntaje.equipo}</b>
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {j.telefono && (
                        <div className="pt-3 mt-auto border-t border-zinc-100">
                          <a
                            href={formatearLinkWhatsApp(j.telefono)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white px-3 py-2 rounded-lg text-xs font-bold transition shadow-sm w-full"
                          >
                            <MessageCircle className="size-4" /> Enviar WhatsApp
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VISTA 3: MATERIALES */}
        {vistaActiva === "materiales" && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-b border-zinc-200 pb-4">
              <Package className="w-8 h-8 text-emerald-600" />
              <div>
                <h1 className="text-2xl font-bold text-zinc-900">Entrega y Registro de Materiales</h1>
                <p className="text-sm text-zinc-500">Control de pecheras y pelotas asignadas al plantel oficial</p>
              </div>
            </div>

            {mensajeMat && (
              <div
                className={`border-l-4 p-4 flex items-center justify-between rounded ${
                  mensajeMat.tipo === "error" ? "bg-red-50 border-red-500 text-red-700" : "bg-emerald-50 border-emerald-500 text-emerald-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  {mensajeMat.tipo === "error" ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                  <span>{mensajeMat.texto}</span>
                </div>
                <button onClick={() => setMensajeMat(null)} className="text-sm font-bold">
                  ✕
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* FORMULARIO DE NUEVA ENTREGA */}
              <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-zinc-200 space-y-6">
                <h2 className="text-lg font-semibold text-zinc-800 flex items-center gap-2">
                  <User className="w-5 h-5 text-emerald-600" /> Nueva Entrega
                </h2>

                <form onSubmit={handleSubmitMat} className="space-y-5">
                  <div className="relative">
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Jugador (Buscar en Plantel)</label>
                    <input
                      type="text"
                      placeholder="Apodo, nombre o lote..."
                      value={jugadorMat}
                      onChange={(e) => {
                        setJugadorMat(e.target.value);
                        setJugadorSeleccionadoMat(null);
                        setMostrarSugerenciasMat(true);
                      }}
                      onFocus={() => setMostrarSugerenciasMat(true)}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                    />

                    {mostrarSugerenciasMat && jugadoresFiltradosMat.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-zinc-200 rounded-lg shadow-lg max-h-48 overflow-y-auto divide-y divide-zinc-100">
                        {jugadoresFiltradosMat.map((p, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setJugadorMat(p.apodo || p.nombre || "");
                              setJugadorSeleccionadoMat(p);
                              setMostrarSugerenciasMat(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-zinc-50 text-sm flex justify-between items-center text-zinc-800"
                          >
                            <div>
                              <span className="font-semibold">{p.apodo || p.nombre}</span>
                            </div>
                            {p.lote && <span className="text-xs bg-zinc-100 px-2 py-0.5 rounded text-zinc-600">Lote {p.lote}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-2">¿Qué se lleva?</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                      {OPCIONES_MATERIALES.map((mat) => (
                        <label
                          key={mat.id}
                          className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors ${
                            materialesSeleccionados.includes(mat.id)
                              ? "bg-emerald-50 border-emerald-500 font-medium text-emerald-900"
                              : "border-zinc-200 hover:bg-zinc-50 text-zinc-600"
                          }`}
                        >
                          <span className="text-sm">{mat.label}</span>
                          <input
                            type="checkbox"
                            checked={materialesSeleccionados.includes(mat.id)}
                            onChange={() => toggleMaterial(mat.id)}
                            className="w-4 h-4 text-emerald-600 rounded"
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loadingGuardarMat}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50"
                  >
                    {loadingGuardarMat ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Guardando...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" /> Guardar Entrega
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* HISTORIAL */}
              <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-zinc-200 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
                  <h2 className="text-lg font-semibold text-zinc-800 flex items-center gap-2">
                    <History className="w-5 h-5 text-emerald-600" /> Historial de Préstamos
                  </h2>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Buscar jugador..."
                      value={busquedaMat}
                      onChange={(e) => setBusquedaMat(e.target.value)}
                      className="pl-9 pr-4 py-1.5 text-sm border border-zinc-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none w-full sm:w-60"
                    />
                  </div>
                </div>

                {cargando ? (
                  <div className="flex items-center justify-center py-12 text-zinc-500">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                  </div>
                ) : historialMatFiltrado.length === 0 ? (
                  <div className="text-center py-12 text-zinc-500">No se encontraron entregas registradas.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-zinc-50 text-zinc-600 font-medium border-y border-zinc-200">
                        <tr>
                          <th className="py-3 px-3">Fecha</th>
                          <th className="py-3 px-3">Jugador</th>
                          <th className="py-3 px-3">Materiales</th>
                          <th className="py-3 px-3 text-center">Aviso</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {historialMatFiltrado.map((item, index) => (
                          <tr key={index} className="hover:bg-zinc-50/50">
                            <td className="py-3 px-3 text-zinc-500">{(item.fecha || "").toString()}</td>
                            <td className="py-3 px-3 font-semibold text-zinc-800">
                              {(item.jugador || "").toString()}{" "}
                              {item.lote ? <span className="text-xs font-normal text-zinc-400 block">Lote {(item.lote || "").toString()}</span> : ""}
                            </td>
                            <td className="py-3 px-3 text-zinc-600">{(item.materiales || "").toString()}</td>
                            <td className="py-3 px-3 text-center">
                              <a
                                href={armarLinkWhatsappVIP(item)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs bg-[#25D366] text-white hover:bg-[#20bd5a] px-3 py-1.5 rounded-lg font-bold transition"
                              >
                                <MessageCircle className="w-4 h-4" /> Reclamar & VIP
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
