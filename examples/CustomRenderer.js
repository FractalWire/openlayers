import {Map, View, Feature} from '../src/ol';

import TileLayer from '../src/ol/layer/Tile';
import VectorLayer from '../src/ol/layer/Vector';

import VectorSource from '../src/ol/source/Vector';
import XYZSource from '../src/ol/source/XYZ';

import Point from '../src/ol/geom/Point';

import {fromLonLat} from '../src/ol/proj';

import Renderer from '../src/ol/renderer/webgl/PointsLayer';
import {clamp} from '../src/ol/math';

import {AttributeType} from '../src/ol/webgl/Helper';


class CustomRenderer extends Renderer {
    constructor(layer, options){
        if (options.arrayAttributes && options.arrayAttributes.length)
            options.attributes.push(
                this.attributeArraysBuilder(options.arrayAttributes)
            );

        const shaders = this.shadersBuilder(
            options.vertexShader,
            options.fragmentShader,
            options.attributes,
            options.arrayAttributes
        );
        options.vertexShader = shaders.vertex;
        options.fragmentShader = shaders.fragment;
        console.log(options.vertexShader);
        console.log(options.fragmentShader);

        super(layer, options);

    }
    /*
     * Transform an array attribute to a serie of attribute usable by the
     * shaders
     * @param attributeArray The attribute array
     */
    attributeArrayBuilder_(attributeArray){
        if (attributeArray.size === undefined)
            throw new Error("AttributeArray element must have a size");
        if (attributeArray.dimension === undefined)
            throw new Error("AttributeArray element must have a size");

        if (attributeArray.size * attributeArray.dimension == 1)
            return [];

        let out = [];
        for (let i=0; i<attributeArray.size; i++){
            for (let j=0; j<attributeArray.dimension; j++){
                out.push({
                    name: `${attributeArray.name}_${i}_${j}`,
                    callback: function(feature) {
                        const cacheProperty = `${attributeArray.name}_cache_`;
                        if (!feature.hasOwnProperty(cacheProperty)){
                            // flatten multi-dimensional array
                            feature[cacheProperty] = [].concat.apply(
                                [],
                                attributeArray.callback(feature)
                            );
                        }
                        return feature[cacheProperty][i*attributeArray.size+j];
                    },
                    toFragment: false,
                });
            }
        }
        return out;
    }
    /*
     * Transform an array attribute to a serie of attribute usable by the
     * shaders
     * @param attributeArray The attribute array
     * @return All the values of the array in the form of a distinct attribute
     */
    attributeArraysBuilder(attributeArrays){
        let out = [];
        for (let i = 0; i < attributeArrays.length; i ++){
            out.push(...this.attributeArrayBuilder_(attributeArrays[i]));
        }
        return out;
    }
    /*
     * Take one attribute to add to the shaders and output warious template
     * location values for that attribute (main, init in vertex or fragment).
     * The attribute will be put in the fragment shader only if
     * attribute.toFragment is set to true.
     * @param attribute The current attribute we are working with. Can be an
     * array
     * @param fragmentBufferIndex: The index of the buffer used to store the
     * attribute
     * @param isArray: Wether or not the attribute we are working with is an
     * array
     */
    attributeShadersBuilder_(attribute, fragmentBufferIndex, isArray=false){
        function buffer_ijk(index){
            const i = index/16 >> 0;
            const j = (index%16)/4 >> 0;
            const k = index%4;
            return {i:i, j:j, k:k};

        }

        const out ={
            initVertex: '',
            mainVertex: '',
            initFragment: '',
            mainFragment: '',
            fragmentBufferIndex: 0,
        };

        out.fragmentBufferIndex = fragmentBufferIndex;
        if (attribute.notForTemplates)
            return out;

        let ijk = buffer_ijk(out.fragmentBufferIndex);

        // attribute var a_name;
        if (!isArray){
            out.initVertex += `attribute float a_${attribute.name};\n`;

            if (attribute.toFragment){
                out.mainVertex += `v_fragmentBuffer[${ijk.i}][${ijk.j}][${ijk.k}] = a_${attribute.name};\n`;
                out.mainFragment += `float b_${attribute.name} = v_fragmentBuffer[${ijk.i}][${ijk.j}][${ijk.k}];\n`;
                ijk = buffer_ijk(++out.fragmentBufferIndex);
            }

            return out
        }

        const dimName = {1:'float', 2:'vec2', 3:'vec3', 4:'vec4'}
        let varName = dimName[attribute.dimension];
        if (!attribute.dimension || attribute.dimension == 0){
            switch(true){
                case attribute.bits == 1:
                    varName = 'bool';
                    break;
                case attribute.bits <= 32:
                    varName = 'int';
                    break;
            }
        }

        if (attribute.toFragment){
            let varTemplate = `b_${attribute.name}`
            varTemplate += attribute.size > 1 ? `[]` : '';
            out.mainFragment += `${varName} ${varTemplate};\n`.replace('[]',`[${attribute.size}]`);
            for (let i=0; i < attribute.size; i++){
                let attrList = [];
                out.mainFragment += `${varTemplate} = `.replace('[]',`[${i}]`);
                for (let j=0; j < attribute.dimension; j++){
                    out.mainVertex += `v_fragmentBuffer[${ijk.i}][${ijk.j}][${ijk.k}] = a_${attribute.name}_${i}_${j};\n`;
                    attrList.push(`v_fragmentBuffer[${ijk.i}][${ijk.j}][${ijk.k}]`);
                    ijk = buffer_ijk(++out.fragmentBufferIndex);
                }
                out.mainFragment += `${varName}(${attrList.join(', ')});\n`
            }
        }


        // v_name[i] = var((elt,)*dimension);
        // for (let i=0; i<attribute.size; i++){
        //     out.mainVertex += `v_${attribute.name}`;
        //     out.mainVertex += attribute.size > 1 ? `[${i}] = ` : ` = `;
        //     let attrList = []
        //     for (let j = 0; j < attribute.dimension; j++){
        //         attrList.push(`a_${attribute.name}_${i}_${j}`);
        //     }
        //     out.mainVertex += `${varName}(${attrList.join(', ')});\n`
        // }

        return out;
    }
    /*
     * Take the shader templates with the attributes and the various
     * attributeArrays and build the shaders
     * @return The actual shaders to give to Webgl
     */
    shadersBuilder(vertexTemplate, fragmentTemplate, attributes, attributeArrays){
        const shaders = {
            vertex:'',
            fragment:'',
        }
        const attributesVal ={
            initVertex: "",
            mainVertex: "",
            initFragment: "",
            mainFragment: ""
        }
        let fragmentBufferIndex = 0;
        for (let i = 0; i < attributes.length; i++){
            let val = this.attributeShadersBuilder_(attributes[i], fragmentBufferIndex);
            attributesVal.initVertex += val.initVertex;
            attributesVal.mainVertex += val.mainVertex;
            attributesVal.initFragment += val.initFragment;
            attributesVal.mainFragment += val.mainFragment;
            fragmentBufferIndex = val.fragmentBufferIndex;
        }
        // for (let i = 0; i < attributeArrays.length; i++){
        //     let val = this.attributeShadersBuilder_(attributeArrays[i], fragmentBufferIndex, true);
        //     attributesVal.initVertex += val.initVertex;
        //     attributesVal.mainVertex += val.mainVertex;
        //     attributesVal.initFragment += val.initFragment;
        //     attributesVal.mainFragment += val.mainFragment;
        //     fragmentBufferIndex = val.fragmentBufferIndex;
        // }
        if (fragmentBufferIndex > 0){
            const bufferLen = (fragmentBufferIndex / 16 >> 0) + 1;
            const bufferStr = `varying mat4 v_fragmentBuffer[${bufferLen}];\n`;
            attributesVal.initVertex += bufferStr;
            attributesVal.initFragment += bufferStr;
        }
        shaders.vertex = vertexTemplate.replace(
            /{{(.*)}}/g, (m,p) => attributesVal[`${p}Vertex`]);
        shaders.fragment = fragmentTemplate.replace(
            /{{(.*)}}/g, (m,p) => attributesVal[`${p}Fragment`]);
        return shaders;
    }


}

export default CustomRenderer;
