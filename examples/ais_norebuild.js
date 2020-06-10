import {Map, View} from '../src/ol';

import {fromLonLat} from '../src/ol/proj';

import TileLayer from '../src/ol/layer/Tile';
import VectorLayer from '../src/ol/layer/Vector';
import VectorSource from '../src/ol/source/Vector';

import XYZSource from '../src/ol/source/XYZ';

import Renderer from '../src/ol/renderer/webgl/PointsLayer';

import GeoJSON from '../src/ol/format/GeoJSON';

import {defaults as defaultInteractions, DragRotateAndZoom} from '../src/ol/interaction';

const stamenLayer = new TileLayer({
    source: new XYZSource({
        url: 'http://tile.stamen.com/terrain/{z}/{x}/{y}.jpg'
    })
});

const customLayerAttributes = [{
    name: 'size',
    callback: function (feature) {
        return 30;
    },
},{
    name: 'iscircle',
    callback: function (feature) {
        const sog = feature.get('sog');

        if (sog < 0.5)
            return true;
        return false;
    },
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

function numTwoFloats(num){
    const significantDigits = 6; // float max perfect digit precision

    const sign = Math.sign(num);
    const sciRep = Math.abs(num).toExponential();
    const [mantissa, exponent] = sciRep.split('e');
    const significant = mantissa.replace('.','');
    const [first, second] = [significant.slice(0,significantDigits), significant.slice(significantDigits, 2*significantDigits)];
    const firstMantissa = first.slice(0,1) + '.' + first.slice(1) + '0';
    const secondMantissa = second.slice(0,1) + '.' + second.slice(1) + '0';
    const secondExponent = Number(exponent) - significantDigits;

    const firstFloat = sign * Number(firstMantissa + 'e' + exponent);
    const secondFloat = sign * Number(secondMantissa + 'e' + secondExponent);

    return [firstFloat, secondFloat];
}

const uniforms = {
    u_eyepos: function(framestate){
        const center = framestate.viewState.center;
        const xs = numTwoFloats(center[0]);
        const ys = numTwoFloats(center[1]);
        return [xs[0], ys[0]];
    },
    u_eyeposlow: function(framestate){
        const center = framestate.viewState.center;
        const xs = numTwoFloats(center[0]);
        const ys = numTwoFloats(center[1]);
        return [xs[1], ys[1]];
    },
    u_projTransform: function(framestate){
        const size = framestate.size;
        const rotation = framestate.viewState.rotation;
        const resolution = framestate.viewState.resolution;
        const center = framestate.viewState.center;
        const sx = 2 / (resolution * size[0]);
        const sy = 2 / (resolution * size[1]);
        const dx2 = -center[0];
        const dy2 = -center[1];
        const sin = Math.sin(-rotation);
        const cos = Math.cos(-rotation);

        const transform = new Array(6);
        transform[0] = sx * cos;
        transform[1] = sy * sin;
        transform[2] = - sx * sin;
        transform[3] = sy * cos;
        transform[4] = 0;
        transform[5] = 0;

        return transform;
    },
};


function fetchTemplate(url) {
    return fetch(url).then(response => response.text())
}
const vertexShader = fetchTemplate('/examples/shaders/ais_norebuild.vert');
const fragmentShader = fetchTemplate('/examples/shaders/ais_norebuild.frag');


Promise.all([vertexShader, fragmentShader])
    .then(function(results){
        return {
            vertex: results[0],
            fragment: results[1],
        }
    }).then(function(results){
        class CustomLayer extends VectorLayer{
            createRenderer() {
                return new Renderer(this, {
                    attributes: customLayerAttributes,
                    uniforms: uniforms,
                    vertexShader:  results.vertex,
                    fragmentShader: results.fragment,
                });
            }
        }

        const webglSource = new VectorSource({
            format: new GeoJSON(),
            url: 'data/geojson/ais.json',
            crossOrigin: 'anonymous',
        });
        const webglLayer = new CustomLayer({
            source: webglSource,
        });
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
            ],
            view: new View({
                center: fromLonLat([0, 0]),
                zoom: 2
            })
        });
    });
