// ==========================================
// 1. SETUP PETA
// ==========================================
var map = L.map('map', { zoomControl: false }).setView([-6.98, 107.78], 13);
var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });
var sat = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}');
osm.addTo(map);
function setBasemap(layer) { map.removeLayer(osm); map.removeLayer(sat); map.addLayer(layer); }

// ==========================================
// 2. SIDEBAR
// ==========================================
var sidebar = L.control.sidebar({ container: 'sidebar', position: 'left' }).addTo(map);
sidebar.open('layers');

// ==========================================
// 3. LAYER & Z-INDEX
// ==========================================
map.createPane('pane_batas'); map.getPane('pane_batas').style.zIndex = 250;
map.createPane('pane_rtrw'); map.getPane('pane_rtrw').style.zIndex = 300;
map.createPane('pane_bidang'); map.getPane('pane_bidang').style.zIndex = 400;
map.createPane('pane_sempadan'); map.getPane('pane_sempadan').style.zIndex = 450;
map.createPane('pane_sungai'); map.getPane('pane_sungai').style.zIndex = 500;

const batasLayer = L.layerGroup().addTo(map);
const rtrwLayer = L.layerGroup().addTo(map);
const bidangLayer = L.layerGroup().addTo(map);
const sempadanLayer = L.layerGroup().addTo(map);
const sungaiLayer = L.layerGroup().addTo(map);
function toggleLayer(g, on) { if(on) map.addLayer(g); else map.removeLayer(g); }

// ==========================================
// 4. WARNA OTOMATIS
// ==========================================
function findVal(feature, keywords) {
    if (!feature.properties) return false;
    const allValues = Object.values(feature.properties).map(v => String(v).toLowerCase());
    for (let val of allValues) { for (let key of keywords) { if (val.includes(key)) return true; } }
    return false;
}
function getColorRTRW(f) {
    if (findVal(f, ['industri', 'pabrik', 'gudang', 'niaga'])) return '#FFC107';
    if (findVal(f, ['permukiman', 'pemukiman', 'hunian', 'rumah'])) return '#FF9800';
    if (findVal(f, ['tani', 'kebun', 'sawah', 'tegalan'])) return '#4CAF50';
    if (findVal(f, ['lindung', 'hutan', 'konservasi', 'resapan'])) return '#1B5E20';
    if (findVal(f, ['pertahanan', 'militer', 'hankam'])) return '#E91E63';
    if (findVal(f, ['air', 'sungai', 'danau'])) return '#2196F3';
    return '#9E9E9E';
}
function getColorBidang(f) {
    if (findVal(f, ['hak milik', 'hm', 'shm', 'sertifikat'])) return '#EA5455';
    if (findVal(f, ['guna', 'hgb', 'pakai', 'hp', 'wakaf'])) return '#FF9F43';
    if (findVal(f, ['adat', 'girik', 'c', 'desa'])) return '#B9B9C3';
    return '#B9B9C3';
}

// ==========================================
// 5. LOAD DATA
// ==========================================
function loadData(url, group, type, colorFunc, pane, title) {
    fetch(url).then(r => r.json()).then(data => {
        L.geoJSON(data, {
            pane: pane,
            interactive: (title !== "Batas Desa"),
            style: f => {
                if (type === 'hollow') return { color: '#000000', weight: 2, fillOpacity: 0, opacity: 1 }; 
                if (type === 'line') return { color: colorFunc, weight: 3 }; 
                let col = colorFunc(f);
                return { fillColor: col, color: col, weight: 1, fillOpacity: 0.65 };
            },
            onEachFeature: (f, l) => {
                l.on('click', () => {
                    let h = `<div style="border-bottom:2px solid #7367F0; padding-bottom:10px; margin-bottom:10px;">
                            <h3 style="margin:0; color:#7367F0;">${title}</h3>
                            <small style="color:#aaa;">Informasi Atribut</small>
                        </div>`;
                    for (let k in f.properties) {
                        if(f.properties[k] && f.properties[k] !== "null") {
                            h += `<div class="info-card"><span class="info-key">${k}</span><span class="info-val">${f.properties[k]}</span></div>`;
                        }
                    }
                    document.getElementById('info-content').innerHTML = h;
                    sidebar.open('info');
                });
            }
        }).addTo(group);
    }).catch(e => console.log("Gagal memuat: " + url));
}

