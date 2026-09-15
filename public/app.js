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
