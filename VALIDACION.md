# Alcance de la validación local

Entrega verificada el 20 de noviembre de 2026, hora de Lima.

## Pruebas automáticas

28 pruebas Node aprobadas: conteo y exclusión de secciones, reglas de extensión, coincidencias en español con tildes y mayúsculas, ausencia de doble conteo, exclusión de citas, correspondencia autor-año, evidencias y límites de puntaje del adaptador IA. Incluyen las 17 pruebas del núcleo original de comparación/búsqueda, con proveedores simulados.

## Flujo local completo

- Servidor HTTP local: inicio correcto y respuesta de salud.
- Navegador → carga DOCX → extracción Python → revisión → resultados: comprobado con un documento real. Se reconocieron seis citas y seis entradas compatibles. El cuerpo resultó de 2045 palabras con las reglas documentadas; el conteo no es el de Word.
- Comparación de dos DOCX: resultado visible con fuente y fragmentos. Comparación de un texto idéntico consigo mismo: 100 %, sin doble conteo.
- Extracción de cinco reportes PDF reales por HTTP y lectura separada de indicadores: similitud 8 % y 4 %; IA 32 %, 21 % y valor suprimido `*%`.
- Reporte PDF de IA leído también desde el navegador: 32 % mostrado como IA, sin inventar un indicador de similitud.
- Exportación HTML descargada y revisada como archivo.
- Solicitud POST sin token de sesión: rechazada con HTTP 403.
- Interfaz revisada a 375 y 1440 píxeles: sin desbordamiento horizontal del documento. Navegación y configuración IA visibles; botón IA deshabilitado sin clave.

## Búsqueda web

Prueba real por la ruta HTTP con un fragmento público de Don Quijote: un segmento consultado, dos búsquedas, nueve páginas leídas, una página fallida y una fuente coincidente. Se observó 100 % de coincidencia en ese fragmento. Es una comprobación funcional de un caso conocido; no mide la precisión global del buscador ni su eficacia en ensayos académicos.

## Límites pendientes

No se hizo una llamada de pago a OpenAI: no se proporcionó una clave. El adaptador Responses/Structured Outputs se verificó con respuesta simulada, límites y errores. Falta validar su respuesta real con el modelo y cuenta que se configuren.

No se verificó equivalencia con Turnitin, ni existe conexión con su base privada. No hay evaluación automática fiable de autoría por IA ni una fórmula confirmada de las sanciones del curso. La nota asistida, cuando se active, es orientativa.

El navegador integrado emitió un aviso de su propia detección de idioma no soportada. No impidió la carga, las revisiones ni la descarga probadas.
