# Validación de AI Redaction v0.5

## Pruebas automáticas locales

36 pruebas Node aprobadas: lógica de revisión, citas, comparación, acceso privado, hash scrypt, cookies HttpOnly y Secure, caducidad y cierre de sesión, CSRF y límites por sesión. Incluyen respuestas simuladas de OpenRouter, Gemini y OpenAI, así como errores de saldo y respuestas incompletas.

## Docker y flujo completo

Imagen construida con Docker Desktop, Node.js 24 y Python 3.11. El contenedor ejecuta el servidor con usuario `node`. La ruta `/api/health` devuelve versión `0.5.0`.

La prueba HTTP dentro del contenedor verificó acceso anónimo rechazado, clave incorrecta rechazada, acceso correcto, origen cruzado rechazado, extracción de texto, correspondencia de citas, comparación de un texto idéntico (100 %), lectura separada de IA y similitud, consentimiento requerido y cierre de sesión. También se cargó y extrajo un DOCX real mediante el lector Python del contenedor.

`render.yaml` validado contra el esquema JSON oficial descargado de Render. Los secretos y documentos personales quedaron fuera del contexto Docker y del repositorio.

## IA real

Se realizó una llamada real a OpenRouter con texto ficticio y el modelo `google/gemini-3.5-flash-lite`. Se obtuvo el informe estructurado esperado y la evidencia literal coincidió con el texto. Esto prueba la conexión y un caso funcional; no mide calidad o precisión global de las evaluaciones.

Los adaptadores nativos de Gemini y OpenAI tienen pruebas simuladas. No se ejecutaron llamadas reales con claves de esos proveedores.

## Validación conservada de la primera versión

El lector DOCX reconoció seis citas y seis referencias compatibles del ensayo de prueba. Cinco reportes PDF se extrajeron por HTTP con resultados separados: similitud 8 % y 4 %; IA 32 %, 21 % y valor suprimido `*%`. La exportación HTML se descargó y revisó. Una búsqueda web real de un fragmento público de Don Quijote encontró una fuente coincidente, con nueve páginas leídas y un fallo informado.

## Límites

La revisión es formativa, sin equivalencia demostrada con Turnitin ni el bot del profesor. No se calcula autoría por estilo y no se aplican penalidades automáticas. La extracción PDF puede alterar saltos y orden; no hay OCR. La calidad académica y las fuentes requieren revisión humana.

El estado final de Render y GitHub Actions se comunica con la entrega; construir o solicitar un despliegue no se considera prueba de que esté disponible en Internet.
