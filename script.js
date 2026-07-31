//================================================
// CONFIGURACIÓN GLOBAL 
//================================================

// -- Layout --
const margin = { 
    top: 100, 
    right: 50, 
    bottom: 15, 
    left: 20 
};

const tableWidth = 650;
const tableGap = 80;

let rowHeight = 55; 
let innerHeight = 0;
let totalHeight = 0;

// -- Estado global de la app --

let exportTaskMode = "summary"; 

let ganttData = [];
let currentTask = null; 

let exportColumns = [
    "id",
    "tarea",
    "responsable",
    "estado",
    "dep"
];

// -- Variables SVG y Render

let svg
let tableSvg;
let ganttSvg;
let container;

let x;
let y;

let chartArea;
let table;

let gridLayer;
let dependencyLayer;
let barsLayer;
let axisXLayer;

let barRects;


// -- Dimenciones de gráfico --

let chartWidth;
let baseChartWidth;

let minDate;
let maxDate;

let zoomLevel = 1;

// -- Configuración de zoom --

let currentZoom = 1;
let currentSvg = null;
let currentZoomBehavior = null;

// -- Local storage --
const STORAGE_KEY = "ganttProject_v1";
const STORAGE_FILE_NAME = "ganttProject_fileName";

//Paleta de colores
const colorPalette = [
    "#a589e2", 
    "#7ccfc5", 
    "#e6bb89", 
    "#e499ad", 
    "#82b1d7", 
    "#e98d81", 
    "#a6e28d"];

//================================================
// UTILIDADES
//================================================
// -- Convierte texto del CSV a objeto Date de JS --
function parseSpanishDate(value) {
    if (!value) return null;
    value = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(value + "T00:00:00");
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
        const [d, m, y] = value.split("/");
        return new Date(`${y}-${m}-${d}T00:00:00`);
    }
    const parsed = new Date(value);
    return !isNaN(parsed.getTime()) ? parsed : null;
}

// -- Convierte el String de la fecha en inputs --
function formatInputDate(date) {
    if (!date) return "";
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `${d}/${m}/${date.getFullYear()}`;
}

// -- Inputs de fechas en el editor de tareas --
function fillDateFields(prefix, date) {
    if (!date) return;

    document.getElementById(`${prefix}-day`).value =
        String(date.getDate()).padStart(2, "0");

    document.getElementById(`${prefix}-month`).value =
        String(date.getMonth() + 1).padStart(2, "0");

     document.getElementById(`${prefix}-year`).value =
        date.getFullYear();
}

function readDateFields(prefix) {
    const d = Number(document.getElementById(`${prefix}-day`).value);
    const m = Number(document.getElementById(`${prefix}-month`).value);
    const y = Number(document.getElementById(`${prefix}-year`).value);

    if (!d || !m || !y) return null;

    const date = new Date(y, m - 1, d);

    if (
        date.getFullYear() !== y ||
        date.getMonth() !== m - 1 ||
        date.getDate() !== d
    ) {
         return null;
    }

    return date;
}

