let lado = null; // "buy" | "sell"
let precioActual = null;

const elPrecio = document.getElementById("precio");
const elBalance = document.getElementById("balance");
const elBtnSubir = document.getElementById("btn-subir");
const elBtnBajar = document.getElementById("btn-bajar");
const elTamano = document.getElementById("tamano");
const elTamanoUsd = document.getElementById("tamano-usd");
const elBtnEnviar = document.getElementById("btn-enviar");
const elResultado = document.getElementById("resultado");
const elPosiciones = document.getElementById("posiciones");

function formatoUsd(numero) {
  return numero.toLocaleString("es-MX", { style: "currency", currency: "USD" });
}

function actualizarTamanoUsd() {
  const tamano = Number(elTamano.value);
  if (precioActual && tamano > 0) {
    elTamanoUsd.textContent = `= aprox. ${formatoUsd(tamano * precioActual)}`;
  } else {
    elTamanoUsd.textContent = "";
  }
}

function actualizarBotonEnviar() {
  const tamano = Number(elTamano.value);
  const listo = lado !== null && tamano > 0;
  elBtnEnviar.disabled = !listo;
  if (!lado) {
    elBtnEnviar.textContent = "Elige subir o bajar primero";
  } else if (!(tamano > 0)) {
    elBtnEnviar.textContent = "Escribe cuánto quieres apostar";
  } else {
    elBtnEnviar.textContent = lado === "buy" ? `Apostar a que SUBE` : `Apostar a que BAJA`;
  }
}

elBtnSubir.addEventListener("click", () => {
  lado = "buy";
  elBtnSubir.classList.add("activo");
  elBtnBajar.classList.remove("activo");
  actualizarBotonEnviar();
});

elBtnBajar.addEventListener("click", () => {
  lado = "sell";
  elBtnBajar.classList.add("activo");
  elBtnSubir.classList.remove("activo");
  actualizarBotonEnviar();
});

elTamano.addEventListener("input", () => {
  actualizarTamanoUsd();
  actualizarBotonEnviar();
});

async function cargarDashboard() {
  try {
    const res = await fetch("/api/dashboard");
    const json = await res.json();
    if (!json.ok) throw new Error(json.reason);

    precioActual = json.data.price;
    elPrecio.textContent = precioActual ? formatoUsd(precioActual) : "sin datos";
    elBalance.textContent = formatoUsd(json.data.balance ?? 0);

    if (json.data.positions.length === 0) {
      elPosiciones.textContent = "ninguna";
    } else {
      elPosiciones.textContent = JSON.stringify(json.data.positions);
    }

    actualizarTamanoUsd();
  } catch (err) {
    elPrecio.textContent = "sin conexión";
    console.error("Error cargando el dashboard:", err);
  }
}

elBtnEnviar.addEventListener("click", async () => {
  const tamano = Number(elTamano.value);
  elBtnEnviar.disabled = true;
  elResultado.hidden = true;

  try {
    const res = await fetch("/api/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ side: lado, size: tamano }),
    });
    const json = await res.json();

    elResultado.hidden = false;
    if (json.ok) {
      elResultado.className = "resultado exito";
      elResultado.textContent = `Listo. Orden confirmada (id ${json.orderId}).`;
    } else {
      elResultado.className = "resultado error";
      elResultado.textContent = `No se pudo completar: ${json.reason}`;
    }
  } catch (err) {
    elResultado.hidden = false;
    elResultado.className = "resultado error";
    elResultado.textContent = "No se pudo conectar con el servidor. Intenta de nuevo.";
  } finally {
    actualizarBotonEnviar();
    cargarDashboard();
  }
});

cargarDashboard();
setInterval(cargarDashboard, 3000);

// --- Publicar una señal ---

let senalLado = null; // "buy" | "sell"

const elSenalBtnSubir = document.getElementById("senal-btn-subir");
const elSenalBtnBajar = document.getElementById("senal-btn-bajar");
const elSenalTp = document.getElementById("senal-tp");
const elSenalSl = document.getElementById("senal-sl");
const elSenalHoras = document.getElementById("senal-horas");
const elSenalBtnPublicar = document.getElementById("senal-btn-publicar");
const elSenalResultado = document.getElementById("senal-resultado");
const elListaSenales = document.getElementById("lista-senales");

