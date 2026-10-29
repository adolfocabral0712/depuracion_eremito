function responderJSON(datos, estado = 200) {
  return new Response(
    JSON.stringify(datos, null, 2),
    {
      status: estado,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8",

        "Cache-Control":
          "no-store, no-cache, must-revalidate",

        "X-Content-Type-Options":
          "nosniff"
      }
    }
  );
}


function extraerDepuracion(datos) {
  if (
    datos &&
    typeof datos === "object" &&
    datos.depuracion_eremito &&
    typeof datos.depuracion_eremito === "object"
  ) {
    return datos.depuracion_eremito;
  }

  throw new Error(
    "El JSON no contiene la sección depuracion_eremito."
  );
}


async function consultarDatos(env) {
  if (!env.CONTROL_DOCUMENTAL_JSON_URL) {
    throw new Error(
      "No está configurado el secreto " +
      "CONTROL_DOCUMENTAL_JSON_URL."
    );
  }

  const respuesta = await fetch(
    env.CONTROL_DOCUMENTAL_JSON_URL,
    {
      method: "GET",

      headers: {
        "Accept": "application/json",
        "Cache-Control": "no-cache",
        "User-Agent":
          "DepuracionERemito-Cloudflare/1.0"
      },

      cf: {
        cacheTtl: 0,
        cacheEverything: false
      },

      signal: AbortSignal.timeout(30000)
    }
  );

  if (!respuesta.ok) {
    throw new Error(
      `El origen respondió HTTP ${respuesta.status}.`
    );
  }

  const texto = await respuesta.text();

  let datos;

  try {
    datos = JSON.parse(texto);
  } catch {
    throw new Error(
      "El archivo consultado no contiene un JSON válido."
    );
  }

  return {
    depuracion: extraerDepuracion(datos),

    actualizado:
      datos.actualizado ||
      datos.fecha_actualizacion ||
      datos.ultima_actualizacion ||
      null
  };
}


async function atenderAPI(env) {
  try {
    const resultado =
      await consultarDatos(env);

    return responderJSON({
      ok: true,

      actualizado:
        resultado.actualizado,

      depuracion_eremito:
        resultado.depuracion
    });

  } catch (error) {
    return responderJSON(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "No fue posible consultar los datos."
      },
      502
    );
  }
}


export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/datos") {
      if (request.method !== "GET") {
        return responderJSON(
          {
            ok: false,
            error: "Utilizá el método GET."
          },
          405
        );
      }

      return atenderAPI(env);
    }

    return env.ASSETS.fetch(request);
  }
};