/* =========================================================
RESUMIR TAREAS
========================================================= */
function smartSummarize(text, maxWords = 4) {

    if (!text) return "";

    let processedText = text.toLowerCase();

    const phraseReplacements = {
        "programa de resultados electorales preliminares": "PREP",
        "organismo público local electoral": "OPLE",
        "organismo público local": "OPLE",
        "resultados electorales preliminares": "PREP",
        "infraestructura tecnológica": "Infraestructura",
        "pruebas de caja negra": "Pruebas caja negra",
        "plan de pruebas": "Plan pruebas",
        "casos de uso": "Casos uso"
    };


    for (const phrase in phraseReplacements) {

        processedText = processedText.replace(
            phrase,
            phraseReplacements[phrase]
        );
    }

    // Si el texto ya es corto, no modificarlo
    if (text.length <= 60) {
        return text;
    }

    // Palabras poco importantes
    const stopWords = new Set([
        "de", "del", "la", "las", "los",
        "para", "por", "con", "en",
        "y", "el", "un", "una",
        "a", "al", "que", "se",
        "como", "sobre", "mediante",
        "sus", "su", "es", "ser",
        "consideren", "menos"
    ]);

    // Palabras o frases que queremos simplificar
    const replacements = {
        "proporcionarán": "Entrega",
        "proporcionar": "Entrega",
        "escritura": "",
        "documento": "",
        "documentación": "",
        "organismo": "",
        "electoral": "",
        "proveedor": "",
        "implementada": "",
        "implementación": "Implementación",
        "elaboración": "Elaboración",
        "propuesta": "Propuesta",
        "funcionalidad": "",
        "sistema": "Sistema",
        "información": "Información",
        "auditoría": "Auditoría"
    };
    
    let processed = text.toLowerCase();

    for (const key in replacements) {
        processed = processed.replace(
            key,
            replacements[key]
        );
    }

    // Separar palabras
    let words = processedText
        .replace(/[.,;:()"]/g, "")
        .split(/\s+/);

    let result = [];

    for (let word of words) {

        const lower = word.toLowerCase();

        // Ignorar palabras vacías
        if (stopWords.has(lower)) continue;

        // Aplicar reemplazos
        if (lower in replacements) {

            const replacement = replacements[lower];

            if (replacement !== "") {
                result.push(replacement);
            }

        } else {

            result.push(word);
        }

        // Ya tenemos suficientes palabras
        if (result.length >= maxWords) break;
    }

    let summary = result.join(" ");

    if (summary.length < text.length) {
        summary += "...";
    }

    console.log("================================");
    console.log("Original :", text);
    console.log("Resumen  :", summary);
    console.log("================================");

    return summary;

}

// -- Recortar textos largos --
function truncateText(text, maxLength = 32) {

    if (!text) return "";

    return text.length > maxLength
        ? text.substring(0, maxLength) + "..."
        : text;
}

//================================================
//CARGA DE ARCHIVOS CSV
//================================================

document.addEventListener("DOMContentLoaded", () => {

    // -- Carga de proyecto guardado --

    const loaded = loadFromLocalStorage();

    if (loaded) {

        renderGantt(ganttData);
        saveToLocalStorage();
    }

    // -- Elementos DOM --

    const fileInput = 
        document.getElementById("csv-file");

    const fileNameDisplay = 
        document.getElementById("file-name");

    // -- Mostrar el ultmo nombre guardado --

    const savedFileName =
        localStorage.getItem(STORAGE_FILE_NAME);

    if (savedFileName && fileNameDisplay) {

        fileNameDisplay.textContent =
            savedFileName;
    }

    // -- Evento de carga CSV --

    fileInput?.addEventListener("change", function (e) {

        const file = e.target.files[0];

        if (!file) return;

        // -- Guardar nombre del archivo --
        fileNameDisplay.textContent = file.name;

        localStorage.setItem(
            STORAGE_FILE_NAME,
            file.name
        );

        const reader = new FileReader();

        reader.onload = function (event) {

            // -- Lectura y decodificación --
            try {

                const buffer = event.target.result;

                let text;
                // -- Evitar errores con eñes o acentos --

                try { 
                    
                    text = new TextDecoder(
                                "utf-8", 
                                { fatal: true }
                            )
                            .decode(buffer); 
                } catch { 
                    
                    text = new TextDecoder(
                                "windows-1252"
                            )
                            .decode(buffer); }
                    
                // -- Limpieza de texto --

                text = text
                    .replace(/^\ufeff/, "")
                    .replace(/\r\n/g, "\n")
                    .trim();
                
                // -- Detectar separador CSV --

                const firstLine = 
                    text.split("\n")[0];

                const separator = 
                    (firstLine.match(/;/g) || []).length > 
                    (firstLine.match(/,/g) || []).length 
                        ? ";" 
                        : ",";

                const rawData = 
                    d3.dsvFormat(separator).parse(text);

                // -- Normalización de datos --

                ganttData = rawData.map((d, i) => {

                    const keys = 
                        Object.keys(d);

                    // -- Normaliza nombres de columnas -- 

                    const normalize = k => 
                            k.normalize("NFD")
                                .replace(/[\u0300-\u036f]/g, "")
                                .trim()
                                .toLowerCase();

                    // -- Buscar valor compatible --   

                    const getVal = names => {

                        const targetNames = 
                            names.map(normalize);

                        const key = 
                            keys.find(k => 
                                targetNames.includes
                                    (normalize(k))
                                );

                        return key 
                            ? d[key]?.trim() 
                            : null;
                    };

                    // -- Obtenemos el ID original del CSV --
                    const rawId = getVal([
                        "id",
                        "no de esquema",
                        "no. de esquema",
                        "No. esquema",
                        "numero de esquema",
                        "número de esquema",
                        "esquema",
                        "No.",
                        "No",
                        "#"
                    ]);

                    const taskName = getVal([
                        "tarea",
                        "Tarea",
                        "task",
                        "Task",
                        "actividad"
                    ]);

                    console.log("taskName =", taskName);

                    return {
                        
                        // -- Generación de ID 
                        id: 
                            (rawId && rawId.length < 10) 
                            ? rawId 
                            : (i + 1).toString(),
                        
                        // -- Datos principales --
                         task: taskName,

                        // Nombre resumido
                        shortTask: smartSummarize(taskName),
                        
                        start: 
                            parseSpanishDate(
                                getVal([
                                    "fecha de inicio",
                                    "inicio",
                                    "fecha inicio",
                                    "start"
                                ])
                            ),

                        end: 
                            parseSpanishDate(
                                getVal([
                                    "fecha de término",
                                    "fecha de termino",
                                    "fecha termino",
                                    "fecha fin",
                                    "fecha de fin",
                                    "fin",
                                    "termino",
                                    "término",
                                    "end"
                                ])
                            ),

                        responsable: 
                            getVal([
                                "responsable", 
                                "encargado"
                            ]) || "------",

                        estado: 
                            getVal([
                                "estado", 
                                "estatus", 
                                "status"
                            ]) || "Pendiente",

                        dependsOn: 
                            getVal([
                                "dependencia", 
                                "dependsOn", 
                                "dep"
                            ]) || null
                    };
                    
                })
                console.log(ganttData);
                
                // -- Validacion de datos --
                ganttData = ganttData.filter(d =>
                    d.task &&
                    d.start instanceof Date &&
                    d.end instanceof Date &&
                    !isNaN(d.start.getTime()) &&
                    !isNaN(d.end.getTime()) &&
                    d.end >= d.start
                );

                // -- Render y guardado --
                renderGantt(ganttData);

                saveToLocalStorage();

            } catch (err) { 
                
                alert(
                    "Error al procesar: " + 
                    err.message
                ); 
            }
        };
        reader.readAsArrayBuffer(file);
    });
});

//================================================
//RENDERIZADO
//================================================
function renderGantt(data) {

    // -- Validacion de datos --
    if (!validateData(data)) return;

    // -- Reiniciar el zoom --
    zoomLevel = 1;
    
    clearContainer();

    setupDimensions(data);

    createScales(data);

    createTableContainer();

    createSVG(data);

    createChartArea();

    createLayers();

    drawTable(data);

    drawGrid();

    drawAxis();

    drawBars(data);

    drawDependencies(data);

    setupTooltip(barRects);

    setupZoom();

    syncScroll();

}

//================================================
// VALIDAR DATOS 
//================================================
function validateData(data) {

    return data && data.length;
}

//================================================
// LIMPIAR CONTENEDORES
//================================================
function clearContainer() {

    d3.select("#gantt-container")
        .selectAll("*")
        .remove();

    d3.select("#table-container")
        .selectAll("*")
        .remove();
}

//================================================
// CALCULAR DIMENSIONES
//================================================
function setupDimensions(data) {

    // -- Validacion --
    if (!data || data.length === 0) {

        console.error(
            "¡ganttData llegó vacío a setupDimensions!"
        );

        return;
    }

    // -- Alturas generales 
    rowHeight = 55; 

    innerHeight = 
        data.length * rowHeight; 

    totalHeight = 
        innerHeight + margin.top + margin.bottom;

    // -- Rango de fechas --
    const min = 
        d3.min(data, d => d.start);

    const max =
        d3.max(data, d => d.end);

    // -- Si no hay fechas validas --
    if (!min || !max) return; 

    // -- Margen visual al rango --
    minDate = 
        d3.timeDay.offset(min, -2);

    maxDate = 
        d3.timeDay.offset(max, 2);

    const totalDays = 
        d3.timeDay.count(
            minDate, 
            maxDate
        );

    // -- Escala dinamica --
    let pixelsPerDay;

    if (totalDays <= 60) {

        pixelsPerDay = 25;

    } else if (totalDays <= 180) {

        pixelsPerDay = 10;

    } else if (totalDays <= 730) {

        pixelsPerDay = 4;

    } else {

        pixelsPerDay = 2;

    }

    // -- Ancho del gráfico --
    const visibleArea = 
        window.innerWidth - 750;

    baseChartWidth = Math.max(
        visibleArea + 400,
        totalDays * pixelsPerDay
    );

    chartWidth =    
        baseChartWidth * zoomLevel;
}

//================================================
// SVG
//================================================
function createSVG(data){

    svg = d3.select("#gantt-container")
        .append("svg")
        .attr("width", chartWidth)
        .attr("height", totalHeight);

    // Flechas
    svg.append("defs")
        .append("marker")
        .attr("id", "arrow")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 10)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#94a3b8");
}

//================================================
// ESCALAS 
//================================================
function createScales(data) {
    x = d3.scaleTime()
        .domain([minDate, maxDate])
        .range([0, chartWidth]);

    y = d3.scaleBand()
        .domain(data.map(d => d.task))
        .range([0, innerHeight])
        .padding(0.4); 
}

//================================================
// TABLA 
//================================================
// -- Contenedor SVG de la tabla --
function createTableContainer() {

    table = d3.select("#table-container")
        .append("svg")
        .attr("id", "table-svg")
        .attr("height", totalHeight)
        .append("g")
        .attr("transform", `translate(20,${margin.top})`);
}

// -- Dibujar columnas y filas de la tabla 
function drawTable(data) {
    // -- Columnas visibles seleccionadas por el usuario --
    const selectedColumns = exportColumns || [
        "id",
        "tarea",
        "responsable",
        "estado",
        "dep"
    ];

    // -- Configuración base de las columnas --
    const allColumns = [
        {
            key: "id",
            label: "ID",
            width: Math.max(
                90,
                d3.max(ganttData, d =>
                    measureText(d.id || "", 14) + 25
                )
            )
        },
        {key: "tarea", label: "Tarea", width: 500 },
        { key: "responsable", label: "Responsable", width: 200 },
        { key: "estado", label: "Estado", width: 130 },
        { key: "dep", label: "Dep.", width: 90 }
    ];

    // -- Filtrar columnas visibles --
    const visibleColumns = allColumns.filter(col =>
        selectedColumns.includes(col.key)
    );

    // -- Recalcular posiciones horizontales --
    let currentX = 0;

    visibleColumns.forEach(col => {
        col.x = currentX;
        currentX += col.width;
    });

    d3.select("#table-svg")
        .attr("width", currentX + 40);

    // -- Expandir ancho de tarea si es la única columna visible --
    if (
        visibleColumns.length === 2 &&
        selectedColumns.includes("id") &&
        selectedColumns.includes("tarea")
    ) {
        const tareaCol =
            visibleColumns.find(c => c.key === "tarea");

        tareaCol.width = 500;
    }

    // HEADERS
    table.selectAll("text.header")
        .data(visibleColumns)
        .enter()
        .append("text")
        .attr("class", "header")
        .attr("x", d => d.x)
        .attr("y", -45)
        .style("font-weight", "bold")
        .text(d => d.label);

    // FILAS
    const tableRows = table.selectAll(".table-row")
        .data(data)
        .enter()
        .append("g")
        .attr("class", "table-row")
        .style("cursor", "pointer")
        .on("click", (event, d) => openTaskEditor(d));

    // ID
    if (selectedColumns.includes("id")) {

        tableRows.append("text")
            .attr("x", visibleColumns.find(c => c.key === "id").x)
            .attr("y", d => y(d.task) + y.bandwidth() / 2)
            .attr("dominant-baseline", "middle")
            .text(d => d.id);
    }

    // TAREA
    if (selectedColumns.includes("tarea")) {

        tableRows.append("text")
            .attr("x", visibleColumns.find(c => c.key === "tarea").x)
            .attr("y", d => y(d.task) + y.bandwidth() / 2)
            .attr("dominant-baseline", "middle")
            .text(d => {

                // Si no existe un resumen, usar el nombre completo
                if (!d.shortTask) {
                    return d.task;
                }

                // Si la tarea ya es corta, no resumir
                if (d.task.length <= 45) {
                    return d.task;
                }

                // Mostrar el resumen inteligente
                return d.shortTask;
            })
            .append("title")
            .text(d => d.task); // Tooltip con el nombre completo
    }

    // RESPONSABLE
    if (selectedColumns.includes("responsable")) {

        tableRows.append("text")
            .attr("x", visibleColumns.find(c => c.key === "responsable").x +5)
            .attr("y", d => y(d.task) + y.bandwidth() / 2)
            .attr("dominant-baseline", "middle")
            .text(d => d.responsable || "");
    }

    // ESTADO
    if (selectedColumns.includes("estado")) {

        const estadoX =
            visibleColumns.find(c => c.key === "estado").x;

        const statusPill = tableRows.append("g")
            .attr(
                "transform",
                d => `translate(${estadoX}, ${
                    y(d.task) + y.bandwidth()/2 - 11
                })`
            );

        statusPill.append("rect")
            .attr("width", 85)
            .attr("height", 22)
            .attr("rx", 11)
            .style("fill", d =>
                d.estado === 'Completado' ? '#c6f6d5' :
                d.estado === 'En Progreso' ? '#bee3f8' :
                d.estado === 'Pendiente' ? '#feebc8' :
                d.estado === 'Pausado' ? '#ecc1f9' :
                '#edf2f7'
            );

        statusPill.append("text")
            .attr("x", 42)
            .attr("y", 15)
            .attr("text-anchor", "middle")
            .style("font-size", "14px")
            .style("font-weight", "500")
            .text(d => d.estado || "Pendiente");
    }

    // DEPENDENCIA
    if (selectedColumns.includes("dep")) {

        tableRows.append("text")
            .attr("x", visibleColumns.find(c => c.key === "dep").x)
            .attr("y", d => y(d.task) + y.bandwidth() / 2)
            .attr("dominant-baseline", "middle")
            .text(d => d.dependsOn || "-");
    }
}

//================================================
// ÁREA DEL GRÁFICO 
//================================================
function createChartArea() {

    chartArea = svg.append("g")
        .attr(
            "class",
            "chart-area"
        )
        .attr(
            "transform",
            `translate(0,${margin.top})`
        );
}

// -- Capas --
function createLayers() {

    gridLayer = chartArea
        .append("g")
        .attr("class", "grid");

    dependencyLayer = chartArea
        .append("g")
        .attr("class", "dependency-layer");

    barsLayer = chartArea
        .append("g")
        .attr("class", "bars-layer");

    axisXLayer = chartArea
        .append("g")
        .attr("class", "axis-x");
}

// -- Grid del diagrama --
function drawGrid(scale = x) {

    
    const totalDays =
        d3.timeDay.count(minDate, maxDate);

    const pixelsPerDay =
    Math.abs(
        scale(
            d3.timeDay.offset(minDate, 1)
        ) - scale(minDate)
    );

    let grid;

    // DÍAS
    if (pixelsPerDay >= 40) {

        grid = d3.axisTop()
            .scale(scale)
            .ticks(d3.timeDay.every(1));
    }

    // SEMANAS
    else if (pixelsPerDay >= 10) {

        grid = d3.axisTop()
            .scale(scale)
            .ticks(d3.timeWeek.every(1));
    }

    // MESES
    else {

        grid = d3.axisTop()
            .scale(scale)
            .ticks(d3.timeMonth.every(1));
    }

    grid
        .tickSize(-innerHeight)
        .tickFormat("");

    gridLayer.call(grid);
}

// -- Eje X --
function drawAxis(scale = x) {

    const pixelsPerDay =
        Math.abs(
            scale(
                d3.timeDay.offset(minDate, 1)
            ) - scale(minDate)
        );

    let axis;

    // ===== DÍAS =====
    if (pixelsPerDay >= 40) {

        axis = d3.axisTop()
            .scale(scale)
            .ticks(d3.timeDay.every(1))
            .tickFormat(
                d3.timeFormat("%d %b")
            );
    }

    // ===== SEMANAS =====
    else if (pixelsPerDay >= 10) {

        axis = d3.axisTop()
            .scale(scale)
            .ticks(d3.timeWeek.every(1))
            .tickFormat(d => {

                const day =
                    d3.timeFormat("%d")(d);

                const month =
                    d.toLocaleDateString(
                        "es-ES",
                        { month: "short" }
                    );

                return `${day} ${month}`;
            });
    }

    // ===== MESES =====
    else {

        axis = d3.axisTop()
            .scale(scale)
            .ticks(d3.timeMonth.every(1))
            .tickFormat(d =>
                d.toLocaleDateString(
                    "es-ES",
                    {
                        month: "short",
                        year: "numeric"
                    }
                )
            );
    }

    axis.tickSizeOuter(0);

    axisXLayer.call(axis);

    // estilo texto
    axisXLayer.selectAll("text")
        .style("font-size", "20px")
        .attr("transform", "rotate(-35)")
        .style("text-anchor", "start");
}

//================================================
// BARRAS
//================================================
function drawBars(data) {

    const barHeight = 24;

    barRects = barsLayer.selectAll(".bar")
        .data(data)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.start))
        .attr("y",
             d => y(d.task) + (y.bandwidth() - barHeight) / 2
        )
        .attr("height", barHeight)
        .attr("rx", 12)
        .style(
            "fill",
            (d, i) => colorPalette[i % colorPalette.length]
        )
        .attr("width", d => {
            const width = x(d.end) - x(d.start);
            return Math.max(width, 10);
        })
        .style("cursor", "pointer")
        .on("click", (event, d) => {
            openTaskEditor(d);
        });
}

