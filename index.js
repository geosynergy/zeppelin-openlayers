import Visualization from './node_modules/zeppelin-vis/visualization.js';
import ColumnselectorTransformation from './node_modules/zeppelin-tabledata/columnselector.js';
import Map from './node_modules/ol/Map.js';
import OSM from './node_modules/ol/source/OSM.js';
import GeoJSON from './node_modules/ol/format/GeoJSON.js';
import VectorLayer from './node_modules/ol/layer/Vector.js';
import TileLayer from './node_modules/ol/layer/Tile.js';
import VectorSource from './node_modules/ol/source/Vector.js';
import Stroke from './node_modules/ol/style/Stroke.js';
import Style from './node_modules/ol/style/Style.js';
import ImageWMS from './node_modules/ol/source/ImageWMS.js';
import ImageLayer from './node_modules/ol/layer/Image.js';

const columnSpec = [
    {
        name: 'url',
        tooltip: 'layer url',
    },
    {
        name: 'name',
        tooltip: 'layer name',
    },
    {
        name: 'type',
        tooltip: 'layer type',
    },
    {
        name: 'colour',
        tooltip: 'vector colour',
    },
];
export default class ZeppelinOpenLayers extends Visualization {
    constructor(targetEl, config) {
        super(targetEl, config);
        console.log(this, config);
        /** @type {{colour:string;name:string;url:string;layer:import('ol/layer/Base').default;is_enabled:boolean;type:"raster":"vector"}[]} */
        this.layersAvailable = [];
        this.onMapViewMoveCenter = this.onMapViewMoveCenter.bind(this);
        this.transformation = new ColumnselectorTransformation(config, columnSpec);
        /** @type {import('ol').Map} */
        this.map = new Map({
            target: this.getHTMLElement(),
            layers: [
                new TileLayer({
                    source: new OSM(),
                }),
            ],
        });
        this.config.mapData = {};
        try {
            this.config.mapData.zoom = config.mapData.zoom;
        } catch (e) {
            this.config.mapData.zoom = '2';
        }
        try {
            this.config.mapData.center_x = config.mapData.center_x;
        } catch (e) {
            this.config.mapData.center_x = '0';
        }
        try {
            this.config.mapData.center_y = config.mapData.center_y;
        } catch (e) {
            this.config.mapData.center_y = '0';
        }
        this.setConfig(this.config);
        const view = this.map.getView();
        view.addEventListener('change', this.onMapViewMoveCenter);
    }

    /** @param {import('ol/events/Event').default} evt */
    onMapViewMoveCenter(ext) {
        const view = this.map.getView();
        const center = view.getCenter();
        this.config.mapData.center_x = center[0].toString();
        this.config.mapData.center_y = center[1].toString();
        this.emitConfig(this.config);
    }

    getTransformation() {
        return this.transformation;
    }

    type() {
        return 'openLayers';
    }

    /** @returns {HTMLElement} */
    getHTMLElement() {
        return this.targetEl[0];
    }

    setConfig(config) {
        super.setConfig(config);
        this.transformation.setConfig(config);
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
      const colourIndex = getColumnIndex(config, 'colour', true);
      const rows = data.rows.filter(row=>{
          return typeof row[nameIndex] === 'string' && typeof row[urlIndex] === 'string' && typeof row[typeIndex] === 'string' && row[urlIndex] && row[typeIndex];
      }).map(tableRow => {
        const name = tableRow[nameIndex];
        const url = tableRow[urlIndex];
        const type = tableRow[typeIndex];
        const colour = tableRow[colourIndex] || 'rgba(0, 0, 255, 1.0)';
        return {
            name,
            url,
            type,
            colour,
        };
      });
      return rows;
    }

    /** @param {{name:string;url:string;type:"raster"|"vector";colour:string;}[]} layers */
    setLayers(layers) {
        this.selectedLayers = layers;
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
                const geoJson = new GeoJSON({
                    extractGeometryName: true,
                });
                if (layer.type === "raster") {
                    data.layer = new ImageLayer({
                        source: new ImageWMS({
                            url: layer.url,
                            params: {
                                LAYERS: layer.name,
                            },
                            ratio: 1,
                            serverType: 'geoserver',
                        }),
                    });
                } else if (layer.type === "vector") {
                    /** @type {ConstructorParameters<typeof import('ol/source/Vector').default>[0]} */
                    let sourceParams;
                    try {
                        const info = JSON.parse(layer.url);
                        if (Array.isArray(info)) {
                            sourceParams = {
                                features: geoJson.readFeaturesFromObject(info),
                            };
                        } else if (typeof info === 'object' && info !== null) {
                            sourceParams = {
                                features: [
                                    geoJson.readFeatureFromObject(info),
                                ],
                            };
                        } else {
                            throw new Error("Not a valid featureset");
                        }
                    } catch (e) {
                        sourceParams = new VectorSource({
                            format: geoJson,
                            url: data.url,
                        });
                    }
                    data.layer = new VectorLayer({
                        source: sourceParams,
                        style: new Style({
                            stroke: new Stroke({
                                color: layer.colour || 'rgba(0, 0, 255, 1.0)',
                            }),
                        }),
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
                availableLayer.is_enabled = true;
            } else if (!was_match_found && availableLayer.is_enabled) {
                this.map.removeLayer(availableLayer.layer);
                availableLayer.is_enabled = false;
            }
        }
    }

    render(tableData) {
        "use strict";
        this.setLayers(this.createMapDataModel(tableData));
        const view = this.map.getView();
        view.setCenter([Number(this.config.mapData.center_x), Number(this.config.mapData.center_y)]);
        view.setZoom(Number(this.config.mapData.zoom));
    }
}
