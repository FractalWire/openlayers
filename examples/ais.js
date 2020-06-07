import {Map, View, Feature} from '../src/ol';

import TileLayer from '../src/ol/layer/Tile';
import VectorLayer from '../src/ol/layer/Vector';
import VectorTileLayer from '../src/ol/layer/VectorTile';

import VectorSource from '../src/ol/source/Vector';
import XYZSource from '../src/ol/source/XYZ';
import WMTSSource, {optionsFromCapabilities} from 'ol/source/WMTS';
import VectorTileSource from '../src/ol/source/VectorTile';

import {fromLonLat} from '../src/ol/proj';

import Renderer from '../src/ol/renderer/webgl/PointsLayer';

import {AttributeType} from '../src/ol/webgl/Helper';

import CustomRenderer from './CustomRenderer';

import WMTSCapabilities from '../src/ol/format/WMTSCapabilities';
import MVT from '../src/ol/format/MVT';
import GeoJSON from '../src/ol/format/GeoJSON';

import {defaults as defaultInteractions, DragRotateAndZoom} from '../src/ol/interaction';

import {RegularShape, Fill, Style, Stroke} from '../src/ol/style';

import Point from '../src/ol/geom/Point';

import sync from 'ol-hashed';

const stamenLayer = new TileLayer({
    source: new XYZSource({
        url: 'http://tile.stamen.com/terrain/{z}/{x}/{y}.jpg'
    })
});
const focusSource = new VectorSource();
const focusLayer = new VectorLayer({
    source: focusSource,
    style: new Style({
        image: new RegularShape({
            fill: new Fill({color: 'rgba(255, 255, 255, 0)'}),
            stroke: new Stroke({
                color: 'red',
                width: 1,
            }),
            points: 4,
            radius: 20,
            angle: Math.PI / 4,
        })
    })
})

const focusArrayBuffer = new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT);
const selectedFeature = new DataView(focusArrayBuffer);
selectedFeature.setInt32(0,-1);

const customLayerAttributes = [{
    name: 'size',
    callback: function (feature) {
        return 30;
    },
    notForTemplates: true,
},{
    name: 'iscircle',
    callback: function (feature) {
        const sog = feature.get('sog');

        if (sog < 0.5)
            return true;
        return false;
    },
    toFragment: true,
},{
    name: 'id',
    callback: function (feature) {
        const b = new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT);
        const dv = new DataView(b,0);
        dv.setInt32(0, parseInt(feature.getId().split('.')[1]));
        return dv.getFloat32(0);
    },
    toFragment: true,
},{
    name: 'cosangle',
    callback: function (feature) {
        return Math.cos(feature.get('cog')*Math.PI/180);
    }
},{
    name: 'sinangle',
    callback: function (feature) {
        return Math.sin(feature.get('cog')*Math.PI/180);
    }
},
];
const customLayerAttributeArrays = [
];
const uniforms = {
    u_selectedId: function(framestate){
        return selectedFeature.getFloat32(0);
    }
};

function fetchTemplate(url) {
    return fetch(url).then(response => response.text())
}
const vertexShaderTemplate = fetchTemplate('/examples/aisvertex.vert');
const fragmentShaderTemplate = fetchTemplate('/examples/optimized_ais.frag');
const hitVertexShaderTemplate = fetchTemplate('/examples/hitais.vert');
const hitFragmentShaderTemplate = fetchTemplate('/examples/hitais.frag');

// not pretty...
Promise.all([vertexShaderTemplate, fragmentShaderTemplate,
    hitVertexShaderTemplate, hitFragmentShaderTemplate,
    null])
    .then(function(results){
        return {
            vertex: results[0],
            fragment: results[1],
            hitvertex: results[2],
            hitfragment: results[3],
            options: results[4],
        }
    }).then(function(results){
        class CustomLayer extends VectorLayer{
            createRenderer() {
                return new CustomRenderer(this, {
                    attributes: customLayerAttributes,
                    arrayAttributes: customLayerAttributeArrays,
                    uniforms: uniforms,
                    vertexShader:  results.vertex,
                    fragmentShader: results.fragment,
                    hitVertexShader:  results.hitvertex,
                    hitFragmentShader: results.hitfragment,
                });
            }
        }

        const webglSource = new VectorSource({
            format: new GeoJSON(),
            // url: 'http://192.168.8.157:8600/geoserver/ais/wms?service=WMS&version=1.1.1&request=GetMap&layers=ais%3Ashipinfos&bbox=-180.0%2C-90.0%2C180.0%2C90.0&width=768&height=384&srs=EPSG%3A4326&format=geojson&time=P2DT12H/PRESENT',
            url: 'data/geojson/ais.json',
            crossOrigin: 'anonymous',
        });
        const webglLayer = new CustomLayer({
            source: webglSource,
        });
        // webglLayer.isAisLayer = true;
        const webglError = webglLayer.getRenderer().getShaderCompileErrors();
        if (webglError) {
            console.log(webglError)
        }

        const map = new Map({
            target: 'map',
            interactions: defaultInteractions().extend([
                new DragRotateAndZoom()
            ]),
            layers: [
                stamenLayer,
                webglLayer,
                focusLayer,
            ],
            view: new View({
                center: fromLonLat([0, 0]),
                zoom: 2
            })
        });

        const info = document.getElementById('info');
        const shipcount = document.getElementById('shipcount');
        const shipinfos = document.getElementById('shipinfos');

        map.on('pointermove', function(evt) {
            selectedFeature.setInt32(0,-1);
            map.forEachFeatureAtPixel(evt.pixel, function(feature) {
                // const coord = feature.getGeometry().getCoordinates();
                // const size = 30;
                // const newFocus = new Feature(new Point(coord));
                // newFocus.setStyle(focusStyle);
                // focusSource.addFeature(newFocus);
                selectedFeature.setInt32(0, parseInt(feature.getId().split('.')[1]));

                const filterKeys = ['time','name','callsign','imo','cog'];
                const properties = feature.getKeys()
                    .filter(k => filterKeys.includes(k))
                    .map(k => `<li><b>${k}:</b> <i>${feature.get(k)}</i></li>`)
                    .join('\n');
                shipinfos.innerHTML = `<li><b>id:</b> <i>${feature.getId()}</i></li>\n
                <li><b>id:</b> <i>${feature.getId().split('.')[1]}</i></li>\n
                ${properties}`;

                return true;
            }, {
                layerFilter: function(layer){
                    return layer.ol_uid == webglLayer.ol_uid;
                },

            });
            map.render();
        });

        map.on('moveend', function(evt){
            const extent = map.getView().calculateExtent(map.getSize());
            shipcount.innerHTML = webglSource.getFeaturesInExtent(extent).length;
        });

        // setInterval(function(){
        //     map.render();
        // }, 1000/30);

        sync(map);
    });
