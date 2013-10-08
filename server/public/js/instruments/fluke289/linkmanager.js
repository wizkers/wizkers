/**
 * The controller communication manager:
 *  - manages the socket.io link
 *  - provides API to the backend device to use by views
 *
 */


// linkManager is a reference to the parent link manager
var Fluke289LinkManager = function(linkManager) {

    var self = this;
    var lm = linkManager;
    this.socket = lm.socket;
    var streaming = false;
    var livePoller = null; // Reference to the timer for live streaming
    this.battCheck = 0;


    //////
    //  Standard API:
    // All link managers need this function:
    //////
    this.setBackendDriver = function() {
        lm.socket.emit('driver','fluke28x');
    }

    this.startLiveStream = function() {
        console.log("Starting live data stream for Fluke289");
        this.livePoller = setInterval(this.queryMeasurement, 1000);
        this.streaming = true;

    }
    
    
    this.stopLiveStream = function() {
        if (typeof this.livePoller != 'undefined') {
            console.log("Fluke 289  - Stopping live data stream");
            clearInterval(this.livePoller);
            this.streaming = false;
        }
    }
    
    //////
    // End of standard API
    //////
    
    // All commands below are fully free and depend on
    // the instrument's capabilities

    
    // Query meter for software version & serial number
    this.version = function() {
        self.socket.emit('controllerCommand', 'ID');
    }
    
    this.queryMeasurement = function() {
        self.battCheck = (self.battCheck+1)%10;
        if (self.battCheck == 0)
            self.socket.emit('controllerCommand', 'QBL');

        self.socket.emit('controllerCommand', 'QM');
    }
    
    // Helper methods to format output:
    this.units = {
        "CEL": "°C",
        "VDC": "V dc",
        "ADC": "A dc",
        "VAC": "V ac",
        "AAC": "A ac",
        "VAC_PLUS_DC": "V <small>AC+DC</small>",
        "VAC_PLUS_DC": "V <small>AC+DC</small>",
        "OHM": "&#8486;",
        "SIE": "Sie",
        "HZ": "Hz",
        "FAR": "°F",
        "F": "F",
        "PCT": "%",    
    };
    
    this.mapUnit = function(unit) {
        var res = this.units[unit];
        if (res == undefined)
                return unit;
        return res;
    }
    
    
    console.log('Started Fluke289 link manager driver..');

}