function actualizarBotonPublicar() {
  const tp = Number(elSenalTp.value);
  const sl = Number(elSenalSl.value);
  const horas = Number(elSenalHoras.value);
  const listo = senalLado !== null && tp > 0 && sl > 0 && horas > 0;
  elSenalBtnPublicar.disabled = !listo;
  elSenalBtnPublicar.textContent = senalLado === null ? "Elige Long o Short primero" : "Publicar señal";
}

elSenalBtnSubir.addEventListener("click", () => {
  senalLado = "buy";
  elSenalBtnSubir.classList.add("activo");
  elSenalBtnBajar.classList.remove("activo");
  actualizarBotonPublicar();
});

elSenalBtnBajar.addEventListener("click", () => {
  senalLado = "sell";
  elSenalBtnBajar.classList.add("activo");
  elSenalBtnSubir.classList.remove("activo");
  actualizarBotonPublicar();
});

[elSenalTp, elSenalSl, elSenalHoras].forEach((el) => el.addEventListener("input", actualizarBotonPublicar));

elSenalBtnPublicar.addEventListener("click", async () => {
  elSenalBtnPublicar.disabled = true;
  elSenalResultado.hidden = true;

  try {
    const res = await fetch("/api/signals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        side: senalLado,
        tpPct: Number(elSenalTp.value),
        slPct: Number(elSenalSl.value),
        holdHours: Number(elSenalHoras.value),
      }),
    });
    const json = await res.json();

    elSenalResultado.hidden = false;
    if (json.ok) {
      elSenalResultado.className = "resultado exito";
      elSenalResultado.textContent = "Señal publicada.";
      elSenalTp.value = "";
      elSenalSl.value = "";
      elSenalHoras.value = "";
      cargarSenales();
    } else {
      elSenalResultado.className = "resultado error";
      elSenalResultado.textContent = `No se pudo publicar: ${json.reason}`;
    }
  } catch (err) {
    elSenalResultado.hidden = false;
    elSenalResultado.className = "resultado error";
    elSenalResultado.textContent = "No se pudo conectar con el servidor.";
  } finally {
    actualizarBotonPublicar();
  }
});

function formatoFecha(iso) {
  return new Date(iso).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
}

async function cargarSenales() {
  try {
    const res = await fetch("/api/signals");
    const json = await res.json();
    if (!json.ok) throw new Error(json.reason);

    if (json.signals.length === 0) {
      elListaSenales.textContent = "Todavía no hay señales publicadas.";
      return;
    }

    elListaSenales.innerHTML = json.signals
      .map((s) => {
        const claseLado = s.side === "buy" ? "side-long" : "side-short";
        const textoLado = s.side === "buy" ? "LONG" : "SHORT";
        return `
          <div class="senal-item" data-id="${s.id}">
            <div class="fila"><span class="${claseLado}">${textoLado} ${s.market}</span><span>${formatoFecha(s.createdAt)}</span></div>
            <div class="fila"><span>Entrada</span><span>${formatoUsd(s.entryPrice)}</span></div>
            <div class="fila"><span>Take profit (+${(s.tpPct * 100).toFixed(1)}%)</span><span>${formatoUsd(s.tpPrice)}</span></div>
            <div class="fila"><span>Stop loss (-${(s.slPct * 100).toFixed(1)}%)</span><span>${formatoUsd(s.slPrice)}</span></div>
            <div class="fila"><span>Duración</span><span>${(s.holdMinutes / 60).toFixed(1)} h</span></div>
            <button class="grafico-btn" type="button">Ver gráfico</button>
            <div class="grafico-container" hidden></div>
            <label class="tamano-label" style="margin-top:8px">¿Cuánto BTC quieres copiar?</label>
            <input type="number" class="copiar-tamano" min="0" step="0.001" value="0.001" />
            <button class="copiar-btn" type="button" data-side="${s.side}">Copiar esta señal</button>
            <div class="copiar-resultado resultado" hidden></div>
          </div>
        `;
      })
      .join("");
  } catch (err) {
    elListaSenales.textContent = "No se pudo cargar el historial.";
    console.error(err);
  }
}

cargarSenales();

// --- Gráfico de una señal (precio + entrada/TP/SL) ---