// -- Informacion de las barras --
function setupTooltip(barRects) {

    const tooltip = d3.select("#tooltip");

    barRects

    .on("mouseover", (event, d) => {

        tooltip
            .html(`
                <div style="border-bottom:1px solid #e2e8f0;margin-bottom:4px;padding-bottom:3px;">
                    <strong style="font-size:14px;color:#2c5282;">
                        ${d.task}
                    </strong>
                </div>

                <div style="font-size:13px;line-height:1.4;">
                    <b>ID:</b> ${d.id}<br>
                    <b>Responsable:</b> ${d.responsable || "N/A"}<br>
                    <b>Inicio:</b> ${formatInputDate(d.start)}<br>
                    <b>Fin:</b> ${formatInputDate(d.end)}
                </div>

                <div style="margin-top:8px;">
                    <span style="
                        display:inline-block;
                        padding:4px 10px;
                        border-radius:12px;
                        font-size:12px;
                        font-weight:700;

                        background-color:${
                            d.estado === 'Completado' ? '#c6f6d5' :
                            d.estado === 'En Progreso' ? '#bee3f8' :
                            d.estado === 'Pendiente' ? '#feebc8' :
                            d.estado === 'Pausado' ? '#ecc1f9' :
                            '#edf2f7'
                        };

                        color:${
                            d.estado === 'Completado' ? '#22543d' :
                            d.estado === 'En Progreso' ? '#2c5282' :
                            d.estado === 'Pendiente' ? '#744210' :
                            d.estado === 'Pausado' ? '#46005b' :
                            '#4a5568'
                        };
                    ">
                        ${d.estado || "Pendiente"}
                    </span>
                </div>
            `)

            .style("opacity", 1)
            .style("visibility", "visible");
    })

    .on("mousemove", (event) => {

        const tooltipNode = tooltip.node();

        const tooltipWidth = tooltipNode.offsetWidth;
        const tooltipHeight = tooltipNode.offsetHeight;

        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        // usa coordenadas de la página pero ajustadas correctamente
        let left = event.clientX + 10;
        let top = event.clientY + 10;

        if (left + tooltipWidth > windowWidth - 20) {
            left = event.clientX - tooltipWidth - 10;
        }

        if (top + tooltipHeight > windowHeight - 20) {
            top = windowHeight - tooltipHeight - 20;
        }

        tooltip
            .style("left", left + "px")
            .style("top", top + "px");
    })

    .on("mouseout", () => {

        tooltip
            .style("opacity", 0)
            .style("visibility", "hidden");
    });
}

