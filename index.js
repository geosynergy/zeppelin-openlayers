import Visualization from './node_modules/zeppelin-vis/visualization.js';
import ColumnselectorTransformation from './node_modules/zeppelin-tabledata/columnselector.js';
import Map from './node_modules/ol/Map.js';
import View from './node_modules/ol/View.js';
import OSM from './node_modules/ol/source/OSM.js';
import GeoJSON from './node_modules/ol/format/GeoJSON.js';
import VectorLayer from './node_modules/ol/layer/Vector.js';
import TileLayer from './node_modules/ol/layer/Tile.js';
import VectorSource from './node_modules/ol/source/Vector.js';
import Stroke from './node_modules/ol/style/Stroke.js';
import Style from './node_modules/ol/style/Style.js';
import Overlay from './node_modules/ol/Overlay.js';
import ImageWMS from './node_modules/ol/source/ImageWMS.js';
import ImageLayer from './node_modules/ol/layer/Image.js';

export default class ZeppelinOpenLayers extends Visualization {
    constructor(targetEl, config) {
        super(targetEl, config);
        this.tooltip = document.createElement("div");
        this.tooltip.style.setProperty("position", "relative");
        this.tooltip.style.setProperty("padding", "3px");
        this.tooltip.style.setProperty("background", "rgba(0, 0, 0, 0.5)");
        this.tooltip.style.setProperty("color", "white");
        this.tooltip.style.setProperty("opacity", "0.7");
        this.tooltip.style.setProperty("white-space", "nowrap");
        this.tooltip.style.setProperty("font", "10pt sans-serif");
        targetEl[0].appendChild(this.tooltip);
        /** @type {import('ol/View').ViewOptions} */
        let initialViewParameters = {
            center: [0, 0],
            zoom: 2,
        };
        try {
            const params = JSON.parse(localStorage.getItem('zeppelin-openlayers-view') || '{}');
            if (typeof params === 'object' && params !== null && !Array.isArray(params)) {
                for (const key in params) {
                    initialViewParameters[key] = params[key];
                }
            }
        } catch (e) {
            console.warn('Failed to set some default parameters for the view', e);
        }

        const columnSpec = [
          { name: 'url', tooltip: 'layer url' },
          { name: 'name', tooltip: 'layer name' },
          { name: 'type', tooltip: 'layer type' },
          { name: 'colour', tooltip: 'vector colour' },
        ];
    
        this.transformation = new ColumnselectorTransformation(config, columnSpec);
        console.log(this, targetEl, config);
        /** @type {import('ol').Map} */
        this.map = new Map({
            target: targetEl[0],
            view: new View(initialViewParameters),
            layers: [
                new TileLayer({
                    source: new OSM(),
                }),
            ],
        });
        this.map.on('change:view', console.log);
        this.overlay = new Overlay({
            element: this.tooltip,
            offset: [10, 0],
            positioning: 'bottom-left',
        });
        this.map.addOverlay(this.overlay);
        /** @type {{colour:string;name:string;url:string;layer:import('ol/layer/Base').default;is_enabled:boolean;type:"raster":"vector"}[]} */
        this.layersAvailable = [];
        this.map.on('pointermove', (evt) => {
            this.onPointerMove(evt);
        });
        this.map.getView().on('change', (evt) => {
            this.onMapViewMoveCenter(evt);
        });
    }

    /** @param {import('ol/events/Event').default} evt */
    onMapViewMoveCenter(evt) {
        const view = this.map.getView();
        localStorage.setItem('zeppelin-openlayers-view', JSON.stringify({
            center: view.getCenter(),
            zoom: view.getZoom(),
        }));
    }

    /** @param {import('ol').MapBrowserEvent} evt */
    onPointerMove(evt) {
        const layersHere = [];
        var pixel = evt.pixel;
        this.map.forEachLayerAtPixel(pixel, (layer) => {
            for (const i of this.layersAvailable) {
                if (i.layer === layer) {
                    layersHere.push(i);
                    break;
                }
            }
        });
        if (layersHere.length) {
            this.tooltip.style.removeProperty('display');
            this.overlay.setPosition(evt.coordinate);
            this.tooltip.textContent = layersHere.map(a=>a.name).join('\n');
        } else {
            this.tooltip.style.setProperty('display', 'none');
        }
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
  
      return {
        rows
      };
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
        try {
            this.setLayers(this.createMapDataModel(tableData).rows);
        } catch (e) {
            console.error(e);
        }
    }
}
