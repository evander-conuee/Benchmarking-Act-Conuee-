/*
 * Acuses de recepción - Benchmarking APF, CONUEE
 * Mismo formato para envíos nuevos y registros históricos.
 * No incluye la contraseña APF ni datos energéticos.
 * El folio procede del id_registro existente en Supabase.
 */
(function (root) {
    'use strict';

    // Descripciones que ya utiliza el formulario (códigos P002 y P004).
    var ENTIDADES = {"AGS": "Aguascalientes", "BC": "Baja California", "BCS": "Baja California Sur", "CAM": "Campeche", "CHP": "Chiapas", "CHH": "Chihuahua", "CDMX": "Ciudad de México", "COA": "Coahuila", "COL": "Colima", "DUR": "Durango", "MEX": "Estado de México", "GUA": "Guanajuato", "GRO": "Guerrero", "HID": "Hidalgo", "JAL": "Jalisco", "MIC": "Michoacán", "MOR": "Morelos", "NAY": "Nayarit", "NLE": "Nuevo León", "OAX": "Oaxaca", "PUE": "Puebla", "QUE": "Querétaro", "ROO": "Quintana Roo", "SLP": "San Luis Potosí", "SIN": "Sinaloa", "SON": "Sonora", "TAB": "Tabasco", "TAM": "Tamaulipas", "TLA": "Tlaxcala", "VER": "Veracruz", "YUC": "Yucatán", "ZAC": "Zacatecas"};
    var TIPOS = {"OFI": "Oficinas administrativas", "HOS": "Hospitales y centros de salud", "EDU": "Centros educativos y de investigación", "CUL": "Espacios culturales y recreativos", "SEG": "Instalaciones de seguridad y defensa", "ADU": "Infraestructura aduanal y fronteriza", "OTR": "Otro tipo de inmueble"};

    // Utiliza exactamente el mismo archivo oficial que ya está publicado
    // junto a index.html y admin.html en el repositorio.
    var logoDataURL = null;
    var logoPromise = null;
    var logoURL = (function () {
        var script = document.currentScript;
        return new URL('Conuee.png', script && script.src ? script.src : window.location.href).href;
    })();

    function prepararLogo() {
        if (logoDataURL) return Promise.resolve(logoDataURL);
        if (logoPromise) return logoPromise;
        logoPromise = new Promise(function (resolve, reject) {
            var img = new Image();
            img.onload = function () {
                try {
                    // Conservar el fondo transparente del PNG oficial,
                    // igual que en los encabezados del formulario y administrador.
                    var canvas = document.createElement('canvas');
                    canvas.width = 1200;
                    canvas.height = Math.round(1200 * img.naturalHeight / img.naturalWidth);
                    var ctx = canvas.getContext('2d');
                    if (!ctx) throw new Error('El navegador no pudo preparar el logotipo.');
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    logoDataURL = canvas.toDataURL('image/png');
                    resolve(logoDataURL);
                } catch (e) { reject(e); }
            };
            img.onerror = function () {
                reject(new Error('No pudo cargarse Conuee.png del repositorio. Verifique que el archivo conserve exactamente ese nombre en la raíz de GitHub.'));
            };
            img.src = logoURL;
        }).catch(function (e) {
            logoPromise = null; // Permite reintentar si la conexión falla.
            throw e;
        });
        return logoPromise;
    }

    function texto(v) {
        return v === null || v === undefined || String(v).trim() === ''
            ? 'No especificado' : String(v).trim();
    }

    function fechaMexico(value) {
        if (!value) return 'No disponible';
        var d = new Date(value);
        if (isNaN(d.getTime())) return 'No disponible';
        return new Intl.DateTimeFormat('es-MX', {
            timeZone: 'America/Mexico_City',
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: false
        }).format(d) + ' (hora del centro de México)';
    }

    function nombreArchivo(registro) {
        var name = texto(registro.p001_id_inmueble)
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '')
            .slice(0, 45) || 'Inmueble';
        var folio = texto(registro.id_registro).replace(/[^A-Za-z0-9-]/g, '').slice(0, 8);
        return 'Acuse_' + name + '_' + folio + '.pdf';
    }

    function crearPDF(registro) {
        if (!root.jspdf || !root.jspdf.jsPDF) {
            throw new Error('No pudo cargarse el componente PDF. Revise su conexión y actualice la página. El registro guardado no se pierde.');
        }
        if (!registro || !registro.id_registro || !registro.fecha_registro) {
            throw new Error('El registro no contiene folio o fecha de recepción.');
        }
        if (!logoDataURL) {
            throw new Error('El logotipo oficial no está listo. Intente nuevamente.');
        }
        var pdf = new root.jspdf.jsPDF({orientation:'portrait', unit:'mm', format:'letter'});
        var w = pdf.internal.pageSize.getWidth();
        var dark = [0,47,42], green = [40,96,73];
        var left = 23, width = w-46;

        // Encabezado: logotipo oficial transparente directamente sobre verde.
        pdf.setFillColor.apply(pdf, dark);
        pdf.rect(0,0,w,30,'F');
        pdf.addImage(logoDataURL,'PNG',left+3.3,3.8,70.4,23.4);
        pdf.setTextColor(255,255,255);
        pdf.setFont('helvetica','bold');pdf.setFontSize(10);
        pdf.text('Herramienta de Benchmarking',left+84,12.7);
        pdf.setFont('helvetica','normal');pdf.setFontSize(9);
        pdf.text('Administración Pública Federal',left+84,19.1);

        pdf.setTextColor.apply(pdf, dark);
        pdf.setFont('helvetica','bold');pdf.setFontSize(16);
        pdf.text('ACUSE DE RECEPCIÓN',left,45);
        pdf.setFont('helvetica','normal');pdf.setFontSize(10.5);
        pdf.text('Herramienta de Benchmarking en la Administración Pública Federal',left,53);
        pdf.setDrawColor(198,214,205);pdf.line(left,60,w-left,60);

        var items = [
            ['Folio de registro', texto(registro.id_registro)],
            ['Fecha y hora de recepción', fechaMexico(registro.fecha_registro)],
            ['Nombre del inmueble / institución', texto(registro.p001_id_inmueble)],
            ['Entidad federativa', ENTIDADES[registro.p002_entidad_federativa] || texto(registro.p002_entidad_federativa)],
            ['Municipio o alcaldía', texto(registro.p003_municipio_alcaldia)],
            ['Tipo de inmueble', TIPOS[registro.p004_tipo_edificio] || texto(registro.p004_tipo_edificio)]
        ];
        var y = 70;
        items.forEach(function(item,i) {
            pdf.setFont('helvetica','bold');pdf.setFontSize(9);
            pdf.setTextColor.apply(pdf, green);
            pdf.text(item[0],left,y);
            pdf.setFont('helvetica','normal');pdf.setFontSize(10.5);
            pdf.setTextColor(38,48,45);
            var lines = pdf.splitTextToSize(item[1], width);
            if (lines.length > 3) {
                lines = lines.slice(0,3);
                lines[2] = lines[2].slice(0, Math.max(0, lines[2].length-4)) + '...';
            }
            pdf.text(lines,left,y+6);
            y += 16 + Math.max(0,lines.length-1)*5;
            pdf.setDrawColor(231,236,231);pdf.line(left,y-3,w-left,y-3);
        });
        y += 9;
        if (y > 197) {
            pdf.addPage();
            y = 23;
        }
        pdf.setFillColor(241,246,243);
        pdf.roundedRect(left,y,width,31,2,2,'F');
        pdf.setTextColor(38,48,45);pdf.setFont('helvetica','bold');pdf.setFontSize(10);
        pdf.text('Confirmación de recepción',left+5,y+8);
        pdf.setFont('helvetica','normal');pdf.setFontSize(9.5);
        var declaracion = 'La información declarada para el inmueble indicado fue recibida y registrada en la herramienta de Benchmarking de la APF.';
        pdf.text(pdf.splitTextToSize(declaracion,width-10),left+5,y+15);

        pdf.setTextColor(103,116,108);pdf.setFont('helvetica','normal');pdf.setFontSize(8.2);
        var nota = 'Este acuse confirma únicamente la recepción del registro. No constituye una validación de los datos declarados, una calificación energética ni una certificación del inmueble.';
        pdf.text(pdf.splitTextToSize(nota,width),left,236);
        pdf.setDrawColor(198,214,205);pdf.line(left,258,w-left,258);
        pdf.text('Folio de referencia para verificación por el área administradora.',left,265);
        pdf.text('Fecha de emisión: ' + fechaMexico(new Date().toISOString()),left,271);
        return pdf;
    }

    async function descargar(registro) {
        await prepararLogo();
        var pdf = crearPDF(registro);
        pdf.save(nombreArchivo(registro));
    }

    root.AcusesCONUEE = {
        prepararLogo:prepararLogo,
        crearPDF:crearPDF,
        descargar:descargar,
        nombreArchivo:nombreArchivo
    };
})(window);
