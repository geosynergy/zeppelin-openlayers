import Visualization from './node_modules/zeppelin-vis/visualization.js';
import ColumnselectorTransformation from './node_modules/zeppelin-tabledata/columnselector.js';
import Map from './node_modules/ol/Map.js';
import View from './node_modules/ol/View.js';
import OSM from './node_modules/ol/source/OSM.js';
import GeoJSON from './node_modules/ol/format/GeoJSON.js';
import VectorLayer from './node_modules/ol/layer/Vector.js';
import TileLayer from './node_modules/ol/layer/Tile.js';
import { bbox as bboxStrategy } from './node_modules/ol/loadingstrategy.js';
import VectorSource from './node_modules/ol/source/Vector.js';
import Stroke from './node_modules/ol/style/Stroke.js';
import Style from './node_modules/ol/style/Style.js';

const lineStyle = new Style({
    stroke: new Stroke({
        color: 'rgba(0, 0, 255, 1.0)',
        width: 2,
    }),
});

export default class ZeppelinOpenLayers extends Visualization {
    constructor(targetEl, config) {
        super(targetEl, config);

        const columnSpec = [
          { name: 'url', tooltip: 'layer url' },
          { name: 'name', tooltip: 'layer name' },
          { name: 'type', tooltip: 'layer type' },
        ];
    
        this.transformation = new ColumnselectorTransformation(config, columnSpec);
        console.log(this, targetEl, config);
        this.map = new Map({
            target: targetEl[0],
            view: new View({
                center: [0, 0],
                zoom: 2,
            }),
            layers: [
                new TileLayer({
                    source: new OSM(),
                }),
            ],
        });
        /** @type {{name:string;url:string;layer:import('ol/layer/Base').default;is_enabled:boolean;type:"raster":"vector"}[]} */
        this.layersAvailable = [];
    }

    getTransformation() {
        return this.transformation;
    }

    showChart() {
        super.setConfig(config);
        this.transformation.setConfig(config);
        return this.map;
    }

    createMapDataModel(data) {
  
      const getColumnIndex = (config, fieldName, isOptional) => {
        const fieldConf = config[fieldName];
        if(fieldConf instanceof Object) {
          return fieldConf.index
        } else if(isOptional) {
          return -1
        } else {
          throw {
            message: "Please set " + fieldName + " in Settings"
          }
        }
      };
  
      const config = this.getTransformation().config;
      const urlIndex = getColumnIndex(config, 'url');
      const nameIndex = getColumnIndex(config, 'name', true);
      const typeIndex = getColumnIndex(config, 'type');
  
      const rows = data.rows.filter(row=>{
          return typeof row[nameIndex] === 'string' && typeof row[urlIndex] === 'string' && typeof row[typeIndex] === 'string';
      }).map(tableRow => {
        const name = tableRow[nameIndex];
        const url = tableRow[urlIndex];
        const type = tableRow[typeIndex];
        return {
            name,
            url,
            type,
        };
      });
  
      return {
        rows
      };
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

    showError(error) {
      this.targetEl[0].innerHTML = `
          <div style="margin-top: 60px; text-align: center; font-weight: 100">
              <span style="font-size:30px;">
                  ${error.message}
              </span>
          </div>`
    }

    render(tableData) {
        try {
            this.setLayers(this.createMapDataModel(tableData));
        } catch (e) {
            console.error(e);
            this.showError(e);
        }
    }
}