loadData("data/BATAS DESA FIKS.geojson", batasLayer, 'hollow', null, 'pane_batas', "Batas Desa");
loadData("data/RTRW CITARIK FIKS.geojson", rtrwLayer, 'poly', getColorRTRW, 'pane_rtrw', "RTRW");
loadData("data/BIDANG TANAH FIKS.geojson", bidangLayer, 'poly', getColorBidang, 'pane_bidang', "Bidang Tanah");
loadData("data/SEMPADAN SUNGAI FIKS.geojson", sempadanLayer, 'line', '#0D47A1', 'pane_sempadan', "Sempadan Sungai");
loadData("data/SUNGAI LAMA FIKS.geojson", sungaiLayer, 'line', '#42A5F5', 'pane_sungai', "Sungai Lama");

// ==========================================
// 6. TOOLS (DRAWING & MEASURING)
// ==========================================
var drawnItems = new L.FeatureGroup().addTo(map);
var drawControl = new L.Control.Draw({ edit: { featureGroup: drawnItems } });
map.addControl(drawControl);

// Variable global untuk menyimpan mode
var currentMode = null; // 'measure_dist', 'measure_area', 'draw_poly', etc.

// Fungsi Pemicu Gambar / Ukur
function startDraw(type) {
    currentMode = 'draw';
    var drawer;
    if(type==='polygon') drawer = new L.Draw.Polygon(map);
    if(type==='polyline') drawer = new L.Draw.Polyline(map);
    if(type==='marker') drawer = new L.Draw.Marker(map);
    if(drawer) drawer.enable();
}

// FUNGSI BARU: START MEASURE
function startMeasure(type) {
    if(type === 'dist') {
        currentMode = 'measure_dist';
        // Gunakan Polyline untuk ukur jarak, aktifkan metric
        var drawer = new L.Draw.Polyline(map, {
            shapeOptions: { color: '#28C76F', weight: 4 },
            metric: true
        });
        drawer.enable();
    } else if(type === 'area') {
        currentMode = 'measure_area';
        // Gunakan Polygon untuk ukur luas
        var drawer = new L.Draw.Polygon(map, {
            shapeOptions: { color: '#FF9F43' },
            showArea: true,
            metric: true
        });
        drawer.enable();
    }
}

function clearDraw() { 
    drawnItems.clearLayers(); 
    document.getElementById('info-content').innerHTML = "<div style='text-align:center; padding:20px; color:#aaa;'>Objek dan hasil ukur telah dihapus.</div>";
}

// HANDLER SAAT GAMBAR/UKUR SELESAI
map.on(L.Draw.Event.CREATED, function(e) {
    var layer = e.layer;
    var type = e.layerType;
    drawnItems.addLayer(layer);
    
    let htmlResult = "";
    
    // LOGIKA HITUNG HASIL UKUR
    if (currentMode === 'measure_dist') {
        // Hitung Jarak (Polyline)
        var latlngs = layer.getLatLngs();
        var totalDistance = 0;
        for (var i = 0; i < latlngs.length - 1; i++) {
            totalDistance += latlngs[i].distanceTo(latlngs[i + 1]);
        }
        
        // Format satuan
        var distStr = (totalDistance > 1000) ? (totalDistance / 1000).toFixed(2) + " KM" : totalDistance.toFixed(2) + " Meter";
        
        htmlResult = `
            <div class="info-card" style="border-left-color:#28C76F;">
                <span class="info-key">HASIL PENGUKURAN</span>
                <span class="info-val">Jarak: ${distStr}</span>
            </div>`;
            
    } else if (currentMode === 'measure_area') {
        // Hitung Luas (Polygon) - Menggunakan Geodesic Area dari Leaflet Draw
        var area = L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);
        
        // Format satuan
        var areaStr = (area > 10000) ? (area / 10000).toFixed(2) + " Hektar" : area.toFixed(2) + " m²";
        
        htmlResult = `
            <div class="info-card" style="border-left-color:#FF9F43;">
                <span class="info-key">HASIL PENGUKURAN</span>
                <span class="info-val">Luas: ${areaStr}</span>
            </div>`;
            
    } else {
        // Sekedar Gambar Biasa
        htmlResult = `<div class="info-card"><span class="info-val">Objek Baru Berhasil Digambar</span></div>`;
    }
    
    // Tampilkan di Sidebar
    document.getElementById('info-content').innerHTML = htmlResult;
    sidebar.open('info');
    
    // Reset mode
    currentMode = null;
});

// Pencarian
var geocoder = L.Control.Geocoder.nominatim();
function runSearch() {
    var q = document.getElementById('search-input').value;
    if(!q) return;
    geocoder.geocode(q, function(results) {
        if(results && results.length > 0) {
            var r = results[0];
            map.fitBounds(r.bbox);
            L.marker(r.center).addTo(map).bindPopup(r.name).openPopup();
        } else { alert("Lokasi tidak ditemukan."); }
    });
}