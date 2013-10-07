/**
 * The controller communication manager:
 *  - manages the socket.io link
 *  - provides API to the backend device to use by views
 *
 */


// linkManager is a reference to the parent link manager
var OnyxLinkManager = function(linkManager) {

    var self = this;
    var lm = linkManager;
    this.socket = lm.socket;
    var streaming = false;
    var livePoller = null; // Reference to the timer for live streaming


    //////
    //  Standard API:
    // All link managers need this function:
    //////
    this.setBackendDriver = function() {
        lm.socket.emit('driver','onyx');
    }

    this.startLiveStream = function() {
        console.log("Starting live data stream for Onyx");
        this.livePoller = setInterval(this.getCPM, 1000);
        this.streaming = true;

    }
    
    
    this.stopLiveStream = function() {
        if (typeof this.livePoller != 'undefined') {
            console.log("Stopping live data stream");
            clearInterval(this.livePoller);
            this.streaming = false;
        }
    }
    
    //////
    // End of standard API
    //////
    
    
    // All commands below are fully free and depend on
    // the instrument's capabilities

    this.ping = function() {
            self.socket.emit('controllerCommand', 'HELLO');
    };
    
    this.getCPM = function() {
            // console.log('cpm...');
            self.socket.emit('controllerCommand', 'GETCPM');
    };
    
    this.getlog = function() {
            self.socket.emit('controllerCommand', 'LOGPAUSE');
            setTimeout(function() {
                self.socket.emit('controllerCommand', 'LOGXFER');
                // Note: looking @ the firmware, the Onyx does the "log resume"
                // by itself after transfer (as well as the log pause before, actually);
            },1000);
    };
    
    this.help = function() {
            self.socket.emit('controllerCommand', 'HELP');
    };
    
    this.version = function() {
            self.socket.emit('controllerCommand', '{"get": "version"}');
    };
    
    this.guid = function() {
            self.socket.emit('controllerCommand', '{ "get": "guid" }');
    };
    
    this.devicetag = function() {
            self.socket.emit('controllerCommand', '{ "get": "devicetag" }');
    };
    
    this.setdevicetag = function(tag) {
        console.log('Device tag: ' + tag);
        self.socket.emit('controllerCommand', '{ "set": { "devicetag": "' + tag + '"}}');
    };

    this.displaytest = function() {
        self.socket.emit('controllerCommand', 'DISPLAYTEST');
    };

    this.settime = function() {
            var unixTime = Math.round((new Date()).getTime() / 1000);
            console.log('Unix time: ' + unixTime);
            self.socket.emit('controllerCommand', '{ "set": { "rtc": ' + unixTime + ' }}');
    };
        
    
    console.log('Started Onyx link manager driver..');
}