//================================================
// DEPENDENCIAS 
//================================================
function drawDependencies(data) {

    updateDeps(x, data, y);
}

function updateDeps(scaleX, data, y) {
    dependencyLayer.selectAll("*").remove();
    data.forEach(task => {
        if (!task.dependsOn || task.dependsOn === "-") return;
        const dep = data.find(t => String(t.id) === String(task.dependsOn));
        if (!dep) return;
        const x1 = scaleX(dep.end), x2 = scaleX(task.start);
        const y1 = y(dep.task) + y.bandwidth() / 2, y2 = y(task.task) + y.bandwidth() / 2;
        const gap = Math.max(20, (x2 - x1) / 2);
        const path = `M ${x1} ${y1} C ${x1 + gap} ${y1}, ${x2 - gap} ${y2}, ${x2} ${y2}`;
        dependencyLayer.append("path").attr("d", path).attr("fill", "none")
            .attr("stroke", "#94a3b8").attr("stroke-width", 1.8).attr("marker-end", "url(#arrow)");
    });
}

function recomputeTask(task) {

    if (!task.dependsOn) return;

    const parent = ganttData.find(
        t => String(t.id) === String(task.dependsOn)
    );

    if (!parent) return;

    const duration =
        d3.timeDay.count(task.start, task.end);

    const newStart =
        d3.timeDay.offset(parent.end, 1);

    task.start = newStart;
    task.end = d3.timeDay.offset(newStart, duration);
}

// -- Recalcular desde las dependencias --
function recomputeAll() {

    let changed = true;

    while (changed) {
        changed = false;

        ganttData.forEach(t => {

            if (!t.dependsOn) return;

            const parent = ganttData.find(
                x => String(x.id) === String(t.dependsOn)
            );

            if (!parent) return;

            const duration =
                d3.timeDay.count(t.start, t.end);

            const expectedStart =
                d3.timeDay.offset(parent.end, 1);

            if (t.start.getTime() !== expectedStart.getTime()) {
                t.start = expectedStart;
                t.end = d3.timeDay.offset(expectedStart, duration);
                changed = true;
            }
        });
    }
}



