/*
 * Acuse de recepción - Benchmarking APF / CONUEE.
 * Mismo diseño para descargas públicas, individuales en admin y ZIP.
 * El acuse acredita recepción; no representa validación técnica ni calificación.
 */
(function (root) {
    'use strict';

    var ENTIDADES = {AGS:'Aguascalientes',BC:'Baja California',BCS:'Baja California Sur',CAM:'Campeche',CHP:'Chiapas',CHH:'Chihuahua',CDMX:'Ciudad de México',COA:'Coahuila',COL:'Colima',DUR:'Durango',MEX:'Estado de México',GUA:'Guanajuato',GRO:'Guerrero',HID:'Hidalgo',JAL:'Jalisco',MIC:'Michoacán',MOR:'Morelos',NAY:'Nayarit',NLE:'Nuevo León',OAX:'Oaxaca',PUE:'Puebla',QUE:'Querétaro',ROO:'Quintana Roo',SLP:'San Luis Potosí',SIN:'Sinaloa',SON:'Sonora',TAB:'Tabasco',TAM:'Tamaulipas',TLA:'Tlaxcala',VER:'Veracruz',YUC:'Yucatán',ZAC:'Zacatecas'};
    var TIPOS = {OFI:'Oficinas administrativas',HOS:'Hospitales y centros de salud',EDU:'Centros educativos y de investigación',CUL:'Espacios culturales y recreativos',SEG:'Instalaciones de seguridad y defensa',ADU:'Infraestructura aduanal y fronteriza',OTR:'Otro tipo de inmueble'};
    var RUTA = (function () {
        var script = document.currentScript;
        return script && script.src ? script.src : root.location.href;
    })();
    var LOGO_URL = new URL('Conuee.png', RUTA).href;
    var TEXTURA_URL = new URL('TexturaVerde.jpg', RUTA).href;
    var logoDataURL = null, texturaDataURL = null, preparacion = null;

    function cargarImagen(url, outputType, width, height, cover) {
        return new Promise(function (resolve, reject) {
            var img = new Image();
            img.onload = function () {
                try {
                    var cv = document.createElement('canvas');
                    cv.width = width;
                    cv.height = height;
                    var ctx = cv.getContext('2d');
                    if (!ctx) throw new Error('No fue posible preparar los elementos del acuse.');
                    ctx.clearRect(0, 0, width, height);
                    if (cover) {
                        var ratio = Math.max(width / img.naturalWidth, height / img.naturalHeight);
                        var sw = width / ratio, sh = height / ratio;
                        ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, width, height);
                    } else {
                        ctx.drawImage(img, 0, 0, width, height);
                    }
                    resolve(cv.toDataURL(outputType, outputType === 'image/jpeg' ? 0.72 : undefined));
                } catch (e) { reject(e); }
            };
            img.onerror = function () { reject(new Error('No se pudo cargar el recurso ' + url.split('/').pop())); };
            img.src = url;
        });
    }

    function prepararLogo() {
        if (logoDataURL && (texturaDataURL || preparacion === null)) return Promise.resolve(logoDataURL);
        if (preparacion) return preparacion;
        // La textura es decorativa: si no carga, el PDF se genera con fondo verde uniforme.
        preparacion = Promise.all([
            logoDataURL ? Promise.resolve(logoDataURL) : cargarImagen(LOGO_URL, 'image/png', 1100, 366, false),
            texturaDataURL ? Promise.resolve(texturaDataURL) : cargarImagen(TEXTURA_URL, 'image/jpeg', 800, 1100, true).catch(function () { return null; })
        ]).then(function (images) {
            logoDataURL = images[0];
            texturaDataURL = images[1];
            return logoDataURL;
        }).catch(function (e) {
            preparacion = null;
            throw e;
        });
        return preparacion;
    }

    function texto(value, fallback) {
        return value === null || value === undefined || String(value).trim() === ''
            ? (fallback || 'No reportado') : String(value).trim();
    }
    function numero(value, maxDecimales) {
        if (value === null || value === undefined || value === '') return null;
        var n = Number(value);
        return Number.isFinite(n) ? n.toLocaleString('es-MX', {minimumFractionDigits:0,maximumFractionDigits:maxDecimales || 0}) : null;
    }
    function etiquetaNumero(value, unidad, decimales) {
        var n = numero(value, decimales);
        return n === null ? 'No reportado' : n + (unidad ? ' ' + unidad : '');
    }
    function consumoAnual(registro) {
        var directo = Number(registro.p023_consumo_anual);
        if (registro.p023_consumo_anual !== null && registro.p023_consumo_anual !== undefined && registro.p023_consumo_anual !== '' && Number.isFinite(directo)) return directo;
        var total = 0;
        for (var i = 1; i <= 12; i++) {
            var k = 'p' + String(i + 10).padStart(3, '0') + '_consumo_mensual_' + i;
            var v = registro[k];
            if (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) return null;
            total += Number(v);
        }
        return total;
    }
    function capacidadTR(registro) {
        var valor = registro.p027c_capacidad_aire_tr;
        if (valor !== null && valor !== undefined && valor !== '' && Number.isFinite(Number(valor))) return Number(valor);
        valor = registro.p027a_capacidad_aire_valor;
        if (valor === null || valor === undefined || valor === '' || !Number.isFinite(Number(valor))) return null;
        return registro.p027b_capacidad_aire_unidad === 'BTU_H' ? Number(valor) / 12000 : Number(valor);
    }
    function fechaYHora(value) {
        var d = new Date(value);
        if (!value || !Number.isFinite(d.getTime())) return {fecha:'No disponible',hora:'No disponible'};
        return {
            fecha:new Intl.DateTimeFormat('es-MX',{timeZone:'America/Mexico_City',day:'numeric',month:'long',year:'numeric'}).format(d),
            hora:new Intl.DateTimeFormat('es-MX',{timeZone:'America/Mexico_City',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d)
        };
    }
    function nombreArchivo(registro) {
        var nombre = texto(registro.p001_id_inmueble,'Inmueble').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 42) || 'Inmueble';
        var folio = texto(registro.id_registro,'').replace(/[^A-Za-z0-9-]/g, '').slice(0,8);
        return 'Acuse_' + nombre + '_' + folio + '.pdf';
    }
    function crearPDF(registro) {
        if (!root.jspdf || !root.jspdf.jsPDF) throw new Error('No se cargó el componente PDF. Actualice la página.');
        if (!registro || !registro.id_registro || !registro.fecha_registro) throw new Error('El registro no contiene folio o fecha de recepción.');
        if (!logoDataURL) throw new Error('El logotipo oficial no está listo. Intente nuevamente.');
        var pdf = new root.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
        var W = pdf.internal.pageSize.getWidth(), H = pdf.internal.pageSize.getHeight();
        var verde = [0,47,42], verde2 = [30,91,79], verde3 = [63,109,69], gris = [48,59,55], suave = [239,246,241];
        var L = 22, R = W - 22, A = R - L, fechas = fechaYHora(registro.fecha_registro);
        function color(a) { pdf.setTextColor(a[0],a[1],a[2]); }
        function fill(a) { pdf.setFillColor(a[0],a[1],a[2]); }
        function textoCorto(value,x,y,ancho,tamano,peso) {
            pdf.setFont('helvetica',peso || 'normal');pdf.setFontSize(tamano);
            var s = texto(value);
            while (pdf.getTextWidth(s) > ancho && s.length > 6) s = s.slice(0,-2) + '…';
            pdf.text(s,x,y);
        }
        function etiqueta(text,x,y) { color(verde2);pdf.setFont('helvetica','bold');pdf.setFontSize(8.0);pdf.text(text,x,y); }
        function dato(text,x,y,w,size) { color(gris);textoCorto(text,x,y,w,size || 10,'bold'); }
        function seccion(text,y) { color(verde);pdf.setFont('helvetica','bold');pdf.setFontSize(9.2);pdf.text(text,L,y); }
        // Fondo verde texturizado: reutiliza el recurso del sitio, sin descargar nada de Internet.
        fill(verde);pdf.rect(0,0,W,H,'F');
        if (texturaDataURL) pdf.addImage(texturaDataURL,'JPEG',0,0,W,H);
        fill([255,255,255]);pdf.roundedRect(12,8,W-24,H-16,1.5,1.5,'F');
        fill(verde);pdf.rect(12,10,W-24,43,'F');
        if (texturaDataURL) {
            // Franja texturizada tenue dentro del encabezado.
            pdf.addImage(texturaDataURL,'JPEG',12,10,W-24,43);
        }
        pdf.addImage(logoDataURL,'PNG',21,19,58,19.3);
        pdf.setFont('helvetica','bold');pdf.setFontSize(11);pdf.setTextColor(255,255,255);
        pdf.text('BENCHMARKING DE INMUEBLES',91,29);
        pdf.setFont('helvetica','normal');pdf.setFontSize(8.5);
        pdf.text('Administración Pública Federal',91,36);

        seccion('ACUSE DE RECEPCIÓN',65);
        color(gris);pdf.setFont('helvetica','normal');pdf.setFontSize(9.4);
        pdf.text('Instrumento de recolección de información',L,72);
        pdf.setDrawColor(205,219,209);pdf.line(L,77,R,77);
        fill(suave);pdf.roundedRect(L,82,A,20,1.8,1.8,'F');
        fill([42,128,81]);pdf.rect(L,82,1.7,20,'F');
        pdf.setDrawColor(42,128,81);pdf.setLineWidth(0.85);
        pdf.line(L+7.0,91.1,L+9.6,94);pdf.line(L+9.6,94,L+14.5,87.9);
        color([31,114,70]);pdf.setFont('helvetica','bold');pdf.setFontSize(11);
        pdf.text('Información recibida correctamente',L+19,90.4);
        color(gris);pdf.setFont('helvetica','normal');pdf.setFontSize(8.4);
        pdf.text('Se confirma el registro de la información del inmueble en la plataforma.',L+19,96.2);

        seccion('IDENTIFICACIÓN DEL REGISTRO',111);
        etiqueta('Folio de registro',L,118);dato(registro.id_registro,L,125,A,10.0);
        etiqueta('Contraseña del inmueble en el sistema APF',L,134);
        color(verde);textoCorto(registro.p000_contrasena_apf,L,145,A,15,'bold');
        etiqueta('Fecha de registro',L,154);dato(fechas.fecha,L,161,82,9.8);
        etiqueta('Hora de registro (CDMX)',L+89,154);dato(fechas.hora,L+89,161,76,9.8);
        etiqueta('Nombre del inmueble / institución',L,170);dato(registro.p001_id_inmueble,L,177,A,9.8);
        etiqueta('Tipo de inmueble',L,185);dato(TIPOS[registro.p004_tipo_edificio] || registro.p004_tipo_edificio,L,192,A,9.0);
        etiqueta('Entidad federativa / municipio',L,198);dato((ENTIDADES[registro.p002_entidad_federativa] || texto(registro.p002_entidad_federativa)) + ' · ' + texto(registro.p003_municipio_alcaldia),L,205,A,9.0);

        seccion('RESUMEN DE INFORMACIÓN REPORTADA',215);
        fill(suave);pdf.roundedRect(L,220,A,21,1.8,1.8,'F');
        etiqueta('CONSUMO ELÉCTRICO ANUAL REPORTADO · 2025',L,227);
        color(verde);pdf.setFont('helvetica','bold');pdf.setFontSize(15.5);
        pdf.text(etiquetaNumero(consumoAnual(registro),'kWh',2),L+2,236.2);
        var cards = [
            ['Área construida',etiquetaNumero(registro.p005_area_total_construida,'m²',2)],
            ['Capacidad de AA',etiquetaNumero(capacidadTR(registro),'TR',3)],
            ['Empleados',etiquetaNumero(registro.p024_empleados_turno_principal,'',0)],
            ['Horas de operación',etiquetaNumero(registro.p010_horas_operacion_semana,'h/sem.',2)]
        ];
        var gap = 2.5, cardW = (A-3*gap)/4;
        cards.forEach(function (card,i) {
            var x = L + i*(cardW+gap);
            fill([247,249,247]);pdf.roundedRect(x,245,cardW,18,1.3,1.3,'F');
            color([103,115,108]);pdf.setFont('helvetica','normal');pdf.setFontSize(7.2);
            textoCorto(card[0],x+2.5,251,cardW-5,7.2,'normal');
            color(verde);textoCorto(card[1],x+2.5,258,cardW-5,9.2,'bold');
        });
        color([105,115,108]);pdf.setFont('helvetica','normal');pdf.setFontSize(8.0);
        pdf.text('Este documento acredita la recepción de los datos declarados.',L,270);
        pdf.text('No constituye una validación técnica de la información reportada.',L,275);
        pdf.setDrawColor(211,224,213);pdf.line(L,280,R,280);
        color(verde);pdf.setFont('helvetica','bold');pdf.setFontSize(7.7);
        pdf.text('Comisión Nacional para el Uso Eficiente de la Energía',L,286);
        return pdf;
    }
    async function descargar(registro) {
        await prepararLogo();
        var pdf = crearPDF(registro);
        pdf.save(nombreArchivo(registro));
    }
    root.AcusesCONUEE = {prepararLogo:prepararLogo,crearPDF:crearPDF,descargar:descargar,nombreArchivo:nombreArchivo};
})(window);
