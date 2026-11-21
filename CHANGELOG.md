# Cambios

## 0.5.0 · 21 de noviembre de 2026

- Nombre e interfaz: **AI Redaction**, con acceso privado y diseño adaptable para uso personal y familiar.
- Backend público preparado para HTTPS y Render, con sesión por cookie HttpOnly, control de origen, protección CSRF, límite de intentos y límite de revisiones externas.
- Docker de varias etapas con Node.js y Python; lector DOCX/PDF incluido, usuario sin privilegios y endpoint de salud.
- Revisión académica con OpenRouter, Gemini o OpenAI. El proveedor se configura en el servidor; las claves no llegan al navegador.
- Rúbrica editable, evidencias literales verificadas y manejo de respuestas incompletas, cuotas y saldo insuficiente.
- Conserva conteo de extensión, contraste de citas y referencias, comparación local, búsqueda pública, lectura de reportes y exportación.
- Pruebas de acceso, proveedores y flujo completo; verificación automática en GitHub Actions.
- La revisión es formativa: no identifica autoría por estilo ni reproduce Turnitin.