//================================================
// ZOOM 
//================================================
function setupZoom() {

    const zoom = d3.zoom()

        .scaleExtent([0.5, 20])

        .on("zoom", (event) => {

            // nivel zoom
            const zoomFactor =
                event.transform.k;

            // nuevo ancho
            chartWidth =
                baseChartWidth * zoomFactor;

            // expandir SVG
            svg.attr("width", chartWidth);

            // ACTUALIZAR ESCALA REAL
            x.range([0, chartWidth]);

            // REDIBUJAR GRID
            drawGrid(x);

            // REDIBUJAR EJE
            drawAxis(x);

            // ACTUALIZAR BARRAS
            barRects
                .attr("x", d => x(d.start))
                .attr(
                    "width",
                    d => Math.max(
                        x(d.end) - x(d.start),
                        10
                    )
                );

            // DEPENDENCIAS
            updateDeps(
                x,
                ganttData,
                y
            );
        });

    svg.call(zoom);

    // quitar rueda mouse
    svg.on("wheel.zoom", null);

    currentSvg = svg;
    currentZoomBehavior = zoom;
}

// -- Actualizacion de eje X --
function updateZoomAxis(zx) {
    
    drawAxis(zx);
} 

// -- Actualizacion del grid --
function updateZoomGrid(zx) {

    drawGrid(zx);
}

// -- Actualizacion del barras --
function updateZoomBars(zx) {

    barRects
        .attr("x", d => zx(d.start))
        .attr("width",
             d => Math.max(zx(d.end) - zx(d.start), 10)
        );

}

// -- Acercar -- 
function zoomIn() {
    if (!currentSvg || !currentZoomBehavior) return;

    currentZoom = Math.min(currentZoom + 0.2, 4);

    applyCenteredZoom();
}

// -- Alejar -- 
function zoomOut() {
    if (!currentSvg || !currentZoomBehavior) return;

    currentZoom = Math.max(currentZoom - 0.2, 0.5);

    applyCenteredZoom();
}

// -- Mantener el zoom centrado -- 
function applyCenteredZoom() {

    if (!currentSvg || !currentZoomBehavior) return;

    const transform = d3.zoomIdentity
        .scale(currentZoom);

    currentSvg
        .transition()
        .duration(300)
        .call(
            currentZoomBehavior.transform,
            transform
        );
}


//================================================
// EDITOR DE TAREAS 
//================================================
function openTaskEditor(d) {

    currentTask = d;

    const editor = document.getElementById("task-editor");
    const taskInput = document.getElementById("edit-task");
    const responsableInput = document.getElementById("edit-responsable");
    const estadoInput = document.getElementById("edit-estado");
    const select = document.getElementById("edit-dependencia");

    if (!editor || !taskInput || !responsableInput || !estadoInput || !select) {
            console.error("Faltan campos del editor en el HTML");
            return;
        }

    taskInput.value = d.task || "";
    responsableInput.value = d.responsable || "";
    estadoInput.value = d.estado || "Pendiente";
    
    // Cargamos las fechas como texto editable
    fillDateFields("edit-start", d.start);
    fillDateFields("edit-end", d.end);
    
    document.getElementById("edit-estado").value = d.estado || "Pendiente";

    // Poblar selector de dependencias 
    select.innerHTML = '<option value="">Sin dependencia</option>';
    ganttData.forEach(t => {
        if (String(t.id) === String(d.id)) return;
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = `${t.id} - ${t.task}`;
        if (typeof createsCircularDependency === "function" && createsCircularDependency(d.id, t.id)) { 
            opt.disabled = true; 
            opt.textContent += " (circular)"; 
        }
        select.appendChild(opt);
    });
    select.value = d.dependsOn || "";
    
    editor.style.display = "block";
    editor.classList.remove("hidden");
}

// -- Para cerrar ventana de edicion de tareas --
function closeTaskEditor() {

    const ed = document.getElementById("task-editor");
    if (ed) {
        ed.style.display = "none";
        ed.classList.add("hidden");
    }
    currentTask = null;
}

//================================================
// ACTUALIZACION DE TAREAS
//================================================

// -- Modal de confirmacion -- 
function mostrarConfirmacion({
    titulo = "Confirmar acción",
    mensaje = "¿Deseas continuar?",
    textoSi = "Sí",
    textoNo = "Cancelar",
    tipo = "normal"
}) {

    return new Promise((resolve) => {

        const modal = document.getElementById("custom-confirm");

        const title = document.querySelector(".confirm-title");

        const message = document.getElementById("confirm-message");

        const btnSi = document.getElementById("btn-si");

        const btnNo = document.getElementById("btn-no");

        // Textos
        title.innerText = titulo;
        message.innerText = mensaje;

        btnSi.innerText = textoSi;
        btnNo.innerText = textoNo;

        // Reset clases
        btnSi.classList.remove("danger-btn");

        // Estilo peligro
        if (tipo === "danger") {
            btnSi.classList.add("danger-btn");
        }

        modal.classList.remove("hidden");
        modal.style.display = "flex";

        btnSi.onclick = () => {

            modal.style.display = "none";
            modal.classList.add("hidden");

            resolve(true);
        };

        btnNo.onclick = () => {

            modal.style.display = "none";
            modal.classList.add("hidden");

            resolve(false);
        };
    });
}

//================================================
// FUNCIÓN DE GUARDADO
//================================================
async function saveTask() {
    if (!currentTask) return;

    const newStart = readDateFields("edit-start");
    const newEnd = readDateFields("edit-end");

    // 1. Validación de integridad: No puede empezar antes que su padre
    const dependenciaId = document.getElementById("edit-dependencia").value;
    if (dependenciaId) {
        const parentTask = ganttData.find(t => String(t.id) === String(dependenciaId));
        if (parentTask && newStart < parentTask.end) {
            alert(`Error de lógica: Esta tarea depende de la ID ${dependenciaId} y no puede iniciar antes de su finalización.`);
            return;
        }
    }

    const diffTime = newStart.getTime() - currentTask.start.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    if (newEnd < newStart) {
        alert("Error: la fecha de fin no puede ser anterior a la de inicio.");
        return;
    }

    // Preguntamos por las tareas AJENAS a la cadena de dependencia
    const moverTodo = await mostrarConfirmacion({
        titulo: "¿Sincronizar proyecto?",
        mensaje: "¿Deseas desplazar también las tareas que no dependen de esta?",
        textoSi: "Sí, mover todo",
        textoNo: "No, solo esta y sus hijos"
    });

    // Actualizamos la tarea principal
    currentTask.task = document.getElementById("edit-task").value || currentTask.task;
    currentTask.start = newStart;
    currentTask.end = newEnd;
    currentTask.dependsOn = dependenciaId || null;

    if (moverTodo) {
        // Desplazamiento global (incluye independientes)
        ganttData.forEach(t => {
            if (t.id !== currentTask.id) {
                t.start = d3.timeDay.offset(t.start, diffDays);
                t.end = d3.timeDay.offset(t.end, diffDays);
            }
        });
    } 

    recomputeAll();
    renderGantt(ganttData);
    saveToLocalStorage();
    closeTaskEditor();
}

