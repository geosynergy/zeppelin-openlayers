import Visualization from 'zeppelin-vis';
import PassthroughTransformation from 'zeppelin-tabledata/passthrough';

export default class ZeppelinOpenLayers extends Visualization {
    constructor(targetEl, config) {
        super(targetEl, config);
        this.passthrough = new PassthroughTransformation(config);
    }

    render(tableData) {
        console.log(tableData);
        this.targetEl.html("Hello World!");
    }

    getTransformation() {
        return this.passthrough;
    }
}
