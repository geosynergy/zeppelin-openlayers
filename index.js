import Visualization from 'zeppelin-vis';
import PassthroughTransformation from 'zeppelin-tabledata/passthrough';
import ColumnselectorTransformation from 'zeppelin-tabledata/columnselector'

export default class ZeppelinOpenLayers extends Visualization {
    constructor(targetEl, config) {
        super(targetEl, config);
        this.passthrough = new PassthroughTransformation(config);

        const columnSpec = [
          { name: 'layer url' },
          { name: 'layer name'},
        ];
    
        this.transformation = new ColumnselectorTransformation(config, columnSpec);
        console.log(this, targetEl, config);
    }

    render(tableData) {
        console.log(tableData);
        this.targetEl.html("Hello World!");
    }

    getTransformation() {
        return this.passthrough;
    }
}