//================================================
// PARA EVITAR DEPENDENCIAS CIRULARES
// ===============================================
function createsCircularDependency(taskId, depId) {
    let curr = String(depId);
    const visited = new Set();
    while (curr) {
        if (curr === String(taskId) || visited.has(curr)) return true;
        visited.add(curr);
        const t = ganttData.find(x => String(x.id) === curr);
        curr = t?.dependsOn ? String(t.dependsOn) : null;
    }
    return false;
}

/* =========================================================
   MENÚ DE EXPORTACIÓN
========================================================= */
// --Para ver el menú --
function toggleMenu(event) {
    event.stopPropagation();

    const menu = document.querySelector(".dropdown-content");
    if (menu) {
        menu.classList.toggle("show");
    }
}

window.addEventListener("click", (event) => {

    const dropdown = document.querySelector(".dropdown");

    if (dropdown && !dropdown.contains(event.target)) {

        document.querySelectorAll(".dropdown-content")
            .forEach(menu => {
                menu.classList.remove("show");
            });
    }
});

function measureText(text, fontSize = 14) {

    const tempSvg = d3.select("body")
        .append("svg")
        .style("visibility", "hidden")
        .style("position", "absolute");

    const tempText = tempSvg
        .append("text")
        .style("font-size", `${fontSize}px`)
        .style("font-family", "Arial, Helvetica, sans-serif")
        .text(text || "");

    const width =
        tempText.node().getComputedTextLength();

    tempSvg.remove();

    return width;
}

// -- Exportacion  de JPG, PNG y PDF-- 
function openExportModal(format) {

    exportFormat = format;

    const modal =
        document.getElementById("export-modal");

    const container =
        document.getElementById("column-options");

    const columns = [
        {
            key: "id",
            label: "ID",
            width: 60
        },
        {
            key: "tarea",
            label: "Tarea",
            width:
                Math.max(
                    220,
                    d3.max(ganttData, d =>
                        measureText(d.task)
                    ) + 40
                )
        },
        {
            key: "responsable",
            label: "Responsable",
            width:
                Math.max(
                    200,
                    d3.max(ganttData, d =>
                        measureText(d.responsable || "")
                    ) + 80
                )
        },
        {
            key: "estado",
            label: "Estado",
            width: 140
        },
        {
            key: "dep",
            label: "Dep.",
            width: 90
        }
    ];

    let currentX = 0;

    columns.forEach(col => {
        col.x = currentX;
        currentX += col.width;
    });

    container.innerHTML = "";

    columns.forEach(col => {

        const checked =
            exportColumns.includes(col.key)
                ? "checked"
                : "";

        container.innerHTML += `
            <label style="
                display:flex;
                gap:10px;
                margin-bottom:10px;
                align-items:center;
            ">
                <input
                    type="checkbox"
                    value="${col.key}"
                    ${checked}
                >
                ${col.label}
            </label>
        `;
    });

    modal.classList.remove("hidden");

    //Para descarga de tareas completas o resumen
    if (exportColumns.includes("tarea")) {

        container.innerHTML += `
            <hr style="margin:15px 0">

            <label style="font-weight:bold">
                Mostrar tareas:
            </label>

            <label style="display:block;margin-top:8px">
                <input
                    type="radio"
                    name="taskMode"
                    value="summary"
                    checked
                >
                Resumidas
            </label>

            <label style="display:block">
                <input
                    type="radio"
                    name="taskMode"
                    value="full"
                >
                Completas
            </label>
        `;
    }
}

async function processExport() {

    const checked =
        Array.from(
            document.querySelectorAll(
                "#column-options input:checked"
            )
        ).map(el => el.value);

    if (!checked.length) {

        alert("Selecciona al menos una columna");
        return;
    }

    const previousColumns = [...exportColumns];

    exportColumns = checked;

    document
        .getElementById("export-modal")
        .classList.add("hidden");

    const selectedMode =
        document.querySelector(
            "input[name='taskMode']:checked"
        );

        if (selectedMode) {
            exportTaskMode = selectedMode.value;
        }
    renderGantt(ganttData);

    await generateExport(exportFormat);

    exportColumns = previousColumns;

    renderGantt(ganttData);
}

