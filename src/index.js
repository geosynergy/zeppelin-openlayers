import Visualization from 'zeppelin-vis';
import PassthroughTransformation from 'zeppelin-tabledata/passthrough';
import ColumnselectorTransformation from 'zeppelin-tabledata/columnselector';
const Map = require('../node_modules/ol/Map.js').default;
const View = require('../node_modules/ol/View.js').default;
const OSM = require('../node_modules/ol/source/OSM.js').default;
const GeoJSON = require('../node_modules/ol/format/GeoJSON.js').default;
const VectorLayer = require('../node_modules/ol/layer/Vector.js').default;
const bboxStrategy = require('../node_modules/ol/loadingstrategy.js').bbox;
const VectorSource = require('../node_modules/ol/source/Vector.js').default;
const Stroke = require('../node_modules/ol/style/Stroke.js').default;
const Style = require('../node_modules/ol/style/Style.js').default;

const lineStyle = new Style({
    stroke: new Stroke({
        color: 'rgba(0, 0, 255, 1.0)',
        width: 2,
    }),
});

export default class ZeppelinOpenLayers extends Visualization {
    constructor(targetEl, config) {
        super(targetEl, config);
        this.passthrough = new PassthroughTransformation(config);

        const columnSpec = [
          { name: 'layer url' },
          { name: 'layer name'},
          { name: 'layer type'},
        ];
    
        this.transformation = new ColumnselectorTransformation(config, columnSpec);
        console.log(this, targetEl, config);
        this.map = new Map({
            target: targetEl,
            view: new View({
                center: [0, 0],
                zoom: 2,
            }),
            layers: [
                new OSM(),
            ],
        });
        /** @type {{name:string;url:string;layer:import('ol/layer/Base').default;is_enabled:boolean;type:"raster":"vector"}[]} */
        this.layersAvailable = [];
    }

    /** @param {{name:string;url:string;type:"raster"|"vector"}[]} layers */
    setLayers(layers) {
        const layersAvailable = this.layersAvailable;
        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            let was_match_found = false;
            for (let j = 0; j < layersAvailable.length; j++) {
                const availableLayer = layersAvailable[j];
                if (availableLayer.name === layer.name && availableLayer.url === layer.url && availableLayer.type === layer.type) {
                    was_match_found = true;
                    break;
                }
            }
            if (!was_match_found) {
                const data = {
                    is_enabled: false,
                    name: layer.name,
                    url: layer.url,
                    type: layer.type,
                };
                if (layer.type === "raster") {
                    throw new Error("raster type not implemented");
                } else if (layer.type === "vector") {
                    data.layer = new VectorLayer({
                        source: new VectorSource({
                            format: new GeoJSON(),
                            url: (extent) => {
                                return data.url.replace(/\{bbox\}/gi, extent.join(','));
                            },
                            strategy: bboxStrategy,
                        }),
                        style: lineStyle,
                    });
                } else {
                    throw new Error("Layer type not recognised.");
                }
                layersAvailable.push(data);
            }
        }
        for (let i = 0; i < layersAvailable.length; i++) {
            const availableLayer = layersAvailable[i];
            let was_match_found = false;
            for (let j = 0; j < layers.length; j++) {
                const layer = layers[j];
                if (layer.name === availableLayer.name && layer.url === availableLayer.url && availableLayer.type === layer.type) {
                    was_match_found = true;
                    break;
                }
            }
            if (was_match_found && !availableLayer.is_enabled) {
                this.map.addLayer(availableLayer.layer);
            } else if (!was_match_found && availableLayer.is_enabled) {
                this.map.removeLayer(availableLayer.layer);
            }
        }
    }

    render(tableData) {
        try {
            console.log(tableData);
        } catch (e) {
            console.error(error);
            this.showError(error);
        }
    }

    getTransformation() {
        return this.passthrough;
    }
}
