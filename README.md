# AI Redaction · v0.5

**[Abrir AI Redaction](https://ai-redaction.onrender.com/)**

Revisor académico privado en español para uso personal y familiar. Carga un trabajo, revisa su extensión y fuentes, contrasta coincidencias y solicita una lectura formativa con IA.

## Para usar la app

1. Abre la dirección del servicio y escribe tu clave de acceso.
2. Carga un DOCX, PDF con texto o TXT; también puedes pegar el contenido.
3. Pulsa **Revisar mi trabajo**. Consulta observaciones y citas.
4. Ajusta la rúbrica del curso y solicita la revisión con IA cuando la necesites.
5. Descarga el informe para conservar los resultados.

El texto se procesa en memoria. Recargar o salir termina el trabajo de esa sesión; descarga lo que quieras conservar. No hay una biblioteca de trabajos guardada en la nube. La búsqueda web y la revisión con IA envían texto únicamente al solicitar esas funciones con su permiso activado.

## Qué revisa

- Extensión: cuerpo, título y encabezados, hasta Referencias o Anexos reconocidos. Las 5000 palabras están inicialmente como referencia, sin asumir un mínimo o un máximo.
- Citas y bibliografía: contraste orientativo de apellidos y años, con fragmentos localizables en el editor. No comprueba por sí solo que una fuente exista o respalde una afirmación.
- Redacción: repeticiones, oraciones extensas y expresiones que conviene examinar por su alcance.
- Coincidencias locales: secuencias de siete o más palabras entre las fuentes aportadas; cada palabra cuenta una sola vez. Ignora tildes, caja y puntuación. No mide paráfrasis semántica.
- Búsqueda pública: muestra de hasta doce consultas y veinticinco páginas, con cobertura y fallos explícitos. No accede a repositorios privados de Turnitin. Conserva heurísticas de búsqueda en inglés del componente original, con cobertura variable en español.
- Reportes externos: separa IA de similitud y conserva indicadores suprimidos como `*%`, sin inventar el valor exacto.
- Lectura con IA: tesis, argumentos, aplicación de conceptos y conclusiones según una rúbrica editable. Los puntajes son orientativos y se contrastan con evidencias literales.

No identifica autoría por estilo, no determina plagio y no reproduce la nota del profesor. No aplica penalidades porque falta una fórmula confirmada del curso.

## Iniciar localmente

En Windows, ejecuta `Iniciar.cmd` o `Iniciar.ps1`. El iniciador busca los entornos oficiales de Codex y, después, Node y Python del sistema. En otro equipo:

```sh
python -m pip install -r requirements.txt
node scripts/create-access.mjs
npm start
```

Se requieren Node.js 22+ y Python 3.11+. Abre `http://127.0.0.1:4317`. La clave generada está en `.private/Acceso-AI-Redaction.txt`; no se incluye en Git ni en Docker. La revisión básica funciona sin API key.

## Docker

```sh
node scripts/create-access.mjs
docker compose up --build -d
```

Abre `http://127.0.0.1:4317`. `compose.yaml` carga `.env` en tiempo de ejecución. El Dockerfile incluye Node y el lector Python en varias etapas, ejecuta la app con usuario sin privilegios y comprueba `/api/health`.

## Render

El repositorio incluye `render.yaml` para crear un servicio Docker, plan Free, región Oregon y comprobación de salud. Si el servicio ya existe, actualízalo: aplicar el Blueprint como un servicio nuevo puede crear un duplicado.

Configuración de producción:

| Variable | Uso |
| --- | --- |
| `NODE_ENV=production` | Exige acceso privado |
| `HOST=0.0.0.0` | Escucha el puerto de Render |
| `APP_PASSWORD_HASH` | Hash scrypt de la clave de acceso |
| `APP_ORIGIN` | Opcional; dominio propio. En Render se usa su URL externa automáticamente |
| `AI_PROVIDER` | `openrouter`, `gemini` u `openai` |
| `OPENROUTER_API_KEY` | Secreto de OpenRouter |
| `OPENROUTER_MODEL` | Inicial: `google/gemini-3.5-flash-lite` |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Alternativa nativa Gemini; modelo inicial `gemini-4-hydrogen` |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Alternativa OpenAI Responses |
| `APP_PYTHON` | Ruta del lector; Docker ya la configura |

Las API keys se configuran como secretos de Render; nunca se escriben en `render.yaml`, el cliente o Git. El acceso dura hasta 12 horas y se invalida al cerrar sesión o reiniciar el servidor. Para cambiar la clave, genera un nuevo hash con `passwordHash()` y actualiza el secreto en Render.

El plan Free puede dormir tras inactividad y tardar en abrir de nuevo. Comparte sus límites de uso con el resto del espacio de Render. No se cambia a un plan de pago automáticamente.

## Configurar IA

Copia `.env.example` como `.env` y elige un proveedor. En Internet, haz la configuración equivalente en Render. No hace falta una clave de Gemini adicional cuando se utiliza un modelo de Gemini a través de OpenRouter.

Las llamadas requieren confirmación en la pantalla y pueden consumir saldo del proveedor. Hay un límite por sesión de seis revisiones IA/web cada diez minutos, dos trabajos simultáneos y tamaño máximo por solicitud. Un fallo, falta de saldo o respuesta incompleta se muestra como error, sin fabricar una evaluación. No hay cambio automático de proveedor ni llamadas ocultas de respaldo.

OpenRouter usa esquema JSON estricto y `data_collection: deny` para sus proveedores. Gemini y OpenAI usan `store:false`. Estos parámetros no sustituyen las políticas de privacidad y conservación de cada servicio. Las observaciones se verifican contra citas literales; esto no garantiza que el razonamiento del modelo sea correcto.

Documentación oficial: [OpenRouter](https://openrouter.ai/docs/guides/features/structured-outputs), [Gemini](https://aistudio.google.com/docs/structured-output), [OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs), [Render Docker](https://render.com/docs/docker).

## Validación y límites

```sh
npm test
node scripts/e2e.mjs
```

`e2e.mjs` inicia un servidor privado de prueba y verifica acceso, CSRF, origen, extracción, citas, comparación y cierre. Para un servicio existente, utiliza `TEST_BASE_URL` y `TEST_ACCESS_FILE` apuntando al JSON privado generado; `TEST_DOCUMENT` permite comprobar un archivo propio. No activa una revisión de pago.

`node --env-file=.env scripts/check-ai.mjs` hace una llamada real breve con texto ficticio para comprobar la configuración del proveedor. No forma parte de CI.

GitHub Actions ejecuta pruebas y construye Docker. Ver `VALIDACION.md` y `CHANGELOG.md` para el alcance de la entrega.

Máximo 12 MB por archivo, 180000 caracteres y 100 páginas PDF. Sin OCR. DOCX: cuerpo y tablas, con límites para notas al pie, comentarios, cambios pendientes e imágenes. PDF: puede variar el orden de lectura y los saltos. Las citas con autores colectivos, apellidos compuestos y formatos numéricos necesitan revisión manual.

## Componentes

La comparación y búsqueda reutilizan el núcleo Apache 2.0 de Free-Turnitin-Plagiarism-Checker, conservado sin modificaciones. Ver `THIRD_PARTY_NOTICES.md` y la licencia incluida. No se incorporan los humanizadores analizados ni servicios privados sin sus accesos autorizados.