async function generateExport(format) {
    const temp = document.createElement("div");
    temp.className = "export-temp";
    temp.innerHTML = `<div id="temp-wrapper"></div>`;

    document.body.appendChild(temp);

    const wrapper = temp.querySelector("#temp-wrapper");
    const clone = document.getElementById("gantt-wrapper").cloneNode(true);
    wrapper.appendChild(clone);

    // Obtener las referencias del DOM clonado y del Gantt original
    const originalGanttSvg = document.querySelector("#gantt-container svg");
    const exportSvgContainer = clone.querySelector("#table-container");
    const exportSvg = exportSvgContainer ? exportSvgContainer.querySelector("svg") : null;

    // 1. CONFIGURACIÓN BASE DE COLUMNAS CON SUS PESOS/ANCHOS DESEADOS
    const allConfigColumns = [
        { key: "id", label: "ID", width: 55 },
        { key: "tarea", label: "Tarea", width: 260 },
        { key: "responsable", label: "Responsable", width: 130 },
        { key: "estado", label: "Estado", width: 100 },
        { key: "dep", label: "Dep.", width: 80 }
    ];

    // ANCHO FIJO DESEADO PARA EL ÁREA DE LA TABLA EN EL EXPORT (Suma original ~625px)
    const TARGET_TABLE_WIDTH = 625; 
    const marginLeft = 15;
    const paddingRight = 15;
    const availableWidth = TARGET_TABLE_WIDTH - marginLeft - paddingRight;

    // 2. FILTRAR Y CALCULAR ANCHOS/POSICIONES DINÁMICAS (EXPANDIBLES)
    const activeColumns = allConfigColumns.filter(col => exportColumns.includes(col.key));

    if (activeColumns.length > 0) {
        // Asignamos anchos dinámicos si la columna "tarea" está presente para que absorba el espacio sobrante,
        // o distribuimos proporcionalmente entre las visibles.
        const fixedColsWidth = activeColumns
            .filter(c => c.key !== "tarea")
            .reduce((acc, c) => acc + c.width, 0);

        let currentX = marginLeft;

        activeColumns.forEach(col => {
            col.x = currentX;

            if (col.key === "tarea") {
                // Si la columna es "Tarea", le asignamos todo el ancho restante disponible
                col.computedWidth = Math.max(col.width, availableWidth - fixedColsWidth);
            } else {
                col.computedWidth = col.width;
            }

            currentX += col.computedWidth;
        });
    }

    // El ancho total de la tabla siempre será constante
    const totalTableWidth = TARGET_TABLE_WIDTH;

    // Configuración de tamaños de fuente
    let fontSize = 12;
    let headerFontSize = 13;
    let rowHeight = 40;

    if (activeColumns.length <= 2) {
        fontSize = 14;
        headerFontSize = 15;
        rowHeight = 45;
    }

    // 3. CALCULAR ALTURA REAL DEL COMPONENTE
    let realTotalHeight = 0;
    if (originalGanttSvg) {
        realTotalHeight = originalGanttSvg.getBoundingClientRect().height;
    }
    if (!realTotalHeight || realTotalHeight < 200) {
        realTotalHeight = margin.top + (ganttData.length * rowHeight) + 80;
    }

    // 4. DIBUJAR LA TABLA EN EL SVG CLONADO
    const d3ExportSvg = d3.select(exportSvg);
    d3ExportSvg.html("");

    d3ExportSvg
        .attr("width", totalTableWidth)
        .attr("height", realTotalHeight)
        .attr("viewBox", `0 0 ${totalTableWidth} ${realTotalHeight}`)
        .style("width", `${totalTableWidth}px`)
        .style("min-width", `${totalTableWidth}px`)
        .style("height", `${realTotalHeight}px`)
        .style("overflow", "visible");

    // Renderizar Encabezados
    const headerY = 30; 
    activeColumns.forEach(col => {
        d3ExportSvg.append("text")
            .attr("x", col.x)
            .attr("y", headerY)
            .style("font-family", "Arial, Helvetica, sans-serif")
            .style("font-weight", "bold")
            .style("font-size", `${headerFontSize}px`)
            .style("fill", "#333")
            .text(col.label);
    });

    // Renderizar Filas
    ganttData.forEach((row) => {
        const rowY = margin.top + y(row.task) + y.bandwidth() / 2;

        activeColumns.forEach(col => {
            let val = "";
            
            if (col.key === "id") {
                val = row.id ?? "";
            } else if (col.key === "tarea") {
                val = (exportTaskMode === "summary") ? (row.shortTask || row.task) : row.task;
                
                // Recorte dinámico según el ancho calculado de la columna tarea
                const maxChars = Math.floor(col.computedWidth / 8); 
                if (val.length > maxChars) {
                    val = val.substring(0, maxChars - 3) + "...";
                }
            } else if (col.key === "responsable") {
                val = row.responsable || row.responsible || "------";
            } else if (col.key === "estado") {
                val = row.estado || row.status || "Pendiente";
            } else if (col.key === "dep") {
                const depVal = row.dependsOn ?? row.dep ?? row.dependencia ?? row.dependencies;
                val = (depVal !== undefined && depVal !== null && depVal !== "") ? depVal : "-";
            }

            d3ExportSvg.append("text")
                .attr("x", col.x)
                .attr("y", rowY)
                .attr("dominant-baseline", "middle")
                .style("font-family", "Arial, Helvetica, sans-serif")
                .style("font-size", `${fontSize}px`)
                .style("fill", "#555")
                .text(String(val));
        });
    });

    // 5. AJUSTAR ANCHOS Y ALTURAS EN EL LAYOUT CLONADO
    const ganttWidth = originalGanttSvg ? originalGanttSvg.getBoundingClientRect().width : 800;
    const totalWrapperWidth = totalTableWidth + ganttWidth;

    if (exportSvgContainer) {
        exportSvgContainer.style.setProperty("width", `${totalTableWidth}px`, "important");
        exportSvgContainer.style.setProperty("min-width", `${totalTableWidth}px`, "important");
        exportSvgContainer.style.setProperty("max-width", `${totalTableWidth}px`, "important");
        exportSvgContainer.style.setProperty("flex", `0 0 ${totalTableWidth}px`, "important");
        exportSvgContainer.style.setProperty("height", `${realTotalHeight}px`, "important");
        exportSvgContainer.style.setProperty("overflow", "visible", "important");
    }

    const exportGanttContainer = clone.querySelector("#gantt-container");
    if (exportGanttContainer) {
        exportGanttContainer.style.setProperty("width", `${ganttWidth}px`, "important");
        exportGanttContainer.style.setProperty("min-width", `${ganttWidth}px`, "important");
        exportGanttContainer.style.setProperty("flex", `0 0 ${ganttWidth}px`, "important");
        exportGanttContainer.style.setProperty("height", `${realTotalHeight}px`, "important");
        exportGanttContainer.style.setProperty("overflow", "visible", "important");
    }

    // Ajustes en el wrapper principal
    clone.style.setProperty("display", "flex", "important");
    clone.style.setProperty("flex-direction", "row", "important");
    clone.style.setProperty("width", `${totalWrapperWidth}px`, "important");
    clone.style.setProperty("min-width", `${totalWrapperWidth}px`, "important");
    clone.style.setProperty("height", `${realTotalHeight}px`, "important");
    clone.style.setProperty("max-width", "none", "important");
    clone.style.setProperty("overflow", "visible", "important");

    wrapper.style.setProperty("width", `${totalWrapperWidth}px`, "important");
    wrapper.style.setProperty("height", `${realTotalHeight}px`, "important");
    wrapper.style.setProperty("max-width", "none", "important");
    wrapper.style.setProperty("overflow", "visible", "important");

    // Desactivar scrollbars en los elementos contenedores
    const ganttScroll = clone.querySelector("#gantt-scroll");
    const tableScroll = clone.querySelector("#table-scroll");
    if (ganttScroll) {
        ganttScroll.style.setProperty("overflow", "visible", "important");
        ganttScroll.style.setProperty("height", `${realTotalHeight}px`, "important");
    }
    if (tableScroll) {
        tableScroll.style.setProperty("overflow", "visible", "important");
        tableScroll.style.setProperty("height", `${realTotalHeight}px`, "important");
    }

    await new Promise(r => setTimeout(r, 400));

    // 6. CAPTURA DE PANTALLA COMPLETA
    const captureHeight = clone.scrollHeight || realTotalHeight;

    const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: 0,
        width: totalWrapperWidth,
        height: captureHeight,
        windowWidth: totalWrapperWidth,
        windowHeight: captureHeight
    });

    // 7. EXPORTAR FORMATO (PNG / JPEG / PDF)
    if (format === "png" || format === "jpeg") {
        const link = document.createElement("a");
        link.download = getExportFileName(format);
        link.href = canvas.toDataURL(`image/${format}`, 1);
        link.click();
    } 
    else if (format === "pdf") {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: "landscape",
            unit: "px",
            format: "a4"
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const pdfMargin = 15;

        const usablePdfWidth = pdfWidth - pdfMargin * 2;
        const usablePdfHeight = pdfHeight - pdfMargin * 2;
        const scale = usablePdfWidth / canvas.width;

        const pageCanvas = document.createElement("canvas");
        const pageCtx = pageCanvas.getContext("2d");

        pageCanvas.width = canvas.width;
        pageCanvas.height = usablePdfHeight / scale;

        let yOffset = 0;
        let first = true;

        while (yOffset < canvas.height) {
            pageCtx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
            pageCtx.drawImage(
                canvas,
                0, yOffset, canvas.width, pageCanvas.height,
                0, 0, canvas.width, pageCanvas.height
            );

            if (!first) pdf.addPage();

            pdf.addImage(
                pageCanvas.toDataURL("image/png"),
                "PNG",
                pdfMargin,
                pdfMargin,
                usablePdfWidth,
                pageCanvas.height * scale
            );

            yOffset += pageCanvas.height;
            first = false;
        }

        pdf.save(getExportFileName("pdf"));
    }

    // 8. LIMPIEZA
    document.body.removeChild(temp);
}

