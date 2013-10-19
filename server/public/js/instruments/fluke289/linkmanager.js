/**
 * The controller communication driver:
 *
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
    this.ledState = "OFF";


    //////
    //  Standard API:
    // All link managers need this function:
    //////
    this.setBackendDriver = function() {
        lm.socket.emit('driver','fluke28x');
    }

    this.startLiveStream = function(period) {
        console.log("Starting live data stream for Fluke289");
        this.livePoller = setInterval(this.queryMeasurementFull, (period) ? period*1000: 1000);
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
        self.socket.emit('controllerCommand', 'IM');
        self.socket.emit('controllerCommand', 'QCCV');
        self.socket.emit('controllerCommand', 'QCVN');
    }
    
    // Queries the primary measurement only. Adds battery check
    // every 10 queries as a bonus.
    this.queryMeasurement = function() {
        self.battCheck = (self.battCheck+1)%10;
        if (self.battCheck == 0)
            self.socket.emit('controllerCommand', 'QBL');

        self.socket.emit('controllerCommand', 'QM');
    }
    
    // Extended version, queries all currently displayed
    // measurements on the meter.
    this.queryMeasurementFull = function() {
        self.battCheck = (self.battCheck+1)%10;
        if (self.battCheck == 0)
            self.socket.emit('controllerCommand', 'QBL');

        self.socket.emit('controllerCommand', 'QDDA');
    }
    
    this.getDevInfo = function() {
        var callQueue = [ 'QMPQ operator', 'QMPQ company', 'QMPQ site', 'QMPQ contact' ];
        var idx = 0;
        // Be nice to the device and stage the queries (our driver manages a command queue, so it
        // is not strictly necessary but hey, let's be cool).
        var caller = function() {
            self.socket.emit('controllerCommand', callQueue[idx++]);
            if (idx < callQueue.length)
                setTimeout(caller,50);
        }
        caller();    
    }
    
    this.setDevInfo = function(operator, company, site, contact) {
        // Remove double quotes
        operator = operator.replace(/"/g,'');
        company = company.replace(/"/g,'');
        site = site.replace(/"/g,'');
        contact = contact.replace(/"/g,'');
        if (operator != '')
            self.socket.emit('controllerCommand', 'MPQ operator,"' + operator + '"');
        if (company != '')
            self.socket.emit('controllerCommand', 'MPQ company,"' + company + '"');
        if (site != '')
            self.socket.emit('controllerCommand', 'MPQ site,"' + site + '"');
        if (contact != '')
            self.socket.emit('controllerCommand', 'MPQ contact,"' + contact + '"');
    };
    
    this.takeScreenshot = function() {
        self.socket.emit('controllerCommand', 'QLCDBM 0');
    }
    
    this.toggleLed = function() {
        (self.ledState == "OFF") ? self.ledState="ON":self.ledState="OFF";
        self.socket.emit('controllerCommand', 'LEDT ' + self.ledState);
        if (self.ledState == "ON")
            return true;
        return false;
    }
    
    this.off = function() {
        self.socket.emit('controllerCommand', 'OFF');
    }                                        
    
    this.sendKeypress = function(key) {
        self.socket.emit('controllerCommand', 'PRESS ' + key);
    }
    
    
    // Sends several queries related to memory level.
    // Note: will fail if the meter is recording something.
    this.getMemInfo = function() {
        self.socket.emit('controllerCommand', 'QMEMLEVEL');
        self.socket.emit('controllerCommand', 'QSLS');
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

