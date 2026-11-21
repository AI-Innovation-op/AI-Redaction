# Margen · Revisor académico

App local para leer trabajos en español, revisar extensión y citas, comparar textos y preparar una evaluación formativa. Se creó como herramienta independiente; no modifica el proyecto Entel de la carpeta superior.

## Abrir en este equipo

Ejecuta `Iniciar.ps1` con PowerShell y abre **http://127.0.0.1:4317**. Mantén la ventana del servidor abierta; `Ctrl+C` lo detiene. Si ya está iniciado, basta con abrir la dirección. El servidor escucha únicamente en el equipo local.

```powershell
& 'D:\8052\revisor-academico\Iniciar.ps1'
```

El iniciador busca primero Node y Python del entorno oficial de Codex, y después los del sistema. En otro equipo se requieren Node.js 22 o posterior y Python 3 con `python-docx` y `pdfplumber`. No hay paquetes npm adicionales.

```powershell
python -m pip install -r requirements.txt
node server.mjs
```

## Uso

1. Carga un DOCX, PDF con texto, TXT o MD, o pega el texto. Revisa el contenido extraído.
2. Selecciona la extensión y si es mínimo, máximo o referencia. **5000 está inicialmente como referencia**, porque no se confirmó si es un mínimo o un máximo.
3. Ejecuta la revisión local y consulta observaciones y citas. Las observaciones incluyen el fragmento y un enlace al editor.
4. En Coincidencias puedes aportar hasta ocho fuentes para comparar. La búsqueda web requiere activar el envío de fragmentos y pulsar el botón.
5. Ajusta los criterios y pesos de la rúbrica. La plantilla inicial de 3+6+5+3+3 es orientativa; no se presenta como el prompt conocido del profesor.
6. Puedes leer indicadores de reportes PDF y registrar resultados externos con su métrica y alcance.
7. Exporta un informe HTML independiente. Se puede abrir e imprimir como PDF desde el navegador.

## Activar la lectura con IA (opcional)

La revisión local funciona sin clave y sin llamadas de pago. Para evaluar argumentos con un modelo:

1. Crea una clave en la cuenta de API de OpenAI.
2. Copia `.env.example` como `.env` y escribe la clave **solo en ese archivo local**.
3. Elige un modelo compatible con Responses API y Structured Outputs; el valor inicial es `gpt-6.2-astra`. Puedes cambiar `OPENAI_MODEL`.
4. Reinicia el servidor. En Rúbrica e IA, activa el permiso y pulsa Evaluar con IA. Esto envía el documento completo y la rúbrica a OpenAI, y puede tener costo en esa cuenta.

La clave nunca se devuelve al navegador. Se usa Responses API con `store:false`. Se manejan errores, rechazos y respuestas incompletas. La app valida los puntajes y busca las citas literales en el texto; una evidencia inventada se retira y anula el puntaje de ese criterio. Esta comprobación no garantiza que el razonamiento del modelo sea correcto.

Documentación oficial usada: [inicio de API](https://developers.openai.com/api/docs/quickstart), [salidas estructuradas](https://developers.openai.com/api/docs/guides/structured-outputs).

## Qué significa cada resultado

- **Revisión local:** aplica reglas de conteo, encabezados, repetición, oraciones extensas y citas autor-año. No asigna una nota de argumentación.
- **Extensión:** título, encabezados y cuerpo hasta el primer encabezado Referencias o Anexos reconocido. Los encabezados atípicos requieren ajuste manual. Los enlaces URL no cuentan como palabras. El conteo puede diferir del de Word o Turnitin.
- **Citas:** reconoce formas comunes de apellido y año. No verifica que un libro o una noticia exista ni que respalde la afirmación. Autores institucionales, apellidos compuestos y citas numéricas requieren revisión manual.
- **Similitud local:** proporción de palabras del cuerpo en secuencias coincidentes de al menos siete palabras, ignorando caja, tildes y puntuación. No equivale a plagio; cuenta cada palabra una sola vez. No mide similitud semántica o paráfrasis.
- **Búsqueda web:** hasta doce consultas y veinticinco páginas, con un presupuesto de unos 45 segundos. Muestra cobertura y fallos. Solo cubre páginas públicas accesibles; no bases privadas, archivos PDF en línea ni repositorios institucionales. Conserva el proveedor original del componente, con heurísticas de búsqueda en inglés; la cobertura en español puede ser limitada.
- **Reportes externos:** IA, probabilidad de clasificación y similitud se registran por separado, sin promedios. `*%` se conserva como valor suprimido, sin convertirlo a cero o inventar el valor exacto. La lectura del PDF debe verificarse visualmente.
- **Evaluación con IA:** lectura orientativa según la rúbrica configurada. No identifica al autor ni calcula un porcentaje de IA. No reproduce la nota del profesor ni aplica sanciones; la fórmula de las penalidades no se conoce.

No se integran GPTZero, ZeroGPT, Copyleaks ni Turnitin sin sus accesos/API autorizados. La app no tiene acceso a Turnitin ni promete replicar sus porcentajes. No incorpora funciones de humanización para eludir detectores.

## Archivos y privacidad

El documento se procesa en memoria para la sesión; no hay historial de textos guardado por la app. Recargar la página borra la sesión. El archivo que exportes sí conserva los resultados y puede incluir fragmentos o el cuerpo comparado. La revisión con IA y la búsqueda web transmiten texto únicamente después de la acción correspondiente. El servidor local no ofrece autenticación para uso público: no debe publicarse directamente en Internet.

Máximo 12 MB por archivo, 180000 caracteres por texto, 100 páginas PDF. Sin OCR. DOCX: cuerpo y tablas; no notas al pie, comentarios, texto en imágenes ni revisión completa de cambios pendientes. PDF: los saltos y el orden de lectura pueden alterarse.

## Validación

```powershell
node --test tests/*.test.mjs vendor/free-turnitin/shared/*.test.js vendor/free-turnitin/server/*.test.js
```

`node scripts/smoke.mjs` comprueba rutas HTTP contra el servidor iniciado con texto ficticio y, opcionalmente, carga archivos locales dados como argumentos. `MARGEN_ESSAY` permite elegir un TXT de prueba propio. La app y su paquete no incluyen documentos personales.

La conexión real de pago a OpenAI requiere una clave propia y no se ejecutó durante la entrega. El adaptador se comprobó con respuestas simuladas. Consulta `VALIDACION.md` para el alcance probado.

## Origen del componente

La comparación y búsqueda reutilizan el núcleo Apache 2.0 de Free-Turnitin-Plagiarism-Checker, sin modificarlo. Ver `THIRD_PARTY_NOTICES.md` y la licencia incluida. El resto de la app es implementación de esta entrega.