function construirSvgGrafico(signal, candles) {
  const ancho = 560;
  const alto = 220;
  const padIzq = 8;
  const padDer = 68;
  const padArriba = 16;
  const padAbajo = 16;
  const areaAncho = ancho - padIzq - padDer;
  const areaAlto = alto - padArriba - padAbajo;

  const nivelesReferencia = [signal.entryPrice, signal.tpPrice, signal.slPrice];
  const precios = candles.length > 0 ? candles.map((c) => c.c).concat(nivelesReferencia) : nivelesReferencia;
  const precioMax = Math.max(...precios);
  const precioMin = Math.min(...precios);
  const rango = precioMax - precioMin || 1;

  function y(precio) {
    return padArriba + areaAlto * (1 - (precio - precioMin) / rango);
  }

  let polilinea = "";
  if (candles.length > 1) {
    const tMin = candles[0].t;
    const tMax = candles[candles.length - 1].t;
    const tRango = tMax - tMin || 1;
    polilinea = candles
      .map((c) => `${(padIzq + areaAncho * ((c.t - tMin) / tRango)).toFixed(1)},${y(c.c).toFixed(1)}`)
      .join(" ");
  }

  function lineaNivel(precio, color, guiones, etiqueta) {
    const yy = y(precio);
    return `
      <line x1="${padIzq}" y1="${yy.toFixed(1)}" x2="${ancho - padDer}" y2="${yy.toFixed(1)}"
            stroke="${color}" stroke-width="1.5" stroke-dasharray="${guiones}" />
      <text x="${ancho - padDer + 6}" y="${(yy + 4).toFixed(1)}" font-size="11" fill="${color}">${etiqueta}</text>
    `;
  }

  return `
    <svg viewBox="0 0 ${ancho} ${alto}" width="100%" height="180" style="background:#f8fafc;border-radius:10px;display:block">
      ${lineaNivel(signal.tpPrice, "#16a34a", "5,3", `TP ${Math.round(signal.tpPrice).toLocaleString()}`)}
      ${lineaNivel(signal.entryPrice, "#64748b", "2,3", `Entrada ${Math.round(signal.entryPrice).toLocaleString()}`)}
      ${lineaNivel(signal.slPrice, "#dc2626", "5,3", `SL ${Math.round(signal.slPrice).toLocaleString()}`)}
      ${polilinea ? `<polyline points="${polilinea}" fill="none" stroke="#0f172a" stroke-width="2" />` : ""}
    </svg>
  `;
}

elListaSenales.addEventListener("click", async (evento) => {
  const boton = evento.target.closest(".grafico-btn");
  if (!boton) return;

  const tarjeta = boton.closest(".senal-item");
  const idSenal = tarjeta.dataset.id;
  const contenedor = tarjeta.querySelector(".grafico-container");

  if (!contenedor.hidden) {
    contenedor.hidden = true;
    return;
  }

  contenedor.hidden = false;
  contenedor.textContent = "Cargando gráfico...";

  try {
    const res = await fetch(`/api/signals/${idSenal}/candles`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.reason);

    if (json.candles.length === 0) {
      contenedor.textContent = "Esta señal es muy reciente todavía — vuelve en unos minutos para ver el gráfico.";
      return;
    }

    contenedor.innerHTML = construirSvgGrafico(json.signal, json.candles);
  } catch (err) {
    contenedor.textContent = "No se pudo cargar el gráfico.";
    console.error(err);
  }
});

// --- Copiar una señal con un clic ---
// Reutiliza la misma ruta /api/order que usa el botón manual de arriba —
// es literalmente el mismo trade, solo que precargado desde la señal.
elListaSenales.addEventListener("click", async (evento) => {
  const boton = evento.target.closest(".copiar-btn");
  if (!boton) return;

  const tarjeta = boton.closest(".senal-item");
  const elTamanoCopia = tarjeta.querySelector(".copiar-tamano");
  const elResultadoCopia = tarjeta.querySelector(".copiar-resultado");
  const side = boton.dataset.side;
  const size = Number(elTamanoCopia.value);

  boton.disabled = true;
  elResultadoCopia.hidden = true;

  try {
    const res = await fetch("/api/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ side, size }),
    });
    const json = await res.json();

    elResultadoCopia.hidden = false;
    if (json.ok) {
      elResultadoCopia.className = "copiar-resultado resultado exito";
      elResultadoCopia.textContent = `Copiado. Orden confirmada (id ${json.orderId}).`;
    } else {
      elResultadoCopia.className = "copiar-resultado resultado error";
      elResultadoCopia.textContent = `No se pudo copiar: ${json.reason}`;
    }
  } catch (err) {
    elResultadoCopia.hidden = false;
    elResultadoCopia.className = "copiar-resultado resultado error";
    elResultadoCopia.textContent = "No se pudo conectar con el servidor.";
  } finally {
    boton.disabled = false;
    cargarDashboard();
  }
});