// -- DESCARGAR CSV --
function downloadCSV() {
    if (!ganttData || !ganttData.length) {
        alert("No hay datos para descargar.");
        return;
    }

    const headers = [
        "ID",
        "Tarea",
        "Responsable",
        "Fecha de inicio",
        "Fecha de fin",
        "Estado",
        "Dependencia"
    ];

    const rows = ganttData.map(d => [
        d.id,
        escapeCSV(d.task),
        `"${d.responsable || ""}"`,
        formatInputDate(d.start),
        formatInputDate(d.end),
        `"${d.estado || ""}"`,
        d.dependsOn || ""
    ]);

    const csvContent = [
        headers.join(","),
        ...rows.map(r => r.join(","))
    ].join("\n");

    const blob = new Blob(
        ["\ufeff" + csvContent],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "cronograma_actualizado.csv";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

// -- Nombre para la exportacion -- 

function getExportFileName(extension) {

    const savedName =
        localStorage.getItem(STORAGE_FILE_NAME);

    let baseName = "cronograma";

    if (savedName) {

        baseName =
            savedName.replace(/\.[^/.]+$/, "");
    }

    // Obtener contador actual
    let version =
        Number(
            localStorage.getItem("exportVersion")
        ) || 1;

    const finalName =
        `${baseName}_v${version}.${extension}`;

    // Incrementar para siguiente descarga
    localStorage.setItem(
        "exportVersion",
        version + 1
    );

    return finalName;
}

// -- SVG temporal para respetar el ancho de las columnas a la hora de la descarga -- 
function exportSVG() {

    const CELL_PADDING = 12;

    const columns = [
        {
            key: "id",
            label: "ID",
            width: 70
        },

        {
            key: "tarea",
            label: "Tarea",
            width:
                Math.max(
                    260,
                    d3.max(ganttData, d =>
                        measureText(d.task)
                    ) + 40
                )
        },

        {
            key: "responsable",
            label: "Responsable",
            width:
                Math.max(
                    240,
                    d3.max(ganttData, d =>
                        measureText(d.responsable || "")
                    ) + 40
                )
        }
    ];

    let currentX = 0;

    columns.forEach(col => {

        col.x = currentX;

        currentX += col.width;
    });

    const exportSvg = d3.select("body")
        .append("svg");

    // HEADERS
    exportSvg.selectAll(".header")
        .data(columns)
        .enter()
        .append("text")
        .attr("x", d => d.x + CELL_PADDING)
        .attr("y", 40)
        .text(d => d.label);

    // FILAS
    ganttData.forEach((d, i) => {

        const y = 90 + (i * 40);

        exportSvg.append("text")
            .attr(
                "x",
                columns.find(c => c.key === "id").x + CELL_PADDING
            )
            .attr("y", y)
            .text(d.id);

        exportSvg.append("text")
            .attr(
                "x",
                columns.find(c => c.key === "tarea").x + CELL_PADDING
            )
            .attr("y", y)
            .text(d.task);

        exportSvg.append("text")
            .attr(
                "x",
                columns.find(c => c.key === "responsable").x + CELL_PADDING
            )
            .attr("y", y)
            .text(d.responsable || "");
    });

    generateExport()
}

/* =========================================================
GUARDADO AUTOMATICO 
========================================================= */
// -- Guardar proyecto automáticamente --
function saveToLocalStorage() {

    const dataToSave = ganttData.map(task => ({
        ...task,

        // Convertimos fechas a texto
        start: task.start ? task.start.toISOString() : null,
        end: task.end ? task.end.toISOString() : null
    }));

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(dataToSave)
    );
}

// -- Cargar proyecto guardado --
function loadFromLocalStorage() {

    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return false;

    try {

        const parsed = JSON.parse(saved);

        ganttData = parsed.map(task => ({
            ...task,

            // Convertimos texto nuevamente a Date
            start: task.start ? new Date(task.start) : null,
            end: task.end ? new Date(task.end) : null
        }));

        return true;

    } catch (err) {

        console.error("Error cargando localStorage:", err);

        return false;
    }
}

/* =========================================================
FUNCION  PARA EL SCROLL VERTICAL COMPARTIDO
========================================================= */
function syncScroll() {

    const tableScroll = document.getElementById("table-scroll");
    const ganttScroll = document.getElementById("gantt-scroll");

    let syncing = false;

    tableScroll.addEventListener("scroll", () => {

        if (syncing) return;

        syncing = true;

        ganttScroll.scrollTop = tableScroll.scrollTop;

        syncing = false;
    });

    ganttScroll.addEventListener("scroll", () => {

        if (syncing) return;

        syncing = true;

        tableScroll.scrollTop = ganttScroll.scrollTop;

        syncing = false;
    });

}


/* =========================================================
BOTON PARA BORRAR EL PROYECTO
========================================================= */
async function clearProject() {

    const confirmDelete = await mostrarConfirmacion({

        titulo: "¿Eliminar proyecto?",

        mensaje:
            "¿Seguro que deseas eliminar el proyecto actual?",

        textoSi: "Sí, eliminar",

        textoNo: "Cancelar",

        tipo: "danger"

    });

    if (!confirmDelete) return;

    // Limpiar datos
    ganttData = [];

    // Limpiar localStorage
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_FILE_NAME);

    // Limpiar SVG
    d3.select("#gantt-container")
        .selectAll("*")
        .remove();

    // Limpia la tabla
    d3.select("#table-container")
        .selectAll("*")
        .remove();

    // Reiniciar nombre archivo
    const fileName = document.getElementById("file-name");

    if (fileName) {
        fileName.textContent =
            "Ningún archivo seleccionado";
    }

    localStorage.removeItem("exportVersion");

    // Reiniciar input file
    const fileInput = document.getElementById("csv-file");

    if (fileInput) {
        fileInput.value = "";
    }

    console.log("Proyecto eliminado");

}

/* =========================================================
PROYECTOS CON COMILLAS EN EL NOMBRE 
========================================================= */
function escapeCSV(value) {
    return `"${String(value).replace(/"/g, '""')}"`;
}