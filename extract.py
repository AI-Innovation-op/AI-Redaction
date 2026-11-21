import base64,io,json,sys,zipfile
sys.stdin.reconfigure(encoding='utf-8');sys.stdout.reconfigure(encoding='utf-8')
def extract(data):
    name=str(data.get('name','')); ext=name.rsplit('.',1)[-1].lower()
    if ext not in ('docx','pdf','txt','md'): raise ValueError('Formatos admitidos: DOCX, PDF con texto, TXT y MD.')
    raw=base64.b64decode(data['data'],validate=True)
    if len(raw)>12_000_000: raise ValueError('El archivo supera 12 MB.')
    warnings=[]
    if ext=='docx':
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            if sum(i.file_size for i in z.infolist())>60_000_000: raise ValueError('DOCX demasiado grande al descomprimirse.')
        from docx import Document
        doc=Document(io.BytesIO(raw)); lines=[]
        from docx.oxml.ns import qn
        from docx.text.paragraph import Paragraph
        from docx.table import Table
        for child in doc.element.body:
            if child.tag==qn('w:p'): lines.append(Paragraph(child,doc).text)
            elif child.tag==qn('w:tbl'):
                for row in Table(child,doc).rows: lines.append(' | '.join(c.text for c in row.cells))
        text='\n\n'.join(lines)
        warnings.append('Se extrae texto principal y tablas; no comentarios, cambios pendientes, notas al pie ni texto dentro de imágenes.')
    elif ext=='pdf':
        import pdfplumber
        with pdfplumber.open(io.BytesIO(raw)) as pdf:
            if len(pdf.pages)>100: raise ValueError('El PDF supera 100 páginas.')
            chunks=[p.extract_text(x_tolerance=2) or '' for p in pdf.pages]
        empty=sum(not p.strip() for p in chunks)
        if empty: warnings.append(f'{empty} páginas sin texto extraíble. Esta versión no realiza OCR.')
        # Join wrapped PDF lines while retaining blank paragraph separations/headings.
        text='\n\n'.join(chunks)
        warnings.append('El PDF puede alterar saltos de línea y orden de lectura. Revisa el texto extraído antes de analizar.')
    else:
        try: text=raw.decode('utf-8-sig')
        except UnicodeDecodeError: text=raw.decode('cp1252');warnings.append('Se interpretó el archivo como Windows-1252.')
    if not text.strip(): raise ValueError('No se encontró texto legible. Si es un escaneo, aplica OCR antes de cargarlo.')
    if len(text)>180000: raise ValueError('El texto supera 180 000 caracteres.')
    return {'name':name,'text':text.replace('\r\n','\n').replace('\r','\n'),'warnings':warnings}
try: print(json.dumps(extract(json.load(sys.stdin)),ensure_ascii=False))
except Exception as e:
    print(json.dumps({'error':str(e)},ensure_ascii=False));sys.exit(1)
